import { Router, type IRouter } from "express";
import { db, draftsTable, usersTable, templatesTable, activityTable } from "@workspace/db";
import { eq, and, count, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { GetDraftParams } from "@workspace/api-zod";
import { createGmailDraft } from "../lib/gmail";
import { formatPrice, replaceVarsText, buildHtmlEmail } from "../lib/email-html";

const router: IRouter = Router();

router.get("/drafts", requireAuth, async (req, res): Promise<void> => {
  const user = req.user!;
  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 20;
  const status = req.query.status as string | undefined;
  const campaignId = req.query.campaignId ? parseInt(req.query.campaignId as string, 10) : undefined;

  const conditions: Parameters<typeof and>[0][] = [eq(draftsTable.userId, user.id)];
  if (status) conditions.push(eq(draftsTable.status, status));
  if (campaignId) conditions.push(eq(draftsTable.campaignId, campaignId));

  const [totalResult] = await db.select({ count: count() }).from(draftsTable).where(and(...conditions));
  const drafts = await db.select().from(draftsTable)
    .where(and(...conditions))
    .orderBy(desc(draftsTable.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);

  res.json({
    data: drafts.map(d => ({ ...d, createdAt: d.createdAt.toISOString() })),
    total: totalResult.count, page, limit,
  });
});

router.get("/drafts/:id", requireAuth, async (req, res): Promise<void> => {
  const user = req.user!;
  const params = GetDraftParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [draft] = await db.select().from(draftsTable)
    .where(and(eq(draftsTable.id, params.data.id), eq(draftsTable.userId, user.id)));
  if (!draft) { res.status(404).json({ error: "Draft not found" }); return; }
  res.json({ ...draft, createdAt: draft.createdAt.toISOString() });
});

/**
 * Direct draft creation — creates a Gmail draft from raw to/subject/body.
 */
router.post("/drafts/create-direct", requireAuth, async (req, res): Promise<void> => {
  const user = req.user!;

  const { to, subject, body } = req.body as { to?: string; subject?: string; body?: string };
  if (!to || !subject || !body) {
    res.status(400).json({ error: "to, subject, and body are required" });
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    res.status(400).json({ error: "Invalid email address" });
    return;
  }

  const [freshUser] = await db.select().from(usersTable).where(eq(usersTable.id, user.id));
  if (!freshUser) { res.status(404).json({ error: "User not found" }); return; }

  if (!freshUser.gmailConnected || !freshUser.gmailAccessToken) {
    res.status(400).json({
      error: "Gmail not connected. Please connect Gmail in Settings before creating drafts.",
    });
    return;
  }

  try {
    const gmailDraftId = await createGmailDraft(freshUser, to, subject, body);
    res.status(201).json({ gmailDraftId, to, subject });
  } catch (err: any) {
    req.log.warn({ err: err.message, to }, "Direct draft creation failed");
    res.status(502).json({ error: err.message ?? "Failed to create Gmail draft" });
  }
});

/**
 * Core workflow: create HTML Gmail drafts from a saved template + CSV row data.
 * - Replaces {variable} placeholders with row values
 * - Formats price values automatically (425 → $425, 1200 → $1,200)
 * - Generates a professional HTML email with the selected style
 * - Sends multipart/alternative MIME (plain text + HTML) to Gmail
 */
router.post("/drafts/from-template", requireAuth, async (req, res): Promise<void> => {
  const user = req.user!;
  const { templateId, rows, style } = req.body as {
    templateId?: number;
    rows?: Record<string, string>[];
    style?: string;
  };

  if (!templateId || !Array.isArray(rows) || rows.length === 0) {
    res.status(400).json({ error: "templateId and a non-empty rows[] are required" });
    return;
  }

  const emailStyle = (["clean", "modern", "minimal", "luxury"].includes(style ?? "")) ? style! : "clean";

  const [template] = await db
    .select()
    .from(templatesTable)
    .where(and(eq(templatesTable.id, templateId), eq(templatesTable.userId, user.id)));

  if (!template) {
    res.status(404).json({ error: "Template not found" });
    return;
  }

  const [freshUser] = await db.select().from(usersTable).where(eq(usersTable.id, user.id));

  if (!freshUser?.gmailConnected || !freshUser.gmailAccessToken) {
    res.status(400).json({
      error: "Gmail not connected. Connect Gmail in Settings before creating drafts.",
    });
    return;
  }

  const results: {
    email: string;
    subject: string;
    status: string;
    gmailDraftId?: string;
    error?: string;
  }[] = [];
  let succeeded = 0;
  let failed = 0;

  for (const rawRow of rows) {
    const email = rawRow.email ?? "";
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      results.push({ email, subject: "", status: "failed", error: "Missing or invalid email" });
      failed++;
      continue;
    }

    // Build a row with price pre-formatted so plain text also shows $
    const row: Record<string, string> = { ...rawRow };
    if (row.price) row.price = formatPrice(row.price);

    const subject = replaceVarsText(template.subject, row);
    const bodyText = replaceVarsText(template.body, row);
    const bodyHtml = buildHtmlEmail(template.body, row, emailStyle);

    try {
      const gmailDraftId = await createGmailDraft(freshUser, email, subject, bodyText, bodyHtml);
      await db.insert(draftsTable).values({
        userId: user.id,
        gmailDraftId,
        subject,
        body: bodyText,
        status: "success",
      });
      results.push({ email, subject, status: "success", gmailDraftId });
      succeeded++;
    } catch (err: any) {
      const errMsg = String(err?.message ?? "Unknown error");
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

  try {
    await db.insert(activityTable).values({
      userId: user.id,
      type: "drafts_generated",
      description: `Created ${succeeded} Gmail draft${succeeded !== 1 ? "s" : ""} from template "${template.name}"${failed > 0 ? ` (${failed} failed)` : ""}`,
      metadata: { templateId, total: rows.length, succeeded, failed, style: emailStyle },
    });
  } catch { /* non-fatal */ }

  res.json({ total: rows.length, succeeded, failed, results });
});

export default router;
