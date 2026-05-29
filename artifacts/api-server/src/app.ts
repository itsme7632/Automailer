import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { db, usersTable, plansTable } from "@workspace/db";
import { eq } from "drizzle-orm";
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

export default app;
