import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { db, usersTable, plansTable, campaignsTable, emailQueueTable, leadsTable } from "@workspace/db";
import { eq, and, inArray, isNotNull } from "drizzle-orm";
import { processCampaignFully } from "./routes/campaigns";
import { hashPassword } from "./lib/auth";
import { maintenanceMiddleware } from "./lib/maintenance";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(maintenanceMiddleware);
app.use("/api", router);

// ─── Global JSON error handler ────────────────────────────────────────────────
// Must be registered AFTER all routes. Catches any unhandled error thrown from
// async route handlers (Express 5 forwards them automatically) and ensures the
// response is always JSON — never the default Express HTML error page.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  const status =
    typeof (err as any)?.status === "number" ? (err as any).status :
    typeof (err as any)?.statusCode === "number" ? (err as any).statusCode : 500;

  const message =
    (err as any)?.message ?? "An unexpected error occurred";

  logger.error(
    { err, method: req.method, url: req.url },
    `Unhandled route error: ${message}`,
  );

  if (!res.headersSent) {
    res.status(status).json({ success: false, error: message });
  }
});

// ---------------------------------------------------------------------------
// Idempotent admin seed — creates default admin account on first boot
// ---------------------------------------------------------------------------
async function seedAdmin(): Promise<void> {
  const ADMIN_EMAIL = "admin@brokermail.ai";
  const ADMIN_PASSWORD = "Admin@12345";
  try {
    const [existing] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, ADMIN_EMAIL));
    if (!existing) {
      const passwordHash = await hashPassword(ADMIN_PASSWORD);
      await db.insert(usersTable).values({
        email: ADMIN_EMAIL,
        name: "Admin",
        passwordHash,
        role: "admin",
      });
      logger.info({ email: ADMIN_EMAIL }, "Default admin account seeded");
    }
  } catch (err) {
    logger.warn({ err }, "Admin seed skipped (non-fatal)");
  }
}

seedAdmin().catch(() => {});

// ---------------------------------------------------------------------------
// Idempotent plan seed — creates default plans on first boot
// ---------------------------------------------------------------------------
async function seedPlans(): Promise<void> {
  const defaults = [
    {
      slug: "free", name: "Free", sortOrder: 0,
      description: "Get started with the basics",
      monthlyEmailLimit: 100, smtpAccountsLimit: 1,
      campaignsLimit: 5, batchSendLimit: 50,
      features: ["100 emails/month", "1 SMTP mailbox", "5 campaigns", "Batch size up to 50", "Community support"],
    },
    {
      slug: "starter", name: "Starter", sortOrder: 1,
      description: "Growing businesses & solo brokers",
      monthlyEmailLimit: 1000, smtpAccountsLimit: 3,
      campaignsLimit: 25, batchSendLimit: 100,
      features: ["1,000 emails/month", "3 SMTP mailboxes", "25 campaigns", "Batch size up to 100", "Email support"],
    },
    {
      slug: "growth", name: "Growth", sortOrder: 2,
      description: "Scale your outreach operation",
      monthlyEmailLimit: 5000, smtpAccountsLimit: 10,
      campaignsLimit: -1, batchSendLimit: 500,
      features: ["5,000 emails/month", "10 SMTP mailboxes", "Unlimited campaigns", "Batch size up to 500", "Priority support"],
    },
    {
      slug: "enterprise", name: "Enterprise", sortOrder: 3,
      description: "Full power for large teams",
      monthlyEmailLimit: -1, smtpAccountsLimit: -1,
      campaignsLimit: -1, batchSendLimit: -1,
      features: ["Unlimited emails", "Unlimited mailboxes", "Unlimited campaigns", "Unlimited batch size", "Dedicated support"],
    },
  ];
  for (const plan of defaults) {
    await db.insert(plansTable).values(plan).onConflictDoNothing({ target: plansTable.slug });
  }
  logger.info("Plans seeded");
}

seedPlans().catch((err) => logger.warn({ err }, "Plan seed skipped (non-fatal)"));

// ---------------------------------------------------------------------------
// Startup recovery — auto-restart processors for campaigns stuck in 'sending'
// Handles: server restarts, deployments, Replit reboots, process crashes
// ---------------------------------------------------------------------------
async function startupRecovery(): Promise<void> {
  try {
    // Give DB a moment to be ready after boot
    await new Promise(r => setTimeout(r, 2_000));

    const sendingCampaigns = await db
      .select({ id: campaignsTable.id })
      .from(campaignsTable)
      .where(eq(campaignsTable.status, "sending"));

    if (sendingCampaigns.length === 0) return;

    logger.info({ count: sendingCampaigns.length }, "[RECOVERY] Campaign found — campaigns in 'sending' status detected on startup");

    for (const { id: campaignId } of sendingCampaigns) {
      // Find deferred queue items for this campaign
      const deferredItems = await db
        .select({ leadId: emailQueueTable.leadId })
        .from(emailQueueTable)
        .where(and(
          eq(emailQueueTable.campaignId, campaignId),
          eq(emailQueueTable.status, "deferred"),
          isNotNull(emailQueueTable.leadId),
        ));

      if (deferredItems.length > 0) {
        logger.info({ campaignId, count: deferredItems.length }, "[RECOVERY] Deferred items found");
        // Reset any leads stuck in 'sending' because the processor died mid-send
        const leadIds = deferredItems.map(i => i.leadId).filter((id): id is number => id != null);
        if (leadIds.length > 0) {
          const fixed = await db
            .update(leadsTable)
            .set({ status: "queued", updatedAt: new Date() })
            .where(and(inArray(leadsTable.id, leadIds), eq(leadsTable.status, "sending")))
            .returning({ id: leadsTable.id });
          if (fixed.length > 0) {
            logger.info({ campaignId, count: fixed.length }, "[RECOVERY] Reset leads stuck in 'sending' → 'queued'");
          }
        }
      }

      // Kick off the processor — it handles its own stuck-item recovery internally
      logger.info({ campaignId }, "[RECOVERY] Processor restarted");
      processCampaignFully(campaignId).catch(err =>
        logger.error({ err, campaignId }, "[RECOVERY] Processor error after restart")
      );
    }
  } catch (err) {
    logger.warn({ err }, "[RECOVERY] Startup recovery skipped (non-fatal)");
  }
}

startupRecovery().catch(() => {});

export default app;
