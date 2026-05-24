import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword } from "./lib/auth";

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

export default app;
