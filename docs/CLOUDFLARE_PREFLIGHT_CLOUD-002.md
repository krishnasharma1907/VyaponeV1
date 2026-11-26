# Cloudflare Workers Production Deployment Preflight Audit (CLOUD-002)

**Workspace:** `F:\VyaponeV2`  
**Existing Worker:** `vyapone`  
**Existing Live URL:** https://vyapone.kssharma2022krish.workers.dev/  
**Git Remote:** https://github.com/krishnasharma1907/VyaponeV1.git  
**Production Branch:** `main`  
**Latest Local Commit:** `7c61842` (`feat(cloud-001): prepare cloudflare workers preview deployment configuration`)  
**Audit Status:** `BLOCKED` (Pending manual execution of 3 unapplied Supabase migrations in production)

---

## 1. Production Supabase Schema Readiness Audit

A 100% read-only discovery inspection of the live remote Supabase project (`https://fjoezwoyowihbxacmoyp.supabase.co`) was conducted via PostgREST OpenAPI schema introspection using the authorized service role credentials from the local environment.

### Discovered Production State:
- **Discovered Tables (29 tables currently present):**
  `workspaces`, `capacity_overrides`, `niche_groups`, `businesses`, `site_versions`, `workspace_members`, `orders`, `workspace_invitations`, `subscriptions`, `bills`, `customers`, `locations`, `user_directory`, `niches`, `entitlement_overrides`, `user_auth_identities`, `platform_modules`, `catalogue_items`, `business_onboarding_answers`, `sites`, `business_modules`, `media_items`, `invoice_sequences`, `niche_modules`, `business_members`, `business_invitations`, `users`, `notifications`, `audit_logs`.
- **Discovered RPC Functions (20 functions currently present):**
  `raise_capacity_exceeded`, `can_manage_business`, `create_business_with_primary_location`, `ensure_user_profile`, `accept_business_invitation_atomic`, `is_business_sovereign_owner`, `create_business_with_setup_atomic`, `is_workspace_member`, `confirm_business_import_atomic`, `is_business_manager_or_owner`, `can_access_business`, `create_in_app_notification`, `is_business_member`, `assert_and_lock_workspace_capacity`, `transition_site_status_atomic`, `can_access_location`, `is_business_owner_or_manager`, `is_workspace_admin_or_owner`, `save_site_draft_configuration_atomic` (7-parameter version), `accept_workspace_invitation_atomic`.

### Critical Missing Objects (Application Expects These):
1. **Missing Tables:**
   - `public.site_domains` (custom domains, verification status, DNS challenge records, SSL status) — introduced in `20261122000003_website_publishing_domains_and_qr.sql`.
   - `public.qr_codes` (dynamic QR codes, public slugs, destination configuration, scan tracking) — introduced in `20261122000003_website_publishing_domains_and_qr.sql`.
2. **Missing RPC Functions:**
   - `public.rollback_published_site_version_atomic(p_site_id, p_business_id, p_caller_user_id, p_target_version_id, p_expected_current_published_version_id)` — introduced in `20261122000002_website_rollback_rpc.sql`.
   - `public.publish_site_draft_atomic(p_site_id, p_business_id, p_caller_user_id, p_expected_draft_version_number)` — introduced in `20261122000003_website_publishing_domains_and_qr.sql`.
3. **Outdated RPC Function Signatures:**
   - `public.save_site_draft_configuration_atomic` on production is currently the 7-parameter version lacking optimistic concurrency parameter `p_expected_base_version_number`. The latest application code (`src/lib/websites/service.ts`) passes 8 arguments with the concurrency token. Calling this on the current production database will throw an immediate PL/pgSQL function signature mismatch error (`VY049`).

---

## 2. Required Migration List and Dependency Ordering

To bring the production Supabase database up to date with the latest application code, exactly **3 migrations** must be executed in order:

| Step | Migration File | Target Capability | Schema Modifications | Destructive Risk |
|---|---|---|---|---|
| **1** | `20261122000001_website_draft_concurrency_and_optimistic_lock.sql` | Draft concurrency & optimistic locking (VO-047/VO-044 audit) | Replaces `save_site_draft_configuration_atomic` with 8-parameter overload including `p_expected_base_version_number`. Verifies version number under `FOR UPDATE` lock. | **None (Safe additive/replacement).** Preserves all existing drafts and versions. |
| **2** | `20261122000002_website_rollback_rpc.sql` | Site versions and rollback (VO-048) | Creates atomic RPC `rollback_published_site_version_atomic`. Verifies caller ownership, published target version, and concurrency lock. | **None (Pure function creation).** |
| **3** | `20261122000003_website_publishing_domains_and_qr.sql` | Pre-publish validation, custom domains, QR (VO-049) | Creates `public.site_domains` and `public.qr_codes` tables with RLS policies, indexes, and triggers; creates `publish_site_draft_atomic` RPC. | **None (New tables and new RPC).** Completely additive. |

