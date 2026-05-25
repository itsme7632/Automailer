import nodemailer, { type Transporter } from "nodemailer";
import type { Mailbox } from "@workspace/db";
import { decrypt } from "./crypto";

export interface SmtpCredentials {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassEncrypted: string;
  smtpSecure: string;
}

function buildTransportOptions(creds: SmtpCredentials, rawPass?: string) {
  const pass = rawPass ?? decrypt(creds.smtpPassEncrypted);
  const isSSL = creds.smtpSecure === "ssl";
  const isTLS = creds.smtpSecure === "tls";
  return {
    host: creds.smtpHost,
    port: creds.smtpPort,
    secure: isSSL,
    requireTLS: isTLS,
    auth: { user: creds.smtpUser, pass },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 15_000,
    greetingTimeout: 20_000,
    socketTimeout: 30_000,
  } as const;
}

/**
 * Convert raw nodemailer/network errors into short, actionable messages.
 * The cPanel / Hostinger / Zoho mistake of using "domain.com" instead of
 * "mail.domain.com" as the SMTP host is the #1 cause of greeting timeouts.
 */
function friendlySmtpError(err: unknown): Error {
  const msg = err instanceof Error ? err.message : String(err);
  const code = (err as any)?.code as string | undefined;

  if (
    code === "ETIMEDOUT" ||
    code === "ESOCKET" ||
    msg.toLowerCase().includes("greeting") ||
    msg.toLowerCase().includes("timeout")
  ) {
    return new Error(
      `Connection timeout — the SMTP server did not respond. ` +
      `For cPanel/Hostinger, the host should be mail.yourdomain.com, not yourdomain.com. ` +
      `Check the host, port, and encryption settings in Mailbox Settings.`
    );
  }

  if (code === "ECONNREFUSED") {
    return new Error(
      `Connection refused on port ${(err as any)?.port ?? "?"}. ` +
      `SSL uses port 465, STARTTLS uses port 587. Check your port and encryption setting.`
    );
  }

  if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
    return new Error(
      `SMTP host not found — "${(err as any)?.hostname ?? "?"}" does not resolve. ` +
      `Check the hostname in Mailbox Settings.`
    );
  }

  if (msg.toLowerCase().includes("invalid login") || msg.toLowerCase().includes("authentication")) {
    return new Error(`Authentication failed — check your SMTP username and password.`);
  }

  return err instanceof Error ? err : new Error(msg);
}

/** Create a reusable Nodemailer transporter from a stored Mailbox row. */
export function createSmtpTransport(mailbox: SmtpCredentials): Transporter {
  return nodemailer.createTransport(buildTransportOptions(mailbox));
}

/**
 * Verify SMTP credentials without sending a message.
 * `rawPass` is the unencrypted password — used for "Test Connection" before saving.
 */
export async function testSmtp(creds: SmtpCredentials & { rawPass?: string }): Promise<void> {
  const transport = nodemailer.createTransport(
    buildTransportOptions(creds, creds.rawPass)
  );
  try {
    await transport.verify();
  } catch (err) {
    throw friendlySmtpError(err);
  } finally {
    transport.close();
  }
}

export interface SendOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Send a single email via a stored mailbox.
 * Returns the nodemailer SentMessageInfo.
 */
export async function sendEmail(
  mailbox: Mailbox,
  opts: SendOptions
): Promise<{ messageId: string }> {
  const pass = decrypt(mailbox.smtpPassEncrypted);
  const transport = nodemailer.createTransport(buildTransportOptions(mailbox, pass));

  const fromAddress = mailbox.fromName
    ? `"${mailbox.fromName.replace(/"/g, "")}" <${mailbox.smtpUser}>`
    : mailbox.smtpUser;

  try {
    const info = await transport.sendMail({
      from: fromAddress,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
      replyTo: mailbox.replyTo ?? undefined,
    });
    return { messageId: info.messageId ?? "" };
  } catch (err) {
    throw friendlySmtpError(err);
  } finally {
    transport.close();
  }
}
