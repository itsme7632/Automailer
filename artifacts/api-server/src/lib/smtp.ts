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
    connectionTimeout: 10_000,
    greetingTimeout: 8_000,
    socketTimeout: 15_000,
  } as const;
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
  } finally {
    transport.close();
  }
}
