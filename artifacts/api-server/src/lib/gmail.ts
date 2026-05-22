import { google } from "googleapis";
import type { User } from "@workspace/db";

const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID ?? "";
const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET ?? "";
const GMAIL_REDIRECT_URI = process.env.GMAIL_REDIRECT_URI ?? "http://localhost:5000/api/gmail/callback";

export function getOAuth2Client() {
  return new google.auth.OAuth2(GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REDIRECT_URI);
}

export function getGmailAuthUrl(state?: string): string {
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
    state,
  });
}

export function getGoogleAuthUrl(state?: string): string {
  const client = getOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
    ],
    state,
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

export async function getGmailUserInfo(accessToken: string) {
  const client = getOAuth2Client();
  client.setCredentials({ access_token: accessToken });
  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const { data } = await oauth2.userinfo.get();
  return data;
}
