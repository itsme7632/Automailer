import { Router, type IRouter } from "express";
import {
  db, emailQueueTable, draftsTable, mailboxesTable, usersTable, templatesTable,
  emailTrackingEventsTable,
} from "@workspace/db";
import { eq, and, count, desc, sql, inArray } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import {
  buildHtmlEmail, replaceVarsText, type EmailStyle, type BrandingSettings,
} from "../lib/email-html";
import type { User } from "@workspace/db";

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

function validStyle(s?: string | null): EmailStyle {
  return (["clean", "modern", "minimal", "luxury"] as const).includes(s as EmailStyle)
    ? (s as EmailStyle)
    : "clean";
}

async function getTrackingStatsForIds(
  trackingIds: string[]
): Promise<Record<string, { openCount: number; firstOpenedAt: string | null; lastOpenedAt: string | null }>> {
  if (trackingIds.length === 0) return {};

  const drafts = await db
    .select({ id: draftsTable.id, trackingId: draftsTable.trackingId })
    .from(draftsTable)
    .where(inArray(draftsTable.trackingId, trackingIds));

  if (drafts.length === 0) return {};

  const draftIds = drafts.map(d => d.id);
  const draftIdToTrackingId: Record<number, string> = {};
  for (const d of drafts) {
    if (d.trackingId) draftIdToTrackingId[d.id] = d.trackingId;
  }

  const events = await db
    .select({
      draftId:   emailTrackingEventsTable.draftId,
      cnt:       sql<number>`count(*)::int`,
      firstAt:   sql<string>`min(${emailTrackingEventsTable.createdAt})::text`,
      lastAt:    sql<string>`max(${emailTrackingEventsTable.createdAt})::text`,
    })
    .from(emailTrackingEventsTable)
    .where(
      and(
        inArray(emailTrackingEventsTable.draftId, draftIds),
        eq(emailTrackingEventsTable.eventType, "open"),
      )
    )
    .groupBy(emailTrackingEventsTable.draftId);

  const stats: Record<string, { openCount: number; firstOpenedAt: string | null; lastOpenedAt: string | null }> = {};
  for (const e of events) {
    if (!e.draftId) continue;
    const tId = draftIdToTrackingId[e.draftId];
    if (tId) {
      stats[tId] = { openCount: e.cnt, firstOpenedAt: e.firstAt, lastOpenedAt: e.lastAt };
    }
  }
  return stats;
}

// ─── List sent emails ─────────────────────────────────────────────────────────

router.get("/sent-emails", requireAuth, async (req, res): Promise<void> => {
  const user       = req.user!;
  const page       = parseInt(req.query.page as string, 10) || 1;
  const limit      = Math.min(parseInt(req.query.limit as string, 10) || 25, 100);
  const campaignId = req.query.campaignId ? parseInt(req.query.campaignId as string, 10) : undefined;

  const conditions: any[] = [
    eq(emailQueueTable.userId, user.id),
    eq(emailQueueTable.status, "success"),
  ];
  if (campaignId) conditions.push(eq(emailQueueTable.campaignId, campaignId));

  const [totalRow] = await db
    .select({ count: count() })
    .from(emailQueueTable)
    .where(and(...conditions));

  const items = await db
    .select({
      id:                 emailQueueTable.id,
      jobId:              emailQueueTable.jobId,
      campaignId:         emailQueueTable.campaignId,
      leadId:             emailQueueTable.leadId,
      email:              emailQueueTable.email,
      subject:            emailQueueTable.subject,
      rowDataJson:        emailQueueTable.rowDataJson,
      templateId:         emailQueueTable.templateId,
      style:              emailQueueTable.style,
      useSignatureBuilder: emailQueueTable.useSignatureBuilder,
      status:             emailQueueTable.status,
      sentAt:             emailQueueTable.sentAt,
      trackingId:         emailQueueTable.trackingId,
      mailboxEmail:       mailboxesTable.smtpUser,
      mailboxFromName:    mailboxesTable.fromName,
    })
    .from(emailQueueTable)
    .leftJoin(mailboxesTable, eq(mailboxesTable.id, emailQueueTable.mailboxId))
    .where(and(...conditions))
    .orderBy(desc(emailQueueTable.sentAt))
    .limit(limit)
    .offset((page - 1) * limit);

  const trackingIds = items.filter(i => i.trackingId).map(i => i.trackingId!);
  const tracking    = await getTrackingStatsForIds(trackingIds);

  res.json({
    data: items.map(item => {
      let row: Record<string, string> = {};
      try { row = JSON.parse(item.rowDataJson); } catch { }
      const stats = item.trackingId ? (tracking[item.trackingId] ?? null) : null;
      return {
        id:             item.id,
        campaignId:     item.campaignId,
        leadId:         item.leadId,
        email:          item.email,
        customerName:   row.name ?? row.companyName ?? null,
        subject:        item.subject,
        sentAt:         item.sentAt?.toISOString() ?? null,
        mailboxEmail:   item.mailboxEmail ?? null,
        mailboxFromName: item.mailboxFromName ?? null,
        status:         item.status,
        trackingId:     item.trackingId ?? null,
        templateId:     item.templateId,
        style:          item.style,
        openCount:      stats?.openCount ?? 0,
        firstOpenedAt:  stats?.firstOpenedAt ?? null,
        lastOpenedAt:   stats?.lastOpenedAt ?? null,
      };
    }),
    total: totalRow.count,
    page,
    limit,
  });
});

