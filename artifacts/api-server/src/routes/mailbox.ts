import { Router, type IRouter } from "express";
import { db, mailboxesTable, templatesTable, draftsTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { encrypt, decrypt } from "../lib/crypto";
import { testSmtp, sendEmail } from "../lib/smtp";
import { testImap, saveToSent, buildRawMessage } from "../lib/imap";
import {
  buildHtmlEmail,
  replaceVarsText,
  formatPrice,
  type BrandingSettings,
} from "../lib/email-html";
import type { User } from "@workspace/db";
import { randomUUID } from "crypto";

const router: IRouter = Router();

function userBranding(user: User): BrandingSettings {
  return {
    companyName:    user.companyName    ?? null,
    companyTagline: user.companyTagline ?? null,
    companyPhone:   user.companyPhone   ?? null,
    companyWebsite: user.companyWebsite ?? null,
    usdot:          user.usdot          ?? null,
    mcNumber:       user.mcNumber       ?? null,
    accentColor:    user.accentColor    ?? null,
  };
}

// ─── GET /api/mailbox ─────────────────────────────────────────────────────────

router.get("/mailbox", requireAuth, async (req, res): Promise<void> => {
  const user = req.user!;
  const [box] = await db
    .select()
    .from(mailboxesTable)
    .where(eq(mailboxesTable.userId, user.id));

  if (!box) { res.json(null); return; }

  res.json({
    id:            box.id,
    smtpHost:      box.smtpHost,
    smtpPort:      box.smtpPort,
    smtpUser:      box.smtpUser,
    smtpPassSet:   !!box.smtpPassEncrypted,
    smtpSecure:    box.smtpSecure,
    imapHost:      box.imapHost      ?? "",
    imapPort:      box.imapPort      ?? 993,
    imapUser:      box.imapUser      ?? "",
    imapPassSet:   !!box.imapPassEncrypted,
    fromName:      box.fromName      ?? "",
    replyTo:       box.replyTo       ?? "",
    isActive:      box.isActive,
  });
});

// ─── PUT /api/mailbox ─────────────────────────────────────────────────────────

router.put("/mailbox", requireAuth, async (req, res): Promise<void> => {
  const user = req.user!;
  const {
    smtpHost, smtpPort, smtpUser, smtpPass, smtpSecure,
    imapHost, imapPort, imapUser, imapPass,
    fromName, replyTo,
  } = req.body as Record<string, string | number>;

  if (!smtpHost || !smtpPort || !smtpUser) {
    res.status(400).json({ error: "SMTP host, port, and username are required." });
    return;
  }

  const [existing] = await db
    .select({ id: mailboxesTable.id, smtpPassEncrypted: mailboxesTable.smtpPassEncrypted, imapPassEncrypted: mailboxesTable.imapPassEncrypted })
    .from(mailboxesTable)
    .where(eq(mailboxesTable.userId, user.id));

  const smtpPassEncrypted = smtpPass
    ? encrypt(String(smtpPass))
    : (existing?.smtpPassEncrypted ?? "");

  const imapPassEncrypted = imapPass
    ? encrypt(String(imapPass))
    : (existing?.imapPassEncrypted ?? "");

  const values = {
    userId:            user.id,
    smtpHost:          String(smtpHost),
    smtpPort:          Number(smtpPort),
    smtpUser:          String(smtpUser),
    smtpPassEncrypted,
    smtpSecure:        String(smtpSecure ?? "tls"),
    imapHost:          imapHost ? String(imapHost) : null,
    imapPort:          imapPort ? Number(imapPort) : 993,
    imapUser:          imapUser ? String(imapUser) : null,
    imapPassEncrypted: imapPassEncrypted || null,
    fromName:          fromName ? String(fromName) : null,
    replyTo:           replyTo  ? String(replyTo)  : null,
    isActive:          true,
    updatedAt:         new Date(),
  };

  if (existing) {
    await db.update(mailboxesTable).set(values).where(eq(mailboxesTable.id, existing.id));
  } else {
    await db.insert(mailboxesTable).values(values);
  }

  res.json({ ok: true });
});

// ─── DELETE /api/mailbox ──────────────────────────────────────────────────────

router.delete("/mailbox", requireAuth, async (req, res): Promise<void> => {
  const user = req.user!;
  await db.delete(mailboxesTable).where(eq(mailboxesTable.userId, user.id));
  res.json({ ok: true });
});

// ─── POST /api/mailbox/test-smtp ──────────────────────────────────────────────

router.post("/mailbox/test-smtp", requireAuth, async (req, res): Promise<void> => {
  const { smtpHost, smtpPort, smtpUser, smtpPass, smtpSecure } = req.body as Record<string, string | number>;
  if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
    res.status(400).json({ error: "Host, port, username, and password are required." });
    return;
  }
  try {
    await testSmtp({
      smtpHost: String(smtpHost),
      smtpPort: Number(smtpPort),
      smtpUser: String(smtpUser),
      smtpPassEncrypted: "",
      smtpSecure: String(smtpSecure ?? "tls"),
      rawPass: String(smtpPass),
    });
    res.json({ ok: true, message: "SMTP connection successful." });
  } catch (err: any) {
    res.status(400).json({ error: err.message ?? "SMTP connection failed." });
  }
});

