import { google } from "googleapis";
import type { User } from "@workspace/db";

const OAUTH_CLIENT_ID = process.env.GMAIL_CLIENT_ID ?? "";
const OAUTH_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET ?? "";

/**
 * The single redirect URI used for ALL OAuth flows (Google login + Gmail connect).
 * Must be registered in Google Cloud Console.
 *
 * In Replit production: https://<first-domain>/api/auth/callback
 * In dev: http://localhost:5000/api/auth/callback  (or override with OAUTH_REDIRECT_URI)
 */
export function getOAuthRedirectUri(): string {
  if (process.env.OAUTH_REDIRECT_URI) {
    return process.env.OAUTH_REDIRECT_URI;
  }
  const domains = process.env.REPLIT_DOMAINS;
  if (domains) {
    const first = domains.split(",")[0].trim();
    return `https://${first}/api/auth/callback`;
  }
  return "http://localhost:5000/api/auth/callback";
}

export function getOAuth2Client() {
  return new google.auth.OAuth2(OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, getOAuthRedirectUri());
}

/**
 * Generate the Google OAuth URL for SIGN-IN (basic profile scopes only).
 * State must be "google-login" so the callback knows which flow to handle.
 */
export function getGoogleAuthUrl(): string {
  const client = getOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
    ],
    state: "google-login",
  });
}

/**
 * Generate the Gmail OAuth URL for connecting an existing account.
 * State encodes "gmail-connect:<userId>" so the callback saves tokens for the right user.
 */
export function getGmailAuthUrl(userId: number): string {
  const client = getOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/gmail.compose",
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
    ],
    state: `gmail-connect:${userId}`,
  });
}

export async function exchangeCode(code: string) {
  const client = getOAuth2Client();
  const { tokens } = await client.getToken(code);
  return tokens;
}

export async function getGmailClient(user: User) {
  const client = getOAuth2Client();
  client.setCredentials({
    access_token: user.gmailAccessToken,
    refresh_token: user.gmailRefreshToken,
    expiry_date: user.gmailTokenExpiry?.getTime(),
  });
  return google.gmail({ version: "v1", auth: client });
}

export async function createGmailDraft(
  user: User,
  to: string,
  subject: string,
  body: string
): Promise<string> {
  const gmail = await getGmailClient(user);

  const message = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "MIME-Version: 1.0",
    "",
    body,
  ].join("\n");

  const encoded = Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const draft = await gmail.users.drafts.create({
    userId: "me",
    requestBody: {
      message: { raw: encoded },
    },
  });

  return draft.data.id ?? "";
}

export async function getOAuthUserInfo(accessToken: string) {
  const client = getOAuth2Client();
  client.setCredentials({ access_token: accessToken });
  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const { data } = await oauth2.userinfo.get();
  return data;
}

/** @deprecated Use getOAuthUserInfo instead */
export const getGmailUserInfo = getOAuthUserInfo;
