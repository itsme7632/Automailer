import { Router, type IRouter } from "express";
import { db, mailboxesTable, templatesTable, draftsTable, usersTable, emailQueueTable } from "@workspace/db";
import { eq, and, gte, sql } from "drizzle-orm";
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
import type { User, Mailbox, Template } from "@workspace/db";
import { randomUUID } from "crypto";

const router: IRouter = Router();

// ─── In-memory job tracker ────────────────────────────────────────────────────
// Maps jobId -> true while the background loop is running
const activeJobs = new Map<string, boolean>();

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

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

// ─── Background queue processor ──────────────────────────────────────────────
async function processJobQueue(jobId: string, box: Mailbox, template: Template, user: User) {
  if (activeJobs.get(jobId)) return;
  activeJobs.set(jobId, true);

  const branding   = userBranding(user);
  const fromAddress = box.fromName
    ? `"${box.fromName.replace(/"/g, "")}" <${box.smtpUser}>`
    : box.smtpUser;

  try {
    while (activeJobs.get(jobId)) {
      // ── Hourly-limit check ──────────────────────────────────────────────
      const hourAgo = new Date(Date.now() - 3_600_000);
      const [hourlyRow] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(emailQueueTable)
        .where(and(
          eq(emailQueueTable.userId, user.id),
          eq(emailQueueTable.status, "success"),
          gte(emailQueueTable.sentAt, hourAgo),
        ));
      const sentThisHour = hourlyRow?.count ?? 0;
      const maxPerHour   = box.maxPerHour ?? 100;

      if (sentThisHour >= maxPerHour) {
        await sleep(60_000); // wait 1 min then re-check
        continue;
      }

      // ── Grab next pending item ──────────────────────────────────────────
      const [item] = await db
        .select()
        .from(emailQueueTable)
        .where(and(
          eq(emailQueueTable.jobId, jobId),
          eq(emailQueueTable.status, "pending"),
        ))
        .orderBy(emailQueueTable.id)
        .limit(1);

      if (!item) break; // all done

      // Mark as sending
      await db
        .update(emailQueueTable)
        .set({ status: "sending" })
        .where(eq(emailQueueTable.id, item.id));

      // Delay between emails
      const delay = (box.delaySeconds ?? 15) * 1000;
      await sleep(delay);

      // ── Send email ──────────────────────────────────────────────────────
      const row = JSON.parse(item.rowDataJson) as Record<string, string>;
      if (row.price) row.price = formatPrice(row.price);

      const subject  = replaceVarsText(template.subject, row);
      const bodyText = replaceVarsText(template.body, row);
      const bodyHtml = buildHtmlEmail(template.body, row, branding, {
        style: (item.style ?? "clean") as any,
        useSignatureBuilder: item.useSignatureBuilder,
      });

      try {
        const info = await sendEmail(box, { to: item.email, subject, text: bodyText, html: bodyHtml });

        if (box.imapHost && box.imapUser && box.imapPassEncrypted) {
          const raw = buildRawMessage({
            from: fromAddress, to: item.email, subject,
            html: bodyHtml, text: bodyText, messageId: info.messageId,
          });
          saveToSent(box, raw).catch(() => {});
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

        await db
          .update(emailQueueTable)
          .set({ status: "success", sentAt: new Date() })
          .where(eq(emailQueueTable.id, item.id));

      } catch (err: any) {
        const errMsg   = String(err?.message ?? "Send failed");
        const attempts = item.attempts + 1;

        await db.insert(draftsTable).values({
          userId: user.id,
          subject,
          body: bodyText,
          status: "failed",
          errorMessage: errMsg,
        });

        if (attempts >= 3) {
          // Permanently failed
          await db
            .update(emailQueueTable)
            .set({ status: "failed", attempts, lastError: errMsg })
            .where(eq(emailQueueTable.id, item.id));
        } else {
          // Auto-retry — put back to pending
          await db
            .update(emailQueueTable)
            .set({ status: "pending", attempts, lastError: errMsg })
            .where(eq(emailQueueTable.id, item.id));
        }
      }
    }
  } finally {
    activeJobs.delete(jobId);
  }
}

// ─── On server start: reset any stuck "sending" rows left from prior crash ───
(async () => {
  try {
    await db
      .update(emailQueueTable)
      .set({ status: "pending" })
      .where(eq(emailQueueTable.status, "sending"));
  } catch { /* DB may not exist yet */ }
})();


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
    batchSize:     box.batchSize     ?? 10,
    delaySeconds:  box.delaySeconds  ?? 15,
    maxPerHour:    box.maxPerHour    ?? 100,
  });
});

