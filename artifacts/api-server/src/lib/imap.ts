import { ImapFlow } from "imapflow";
import type { Mailbox } from "@workspace/db";
import { decrypt } from "./crypto";

export interface ImapCredentials {
  imapHost: string;
  imapPort: number;
  imapUser: string;
  imapPassEncrypted: string;
  rawPass?: string;
}

/** Verify an IMAP connection by connecting + logging out. */
export async function testImap(creds: ImapCredentials): Promise<void> {
  const pass = creds.rawPass ?? decrypt(creds.imapPassEncrypted);
  const client = new ImapFlow({
    host: creds.imapHost,
    port: creds.imapPort,
    secure: creds.imapPort === 993,
    auth: { user: creds.imapUser, pass },
    tls: { rejectUnauthorized: false },
    logger: false,
  });
  await client.connect();
  await client.logout();
}

/**
 * Append a raw RFC2822 message to the Sent folder.
 *
 * Detection order:
 *  1. First mailbox with the \Sent special-use flag (works for Outlook/Office365,
 *     Gmail, Zoho, and any RFC 6154-compliant server).
 *  2. Case-insensitive name match against well-known sent-folder names used by
 *     Hostinger, cPanel, GoDaddy, Namecheap, and private servers.
 *
 * If no Sent folder can be found, or if IMAP itself fails, the function returns
 * silently — SMTP delivery is never blocked by IMAP errors.
 */
export async function saveToSent(mailbox: Mailbox, rawMessage: Buffer): Promise<void> {
  if (!mailbox.imapHost || !mailbox.imapUser || !mailbox.imapPassEncrypted) return;
  const pass = decrypt(mailbox.imapPassEncrypted);

  const client = new ImapFlow({
    host: mailbox.imapHost,
    port: mailbox.imapPort ?? 993,
    secure: (mailbox.imapPort ?? 993) === 993,
    auth: { user: mailbox.imapUser, pass },
    tls: { rejectUnauthorized: false },
    logger: false,
    // Generous timeouts so slow IMAP servers don't kill the fire-and-forget
    socketTimeout: 20_000,
  });

  try {
    await client.connect();

    // Priority-ordered list of common sent-folder names.
    // "Sent Items" first because that's the Outlook/Office 365 default.
    const sentCandidates = [
      "Sent Items",
      "Sent Mail",
      "Sent Messages",
      "Sent",
      "INBOX.Sent",
      "INBOX/Sent",
    ];

    let targetFolder: string | null = null;

    // Walk every mailbox once: capture all paths AND watch for the \Sent flag.
    const allPaths: string[] = [];
    for await (const box of client.list()) {
      const specialUse = (box as any).specialUse as string | undefined;
      allPaths.push(box.path);
      // Take the first \Sent special-use folder we encounter
      if (specialUse === "\\Sent" && !targetFolder) {
        targetFolder = box.path;
      }
    }

    // No special-use folder found — fall back to name matching (case-insensitive)
    if (!targetFolder) {
      const lowerPaths = allPaths.map(p => p.toLowerCase());
      for (const candidate of sentCandidates) {
        const idx = lowerPaths.indexOf(candidate.toLowerCase());
        if (idx !== -1) {
          targetFolder = allPaths[idx];
          break;
        }
      }
    }

    if (targetFolder) {
      // client.append() does not require a mailbox lock — it issues APPEND directly.
      await client.append(targetFolder, rawMessage, ["\\Seen"]);
    }
  } catch {
    // Best-effort — never let IMAP failure prevent a successful SMTP send.
  } finally {
    await client.logout().catch(() => {});
  }
}

/**
 * Build a minimal but valid RFC2822 raw message buffer for IMAP append.
 *
 * Uses a multipart/alternative structure so the copy in the Sent folder
 * contains both plain-text and HTML parts — matching what the recipient
 * actually receives via SMTP.
 */
export function buildRawMessage(opts: {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  messageId?: string;
}): Buffer {
  const date = new Date().toUTCString();
  const msgId = opts.messageId ?? `<${Date.now()}@brokermail.ai>`;
  const boundary = `----=_Part_${Date.now().toString(36)}`;

  // Encode subject as UTF-8 quoted-printable so non-ASCII chars survive
  const encodedSubject = encodeSubjectHeader(opts.subject);

  const raw = [
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    `Subject: ${encodedSubject}`,
    `Date: ${date}`,
    `Message-ID: ${msgId}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset=utf-8`,
    `Content-Transfer-Encoding: 8bit`,
    ``,
    opts.text,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=utf-8`,
    `Content-Transfer-Encoding: 8bit`,
    ``,
    opts.html,
    ``,
    `--${boundary}--`,
  ].join("\r\n");

  return Buffer.from(raw, "utf8");
}

/** Encode a header value as RFC2047 UTF-8 Base64 if it contains non-ASCII chars. */
function encodeSubjectHeader(subject: string): string {
  if (/^[\x00-\x7F]*$/.test(subject)) return subject;
  const b64 = Buffer.from(subject, "utf8").toString("base64");
  return `=?utf-8?B?${b64}?=`;
}
