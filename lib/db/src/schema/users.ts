import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash"),
  avatarUrl: text("avatar_url"),
  role: text("role").notNull().default("user"),
  googleId: text("google_id"),
  gmailConnected: boolean("gmail_connected").notNull().default(false),
  gmailEmail: text("gmail_email"),
  gmailAccessToken: text("gmail_access_token"),
  gmailRefreshToken: text("gmail_refresh_token"),
  gmailTokenExpiry: timestamp("gmail_token_expiry"),
  timezone: text("timezone").default("UTC"),
  aiTone: text("ai_tone").default("professional"),
  // ── Company branding ─────────────────────────────────────────────────────
  companyName: text("company_name"),
  companyTagline: text("company_tagline"),
  companyWebsite: text("company_website"),
  companyPhone: text("company_phone"),
  usdot: text("usdot"),
  mcNumber: text("mc_number"),
  accentColor: text("accent_color"),
  useSignature: boolean("use_signature").notNull().default(false),
  // ─────────────────────────────────────────────────────────────────────────
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
