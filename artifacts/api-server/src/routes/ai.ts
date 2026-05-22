import { Router, type IRouter } from "express";
import { db, leadsTable, templatesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { GenerateEmailBody, PreviewEmailBody } from "@workspace/api-zod";
import { generatePersonalizedEmail } from "../lib/ai";

const router: IRouter = Router();

router.post("/ai/generate-email", requireAuth, async (req, res): Promise<void> => {
  const user = req.user!;
  const parsed = GenerateEmailBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [lead] = await db.select().from(leadsTable)
    .where(and(eq(leadsTable.id, parsed.data.leadId), eq(leadsTable.userId, user.id)));
  if (!lead) { res.status(404).json({ error: "Lead not found" }); return; }

  const [template] = await db.select().from(templatesTable)
    .where(and(eq(templatesTable.id, parsed.data.templateId), eq(templatesTable.userId, user.id)));
  if (!template) { res.status(404).json({ error: "Template not found" }); return; }

  const result = await generatePersonalizedEmail({
    name: lead.name, email: lead.email, vehicle: lead.vehicle, route: lead.route,
    pickup: lead.pickup, delivery: lead.delivery, price: lead.price, notes: lead.notes,
    templateSubject: template.subject, templateBody: template.body,
    tone: parsed.data.tone ?? "professional",
    customPrompt: parsed.data.customPrompt,
  });

  res.json(result);
});

router.post("/ai/preview-email", requireAuth, async (req, res): Promise<void> => {
  const user = req.user!;
  const parsed = PreviewEmailBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [template] = await db.select().from(templatesTable)
    .where(and(eq(templatesTable.id, parsed.data.templateId), eq(templatesTable.userId, user.id)));
  if (!template) { res.status(404).json({ error: "Template not found" }); return; }

  const leadData = parsed.data.leadData;
  const result = await generatePersonalizedEmail({
    name: leadData.name, email: leadData.email,
    vehicle: leadData.vehicle ?? null, route: leadData.route ?? null,
    pickup: leadData.pickup ?? null, delivery: leadData.delivery ?? null,
    price: leadData.price ?? null, notes: null,
    templateSubject: template.subject, templateBody: template.body,
    tone: parsed.data.tone ?? "professional",
  });

  res.json(result);
});

export default router;
