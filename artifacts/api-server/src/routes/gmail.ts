import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { getGmailAuthUrl, exchangeCode, getGmailUserInfo } from "../lib/gmail";

const router: IRouter = Router();

router.get("/gmail/status", requireAuth, async (req, res): Promise<void> => {
  const user = req.user!;
  res.json({
    connected: user.gmailConnected,
    email: user.gmailEmail ?? null,
    lastSynced: null,
  });
});

router.get("/gmail/connect", requireAuth, async (req, res): Promise<void> => {
  const user = req.user!;
  const url = getGmailAuthUrl(`gmail-connect:${user.id}`);
  res.redirect(url);
});

router.get("/gmail/callback", async (req, res): Promise<void> => {
  const code = req.query.code as string;
  const state = req.query.state as string;
  if (!code) {
    res.redirect("/settings?error=no_code");
    return;
  }
  const userId = state?.split(":")?.[1];
  if (!userId) {
    res.redirect("/settings?error=invalid_state");
    return;
  }
  try {
    const tokens = await exchangeCode(code);
    if (!tokens.access_token) {
      res.redirect("/settings?error=no_token");
      return;
    }
    const userInfo = await getGmailUserInfo(tokens.access_token);
    await db.update(usersTable).set({
      gmailConnected: true,
      gmailEmail: userInfo.email ?? null,
      gmailAccessToken: tokens.access_token,
      gmailRefreshToken: tokens.refresh_token ?? null,
      gmailTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      updatedAt: new Date(),
    }).where(eq(usersTable.id, parseInt(userId, 10)));
    const frontendUrl = process.env.FRONTEND_URL ?? "";
    res.redirect(`${frontendUrl}/settings?gmail=connected`);
  } catch (err) {
    req.log.error({ err }, "Gmail OAuth callback error");
    res.redirect("/settings?error=oauth_failed");
  }
});

router.post("/gmail/disconnect", requireAuth, async (req, res): Promise<void> => {
  const user = req.user!;
  await db.update(usersTable).set({
    gmailConnected: false,
    gmailEmail: null,
    gmailAccessToken: null,
    gmailRefreshToken: null,
    gmailTokenExpiry: null,
    updatedAt: new Date(),
  }).where(eq(usersTable.id, user.id));
  res.json({ message: "Gmail disconnected" });
});

export default router;
