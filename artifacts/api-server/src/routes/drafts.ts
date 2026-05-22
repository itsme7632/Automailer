import { Router, type IRouter } from "express";
import { db, draftsTable } from "@workspace/db";
import { eq, and, count, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { GetDraftParams } from "@workspace/api-zod";

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

export default router;
