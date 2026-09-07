# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

MailForge: a self-hosted, multi-tenant email marketing platform. Monorepo managed by Turborepo + npm workspaces.

- `apps/api` — Express + TypeScript REST API (`@mailforge/api`)
- `apps/web` — React 19 + Vite + Tailwind frontend (`@self-hosted-email/web`)
- `packages/shared` — shared TypeScript types/constants (`@self-hosted-email/shared`)

## Commands

Run from repo root unless noted:

```bash
# Dev (turbo runs all workspaces in parallel)
npm run dev

# Per-app dev
npm run dev --workspace=apps/api          # API on :3001 (tsx watch)
npm run worker:dev --workspace=apps/api   # BullMQ workers (separate process)
npm run dev --workspace=apps/web          # Vite on :5173

# Build / lint / test
npm run build                              # turbo build (all)
npm run lint                               # turbo lint (api uses `tsc --noEmit`)
npm run test                               # turbo test → vitest in apps/api
npm run test --workspace=apps/api -- <file-pattern>   # single test file
npm run test --workspace=apps/api -- -t "<test name>" # single test by name

# Database (Knex, runs against DATABASE_URL)
npm run db:migrate                         # apply pending migrations
npm run migrate:make --workspace=apps/api -- <name>   # scaffold a new migration
npm run migrate:rollback --workspace=apps/api
npm run db:seed

# Local infra (docker compose maps Postgres→5433, Redis→6380 to avoid clashing
# with the host services this project actually runs against)
npm run docker:up
npm run docker:down
```

In production this host runs three systemd units alongside Maddy MTA: `mailforge-api`, `mailforge-worker`, `mailforge-web` (Vite preview, not `npm run dev`). The frontend talks to the API via Vite's proxy in dev (`/api`, `/t`, `/r` → `:3001`).

## Architecture

### Two processes share one codebase
- `apps/api/src/index.ts` — HTTP server. Mounts each module's router under `/api/v1/<module>`. Tracking (`/t/:traceId/:token/pixel.gif`, `/r/:shortCode/m/:traceId`) and webhook receivers are mounted at root (no `/api/v1` prefix) because they're called by external systems / email clients. The unsubscribe/preference endpoints under the tracking router are *also* mounted under `/api/v1` so the SPA can proxy to them.
- `apps/api/src/worker.ts` — BullMQ worker process. Spawns ~12 workers from `src/workers/*.worker.ts` and registers repeatable cron-like jobs (campaign scheduler 60s, automation executor 30s, stats flush 30s, A/B evaluator 5m, engagement scoring 1h, social metrics 30m, etc.). Both processes share the same DB and Redis.

When adding a new background job, add the queue to `src/config/queue.ts` *and* a worker factory in `src/workers/`, and wire it into `worker.ts`. The API process only enqueues; it never instantiates `Worker`.

### Module layout (apps/api/src/modules/<name>/)
Each module is a vertical slice with the same files: `<name>.controller.ts` (Express router, exported as `<name>Router`), `<name>.service.ts` (business logic + DB queries via Knex), `<name>.schema.ts` (Zod validation). Services import `db` from `../../config/database.js` and never touch req/res. Controllers attach `authenticate, checkTenantStatus` middleware (see `modules/auth/auth.middleware.ts`) to scope every query to `req.user.org_id`.

**Note the `.js` import suffix** in TS source — the API is ESM (`"type": "module"`) and TS resolves `./foo.js` to `./foo.ts` at build time. Don't drop the suffix.

### Multi-tenancy is enforced at the middleware layer
Every protected route runs `authenticate` (JWT → `req.user = { id, org_id, role, is_super_admin }`) then `checkTenantStatus` (looks up `organizations.status`, cached in Redis 60s, blocks if not `active`). Super admins have `org_id = NULL` and bypass tenant checks; their routes live under `/api/v1/super-admin` and use `requireSuperAdmin`. **Every service query must filter by `org_id`** — there is no global row-level security; isolation is convention-only.

Plan limits are read from `plans` joined with `organizations.limits_override` (JSONB), cached in Redis 5 min. Usage counters live both in `usage_tracking` (durable) and Redis keys `org:emails:{org_id}:{YYYY-MM}` (fast path).

### Email sending pipeline
1. `campaign-scheduler.worker` polls for `scheduled` campaigns due to send.
2. `campaign-processor.worker` expands the campaign's list/segment into per-recipient `email-send` jobs.
3. `email-sender.worker` renders the template, writes a `messages` row with a `trace_id`, rewrites links through the click tracker, embeds the open-pixel, and hands the message to the configured provider (SMTP/SendGrid/SES — config encrypted in `sending_configs.settings_encrypted`).
4. Tracking pixel hits and link redirects are HMAC-verified (`HMAC_SECRET` → first 32 chars of `HMAC-SHA256(traceId)`) and enqueued to `tracking-process`; counters are batched into `tracking-flush` every 30s.

Outbound mail in this deployment goes through Maddy MTA (`/usr/local/bin/maddy`, `/etc/maddy/maddy.conf`). DKIM keys are at `/var/lib/maddy/dkim_keys/{domain}_{selector}.key`. The deliverability queue is `/var/lib/maddy/remote_queue/`. `max_tries 1` in maddy config means **no retries** for outbound — failures are terminal.

### Frontend
React 19 + react-router 7 + Zustand + Tailwind. Pages in `apps/web/src/pages/`, super-admin pages under `pages/super-admin/`. Layout components: `Layout.tsx` (tenant), `SuperAdminLayout.tsx` (system). `ImpersonationBanner.tsx` shows when a super admin is acting as a tenant user. Editors: TipTap (rich text) + GrapesJS (drag-and-drop newsletter), with React Flow for the automation builder. Path alias `@/` → `apps/web/src/`.

### Database
Postgres via Knex. Migrations in `apps/api/src/db/migrations/` are timestamped and **must be applied in order**. Migration `20260316_003_multi_tenant_saas.ts` is the cutover point: anything earlier predates org scoping, anything after assumes `org_id` exists on tenant tables. New migrations: bump the date prefix and the sequence number (`20260XXX_NNN_*.ts`).

## Environment

`.env` lives at repo root and is loaded by both `apps/api/src/config/env.ts` and `knexfile.ts` (each walks up the path). Defaults in `env.ts` point at the **production-style** services on this host (Postgres `:5432` as `self_hosted_email`, Redis `:6379`), not the docker-compose ones (which use `:5433` / `:6380`). If you start `docker compose up`, override `DATABASE_URL` and `REDIS_URL` accordingly.

Required for anything beyond local poking: `JWT_SECRET`, `HMAC_SECRET` (changing `HMAC_SECRET` invalidates all existing tracking pixels and unsubscribe links). Optional provider creds: SMTP, SendGrid, AWS SES, and Twitter/Facebook/LinkedIn OAuth for the social-media module.