// ─── Preview a sent email ─────────────────────────────────────────────────────

router.get("/sent-emails/:id/preview", requireAuth, async (req, res): Promise<void> => {
  const user = req.user!;
  const id   = parseInt(req.params.id, 10);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }

  const [item] = await db
    .select()
    .from(emailQueueTable)
    .where(and(eq(emailQueueTable.id, id), eq(emailQueueTable.userId, user.id)));
  if (!item) { res.status(404).json({ error: "Email not found" }); return; }

  const [template] = await db
    .select()
    .from(templatesTable)
    .where(and(eq(templatesTable.id, item.templateId), eq(templatesTable.userId, user.id)));
  if (!template) { res.status(404).json({ error: "Template not found" }); return; }

  const [freshUser] = await db.select().from(usersTable).where(eq(usersTable.id, user.id));
  if (!freshUser) { res.status(404).json({ error: "User not found" }); return; }

  let row: Record<string, string> = {};
  try { row = JSON.parse(item.rowDataJson); } catch { }

  const branding = userBranding(freshUser);
  const html     = buildHtmlEmail(template.body, row, branding, {
    style:               validStyle(item.style),
    useSignatureBuilder: item.useSignatureBuilder,
  });
  const subject = replaceVarsText(template.subject, row);

  res.json({
    html,
    subject,
    to:     item.email,
    sentAt: item.sentAt?.toISOString() ?? null,
    customerName: row.name ?? row.companyName ?? null,
  });
});

// ─── Activity timeline for a sent email ──────────────────────────────────────

router.get("/sent-emails/:id/timeline", requireAuth, async (req, res): Promise<void> => {
  const user = req.user!;
  const id   = parseInt(req.params.id, 10);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }

  const [item] = await db
    .select({
      id: emailQueueTable.id, email: emailQueueTable.email,
      trackingId: emailQueueTable.trackingId, sentAt: emailQueueTable.sentAt,
      status: emailQueueTable.status, subject: emailQueueTable.subject,
    })
    .from(emailQueueTable)
    .where(and(eq(emailQueueTable.id, id), eq(emailQueueTable.userId, user.id)));
  if (!item) { res.status(404).json({ error: "Email not found" }); return; }

  const events: { type: string; timestamp: string; detail?: string }[] = [];

  if (item.sentAt) {
    events.push({ type: "sent",      timestamp: item.sentAt.toISOString() });
    events.push({ type: "delivered", timestamp: item.sentAt.toISOString() });
  }

  if (item.trackingId) {
    const [draft] = await db
      .select({ id: draftsTable.id })
      .from(draftsTable)
      .where(eq(draftsTable.trackingId, item.trackingId));

    if (draft) {
      const openEvts = await db
        .select()
        .from(emailTrackingEventsTable)
        .where(
          and(
            eq(emailTrackingEventsTable.draftId, draft.id),
            eq(emailTrackingEventsTable.eventType, "open"),
          )
        )
        .orderBy(emailTrackingEventsTable.createdAt);

      for (const e of openEvts) {
        events.push({
          type:      "opened",
          timestamp: e.createdAt.toISOString(),
          detail:    e.userAgent ?? undefined,
        });
      }
    }
  }

  res.json({ events, email: item.email, subject: item.subject });
});

export default router;
