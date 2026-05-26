import { Router, type IRouter } from "express";
import {
  db, usersTable, campaignsTable, leadsTable, draftsTable,
  systemLogsTable, mailboxesTable, adminSettingsTable, emailQueueTable,
  plansTable, subscriptionsTable, planRequestsTable,
} from "@workspace/db";
import { count, desc, sql, eq, gte, and, or, ilike, ne } from "drizzle-orm";
import { requireAdmin } from "../lib/auth";

const router: IRouter = Router();

// ─── Stats ────────────────────────────────────────────────────────────────────

router.get("/admin/stats", requireAdmin, async (_req, res): Promise<void> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const [[totalUsers], [activeUsers], [totalCampaigns], [totalLeads],
    [totalDrafts], [failedDrafts], [emailsToday], [emailsMonth],
    [smtpMailboxes], [gmailUsers]] = await Promise.all([
    db.select({ count: count() }).from(usersTable),
    db.select({ count: count() }).from(usersTable).where(eq(usersTable.status, "active")),
    db.select({ count: count() }).from(campaignsTable),
    db.select({ count: count() }).from(leadsTable),
    db.select({ count: count() }).from(draftsTable).where(eq(draftsTable.status, "success")),
    db.select({ count: count() }).from(draftsTable).where(eq(draftsTable.status, "failed")),
    db.select({ count: count() }).from(draftsTable)
      .where(and(eq(draftsTable.status, "success"), gte(draftsTable.createdAt, today))),
    db.select({ count: count() }).from(draftsTable)
      .where(and(eq(draftsTable.status, "success"), gte(draftsTable.createdAt, monthStart))),
    db.select({ count: count() }).from(mailboxesTable).where(eq(mailboxesTable.isActive, true)),
    db.select({ count: count() }).from(usersTable).where(eq(usersTable.gmailConnected, true)),
  ]);

  res.json({
    totalUsers:         totalUsers.count,
    activeUsers:        activeUsers.count,
    emailsSentToday:    emailsToday.count,
    emailsSentMonth:    emailsMonth.count,
    smtpMailboxes:      smtpMailboxes.count,
    totalCampaigns:     totalCampaigns.count,
    totalLeads:         totalLeads.count,
    totalDraftsCreated: totalDrafts.count,
    failedSends:        failedDrafts.count,
    gmailConnectedUsers: gmailUsers.count,
  });
});

// ─── Queue Status ─────────────────────────────────────────────────────────────

router.get("/admin/queue-status", requireAdmin, async (_req, res): Promise<void> => {
  const since24h = new Date(Date.now() - 86_400_000);

  const [pendingRow, sendingRow, successRow, failedRow, last24hRow] = await Promise.all([
    db.select({ count: count() }).from(emailQueueTable).where(eq(emailQueueTable.status, "pending")),
    db.select({ count: count() }).from(emailQueueTable).where(eq(emailQueueTable.status, "sending")),
    db.select({ count: count() }).from(emailQueueTable).where(eq(emailQueueTable.status, "success")),
    db.select({ count: count() }).from(emailQueueTable).where(eq(emailQueueTable.status, "failed")),
    db.select({ count: count() }).from(emailQueueTable)
      .where(and(eq(emailQueueTable.status, "success"), gte(emailQueueTable.sentAt, since24h))),
  ]);

  res.json({
    pending:    pendingRow[0]?.count  ?? 0,
    sending:    sendingRow[0]?.count  ?? 0,
    success:    successRow[0]?.count  ?? 0,
    failed:     failedRow[0]?.count   ?? 0,
    last24h:    last24hRow[0]?.count  ?? 0,
    totalJobs:  (pendingRow[0]?.count ?? 0) + (sendingRow[0]?.count ?? 0) +
                (successRow[0]?.count ?? 0) + (failedRow[0]?.count ?? 0),
  });
});

// ─── Users ────────────────────────────────────────────────────────────────────

