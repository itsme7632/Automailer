import { Router, type IRouter } from "express";
import { db, campaignsTable, leadsTable, draftsTable, templatesTable, activityTable, usersTable } from "@workspace/db";
import { eq, and, count, sql, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { CreateCampaignBody, UpdateCampaignBody, GetCampaignParams, UpdateCampaignParams, DeleteCampaignParams, GenerateCampaignDraftsParams, GenerateCampaignDraftsBody } from "@workspace/api-zod";
import { generatePersonalizedEmail } from "../lib/ai";
import { createGmailDraft } from "../lib/gmail";
import { buildHtmlEmail, type BrandingSettings } from "../lib/email-html";
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

router.get("/campaigns", requireAuth, async (req, res): Promise<void> => {
  const user = req.user!;
  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 20;
  const status = req.query.status as string | undefined;

  const conditions = [eq(campaignsTable.userId, user.id)];
  if (status) conditions.push(eq(campaignsTable.status, status));

  const [totalResult] = await db.select({ count: count() }).from(campaignsTable).where(and(...conditions));
  const campaigns = await db.select().from(campaignsTable)
    .where(and(...conditions))
    .orderBy(desc(campaignsTable.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);

  res.json({
    data: campaigns.map(c => ({ ...c, createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString() })),
    total: totalResult.count, page, limit,
  });
});

router.post("/campaigns", requireAuth, async (req, res): Promise<void> => {
  const user = req.user!;
  const parsed = CreateCampaignBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [campaign] = await db.insert(campaignsTable).values({
    userId: user.id, name: parsed.data.name, templateId: parsed.data.templateId ?? null,
  }).returning();
  await db.insert(activityTable).values({ userId: user.id, type: "campaign_created", description: `Campaign "${campaign.name}" created` });
  res.status(201).json({ ...campaign, createdAt: campaign.createdAt.toISOString(), updatedAt: campaign.updatedAt.toISOString() });
});

router.get("/campaigns/:id", requireAuth, async (req, res): Promise<void> => {
  const user = req.user!;
  const params = GetCampaignParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [campaign] = await db.select().from(campaignsTable)
    .where(and(eq(campaignsTable.id, params.data.id), eq(campaignsTable.userId, user.id)));
  if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }
  res.json({ ...campaign, createdAt: campaign.createdAt.toISOString(), updatedAt: campaign.updatedAt.toISOString() });
});

router.patch("/campaigns/:id", requireAuth, async (req, res): Promise<void> => {
  const user = req.user!;
  const params = UpdateCampaignParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const body = UpdateCampaignBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const [campaign] = await db.update(campaignsTable)
    .set({ ...body.data, updatedAt: new Date() })
    .where(and(eq(campaignsTable.id, params.data.id), eq(campaignsTable.userId, user.id)))
    .returning();
  if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }
  res.json({ ...campaign, createdAt: campaign.createdAt.toISOString(), updatedAt: campaign.updatedAt.toISOString() });
});

router.delete("/campaigns/:id", requireAuth, async (req, res): Promise<void> => {
  const user = req.user!;
  const params = DeleteCampaignParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [campaign] = await db.delete(campaignsTable)
    .where(and(eq(campaignsTable.id, params.data.id), eq(campaignsTable.userId, user.id)))
    .returning();
  if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }
  res.json({ message: "Campaign deleted" });
});

router.post("/campaigns/:id/generate-drafts", requireAuth, async (req, res): Promise<void> => {
  const user = req.user!;
  const params = GenerateCampaignDraftsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const body = GenerateCampaignDraftsBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const [campaign] = await db.select().from(campaignsTable)
    .where(and(eq(campaignsTable.id, params.data.id), eq(campaignsTable.userId, user.id)));
  if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }

  // Load fresh user with branding settings
  const [freshUser] = await db.select().from(usersTable).where(eq(usersTable.id, user.id));
  if (!freshUser?.gmailConnected || !freshUser.gmailAccessToken) {
    res.status(400).json({ error: "Gmail not connected. Please connect Gmail first." });
    return;
  }

  const [template] = await db.select().from(templatesTable)
    .where(and(eq(templatesTable.id, body.data.templateId), eq(templatesTable.userId, user.id)));
  if (!template) { res.status(404).json({ error: "Template not found" }); return; }

  const leads = await db.select().from(leadsTable)
    .where(and(eq(leadsTable.campaignId, params.data.id), eq(leadsTable.status, "new")));

  const branding   = userBranding(freshUser);
  const useSig     = freshUser.useSignature ?? false;
  const emailStyle = (body.data as any).style ?? "clean";

  let succeeded = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const lead of leads) {
    try {
      const generated = await generatePersonalizedEmail({
        name: lead.name,
        email: lead.email,
        vehicle: lead.vehicle,
        route: lead.route,
        pickup: lead.pickup,
        delivery: lead.delivery,
        price: lead.price,
        notes: lead.notes,
        templateSubject: template.subject,
        templateBody: template.body,
        tone: body.data.tone ?? "professional",
        customPrompt: body.data.customPrompt,
      });

      // Build lead row for HTML rendering
      const leadRow: Record<string, string> = {
        name:     lead.name     ?? "",
        email:    lead.email    ?? "",
        vehicle:  lead.vehicle  ?? "",
        route:    lead.route    ?? "",
        pickup:   lead.pickup   ?? "",
        delivery: lead.delivery ?? "",
        price:    lead.price    ?? "",
        notes:    lead.notes    ?? "",
      };

      // Apply the full HTML template pipeline — same as from-template
      const bodyHtml = buildHtmlEmail(generated.body, leadRow, branding, {
        style:               emailStyle,
        useSignatureBuilder: useSig,
      });

      const trackingId  = randomUUID();
      const gmailDraftId = await createGmailDraft(
        freshUser, lead.email, generated.subject, generated.body, bodyHtml
      );

      await db.insert(draftsTable).values({
        userId: user.id, campaignId: campaign.id, leadId: lead.id,
        gmailDraftId, subject: generated.subject, body: generated.body,
        status: "success", trackingId,
      });
      await db.update(leadsTable)
        .set({ status: "drafted", gmailDraftId, updatedAt: new Date() })
        .where(eq(leadsTable.id, lead.id));
      succeeded++;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await db.insert(draftsTable).values({
        userId: user.id, campaignId: campaign.id, leadId: lead.id,
        subject: "", body: "", status: "failed", errorMessage: errMsg,
      });
      await db.update(leadsTable)
        .set({ status: "failed", errorMessage: errMsg, updatedAt: new Date() })
        .where(eq(leadsTable.id, lead.id));
      errors.push(`Lead ${lead.email}: ${errMsg}`);
      failed++;
    }
  }

  const newStatus = failed === leads.length ? "failed" : succeeded > 0 ? "drafted" : "pending";
  await db.update(campaignsTable).set({
    status: newStatus,
    draftedCount: sql`${campaignsTable.draftedCount} + ${succeeded}`,
    failedCount:  sql`${campaignsTable.failedCount}  + ${failed}`,
    updatedAt: new Date(),
  }).where(eq(campaignsTable.id, campaign.id));

  await db.insert(activityTable).values({
    userId: user.id, type: "drafts_generated",
    description: `Generated ${succeeded} drafts for campaign "${campaign.name}"`,
    metadata: { campaignId: campaign.id, succeeded, failed },
  });

  res.json({ total: leads.length, succeeded, failed, errors });
});

export default router;
