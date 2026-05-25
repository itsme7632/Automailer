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
 * Tries several common folder names (compatible with Hostinger, cPanel, Zoho, Outlook).
 * Silently succeeds if no Sent folder is found — sending still succeeded.
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
  });

  try {
    await client.connect();

    // Walk the mailbox list to find the \Sent special-use folder first
    const sentCandidates = ["Sent", "Sent Items", "Sent Messages", "INBOX.Sent", "INBOX/Sent"];
    let targetFolder: string | null = null;

    for await (const box of client.list()) {
      const specialUse = (box as any).specialUse as string | undefined;
      if (specialUse === "\\Sent") {
        targetFolder = box.path;
        break;
      }
    }

    if (!targetFolder) {
      for (const name of sentCandidates) {
        try {
          await client.getMailboxLock(name);
          targetFolder = name;
          break;
        } catch { }
      }
    }

    if (targetFolder) {
      await client.append(targetFolder, rawMessage, ["\\Seen"]);
    }
  } catch {
    // Best-effort — never let IMAP failure prevent a successful send
  } finally {
    await client.logout().catch(() => { });
  }
}

/** Build a minimal but valid RFC2822 raw message buffer for IMAP append. */
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
  const raw = [
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    `Subject: ${opts.subject}`,
    `Date: ${date}`,
    `Message-ID: ${msgId}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=utf-8`,
    `Content-Transfer-Encoding: 7bit`,
    ``,
    opts.html,
  ].join("\r\n");
  return Buffer.from(raw, "utf8");
}