router.get("/admin/users", requireAdmin, async (req, res): Promise<void> => {
  const page   = Math.max(parseInt(req.query.page   as string, 10) || 1, 1);
  const limit  = Math.min(parseInt(req.query.limit  as string, 10) || 20, 100);
  const search       = (req.query.search   as string) || "";
  const roleFilter   = (req.query.role     as string) || "all";
  const planFilter   = (req.query.plan     as string) || "all";
  const statusFilter = (req.query.status   as string) || "all";

  const conditions = [];
  if (search) {
    conditions.push(or(
      ilike(usersTable.name,  `%${search}%`),
      ilike(usersTable.email, `%${search}%`),
    ));
  }
  if (roleFilter   !== "all") conditions.push(eq(usersTable.role,   roleFilter));
  if (planFilter   !== "all") conditions.push(eq(usersTable.plan,   planFilter));
  if (statusFilter !== "all") conditions.push(eq(usersTable.status, statusFilter));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalResult] = await db.select({ count: count() }).from(usersTable).where(where);

  const users = await db.select({
    id:             usersTable.id,
    email:          usersTable.email,
    name:           usersTable.name,
    role:           usersTable.role,
    plan:           usersTable.plan,
    credits:        usersTable.credits,
    status:         usersTable.status,
    gmailConnected: usersTable.gmailConnected,
    createdAt:      usersTable.createdAt,
    lastActiveAt:   usersTable.lastActiveAt,
    emailsSent: sql<number>`(SELECT COUNT(*)::int FROM drafts WHERE drafts.user_id = users.id AND drafts.status = 'success')`,
    smtpConnected: sql<boolean>`EXISTS(SELECT 1 FROM mailboxes WHERE mailboxes.user_id = users.id AND mailboxes.is_active = true)`,
  }).from(usersTable)
    .where(where)
    .orderBy(desc(usersTable.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);

  res.json({
    data: users.map(u => ({
      ...u,
      createdAt:    u.createdAt.toISOString(),
      lastActiveAt: u.lastActiveAt?.toISOString() ?? null,
    })),
    total: totalResult.count,
    page,
    limit,
  });
});

router.patch("/admin/users/:id", requireAdmin, async (req, res): Promise<void> => {
  const targetId = parseInt(req.params.id, 10);
  const admin    = req.user!;
  if (targetId === admin.id && req.body.role === "user") {
    res.status(400).json({ error: "Cannot remove your own admin role." });
    return;
  }
  const { plan, credits, role, status } = req.body as Record<string, string | number>;
  await db.update(usersTable).set({
    ...(plan    !== undefined && { plan:    String(plan) }),
    ...(credits !== undefined && { credits: Number(credits) }),
    ...(role    !== undefined && { role:    String(role) }),
    ...(status  !== undefined && { status:  String(status) }),
    updatedAt: new Date(),
  }).where(eq(usersTable.id, targetId));

  await db.insert(systemLogsTable).values({
    userId:      admin.id,
    type:        "admin_user_update",
    severity:    "info",
    description: `Admin updated user #${targetId} — ${JSON.stringify({ plan, credits, role, status })}`,
  });

  res.json({ ok: true });
});

router.delete("/admin/users/:id", requireAdmin, async (req, res): Promise<void> => {
  const targetId = parseInt(req.params.id, 10);
  const admin    = req.user!;
  if (targetId === admin.id) {
    res.status(400).json({ error: "Cannot delete your own account from the admin panel." });
    return;
  }
  await db.delete(usersTable).where(eq(usersTable.id, targetId));
  await db.insert(systemLogsTable).values({
    userId:      admin.id,
    type:        "admin_user_delete",
    severity:    "warn",
    description: `Admin deleted user #${targetId}`,
  });
  res.json({ ok: true });
});

// ─── Mailboxes ────────────────────────────────────────────────────────────────