// ─── PUT /api/mailbox ─────────────────────────────────────────────────────────
router.put("/mailbox", requireAuth, async (req, res): Promise<void> => {
  const user = req.user!;
  const {
    smtpHost, smtpPort, smtpUser, smtpPass, smtpSecure,
    imapHost, imapPort, imapUser, imapPass,
    fromName, replyTo,
    batchSize, delaySeconds, maxPerHour,
  } = req.body as Record<string, string | number>;

  if (!smtpHost || !smtpPort || !smtpUser) {
    res.status(400).json({ error: "SMTP host, port, and username are required." });
    return;
  }

  const [existing] = await db
    .select({
      id: mailboxesTable.id,
      smtpPassEncrypted: mailboxesTable.smtpPassEncrypted,
      imapPassEncrypted: mailboxesTable.imapPassEncrypted,
    })
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
    batchSize:         batchSize    ? Number(batchSize)    : 10,
    delaySeconds:      delaySeconds ? Number(delaySeconds) : 15,
    maxPerHour:        maxPerHour   ? Number(maxPerHour)   : 100,
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
 * Enqueue emails for rate-limited delivery.
 * Body: { templateId, rows, style, useSignatureBuilder, batchSize? }
 * Returns: { jobId, total, batchSize, delaySeconds }
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

  const { templateId, rows, style, useSignatureBuilder, batchSize: reqBatchSize } = req.body as {
    templateId?: number;
    rows?: Record<string, string>[];
    style?: string;
    useSignatureBuilder?: boolean;
    batchSize?: number;
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

  const batchSize   = reqBatchSize !== undefined ? Number(reqBatchSize) : (box.batchSize ?? 10);
  const rowsToSend  = batchSize > 0 ? rows.slice(0, batchSize) : rows;
  const emailStyle  = (["clean", "modern", "minimal", "luxury"] as const).includes(style as any)
    ? (style as any)
    : "clean";
  const useSig      = useSignatureBuilder !== undefined ? useSignatureBuilder : (freshUser.useSignature ?? false);

  const jobId = randomUUID();
  const entries: (typeof emailQueueTable.$inferInsert)[] = [];

  for (const rawRow of rowsToSend) {
    const email = rawRow.email ?? "";
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;

    const row = { ...rawRow };
    if (row.price) row.price = formatPrice(row.price);

    const subject = replaceVarsText(template.subject, row);

    entries.push({
      jobId,
      userId:              user.id,
      mailboxId:           box.id,
      templateId,
      email,
      subject,
      rowDataJson:         JSON.stringify(row),
      style:               emailStyle,
      useSignatureBuilder: useSig,
      status:              "pending",
    });
  }

  if (entries.length === 0) {
    res.status(400).json({ error: "No valid email addresses found in the provided rows." });
    return;
  }

  await db.insert(emailQueueTable).values(entries);

  // Kick off background processing (does not block the response)
  processJobQueue(jobId, box, template, freshUser).catch(console.error);

  res.json({
    jobId,
    total:         entries.length,
    batchSize:     box.batchSize,
    delaySeconds:  box.delaySeconds,
    maxPerHour:    box.maxPerHour,
  });
});

// ─── GET /api/mailbox/send/status/:jobId ──────────────────────────────────────
router.get("/mailbox/send/status/:jobId", requireAuth, async (req, res): Promise<void> => {
  const user   = req.user!;
  const jobId  = req.params.jobId;

  const items = await db
    .select()
    .from(emailQueueTable)
    .where(and(
      eq(emailQueueTable.jobId, jobId),
      eq(emailQueueTable.userId, user.id),
    ))
    .orderBy(emailQueueTable.id);

  if (items.length === 0) {
    res.status(404).json({ error: "Job not found." });
    return;
  }

  const total     = items.length;
  const sent      = items.filter(i => i.status === "success").length;
  const failed    = items.filter(i => i.status === "failed").length;
  const sending   = items.filter(i => i.status === "sending").length;
  const queued    = items.filter(i => i.status === "pending").length;
  const remaining = queued + sending;

  // Hourly stats
  const hourAgo = new Date(Date.now() - 3_600_000);
  const [box] = await db.select().from(mailboxesTable).where(eq(mailboxesTable.userId, user.id));

  const [hourlyRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(emailQueueTable)
    .where(and(
      eq(emailQueueTable.userId, user.id),
      eq(emailQueueTable.status, "success"),
      gte(emailQueueTable.sentAt, hourAgo),
    ));

  const sentThisHour = hourlyRow?.count ?? 0;
  const hourlyLimit  = box?.maxPerHour   ?? 100;
  const delaySeconds = box?.delaySeconds ?? 15;
  const etaSeconds   = remaining * delaySeconds;
  const isRunning    = activeJobs.has(jobId);
  const isDone       = remaining === 0;

  const results = items.map(i => ({
    email:    i.email,
    subject:  i.subject,
    status:   i.status,
    error:    i.lastError ?? undefined,
    sentAt:   i.sentAt,
    attempts: i.attempts,
  }));

  res.json({
    jobId,
    status:              isDone ? "completed" : isRunning ? "running" : "paused",
    total,
    sent,
    failed,
    queued:              remaining,
    remaining,
    etaSeconds,
    sentThisHour,
    hourlyLimit,
    remainingQuota:      Math.max(0, hourlyLimit - sentThisHour),
    isHourlyLimitReached: sentThisHour >= hourlyLimit,
    results,
  });
});

// ─── POST /api/mailbox/send/retry/:jobId ──────────────────────────────────────
router.post("/mailbox/send/retry/:jobId", requireAuth, async (req, res): Promise<void> => {
  const user  = req.user!;
  const jobId = req.params.jobId;

  // Reset failed items to pending
  await db
    .update(emailQueueTable)
    .set({ status: "pending", attempts: 0, lastError: null })
    .where(and(
      eq(emailQueueTable.jobId, jobId),
      eq(emailQueueTable.userId, user.id),
      eq(emailQueueTable.status, "failed"),
    ));

  // Restart the background loop if it stopped
  if (!activeJobs.has(jobId)) {
    const [box] = await db
      .select()
      .from(mailboxesTable)
      .where(eq(mailboxesTable.userId, user.id));

    const [item] = await db
      .select()
      .from(emailQueueTable)
      .where(and(
        eq(emailQueueTable.jobId, jobId),
        eq(emailQueueTable.userId, user.id),
      ))
      .limit(1);

    if (item && box) {
      const [template] = await db
        .select()
        .from(templatesTable)
        .where(eq(templatesTable.id, item.templateId));
      const [freshUser] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, user.id));

      if (template && freshUser) {
        processJobQueue(jobId, box, template, freshUser).catch(console.error);
      }
    }
  }

  res.json({ ok: true });
});

// ─── POST /api/mailbox/send/cancel/:jobId ─────────────────────────────────────
router.post("/mailbox/send/cancel/:jobId", requireAuth, async (req, res): Promise<void> => {
  const user  = req.user!;
  const jobId = req.params.jobId;

  // Signal the loop to stop
  activeJobs.delete(jobId);

  // Mark all pending items as failed
  await db
    .update(emailQueueTable)
    .set({ status: "failed", lastError: "Cancelled by user" })
    .where(and(
      eq(emailQueueTable.jobId, jobId),
      eq(emailQueueTable.userId, user.id),
      eq(emailQueueTable.status, "pending"),
    ));

  // Also reset any stuck "sending" items
  await db
    .update(emailQueueTable)
    .set({ status: "failed", lastError: "Cancelled by user" })
    .where(and(
      eq(emailQueueTable.jobId, jobId),
      eq(emailQueueTable.userId, user.id),
      eq(emailQueueTable.status, "sending"),
    ));

  res.json({ ok: true });
});

export default router;
