import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const emailQueueTable = pgTable("email_queue", {
  id: serial("id").primaryKey(),
  jobId: text("job_id").notNull(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  mailboxId: integer("mailbox_id").notNull(),
  templateId: integer("template_id").notNull(),
  campaignId: integer("campaign_id"),
  leadId: integer("lead_id"),
  email: text("email").notNull(),
  subject: text("subject").notNull().default(""),
  rowDataJson: text("row_data_json").notNull(),
  style: text("style").notNull().default("clean"),
  useSignatureBuilder: boolean("use_signature_builder").notNull().default(false),
  status: text("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  trackingId: text("tracking_id"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type EmailQueue = typeof emailQueueTable.$inferSelect;
