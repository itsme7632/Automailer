import { Router, type IRouter } from "express";
import { db, usersTable, campaignsTable, leadsTable, draftsTable, systemLogsTable } from "@workspace/db";
import { count, desc, sql, eq } from "drizzle-orm";
import { requireAdmin } from "../lib/auth";

const router: IRouter = Router();

router.get("/admin/users", requireAdmin, async (req, res): Promise<void> => {
  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 20;
  const [totalResult] = await db.select({ count: count() }).from(usersTable);
  const users = await db.select({
    id: usersTable.id, email: usersTable.email, name: usersTable.name,
    avatarUrl: usersTable.avatarUrl, role: usersTable.role,
    gmailConnected: usersTable.gmailConnected, gmailEmail: usersTable.gmailEmail,
    timezone: usersTable.timezone, aiTone: usersTable.aiTone, createdAt: usersTable.createdAt,
  }).from(usersTable)
    .orderBy(desc(usersTable.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);
  res.json({
    data: users.map(u => ({ ...u, createdAt: u.createdAt.toISOString() })),
    total: totalResult.count, page, limit,
  });
});

router.get("/admin/stats", requireAdmin, async (_req, res): Promise<void> => {
  const [totalUsers] = await db.select({ count: count() }).from(usersTable);
  const [totalCampaigns] = await db.select({ count: count() }).from(campaignsTable);
  const [totalLeads] = await db.select({ count: count() }).from(leadsTable);
  const [totalDrafts] = await db.select({ count: count() }).from(draftsTable);
  const [failedDrafts] = await db.select({ count: count() }).from(draftsTable)
    .where(eq(draftsTable.status, "failed"));
  const [gmailUsers] = await db.select({ count: count() }).from(usersTable)
    .where(eq(usersTable.gmailConnected, true));

  res.json({
    totalUsers: totalUsers.count,
    totalCampaigns: totalCampaigns.count,
    totalLeads: totalLeads.count,
    totalDraftsCreated: totalDrafts.count,
    totalAiCalls: totalDrafts.count,
    gmailConnectedUsers: gmailUsers.count,
    failedDrafts: failedDrafts.count,
  });
});

router.get("/admin/logs", requireAdmin, async (req, res): Promise<void> => {
  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 50;
  const [totalResult] = await db.select({ count: count() }).from(systemLogsTable);
  const logs = await db.select().from(systemLogsTable)
    .orderBy(desc(systemLogsTable.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);
  res.json({
    data: logs.map(l => ({ ...l, createdAt: l.createdAt.toISOString() })),
    total: totalResult.count, page, limit,
  });
});

export default router;
