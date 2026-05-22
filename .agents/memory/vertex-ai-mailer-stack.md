---
name: Vertex AI Mailer stack
description: Key architecture decisions for this project's auth, AI, Gmail, and DB layer
---

# Vertex AI Mailer stack decisions

## Auth
JWT-based auth (not sessions). Token stored in localStorage as "auth_token". `setAuthTokenGetter` from `@workspace/api-client-react` injects `Authorization: Bearer <token>` on every API call. Backend middleware in `artifacts/api-server/src/lib/auth.ts` validates the token and attaches `req.user`.

**Why:** No cookie complexity, works for both web and future mobile clients.

## Gmail (NEVER auto-sends)
All email creation goes through `gmail.users.drafts.create` — never `messages.send`. Gmail OAuth tokens stored per-user in DB. Connect flow: `GET /api/gmail/connect` → full page redirect → callback stores tokens.

**Why:** Product requirement — brokers must review before sending.

## AI
Uses OpenAI `gpt-4o-mini` with `response_format: { type: "json_object" }`. Template variables ({name}, {vehicle}, {route}, etc.) applied before AI personalizes. Tone options: professional, friendly, sales, followup, urgent.

## DB push
Run `pnpm --filter @workspace/db run push` to apply schema. Tables: users, campaigns, leads, templates, drafts, activity, system_logs.

## Lib build order
`pnpm run typecheck:libs` must run before api-server typecheck so DB composite lib emits declarations. Without this, all schema imports show "no exported member" errors.

## Google OAuth env vars needed for production
`GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REDIRECT_URI` — not yet set. App works for non-Gmail features without them. Set in environment-secrets when ready to enable Gmail.