router.get("/admin/mailboxes", requireAdmin, async (_req, res): Promise<void> => {
  const mailboxes = await db.select({
    id:         mailboxesTable.id,
    userId:     mailboxesTable.userId,
    userName:   usersTable.name,
    userEmail:  usersTable.email,
    smtpHost:   mailboxesTable.smtpHost,
    smtpPort:   mailboxesTable.smtpPort,
    smtpUser:   mailboxesTable.smtpUser,
    smtpSecure: mailboxesTable.smtpSecure,
    fromName:   mailboxesTable.fromName,
    isActive:   mailboxesTable.isActive,
    createdAt:  mailboxesTable.createdAt,
    emailsSent: sql<number>`(SELECT COUNT(*)::int FROM drafts WHERE drafts.user_id = ${mailboxesTable.userId} AND drafts.status = 'success' AND drafts.gmail_draft_id LIKE 'smtp:%')`,
  })
    .from(mailboxesTable)
    .leftJoin(usersTable, eq(mailboxesTable.userId, usersTable.id))
    .orderBy(desc(mailboxesTable.createdAt));

  res.json(mailboxes.map(m => ({ ...m, createdAt: m.createdAt?.toISOString() ?? null })));
});

// ─── Analytics ────────────────────────────────────────────────────────────────

router.get("/admin/analytics", requireAdmin, async (req, res): Promise<void> => {
  const days      = Math.min(Math.max(parseInt(req.query.days as string, 10) || 30, 7), 90);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days + 1);
  startDate.setHours(0, 0, 0, 0);

  const [sentRows, failedRows] = await Promise.all([
    db.select({
      date: sql<string>`(created_at AT TIME ZONE 'UTC')::date::text`,
      cnt:  count(),
    }).from(draftsTable)
      .where(and(eq(draftsTable.status, "success"), gte(draftsTable.createdAt, startDate)))
      .groupBy(sql`(created_at AT TIME ZONE 'UTC')::date`)
      .orderBy(sql`(created_at AT TIME ZONE 'UTC')::date`),

    db.select({
      date: sql<string>`(created_at AT TIME ZONE 'UTC')::date::text`,
      cnt:  count(),
    }).from(draftsTable)
      .where(and(eq(draftsTable.status, "failed"), gte(draftsTable.createdAt, startDate)))
      .groupBy(sql`(created_at AT TIME ZONE 'UTC')::date`)
      .orderBy(sql`(created_at AT TIME ZONE 'UTC')::date`),
  ]);

  const sentMap = Object.fromEntries(sentRows.map(r  => [r.date, r.cnt]));
  const failMap = Object.fromEntries(failedRows.map(r => [r.date, r.cnt]));

  const result = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split("T")[0];
    result.push({ date: dateStr, sent: sentMap[dateStr] ?? 0, failed: failMap[dateStr] ?? 0 });
  }

  res.json(result);
});

// ─── Logs ─────────────────────────────────────────────────────────────────────

router.get("/admin/logs", requireAdmin, async (req, res): Promise<void> => {
  const page     = Math.max(parseInt(req.query.page     as string, 10) || 1, 1);
  const limit    = Math.min(parseInt(req.query.limit    as string, 10) || 50, 200);
  const severity = (req.query.severity as string) || "all";
  const search   = (req.query.search   as string) || "";

  const conditions = [];
  if (severity !== "all") conditions.push(eq(systemLogsTable.severity, severity));
  if (search)             conditions.push(or(
    ilike(systemLogsTable.type,        `%${search}%`),
    ilike(systemLogsTable.description, `%${search}%`),
  ));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalResult] = await db.select({ count: count() }).from(systemLogsTable).where(where);
  const logs = await db.select().from(systemLogsTable)
    .where(where)
    .orderBy(desc(systemLogsTable.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);

  res.json({
    data:  logs.map(l => ({ ...l, createdAt: l.createdAt.toISOString() })),
    total: totalResult.count,
    page,
    limit,
  });
});

