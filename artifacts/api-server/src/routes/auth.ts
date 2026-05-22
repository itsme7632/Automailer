import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { LoginBody, RegisterBody } from "@workspace/api-zod";
import { signToken, hashPassword, comparePassword, requireAuth } from "../lib/auth";
import { getGoogleAuthUrl, exchangeCode, getGmailUserInfo } from "../lib/gmail";

const router: IRouter = Router();

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { email, password } = parsed.data;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user || !user.passwordHash) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const token = signToken({ userId: user.id, email: user.email, role: user.role });
  res.json({
    token,
    user: {
      id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl,
      role: user.role, gmailConnected: user.gmailConnected, gmailEmail: user.gmailEmail,
      timezone: user.timezone, aiTone: user.aiTone, createdAt: user.createdAt.toISOString(),
    },
  });
});

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { email, password, name } = parsed.data;
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing) {
    res.status(400).json({ error: "Email already in use" });
    return;
  }
  const passwordHash = await hashPassword(password);
  const [user] = await db.insert(usersTable).values({ email, name, passwordHash }).returning();
  const token = signToken({ userId: user.id, email: user.email, role: user.role });
  res.status(201).json({
    token,
    user: {
      id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl,
      role: user.role, gmailConnected: user.gmailConnected, gmailEmail: user.gmailEmail,
      timezone: user.timezone, aiTone: user.aiTone, createdAt: user.createdAt.toISOString(),
    },
  });
});

router.post("/auth/logout", async (_req, res): Promise<void> => {
  res.json({ message: "Logged out successfully" });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const user = req.user!;
  res.json({
    id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl,
    role: user.role, gmailConnected: user.gmailConnected, gmailEmail: user.gmailEmail,
    timezone: user.timezone, aiTone: user.aiTone, createdAt: user.createdAt.toISOString(),
  });
});

router.get("/auth/google", (_req, res): void => {
  const url = getGoogleAuthUrl("google-login");
  res.redirect(url);
});

router.get("/auth/google/callback", async (req, res): Promise<void> => {
  const code = req.query.code as string;
  if (!code) {
    res.redirect("/?error=no_code");
    return;
  }
  try {
    const tokens = await exchangeCode(code);
    if (!tokens.access_token) {
      res.redirect("/?error=no_token");
      return;
    }
    const userInfo = await getGmailUserInfo(tokens.access_token);
    if (!userInfo.email) {
      res.redirect("/?error=no_email");
      return;
    }
    let [user] = await db.select().from(usersTable).where(eq(usersTable.email, userInfo.email));
    if (!user) {
      [user] = await db.insert(usersTable).values({
        email: userInfo.email,
        name: userInfo.name ?? userInfo.email,
        avatarUrl: userInfo.picture,
        googleId: userInfo.id,
      }).returning();
    }
    const token = signToken({ userId: user.id, email: user.email, role: user.role });
    const frontendUrl = process.env.FRONTEND_URL ?? "";
    res.redirect(`${frontendUrl}/dashboard?token=${token}`);
  } catch (err) {
    req.log.error({ err }, "Google OAuth callback error");
    res.redirect("/?error=oauth_failed");
  }
});

export default router;
