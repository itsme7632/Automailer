import { Router, type IRouter } from "express";
import { db, leadsTable, templatesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { GenerateEmailBody, PreviewEmailBody } from "@workspace/api-zod";
import { generatePersonalizedEmail, AiRateLimitError, AiQuotaError } from "../lib/ai";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Per-user rate limiting (in-memory sliding window)
// ---------------------------------------------------------------------------

interface RateLimitState {
  timestamps: number[];
}

const rateLimits = new Map<number, RateLimitState>();

const RATE_LIMIT_MAX_PREVIEW = 8;     // requests per window
const RATE_LIMIT_MAX_GENERATE = 20;   // per window (batch operations)
const RATE_LIMIT_WINDOW_MS = 60_000;  // 1 minute

function checkRateLimit(userId: number, max: number): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const state = rateLimits.get(userId) ?? { timestamps: [] };
  // Purge expired entries
  state.timestamps = state.timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  if (state.timestamps.length >= max) {
    const oldest = state.timestamps[0];
    const retryAfterMs = RATE_LIMIT_WINDOW_MS - (now - oldest);
    rateLimits.set(userId, state);
    return { allowed: false, retryAfterSec: Math.ceil(retryAfterMs / 1000) };
  }
  state.timestamps.push(now);
  rateLimits.set(userId, state);
  return { allowed: true, retryAfterSec: 0 };
}

// ---------------------------------------------------------------------------
// In-flight request deduplication (prevent simultaneous AI requests per user)
// ---------------------------------------------------------------------------

const inFlight = new Set<number>();

// ---------------------------------------------------------------------------
// Preview response cache (keyed by templateId:tone:updatedAt)
// ---------------------------------------------------------------------------

interface CacheEntry {
  subject: string;
  body: string;
  tone: string;
  cachedAt: number;
}

const previewCache = new Map<string, CacheEntry>();
const PREVIEW_CACHE_TTL_MS = 5 * 60_000; // 5 minutes

function getPreviewCacheKey(templateId: number, tone: string, updatedAt: Date): string {
  return `${templateId}:${tone}:${updatedAt.getTime()}`;
}

function pruneCache() {
  const now = Date.now();
  for (const [key, entry] of previewCache) {
    if (now - entry.cachedAt > PREVIEW_CACHE_TTL_MS) previewCache.delete(key);
  }
}

// ---------------------------------------------------------------------------
// Helper: map AI lib errors to HTTP responses
// ---------------------------------------------------------------------------

function handleAiError(err: unknown, res: Parameters<typeof router.post>[1] extends (req: any, res: infer R) => any ? R : never): void {
  if (err instanceof AiRateLimitError) {
    res.status(429).set("Retry-After", "10").json({ error: "AI is temporarily busy. Please wait a few seconds and try again." });
    return;
  }
  if (err instanceof AiQuotaError) {
    res.status(429).set("Retry-After", "3600").json({ error: "Daily AI quota reached. Please try again later.", quota: true });
    return;
  }
  throw err;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

router.post("/ai/generate-email", requireAuth, async (req, res): Promise<void> => {
  const user = req.user!;

  const rateCheck = checkRateLimit(user.id, RATE_LIMIT_MAX_GENERATE);
  if (!rateCheck.allowed) {
    res.status(429).set("Retry-After", String(rateCheck.retryAfterSec)).json({
      error: "Too many requests. Please wait a moment before generating more emails.",
    });
    return;
  }

  if (inFlight.has(user.id)) {
    res.status(429).set("Retry-After", "5").json({
      error: "A generation is already in progress. Please wait for it to finish.",
    });
    return;
  }

  const parsed = GenerateEmailBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [lead] = await db.select().from(leadsTable)
    .where(and(eq(leadsTable.id, parsed.data.leadId), eq(leadsTable.userId, user.id)));
  if (!lead) { res.status(404).json({ error: "Lead not found" }); return; }

  const [template] = await db.select().from(templatesTable)
    .where(and(eq(templatesTable.id, parsed.data.templateId), eq(templatesTable.userId, user.id)));
  if (!template) { res.status(404).json({ error: "Template not found" }); return; }

  inFlight.add(user.id);
  try {
    const result = await generatePersonalizedEmail({
      name: lead.name, email: lead.email, vehicle: lead.vehicle, route: lead.route,
      pickup: lead.pickup, delivery: lead.delivery, price: lead.price, notes: lead.notes,
      templateSubject: template.subject, templateBody: template.body,
      tone: parsed.data.tone ?? "professional",
      customPrompt: parsed.data.customPrompt,
    });
    res.json(result);
  } catch (err) {
    handleAiError(err, res as any);
  } finally {
    inFlight.delete(user.id);
  }
});

router.post("/ai/preview-email", requireAuth, async (req, res): Promise<void> => {
  const user = req.user!;

  const rateCheck = checkRateLimit(user.id, RATE_LIMIT_MAX_PREVIEW);
  if (!rateCheck.allowed) {
    res.status(429).set("Retry-After", String(rateCheck.retryAfterSec)).json({
      error: "AI is temporarily busy. Please wait a few seconds and try again.",
    });
    return;
  }

  if (inFlight.has(user.id)) {
    res.status(429).set("Retry-After", "5").json({
      error: "A generation is already in progress. Please wait for it to finish.",
    });
    return;
  }

  const parsed = PreviewEmailBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [template] = await db.select().from(templatesTable)
    .where(and(eq(templatesTable.id, parsed.data.templateId), eq(templatesTable.userId, user.id)));
  if (!template) { res.status(404).json({ error: "Template not found" }); return; }

  // Serve from cache if the template hasn't changed since last preview
  const cacheKey = getPreviewCacheKey(template.id, parsed.data.tone ?? "professional", template.updatedAt);
  pruneCache();
  const cached = previewCache.get(cacheKey);
  if (cached) {
    req.log.debug({ cacheKey }, "Serving preview from cache");
    res.set("X-Cache", "HIT").json({ subject: cached.subject, body: cached.body, tone: cached.tone });
    return;
  }

  inFlight.add(user.id);
  try {
    const leadData = parsed.data.leadData;
    const result = await generatePersonalizedEmail({
      name: leadData.name, email: leadData.email,
      vehicle: leadData.vehicle ?? null, route: leadData.route ?? null,
      pickup: leadData.pickup ?? null, delivery: leadData.delivery ?? null,
      price: leadData.price ?? null, notes: null,
      templateSubject: template.subject, templateBody: template.body,
      tone: parsed.data.tone ?? "professional",
    });

    previewCache.set(cacheKey, { ...result, cachedAt: Date.now() });
    res.set("X-Cache", "MISS").json(result);
  } catch (err) {
    handleAiError(err, res as any);
  } finally {
    inFlight.delete(user.id);
  }
});

export default router;
