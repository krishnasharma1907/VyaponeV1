# VyapOne Staging Environment Setup Guide (`STAGING-001`)

> [!CAUTION]
> **Strict Production Isolation Boundary**
> - Production Supabase project ref (`fjoezwoyowihbxacmoyp`), production Cloudflare Worker `vyapone` (`https://vyapone.kssharma2022krish.workers.dev/`), root `.env`, and branch `main` must remain untouched during all staging workflows.
> - **Release Status:** Staging preparation only (`STAGING-001`). Production deployment remains **NO-GO**.
> - **Remote Staging Execution Status:** Local code, scripts, templates, and Vitest verification are complete; remote `VyapOne-Staging` provisioning/migration steps remain operator-executed once you create the dedicated `VyapOne-Staging` Supabase project.

---

## 1. Environment Architecture & `.env` Fallback Prevention

Root `.env` exists in this workspace and targets production (`fjoezwoyowihbxacmoyp`). Standard Next.js commands (`next dev`, `next build`, `next start`) invoke `@next/env`, which automatically merges `.env` into `process.env` whenever any key is unset.

To guarantee zero silent fallback to production credentials:

1. **Gitignore Protection (`.gitignore`):**
   - Ignored: `.env.staging`, `.env.staging.local`
   - Tracked template: `!.env.staging.local.example`