### Migration Uncertainty & Safety Assessment:
- Migrations 1 through 25 (`20261112000001` through `20261120000003`) are confirmed already applied to the remote Supabase database.
- None of the 3 pending migrations drop existing tables, alter column types, or delete user data.
- **Strict Compliance:** In accordance with deployment safety rules, neither `supabase db push`, `supabase migration repair`, nor manual SQL execution was performed. These migrations must be applied manually via the Supabase Dashboard SQL Editor or authorized CI migration runner prior to updating the Worker.

---

## 3. OpenNext Deployment Configuration Status

### Configuration Audit (`package.json`, `wrangler.jsonc`, `open-next.config.ts`, `.gitignore`):
1. **OpenNext Package Version:**
   - Latest compatible release: `@opennextjs/cloudflare@1.20.18`.
   - Peer dependency requirements: `next: ">=15.5.29 <16 || >=16.4.5"`, `wrangler: "^4.148.0"`.
   - Project Next.js version: `15.5.29` (100% exact match).
2. **Wrangler Configuration (`wrangler.jsonc`):**
   - Worker name: `vyapone` (matches production worker).
   - Compatibility date: `2024-11-01`.
   - Compatibility flags: `["nodejs_compat"]` (present).
   - **Entry Point Discrepancy:** Existing `wrangler.jsonc` has `"main": "./dist/server/index.js"` and `"assets": { "directory": "./public" }` (configured previously for Vinext). OpenNext compiles its Cloudflare bundle to:
     - `main`: `".open-next/worker.js"`
     - `assets.directory`: `".open-next/assets"`
     *Recommendation:* When deploying with OpenNext, update `main` to `".open-next/worker.js"` and `assets.directory` to `".open-next/assets"`.
3. **OpenNext Config (`open-next.config.ts`):**
   - Config file prepared using official OpenNext specification:
     ```ts
     import { defineCloudflareConfig } from "@opennextjs/cloudflare";
     export default defineCloudflareConfig({});
     ```
   - TypeScript definitions added to `src/types/opennext.d.ts` ensuring `pnpm typecheck` (`tsc --noEmit`) passes with 0 errors.
4. **Git Ignore (`.gitignore`):**
   - Added `.open-next/` build artifact directory to `.gitignore` to prevent generated Worker bundles from being tracked.
5. **OpenNext Scripts Prepared (`package.json`):**
   - `"preview:cloudflare"`: `"pnpm dlx @opennextjs/cloudflare build && pnpm dlx wrangler dev"`
   - `"deploy:cloudflare"`: `"pnpm dlx @opennextjs/cloudflare build && pnpm dlx wrangler deploy"`
   - All standard scripts (`dev`, `build`, `start`, `test`, `lint`, `typecheck`) preserved without modification.

---

## 4. Production Runtime Environment Requirements

The production application requires the following environment bindings configured in the Cloudflare Dashboard under **Workers & Pages > vyapone > Settings > Variables and Secrets**:

### Tier 1: Public Variables (Non-Sensitive)
- `NEXT_PUBLIC_APP_ENV`: `"production"`
- `NEXT_PUBLIC_APP_URL`: `"https://vyapone.kssharma2022krish.workers.dev"` (or custom apex domain `https://vyapone.in`)
- `NEXT_PUBLIC_SUPABASE_URL`: `"https://<project-ref>.supabase.co"`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: `<production-supabase-anon-key>`

### Tier 2: Server-Only Encrypted Secrets (Privileged — Never Disclosed)
- `NODE_ENV`: `"production"`
- `SESSION_SECRET`: High-entropy 32+ character encryption secret.
- `SUPABASE_SERVICE_ROLE_KEY`: Service role JWT for server-authoritative RPCs and tenant administration.
- `DATABASE_URL` / `DATABASE_DIRECT_URL`: PostgreSQL connection string (pooler / transaction mode).