// ─── Settings ─────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: Record<string, string> = {
  // General
  platformName:    "BrokerMail AI",
  supportEmail:    "",
  contactPhone:    "",
  companyAddress:  "",
  footerText:      "Built for the auto transport industry.",
  maintenanceMode: "false",
  // Branding
  defaultAccentColor:  "#1d4ed8",
  defaultEmailSlogan:  "Your #1 Auto Transport Partner",
  defaultEmailStyle:   "clean",
  defaultButtonStyle:  "rounded",
  defaultFont:         "inter",
  // SMTP controls
  defaultBatchSize:    "10",
  defaultDelaySeconds: "15",
  defaultMaxPerHour:   "100",
  queueEnabled:        "true",
  autoRetryEnabled:    "true",
  maxRetryAttempts:    "3",
  maxEmailsPerDay:     "1000",
  maxLeadsPerUpload:   "10000",
  emailLimitPerUser:   "500",
  // AI
  aiModel:       "gpt-4o-mini",
  aiEnabled:     "true",
  aiTemperature: "0.7",
  dailyAiLimit:  "500",
  // Users
  allowRegistrations:       "true",
  requireEmailVerification: "false",
  freeMonthlyEmailLimit:    "100",
  freeBatchLimit:           "10",
  autoSuspendOnAbuse:       "false",
  // Billing
  stripePublishableKey: "",
  stripeWebhookSecret:  "",
  creditsPerDollar:     "100",
  creditSystemEnabled:  "false",
  freeTrialDays:        "0",
  // Security
  sessionTimeoutHours:   "24",
  loginRateLimit:        "10",
  failedLoginThreshold:  "5",
  requireAdminMfa:       "false",
  // CMS
  heroTitle:      "Close more transport deals with AI-powered outreach.",
  heroSubtitle:   "Upload lead sheets, personalize emails instantly, and send directly from your own business mailbox.",
  heroSlogan:     "Built specifically for auto transport brokers.",
  faqContent:     "",
  pricingContent: "",
  contactContent: "",
};

router.get("/admin/settings", requireAdmin, async (_req, res): Promise<void> => {
  const rows   = await db.select().from(adminSettingsTable);
  const stored = Object.fromEntries(rows.map(r => [r.key, r.value]));
  res.json({ ...DEFAULT_SETTINGS, ...stored });
});

router.put("/admin/settings", requireAdmin, async (req, res): Promise<void> => {
  const admin   = req.user!;
  const updates = req.body as Record<string, string>;

  for (const [key, value] of Object.entries(updates)) {
    await db.insert(adminSettingsTable)
      .values({ key, value: String(value), updatedAt: new Date() })
      .onConflictDoUpdate({
        target: adminSettingsTable.key,
        set:    { value: String(value), updatedAt: new Date() },
      });
  }

  await db.insert(systemLogsTable).values({
    userId:      admin.id,
    type:        "admin_settings_update",
    severity:    "info",
    description: `Admin updated platform settings: ${Object.keys(updates).join(", ")}`,
  });

  res.json({ ok: true });
});

// ─── Public settings endpoint (for frontend to read CMS content etc.) ─────────

router.get("/admin/public-settings", async (_req, res): Promise<void> => {
  const PUBLIC_KEYS = [
    "platformName", "footerText", "defaultAccentColor", "defaultEmailSlogan",
    "heroTitle", "heroSubtitle", "heroSlogan", "faqContent",
    "pricingContent", "contactContent", "maintenanceMode",
    "allowRegistrations",
  ];
  const rows   = await db.select().from(adminSettingsTable);
  const stored = Object.fromEntries(rows.map(r => [r.key, r.value]));
  const result: Record<string, string> = {};
  PUBLIC_KEYS.forEach(k => { result[k] = stored[k] ?? DEFAULT_SETTINGS[k] ?? ""; });
  res.json(result);
});

// ─── Billing: Plans ────────────────────────────────────────────────────────────