2. **Sanitized Staging Template ([`.env.staging.local.example`](file:///f:/VyaponeV2/.env.staging.local.example)):**
   - Defines all public, server-core, and optional integration variables plus `VYAPONE_STAGING_PROJECT_REF`.
   - Must be copied manually to `.env.staging.local` (never committed).
3. **Isolated Staging Runner ([`scripts/run-staging.mjs`](file:///f:/VyaponeV2/scripts/run-staging.mjs) + [`scripts/staging/env-loader.mjs`](file:///f:/VyaponeV2/scripts/staging/env-loader.mjs)):**
   - Dedicated `package.json` scripts:
     - `pnpm staging:check` — Runs migration, `.gitignore`, and isolation preflight ([`scripts/staging-preflight.mjs`](file:///f:/VyaponeV2/scripts/staging-preflight.mjs)).
     - `pnpm dev:staging` — Starts Next.js development server (`NODE_ENV=development`) strictly from `.env.staging.local`.
     - `pnpm build:staging` — Compiles production bundle (`NODE_ENV=production`) with staging env and records `.next/.vyapone-staging-manifest.json`.
     - `pnpm start:staging` — Verifies `.next/.vyapone-staging-manifest.json` matches staging mode and project ref before starting (`NODE_ENV=production`).
   - Requires `.env.staging.local` on disk (fails closed if missing; refuses `.env`, `.env.production`, `.env.production.local`).
   - Scrubs all sibling `.env*` / `.dev.vars*` key names and inherited credential prefixes from child `process.env` to `""`, sets `VYAPONE_STAGING_MODE=1`, and sets `__NEXT_PROCESSED_ENV=true` so Next.js `@next/env` cannot hydrate omitted keys from `.env`.
   - Rejects unedited template placeholders (`placeholder-staging-project-ref`, `-replace-me`, `replace-before-running`) when launching Next.js or applying remote bootstrap changes.

---

## 2. Client Bundle Boundary & Runtime Startup Guards

### Client-Safe Allowlist ([`src/config/public.ts`](file:///f:/VyaponeV2/src/config/public.ts))

Browser bundles expose ONLY four allowlisted public variables:

- `NEXT_PUBLIC_APP_ENV` (`staging`)
- `NEXT_PUBLIC_APP_URL` (e.g., `http://localhost:3000` or dedicated staging preview origin)
- `NEXT_PUBLIC_SUPABASE_URL` (`https://<staging-ref>.supabase.co`)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Privileged keys (`DATABASE_URL`, `DATABASE_DIRECT_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`, `VYAPONE_STAGING_PROJECT_REF`, and third-party API keys) remain exclusively behind `"server-only"` modules (`src/config/server.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/admin.ts`).

### Production Project Reference Guards (`fjoezwoyowihbxacmoyp`)

[`assertStagingIsolation`](file:///f:/VyaponeV2/src/config/env.ts) enforces fail-closed protection at startup and runtime across:

- `validateEnvironment()` ([`src/config/env.ts`](file:///f:/VyaponeV2/src/config/env.ts))
- `publicConfig` and `getPublicConfig()` ([`src/config/public.ts`](file:///f:/VyaponeV2/src/config/public.ts))
- [`createBrowserSupabaseClient()`](file:///f:/VyaponeV2/src/lib/supabase/client.ts)
- [`createServerSupabaseClient()`](file:///f:/VyaponeV2/src/lib/supabase/server.ts)
- [`updateSession()`](file:///f:/VyaponeV2/src/lib/supabase/middleware.ts)
- [`createAdminSupabaseClient()`](file:///f:/VyaponeV2/src/lib/supabase/admin.ts)
- [`scripts/run-staging.mjs`](file:///f:/VyaponeV2/scripts/run-staging.mjs), [`scripts/staging-preflight.mjs`](file:///f:/VyaponeV2/scripts/staging-preflight.mjs), [`scripts/staging-bootstrap.mjs`](file:///f:/VyaponeV2/scripts/staging-bootstrap.mjs)

Whenever staging mode (`NEXT_PUBLIC_APP_ENV=staging` or `VYAPONE_STAGING_MODE=1`) is active, the guard throws `ConfigurationError` (without embedding secret values) if:

1. Any Supabase URL, PostgreSQL DSN (`DATABASE_URL` / `DATABASE_DIRECT_URL` host or `postgres.<ref>` pooler user), `VYAPONE_STAGING_PROJECT_REF`, or decoded JWT `ref` claim inside `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` resolves to `fjoezwoyowihbxacmoyp`.
2. `NEXT_PUBLIC_APP_URL` targets a production origin (`vyapone.in`, `www.vyapone.in`, `app.vyapone.in`, `vyapone.kssharma2022krish.workers.dev`).
3. Non-empty Supabase project references disagree across staging URLs, DSNs, or JWTs.
4. Staging mode runs strictly (`VYAPONE_STAGING_MODE=1` or `NODE_ENV=production`) with missing required credentials or the insecure default `SESSION_SECRET`.

---

## 3. Isolated Migration Strategy & Migration #13 Bootstrap Handling

The repository contains **29 migration files** under `supabase/migrations/`:

- **1–25 (`20261112000001` through `20261120000003`)**: Historical immutable migrations (must never be modified in place).
- **26–29 (`20261122000001` through `20261125000001`)**: Forward draft concurrency, rollback RPC, publishing/domains/QR, and schema remediation migrations.

### Known Clean-DB Bootstrap Defect (Migration #13)

- `supabase/migrations/20261117000002_audit_and_notification_foundation.sql` binds `trg_notifications_updated_at` to `public.update_updated_at_column()`.
- Fresh empty databases only define `public.set_updated_at()` (from `20261112000001_initial_schema.sql`), causing clean-DB migration replay to abort at migration #13 until forward migration #29 (`20261125000001_remediate_historical_schema_and_rpc_defects.sql`) replaces that trigger with `public.set_updated_at()`.
- Note: Production recovery remains governed by `ADR-028` in `docs/DECISION_REGISTER.md`.

### Step-by-Step Isolated Staging Migration Procedure

1. Create a fresh dedicated Supabase project (e.g., `VyapOne-Staging`) and record its `<staging-ref>` in `.env.staging.local`.
2. Run local staging preflight verification first:

   ```bash
   pnpm staging:check
   ```

3. Link Supabase CLI strictly to your staging ref (confirm the prompt never references `fjoezwoyowihbxacmoyp`):

   ```bash
   supabase link --project-ref <staging-ref>
   ```

4. **On an empty `VyapOne-Staging` database only**, apply **STAGE 1** of [`scripts/staging/clean-db-bootstrap-compat.sql`](file:///f:/VyaponeV2/scripts/staging/clean-db-bootstrap-compat.sql) (`psql "$DATABASE_DIRECT_URL"` or Staging SQL Editor as `postgres`). This temporarily supplies `public.update_updated_at_column()` without editing immutable historical migrations 1–25.
5. Dry-run pending migrations, then push sequentially (**NEVER run `supabase db reset --remote`**):

   ```bash
   supabase db push --dry-run
   supabase db push
   ```

6. Execute **STAGE 2** of [`scripts/staging/clean-db-bootstrap-compat.sql`](file:///f:/VyaponeV2/scripts/staging/clean-db-bootstrap-compat.sql) (`DROP FUNCTION IF EXISTS public.update_updated_at_column();`) after migration #29 (`20261125000001`) succeeds, leaving zero temporary shim functions behind.

---

## 4. `supabase/seed.sql` & `publish_site_draft_atomic` Review (`Task 11`)

- In `20261122000003_website_publishing_domains_and_qr.sql`, `public.publish_site_draft_atomic(p_site_id, p_business_id, p_caller_user_id, p_target_version_id, p_expected_draft_version_number)` enforces:
  1. **Session impersonation guard:** `IF auth.uid() IS NOT NULL AND auth.uid() <> p_caller_user_id THEN RAISE EXCEPTION ... USING ERRCODE = 'VY020'; END IF;`
  2. **Public profile prerequisite:** Requires `p_caller_user_id` (`00000000-0000-4000-a000-000000000003`) to exist in `public.users`.
  3. **Authoritative role check:** Caller must hold active `owner`/`manager` in `public.business_members`, `sovereign_owner_id` on `public.businesses`, active workspace admin/owner in `public.workspace_members`, or `owner_user_id` on `public.workspaces`.
- **Safe execution rule for `VyapOne-Staging`:**
  - `supabase/seed.sql` inserts `public.users`, `public.workspaces`, `public.businesses`, `public.business_members`, `public.sites` (`status = 'draft'`), and `v1` in `public.site_versions`, then calls `publish_site_draft_atomic(...)`.
  - When applied via `psql` or Supabase SQL Editor **without JWT impersonation (`postgres` role)**, `auth.uid()` is `NULL`, so `publish_site_draft_atomic` passes cleanly.
  - **Pitfall:** If executed in Supabase SQL Editor while impersonating an `authenticated` user whose JWT `sub` differs from `'00000000-0000-4000-a000-000000000003'`, `auth.uid() <> p_caller_user_id` will raise `VY020`.
  - Note also that the programmatic TypeScript fixture [`src/lib/database/seed.ts`](file:///f:/VyaponeV2/src/lib/database/seed.ts) intentionally blocks running when `NEXT_PUBLIC_APP_ENV === "staging"` or against remote `supabase.co` hosts; `supabase/seed.sql` on `VyapOne-Staging` must therefore be run deliberately only against the verified staging ref after migrations pass.

---

## 5. Staging Auth, Storage Buckets, CORS & Test Users (`Task 10`)

### A. Supabase Auth URL Configuration (`VyapOne-Staging` only)

In Supabase Dashboard (**Authentication > URL Configuration**):

- **Site URL:** `http://localhost:3000` (or dedicated staging preview URL if provisioned later)
- **Additional Redirect URLs:**
  - `http://localhost:3000/auth/callback`
  - `http://localhost:3000/**`
  - `http://127.0.0.1:3000/auth/callback`
- Notice [`src/app/auth/callback/route.ts`](file:///f:/VyaponeV2/src/app/auth/callback/route.ts) exchanges PKCE codes via `/auth/callback` and idempotently invokes `ensureUserProfile`. Never add production origins (`vyapone.in`, `vyapone.kssharma2022krish.workers.dev`) to staging Auth redirects.

### B. Canonical Storage Buckets & CORS

Per `20261118000003_secure_media_upload_pipeline.sql` (`chk_media_items_bucket`) and [`src/lib/media/validation.ts`](file:///f:/VyaponeV2/src/lib/media/validation.ts), VyapOne uses **two** canonical Supabase Storage buckets (note: an earlier deployment doc note mentioned `vyapone-media`, whereas the application and schema require the two buckets below):

| Bucket ID | Visibility | Max File Size | Allowed MIME Types | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `vyapone-public-media` | Public (`true`) | 5 MiB | `image/png`, `image/jpeg`, `image/webp`, `image/svg+xml` | Published website/catalogue logos & assets |
| `vyapone-private-media` | Private (`false`) | 10 MiB | Images + `application/pdf`, `text/csv`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | Quarantine uploads, onboarding docs, attachments |

Configure Storage CORS on staging for origins `http://localhost:3000` and `http://127.0.0.1:3000` (`GET`, `POST`, `PUT`, `DELETE`, `HEAD`).

### C. Auth User Sync Warning & Automated Staging Bootstrap

- `public.users` enforces `UNIQUE` constraints on both `email` and `phone_number` (`20261112000001`), while `public.handle_new_auth_user()` (`20261115000002`) upserts `ON CONFLICT (id) DO UPDATE`.
- Signing up through normal Auth with an email/phone already seeded in `supabase/seed.sql` (e.g., `ramesh@example.vyapone.internal`) would generate a new UUID and collide on unique constraints inside the trigger.
- Use [`scripts/staging-bootstrap.mjs`](file:///f:/VyaponeV2/scripts/staging-bootstrap.mjs) to inspect or create the canonical Storage buckets and optional Auth logins matching deterministic `seed.sql` UUIDs (`00000000-0000-4000-a000-000000000001..000004`):

  ```bash
  # Safe default dry-run check
  node scripts/staging-bootstrap.mjs

  # Provision staging buckets only (after configuring .env.staging.local)
  node scripts/staging-bootstrap.mjs --apply

  # Provision staging buckets + deterministic seed.sql Auth users (supply password via shell env only)
  STAGING_TEST_USER_PASSWORD="<temp-staging-password>" node scripts/staging-bootstrap.mjs --apply --seed-users
  ```
