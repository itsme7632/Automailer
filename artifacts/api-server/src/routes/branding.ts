import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

router.get("/users/branding", requireAuth, async (req, res): Promise<void> => {
  const user = req.user!;
  const [row] = await db.select().from(usersTable).where(eq(usersTable.id, user.id));
  res.json({
    companyName:    row?.companyName    ?? "",
    companyTagline: row?.companyTagline ?? "",
    companyWebsite: row?.companyWebsite ?? "",
    companyPhone:   row?.companyPhone   ?? "",
    usdot:          row?.usdot          ?? "",
    mcNumber:       row?.mcNumber       ?? "",
    accentColor:    row?.accentColor    ?? "",
    useSignature:   row?.useSignature   ?? false,
  });
});

router.put("/users/branding", requireAuth, async (req, res): Promise<void> => {
  const user = req.user!;
  const {
    companyName,
    companyTagline,
    companyWebsite,
    companyPhone,
    usdot,
    mcNumber,
    accentColor,
    useSignature,
  } = req.body as {
    companyName?:    string;
    companyTagline?: string;
    companyWebsite?: string;
    companyPhone?:   string;
    usdot?:          string;
    mcNumber?:       string;
    accentColor?:    string;
    useSignature?:   boolean;
  };

  await db.update(usersTable).set({
    companyName:    companyName?.trim()    || null,
    companyTagline: companyTagline?.trim() || null,
    companyWebsite: companyWebsite?.trim() || null,
    companyPhone:   companyPhone?.trim()   || null,
    usdot:          usdot?.trim()          || null,
    mcNumber:       mcNumber?.trim()       || null,
    accentColor:    accentColor?.trim()    || null,
    useSignature:   useSignature === true,
    updatedAt: new Date(),
  }).where(eq(usersTable.id, user.id));

  res.json({ ok: true });
});

export default router;