router.get("/admin/plans", requireAdmin, async (_req, res): Promise<void> => {
  const plans = await db.select().from(plansTable).orderBy(plansTable.sortOrder);
  res.json(plans);
});

router.put("/admin/plans/:id", requireAdmin, async (req, res): Promise<void> => {
  const id    = parseInt(req.params.id, 10);
  const admin = req.user!;
  const { monthlyEmailLimit, smtpAccountsLimit, campaignsLimit, batchSendLimit } =
    req.body as Record<string, number>;

  await db.update(plansTable).set({
    ...(monthlyEmailLimit  !== undefined && { monthlyEmailLimit:  Number(monthlyEmailLimit) }),
    ...(smtpAccountsLimit  !== undefined && { smtpAccountsLimit:  Number(smtpAccountsLimit) }),
    ...(campaignsLimit     !== undefined && { campaignsLimit:     Number(campaignsLimit) }),
    ...(batchSendLimit     !== undefined && { batchSendLimit:     Number(batchSendLimit) }),
    updatedAt: new Date(),
  }).where(eq(plansTable.id, id));

  await db.insert(systemLogsTable).values({
    userId:      admin.id,
    type:        "admin_plan_update",
    severity:    "info",
    description: `Admin updated plan #${id}`,
  });

  res.json({ ok: true });
});

// ─── Billing: Subscriptions ────────────────────────────────────────────────────

router.get("/admin/subscriptions", requireAdmin, async (_req, res): Promise<void> => {
  const subs = await db.select({
    userId:               subscriptionsTable.userId,
    userName:             usersTable.name,
    userEmail:            usersTable.email,
    planId:               subscriptionsTable.planId,
    planName:             plansTable.name,
    planSlug:             plansTable.slug,
    billingStatus:        subscriptionsTable.billingStatus,
    status:               subscriptionsTable.status,
    monthlyEmailLimit:    plansTable.monthlyEmailLimit,
    smtpAccountsUsed:     sql<number>`(SELECT COUNT(*)::int FROM mailboxes WHERE mailboxes.user_id = ${subscriptionsTable.userId} AND mailboxes.is_active = true)`,
    emailsSentThisMonth:  sql<number>`(SELECT COUNT(*)::int FROM drafts WHERE drafts.user_id = ${subscriptionsTable.userId} AND drafts.status = 'success' AND drafts.created_at >= date_trunc('month', now()))`,
    currentPeriodStart:   subscriptionsTable.currentPeriodStart,
    currentPeriodEnd:     subscriptionsTable.currentPeriodEnd,
    stripeCustomerId:     subscriptionsTable.stripeCustomerId,
    stripeSubscriptionId: subscriptionsTable.stripeSubscriptionId,
  })
    .from(subscriptionsTable)
    .leftJoin(usersTable, eq(subscriptionsTable.userId, usersTable.id))
    .leftJoin(plansTable, eq(subscriptionsTable.planId, plansTable.id))
    .orderBy(desc(subscriptionsTable.createdAt));

  res.json(subs.map(s => ({
    ...s,
    currentPeriodStart: s.currentPeriodStart?.toISOString() ?? null,
    currentPeriodEnd:   s.currentPeriodEnd?.toISOString()   ?? null,
  })));
});

// ─── Billing: Plan Requests ────────────────────────────────────────────────────

