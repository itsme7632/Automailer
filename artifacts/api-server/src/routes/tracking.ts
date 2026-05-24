import { Router, type IRouter } from "express";
import { db, draftsTable, emailTrackingEventsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

router.get("/track/open/:trackingId", async (req, res): Promise<void> => {
  const { trackingId } = req.params;

  try {
    const [draft] = await db
      .select({ id: draftsTable.id })
      .from(draftsTable)
      .where(eq(draftsTable.trackingId, trackingId));

    if (draft) {
      await db.insert(emailTrackingEventsTable).values({
        draftId: draft.id,
        eventType: "open",
        ipAddress: req.ip ?? null,
        userAgent: req.get("user-agent") ?? null,
      });
    }
  } catch {
  }

  res.set({
    "Content-Type": "image/gif",
    "Content-Length": PIXEL.length,
    "Cache-Control": "no-store, no-cache, must-revalidate, private",
    Pragma: "no-cache",
    Expires: "0",
  });
  res.send(PIXEL);
});

router.get("/track/click/:trackingId", async (req, res): Promise<void> => {
  const { trackingId } = req.params;
  const url = req.query.url as string | undefined;

  if (!url) {
    res.status(400).send("Missing url parameter");
    return;
  }

  try {
    const [draft] = await db
      .select({ id: draftsTable.id })
      .from(draftsTable)
      .where(eq(draftsTable.trackingId, trackingId));

    if (draft) {
      await db.insert(emailTrackingEventsTable).values({
        draftId: draft.id,
        eventType: "click",
        linkUrl: url,
        ipAddress: req.ip ?? null,
        userAgent: req.get("user-agent") ?? null,
      });
    }
  } catch {
  }

  res.redirect(url);
});

export default router;