### Tier 3: Optional Integrations (Features Degrade Gracefully When Omitted)
- `STORAGE_ENDPOINT`, `STORAGE_BUCKET`, `STORAGE_REGION`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY` (Cloudflare R2 / S3)
- `REDIS_URL` (Upstash Redis)
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
- `META_WHATSAPP_TOKEN`, `META_WHATSAPP_PHONE_NUMBER_ID`, `META_WHATSAPP_BUSINESS_ACCOUNT_ID`, `META_WEBHOOK_VERIFY_TOKEN`
- `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`

---

## 5. Cloudflare Git Integration & Builds Audit

### Live Worker Probe (`https://vyapone.kssharma2022krish.workers.dev/`):
- **Live HTTP Status:** `200 OK`
- **Response Headers:** `x-opennext: 1`, `x-powered-by: Next.js`, `x-nextjs-cache: MISS`, `server: cloudflare`.
- **Live Route Status:**
  - `/` -> `200 OK`
  - `/login` -> `200 OK`
  - `/auth/callback` -> `307 Temporary Redirect`
  - `/dashboard` -> `307 Temporary Redirect` (redirects to `/login?next=%2Fdashboard`)
  - `/robots.txt` -> `200 OK`
  - `/sitemap.xml` -> `404 Not Found` (Implemented locally in commit `2552508` / VO-043)
  - `/qr/[slug]` -> `404 Not Found` (Implemented locally in commit `5c8059e` / VO-049)
  - `/s/preview` -> `200 OK`

### Git & Builds Findings:
- Configured Git remote: `origin https://github.com/krishnasharma1907/VyaponeV1.git`.
- Current production branch: `main`.
- Local `main` is at `7c61842`, which is **11 commits ahead** of `origin/main` (`67f9141`).
- The 404 responses for `/sitemap.xml` and `/qr/[slug]` prove conclusively that the live worker is running the older code from `origin/main` (`67f9141`).
- **Critical Risk:** If Cloudflare Workers Builds is connected to `VyaponeV1.git` branch `main`, any `git push origin main` will trigger an immediate automated build and deploy the 11 unpushed commits directly to production. Because the remote database is missing the 3 migrations, this will result in runtime errors for site publishing and versioning.

---

## 6. Local Quality Gates & Verification Evidence

All local quality gates were executed directly against the local codebase:

| Check | Command | Result | Details |
|---|---|---|---|
| **Typecheck** | `pnpm typecheck` | `PASS (Exit 0)` | TypeScript 5.7+ (`tsc --noEmit`), 0 errors, 0 warnings. |
| **Lint** | `pnpm lint` | `PASS (Exit 0)` | ESLint 9 Flat Config, 0 errors, 0 warnings across all files. |
| **Format** | `pnpm format:check` | `PASS (Exit 0)` | Prettier check, all files formatted to standard. |
| **Vitest Tests** | `pnpm vitest run` | `PASS (Exit 0)` | **107 test files passed (100%)**, **1,345 unit & integration tests passed (100%)**. |
| **Production Build** | `pnpm build` | `PASS (Exit 0)` | Next.js 15.5.29 App Router, all 40 static & dynamic routes compiled cleanly. |

---

## 7. Exact Production Deployment Commands

Once the 3 Supabase migrations are executed in production and authorization is granted:

### Option A: Local Wrangler Production Deployment (From Authorized Terminal)
```bash
# 1. Verify working directory and environment variables
cd F:\VyaponeV2

# 2. Build OpenNext bundle
pnpm dlx @opennextjs/cloudflare build

# 3. Deploy to existing Cloudflare Worker 'vyapone'
pnpm dlx wrangler deploy --name vyapone
```

### Option B: Cloudflare Workers Builds (Via GitHub Push)
```bash
# 1. Ensure migrations 20261122000001, 20261122000002, 20261122000003 are applied in Supabase
# 2. Push production branch to GitHub:
git push origin main
```

---

## 8. Remaining Blockers & Stop Condition

> [!CAUTION]
> **Production Deployment Status: BLOCKED**
> 
> Deployment cannot proceed until the following conditions are met:
> 1. **Supabase Migration Blocker:** Migrations `20261122000001`, `20261122000002`, and `20261122000003` must be executed against the remote Supabase database to create `site_domains`, `qr_codes`, `rollback_published_site_version_atomic`, and `publish_site_draft_atomic`.
> 2. **Wrangler Entry Point Alignment:** Update `wrangler.jsonc` `main` and `assets.directory` to `.open-next/worker.js` and `.open-next/assets` for OpenNext build targeting.
> 3. **User Authorization Blocker:** Explicit user approval is required before running `git push` or `wrangler deploy`.

### Confirmation of Zero Production Changes:
- **No Git push** was executed (`origin/main` remains untouched at `67f9141`).
- **No Cloudflare Worker deploy** was executed (`https://vyapone.kssharma2022krish.workers.dev/` remains unchanged).
- **No Supabase production database modifications** were performed (read-only introspection only).