// ─── POST /api/mailbox/test-imap ──────────────────────────────────────────────

router.post("/mailbox/test-imap", requireAuth, async (req, res): Promise<void> => {
  const { imapHost, imapPort, imapUser, imapPass } = req.body as Record<string, string | number>;
  if (!imapHost || !imapPort || !imapUser || !imapPass) {
    res.status(400).json({ error: "Host, port, username, and password are required." });
    return;
  }
  try {
    await testImap({
      imapHost: String(imapHost),
      imapPort: Number(imapPort),
      imapUser: String(imapUser),
      imapPassEncrypted: "",
      rawPass: String(imapPass),
    });
    res.json({ ok: true, message: "IMAP connection successful." });
  } catch (err: any) {
    res.status(400).json({ error: err.message ?? "IMAP connection failed." });
  }
});

// ─── POST /api/mailbox/send ───────────────────────────────────────────────────
/**
 * Batch-send emails via SMTP.
 * Body: { templateId, rows, style, useSignatureBuilder, batchSize }
 * batchSize: 0 = all at once, otherwise process in groups (with no delay — client controls pacing).
 */
router.post("/mailbox/send", requireAuth, async (req, res): Promise<void> => {
  const user = req.user!;

  const [box] = await db
    .select()
    .from(mailboxesTable)
    .where(and(eq(mailboxesTable.userId, user.id), eq(mailboxesTable.isActive, true)));

  if (!box) {
    res.status(400).json({ error: "No active mailbox configured. Add SMTP settings first." });
    return;
  }

  const { templateId, rows, style, useSignatureBuilder } = req.body as {
    templateId?: number;
    rows?: Record<string, string>[];
    style?: string;
    useSignatureBuilder?: boolean;
  };

  if (!templateId || !Array.isArray(rows) || rows.length === 0) {
    res.status(400).json({ error: "templateId and a non-empty rows[] are required." });
    return;
  }

  const [template] = await db
    .select()
    .from(templatesTable)
    .where(and(eq(templatesTable.id, templateId), eq(templatesTable.userId, user.id)));
  if (!template) { res.status(404).json({ error: "Template not found." }); return; }

  const [freshUser] = await db.select().from(usersTable).where(eq(usersTable.id, user.id));
  if (!freshUser) { res.status(404).json({ error: "User not found." }); return; }

  const branding   = userBranding(freshUser);
  const useSig     = useSignatureBuilder !== undefined ? useSignatureBuilder : (freshUser.useSignature ?? false);
  const emailStyle = (["clean","modern","minimal","luxury"] as const).includes(style as any) ? style as any : "clean";

  const fromAddress = box.fromName
    ? `"${box.fromName.replace(/"/g, "")}" <${box.smtpUser}>`
    : box.smtpUser;

  const results: { email: string; subject: string; status: "success" | "failed"; error?: string }[] = [];
  let succeeded = 0;
  let failed = 0;

  for (const rawRow of rows) {
    const email = rawRow.email ?? "";
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      results.push({ email, subject: "", status: "failed", error: "Missing or invalid email" });
      failed++;
      continue;
    }

    const row: Record<string, string> = { ...rawRow };
    if (row.price) row.price = formatPrice(row.price);

    const subject  = replaceVarsText(template.subject, row);
    const bodyText = replaceVarsText(template.body, row);
    const bodyHtml = buildHtmlEmail(template.body, row, branding, {
      style: emailStyle,
      useSignatureBuilder: useSig,
    });

    try {
      const info = await sendEmail(box, { to: email, subject, text: bodyText, html: bodyHtml });

      // Best-effort: save to IMAP Sent folder if configured
      if (box.imapHost && box.imapUser && box.imapPassEncrypted) {
        const raw = buildRawMessage({
          from: fromAddress,
          to: email,
          subject,
          html: bodyHtml,
          text: bodyText,
          messageId: info.messageId,
        });
        saveToSent(box, raw).catch(() => {}); // fire-and-forget
      }

      const trackingId = randomUUID();
      await db.insert(draftsTable).values({
        userId: user.id,
        subject,
        body: bodyText,
        status: "success",
        trackingId,
        gmailDraftId: `smtp:${info.messageId}`,
      });

      results.push({ email, subject, status: "success" });
      succeeded++;
    } catch (err: any) {
      const errMsg = String(err?.message ?? "Send failed");
      await db.insert(draftsTable).values({
        userId: user.id,
        subject,
        body: bodyText,
        status: "failed",
        errorMessage: errMsg,
      });
      results.push({ email, subject, status: "failed", error: errMsg });
      failed++;
    }
  }

  res.json({ total: rows.length, succeeded, failed, results });
});

export default router;
