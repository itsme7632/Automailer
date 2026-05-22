import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { getGmailAuthUrl } from "../lib/gmail";

const router: IRouter = Router();

router.get("/gmail/status", requireAuth, async (req, res): Promise<void> => {
  const user = req.user!;
  res.json({
    connected: user.gmailConnected,
    email: user.gmailEmail ?? null,
    lastSynced: null,
  });
});

/**
 * Start the Gmail OAuth connect flow for the currently logged-in user.
 * Redirects to Google with state="gmail-connect:<userId>".
 * The callback is handled by /api/auth/callback (the unified OAuth handler).
 */
router.get("/gmail/connect", requireAuth, async (req, res): Promise<void> => {
  const user = req.user!;
  const url = getGmailAuthUrl(user.id);
  res.redirect(url);
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