router.get("/admin/plan-requests", requireAdmin, async (req, res): Promise<void> => {
  const statusFilter = (req.query.status as string) || "all";
  const fromPlans    = await db.select({ id: plansTable.id, name: plansTable.name }).from(plansTable);
  const planMap      = Object.fromEntries(fromPlans.map(p => [p.id, p.name]));

  const rows = await db.select({
    id:         planRequestsTable.id,
    userId:     planRequestsTable.userId,
    userName:   usersTable.name,
    userEmail:  usersTable.email,
    fromPlanId: planRequestsTable.fromPlanId,
    toPlanId:   planRequestsTable.toPlanId,
    toPlanName: plansTable.name,
    status:     planRequestsTable.status,
    adminNote:  planRequestsTable.adminNote,
    createdAt:  planRequestsTable.createdAt,
  })
    .from(planRequestsTable)
    .leftJoin(usersTable, eq(planRequestsTable.userId, usersTable.id))
    .leftJoin(plansTable, eq(planRequestsTable.toPlanId, plansTable.id))
    .orderBy(desc(planRequestsTable.createdAt));

  const filtered = statusFilter === "all" ? rows : rows.filter(r => r.status === statusFilter);
  res.json(filtered.map(r => ({
    ...r,
    fromPlanName: r.fromPlanId ? (planMap[r.fromPlanId] ?? "Unknown") : null,
    createdAt:    r.createdAt.toISOString(),
  })));
});

router.post("/admin/plan-requests/:id/approve", requireAdmin, async (req, res): Promise<void> => {
  const id    = parseInt(req.params.id, 10);
  const admin = req.user!;

  const [request] = await db.select().from(planRequestsTable).where(eq(planRequestsTable.id, id));
  if (!request) { res.status(404).json({ error: "Request not found." }); return; }

  await db.update(subscriptionsTable)
    .set({ planId: request.toPlanId, updatedAt: new Date() })
    .where(eq(subscriptionsTable.userId, request.userId));

  const [plan] = await db.select().from(plansTable).where(eq(plansTable.id, request.toPlanId));
  if (plan) {
    await db.update(usersTable)
      .set({ plan: plan.slug, updatedAt: new Date() })
      .where(eq(usersTable.id, request.userId));
  }

  await db.update(planRequestsTable)
    .set({ status: "approved", updatedAt: new Date() })
    .where(eq(planRequestsTable.id, id));

  await db.insert(systemLogsTable).values({
    userId:      admin.id,
    type:        "admin_plan_request_approved",
    severity:    "info",
    description: `Admin approved plan request #${id} for user #${request.userId}`,
  });

  res.json({ ok: true });
});

router.post("/admin/plan-requests/:id/reject", requireAdmin, async (req, res): Promise<void> => {
  const id    = parseInt(req.params.id, 10);
  const admin = req.user!;
  const { note } = req.body as { note?: string };

  await db.update(planRequestsTable)
    .set({ status: "rejected", adminNote: note ?? null, updatedAt: new Date() })
    .where(eq(planRequestsTable.id, id));

  await db.insert(systemLogsTable).values({
    userId:      admin.id,
    type:        "admin_plan_request_rejected",
    severity:    "info",
    description: `Admin rejected plan request #${id}`,
  });

  res.json({ ok: true });
});

// ─── Assign plan directly to a user ───────────────────────────────────────────

router.post("/admin/users/:id/assign-plan", requireAdmin, async (req, res): Promise<void> => {
  const targetId = parseInt(req.params.id, 10);
  const admin    = req.user!;
  const { planId } = req.body as { planId: number };

  const [plan] = await db.select().from(plansTable).where(eq(plansTable.id, planId));
  if (!plan) { res.status(404).json({ error: "Plan not found." }); return; }

  const [existing] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, targetId));
  if (existing) {
    await db.update(subscriptionsTable)
      .set({ planId, updatedAt: new Date() })
      .where(eq(subscriptionsTable.userId, targetId));
  } else {
    await db.insert(subscriptionsTable).values({ userId: targetId, planId, status: "active", billingStatus: "free" });
  }

  await db.update(usersTable)
    .set({ plan: plan.slug, updatedAt: new Date() })
    .where(eq(usersTable.id, targetId));

  await db.insert(systemLogsTable).values({
    userId:      admin.id,
    type:        "admin_plan_assigned",
    severity:    "info",
    description: `Admin assigned plan "${plan.name}" to user #${targetId}`,
  });

  res.json({ ok: true });
});

export default router;
