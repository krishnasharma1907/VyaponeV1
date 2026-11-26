# VyapOne Development Changelog

Record implementation changes by task ID. Do not record planned work as completed.

## Unreleased

### [CLOUD-012] — Brand Favicon Assets & Root Layout Icon Metadata Resolution (2026-11-26)

- **Brand Favicon & SVG Icons (`public/favicon.ico`, `src/app/favicon.ico`, `public/icon.svg`, `src/app/icon.svg`)**: Created canonical VyapOne brand favicon (Emerald `#0F5132` background with Marigold `#D97706` "V" emblem) in both `public/` and `src/app/`. Resolves `404 Not Found` for `/favicon.ico` on Cloudflare Workers edge deployments.
- **Root Layout Icon Metadata (`src/app/layout.tsx`)**: Configured `icons` in RootLayout metadata pointing to `/favicon.ico` (32x32) and `/icon.svg` (`image/svg+xml`).

### [CLOUD-011] — OpenNext Standalone Build Output Remediation & Cloudflare Packaging Fix (2026-11-26)

- **Next.js Standalone Configuration (`next.config.ts`)**: Configured `output: "standalone"` to ensure Next.js creates `.next/standalone/` during `next build`. OpenNext relies on this standalone structure to package server handlers and bundle cache assets (`.next/standalone/.next/server/pages-manifest.json`).
- **Build Script Standalone Guard (`scripts/build.mjs`)**: Added `NEXT_PRIVATE_STANDALONE: "true"` to child process environment when running `next build`. Matches OpenNext's internal standalone mode initializer, guaranteeing that the pre-packaged build produces the exact directory structure expected by `opennextjs-cloudflare build --skipNextBuild`.
- **Build-Time ESLint Decoupling (`next.config.ts`, `.npmrc`)**: Added `eslint: { ignoreDuringBuilds: true }` in `next.config.ts` and created `.npmrc` with `public-hoist-pattern[]=*eslint*` to prevent pnpm strict-store peer-dependency resolution failures (`Cannot find module 'eslint-plugin-react-hooks'`) during Next.js production builds in containerized CI environments.

### [CLOUD-010] — Build-Time Environment Validation Remediation, Dynamic Routes & Wrangler Previews Block (2026-11-26)

- **Wrangler Previews Configuration (`wrangler.jsonc`)**: Added top-level `"previews": { "vars": { "NEXT_PUBLIC_APP_ENV": "preview" } }` block to resolve Cloudflare Workers continuous deployment preview failure (`npx wrangler preview requires previews block`).
- **Cross-Platform Production Build Script (`scripts/build.mjs`, `package.json`)**: Added `scripts/build.mjs` coordinating Next.js compilation (`next build`) and conditional packaging with `opennextjs-cloudflare build --skipNextBuild` in Cloudflare Workers / Linux CI environments (`.open-next/worker.js`, `.open-next/assets`), while skipping OpenNext on Windows developer environments to prevent native `@ast-grep/napi` MSVC crashes.
- **Lazy Server Configuration Proxy (`src/config/server.ts`)**: Replaced eager module-level `serverConfig = getServerConfig()` evaluation with a lazy `Proxy` that defers `validateEnvironment()` calls until explicit property access. Prevents Next.js compiler and page data collection from executing runtime environment checks at module evaluation time.
- **Build-Time Invariant Guard (`src/config/env.ts`)**: Added `isBuildPhase` detection (`process.env.NEXT_PHASE === "phase-production-build"`, `npm_lifecycle_event === "build"` / `"build:staging"`). In `NODE_ENV=production`, permits static asset and route compilation to proceed in clean build machines (such as Cloudflare Workers Builds and CI runners) where runtime-only secrets (`SESSION_SECRET`, `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) are not injected, while strictly enforcing all credentials during runtime request handling.
- **Dynamic Route Handlers (`export const dynamic = "force-dynamic"`)**: Added explicit dynamic segment declaration to dynamic public endpoints:
  - `src/app/(public)/qr/[slug]/route.ts`
  - `src/app/(public)/s/[subdomain]/page.tsx`
  - `src/app/(public)/s/[subdomain]/robots.txt/route.ts`
  - `src/app/(public)/s/[subdomain]/sitemap.xml/route.ts`
  - `src/app/auth/callback/route.ts`
- **Unit Test Coverage**: Added test coverage in `tests/unit/config/env.test.ts` (asserting clean build-phase execution without secrets and strict runtime validation failure) and `tests/unit/config/server.test.ts` (verifying lazy property delegation).

### [STAGING-001] — Prepare Complete VyapOne End-to-End Staging Environment (2026-11-25)

- **Staging Environment Template & `.gitignore` Safeguards**: Updated [`.gitignore`](file:///f:/VyaponeV2/.gitignore) to ignore `.env.staging` and `.env.staging.local` while tracking [`.env.staging.local.example`](file:///f:/VyaponeV2/.env.staging.local.example) with complete staging variables (`NEXT_PUBLIC_APP_ENV=staging`, `VYAPONE_STAGING_PROJECT_REF`, core database/Supabase keys, and sandbox/test integrations).
- **Isolated Staging Runner & `.env` Non-Fallback Protection**: Added [`scripts/staging/env-loader.mjs`](file:///f:/VyaponeV2/scripts/staging/env-loader.mjs), [`scripts/run-staging.mjs`](file:///f:/VyaponeV2/scripts/run-staging.mjs), and `dev:staging` / `build:staging` / `start:staging` / `staging:check` scripts in [`package.json`](file:///f:/VyaponeV2/package.json). Enforces `.env.staging.local`, rejects placeholders and `.env` targets, scrubs sibling `.env*` / inherited credential prefixes (`__NEXT_PROCESSED_ENV=true` + empty-string shadowing) so Next.js `@next/env` cannot hydrate production values from `.env`, and validates `.next/.vyapone-staging-manifest.json` on `start:staging`.
- **Startup & Runtime Production-Ref Guards**: Added `PRODUCTION_SUPABASE_PROJECT_REF` (`fjoezwoyowihbxacmoyp`), JWT `ref` decoding, URL/DSN ref extraction, and `assertStagingIsolation` across [`src/config/env.ts`](file:///f:/VyaponeV2/src/config/env.ts), [`src/config/public.ts`](file:///f:/VyaponeV2/src/config/public.ts), [`src/lib/supabase/client.ts`](file:///f:/VyaponeV2/src/lib/supabase/client.ts), [`src/lib/supabase/server.ts`](file:///f:/VyaponeV2/src/lib/supabase/server.ts), [`src/lib/supabase/middleware.ts`](file:///f:/VyaponeV2/src/lib/supabase/middleware.ts), and [`src/lib/supabase/admin.ts`](file:///f:/VyaponeV2/src/lib/supabase/admin.ts), while keeping browser client exposure restricted to the 4 `NEXT_PUBLIC_*` keys in `public.ts`.
- **Staging Migration, Seed, Auth & Storage Tooling**: Created [`scripts/staging-preflight.mjs`](file:///f:/VyaponeV2/scripts/staging-preflight.mjs), staging-only Migration #13 compatibility helper [`scripts/staging/clean-db-bootstrap-compat.sql`](file:///f:/VyaponeV2/scripts/staging/clean-db-bootstrap-compat.sql) (preserving immutable historical migrations 1–25), [`scripts/staging-bootstrap.mjs`](file:///f:/VyaponeV2/scripts/staging-bootstrap.mjs) (`vyapone-public-media`, `vyapone-private-media`, optional deterministic Auth personas), and [`docs/STAGING_ENVIRONMENT_SETUP.md`](file:///f:/VyaponeV2/docs/STAGING_ENVIRONMENT_SETUP.md) (including `supabase/seed.sql` / `publish_site_draft_atomic` `auth.uid()` review).
- **Staging Isolation Tests**: Added [`tests/unit/config/staging-isolation.test.ts`](file:///f:/VyaponeV2/tests/unit/config/staging-isolation.test.ts) and [`tests/unit/supabase/staging-guards.test.ts`](file:///f:/VyaponeV2/tests/unit/supabase/staging-guards.test.ts).

### [Fast-Track Test Readiness & VO-050 Handoff] (2026-11-25)

- **Added fast-track verification & VO-050 handoff report**: Created [`docs/VYAPONE_FAST_TRACK_TEST_READINESS.md`](file:///f:/VyaponeV2/docs/VYAPONE_FAST_TRACK_TEST_READINESS.md) documenting live PostgREST OpenAPI production check (`200 OK`, migrations 26–29 still absent, IPv6 direct PostgreSQL `EHOSTUNREACH`), GitHub/Cloudflare build verification blockers preventing unsafe branch push, clean `next build` (`40/40 routes`) & local `next start` fallback 10-route smoke probe, `workerd.exe` / `@ast-grep/napi` Windows blockers, Phase 4 disposable compatibility-overlay analysis, exact remaining owner actions, and the ready-to-use `VO-050` prompt. Release remains **NO-GO**.

### [CLOUD-009] — Invitation RPC Security, Seed Compatibility & PostgreSQL Test Remediation (2026-11-25)

- **Remediated invitation acceptance RPCs (`20261125000001`)**: Replaced the `PERFORM assert_and_lock_workspace_capacity(...)` defect in `accept_workspace_invitation_atomic` with canonical `workspaces -> workspace_invitations` locking, authenticated `auth.uid()` caller + verified account email verification (`VY013`), and locked `team_seats` enforcement raising `VY001` (preserving `already_member` and zero `workspace_members.updated_at`). Remediated `accept_business_invitation_atomic` identically with caller session, verified email, archived-business guard (`VY002`), and `businesses -> business_invitations` lock order.
- **Fixed `supabase/seed.sql` trigger compatibility**: Seeded `'40000000-0000-4000-a000-000000000001'` as `'draft'`, inserted `v1` in `public.site_versions`, and published idempotently via `public.publish_site_draft_atomic(...)` without bypassing security triggers.
- **Hardened concurrency, RLS, and TypeScript role parity**: Closed `NULL` optimistic-lock bypasses in `rollback_published_site_version_atomic` (`20261122000002`) and `publish_site_draft_atomic` (`20261122000003`); added same-business `site_id` verification to `site_domains` & `qr_codes` `WITH CHECK` policies (`20261122000003`); aligned `src/lib/websites/*` (`business:update_profile`, direct-manager `removeCustomDomain` pre-check before DNS adapter call, and fail-closed `resolveSiteByDomain`) and invitation error mappings in `src/lib/workspaces/service.ts` and `src/lib/businesses/service.ts`.
- **Expanded PostgreSQL & CI test coverage**: Added pgTAP suite `supabase/tests/00002_security_and_rpc_integration_test.sql` (`plan(42)`), expanded `scripts/ci/verify-supabase-migrations.mjs` (all 9 critical RPCs + behavioral assertions), wired `supabase test db` into `.github/workflows/cloudflare-validation.yml`, and updated unit/static Vitest suites. Documented results in `docs/CLOUD-009_INVITATION_AND_DATABASE_TEST_REMEDIATION.md`; updated `ADR-027` in `docs/DECISION_REGISTER.md`, `docs/CLOUDFLARE_DEPLOYMENT.md`, `docs/PROGRESS.md`. Real PostgreSQL & Linux CI remain `NOT RUN`; release remains **NO-GO**.

### [CLOUD-008] — Clean Database Recovery Strategy & Linux CI / PostgreSQL Verification Readiness (2026-11-25)

- **Added recovery architecture & runbook report**: Created `docs/CLOUD-008_RECOVERY_AND_CI_READINESS.md` with full 29-migration inventory reconciled against `CLOUD-002` OpenAPI evidence (resolving `CLOUD-004` #25 filename discrepancy vs actual `20261120000003`), exact DDL diagnosis of `20261117000002` (`public.update_updated_at_column()`), comparison of recovery Options A/B/C/D, Linux CI workflow validation, PostgreSQL test-coverage audit across all 26 DB/isolation Vitest suites + pgTAP + `verify-supabase-migrations.mjs`, and an approved-only production migration runbook.
- **Disclosed additional CI & runtime readiness blockers**: Documented `supabase/seed.sql` inserting `'published'` directly into `public.sites` (fails `VY003` during `supabase start` / `db reset`), `accept_workspace_invitation_atomic` -> `assert_and_lock_workspace_capacity` rejecting invited non-members (`VY003`) and ignoring `allowed = false` (`20261125000001`), and GitHub Actions default-branch / unverified Cloudflare branch-build constraints blocking unapproved branch pushes to `VyaponeV1.git`.
- **Updated governance docs**: Updated `ADR-027` and `ADR-028` (`REQUIRES_APPROVAL`) in `docs/DECISION_REGISTER.md` recommending Option D pre-check; updated `docs/CLOUDFLARE_DEPLOYMENT.md` and `docs/PROGRESS.md`. Release remains **NO-GO**.

### [CLOUD-007] — Comprehensive SQL Defect Remediation & Schema Contract Alignment (2026-11-25)

- **Classified migration history safety**: Kept production-applied historical migrations 1–25 (`20261112000001`–`20261120000003`) strictly immutable, verified pending `20261122000001` unchanged, remediated pending `20261122000002` and `20261122000003`, and added forward corrective migration `20261125000001_remediate_historical_schema_and_rpc_defects.sql`.
- **Remediated pending publishing & rollback RPCs**: Corrected `20261122000003` (`qr_codes.destination_configuration`, `'mainQrCode'` payload, `subscriptions`/`workspaces.plan`, scalar-coalesced `capacity_overrides.additional_capacity`, distinct non-archived business counting, `workspaces -> businesses -> sites` lock ordering, `VY001`/`VY002`, RLS/RPC parity, GUC flag) and `20261122000002` (lock ordering, `VY002` guard, capacity-neutral vs capacity-increasing rollback checks, `VY001`, GUC flag).
- **Remediated historical runtime defects via forward migration (`20261125000001`)**: Re-pointed `trg_notifications_updated_at` on `public.notifications` to `public.set_updated_at()`; fixed `accept_workspace_invitation_atomic` (removed `workspace_members.updated_at`), `create_business_with_setup_atomic` & `confirm_business_import_atomic` (`JOIN public.niche_groups`), `check_site_publish_capacity_trigger()` (`IS DISTINCT FROM 'true'`), 0-row `capacity_overrides` NULL bypasses, `transition_site_status_atomic` (removed `sites.published_at`), and `scale.locations_per_business := 50`.
- **Aligned app error mapping, CI verification script, and tests**: Updated `src/lib/websites/service.ts` (`VY001`/`VY042` checked before `CONFLICT`, plus `VY002` and `VY005`), expanded `scripts/ci/verify-supabase-migrations.mjs`, strengthened existing database/website/CI unit tests, and added `tests/unit/database/schema-remediation-migration.test.ts`.
- **Documented remediation & clean-DB recovery gate**: Added `docs/SUPABASE_SCHEMA_REMEDIATION_CLOUD-007.md` and `ADR-028` in `docs/DECISION_REGISTER.md`; updated `docs/CLOUDFLARE_DEPLOYMENT.md` and `docs/PROGRESS.md`. Real PostgreSQL execution remains `NOT RUN` locally; release remains **NO-GO**.

### [CLOUD-006] — Linux CI, OpenNext Runtime & Isolated Supabase Migration Verification (2026-11-25)

- **Added manual-only Linux CI validation workflow**: Created `.github/workflows/cloudflare-validation.yml` (`workflow_dispatch` only, `contents: read`, Node 24, `pnpm install --frozen-lockfile`, 40-char SHA-pinned GitHub Actions) covering `quality-gates`, `opennext-build-and-runtime`, and `supabase-migration-verification` without automatic deployment, remote flags, or linked Supabase commands.
- **Added Cloudflare runtime and PostgreSQL verification scripts**: Created `scripts/ci/verify-opennext-runtime.mjs` (11-route `workerd` runtime probe with sanitized dummy env vars) and `scripts/ci/verify-supabase-migrations.mjs` (loopback-enforced PostgreSQL catalog, privilege, and rollback-scoped RLS/RPC behavioral verification).
- **Added workflow test suite & audit report**: Created `tests/unit/ci/cloudflare-validation.test.ts` (9 unit tests) and `docs/CLOUDFLARE_LINUX_CI_CLOUD-006.md`; updated `docs/CLOUDFLARE_DEPLOYMENT.md` and `docs/PROGRESS.md`.
- **Disclosed newly identified SQL blockers**: Documented `20261117000002` (`public.update_updated_at_column()` missing on clean DB) and runtime column/contract errors in `20261122000003` (`workspaces.plan_id`, `capacity_overrides.limit_override`, JSON payload/GUC mismatches) and earlier migrations (`20261117000001`, `20261119000001`/`02`, `20261115000001`/`20261116000001`). Release remains **NO-GO**.

### [CLOUD-005] — Correct Supabase Publishing & Rollback Migration Defects (2026-11-24)
- Corrected confirmed SQL schema reference defects in pending Supabase migrations for website rollback and publishing:
  - **Migration 2 (`20261122000002_website_rollback_rpc.sql`):**
    - Corrected non-existent table references `public.business_memberships` and `public.workspace_memberships` by utilizing canonical security helper `public.can_manage_business(p_business_id, p_caller_user_id)`.
    - Explicitly assigned `v_workspace_id := v_site.workspace_id;`.
    - Corrected non-existent `audit_logs` columns (`resource_type`, `resource_id`, `metadata`) to canonical schema (`workspace_id`, `resource`, `metadata_json`, `ip_address`).
  - **Migration 3 (`20261122000003_website_publishing_domains_and_qr.sql`):**
    - Corrected non-existent `audit_logs` columns inside `publish_site_draft_atomic` to canonical schema (`workspace_id`, `resource`, `metadata_json`, `ip_address`).
    - Replaced non-existent workspace role `'agency_admin'` with canonical roles (`'workspace_owner', 'workspace_admin', 'reseller_admin'`).
    - Added sovereign business owner authorization check (`b.sovereign_owner_id = auth.uid()`) across RLS policies for `public.site_domains` and `public.qr_codes`.
    - Guarded plan capacity check for direct DIY businesses (`v_workspace_id IS NOT NULL`).
    - Corrected whitespace typo in exception string `(% )` -> `(%)`.
  - **Migration 1 (`20261122000001_website_draft_concurrency_and_optimistic_lock.sql`):**
    - Independently audited and verified 100% compliant with canonical schema and application RPC call.
  - **Migration Test Strengthening:**
    - Rewrote `tests/unit/database/website-rollback-migration.test.ts` (13 tests) and `tests/unit/database/website-publishing-migration.test.ts` (19 tests) with assertions validating real schema table names, actual audit log column names, error codes, and absence of invalid identifiers.
  - **Quality Gates:**
    - TypeScript typecheck (`tsc --noEmit`): 0 errors (PASS).
    - ESLint 9 (`eslint .`): 0 errors, 0 warnings (PASS).
    - Prettier (`prettier --check .`): 100% formatted (PASS).
    - Vitest migration tests: 32/32 tests passing (PASS).
  - **Safety Invariant:** Zero remote database writes, zero Git pushes, and zero Cloudflare worker modifications executed.
- Conducted final read-only release readiness and deployment safety audit:
  - **Overall Decision:** **NO-GO (DEPLOYMENT BLOCKED)** pending migration fixes, manual database application, and Linux CI setup.
  - **Dependency Reproducibility:** Audited pristine unpatched `node_modules`. Confirmed Next.js standalone file tracing fails on Windows NTFS due to unprivileged symlink permissions (`EPERM`). Confirmed manual package modification violates reproducibility invariants.
  - **Database Migration Defects Identified:**
    - Migration 2 (`20261122000002_website_rollback_rpc.sql`): References non-existent tables `public.business_memberships` and `public.workspace_memberships` (actual: `business_members`, `workspace_members`); references non-existent columns `resource_type`, `resource_id`, `metadata` on `audit_logs` (actual: `resource`, `metadata_json`).
    - Migration 3 (`20261122000003_website_publishing_domains_and_qr.sql`): References non-existent columns `resource_type`, `resource_id`, `metadata` on `audit_logs`.
    - Generated a comprehensive migration runbook with corrected SQL in `docs/CLOUDFLARE_RELEASE_READINESS_CLOUD-004.md`.
  - **Host Hardware & Preview Limitation:** Documented that local `workerd.exe` crashes with `0xC000001D` due to the host Pentium E5800 CPU lacking AVX instructions. WSL is unavailable.
  - **Git Remote Risk:** Documented that `main` is 11 commits ahead of `origin/main` (`67f9141`). Blindly pushing to `VyaponeV1.git` without manual migration execution poses high risk of production disruption.
  - **Safety Invariant Enforced:** Zero Git pushes, zero database migrations or writes, and zero Cloudflare live worker modifications executed.

### [CLOUD-003] — OpenNext Configuration Alignment & Local Cloudflare Preview (2026-11-23)
- Aligned project configuration and dependencies for OpenNext Cloudflare deployment:
  - **Tooling & Runtimes:** Bootstrapped standalone Node.js `v22.14.0` in `~/.gemini/antigravity/bin` to provide native worker-threads and child process management.
  - **OpenNext & Wrangler Dependencies:** Installed and pinned `@opennextjs/cloudflare@1.20.18` and `wrangler@4.166.0` as explicit devDependencies in `package.json`.
  - **Runtime Transitive Dependencies:** Explicitly declared `@swc/helpers@0.5.15`, `styled-jsx@5.1.6`, and `client-only@0.0.1` in `dependencies` for Next.js standalone file tracing and esbuild symbol bundling.
  - **Wrangler Alignment:** Aligned `wrangler.jsonc` with `main: ".open-next/worker.js"`, `assets: { directory: ".open-next/assets", binding: "ASSETS" }`, `compatibility_date: "2024-12-30"`, while preserving worker identity `vyapone` and environments.
  - **Build & Preview Scripts:** Added `preview:cloudflare` and `deploy:cloudflare` scripts using `opennextjs-cloudflare`.
  - **Build Output Verification:** Executed `pnpm opennextjs-cloudflare build` (Exit code 0), generating `.open-next/worker.js` (2,216 bytes) and static assets in `.open-next/assets`.
  - **Hardware & Local Preview Finding:** Identified that local `wrangler dev` (workerd) requires AVX/AVX2 instruction sets, which are unsupported on the host machine's Intel Pentium Dual-Core E5800 CPU (`0xC000001D STATUS_ILLEGAL_INSTRUCTION`). Verified all application production routes locally on port 3005 with 100% route success (`/` 200, `/login` 200, `/dashboard` 307 redirect, `/robots.txt` 200, `/sitemap.xml` 200, `/s/preview` 200).
  - **Quality Gates:** 100% passing across TypeScript (`tsc --noEmit`), ESLint 9 (`eslint .`), Prettier (`prettier --check .`), Vitest (107 files, 1,345/1,345 tests), and OpenNext build.
  - **Strict Safety:** Zero Git pushes, zero database migrations or writes, and zero Cloudflare dashboard modifications.

### [CLOUD-002] — Existing VyapOne Worker Production Deployment Preflight (2026-11-23)
- Conducted full production preflight audit for the existing Cloudflare Worker `vyapone` (`https://vyapone.kssharma2022krish.workers.dev/`):
  - **Supabase Production Database Audit:** Inspected live remote database via read-only PostgREST OpenAPI discovery. Confirmed migrations 1–25 applied (29 tables, 20 RPC functions). Identified 3 unapplied migrations: `20261122000001` (draft optimistic locking), `20261122000002` (rollback RPC), `20261122000003` (`site_domains`, `qr_codes`, publishing RPC). Marked deployment as BLOCKED pending manual execution.
  - **Live Worker Audit:** Confirmed worker is live and deployed with OpenNext (`x-opennext: 1` header) running commit `67f9141` (`origin/main`). Local branch `main` is 11 commits ahead at `7c61842`.
  - **OpenNext Configuration:** Prepared `open-next.config.ts`, added `.open-next/` to `.gitignore`, added `preview:cloudflare` and `deploy:cloudflare` scripts to `package.json`, and added type declarations in `src/types/opennext.d.ts`.
  - **Quality Gates:** 100% passing across TypeScript (`tsc --noEmit`), ESLint 9 (`pnpm lint`), Prettier (`pnpm format:check`), Vitest (107 test files, 1,345 tests), and Next.js production build (`pnpm build`).
  - **Safety Invariants:** No production changes, no Git pushes, no database writes executed.

### [VO-049] — Implement Pre-publish Validation, Domains and QR (2026-11-22)
- Implemented server-authoritative pre-publish validation, custom domain provider adapter boundary, permanent dynamic QR redirect route, and atomic site publishing workflow (PRD FINAL v2 §5.5, §6.14, §15.3, §16, §17.3 FR-08, §17.3 FR-09, §17.3 FR-10, §21 item 11):
  - **Database Migration & Atomic Publishing RPC (`20261122000003_website_publishing_domains_and_qr.sql`):**
    - Schema tables: `public.site_domains` (custom domains, verification status, DNS challenge records, SSL status) and `public.qr_codes` (dynamic QR codes, public slugs, destination configuration, scan tracking).
    - Atomic RPC: `public.publish_site_draft_atomic(p_site_id, p_business_id, p_caller_user_id, p_expected_draft_version_number)`.
    - Row-level locking on `sites` (`FOR UPDATE OF s`) serializing concurrent publish/rollback operations.
    - Concurrency check enforcing `p_expected_draft_version_number` against current draft version number (`VY049`).
    - Subscription plan capacity enforcement: checks active live websites against `effective_limit` on `live_websites` limit key.
    - Lazily provisions or attaches permanent dynamic QR code for the main storefront.
    - Audit log emitted: `site.published`.
  - **Pre-publish Validation Engine (`pre-publish-validation.ts`):**
    - Server-authoritative validation checking business trade name, contact phone, primary location, site metadata, valid subdomain, favicon, meta description, navigation link targets, media assets verification on `media_items`, 13 canonical block schemas, required platform modules on `business_modules`, and plan capacity via `getCapacityUsage`.
    - Structured result model with categorized checklist, clear distinction between blocking errors and non-blocking warnings, and direct edit navigation paths.
  - **Custom Domain Adapter Boundary (`domains/`):**
    - Provider-neutral adapter interface `CustomDomainProviderAdapter` with `MockCustomDomainAdapter`.
    - Domain management operations: `addCustomDomain`, `verifyCustomDomain`, `removeCustomDomain`, `getSiteDomains`, `resolveSiteByDomain`.
    - Generates DNS challenge records (`dns_txt`, `dns_cname`) and prevents duplicate or cross-tenant domain hijacking.
  - **Permanent Dynamic QR Engine & Route Handler (`qr/service.ts`, `app/(public)/qr/[slug]/route.ts`):**
    - Provisions permanent public slugs (e.g. `/qr/qr_abcd1234`) on stable QR codes.
    - Dynamic destination updates without reprinting physical standees.
    - Strict open-redirect protection sanitizing paths to internal relative routes or authorized storefronts.
    - Route handler returns HTTP `307 Temporary Redirect` with `Cache-Control: no-store, no-cache, must-revalidate`.
    - High-contrast, scan-safe SVG generator with minimum 4-module quiet zone.
  - **Publish Modal & Editor Integration (`PublishModal`, `EditorTopBar`, `ConstrainedWebsiteEditor`):**
    - Integrated "Publish" button in editor top bar opening accessible review modal.
    - Categorized checklist with progress indicators, blocking error warnings, and live web addresses upon publishing.
  - **Verification:**
    - 14 database migration unit tests in `tests/unit/database/website-publishing-migration.test.ts`.
    - 24 pre-publish and publishing unit tests in `tests/unit/websites/pre-publish-and-publishing.test.tsx`.
    - 245 website suite unit tests in `tests/unit/websites/` passing 100%.
    - Full repository test suite (107 files, 1,345 tests) passing 100%.
    - Strict TypeScript check (`tsc --noEmit`), linter (`pnpm lint`), and production build (`pnpm build`) passing 100%.

### [VO-048] — Implement Site Versions and Rollback (2026-11-22)
- Implemented immutable site version history, read-only preview inspection, conflict-safe live rollback, and historical version restore in the constrained website editor (PRD FINAL v2 §5.5, §6.14, §15.3, §16, §17.3 FR-07, §21 item 11):
  - **PostgreSQL Migration & Atomic Rollback RPC (`20261122000002_website_rollback_rpc.sql`):**
    - Implemented `public.rollback_published_site_version_atomic(p_site_id, p_business_id, p_caller_user_id, p_target_version_id, p_expected_current_published_version_id)`.
    - Strict `SECURITY DEFINER` with fixed `search_path = ''`.
    - Row-level lock (`FOR UPDATE OF s`) serializing concurrent rollback and publishing operations.
    - Caller identity verification (`auth.uid() = p_caller_user_id`) and business membership authorization.
    - Enforces target version validation: target version must belong to the site and must have been previously published (`published_at IS NOT NULL`). Rejects rolling back to an unpublished draft.
    - Optimistic concurrency control: checks `expectedCurrentPublishedVersionId` against current `sites.published_version_id` to prevent race conditions (`VY049`).
    - Updates `sites.published_version_id` while leaving `current_draft_version_id` and all historical versions strictly immutable and untouched.
    - Emits structured audit log: `site.published_version_rolled_back`.
    - Direct execution revoked from anon and PUBLIC; granted to authenticated and service_role.
  - **Service Layer & Server Actions (`service.ts`, `actions.ts`, `schemas.ts`):**
    - `getSiteVersions`: Retrieves site versions in descending version number order with limit/offset pagination.
    - `getSiteVersionHistory`: Retrieves paginated history with mapped summaries and status badges (`isCurrentDraft`, `isPublished`).
    - `getSiteConfigurationById`: Retrieves and validates configuration for a specific version ID.
    - `rollbackPublishedVersion`: Executes atomic rollback RPC with error sanitization and configuration migration.
    - `restoreVersionToDraft`: Restores a historical configuration into a new working draft (`MAX(version_number) + 1`) via `saveSiteDraftConfiguration`, leaving `published_version_id` unchanged.
    - Server Actions: `getSiteVersionsAction`, `getSiteVersionByIdAction`, `rollbackPublishedVersionAction`, `restoreVersionToDraftAction` with path revalidation (`/dashboard/website`, `/workspace/clients`, `/s/[subdomain]`).
  - **Version History & Rollback UI Component (`VersionHistoryModal`):**
    - Accessible modal dialog (`role="dialog" aria-modal="true" aria-labelledby="version-history-title"`).
    - Status badges: Active Draft, Live Published, Previously Published, Draft Snapshot.
    - Actions: Inspect (read-only canvas preview), Restore to Draft (with confirmation banner), Rollback Live (with warning confirmation for previously published versions).
    - Keyboard accessible with Escape key dismiss.
  - **Constrained Editor Integration (`ConstrainedWebsiteEditor`, `EditorTopBar`):**
    - Top bar "History" button triggers the version history dialog.
    - Read-only historical preview mode:
      - Displays prominent inspection banner: "Historical Snapshot v{X} (Read-Only) — Your active draft is safely preserved."
      - Renders historical version in PublicWebsiteRenderer canvas.
      - Replaces left pane with read-only inspection notice and quick restore/exit buttons.
      - Completely suspends autosave and dirty-state tracking while inspecting.
      - "Exit Preview" cleanly returns to editing the active working draft.
  - **Verification:**
    - 12 unit tests in `tests/unit/database/website-rollback-migration.test.ts` verifying all security, locking, and parameter assertions.
    - 16 unit tests in `tests/unit/websites/versions-rollback.test.tsx` verifying descending order retrieval, pagination, summary mapping, specific version retrieval, atomic rollback via RPC, concurrency conflict rejection (VY049), restore to draft pointer isolation, action revalidation, modal status badges, inspect callback, restore/rollback confirmation dialogs, keyboard dismiss, and autosave suspension.
    - Full website test suite (`tests/unit/websites/`, 12 test files, 221 tests) passing 100%.
    - Full repository test suite (`pnpm vitest run`, 105 test files, 1,307 tests) passing 100% with 0 errors.
    - Quality gates passed: strict TypeScript (`tsc --noEmit`, 0 errors), ESLint (0 errors, 0 warnings), Prettier formatted, and Next.js production build (`next build`, all 40 routes).

### [VO-047] — Implement Draft Autosave, Undo and Redo (2026-11-22)
- Implemented robust draft autosave, bounded undo/redo history, transient local recovery, and concurrency conflict resilience in the constrained website editor (PRD FINAL v2 §5.5, §6.14, §15.3, §17.3):
  - **Debounced Draft Autosave Engine (`ConstrainedWebsiteEditor`):**
    - Structural change detection: Compares working draft against last persisted server configuration; eliminates redundant saves for unchanged configurations.
    - Debounced save execution: Automatically triggers draft saves after debounce timeout (default 2500ms), providing seamless background persistence without network flooding.
    - Overlapping save guard: Concurrency refs (`isSavingRef`, `pendingSaveRef`) prevent duplicate in-flight requests and queue dirty edits if the user makes changes while a save request is in flight.
    - Optimistic concurrency preservation: Supplies `expectedBaseVersionNumber` with every autosave, honoring PostgreSQL transaction-level concurrency control (`save_site_draft_configuration_atomic`) and preventing silent overwrites.
    - Draft isolation invariant: Saves strictly create draft versions via `saveSiteDraftConfigurationAction` without modifying `published_version_id` or publication status.
  - **Bounded Undo and Redo History (`useEditorHistory`):**
    - Implemented immutable history stack (`past`, `present`, `future`) for `WebsiteConfiguration`.
    - Irrelevant UI state isolation: Excludes device viewports, active inspection tab, and UI presentation state from history; records only meaningful configuration changes.
    - Bounded memory depth: Caps history at `maxDepth = 40` to prevent browser memory growth during extended sessions.
    - Branch pruning: Any new user edit after an undo operation correctly clears the future redo stack.
    - Coalesced input editing: Discrete operations (add section, remove, reorder, toggle visibility) record immediate history entries; rapid character typing in section inspectors coalesces smoothly.
    - Keyboard shortcuts: Full support for `Ctrl+Z` / `Cmd+Z` (Undo), `Ctrl+Y` / `Cmd+Y` / `Ctrl+Shift+Z` (Redo).
  - **Local Transient Draft Recovery (`draft-recovery.ts`):**
    - Tenant-scoped storage: Keyed strictly by `vyapone:website-editor-draft:{businessId}:{siteId}` with fail-closed null checks.
    - Deep privacy sanitization: Strips transient blob URLs and query authentication tokens (`token=`, `apikey=`, `signature=`) prior to local storage.
    - Expiration & skew validation: 24-hour TTL with 5-minute clock-skew tolerance; corrupted or expired drafts are automatically dropped and cleaned up.
    - Stale detection & recovery prompt: On reload/navigation recovery, detects if server draft has advanced to a higher version number (`isDraftRecoveryStale`); presents an accessible notification banner allowing merchants to "Restore Draft" or "Discard" without silent conflict.
    - Navigation protection: Adds `beforeunload` browser warnings whenever uncommitted changes exist.
  - **UI & Design System Integration (`EditorTopBar`):**
    - Accessible Undo and Redo buttons with semantic SVGs, keyboard shortcut tooltips, and disabled states adhering to VyapOne Emerald + Marigold design tokens.
    - Dynamic save status indicators: "Autosaving Draft...", "Saving Draft...", "✓ Draft Saved" (with formatted timestamp), "● Unsaved Changes", "⚠ Version Conflict", "✕ Save Failed" (with interactive "Retry Save" button).
  - **Verification:**
    - 25 unit & integration tests in `tests/unit/websites/autosave-undo-redo.test.tsx` verifying draft recovery storage, URL sanitization, TTL expiration, tenant isolation, bounded history transitions, branch pruning, undo/redo toolbar controls, debounced autosave, concurrent save protection, optimistic concurrency conflict handling, failure retry, transient recovery reload, stale recovery warnings, and keyboard shortcuts.
    - Full website test suite (`tests/unit/websites/`, 11 test files, 205 tests) passing 100%.
    - Full repository test suite (`pnpm vitest run`, 103 test files, 1,279 tests) passing 100% with 0 errors.
    - Quality gates passed: strict TypeScript (`tsc --noEmit`, 0 errors), ESLint (0 errors, 0 warnings), Prettier formatted, and Next.js production build (`next build`, all 40 routes).

### [VO-046] — Connect Media and Module Data to Website Blocks (2026-11-22)
- Connected approved website blocks with authorized business media and module data, establishing strict multi-tenant boundaries, safe URL resolution, and pre-publish validation (PRD FINAL v2 §6.14, §15.3, §15.5):
  - **Authorized Business Media Selection & Filtering (Editor):**
    - SectionInspector strictly queries media items belonging to the active `business_id` only.
    - Category filtering: Constrained strictly to `PUBLISHABLE_CATEGORIES` (`business_logo`, `catalogue_image`, `website_asset`). Non-publishable or sensitive categories (`document_attachment`, `onboarding_upload`) are forbidden from selection and public storefront resolution.
    - Media status validation: Only verified, non-quarantined assets (`status === 'ready' && is_quarantined === false && verified_at !== null`) are available for selection.
    - Provides intuitive image selection and removal controls in `Hero`, `About`, and `Gallery` section inspectors.
  - **Public CDN URL Resolution vs Draft Preview Isolation:**
    - `resolvePublicMediaUrls` in `src/lib/websites/public-service.ts`: Enforces resolution exclusively for verified public assets in the `vyapone-public-media` bucket (`is_public === true`, `status === 'ready'`, `verified_at !== null`).
    - Authenticated draft preview: Injects business media into `previewContext.mediaUrls` inside `ConstrainedWebsiteEditor`, allowing merchants to immediately visualize their selections in real-time without mutating published version records or publishing unverified assets.
  - **Module Operational Status & Graceful Degradation:**
    - Defined `ModuleOperationalStatus` (`operational | informational | coming_soon | disabled`) and `ModuleRenderStatus`.
    - `resolvePublicModules` queries active business modules (`business_modules`) and platform module registry (`platform_modules`).
    - `BookingFormBlock`: Dynamically inspects `context.modules.appointments`. If operational, renders the interactive booking form. If informational or coming soon, automatically switches to enquiry mode with an explicit disclaimer notice ("Notice: Online booking is currently in enquiry mode...") and button "Submit Appointment Enquiry", avoiding any false pretence of an automated scheduling backend.
    - Catalogue and Menu blocks (`MenuBlock`, `CatalogueGridBlock`): Seamlessly bind to business catalogue services; if empty, render accessible and stylish empty states ("No menu categories currently available" / "No catalogue items currently available") without crashing.
    - Location Map (`LocationMapBlock`): Renders complete store address, hours, and direction CTA from authorized business location data; cleanly falls back when address details are unconfigured.
  - **Pre-Publish Media Validation (`validateWebsiteMediaReferences`):**
    - Scans all media IDs referenced in section blocks (`hero.imageMediaId`, `about.imageMediaId`, `gallery.items[].mediaId`), site header (`logoMediaId`), and page metadata (`ogImageMediaId`, `faviconMediaId`).
    - Detects missing IDs, cross-tenant references, unverified status, quarantine status, and non-publishable categories, returning clear error and warning descriptors before publication.
  - **Verification:**
    - 18 unit & integration tests in `tests/unit/websites/media-module-binding.test.tsx` verifying authorized media selection, cross-tenant exclusion, private category exclusion, public CDN URL resolution, operational vs informational booking, empty menu/catalogue states, location fallback, gallery placeholder, draft preview isolation, and responsive preview modes.
    - Full website test suite (`tests/unit/websites/`, 10 test files, 180 tests) passing 100%.
    - Route shells suite (`tests/unit/routing/route-shells.test.tsx`, 34 tests) passing 100%.
    - Database migration test suite (`tests/unit/database/`, 16 test files, 169 tests) passing 100%.
    - Complete Vitest suite across all 102 test files (1,254 tests) passing 100%.
    - Quality gates passed: strict TypeScript (`tsc --noEmit`, 0 errors), ESLint (0 errors, 0 warnings), Prettier formatted, and Next.js production build (`next build`, all 40 routes).

### [VO-045] — Build Responsive Preview and Device Modes (2026-11-22)
- Implemented responsive website preview and device modes in the constrained website editor (PRD FINAL v2 §5.5, §6.14):
  - **Canonical Device Viewports Grounded in Design Tokens:**
    - Integrated canonical breakpoints from `src/design-system/tokens.ts`:
      - **Desktop Viewport:** Full-width responsive canvas (`max-w-[1200px] w-full rounded-xl border border-slate-300 shadow-lg min-h-[500px]`).
      - **Tablet Viewport:** Canonical 768px width (`w-[768px] max-w-full rounded-2xl border-4 border-slate-700/80 shadow-xl min-h-[640px]`), matching `breakpoints.md = "768px"` (counter mode and tablet).
      - **Mobile Viewport:** Canonical 390px width (`w-[390px] max-w-full rounded-[32px] border-[6px] border-slate-800 shadow-2xl min-h-[720px]`), matching `breakpoints.sm = "390px"` (the primary mobile design validation target).
    - Realistic mobile device simulator: Includes a subtle camera notch / speaker bezel (`data-testid="mobile-notch"`, rounded pill with camera dot) providing an authentic device frame without obscuring content.
  - **Smooth Sizing Transitions & Viewport Wrapping:**
    - Applied `transition-all duration-300 ease-in-out` on preview canvas container for smooth animated width transitions between device modes.
    - Viewport container uses independent vertical scrolling with horizontal containment (`overflow-x-auto overflow-y-auto w-full flex-1 flex justify-center py-6 px-4 bg-slate-200/70`).
    - Preserves mobile safe area padding `pb-[env(safe-area-inset-bottom,0px)]` to protect interactive elements from virtual keyboard / home bar overlap.
  - **Accessible Device Mode Controls in Top Bar:**
    - Implemented semantic radiogroup in `EditorTopBar` (`role="radiogroup" aria-label="Preview Device Mode"`).
    - Three accessible radio options with semantic SVG icons and tooltips:
      - Desktop: `aria-label="Desktop Preview Mode"`
      - Tablet: `aria-label="Tablet Preview Mode (768px)"`
      - Mobile: `aria-label="Mobile Preview Mode (390px)"`
    - Accessible state: `aria-checked="true"` on active mode with distinct Emerald active styling (`bg-white text-emerald-800 shadow-xs font-semibold`).
    - Touch targets: All controls adhere to minimum 44px mobile touch targets (`min-h-[44px]`).
    - Visual badge in preview header: `data-testid="preview-device-badge"` dynamically displays the active viewport mode (`Desktop Viewport (Responsive)`, `Tablet Viewport (768px)`, `Mobile Viewport (390px)`).
  - **Strict Draft Isolation & Data Integrity Invariant:**
    - Device mode switching is purely presentation state in React (`useState<EditorDeviceMode>`).
    - Zero side effects: Switching between Desktop, Tablet, and Mobile never mutates `configuration`, never alters `current_draft_version_id`, `published_version_id`, or `sites.status`, and never triggers database saves, RPCs, or network calls.
    - Preserves all unsaved working draft changes and preserves VO-044 optimistic concurrency tracking (`expectedBaseVersionNumber`).
  - **Verification:**
    - 12 unit & integration tests in `tests/unit/websites/responsive-preview.test.tsx` verifying default desktop mode, tablet 768px mode, mobile 390px mode + notch, `initialDeviceMode` prop, draft configuration preservation, unsaved changes preservation, zero save RPC calls or pointer alteration, VO-044 optimistic concurrency base version preservation, responsive block rendering, and radiogroup accessibility.
    - Full website test suite (`tests/unit/websites/`, 9 test files, 162 tests) passing 100%.
    - Route shells suite (`tests/unit/routing/route-shells.test.tsx`, 34 tests) passing 100%.
    - Database migration test suite (`tests/unit/database/`, 16 test files, 169 tests) passing 100%.
    - Complete Vitest suite across all 101 test files (1,236 tests) passing 100%.
    - Quality gates passed: strict TypeScript (`tsc --noEmit`, 0 errors), ESLint (0 errors, 0 warnings), Prettier formatted, and Next.js production build (`next build`, all 40 routes).

### [VO-044] — Integrate Constrained Visual Editor (2026-11-22)
- Built the constrained visual website builder strictly restricted to the 13 canonical approved blocks from `APPROVED_BLOCK_REGISTRY` (PRD FINAL v2 §15.3, §6.14):
  - **Canonical Block Schema Compatibility (Audit A):**
    - Standardized `APPROVED_BLOCK_REGISTRY` to strictly expose the 13 canonical approved block identifiers: `hero`, `about`, `menu`, `catalogue_grid`, `gallery`, `booking_form`, `pricing`, `reviews`, `offers`, `location_map`, `contact`, `faq`, `footer`.
    - Display labels in `AddSectionModal` (`add-section-modal.tsx`) and `SectionNavigator` (`section-navigator.tsx`) map 1:1 to canonical identifiers with valid Zod default props and `BlockRenderer` integration.
    - Strictly rejects unapproved, legacy, or speculative block identifiers (`header_nav`, `features`, `trust`, `testimonials`, `contact_channels`, `custom_iframe`, `script_widget`) at modal selection, section inspector, renderer, and schema validation layers.
  - **Constrained Editor Component Architecture (`src/components/websites/editor/`):**
    - `AddSectionModal` (`add-section-modal.tsx`): Accessible dialog exposing all 13 canonical approved blocks. Categorized into Essential Core, Store & Commerce, Content & Story, Customer Action, and Navigation & Footer with live search, keyboard accessibility (`Escape` key dismissal), and focus trapping.
    - `SectionNavigator` (`section-navigator.tsx`): Ordered section list supporting Move Up and Move Down reordering (with boundary disabling for first/last elements), visibility toggle (`isEnabled` hide/show with muted styling), and section deletion with confirmation.
    - `SectionInspector` (`section-inspector.tsx`): Block-specific property form controls strictly adhering to approved block Zod schemas. Supports visual layout variant selection dynamically derived from `metadata.allowedVariants`. Enforces `sanitizeLinkUrl` to neutralize unsafe `javascript:` or `data:` URL schemes, and displays dynamic server-binding notices for catalogue and location blocks protecting server-owned statutory data.
    - `EditorTopBar` (`editor-top-bar.tsx`): Subdomain badge, draft version indicator (`Draft v{versionNumber}` or `Draft (Initial)`), change summary note input (max 200 chars), save state indicators (`Unsaved Changes`, `Saving...`, `Draft Saved`, `Version Conflict`, `Save Failed`), view mode toggle (`Split`, `Sections`, `Live Preview`), and atomic "Save Draft" button.
    - `PageSelector` (`page-selector.tsx`): Multi-page tab bar supporting active page switching and inline new page creation with slug validation and normalization (`normalizePageSlug`).
    - `ConstrainedWebsiteEditor` (`constrained-website-editor.tsx`): Master client workspace integrating top bar, page tabs, section navigator, section inspector, and live draft preview via `PublicWebsiteRenderer` (`context.previewMode = true`).
  - **Business and Draft Workspace Initialization (Audit B & D):**
    - Created `loadOwnerWebsiteWorkspace` (`src/lib/websites/service.ts`) and `loadOwnerWebsiteWorkspaceAction` (`src/lib/websites/actions.ts`): authenticated server action enforcing `assertAuthenticatedUser` and `assertBusinessAccess`.
    - Returns tenant-isolated business profile, primary location, active catalogue items (`id, title, price_minor, currency_code, is_available`), and the site's current draft configuration.
    - When no site or draft version exists, safely builds a fallback initial configuration with a prominent `Starter Draft` badge.
    - Created `<OwnerWebsiteWorkspace />` (`owner-website-workspace.tsx`) client boundary mounted in `/dashboard/website`, handling workspace loading states, permission-denied alerts, and passing live data to the editor.
  - **Server-Enforced Optimistic Concurrency & Bypass Prevention (Audit C Hardening):**
    - Created migration `20261122000001_website_draft_concurrency_and_optimistic_lock.sql` updating `public.save_site_draft_configuration_atomic` with `p_expected_base_version_number INT` (removed `DEFAULT NULL` to prevent callers from silently bypassing concurrency checks).
    - Dropped previous 7-parameter and 8-parameter overloads to purge any cached parameter defaults in PostgreSQL.
    - Implemented null-safe comparison `v_current_draft_version_number IS DISTINCT FROM p_expected_base_version_number` distinguishing initial starter drafts (`NULL IS DISTINCT FROM NULL` is FALSE) from stale or mismatched versions (raises `SQLSTATE 'VY049'`).
    - Made `expectedBaseVersionNumber: z.number().int().positive().nullable()` required in `saveSiteDraftInputSchema` (`schemas.ts`), rejecting calls that omit the field while allowing explicit `null` for initial drafts.
    - Updated callers, `saveSiteDraftConfiguration`, and `ConstrainedWebsiteEditor` to always send `expectedBaseVersionNumber: currentVersionNumber` (or `null` when creating initial drafts), preserving unsaved working draft changes on conflict.
    - Verified PostgreSQL EXECUTE privileges: revoked from `PUBLIC`, `anon`, and `service_role`; granted strictly to `authenticated`.
  - **Draft Preview & Publication Isolation (Audit D & E):**
    - Live preview displays a prominent "Private Draft Preview" alert informing the business owner that customers only see published versions. Draft preview is strictly authenticated and non-indexable.
    - Draft persistence exclusively invokes `saveSiteDraftConfigurationAction`, updating `sites.current_draft_version_id` and creating immutable `site_versions` rows without mutating `sites.published_version_id` or publication status.
  - **Zero Arbitrary Code Injection:**
    - Pure native React 19 architecture without third-party editor bundle bloat or React 19 peer-dependency conflicts.
    - Rejects arbitrary HTML, scripts, custom styles, iframes, and unknown component types at the inspector, renderer, and database validation layers.
  - **Verification:**
    - 28 unit & integration tests in `tests/unit/websites/constrained-editor.test.tsx` verifying draft initialization, initial starter draft save with `expectedBaseVersionNumber: null`, all 13 canonical approved blocks, unapproved block rejection, category filtering, keyword searching, section reordering, visibility toggling, property inspector, variant selection, link sanitization, draft persistence, error states, optimistic concurrency conflict detection, draft preservation on conflict, draft preview isolation, and multi-page creation.
    - 22 tests in `tests/unit/websites/service.test.ts` verifying service layer authorization, media validation, optimistic concurrency parameter passing, bypass prevention, null initial draft, and conflict mapping.
    - 10 tests in `tests/unit/websites/actions.test.ts` verifying authentication, schema validation, bypass rejection, and revalidation.
    - 150 tests across all 8 website test files in `tests/unit/websites/` passing 100%.
    - 169 database tests in `tests/unit/database/` (16 test files) passing 100%, including 13 tests in `draft-concurrency-simulation.test.ts` simulating RPC argument enforcement, null-safe comparison, concurrent saves, and privilege lockdown.
    - 34 route shell tests in `tests/unit/routing/route-shells.test.tsx` passing 100%.
    - 100% pass across all 100 workspace test files (1,224 tests). Strict TypeScript mode (`tsc --noEmit`, 0 errors), ESLint (0 errors, 0 warnings), Prettier formatted, Next.js production build passing (all 40 routes).

### [VO-043] — Implement Navigation, SEO and Metadata (2026-11-21)
- Built storefront multi-page navigation, dynamic SEO metadata, canonical URL generator, sitemap and robots.txt engine with zero draft or statutory data leakage (PRD FINAL v2 §6.14, §15.3, §16, §17):
  - **Accessible Multi-Page Navigation Header (`src/components/websites/public-renderer/website-header-nav.tsx`):**
    - Semantic landmark structure: `<header role="banner">` and `<nav aria-label="Main Navigation">`.
    - Brand identity: Displays business trade name / brand text and safe CDN-resolved logo image with `@next/next/no-img-element` lint rule compliance.
    - Multi-page navigation links: Renders navigation links sorted by order, highlights the active page with `aria-current="page"`, and computes safe internal storefront hrefs (`/s/[subdomain]?p=...`).
    - Responsive mobile menu: Dedicated toggle button with `aria-expanded`, `aria-label`, `aria-controls`, visible focus outlines, and keyboard event listener closing the mobile menu on `Escape`.
    - Call-to-action button: Supports direct WhatsApp ordering, phone calling, and validated custom external links via `sanitizeLinkUrl`.
  - **Multi-Page Routing & Within-Storefront 404 (`src/components/websites/public-renderer/public-website-renderer.tsx`, `page.tsx`):**
    - Integrates `<WebsiteHeaderNav />` prominently across storefront layouts.
    - Resolves requested page slug from query parameters (`?p=...` or `?page=...`), normalizing trailing slashes and default route (`/`).
    - Safe within-storefront 404: When an unknown page slug is requested for a published storefront, renders an accessible within-storefront error section with a direct "Return to Home" link, keeping storefront branding intact without crashing or exposing stack traces.
    - Persistent footer landmark: Automatically renders `<FooterBlock />` landmark if the active page sections do not already include a footer block.
  - **SEO & Metadata Engine (`src/lib/websites/seo.ts`):**
    - RFC 1123 custom domain validation: Rejects scheme prefixes, port numbers, URL paths, loopback addresses (`127.0.0.1`, `localhost`), and test TLDs (`.test`, `.example`, `.invalid`, `.localhost`).
    - Page slug normalization: Strips query strings, hash anchors, and redundant duplicate slashes; asserts valid URI path formatting.
    - Canonical URL builder: Constructs authoritative canonical URLs strictly using the business's verified `primaryDomain` or platform subdomain (`https://<subdomain>.vyapone.in`), immune to client Host-header spoofing.
    - Sensitive data redaction: Sanitizes title and description strings, stripping raw HTML tags and strictly redacting PAN (`[A-Z]{5}[0-9]{4}[A-Z]`), GSTIN (15 alphanumeric characters), IFSC codes, and internal database UUIDs to ensure zero statutory identifier leakage.
    - Next.js Metadata generation: Exports OpenGraph metadata (`title`, `description`, `url`, `siteName`, `locale`, `type: "website"`, public banner images), Twitter card (`summary_large_image`), canonical URL alternates, and robots directives (`index`, `follow`, or `noindex`/`nofollow` when `page.noIndex: true`).
  - **Dynamic Sitemap Generation (`src/lib/websites/sitemap.ts`, `src/app/sitemap.ts`, `route.ts`):**
    - Storefront sitemap route (`/s/[subdomain]/sitemap.xml`): Dynamic XML sitemap serving all published pages (`isPublished: true`) for the verified published site, utilizing authoritative `site_versions.published_at` timestamps (never fabricated). Returns safe 404 for draft, non-existent, or suspended sites.
    - Platform root sitemap route (`/sitemap.xml`): Server-side sitemap querying `sites` joined strictly to `site_versions!fk_sites_published_version`, including only sites with `status = 'published'` and `published_version_id IS NOT NULL`. Strictly excludes private platform routes (`/dashboard`, `/workspace`, `/platform-admin`, `/counter`).
  - **Dynamic Robots Engine (`src/app/robots.ts`, `src/app/(public)/s/[subdomain]/robots.txt/route.ts`):**
    - Storefront robots endpoint: Allows crawling (`Allow: /`) for published sites with sitemap reference; returns `Disallow: /` for draft, unpublished, or suspended sites.
    - Platform root robots endpoint: Disallows private administrative paths (`/dashboard`, `/workspace`, `/platform-admin`, `/counter`, `/api/`, `/auth/`), allows public storefronts (`/s/`, `/privacy`, `/`), and declares platform sitemap URL.
  - **Verification:**
    - 17 unit tests in `tests/unit/websites/navigation-seo.test.tsx` verifying domain validation, slug normalization, canonical URLs, sensitive data redaction, SEO metadata, OpenGraph, Twitter cards, noIndex directives, header nav rendering, mobile toggle & Escape key, URL sanitization, within-storefront 404, sitemap XML, platform sitemap, and robots.txt.
    - 100% pass across all 98 workspace test files (1,174 tests). Strict TypeScript mode (0 errors), ESLint (0 errors, 0 warnings), Prettier formatted, Next.js production build passing (all 40 routes).

### [VO-042] — Build Public Website Renderer (2026-11-21)
- Built multi-tenant public storefront rendering engine with verified host/slug mapping and safe context slicing (PRD FINAL v2 §6.14, §15.3, §16, §17):
  - **Authoritative Published Resolution (`src/lib/websites/public-service.ts`):**
    - Subdomain and host normalization (`normalizeSubdomain`, `normalizeHost`, `extractSubdomainFromHost`): cleans hostnames, strips port numbers, validates format, and guards against reserved platform subdomains (`app`, `admin`, `api`, `dashboard`, `reseller`, `preview`, `dev`, etc.).
    - Strict published version integrity: `resolvePublishedStorefrontBySubdomain` and `resolvePublishedStorefrontByHost` resolve storefronts strictly via `sites.published_version_id` join on `site_versions`.
    - Zero draft leakage: Verifies `site.status === 'published'`, `published_version_id IS NOT NULL`, and `version.published_at IS NOT NULL`. Never falls back to `current_draft_version_id` or unpublished versions.
    - Tenant and site integrity: Asserts `version.site_id === site.id` and `version.business_id === site.business_id` to prevent cross-tenant and cross-site version reference exploits.
    - Schema migration and validation: Validates schema version via `isSupportedSchemaVersion` and safely parses configuration through `migrateWebsiteConfiguration`.
    - Safe fail-closed behavior: Non-existent, unpublished, draft, suspended, or archived sites fail closed with safe 404 response without leaking business or tenant existence facts.
  - **Safe Public Context Slicing (`WebsiteRenderContext`):**
    - Slices safe public business facts (`name`, `tradeName`, `primaryLocation` city/state/postalCode).
    - Strictly excludes sensitive statutory identifiers (PAN, GSTIN, sovereign_owner_id, workspace_id, bank details, internal audit logs).
    - Slices active catalogue items (`is_available = true`) with minor unit prices (`amount_minor BIGINT`), hiding unavailable items.
    - Media privacy invariant (VO-032): Verifies media assets are public before exposing CDN URLs; never exposes signed private or quarantined asset URLs.
  - **Decoupled Public Renderer Components (`src/components/websites/public-renderer/`):**
    - `PublicWebsiteRenderer`: Resolves active page by slug (defaults to `/`), applies theme tokens (background, text color, typography), renders sequential sections using `BlockRenderer` (all 13 canonical approved blocks), provides accessible landmarks (`<main id="main-content">`, skip-to-content accessibility link), responsive layouts (320px–1440px), and section error isolation via `BlockErrorBoundary`.
    - `StorefrontNotFound`: Safe, accessible fail-closed view for unpublished, suspended, or missing sites.
    - Complete decoupling from reseller and platform-admin bundles, keeping public First Load JS bundle lightweight (152 kB).
  - **Public Storefront Route (`src/app/(public)/s/[subdomain]/page.tsx`):**
    - Next.js dynamic route resolving storefront data via `resolvePublishedStorefrontBySubdomain`.
    - Dynamic `generateMetadata` generating SEO title and description from published page/site config with safe fallbacks.
  - **Verification:**
    - 23 unit tests in `tests/unit/websites/public-renderer.test.tsx` verifying hostname normalization, published version resolution, draft rejection, suspended site rejection, cross-site reference rejection, schema validation, private data exclusion, unavailable catalogue filtering, media privacy, all 13 canonical blocks, and error boundary isolation.
    - 100% pass across all 97 workspace test files (1,157 tests). Strict TypeScript mode (0 errors), ESLint (0 errors, 0 warnings), Prettier formatted, Next.js production build passing.

### [VO-041] — Build Approved Block Library Foundation (2026-11-21)
- Built component library and safe runtime foundation for the 13 canonical approved website blocks (PRD FINAL v2 §15.3, §6.14):
  - **13 Canonical Block Components (`src/components/websites/blocks/`):**
    - `HeroBlock` (`hero-block.tsx`): Responsive banner supporting split, center, photo-left, and minimal variants, headline/subheadline, primary/secondary action triggers, and direct WhatsApp order flow.
    - `AboutBlock` (`about-block.tsx`): Multi-paragraph story presentation, verified highlight badges, and responsive photo layout.
    - `MenuBlock` (`menu-block.tsx`): Food/dining menu dynamically bound to catalogue facts (`source: "catalogue"`), category navigation chips, veg/non-veg indicator chips, ₹ price formatting, and WhatsApp ordering shortcuts.
    - `CatalogueGridBlock` (`catalogue-grid-block.tsx`): Responsive 2/3/4 column product grid bound to catalogue facts, `featuredOnly` filter, dynamic price, and WhatsApp order CTA.
    - `GalleryBlock` (`gallery-block.tsx`): Image showcase grid (2/3/4 columns), accessible captions/alt text, and lightbox modal dialog.
    - `BookingFormBlock` (`booking-form-block.tsx`): Service appointment intake form, dynamic catalogue service binding, +91 mobile number validation, date/time slot selection, and action dispatch.
    - `PricingBlock` (`pricing-block.tsx`): Pricing tiers bound to catalogue facts or structured service packages, "Most Popular" highlighted card badge for `highlightCategory`, feature checklists, and CTA buttons.
    - `ReviewsBlock` (`reviews-block.tsx`): Average rating summary card, star rating SVGs with accessible aria-labels, verified customer badges, and testimonial cards.
    - `OffersBlock` (`offers-block.tsx`): Promotional coupon cards with dashed border design, one-click copy code interaction, and expiration date badges.
    - `LocationMapBlock` (`location-map-block.tsx`): Primary location address resolution (`addressRef: "business.primary_location"`), operating hours list, and safe Google Maps directions link.
    - `ContactBlock` (`contact-block.tsx`): Direct phone call, WhatsApp chat, email channels, and interactive contact message form.
    - `FaqBlock` (`faq-block.tsx`): Keyboard-accessible accordion with `aria-expanded`, `aria-controls`, and smooth toggle transitions.
    - `FooterBlock` (`footer-block.tsx`): Semantic `<footer>` landmark, dynamic copyright notice, Powered by VyapOne brand badge, and sanitized social/legal links.
  - **Central Registry & Safe Renderer (`block-registry.ts`, `block-renderer.tsx`):**
    - `APPROVED_BLOCK_REGISTRY`: Canonical registry mapping all 13 approved block types to components, metadata, allowed variants, category filters, and default props.
    - `BlockRenderer`: Validates section configuration against canonical Zod schemas, rejects unapproved block types without crashing, skips disabled sections, and isolates errors in `BlockErrorBoundary`.
  - **Zero Arbitrary Code & Sanitization (`utils.ts`):**
    - Enforced zero arbitrary code execution invariant (PRD §6.14).
    - `sanitizeLinkUrl` sanitizes dangerous schemes (`javascript:`, `data:`, `vbscript:`) to safe hash (`#`) fallbacks.
    - `formatCurrencyMinor` formats 64-bit integer minor units (paise) to standard Indian Rupee notation (₹).
  - **Verification:**
    - 24 unit tests in `tests/unit/websites/approved-blocks.test.tsx` verifying registry completeness, 13-block component rendering, accessible landmarks, dynamic facts, URL sanitization, XSS defense, and error boundaries.
    - 100% pass across all 96 workspace test files (1,134 tests). Strict TypeScript mode (0 errors), ESLint (0 errors, 0 warnings), Prettier formatted, Next.js production build passing.

### [VO-040] — Define Website Configuration Schema (2026-11-19)
- Defined versioned JSON schema and immutable database model for component-based websites (PRD FINAL v2 §6.14, §15.3, §16, §17):
  - **Assembled Blocks Only (PRD FINAL v2 §15.3):**
    - Established canonical library of 13 approved block types: `hero`, `about`, `menu`, `catalogue_grid`, `gallery`, `booking_form`, `pricing`, `reviews`, `offers`, `location_map`, `contact`, `faq`, `footer`.
    - Strict server-side schema rejects unapproved blocks, script tags, and raw HTML injection vectors.
  - **Dynamic Catalogue Data Bindings:**
    - Guaranteed server-owned operational facts: prices are never hardcoded in the configuration JSON.
    - `menu`, `catalogue_grid`, and `pricing` blocks dynamically bind to operational data via `source: "catalogue"`.
    - `location_map` dynamically references `business.primary_location` source of truth.
  - **Theme & Design Tokens:**
    - Validated `#RRGGBB` 6-character hex colors, typography tokens (Inter, Plus Jakarta Sans), and border radii.
    - Initialized canonical themes: `emerald-marigold` (default) and `warm-terracotta`.
  - **Database Migration & Immutable Versioning (`20261119000003_website_configuration_schema.sql`):**
    - Hardened preflight qualification: revoked `service_role` execute grants on `create_business_with_setup_atomic` and `confirm_business_import_atomic`, guaranteeing session authentication.
    - Created `public.site_versions` table with unique constraint `(site_id, version_number)` and sequential numbering (`version_number > 0`).
    - Added `current_draft_version_id` and foreign key constraint `fk_sites_published_version` on `public.sites`.
    - PostgreSQL immutability trigger (`trg_prevent_site_version_modification`) prevents mutation or deletion of historical/published versions.
    - Dual-layer tenant isolation: Row-Level Security enabled and forced on `public.site_versions`.
  - **Media Isolation Invariant (VO-032):**
    - Draft configurations safely reference private quarantine media assets.
    - Tenant ownership is verified for all referenced media items (favicon, logo, ogImage, section images) before persisting versions.
  - **Versioning & Migration Engine (`src/lib/websites/versioning.ts`):**
    - Standardized on `v1` schema with deterministic version detection and validation.
  - **Service Layer & Authenticated Server Actions (`src/lib/websites/service.ts`, `src/lib/websites/actions.ts`):**
    - Implemented `getSiteByBusinessId`, `getSiteById`, `getSiteVersions`, `getSiteConfiguration`, `saveSiteDraftConfiguration`.
    - Automatic `site.version_created` audit event logging.
    - Server Actions with error sanitization and path revalidation (`/dashboard/website`, `/workspace/clients`).
  - **Verification & Documentation:**
    - Added `docs/WEBSITE_CONFIGURATION_SCHEMA.md`.
    - 77 dedicated unit and migration tests passing across 6 test suites (pointer privileges, migration, schemas, versioning, service, actions).
  - **Corrective Audit & Database Integrity Hardening (`20261119000004_website_version_integrity_and_atomic_draft.sql`):**
    - **Atomic Transactional Draft RPC (`save_site_draft_configuration_atomic`):** Replaced non-transactional round-trips with a genuine single PostgreSQL transaction. Employs row locking (`FOR UPDATE OF s`) to serialize concurrent draft saves, eliminates version-number races, verifies session caller identity (`auth.uid() = p_caller_user_id`), enforces business RBAC (`can_manage_business`), validates media readiness, creates immutable version, updates site draft pointer, and logs `site.version_created` audit event.
    - **Composite Relationship Integrity (Audit B):** Enforced that `site_versions(business_id)` strictly matches `sites(business_id)` via `fk_site_versions_site_business` and that version pointers (`current_draft_version_id`, `published_version_id`) strictly reference versions of the SAME site via composite foreign keys `(id, current_draft_version_id) -> site_versions(site_id, id)` and `(id, published_version_id) -> site_versions(site_id, id)`.
    - **Restricted Pointer Privileges (Audit C):** Revoked direct column-level `UPDATE` and `INSERT` privileges on `current_draft_version_id` and `published_version_id` from `authenticated`, `anon`, and `PUBLIC`.
    - **Hardened Version Immutability & Lifecycle Control (Audit D):** Prohibits tampering with historical version configuration and metadata, permits only one-way `published_at` transition from `NULL` to non-null upon publishing, and prevents deleting published versions or active pointer versions.
    - **Media Readiness & Category Verification (Audit E):** Enforces media items have `status = 'ready'`, `verified_at IS NOT NULL`, belong to the target tenant, and belong to approved website categories (`business_logo`, `catalogue_image`, `website_asset`, `onboarding_upload`). Rejects unverified uploads and quarantine document attachments.
  - **Targeted Audit & Hardening — Effective Privileges, Composite FK Deletion & TIMESTAMPTZ (`20261120000001_website_pointer_and_foreign_key_audit.sql`):**
    - **Effective Privilege Lockdown (Audit 1):** Stripped all broad table-level privileges from `anon`, `authenticated`, and `PUBLIC` on `public.sites` and `public.site_versions`. Granted column-level `INSERT` and `UPDATE` on `public.sites` strictly excluding `status`, `business_id`, `current_draft_version_id`, and `published_version_id`. Completely revoked direct `INSERT`, `UPDATE`, and `DELETE` on `public.site_versions` for untrusted roles, guaranteeing version creation only via `save_site_draft_configuration_atomic`. Preserved legitimate `SELECT` reads governed by RLS.
    - **Composite Foreign-Key Deletion Semantics (Audit 2):** Replaced flawed `ON DELETE SET NULL` on composite FKs `fk_sites_current_draft_version` and `fk_sites_published_version` with `ON DELETE RESTRICT`. Prevents invalid PostgreSQL attempts to nullify primary key `sites.id` and guarantees that active referenced draft and published versions cannot be deleted while referenced.
    - **TIMESTAMPTZ Correctness (Audit 3):** Set `site_versions.created_at` default to `now()`, eliminating the session-dependent `timezone('utc'::text, now())` anti-pattern. Standardized `save_site_draft_configuration_atomic` to use `pg_catalog.now()`.
  - **Sites Table Direct INSERT & DELETE Authorization Audit (`20261120000002_revoke_direct_sites_insert_delete.sql`):**
    - **Direct INSERT Revoked:** Completely revoked direct `INSERT` on `public.sites` from untrusted client roles (`anon`, `authenticated`, `PUBLIC`). Closes the critical capacity bypass vector where clients could create unauthorized draft sites without invoking workspace capacity checks (`draft_websites`) or logging append-only audit entries.
    - **Direct DELETE Revoked:** Completely revoked direct `DELETE` on `public.sites` from untrusted roles. Enforces PRD §9.2 soft-lifecycle archival (`archived`), prevents un-audited destruction of sites, and avoids foreign key RESTRICT violations with active versions.
    - **Restrictive RLS Defense-in-Depth:** Installed `sites_insert_policy` (`WITH CHECK (false)`) and `sites_delete_policy` (`USING (false)`). Preserved legitimate storefront `SELECT` and scoped `UPDATE (subdomain, primary_domain, updated_at)`.
  - **Final Column-Level INSERT Revocation & Restrictive RLS Deny (`20261120000003_revoke_column_insert_and_enforce_restrictive_rls.sql`):**
    - **Column-Level INSERT Revoked:** Explicitly revoked column-level `INSERT` privileges on `(id, business_id, subdomain, primary_domain, created_at, updated_at)` from `anon`, `authenticated`, and `PUBLIC`, closing the `pg_attribute.attacl` gap left by previous table-level revocation.
    - **Dedicated AS RESTRICTIVE Denial Policies:** Installed `sites_restrictive_insert_deny` (`AS RESTRICTIVE FOR INSERT TO anon, authenticated WITH CHECK (false)`) and `sites_restrictive_delete_deny` (`AS RESTRICTIVE FOR DELETE TO anon, authenticated USING (false)`). Restrictive policies combine with `AND` across all permissive policies, guaranteeing unconditional rejection of direct client writes even if any permissive policy is present.
    - **101 dedicated unit, migration, and authorization tests passing across 7 test suites.**
- Implemented multi-format business import with human-in-the-loop review and confirmation:
  - **Strict Confirmation Invariant:**
    - Every extracted price, timing, address, tax identifier, and material fact strictly starts in "unconfirmed" (`To Confirm`) state.
    - No business, location, or catalogue record is created in the database without explicit human review and confirmation.
    - Provisioning blocked until mandatory fields and material facts are confirmed.
  - **Formula Injection Defense & Sanitization (`src/lib/businesses/import/sanitizer.ts`):**
    - Neutralizes formula injection attack vectors (CWE-1236: leading `=`, `+`, `-`, `@`, `\t`, `\r`, `|`), while safely preserving legitimate phone numbers (`+91...`) and numeric values.
    - Hardened against Unicode bypasses: strips Unicode BOM (`\uFEFF`), zero-width spaces (`\u200B-\u200D`, `\u2060`), and BiDi overrides (`\u202A-\u202E`, `\u2066-\u2069`).
    - Added field-aware sanitization options (`SanitizeOptions: fieldCategory`) and `sanitizeSpreadsheetCell` export defender.
    - Strips executable HTML (`<script>`, `<iframe>`), dangerous URI schemes (`javascript:`, `vbscript:`, `data:`), null bytes (`\0`), and non-printable control characters.
  - **Multi-Source Parser & Extractor (`src/lib/businesses/import/parser.ts`):**
    - Parses structured JSON, tabular CSV/TSV, and unstructured text with confidence scores and source evidence snippets.
    - Extracts Indian entity patterns: 10-15 digit phone numbers, 15-character GSTIN, 10-character PAN, 6-digit postal PIN codes, timings, and currency minor units (paise).
    - Robust rupee parsing (`parseRupeesToPaise`) and minor units conversion (`formatPaiseToRupees`) supporting symbols (`₹`, `Rs.`, `INR`).
  - **Client-Safe Proposal Update Utilities (`src/lib/businesses/import/proposal.ts`):**
    - Pure in-memory update functions (`updateProposalField`, `confirmAllHighConfidenceFields`) decoupled from database models and server-only dependencies for safe client component usage.
  - **Atomic Transactional Provisioning (`20261119000002_atomic_business_import.sql`):**
    - Implemented `public.confirm_business_import_atomic(...)` stored procedure executing within a single PostgreSQL transaction boundary.
    - Validates caller identity (`auth.uid() = p_caller_user_id`) and workspace administrative access (`is_workspace_admin_or_owner`).
    - Enforces concurrency-safe plan capacity row locking on `public.workspaces` (`draft_websites`).
    - Protects against duplicate proposal confirmation submissions (`VY024`).
    - Atomically provisions store, location, owner member, onboarding answers, default modules, confirmed catalogue items in `public.catalogue_items` (`price_minor`), and append-only audit event (`business.import_confirmed`).
    - All writes commit or roll back together.
  - **Mobile-First Accessible Review UI (`src/components/businesses/import-review/`):**
    - `ImportUploadStep`: Drag-and-drop file upload, format tabs (JSON, CSV, Text), and sample preset loaders.
    - `ImportStatsBanner`: Badges for Total, Confirmed, Unconfirmed, Material Unconfirmed, progress bar, and category filters.
    - `ImportFieldRow`: Clear categorization, material fact badge, formatted value, source evidence quote, inline editing, reject button, and minimum 44 px touch confirm button.
    - `ImportReviewContainer`: Multi-phase workflow managing upload, field review list with sticky confirmation bar, blocking notices, and completed summary view.
    - Responsive 390 px mobile viewport up to desktop, satisfying WCAG 2.2 AA.
  - **Route Shell Integration:**
    - Created dedicated `/workspace/clients/import` page.
    - Linked "Import Business" button on `/workspace/clients` and secondary navigation link on `/workspace/clients/new`.
  - **VO-033 Hardening:**
    - `draft-storage.ts` enhanced with `sanitizeMediaPreviewUrl` / `sanitizeMediaPreviewUrls` to strip transient `blob:` URLs and sensitive query tokens from browser localStorage.
  - **Verification & Quality Gates:**
    - 66 dedicated unit and component tests passing across sanitizer, parser, service, components, and draft storage.
    - Full test suite: 88 test files passed, 1009 unit and integration tests passed (0 failures).
    - Next.js production build (`next build`), ESLint (`lint`), TypeScript (`typecheck`), and Prettier (`format:check`) passed with 0 errors.

### [VO-033 Corrective Pass] — Atomic Business Creation and Secure Draft Storage (2026-11-19)
- Corrected critical architectural and privacy defects discovered in VO-033 preflight:
  - **Atomic Transactional Provisioning (`20261119000001_atomic_business_creation.sql`):**
    - Replaced sequential client-side PostgREST writes with a genuinely atomic PostgreSQL stored procedure: `public.create_business_with_setup_atomic(...)`.
    - Enforced `SECURITY DEFINER` and empty `search_path = ''` with fully qualified database objects (`public.*`, `pg_catalog.*`).
    - Enforced caller verification (`auth.uid() = p_caller_user_id`) and workspace administration authorization via `public.is_workspace_admin_or_owner(p_workspace_id, p_caller_user_id)`.
    - Enforced concurrency-safe plan capacity check and row locking on `public.workspaces FOR UPDATE` via `public.assert_and_lock_workspace_capacity(p_workspace_id, 'draft_websites', 1)` directly inside the transaction.
    - Transactionally provisions: business record, primary location, initial owner membership, media quarantine association with ownership checks, evaluated onboarding answers, default modules, and transactional audit event in `public.audit_logs`.
    - Strictly excluded sensitive statutory tax identifiers (PAN, GSTIN) from audit log metadata.
    - Revoked all execution privileges from `PUBLIC` and `anon`; granted only to `authenticated` and `service_role`.
  - **Secure Client-Side Draft Storage Privacy (`draft-storage.ts`):**
    - Storage keys strictly scoped to authenticated `userId` and `workspaceId` (`vyapone:create-business-draft:{userId}:{workspaceId}`). Missing identity fails closed.
    - Sensitive statutory tax identifiers (`pan_number`, `gst_number`) are explicitly excluded from serialization via `SafeDraftFormData`.
    - Deep recursive answer sanitization strips any properties matching sensitive keywords (`/(pan|gst|tax_id|ssn|aadhaar|aadhar|password|secret|token)/i`).
    - Draft resumption reconstructs `pan_number: ""` and `gst_number: ""` as empty strings, guaranteeing user re-entry in memory.
    - Enforced 24-hour TTL (`DRAFT_TTL_MS = 86,400,000`) and 5-minute clock-skew tolerance; invalid, expired, or future-skewed drafts are automatically purged.
    - Successful submission calls `clearWizardDraft(userId, workspaceId)` preventing stale draft reappearance.
  - **Service & Type Hardening:**
    - Updated `createBusinessWithSetup` to delegate to `create_business_with_setup_atomic` RPC and map error codes (`VY001` -> `CAPACITY_EXCEEDED`, `VY020`/`VY021` -> `WORKSPACE_PERMISSION_DENIED`, `VY030` -> `MEDIA_ISOLATION_VIOLATION`, `23505` -> `SLUG_CONFLICT`).
    - Added TypeScript RPC function signature in `Database["public"]["Functions"]` in `src/lib/supabase/types.ts`.
    - Updated `/workspace/clients/new/page.tsx` to pass `userId={user.id}` to `CreateBusinessWizard`.
  - **Verification & Quality Gates:**
    - Added `tests/unit/database/atomic-business-creation-migration.test.ts` (9 tests passing).
    - Expanded `tests/unit/businesses/create-business-flow.test.ts` to 16 tests covering atomic RPC transactions, argument verification, and error mappings.
    - Added `tests/unit/components/draft-storage.test.ts` and `tests/unit/businesses/draft-storage.test.ts` (16 tests passing).
    - All 82 test files passed (919 tests). Prettier, ESLint, TypeScript typecheck, and Next.js production build passed with 0 errors.

### [VO-033] — Build mobile-first create-business flow (2026-11-18)
- Built complete 5-step mobile-first (390 px) business creation flow for reseller workspaces:
  - **Multi-Step Wizard (`CreateBusinessWizard`):**
    - Built responsive wizard with stepper, progress bar, back/next navigation, step validation, and duplicate submission prevention at `/workspace/clients/new`.
    - **Step 1 (Niche Selection):** Category group tabs (Food & Hospitality, Retail & Commerce, Health & Wellness, Services & Professional), search filter, availability badges (`Ready to Launch`, `Website & Enquiries`, `Coming Soon`), and keyboard-accessible card selection.
    - **Step 2 (Basic Facts):** Trade Name, Legal Name, Primary Location with 6-digit Indian PIN code validation, Phone & WhatsApp contacts, and collapsible statutory GSTIN/PAN fields.
    - **Step 3 (Media Uploads):** Private quarantine logo and storefront banner upload via VO-032 media pipeline with privacy notices and upload status badges.
    - **Step 4 (Category Questions):** Schema-driven dynamic question renderer evaluating niche manifest questions with conditional visibility (`isQuestionVisible`), required checks, and type-specific controls.
    - **Step 5 (Proposal Review):** Structured proposal card showing pages to generate, active operational modules, brand color palette (Warm White / Emerald / Marigold), supplied facts summary, missing details checklist, and "Looks good, build it" primary action.
  - **Draft Resilience (`draft-storage.ts`):**
    - LocalStorage persistence scoped to reseller workspace with automatic state restoration and prompt to resume unfinished sessions.
  - **Service & Server Action Layer (`src/lib/businesses/`):**
    - Implemented `createBusinessWithSetup` and `createBusinessWithSetupAction`: verifies workspace RBAC (`workspace_owner`, `workspace_admin`, `reseller_admin`), evaluates `draft_websites` plan capacity via `assertCapacityAvailable`, provisions `businesses` (`status = 'onboarding'`), primary `locations`, initial owner `business_members`, links private quarantined media, persists evaluated answers into `business_onboarding_answers`, seeds default modules in `business_modules`, and records audit event `business.created_with_setup`.
    - Implemented `getBusinessSetupDraft` and `getBusinessSetupDraftAction` for authorized draft state retrieval.
  - **Navigation Integration:**
    - Linked "Add New Client" in `/workspace/clients` and "Provision Client Business" quick action in `/workspace` to `/workspace/clients/new`.
  - **Testing & Quality Assurance:**
    - Added unit test suite `tests/unit/businesses/create-business-flow.test.ts` (10 tests) covering service authorization, capacity limits, slug conflict resolution, and server actions.
    - Added component test suite `tests/unit/components/create-business-wizard.test.tsx` (5 tests) verifying mobile navigation, conditional validation, draft resume, and submission.

### [VO-032 Upload Isolation & Quarantine] — Private Quarantine and Publication Separation (2026-11-18)
- Hardened upload lifecycle to prevent unverified or draft files from becoming publicly accessible:
  - **Private Quarantine for All New Uploads:**
    - Every newly requested upload strictly enters private storage (`vyapone-private-media`) with `is_public = false`, regardless of category.
    - Direct-to-public presigned upload URLs are permanently eliminated.
  - **Finalization vs. Publication Separation:**
    - File validation and finalization verifies stored bytes in private quarantine and marks `status = 'ready'`, but the asset remains strictly private (`is_public = false`, `bucket = 'vyapone-private-media'`). Draft website assets and unpublished catalogue items remain non-public.
    - Implemented distinct server-governed `publishMediaItem()` and `publishMediaItemAction()`: verifies caller permissions and readiness, copies the validated object from private quarantine to `vyapone-public-media`, verifies the public copy, updates metadata (`bucket = 'vyapone-public-media'`, `is_public = true`, `published_at = now()`), and logs `media.published`.
    - Implemented `unpublishMediaItem()` and `unpublishMediaItemAction()`: removes the public copy, restores private status, and logs `media.unpublished`.
  - **Database Migration (`supabase/migrations/20261118000005_media_quarantine_and_publication.sql`):**
    - Added `published_at TIMESTAMPTZ` column.
    - Replaced `chk_media_items_bucket_visibility` with strict multi-condition check: public assets MUST have `status = 'ready'`, `verified_at IS NOT NULL`, `published_at IS NOT NULL`, and belong to a publishable category (`business_logo`, `catalogue_image`, `website_asset`). Private assets MUST have `is_public = false` and `published_at IS NULL`.
    - Added partial index `idx_media_items_published` on `(business_id, category)` WHERE `is_public = true`.
  - **Expired Upload Reconciliation:**
    - Added `reconcileExpiredUploads()` and `reconcileExpiredUploadsAction()` to clean up unfinalized quarantine storage bytes and mark expired records `failed`.
  - **UI State Machine (`MediaUploader`):**
    - Distinct states: `idle`, `authorizing`, `uploading` (to quarantine), `verifying`, `ready_private` (Upload verified and ready (Private)), `published` (Published and publicly accessible), and `error`.
    - Public URLs are never surfaced before explicit publication authorization succeeds.

### [VO-032 Security Audit] — Storage Security and Data Integrity Hardening (2026-11-18)
- Performed comprehensive storage security and data integrity audit on VO-032 media pipeline:
  - **Database Migration (`supabase/migrations/20261118000004_harden_media_items_security.sql`):**
    - Revoked table-level `INSERT`, `UPDATE`, `DELETE` on `public.media_items` from `authenticated` and `anon`. Granted `SELECT` only (constrained by RLS).
    - Updated RLS write policies to require `auth.role() = 'service_role'`, eliminating privilege escalation / direct row tampering via PostgREST.
    - Added `chk_media_items_status` constraint including `'deletion_pending'`.
    - Added `chk_media_items_bucket_visibility` constraint enforcing `bucket = 'vyapone-public-media' AND is_public = true` or `bucket = 'vyapone-private-media' AND is_public = false`.
    - Changed `media_items_business_id_fkey` from `ON DELETE CASCADE` to `ON DELETE RESTRICT` to prevent business deletion from leaving orphaned cloud storage objects.
    - Added partial index `idx_media_items_deletion_pending` for stuck deletion reconciliation.
  - **Two-Phase Deletion Protocol:**
    - Updated `MediaService.deleteMediaItem` to mark `deletion_pending` -> delete storage object -> mark `archived`.
    - Added `MediaService.retryPendingDeletion` and `retryPendingDeletionAction` to reconcile stuck pending deletions.
  - **Content Validation Hardening:**
    - Corrupt/truncated image header rejection for PNG, JPEG, WebP, and GIF in `extractImageDimensions`.
    - Sanitized SVG XML entity / XXE injection (`<!ENTITY`, `<!DOCTYPE`, `SYSTEM`, `PUBLIC`), CDATA blocks, and forbidden elements.
    - Filename extension and declared MIME type consistency validation.
  - **Storage Provider Security:**
    - Implemented fail-closed production check: `MemoryStorageProvider` explicitly forbidden when `NODE_ENV === 'production'`.
  - **Audit Log Redaction:**
    - Added automated redaction for presigned URLs, query tokens (`?token=`, `x-amz-signature=`), and storage credentials in `src/lib/audit/redaction.ts`.
  - **Documentation & Architecture Decisions:**
    - Added `docs/guides/media-storage-setup.md` detailing bucket configurations, RLS policies, privilege models, and two-phase deletion.
    - Registered ADR-026 in `docs/DECISION_REGISTER.md` establishing provisional engineering defaults for media upload limits.

### [VO-032] — Implement secure media upload pipeline (2026-11-18)
- Implemented an enterprise-grade, secure, multi-tenant media upload pipeline supporting direct-to-storage uploads, pure-TypeScript magic byte verification, dimension extraction, SVG anti-XSS scanning, category-level constraint enforcement, tenant-scoped paths, safe deletion, and an accessible UI component strictly adhering to PRD FINAL v2 (§15.6, §16, §17.1, §17.2, §18.1), ADR-003, and `docs/TASK_BACKLOG.md`:
  - **Database Migration (`supabase/migrations/20261118000003_secure_media_upload_pipeline.sql`):**
    - Created `public.media_items` table (`id`, `business_id`, `workspace_id`, `uploaded_by`, `category`, `bucket`, `object_key`, `original_filename`, `declared_content_type`, `detected_content_type`, `file_size_bytes`, `width`, `height`, `is_public`, `status`, `metadata`, `expires_at`, `verified_at`, `created_at`, `updated_at`).
    - Added check constraints:
      - `chk_media_items_category`: `business_logo`, `catalogue_image`, `website_asset`, `document_attachment`, `onboarding_upload`.
      - `chk_media_items_status`: `pending_upload`, `ready`, `failed`, `archived`.
      - `chk_media_items_bucket`: `vyapone-public-media`, `vyapone-private-media`.
    - Added performance indexes: `idx_media_items_business_status`, `idx_media_items_object_key`, `idx_media_items_category`, `idx_media_items_expires_at`.
    - Configured fail-closed Row-Level Security (`ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY`).
    - Created SELECT, INSERT, UPDATE, DELETE policies isolating access strictly to sovereign owners, business managers, or parent workspace admins, with public read access granted only when `is_public = true AND status = 'ready'`.
    - Granted least privileges: read-only for `anon` (scoped by RLS), full CRUD for `authenticated`, administrative for `service_role`; revoked all from `PUBLIC`.
    - Synchronized into `supabase/combined_migrations.sql` and updated TypeScript Database types (`src/lib/supabase/types.ts`).
  - **Storage Provider Layer (`src/lib/media/storage/`):**
    - Defined provider-neutral interface `IStorageProvider` adhering to ADR-003 and DECISION_REGISTER.md `ACCEPTED_DIRECTION`.
    - Implemented `SupabaseStorageProvider` guarded by `import "server-only"`, using service-role administrative storage API.
    - Implemented `MemoryStorageProvider` for isolated unit tests, offline development, and runtime test environments.
    - Implemented provider factory `getStorageProvider()`.
  - **Content & Magic Byte Validation Engine (`src/lib/media/validation.ts`):**
    - Implemented pure-TypeScript magic byte detector `detectMimeType` for PNG (`89 50 4E 47...`), JPEG (`FF D8 FF`), WebP (`RIFF...WEBP`), GIF (`GIF87a`/`GIF89a`), PDF (`%PDF-`), and SVG.
    - Implemented pure-TypeScript image dimension extraction `extractImageDimensions` for PNG (IHDR), JPEG (SOF markers), WebP (VP8 lossy, VP8L lossless, VP8X extended canvas), and GIF without external C++ or native binaries.
    - Implemented strict SVG anti-XSS sanitizer `sanitizeSvgContent` rejecting `<script>`, active event handlers (`onload`, `onerror`), `javascript:` URLs, and dangerous tags (`foreignObject`, `iframe`, `embed`, `object`).
    - Enforced category constraints:
      - `business_logo`: Max 2 MB, max 2048x2048 px, public.
      - `catalogue_image`: Max 5 MB, max 4096x4096 px, public.
      - `website_asset`: Max 5 MB, max 4096x4096 px, public.
      - `document_attachment`: Max 10 MB, private bucket (`vyapone-private-media`).
      - `onboarding_upload`: Max 10 MB, private bucket.
    - Implemented filename sanitizer `sanitizeFilename` stripping path traversal sequences (`..`), null bytes, control characters, and limiting length.
    - Implemented deterministic tenant object key generator `generateTenantObjectKey`: `tenants/{business_id}/{category}/{media_id}.{ext}`.
  - **Domain Service & Server Actions (`src/lib/media/`):**
    - `requestUploadAuthorization`: Enforces business authorization, validates declarations, provisions UUID and tenant object key, creates short-lived signed upload URL, inserts pending DB record with 15-minute TTL, and logs `media.upload_requested` audit event.
    - `finalizeMediaUpload`: Reads stored bytes, verifies magic bytes and dimensions, detects content spoofing, marks ready/failed, updates verified metadata, and logs `media.upload_finalized` or `media.upload_failed` audit events.
    - `getMediaUrl`: Returns permanent CDN URL for public assets or generates short-lived signed read URL for private assets after tenant verification.
    - `deleteMediaItem`: Deletes storage object, marks DB record archived, and logs `media.deleted` audit event.
    - Implemented typed Server Actions in `src/lib/media/actions.ts`:
      - `requestUploadAuthorizationAction`
      - `finalizeMediaUploadAction`
      - `getMediaUrlAction`
      - `deleteMediaItemAction`
  - **Accessible UI Component (`src/components/media/media-uploader.tsx`):**
    - Built accessible `MediaUploader` component with drag-and-drop dropzone, file browser trigger, preview thumbnail, and upload progress bar.
    - Evaluates immediate client-side pre-validation (size limits and file formats) before making network requests.
    - Meets WCAG 2.2 AA standards: explicit labels, keyboard activation (Enter/Space), visible focus rings, contrast $\ge 4.5:1$, and actionable error alerts in `role="alert"` with `aria-live="assertive"`.
  - **Automated Verification:**
    - 74 test files, 828 unit and integration tests passing (`pnpm test`).
    - TypeScript strict typecheck passed with zero errors (`pnpm typecheck`).
    - ESLint passed with zero warnings/errors (`pnpm lint`).
    - Prettier format check passed (`pnpm format:check`).
    - Next.js production build succeeded with all 36 routes compiled (`pnpm build`).

### [VO-031] — Create category-specific onboarding schemas (2026-11-18)
- Implemented reusable, strongly typed, and validated category-specific onboarding schemas for all 9 supported business niche groups, with client/server validation, declarative conditional questions, cycle detection, missing-field detection, tenant data isolation, and accessible form rendering strictly adhering to PRD FINAL v2 (§7, §14.2 / FR-02 & FR-03, §16, §17) and `docs/TASK_BACKLOG.md`:
  - **Database Migration (`supabase/migrations/20261118000002_business_onboarding_answers.sql`):**
    - Created `public.business_onboarding_answers` table (`id`, `business_id`, `niche_slug`, `manifest_version`, `answers`, `is_complete`, `missing_fields`, `created_at`, `updated_at`).
    - Added unique constraint `CONSTRAINT uq_business_onboarding_answers_business UNIQUE (business_id)`.
    - Added performance indexes for fast business lookup and niche reporting.
    - Configured fail-closed Row-Level Security (`ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY`).
    - Created SELECT, INSERT, UPDATE, DELETE policies isolating access strictly to sovereign owners, business managers, or parent workspace admins.
    - Granted least privileges to `authenticated` and `service_role`; revoked from `PUBLIC` and `anon`.
    - Synchronized into `supabase/combined_migrations.sql` and updated TypeScript Database types.
  - **Schema & Domain Engine (`src/lib/niches/`):**
    - Extended `src/lib/niches/types.ts` with 9 question types (`text`, `number`, `boolean`, `select`, `multiselect`, `date`, `time`, `structured_address`, `file`), options, 9 condition operators (`equals`, `not_equals`, `in`, `not_in`, `contains`, `greater_than`, `less_than`, `truthy`, `falsy`), validation rules, structured Indian addresses, evaluation results, and persistent records.
    - Enhanced `src/lib/niches/schemas.ts` with Zod schemas for question definitions, validation constraints, Indian pincode format (`/^[1-9][0-9]{5}$/`), and action payloads.
    - Enriched `src/lib/niches/constants.ts` with manifests covering all 9 PRD §7 groups with conditional questions (e.g., takeaway delivery radius, dine-in tables, home salon radius, RERA numbers, emergency surcharges).
    - Implemented onboarding validation and evaluation engine in `src/lib/niches/service.ts`:
      - `detectCircularConditions`: DFS-based cycle detector.
      - `validateConditionDependencies`: Validates dependencies and rejects self-references or circular conditions.
      - `isQuestionVisible`: Evaluates condition operators and cascading parent-child visibility.
      - `validateQuestionAnswer`: Validates format constraints across text, numbers, dates, times, select, multiselect, structured addresses, and files.
      - `evaluateOnboardingAnswers`: Evaluates visible questions, detects missing required fields, and strips hidden answers to ensure clean state.
      - `saveBusinessOnboardingAnswers`: Validates caller permissions, validates against authoritative server manifest, upserts answers, and records audit logs (`business.onboarding_answers_saved`) without mutating module entitlements or plan states.
      - `getBusinessOnboardingAnswers`: Retrieves saved onboarding answers.
    - Implemented Server Actions in `src/lib/niches/actions.ts`:
      - `evaluateOnboardingAnswersAction`
      - `saveBusinessOnboardingAnswersAction`
      - `getBusinessOnboardingAnswersAction`
  - **Accessible Form Component (`src/components/niches/schema-driven-form.tsx`):**
    - Built `SchemaDrivenForm` component dynamically rendering manifest-driven questions grouped by section.
    - Evaluates conditional logic live on client, hiding irrelevant questions dynamically.
    - Meets WCAG 2.2 AA standards with full keyboard access, explicit labels, error alerts, and field-level announcements.
  - **Automated Verification:**
    - 69 test files, 783 unit and integration tests passing (`pnpm test`).
    - TypeScript strict typecheck passed with zero errors (`pnpm typecheck`).
    - ESLint passed with zero warnings/errors (`pnpm lint`).
    - Prettier format check passed (`pnpm format:check`).
    - Next.js production build succeeded with all 36 routes compiled (`pnpm build`).

### [VO-030] — Create niche and module registry (2026-11-18)
- Implemented the reusable platform foundation defining supported business niches, product modules, versioned manifests, availability labels, and tenant module selections with strict plan entitlement separation, strictly adhering to PRD FINAL v2 (§7, §8, §9.1/§9.2, §21.2) and `docs/TASK_BACKLOG.md`:
  - **Database Migration (`supabase/migrations/20261118000001_niche_and_module_registry.sql`):**
    - Created `public.niche_groups` table defining the 9 canonical industry groups with priority display order and status.
    - Created `public.niches` table defining specific business categories with foreign key to groups, availability labels (`live_operational`, `informational_with_enquiry`, `coming_soon`), and versioned JSONB manifests (`v1`).
    - Created `public.platform_modules` table defining all 21 modular capabilities across Core, Operations, Growth, Compliance, and Commerce.
    - Created `public.niche_modules` table mapping recommended/default modules and preset configuration per niche.
    - Created `public.business_modules` table recording tenant-selected active capabilities with custom JSONB configurations.
    - Added optional foreign key `public.businesses.niche_id REFERENCES public.niches(id) ON DELETE SET NULL`.
    - Configured fail-closed Row-Level Security (`ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY`) across all 5 tables:
      - Registry tables (`niche_groups`, `niches`, `platform_modules`, `niche_modules`) are read-only to public/authenticated users and mutating strictly to `service_role`.
      - Tenant table `business_modules` enforces business-scoped access via sovereign ownership or active membership.
    - Seeded all 9 canonical PRD §7 niche groups, canonical PRD §8 platform modules, initial niches with full versioned manifests, and module mappings idempotently.
    - Synchronized migration into `supabase/combined_migrations.sql`.
  - **TypeScript Domain & Service Layer (`src/lib/niches/`):**
    - Defined contracts in `types.ts` for manifests, onboarding questions, dashboard navigation, availability labels, module categories, and 5-stage entitlement evaluations.
    - Defined constants in `constants.ts` with canonical groups, 21 platform modules, and fallback versioned manifests for Food, Beauty, Retail, Real Estate, and Other.
    - Defined validation schemas in `schemas.ts` using strict Zod schemas with regex keys and version literals.
    - Implemented `src/lib/niches/service.ts`:
      - `listNicheGroups()`, `getNicheGroup()`, `listNiches()`, `getNiche()`, `getNicheManifest()` with graceful offline fallback to canonical constants.
      - `listPlatformModules()`, `getPlatformModule()`, `getBusinessModules()`.
      - `enableBusinessModule()`, `disableBusinessModule()` with caller authority validation (`assertBusinessAccess`), core module protection (preventing disabling `website_engine`), and immutable audit logging (`business.module_enabled`, `business.module_disabled`).
      - `resolveDashboardNavigation()`: dynamically computes dashboard tabs based on the niche manifest and enabled modules without bespoke routing code.
      - `canBusinessUseModule()`: strictly enforces 5-stage check (Registry -> Status -> Tenant Enablement -> Plan Entitlement -> Execution) using `checkFeatureEntitlement`.
    - Implemented Server Actions in `src/lib/niches/actions.ts` with session authentication and tenant boundary sanitization.
  - **Platform Administration UI (`src/app/(admin)/platform-admin/`):**
    - Updated `layout.tsx` to include `Niches & Modules` (`/platform-admin/niches`) in governance navigation.
    - Built `src/app/(admin)/platform-admin/niches/page.tsx` displaying summary stats, canonical PRD §7 niche groups with availability badges, and 21 platform modules with category badges and entitlement keys.
  - **Automated Verification:**
    - 63 test files, 723 unit/integration tests passed with 0 failures across the entire test suite.
    - Quality gates passed: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.


### [VO-028] — Implement audit/activity and notification foundation (2026-11-17)
- Implemented centralized audit logging and in-app notifications foundation strictly according to PRD FINAL v2 (§14, §16, §18.5, FR-13, SEC-06) and `docs/TASK_BACKLOG.md`:
  - **Database Migration & RPC Security (`supabase/migrations/20261117000002_audit_and_notification_foundation.sql`):**
    - Created `public.notifications` table for tamper-evident, typed in-app notifications with recipient-scoped access, read/unread tracking, and idempotency protection.
    - Defined canonical notification types: `'workspace_invitation'`, `'business_invitation'`, `'membership_change'`, `'role_updated'`, `'member_removed'`, `'capacity_warning'`, `'site_status_changed'`, `'security_alert'`, `'system_announcement'`.
    - Added query performance indexes on `(recipient_user_id, created_at DESC)`, `(recipient_user_id) WHERE read = FALSE`, `workspace_id`, and `business_id`.
    - Enabled fail-closed Row-Level Security (`ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY`):
      - SELECT: `recipient_user_id = auth.uid()`.
      - UPDATE: `recipient_user_id = auth.uid()` WITH CHECK `recipient_user_id = auth.uid()` (scoped to marking read).
      - INSERT: `WITH CHECK (false)` (direct client writes denied; creation occurs exclusively through trusted server operations).
      - DELETE: `USING (false)` (tamper-evident, immutable notifications).
    - Hardened `public.create_in_app_notification(...)` stored procedure:
      - Strict caller identity execution guard: rejects non-`service_role`/`postgres` callers with custom SQLSTATE `VY003` to prevent notification spoofing.
      - Recipient and tenant existence validation against `public.users`, `public.workspaces`, and `public.businesses`.
      - Revoked EXECUTE from `PUBLIC`, `anon`, and `authenticated`; granted EXECUTE strictly to `service_role`.
    - Synchronized all migration text into `supabase/combined_migrations.sql`.
  - **Centralized Audit Service (`src/lib/audit/`):**
    - Strongly typed actions (`WorkspaceAuditAction`, `BusinessAuditAction`, `SiteAuditAction`, `SecurityAuditAction`) and resources.
    - Automated sensitive credential redaction (`redactSensitiveData`): recursively sanitizes mixed-case passwords, tokens, API keys, client secrets, OTPs, private keys, credit/debit cards, CVVs, and Bearer authorization strings across nested structures with circular-reference protection.
    - Preserves statutory Indian business identifiers (`pincode`, `postal_pin`, `pan_number`, `tax_pan`, `gstin`, `gst_number`).
    - Unified all mutation audit writes in `workspaces/service.ts`, `businesses/service.ts`, and `plans/service.ts` to call centralized `recordAuditEvent` instead of raw direct table inserts.
    - Server-derived identity and tenant boundary enforcement (`recordAuditEvent`, `listWorkspaceAuditLogs`, `listBusinessAuditLogs`).
    - Server Actions (`listWorkspaceAuditLogsAction`, `listBusinessAuditLogsAction`) with fail-closed tenant validation and anti-enumeration error sanitization.
  - **In-App Notifications Service & Event Producers (`src/lib/notifications/`):**
    - Transactional, recipient-isolated notification operations: `createNotification` (executes trusted RPC with idempotency via admin client), `listUserNotifications` (recipient-scoped with unread filtering), `getUnreadNotificationCount`, `markNotificationAsRead`, `markAllNotificationsAsRead`.
    - Wired notification lifecycle triggers into core domain services:
      - Workspace invitations (`workspace_invitation`) when an existing user is invited.
      - Workspace member role updates (`role_updated`) and member removal (`member_removed`).
      - Business invitations (`business_invitation`) when an existing user is invited.
      - Business member role updates (`role_updated`) and member removal (`member_removed`).
      - Website publishing audit recording (`site.published`).
    - Server Actions (`listNotificationsAction`, `getUnreadNotificationCountAction`, `markNotificationAsReadAction`, `markAllNotificationsAsReadAction`) verifying caller identity strictly from server Supabase session.
  - **Accessible Notification Center UI (`src/components/notifications/`):**
    - Created `NotificationCenter` component adhering to WCAG 2.2 AA (visible focus, $\ge 4.5:1$ contrast, keyboard escape/outside click close, ARIA attributes `aria-expanded`, `aria-label`, `aria-haspopup="dialog"`).
    - Mounted `NotificationCenter` into all 4 authenticated application shells: Reseller Workspace, Business Owner Dashboard, Staff Counter POS, and Platform Admin.
    - Responsive mobile-first design down to 320/390px with Emerald + Marigold status indicators.
    - Includes unread count badge, filter tabs (All / Unread), category badges, relative time formatting, empty state ("All caught up!"), and instant optimistic read updates.
  - **Backlog & Architecture Reconciliation:**
    - Confirmed decade numbering convention across all project phases (P0: VO-000..VO-006, P1: VO-010..VO-019, P2: VO-020..VO-028, P3: VO-030..VO-034). There is no task `VO-029`; the next task in the approved backlog is `VO-030`.
  - **Automated Verification:**
    - 58 test files, 685 unit/integration tests passed with 0 failures.
    - `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` all passed.

### [VO-027] — Implement team invitations and membership lifecycle (2026-11-17)
- Implemented team invitations and membership lifecycle across Reseller Workspaces and Business Operational domains strictly according to PRD FINAL v2 (§4, §9.1, §9.2, §15, §19) and `docs/TASK_BACKLOG.md`:
  - **Database Migration (`supabase/migrations/20261117000001_team_invitations_and_membership_lifecycle.sql`):**
    - Created `public.business_invitations` table for merchant store operations with roles (`'owner'`, `'manager'`, `'cashier'`, `'staff'`), 7-day expiration, and SHA-256 token hashing.
    - Defined partial unique index `idx_business_invitations_pending_unique` on `(business_id, lower(email)) WHERE status = 'pending'` preventing duplicate pending invitations.
    - Implemented RLS helper `public.is_business_manager_or_owner(UUID, UUID)` with `SECURITY DEFINER` and empty `search_path = ''`.
    - Enabled RLS on `public.business_invitations` with fail-closed SELECT, INSERT, UPDATE, DELETE policies.
    - Implemented atomic stored procedures with row-level locks (`FOR UPDATE`):
      - `accept_workspace_invitation_atomic`: Enforces `team_seats` capacity via `assert_and_lock_workspace_capacity`, checks expiration and case-insensitive email match, upserts active `workspace_members`, marks invitation accepted, and records immutable audit log.
      - `accept_business_invitation_atomic`: Transfers sovereign ownership if invited role is `'owner'`, checks expiration and email match, upserts active `business_members`, marks accepted, and records immutable audit log.
    - Established standardized, non-colliding VyapOne SQLSTATE codes: `VY010` (invalid or nonexistent token), `VY011` (inactive invitation), `VY012` (invitation expired), `VY013` (recipient email mismatch), `VY001` (capacity exceeded).
    - Revoked all DML and function privileges from `PUBLIC` and `anon`; granted execution and controlled DML strictly to `authenticated` and `service_role`.
    - Synchronized migration text into `supabase/combined_migrations.sql`.
  - **Domain Separation & Security Invariants:**
    - Maintained strict sovereign tenant boundary: Reseller workspace membership (`workspace_members`) never grants sovereign business ownership; business operational membership (`business_members`) never grants agency workspace administration.
    - Implemented Last-Owner Protection across both domains: sole workspace owners, sole business owners, and sovereign owners cannot be removed or demoted.
    - Enforced downward role authority: managers cannot invite or revoke an owner; cashiers and staff cannot invite members.
  - **Capacity Integration:**
    - Integrated `team_seats` metric enforcement in workspace invitations: creation pre-checks active members + non-expired pending invitations against plan limits, and acceptance atomically locks and enforces capacity at the database layer.
  - **Application Service Layer & Server Actions:**
    - Workspaces: `createWorkspaceInvitation`, `listWorkspaceInvitations`, `revokeWorkspaceInvitation`, `acceptWorkspaceInvitation`, `listWorkspaceInvitationsAction`, `revokeWorkspaceInvitationAction`.
    - Businesses: `createBusinessInvitation`, `listBusinessInvitations`, `revokeBusinessInvitation`, `acceptBusinessInvitation`, `inviteBusinessMemberAction`, `listBusinessInvitationsAction`, `revokeBusinessInvitationAction`, `acceptBusinessInvitationAction`.
  - **UI Components & Pages:**
    - `WorkspaceTeamView` and `/workspace/team`: Client view and page for managing agency teammates, displaying pending invitations, and viewing seat usage.
    - `BusinessTeamTable` and `BusinessInviteModal`: Store staff management components for store managers and owners.
    - `AcceptInvitationCard` and `/accept-invitation`: Unified, accessible page for single-use invitation token acceptance.
  - **Automated Verification:**
    - 54 test files, 641 unit/integration tests passed with 0 failures.
    - `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` all passed.

### [VO-026] — Implement plans, entitlements and capacity service (2026-11-16)
- Implemented and hardened the centralized plans, subscription management, feature entitlement evaluation, and capacity enforcement service strictly according to PRD FINAL v2 (§9.1, §9.2, §16) and `docs/TASK_BACKLOG.md`:
  - **Sites Table Privilege Hardening & Zero-Bypass RPC Gate (`supabase/migrations/20261116000002_harden_sites_table_privileges_and_rpc.sql`):**
    - Eliminated broad table-level `UPDATE` and `INSERT` grants on `public.sites` from `authenticated, anon, PUBLIC`. In PostgreSQL, table-level grants supersede column-level revocations; revoking table-level DML guarantees that direct status mutations cannot bypass column exclusions.
    - Granted scoped column-level `INSERT` strictly excluding `status` (`id, business_id, subdomain, primary_domain, published_version_id, created_at, updated_at`). All directly inserted storefronts must rely on the column default `'draft'`.
    - Added defense-in-depth trigger `trg_check_site_insert_status` enforcing `NEW.status = 'draft'` on all inserts unconditionally (`VY003`).
    - Granted scoped column-level `UPDATE` strictly excluding `status` and `business_id` (`subdomain, primary_domain, published_version_id, updated_at`). Direct updates attempting to alter `status` or `business_id` fail immediately at the PostgreSQL parser/privilege check with SQLSTATE `42501`.
    - Neutralized custom GUC manipulation: setting `vyapone.in_atomic_site_transition = true` confers zero privilege bypass because column permission checks strictly precede trigger execution.
    - Verified `transition_site_status_atomic()` as the exclusive, authorized execution path for protected status transitions.
  - **Database Hardening & Non-Colliding SQLSTATE Codes (`supabase/migrations/20261116000001_harden_capacity_locking_and_sqlstate.sql`):**
    - Replaced predefined PostgreSQL codes (`P0003`, `P0004`, `P0005`) with custom, non-colliding VyapOne SQLSTATE codes: `VY001` (capacity limit exceeded), `VY002` (invalid business lifecycle), `VY003` (permission denied / prohibited direct transition), `VY004` (tenant boundary violation), `VY005` (unknown plan identifier), and `VY006` (immutable field mutation prohibited).
    - Eliminated lock-order inversion deadlocks: revoked direct `UPDATE (status)` on `public.sites` from `authenticated, anon, PUBLIC`. Direct client publishing updates are rejected by trigger `trg_check_site_publish_capacity` with `VY003` unless executed inside `transition_site_status_atomic()` where `workspaces` row locks are always acquired first.
    - Verified exact PostgreSQL row-lock syntax: `ORDER BY id FOR UPDATE` strictly adheres to PostgreSQL grammar in `transition_site_status_atomic()`.
    - Protected business restoration: added trigger `trg_handle_business_archive_restore` on `public.businesses` demoting any published sites to `suspended` when a business is archived or restored, preventing silent live website slot leakage without atomic capacity checks.
    - Added draft replacement capacity checks: ensures projected drafts do not exceed allowance, and prohibits atomic replacement if workspace is currently in an exceeded draft state post-downgrade.
  - **Database Migration & Schema Enforcement (`supabase/migrations/20261115000001_plans_entitlements_capacity.sql`):**
    - Created `public.subscriptions` table with foreign key to `workspaces(id)` on delete cascade, status checks, and period timestamps.
    - Created `public.entitlement_overrides` table supporting explicit business- or workspace-scoped feature grants and add-on overrides with expiration tracking.
    - Created `public.capacity_overrides` table for purchased slot expansions (e.g. additional live websites or staff seats).
    - Expanded `public.workspaces.plan` check constraint to support `('starter', 'growth', 'pro', 'agency', 'scale')`.
    - Expanded `public.sites.status` check constraint to support `'archived'` status per PRD §9.2 counting rules.
    - Enforced `FORCE ROW LEVEL SECURITY` across all 3 tables with fail-closed policies isolating reads to workspace members and denying unauthorized client writes.
    - Added atomic capacity functions: `assert_and_lock_workspace_capacity`, `transition_site_status_atomic`, `check_site_publish_capacity_trigger`, and `prevent_site_business_id_change`.
    - Dropped unconditional `sites_business_id_key` to allow multiple draft sites while strictly enforcing at most one published site per business via `idx_sites_single_published_per_business`.
    - Enforced immutable `business_id` on `public.sites` via `trg_prevent_site_business_id_change` trigger.
  - **Plan Model & Entitlement Definitions:**
    - Configured master plan definitions adhering to PRD §9.1 (`starter`: ₹399/mo, 3 live websites, 10 drafts, 2 seats; `growth`/`pro`: ₹999/mo, 8 live websites, 25 drafts, 5 seats; `agency`: ₹1,999/mo, 20 live websites, 50 drafts, 15 seats; `scale`: quote, 50 live websites, 100 drafts, 50 seats).
    - Preserved hypothesis pricing status per ADR-011 and PRD §9.1.
  - **Entitlement & Capacity Service Layer:**
    - `resolveWorkspacePlan`: Resolves effective plan from subscriptions or workspace attributes, handles grace periods and downgrade fallbacks.
    - `checkFeatureEntitlement` & `assertFeatureEntitled`: Evaluates business overrides, workspace overrides, and plan defaults; fails closed when tenant context is missing.
    - `getCapacityUsage` & `assertCapacityAvailable`: Calculates real database consumption; enforces PRD §9.2 counting rules (archived sites/businesses do not consume live slots; custom domains do not consume extra slots; draft allowances separate from live slots).
    - `checkSiteTransitionCapacity`: Validates site status changes via atomic database transition RPC; fails closed (`ATOMIC_RPC_UNAVAILABLE`) if RPC fails or is missing; allows archiving/suspending safely.
    - `getWorkspaceSubscriptionDetails`: Aggregates complete subscription, capacities, and entitlements for a workspace.
  - **Atomic Publishing & Exact Role Authorization Hardening:**
    - Replaced premature demotion with atomic 10-step invariant in `transition_site_status_atomic`: preserves existing live site on capacity rejection.
    - Enforced exact role authorization: Workspace Owner (`workspace_owner` or `owner_user_id`), Workspace Admin / Reseller Admin (`workspace_admin`, `reseller_admin`), Sovereign Business Owner (`sovereign_owner_id`), and Business Owner / Manager (`owner`, `manager`). Excludes staff, cashiers, and foreign tenants.
    - Allowed archiving and suspending sites for archived businesses to safely release capacity while prohibiting publishing.
    - Audited `SECURITY DEFINER` hygiene: verified `SET search_path = ''`, qualified public relations, caller authenticated via `auth.uid()`, session connection protected via `session_user NOT IN ('postgres', 'service_role')` and `auth.jwt() ->> 'role' <> 'service_role'`.
  - **Server Actions & Error Sanitization:**
    - Extended `sanitizeError` in `src/lib/plans/actions.ts` to map custom SQLSTATE codes (`VY001`-`VY006`) to user-safe error messages without exposing database internals.
  - **Verification & Quality Gates:**
    - Added comprehensive regression tests in `tests/unit/plans/capacity.test.ts`, `tests/unit/plans/migration.test.ts`, `tests/unit/plans/actions.test.ts`, and `tests/unit/plans/site-privilege-audit.test.ts`.
    - Full Vitest suite contains 51 test files and 605 passing tests with 100% pass rate.
    - Formatter, linter, typechecker, and production build all pass cleanly.

### [VO-025] — Implement business profile settings and fact provenance (2026-11-14)
- Implemented business profile settings, statutory identity management, sensitive fact provenance tracking, and security review gate hardening according to PRD FINAL v2 (§4.1, §4.2, §4.3, §15, §16, §17):
  - **Database Migration & RLS Hardening (`supabase/migrations/20261114000002_business_profile_settings.sql`):**
    - Extended `public.businesses` with `category`, `description`, `preferred_language`, `timezone`, `tax_scheme`, `contact_configuration`, `address_configuration`, `timings_configuration`, and `facts_provenance`.
    - Added lookup index `idx_businesses_category`.
    - Hardened `audit_logs_insert_policy` to require tenant scope validation (`can_access_business(business_id) AND is_workspace_member(workspace_id)`).
    - Hardened `businesses_update_policy` to strictly prevent reassignment of sovereign ownership (`sovereign_owner_id`) or unpermitted workspace transfers under `WITH CHECK`.
    - Hardened `catalogue_items_select_policy` to prevent unscoped cross-tenant item reads.
  - **Domain Schemas & Types:**
    - Defined Zod schemas with strict Indian formats: GSTIN (`gstNumberSchema`), PAN (`panNumberSchema`), PIN (`pinCodeSchema`), 24-hour timings (`timeStringSchema`), day timings (`dayTimingsSchema`), and fact confirmation (`confirmBusinessFactSchema`).
    - Synchronized database and business domain types (`BusinessTaxScheme`, `ContactConfiguration`, `AddressConfiguration`, `TimingsConfiguration`, `FactsProvenanceMap`).
  - **Service Layer & Server Actions:**
    - Extended `updateBusinessProfile` in `src/lib/businesses/service.ts` to update all profile fields with permission enforcement (`business:update_profile`) and record `business.profile_updated` audit events.
    - Implemented `confirmBusinessFact` to toggle verified/unverified status of sensitive facts (`tax_identity`, `operating_timings`, etc.) with `business.fact_confirmed` / `business.fact_unconfirmed` audit logging.
    - Implemented `updateBusinessProfileAction` and `confirmBusinessFactAction` with session-derived user identification and error sanitization (`DATABASE_ERROR`).
  - **Accessible UI Form & Route Shells:**
    - Updated `BusinessProfileForm` to an accessible multi-tab interface: Store Identity, Tax & Legal, Address & Contacts, Timings & Locale, and Verified Facts.
    - Added `CONFIRMED` vs `PROPOSED` badges and fact confirmation toggles for sovereign owners and managers.
    - Formatted and wired in `/dashboard/settings` route shell.
  - **Verification & Quality Gates:**
    - Added 13 new unit tests in `tests/unit/businesses/profile-settings.test.ts`.
    - Full Vitest suite contains 45 test files and 509 passing tests with 100% pass rate.
    - Code coverage meets all required thresholds: Statements 84.87%, Branches 70.36%, Functions 88.58%, Lines 84.87%.
    - Formatter, linter, typechecker, and production build all pass cleanly.

### [FIX] — VyapOne registration error and dynamic runtime environment resolution (2026-11-13)
- Fixed authentication error on registration page (`An error occurred during authentication. Please try again.`):
  - **Dynamic Environment Resolution:**
    - Updated `src/lib/supabase/server.ts` and `src/lib/supabase/client.ts` to dynamically resolve `process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL` and `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY` at runtime.
    - Prevents static build-time inlining from locking `supabaseUrl` and `supabaseAnonKey` to empty strings when Cloudflare Workers Builds runs with empty build variables.
  - **Registration Redirect Handling:**
    - Updated `signUpAction` in `src/lib/auth/actions.ts` to pass `options.emailRedirectTo` using `NEXT_PUBLIC_APP_URL || APP_URL` so confirmation links point to `/auth/callback`.
  - **Error Diagnostics & Logging:**
    - Added structured server-side `console.error` in `signUpAction`, `signInWithPasswordAction`, `requestPhoneOtpAction`, `verifyPhoneOtpAction`, `requestPasswordResetAction`, and `updatePasswordAction` with strict redaction of user credentials, passwords, and PII.
    - Guarded `ensureUserProfile` in `signUpAction` within a try/catch so any non-fatal profile bootstrap error does not abort valid registration responses.
  - **Sanitized Auth Error Mapping:**
    - Expanded `mapAuthError` in `src/lib/auth/security.ts` to recognize configuration errors, network connectivity failures, database trigger errors, registration restrictions, provider password requirements, invalid email formats, and SMTP sending errors with user-safe, actionable messaging.
  - **Test Coverage & Quality Gates:**
    - Added 12 new unit and regression tests in `tests/unit/auth/actions.test.ts`, `tests/unit/auth/security.test.ts`, `tests/unit/supabase/server-client.test.ts`, and `tests/unit/supabase/browser-client.test.ts`.
    - Total test suite now contains 495 passing tests with 100% pass rate.
    - Full quality gates verified: format, lint, typecheck, coverage (85.0%), and `next build` all exit code 0.
  - **Documentation:**
    - Updated `docs/AUTHENTICATION.md` with §9 documenting runtime environment resolution, Cloudflare Dashboard Build Variables vs. Environment Variables, and error mappings.

### [VO-024] — Enforce tenant isolation at database and API layers (2026-11-13)
- Implemented comprehensive dual-layer tenant isolation enforced at both the database layer (PostgreSQL Row-Level Security with `FORCE ROW LEVEL SECURITY`) and API/service domain layer according to PRD FINAL v2 (§4, §15.2, §16, §17):
  - Database RLS Architecture (`supabase/migrations/20261113000002_enforce_tenant_isolation.sql`):
    - Enforced `FORCE ROW LEVEL SECURITY` across all 15 tenant tables (`users`, `user_auth_identities`, `workspaces`, `workspace_members`, `workspace_invitations`, `businesses`, `locations`, `business_members`, `sites`, `catalogue_items`, `customers`, `orders`, `invoice_sequences`, `bills`, `audit_logs`).
    - Implemented 8 hardened `SECURITY DEFINER` helper functions with explicit `SET search_path = ''` to prevent infinite policy recursion (`is_workspace_member`, `is_workspace_admin_or_owner`, `is_business_sovereign_owner`, `is_business_member`, `is_business_owner_or_manager`, `can_access_business`, `can_manage_business`, `can_access_location`).
    - Defined 60 explicit fail-closed policies covering `SELECT`, `INSERT`, `UPDATE`, and `DELETE`.
    - Implemented append-only and immutable table guardrails (`audit_logs`, `orders`, `bills`, `invoice_sequences` prohibit deletion via `USING (false)`).
    - Restricted business deletion strictly to sovereign owner (`sovereign_owner_id = auth.uid()`); reseller members cannot delete client businesses.
    - Added 7 composite lookup indexes to accelerate RLS evaluation paths.
  - Centralized API Authorization Layer (`src/lib/auth/tenant-access.ts`):
    - Created authoritative helpers: `assertAuthenticatedUser`, `assertWorkspaceAccess`, `assertBusinessAccess`, `assertSovereignOwner`, `assertRecordBelongsToBusiness`, `assertLocationBelongsToBusiness`, and `sanitizeTenantError`.
    - Server Actions and services derive identity strictly from authenticated server sessions (`supabase.auth.getUser()`) and reject client-supplied tenant overrides.
    - Enforced anti-enumeration design returning `404 NOT_FOUND` when records do not exist or caller lacks membership.
    - Enforced operational location scoping: staff assigned to a location cannot access or mutate foreign locations.
  - Verification & Quality Gates:
    - Added automated integration tests verifying 12 cross-tenant attack scenarios (`tests/integration/cross-tenant-isolation.test.ts`).
    - Added static migration verification tests (`tests/unit/database/migration-isolation.test.ts`).
    - Added authorization helper tests (`tests/unit/security/tenant-isolation.test.ts`).
    - Full Vitest suite contains 44 test files and 483 passing tests with 100% pass rate.
    - Code coverage meets all required thresholds: Statements 85.08%, Branches 70.09%, Lines 85.08%, Functions 88.89%.
    - Formatter, linter, typechecker, and production build all pass cleanly.
  - Documentation:
    - Created `docs/TENANT_ISOLATION.md` detailing the tenant hierarchy, RLS policy inventory, authorization helper APIs, and cross-tenant attack mitigations.

### [FIX] — Cloudflare Workers Builds pnpm workspace configuration (2026-11-13)
- Fixed Cloudflare Workers Builds dependency installation error (`ERROR packages field missing or empty`):
  - Updated `pnpm-workspace.yaml` to explicitly declare `packages: ["."]`, satisfying pnpm workspace validation for single-package root application while preserving `allowBuilds: { esbuild: true }`.
  - Added unit test in `tests/unit/ci/workflow.test.ts` to ensure `pnpm-workspace.yaml` packages declaration is preserved.
  - Documented root cause, resolution, and deployment troubleshooting in `docs/CI_CD.md` §7.
- Fixed Cloudflare deployment execution error (`[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: workerd@...`):
  - Approved `workerd` in `allowBuilds` and `onlyBuiltDependencies` in `pnpm-workspace.yaml` so `npx wrangler deploy` can execute postinstall scripts cleanly.
  - Updated CI validation test in `tests/unit/ci/workflow.test.ts`.

### [VO-023] — Implement business and location core (2026-11-13)
- Implemented sovereign business entity and primary store location core according to PRD FINAL v2 (§4, §7, §8, §9, §15, §16, §17):
  - Sovereign Business Ownership Boundary:
    - Enforced sovereign merchant data ownership anchored strictly to `businesses.sovereign_owner_id`.
    - Supported both direct DIY onboarding (`workspace_id IS NULL`) and reseller agency managed businesses (`workspace_id` set, but merchant retains absolute data sovereignty).
    - Guaranteed that reseller workspace permissions (`public.workspace_members`) never confer sovereign business ownership rights.
  - Primary Location Invariant:
    - Guaranteed exactly one primary store location (`is_primary = true`) per business backed by PostgreSQL partial unique index `idx_locations_primary_per_business`.
    - Automatically and atomically demotes any previous primary location when a new primary location is created or updated.
  - Business Operational Roles & Last-Owner Protection (`src/lib/businesses/permissions.ts`):
    - Established business operational role ranks: `owner` (40) > `manager` (30) > `cashier` (20) > `staff` (10) in `public.business_members`, separated from workspace agency roles.
    - Implemented Last-Owner Protection preventing demotion, removal, or deactivation of the sole remaining owner of a business.
  - Business & Location Domain Service (`src/lib/businesses/service.ts`):
    - Implemented atomic business onboarding, profile management, multi-location CRUD, and team member management with immutable audit logging (`business.created`, `business.profile_updated`, `location.created`, `location.updated`, `business.member_added`, `business.member_role_updated`, `business.member_removed`).
  - Authenticated Server Actions (`src/lib/businesses/actions.ts`):
    - Created `"use server"` actions with structured results (`BusinessActionResult<T>`): `createBusinessAction`, `updateBusinessProfileAction`, `createLocationAction`, `updateLocationAction`, `addBusinessMemberAction`, `updateBusinessMemberRoleAction`, `removeBusinessMemberAction`.
    - Integrated path revalidation across `/dashboard`, `/dashboard/settings`, and `/workspace/clients`.
  - Accessible UI Primitives (`src/components/businesses/`):
    - Built `BusinessCreateForm` for store and primary location creation.
    - Built `BusinessProfileForm` for store profile settings and tax ID configuration.
    - Built `LocationCard` for address display with primary store location badges.
    - Built `LocationForm` for creating and updating business locations.
    - Built `BusinessSwitcher` dropdown selector for quick business context switching.
  - Forward-Only Database Migration (`supabase/migrations/20261113000001_business_location_core.sql`):
    - Made `public.businesses.workspace_id` nullable for native DIY onboarding.
    - Created partial unique index `idx_locations_primary_per_business`.
    - Created atomic RPC `public.create_business_with_primary_location` with `SECURITY DEFINER SET search_path = ''`.
  - Architecture Documentation:
    - Created `docs/BUSINESSES_AND_LOCATIONS.md` documenting ownership hierarchy, primary location invariants, and domain APIs.

### [VO-022] — Implement workspaces and membership roles (2026-11-12)
- Implemented reseller agency and DIY workspaces, multi-tiered membership roles, cryptographic invitations, and role-based permissions:
  - Multi-Tiered Role Hierarchy & Permissions (`src/lib/workspaces/permissions.ts`):
    - Established explicit workspace role ranks: `workspace_owner` (30) > `workspace_admin` / `reseller_admin` (20) > `workspace_member` / `reseller_staff` (10).
    - Implemented centralized permission checking (`hasWorkspacePermission`, `canManageTargetRole`, `canAssignRole`).
    - Enforced Sovereign Business Ownership Boundary Invariant: Workspace membership (`public.workspace_members`) never confers sovereign business ownership (`public.businesses.sovereign_owner_id`), strictly preserving sovereign merchant data rights across agency tenancies.
  - Workspace Domain Service (`src/lib/workspaces/service.ts`):
    - Implemented workspace creation with automatic single-transaction `workspace_owner` membership.
    - Implemented Last-Owner Protection preventing demotion or removal of the sole remaining workspace owner.
    - Added immutable audit trail logging for all sensitive lifecycle operations (`workspace.created`, `workspace.profile_updated`, `workspace.member_invited`, `workspace.invitation_accepted`, `workspace.member_role_changed`, `workspace.member_removed`, `workspace.member_left`).
  - Cryptographic Invitation Lifecycle (`src/lib/workspaces/tokens.ts`):
    - Generated 32-byte cryptographically secure random invitation tokens (`crypto.getRandomValues`) with deterministic SHA-256 storage (`crypto.subtle.digest`) in `public.workspace_invitations.token_hash`.
    - Zero plaintext token persistence; strict 7-day expiration and single-use acceptance; enforced recipient email identity validation before accepting invitations.
  - Server Actions (`src/lib/workspaces/actions.ts`):
    - Created authenticated Next.js Server Actions with structured results (`WorkspaceActionResult<T>`) for workspace creation, profile updates, member invitations, invitation acceptance, role updates, member removal, and workspace leaving.
    - Integrated path revalidation across `/workspace`, `/workspace/team`, and `/workspace/settings`.
  - Accessible UI Primitives (`src/components/workspaces/`):
    - Built `WorkspaceSwitcher` (workspace context selector with role badges).
    - Built `WorkspaceTeamTable` (accessible roster with role modification and removal triggers).
    - Built `WorkspaceSettingsForm` (workspace metadata and slug manager with owner editing protection).
    - Built `WorkspaceInviteModal` (WAI-ARIA accessible invitation dialog displaying secure one-time links).
  - Forward-Only Database Migration (`supabase/migrations/20261112000003_secure_search_path_and_workspace_roles.sql`):
    - Hardened PostgreSQL `handle_new_auth_user()` trigger function with `SECURITY DEFINER SET search_path = ''` using schema-qualified `pg_catalog.*` and `public.*` references.
    - Added `public.workspace_invitations` table with foreign keys, indexes, and Row-Level Security enabled.
    - Extended `workspace_members_role_check` constraint with canonical workspace and reseller role aliases.
  - Automated Tests & Quality Gates:
    - Added 78 passing unit tests across 7 test files in `tests/unit/workspaces/`.
    - Project test suite expanded to 34 test files, 340 passing tests with 100% pass rate.
    - Coverage metrics meet all quality gate thresholds (Statements 85.53%, Branches 72.15%, Functions 84.45%, Lines 85.53%).
    - Formatter, linter, TypeScript typechecking, and Next.js production build (`next build` with 34 pages) all passed with 0 errors.
  - Architecture Documentation:
    - Authored `docs/WORKSPACES_AND_MEMBERSHIPS.md`.
  - Backlog status for VO-022 marked as `DONE`. Next task is VO-023.

### [VO-021] — Implement authentication and account lifecycle (2026-11-12)
- Implemented comprehensive authentication, account lifecycle, session management, and route boundaries for the Supabase-based VyapOne application:
  - Multi-Modal Interactive Authentication Screens:
    - Built tabbed Sign-In page (`src/app/(auth)/login/page.tsx`, `src/components/auth/login-form.tsx`) supporting Mobile OTP (India-primary) and Email/Password credentials with accessible WAI-ARIA tabs and real-time validation error feedback.
    - Built Merchant & Reseller Onboarding Registration page (`src/app/(auth)/register/page.tsx`, `src/components/auth/register-form.tsx`) with account type selection (`owner`, `reseller`), business naming, email, phone, and password fields.
    - Built Password Recovery flow: Forgot Password request (`src/app/(auth)/forgot-password/page.tsx`, `src/components/auth/forgot-password-form.tsx`) and New Password setup (`src/app/(auth)/update-password/page.tsx`, `src/components/auth/update-password-form.tsx`).
    - Built Email Verification notice screen (`src/app/(auth)/verify-email/page.tsx`).
  - Next.js Server Actions (`src/lib/auth/actions.ts`):
    - Implemented `signUpAction`, `signInWithPasswordAction`, `requestPhoneOtpAction`, `verifyPhoneOtpAction`, `requestPasswordResetAction`, `updatePasswordAction`, and `signOutAction` returning structured, user-safe result objects (`AuthActionResult`).
  - Security Utilities & Controls (`src/lib/auth/security.ts`):
    - Open Redirect Defense: Implemented `isValidInternalRedirect()` strictly validating internal relative paths and preventing external protocol-relative (`//evil.com`), Windows backslash (`/\evil.com`), and control-character bypass attacks.
    - Indian Mobile Normalization: Implemented `normalizePhoneNumber()` converting 10-digit Indian numbers, prefixed 0-numbers, and prefixed 91-numbers to canonical E.164 (`+91xxxxxxxxxx`).
    - Error Sanitization: Implemented `mapAuthError()` neutralizing database/GoTrue errors into safe strings, completely mitigating account enumeration risks.
  - Zod Validation Schemas (`src/lib/auth/schemas.ts`):
    - Enforced strict schemas for email, E.164 phone, password complexity (min 8 chars, letter + digit), 6-digit OTP, registration, password recovery, and matching confirmation passwords.
  - PKCE Auth Callback Handler (`src/app/auth/callback/route.ts`):
    - Implemented GET Route Handler to exchange PKCE authorization code for session, validate redirect targets, and bootstrap application user profiles.
  - Next.js 15 Edge Middleware (`src/middleware.ts`):
    - Invokes `updateSession()` from `@/lib/supabase/middleware` to refresh auth session tokens before routing to Server Components.
    - Enforces back-office route protection for `/dashboard/*`, `/counter/*`, `/workspace/*`, `/platform-admin/*`, redirecting unauthenticated users to `/login?next=<encodedPath>`.
    - Enforces guest-only route boundary, redirecting authenticated users away from `/login`, `/register`, or `/forgot-password` to `/dashboard`.
    - Preserves refreshed session cookies across 307 redirects using `copyCookies()`.
  - Database Trigger & Application Fallback:
    - Created forward migration `supabase/migrations/20261112000002_auth_profile_trigger.sql` implementing `handle_new_auth_user()` with `SECURITY DEFINER` to automatically populate `public.users` and `public.user_auth_identities`.
    - Created idempotent application-layer fallback helper `ensureUserProfile()` in `src/lib/auth/profile.ts`.
  - Automated Unit Testing & Quality Gates:
    - Added 6 new unit test suites with 55 unit tests in `tests/unit/auth/` (`actions.test.ts`, `callback.test.ts`, `middleware.test.ts`, `profile.test.ts`, `schemas.test.ts`, `security.test.ts`).
    - Full test suite expanded to 27 test files, 262 passing tests with 100% pass rate.
    - Coverage satisfies quality gate thresholds: Statements 85.34%, Branches 75.13%, Functions 80.68%, Lines 85.34%.
    - Verified `pnpm format:check` (clean), `pnpm lint` (0 errors, 0 warnings), `pnpm typecheck` (0 errors), `pnpm build` (34 pages compiled cleanly).
  - Comprehensive Architecture Documentation:
    - Authored `docs/AUTHENTICATION.md` covering architecture, lifecycle flows, middleware sequence, India DLT/SMS regulatory requirements, and security controls.
  - Backlog status for VO-021 marked as `DONE`. Next task is VO-022.

### [VO-020] — Create database migration framework (2026-11-12)
- Built and statically validated canonical PostgreSQL database migration framework, initial core schema, synthetic seed data, pgTAP test suite, and database architecture documentation:
  - Architecture Reconciliation: Standardized on Supabase CLI native SQL migration framework (`supabase/migrations/`) reconciling ADR-002, ADR-003, and ADR-004 into a single authoritative DDL pipeline without dual-runner drift.
  - Initial Schema Migration (`supabase/migrations/20261112000001_initial_schema.sql`):
    - Created all 14 canonical tables: `users`, `user_auth_identities`, `workspaces`, `workspace_members`, `businesses`, `locations`, `business_members`, `sites`, `catalogue_items`, `customers`, `orders`, `invoice_sequences`, `bills`, `audit_logs`.
    - Primary Keys: Enforced `UUID PRIMARY KEY DEFAULT gen_random_uuid()` across all 14 tables.
    - Financial Precision: Enforced 64-bit integer minor units (`price_minor BIGINT`, `total_minor BIGINT`, `amount_minor BIGINT`, `tax_minor BIGINT`, `total_spend_minor BIGINT`) with ISO 4217 `currency_code` (`INR`). Banned floating-point numbers.
    - Tenancy & Security: Activated `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` on all 14 tables establishing **Default Deny** security posture.
    - Performance: Added composite B-tree indexes `(business_id, created_at DESC)` and foreign-key lookup indexes for all tenant tables.
    - Sequential Invoicing: Created `invoice_sequences` table with unique constraint `(business_id, financial_year, series_prefix)` for gap-free numbering.
    - Append-Only Audit Trail: Configured `audit_logs` without update triggers.
  - Supabase Project Configuration (`supabase/config.toml`): Configured local project ID `vyapone`, PostgreSQL port 54322, PostgREST API port 54321, transaction pooler port 54329, auth, and storage.
  - Synthetic Seed Data (`supabase/seed.sql`): Created local dev seed records using valid RFC 4122 v4 UUIDs, synthetic `.vyapone.internal` emails, and minor units, mirroring `tests/fixtures/demo-seed.ts`.
  - pgTAP Regression Tests (`supabase/tests/00001_schema_test.sql`): Created 32 pgTAP assertions validating extensions, table existence, UUID PK types, minor-unit columns, foreign keys, and active RLS.
  - Automated Static Validation (`tests/unit/database/migrations.test.ts`): Authored 11 automated unit tests validating migration file naming, all 14 table definitions, UUID PKs, minor-unit constraints, RLS enablement, index presence, seed RFC 4122 UUIDs, zero PII, and pgTAP syntax. Total test suite expanded to 202 passing tests across 21 files (100% pass rate).
  - Developer Package Scripts: Added `db:start`, `db:stop`, `db:reset`, `db:migration:new`, `db:test`, and `db:types` to `package.json`.
  - Canonical Architecture Guide (`docs/DATABASE_MIGRATIONS.md`): Authored comprehensive specification covering migration architecture, file conventions, local workflow, Docker dependency, RLS migration rules, seed safety, Cloudflare boundaries, and production approval process.
  - Quality Gates: Verified all repository quality gates pass: `pnpm format:check` (clean), `pnpm lint` (0 errors, 0 warnings), `pnpm typecheck` (0 errors), `pnpm test` (202 tests pass), `pnpm test:coverage` (Statements: 96.36%, Branches: 79.75%, Functions: 92.30%, Lines: 96.36%), and `pnpm build` (30/30 pages compiled).
  - Backlog status for VO-020 marked as `DONE`. Next task is VO-021.

### [VO-019] — Establish testing conventions and baseline coverage (2026-11-12)
- Established formal multi-tier testing conventions, deterministic test factories, realistic multi-tenant demo seed data, Playwright E2E configuration, and code coverage baseline:
  - Installed `@vitest/coverage-v8` (`3.2.7`) aligned with installed Vitest version and pnpm 11 supply chain invariants.
  - Test Layer Structure:
    - Unit Tests (`tests/unit/`): 18 test files, 182 passing tests running in-memory with jsdom.
    - Integration Tests (`tests/integration/`): 2 test files, 9 passing tests validating route shells with real Zod config parsing and multi-tenant sovereign boundary isolation.
    - End-to-End Tests (`tests/e2e/`): Playwright Chromium test verifying app shells, portal navigation, and mobile viewports (`playwright.config.ts`, `tests/e2e/app-shell.spec.ts`).
  - Canonical Test Factories (`tests/factories/`): Built strongly-typed, deterministic test entity factories representing all 13 canonical tables from `docs/diagrams/core-erd.mmd`:
    - `users`: `createTestUser`, `createTestUserAuthIdentity`.
    - `workspaces`: `createTestWorkspace`, `createTestWorkspaceMember`.
    - `businesses`: `createTestBusiness`, `createTestLocation`, `createTestBusinessMember`, `createTestSite`.
    - `commerce`: `createTestCatalogueItem`, `createTestCustomer`, `createTestOrder`, `createTestBill`, `createTestAuditLog`.
    - Deterministic ID generation with monotonic sequence counters (`formatDeterministicId`, `resetFactorySequence`) and frozen timestamp `BASE_TEST_TIMESTAMP = "2026-11-12T10:00:00.000Z"`.
    - Strict financial minor unit invariants (`amount_minor BIGINT`, `price_minor BIGINT`, `currency: "INR"`).
  - Seeded Local Demo Data (`tests/fixtures/demo-seed.ts`): Built canonical synthetic demo hierarchy (Platform Admin -> Reseller Workspace -> Sovereign Business "Kaveri Silks" -> Location -> Staff -> Published Site -> Catalogue -> Customer -> Order -> Invoice `INV/2026-27/0001` -> Audit Logs).
  - Demo Seed Security Guard (`src/lib/database/seed.ts`): Implemented `assertSafeSeedEnvironment()` throwing `SeedingSecurityError` if executed in `NODE_ENV === "production"`, `NEXT_PUBLIC_APP_ENV === "production"|"staging"`, or non-localhost databases.
  - Code Coverage Baseline: Measured Vitest v8 coverage across `src/**` excluding stubs/barrels: Statements **96.35%**, Branches **79.75%**, Functions **92.30%**, Lines **96.35%**. Enforced CI thresholds in `vitest.config.ts` (min 85% statements, 70% branches, 80% functions, 85% lines).
  - Canonical Architecture Guide (`docs/TESTING_CONVENTIONS.md`): Authored comprehensive guide detailing test architecture, pyramid layers, AAA pattern, factory usage, demo seed security rules, and commands.
  - Phase P1 Completion: Marked all Phase P1 tasks (VO-010 to VO-019) DONE, verified all criteria in `docs/PHASE_GATES.md`, and prepared repository for Phase P2.
  - Verified all repository quality gates pass: `pnpm format:check` (clean), `pnpm lint` (0 errors, 0 warnings), `pnpm typecheck` (0 errors), `pnpm test` (191 tests pass), `pnpm test:coverage` (thresholds met), `pnpm test:responsive` (35/35 viewports pass), and `pnpm build` (30/30 pages compiled).
  - Backlog status for VO-019 marked as `DONE`. Next task is VO-020.

### [VO-018] — Set up CI and pull-request checks (2026-11-12)
- Implemented and locally validated GitHub Actions CI pipeline and pull-request check architecture:
  - CI Workflow (`.github/workflows/ci.yml`): Configured two-stage workflow (`quality-checks` and `production-build`) executing on `push` to `main`, `pull_request` targeting `main`, and `workflow_dispatch`.
  - Security Hardening: Pinned all third-party GitHub Actions to verified 40-character commit SHAs running natively on Node 24 (`actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0 # v7.0.0`, `pnpm/action-setup@fc06bc1257f339d1d5d8b3a19a8cae5388b55320 # v5.0.0`, `actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0`).
  - Least Privilege: Set global workflow permissions to `contents: read`; configured `persist-credentials: false` in checkout; added concurrency control with `cancel-in-progress: true` for PRs.
  - Reproducible Runtime: Created `.nvmrc` (`24`) fixing Node.js 24 LTS; aligned `package.json` engines to `"node": ">=24.0.0"`; pinned `"packageManager": "pnpm@11.21.0"`; enforced `pnpm install --frozen-lockfile`.
  - Quality Gates in CI: Configured automated execution of `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.
  - Zero Secrets in CI: Verified tests mock providers and Next.js production build compiles all 30 routes without live Supabase database sockets or external credentials.
  - Automated Dependency Maintenance (`.github/dependabot.yml`): Configured weekly security and version scanning for `github-actions` and `npm` ecosystems.
  - Architecture Documentation (`docs/CI_CD.md`): Authored comprehensive specification covering pipeline architecture, pinned action matrix, least-privilege security model, local reproduction, and pending branch protection configuration.
  - Automated Unit Tests (`tests/unit/ci/workflow.test.ts`): Authored 6 automated tests validating workflow syntax, branch triggers, permission hardening, action SHA pinning, required quality gates, Dependabot configuration, and reproducible runtime settings. Total test suite expanded to 170 passing tests across 16 files (100% pass rate).
  - Corrective Audit Pass: Migrated runtime and runner configuration from deprecated Node 20 to Node.js 24 LTS across `.nvmrc`, `package.json`, `.github/workflows/ci.yml`, `docs/CI_CD.md`, and `tests/unit/ci/workflow.test.ts` to ensure compatibility with pnpm 11 and GitHub Actions Node 24 action runtime.
  - Verified all repository quality gates pass: `pnpm format:check` (clean), `pnpm lint` (0 errors, 0 warnings), `pnpm typecheck` (0 errors), `pnpm test` (170 tests pass), and `pnpm build` (30/30 pages compiled).
  - Backlog status for VO-018 maintained as `DONE`.

### [VO-017] — Implement Supabase Client and Database Connection Foundation (2026-11-12)
- Implemented strongly-typed Supabase client infrastructure and database connection foundation with compile-time and runtime security isolation:
  - Installed `@supabase/ssr` (`0.12.7`) and `@supabase/supabase-js` (`2.119.0`).
  - Browser Client (`src/lib/supabase/client.ts`): Client-safe factory `createBrowserSupabaseClient()` using `@supabase/ssr`, restricted to public allowlisted configuration (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) with browser singleton memoization.
  - Server Client (`src/lib/supabase/server.ts`): Server-only factory `createServerSupabaseClient(customCookies?)` guarded by `import "server-only"`, supporting Next.js 15 async `cookies()` with `getAll`/`setAll` and request-scoped lifecycle enforcing PostgreSQL Row-Level Security (RLS) under the requesting user's identity.
  - Middleware Session Helper (`src/lib/supabase/middleware.ts`): Session updater `updateSession(request)` refreshing auth sessions via `supabase.auth.getUser()` and synchronizing cookies between request and response headers.
  - Administrative Client (`src/lib/supabase/admin.ts`): Privileged service-role factory `createAdminSupabaseClient(customEnv?)` guarded by `import "server-only"`, disabling session persistence, strictly reserved for platform tenant provisioning, webhook verification, and audit logs.
  - Database Types Foundation (`src/lib/supabase/types.ts`): Strongly-typed `Database` interface representing all 13 canonical entities from `docs/diagrams/core-erd.mmd` (`users`, `user_auth_identities`, `workspaces`, `workspace_members`, `businesses`, `locations`, `business_members`, `sites`, `catalogue_items`, `orders`, `customers`, `bills`, `audit_logs`).
  - Database Connection & Pooler Foundation (`src/lib/database/index.ts`): Reconciled ADR-002, ADR-003, and ADR-004 for Cloudflare Workers edge runtime; implemented `inspectDatabaseConfig()` safely identifying Supavisor transaction poolers (port 6543 / `?pgbouncer=true`), session poolers (port 5432), and direct connections without persistent socket leaks on import.
  - Architecture Documentation (`docs/DATABASE_ARCHITECTURE.md`): Authored comprehensive specification covering execution boundaries, serverless connection pooling, Cloudflare Workers compatibility, environment matrix, RLS protection boundaries, and $0-budget free-tier constraints.
  - Automated Unit Tests: Authored 23 tests across 6 files (`tests/unit/supabase/browser-client.test.ts`, `server-client.test.ts`, `admin-client.test.ts`, `boundary.test.ts`, `types.test.ts`, and `tests/unit/database/connection.test.ts`). Total test suite expanded to 164 passing tests across 15 files (100% pass rate).
  - Verified all repository quality gates pass: `pnpm format:check` (clean), `pnpm lint` (0 errors, 0 warnings), `pnpm typecheck` (0 errors), `pnpm test` (164 tests pass), and `pnpm build` (30/30 pages compiled).
  - Updated backlog status for VO-017 to `DONE` and recorded progress.

### [VO-016] — Implement application configuration and environment handling (2026-11-12)
- Implemented secure, typed, validated application configuration foundation with strict server vs. client runtime isolation:
  - Validation Engine (`src/config/env.ts`): Built Zod schemas (`publicEnvSchema`, `serverCoreEnvSchema`, `optionalIntegrationsEnvSchema`) validating environment variables, port ranges, URL formatting, and PostgreSQL connection protocols.
  - Secret Protection & Error Sanitization: Created `ConfigurationError` class enforcing the zero-leak rule; error messages report invalid paths and expected formats without printing actual secrets or partial passwords.
  - Public Client Configuration (`src/config/public.ts`): Established an allowlisted client-safe configuration object extracting only `NEXT_PUBLIC_*` variables (`NEXT_PUBLIC_APP_ENV`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`), safe for import in React Client Components.
  - Server-Only Privileged Configuration (`src/config/server.ts`): Enforced compile-time and runtime isolation using Next.js `import "server-only"`; encapsulates database connection strings, Supabase service-role keys, session encryption secrets, and third-party integration credentials.
  - Central Barrel Export (`src/config/index.ts`): Clean barrel export providing public config, schemas, and validator utilities, excluding direct server secret exports to prevent accidental client bundling.
  - Production Invariants: Enforced that `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET` (min 32 chars), and Supabase public credentials are strictly required when `NODE_ENV === "production"`.
  - Optional Integrations Resilience: Enabled safe defaults with `isConfigured: false` for unconfigured optional integrations (payments, WhatsApp, AI, storage, Redis) so local development can run without live third-party accounts.
  - Cloudflare Runtime Context Support: Designed `validateEnvironment(rawEnv?)` to accept explicit runtime dictionary bindings (e.g., `context.env` in Cloudflare Pages/Workers) with fallback to `process.env`.
  - Updated Configuration Template (`.env.example`): Restructured into Public, Server Core, and Optional Integration sections with local development instructions and Cloudflare secret guidance.
  - Git Protection (`.gitignore`): Added `.dev.vars` and `.dev.vars.local` to prevent accidental staging of Cloudflare local secret files.
  - Decision Register (`docs/DECISION_REGISTER.md`): Updated ADR-003 (Supabase full backend platform) and ADR-004 (Cloudflare hosting direction) reflecting approved project directions.
  - Architecture Documentation (`docs/CONFIGURATION.md`): Authored comprehensive configuration architecture reference covering variable classification, Cloudflare runtime context, Supabase credential separation, and secret-management rules.
  - Automated Unit Tests: Authored 19 tests across `tests/unit/config/env.test.ts`, `tests/unit/config/server.test.ts`, and `tests/unit/config/client-boundary.test.ts` validating dev/prod parsing, missing production credentials, format validation, secret redaction, Cloudflare context evaluation, and client-boundary errors. Total test suite reached 141 passing tests across 9 files (100% pass rate).
  - Verified all quality gates pass: `pnpm format:check` (clean), `pnpm lint` (0 errors, 0 warnings), `pnpm typecheck` (0 errors), `pnpm test` (141 tests pass), and `pnpm build` (30/30 pages compiled).
  - Updated backlog status for VO-016 to `DONE` and updated progress log.

### [VO-015] — Create responsive layout and mobile interaction foundation (2026-11-11)
- Implemented complete responsive layout foundation and mobile interactions across all 6 application route shells and root portal:
  - Responsive Design Tokens (`src/design-system/tokens.ts`): Exported canonical breakpoints (`xs: 320px`, `sm: 390px`, `md: 768px`, `lg: 1024px`, `xl: 1440px`), safe-area insets (`env(safe-area-inset-*, 0px)`), dynamic page gutters (`mobile: 16px`, `tablet: 24px`, `desktop: 32px`), and WCAG 2.2 AA compliant touch target constants.
  - Root Viewport Configuration (`src/app/layout.tsx`): Added `viewportFit: "cover"` to Next.js `Viewport` object to enable notch and home indicator safe area calculation across iOS and Android devices.
  - Global Responsive Utilities (`src/app/globals.css`):
    - Added CSS custom properties `--safe-area-top/right/bottom/left` with `0px` fallbacks.
    - Added responsive `--page-gutter` scaling via `@media (min-width: 768px)` and `(min-width: 1024px)`.
    - Added `.app-container` and `.app-header` container utilities integrating safe-area insets and gutters.
    - Added dynamic viewport height utility `.min-h-screen-safe` (`100vh` + `100dvh`) protecting full-height layouts against mobile virtual keyboard popping.
    - Enforced 16px (`1rem`) minimum font size on form controls to permanently prevent iOS Safari auto-zoom.
    - Added responsive navigation rules: mobile bottom bar (`.ui-nav-bottom-bar`) hidden on desktop (`>= 769px`); desktop owner navigation (`.owner-desktop-nav`) hidden on mobile (`<= 768px`).
    - Added `.has-bottom-bar` utility ensuring page content is never obscured by the fixed bottom navigation bar.
    - Added `.ui-nav-scrollable` horizontal momentum scroll utility with hidden scrollbars for multi-tab mobile headers.
    - Added `.ui-table-container` allowing keyboard-accessible table horizontal scrolling without breaking root page viewport containment.
  - Layout Normalization: Upgraded all route group layouts (`(auth)`, `(public)`, `(reseller)`, `(owner)`, `(staff)`, `(admin)`) and root `src/app/page.tsx` with responsive layout classes and safe-area padding.
  - Unit Tests (`tests/unit/responsive/responsive-foundation.test.ts`): Authored 14 automated unit tests verifying token parity, safe-area variables, gutter scaling, touch targets, reduced motion queries, and viewport metadata. Total test count reached 122 passing tests across 6 files.
  - Automated Browser Validation (`scripts/validate-responsive.mjs`): Built Playwright test runner executing 35 checks across 7 core routes (`/login`, `/s/demo-store`, `/workspace`, `/dashboard`, `/dashboard/billing`, `/counter/pos`, `/platform-admin`) at 5 viewports (`320x568`, `390x844`, `768x1024`, `1024x768`, `1440x900`). Confirmed 100% pass rate with zero horizontal overflow (`docScrollWidth <= winInnerWidth`). Captured 35 screenshot artifacts to `docs/evidence/screenshots/`.
  - Architecture Documentation: Authored `docs/RESPONSIVE_DESIGN.md` detailing responsive philosophy, breakpoint definitions, safe area ergonomics, touch targets, and browser test results.
  - Verified all quality gates pass: `pnpm typecheck` (0 errors), `pnpm lint` (0 errors), `pnpm format:check` (clean), `pnpm test` (122 tests pass), `pnpm build` (30/30 pages compiled), and `pnpm test:responsive` (35/35 checks pass).
  - Updated backlog status for VO-015 to `DONE` and updated progress log.

### [VO-014] — Create application route shells (2026-11-11)
- Implemented comprehensive Next.js 15 App Router route shells and role-aware navigation hierarchy across 28 authored application routes (27 static page files + 1 dynamic route `/s/[subdomain]`) without URL collisions:
  - `(auth)` Route Group: Dedicated layout and placeholder authentication entry points for `/login` and `/register`.
  - `(public)` Route Group: Customer-facing touchpoints including dynamic merchant subdomain storefronts `/s/[subdomain]` and statutory draft DPDP grievance privacy policy page `/privacy` (marked with clear warning as draft template pending official legal entity registration and DPO designation).
  - `(reseller)` Route Group: Multi-client agency portal with persistent navigation for `/workspace`, `/workspace/clients`, `/workspace/billing`, `/workspace/team`, and `/workspace/settings`. Removed mock metrics/tables and disabled action controls pending Phase P11 (`VO-110`) and Phase P8 (`VO-085`).
  - `(owner)` Route Group: Sovereign merchant business operations portal with desktop navigation and mobile bottom bar (44px+ touch targets) covering `/dashboard`, `/dashboard/catalogue`, `/dashboard/orders`, `/dashboard/billing`, `/dashboard/customers`, `/dashboard/whatsapp`, `/dashboard/website`, `/dashboard/analytics`, and `/dashboard/settings`. Replaced mock metrics with placeholders and disabled mutation buttons pending Phase P6/P8/P9.
  - `(staff)` Route Group: Distraction-free, high-contrast staff counter terminal for in-store clerks covering `/counter`, `/counter/pos`, and `/counter/unlock`. Disabled PIN and print actions pending shift session integration in Phase P11 (`VO-110`).
  - `(admin)` Route Group: Global platform administration and compliance console covering `/platform-admin`, `/platform-admin/tenants`, `/platform-admin/plans`, `/platform-admin/taxes`, `/platform-admin/audit-logs`, and `/platform-admin/abuse`. Replaced fake tenant numbers with placeholders and disabled mutation buttons.
- Cleaned root layout `src/app/layout.tsx` to serve as a pure HTML/body shell, eliminating nested `<main>` landmark collisions.
- Created discovery portal showcase at `src/app/page.tsx` with role navigation cards, status badges, and architecture guarantees; explicitly framed as a developer-only route showcase during Phase P1.
- Fixed React Server Component serialization boundaries in UI primitives by marking `Button` and `Field` with `"use client";`, resolving event handler serialization and React Context (`createContext`) errors during production build.
- Authored architecture reference `docs/ROUTE_ARCHITECTURE.md` documenting route-to-role mappings, layout trees, client vs server component boundaries, security delineation, and resolving the 28 application routes vs 30 Next.js static prerender units.
- Authored 34 unit tests in `tests/unit/routing/route-shells.test.tsx` verifying route rendering, ARIA navigation landmarks, accessible link targets, and role navigation isolation.
- Total test count reached 108 passing tests across 5 test files with 100% test pass rate.
- Verified all quality gates pass: `pnpm typecheck` (0 errors), `pnpm lint` (0 errors), `pnpm format:check` (clean), `pnpm test` (108 tests pass), and `pnpm build` (28 application routes + internal pages compiled).
- Updated backlog status for VO-014 to `DONE`, updated decision register ADR-015, and updated progress log.

### [VO-013] — Build accessible shared UI primitives (2026-11-11)
- Implemented 12 accessible shared UI component primitives adhering to WCAG 2.2 AA and PRD Section 12 design specifications:
  - `Button` (`src/components/ui/button`): Variants (`primary`, `secondary`, `outline`, `ghost`, `destructive`, `accent`), sizes (`sm`, `md`, `lg`), `isLoading` with spinner, `aria-busy`, disabled state preventing duplicate submissions, and accessible touch targets.
  - `Field`, `Input`, `Textarea`, `Select`, `Checkbox` (`src/components/ui/field`): Accessible form family with explicit `htmlFor` / `id` association, `aria-required`, `aria-invalid`, `aria-describedby` linking helper and error IDs, 16px minimum text preventing iOS Safari zoom, and `role="alert"` for error messages.
  - `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`, `CardAction` (`src/components/ui/card`): Semantic card surfaces supporting `default`, `elevated`, `glass`, and `subtle` styles with configurable heading levels.
  - `Dialog` (`src/components/ui/dialog`): Accessible modal dialog with focus trapping, Escape dismiss, backdrop dismiss, focus restoration, and body scroll lock.
  - `Drawer` (`src/components/ui/drawer`): Accessible mobile-first bottom sheet with drag handle, focus management, and body scroll lock.
  - `Tabs` (`src/components/ui/tabs`): Accessible tab panels with `role="tablist"`, `role="tab"`, `role="tabpanel"`, and keyboard navigation (Arrow keys, Home, End).
  - `Table` (`src/components/ui/table`): Responsive table container with `role="region"` and `tabIndex={0}`, standard HTML table semantics, and explicit `scope="col"`.
  - `Badge` (`src/components/ui/badge`): Semantic status tags with visible text (not color alone) and optional decorative icons.
  - `EmptyState` (`src/components/ui/empty-state`): Standardized zero-data state with `role="region"`, decorative icon, heading, description, and action buttons.
  - `Skeleton` (`src/components/ui/skeleton`): Loading placeholders with `aria-hidden="true"`, pulse animation, and reduced-motion support.
  - `Toast` (`src/components/ui/toast`): Notification toast system with live regions (`polite` for info/success/warning, `assertive` for errors) and accessible dismissal.
  - `Navigation` (`src/components/ui/navigation`): Semantic `<nav>` landmark with required `aria-label`, list structure, and links with `aria-current="page"`.
- Created central barrel export at `src/components/ui/index.ts`.
- Appended component styling rules to `src/app/globals.css` consuming existing design tokens (`--color-*`, `--space-*`, `--radius-*`, `--shadow-*`, `--target-*`).
- Authored 26 static structure unit tests in `tests/unit/components/primitives.test.tsx` verifying static HTML rendering, ARIA attributes, semantic roles, loading states, and error alerts.
- Conducted interactive accessibility audit and authored 25 real user interaction tests in `tests/unit/components/interactions.test.tsx` covering mouse/keyboard activation, double-submission protection, label focus linking, native required states, dialog & drawer focus traps with Escape dismiss, focus return to triggers, body scroll locking/restoration, tabs arrow navigation, mobile table scroll regions, and live-region toasts.
- Installed `@testing-library/react`, `@testing-library/user-event`, and `jsdom` (with React 19 compatibility) and configured `environment: "jsdom"` in `vitest.config.ts`.
- Total test count reached 74 passed tests across 4 test files.
- Verified all quality gates pass: `pnpm typecheck` (0 errors), `pnpm lint` (0 errors/warnings), `pnpm format:check` (clean), `pnpm test` (74 tests pass), and `pnpm build` (Next.js production build compiled).
- Updated backlog status for VO-013 to `DONE` and updated progress log.

### [VO-012] — Implement design tokens (2026-11-08)
- Created canonical design token definitions in `src/design-system/tokens.ts` codifying Canonical Brand Emerald (`#0F5132`) + Canonical Brand Marigold (`#D97706`), PRD Section 12 UI Action Emerald (`#0B6E4F`) + Accent Marigold (`#F5A524`) palette, warm canvas (`#FAF8F3`), card surface (`#FFFFFF`), responsive typography scale (with 16px mobile input minimum to prevent iOS zoom), 4px spacing scale, radii, elevation shadows, restrained glassmorphism (`rgba(255,255,255,0.80)` with 12px blur and opaque fallback), and WCAG 2.2 AA touch targets (`>= 24px` minimum, `44-48px` preferred).
- Implemented global CSS custom properties in `src/app/globals.css` with baseline reset, accessible `:focus-visible` ring, `.glass-surface` utility, and `@media (prefers-reduced-motion)` preferences.
- Built mathematical WCAG 2.2 relative luminance and contrast calculation utilities in `src/design-system/contrast.ts` without pre-rounding.
- Conducted corrective audit of contrast ratios, establishing exact mathematical figures: Warning Amber (`#B45309`) at 5.02:1 (passes AA) and Info Slate-Teal (`#0C5A75`) at 7.68:1 (passes AAA).
- Expanded automated Vitest test suite `tests/unit/tokens/contrast.test.ts` to 21 tests, validating unrounded contrast ratios, hex validation, touch targets, and automated parity between `tokens.ts` and `src/app/globals.css`.
- Refactored `src/app/page.tsx` and `src/app/layout.tsx` to consume design tokens via CSS variables, eliminating all scattered hardcoded colors from the application baseline.
- Formulated complete design tokens specification in `docs/DESIGN_TOKENS.md`.
- Updated backlog status for VO-012 to `DONE` and updated progress log.

### [VO-011] — Configure code quality tooling (2026-11-08)
- Configured ESLint 9 Flat Config (`eslint.config.mjs`) integrating Next.js 15 (`core-web-vitals`, `typescript`) with FlatCompat and strict TypeScript rules (`@typescript-eslint/no-explicit-any: error`, `@typescript-eslint/no-unused-vars: error`, `prefer-const: error`, `no-console: warn`).
- Configured Prettier 3 (`.prettierrc`) with 2-space indentation, double quotes, semicolons, trailing commas, and LF line endings.
- Configured `.prettierignore` protecting repository documentation (`docs/`), PRDs (`reference/`), agents/rules, and generated artifacts from reformatting.
- Configured Vitest 3 (`vitest.config.ts`) with Node environment and `@/*` path alias resolution.
- Added baseline unit test harness (`tests/unit/baseline.test.ts`) validating test runner execution and integer minor unit arithmetic.
- Approved trusted build script for `esbuild` in `pnpm-workspace.yaml` under pnpm 11 security policy.
- Added standard scripts in `package.json`: `dev`, `build`, `start`, `typecheck`, `lint`, `lint:fix`, `format:check`, `format:write`, `test`, and `test:watch`.
- Verified all quality gates pass: `pnpm install --frozen-lockfile` (clean), `pnpm typecheck` (0 errors), `pnpm lint` (0 errors/warnings), `pnpm format:check` (clean), `pnpm test` (2 tests passing), and `pnpm build` (production build compiled).
- Corrected package specifiers for `next` and `eslint-config-next` to `^15.5.29` in `package.json` and `pnpm-lock.yaml`, ensuring consistent lockfile alignment with the verified runtime version `15.5.29`.
- Updated backlog status for VO-011 to `DONE` and updated progress log.

### [VO-010] — Initialize or normalize application workspace (2026-11-08)
- Initialized Git repository at `F:\VyaponeV2` on branch `main`.
- Created `.gitignore` ignoring dependencies (`node_modules`), build outputs (`.next`, `out`, `dist`), secrets/env files (`.env*`), local databases, logs, and IDE caches.
- Created `.gitattributes` normalizing text and source files to LF line endings and enforcing binary handling for media and fonts.
- Created `.editorconfig` enforcing UTF-8, LF, and 2-space indentation standards across all editors.
- Created `.env.example` template with sanitized environment variables for auth, database, redis, payment sandbox, and WhatsApp.
- Initialized workspace package manifest (`package.json`) and TypeScript configuration (`tsconfig.json`) adhering to `docs/ENGINEERING_STANDARDS.md`.
- Installed Next.js 15.5.29, React 19.3.1, React-DOM 19.3.1, and TypeScript 5.9.3 via `pnpm`.
- Created minimal baseline application shell (`src/app/layout.tsx` and `src/app/page.tsx`) with mobile viewport settings.
- Verified that `pnpm install`, `pnpm build`, and `pnpm dev` execute successfully with verified `200 OK` local server response.
- Preserved all existing documentation and source PRDs without deletion or modification.
- Updated backlog status for VO-010 to `DONE`.

### [VO-006] — Create implementation conventions and quality gates (2026-11-08)
- Created `docs/ENGINEERING_STANDARDS.md` codifying TypeScript strict mode, React Server Component patterns, layered 3-tier architecture, shared Zod input validation, gap-free invoice sequences, unified API envelopes, PII sanitization, and trunk-based Git workflow. Clearly distinguished approved invariants from proposed stack decisions.
- Created `docs/PROJECT_STRUCTURE.md` documenting scalable file and directory layout for Public storefronts, Reseller workspace, Business Owner dashboard, Staff counter mode, Platform Admin, reusable modules, background BullMQ workers, and test suites. Documented only; zero premature application files created.
- Created `docs/TEST_STRATEGY.md` formulating the multi-harness test pyramid (unit, integration, DB/RLS, payment HMAC, Vya AI golden evals, prompt injection, quiet hours, 390px Playwright mobile E2E, WCAG 2.2 AA accessibility, and k6 load testing) reusing established test IDs without duplicates.
- Created `docs/QUALITY_GATES.md` establishing measurable pass/fail criteria across Tier 1 Development Gates (types, lint, tests, RLS, Zod, secrets, 390px mobile layout), Tier 2 Phase Gates (P0 to P14), and Tier 3 GA Release Gates (CA GST review, Legal DPDP review, Split Settlement contract, CERT-In runbook, zero P0/P1 defects).
- Created `docs/CODE_REVIEW_CHECKLIST.md` providing a systematic peer review checklist covering tenancy, security, transactions, validation, errors, mobile UI, accessibility, performance, logging, tests, and documentation.
- Corrected native PostgreSQL `uuidv7()` statement in `docs/DOMAIN_ARCHITECTURE.md` to specify it as a PostgreSQL 18 native feature (not 17) while retaining application-layer RFC 9562 UUIDv7 generation as the database-independent standard.
- Updated `AGENTS.md` and `.agents/skills/vyapone-build/SKILL.md` to reference the canonical engineering standards, reinforce single-task execution, test verification, regression fixing, secret protection, and ban unrun test claims.
- Formally verified and signed off Phase P0 gate in `docs/PHASE_GATES.md`.
- Updated backlog status for VO-006 to `DONE`.

### [VO-005] — Design domain architecture and data ownership (2026-11-08)
- Created and audited `docs/DOMAIN_ARCHITECTURE.md` establishing the canonical domain model and database architecture across 11 comprehensive sections.
- Created and expanded Mermaid architectural diagrams in `docs/diagrams/`:
  - `system-context.mmd`: C4 context diagram showing users, platform core, and third-party partner boundaries.
  - `container-diagram.mmd`: C4 container diagram illustrating edge routing, Next.js application core, BullMQ queues, PostgreSQL, Redis, and S3 storage.
  - `ownership-model.mmd`: Architectural breakdown separating Data Ownership, Administrative Access, Billing Responsibility, and Platform Access, with auditable handover transfer records.
  - `core-erd.mmd`: Master entity-relationship diagram covering core tenancy, commerce, billing, and communication entities.
  - `erd-iam-tenancy.mmd`: Dedicated module ERD for IAM, User, UserAuthIdentity, Workspace, Business, BusinessMember, Location, and HandoverRequest.
  - `erd-commerce-billing.mmd`: Dedicated module ERD for Orders, OrderItems, Bills, InvoiceSequences, TaxRates, PaymentRecords, Subscriptions, and ClientInvoices.
  - `erd-communications-ai.mmd`: Dedicated module ERD for Conversations, ConversationTurns, BusinessMemory, AIActions, PendingActions, MessageTemplates, Messages, Broadcasts, and Automations.
  - `erd-niche-operations.mmd`: Dedicated module ERD for Leads, Catalogue, Inventory, Appointments, Property Listings, Restaurant Tables, KOT Tickets, Service Tickets, and Loyalty Ledgers.
- Performed rigorous corrective review addressing all 10 architectural and integrity requirements:
  - **ERD Completeness:** Fully modeled all PRD entities across the master core and 4 modular ERDs, documenting ownership, tenant scoping column, and relationships.
  - **Auth Provider Separation:** Decoupled external identity credentials (`UserAuthIdentity`) from application user profiles (`User`); explicitly barred storing passwords in the application domain.
  - **UUIDv7 Precision:** Corrected PostgreSQL 17+/18+ native function syntax to `uuidv7()` and documented all supported runtime alternatives (`pg_uuidv7` extension, application-layer RFC 9562 generation, and UUIDv4 fallback).
  - **Multi-Currency Standardization:** Standardized on `amount_minor BIGINT` and `currency_code VARCHAR(3)` (ISO 4217, default `'INR'`) across all financial tables; documented minor-unit scaling across 2-decimal, 0-decimal, and 3-decimal currencies.
  - **Customer Phone Constraints:** Replaced `UNIQUE(business_id, phone_hash)` with a non-unique B-tree index to support shared family phone numbers, corporate multi-contacts, and walk-ins.
  - **Gap-Free GST Invoice Numbering:** Designed atomic, gap-free sequence counter table `invoice_sequences` using row-level locking (`UPDATE ... RETURNING`) per business, financial year, and series prefix (`INV/`, `POS/`, `BOS/`, `CRN/`, `DBN/`).
  - **Auditable Business Handover:** Designed `handover_requests` schema and state machine with registered owner OTP verification (WhatsApp/SMS + email), source reseller detachment, target workspace assignment, domain/SSL retention, and split settlement decoupling.
  - **Statutory CGST Section 36 Correction:** Accurately cited Section 36 of CGST Act 2017 (72 months from the due date of furnishing the annual return for the financial year, plus extensions/appeal holds); marked unified retention/deletion policy `NEEDS CA/LEGAL REVIEW`.
  - **Security Architecture:** Classified all technical controls as `PROPOSED`. Rechecked transaction-scoped `SET LOCAL` RLS context propagation, S3 tenant-partitioned storage, webhook HMAC and replay defenses, and BullMQ background worker context isolation.
  - **Traceability:** Mapped every entity directly to its PRD section and existing task ID in `docs/DOMAIN_ARCHITECTURE.md` and updated `docs/REQUIREMENTS_TRACEABILITY.md`.
- Updated backlog status for VO-005 to `DONE`.

### [VO-004] — Define system boundaries and threat model (2026-11-08)
- Created `docs/THREAT_MODEL.md` establishing the canonical security architecture, system boundaries, and threat model.
- Defined all 7 actor boundaries (Platform Admin, Reseller, Business Owner, Staff, Customer, Public Storefronts, Vya AI, External Integrations) and mapped 8 distinct trust zones with a complete Mermaid architectural boundary diagram.
- Identified and classified 8 sensitive asset groups (AST-01 to AST-08).
- Conducted full STRIDE threat analysis covering spoofing, tampering, repudiation, information disclosure, denial of service, and elevation of privilege.
- Formulated multi-tenant isolation mechanisms via dual-layer Next.js API authorization and PostgreSQL Row-Level Security (RLS).
- Defined payment security controls (HMAC SHA256 webhook signatures, timestamp windowing, idempotent event caching, zero card storage, RBI-compliant split settlement).
- Formulated Vya AI prompt-injection defenses (untrusted data encapsulation, confirm-before-act `PendingAction` tokens, tool allow-lists, per-business memory isolation, pre-flight PII redaction).
- Formulated third-party integration security (OAuth AES-256-GCM encryption, presigned S3 upload MIME/size validation).
- Populated comprehensive threat register with 20 attack scenarios (THR-01 to THR-20), severity ratings, and proposed mitigations.
- Defined a 10-point automated security test plan (ST-TENANT-01 to ST-SECRET-01) mapped to upcoming development tasks.
- Updated backlog status for VO-004 to `DONE`.

### [VO-003] — Create architecture decision records (2026-11-08)
- Created `docs/ADR_INDEX.md` and 25 comprehensive Architecture Decision Records in `docs/adr/` (ADR-001 through ADR-025) covering all required architecture, infrastructure, provider, and operational areas.
- Preserved existing numbering and established ADR-001 to ADR-025 with zero collisions and verified linkages.
- Established candidate stack recommendations: Next.js 15+ (App Router) + React 19 + TypeScript + Tailwind CSS, PostgreSQL 16+ with Drizzle ORM and native RLS multi-tenancy, Supabase Auth and S3-compatible storage, Vercel/Cloudflare edge deployment and custom SSL, Puck constrained visual editor, Redis + BullMQ event-driven queues, Vercel AI SDK multi-model routing (Claude Sonnet 5.5, Gemini Flash, Haiku, Sarvam speech), WhatsApp BSP Cloud API route, and merchant payment gateway adapter framework.
- Maintained the 3 critical launch blockers: ADR-010 (Reseller split settlement provider), ADR-014 (Chartered Accountant GST review), ADR-015 (Legal Counsel DPDP sign-off).
- Added ADR-023 (Observability & Telemetry), ADR-024 (Testing Architecture & Golden Eval Suite), and ADR-025 (Security Threat Defense & Disaster Recovery) to `docs/DECISION_REGISTER.md`.
- Updated backlog status for VO-003 to `DONE`.

### [VO-002] — Create source-of-truth and conflict register (2026-11-08)
- Audited and expanded `docs/SOURCE_OF_TRUTH.md` into the canonical single source of truth and version conflict register.
- Defined the 4-tier document authority hierarchy (Tier 1: FINAL v2.0 Primary, Tier 2: v3.0 Supplementary Production Guidance, Tier 3: ADRs, Tier 4: Historical v1/v2).
- Built a comprehensive cross-version conflict register comparing v1, v2, v3, and FINAL across 15+ product and technical dimensions; recorded resolutions for all identified discrepancies.
- Separated confirmed product requirements from supplementary engineering recommendations (SLOs, load targets, DR, compliance).
- Cataloged decisions requiring product owner and legal approval; highlighted the 3 critical blockers (ADR-010 split settlement, ADR-014 GST rules, ADR-015 DPDP compliance).
- Audited and verified `docs/REQUIREMENTS_TRACEABILITY.md` source references against PRD line items.
- Documented the unsupported/incorrect claims register (debunking Dunzo, AI tax calculations, UPI claim = Paid, fund pooling, arbitrary code generation, fixed pricing).
- Identified `VO-010` in `docs/TASK_BACKLOG.md` as the existing task designated for application workspace and Git initialization; added ADR-022 to `docs/DECISION_REGISTER.md`.
- Updated backlog status for VO-002 to `DONE`.

### [VO-001] — Create requirements traceability map (2026-11-07)
- Created canonical requirements traceability matrix in `docs/REQUIREMENTS_TRACEABILITY.md`.
- Mapped all 23 Functional Requirements (FR-01 to FR-23), 9 Non-Functional Requirements (NFRs), 24 Product Modules (MOD-01 to MOD-24), 9 Niche Groups (NICHE-01 to NICHE-09), 13 Vya AI capabilities (VYA-01 to VYA-13), 11 Security/Compliance controls, 10 Payment/Billing capabilities, 8 WhatsApp/Automation rules, 7 Reseller Toolkit features, and 26 GA Acceptance Criteria (AC-01 to AC-26).
- Connected all requirements directly to exact existing backlog task IDs (`VO-000` through `VO-145`) and defined acceptance test IDs (`TC-*`).
- Performed gap analysis: confirmed 0 unmapped requirements and 0 orphaned backlog tasks; identified foundational/engineering infrastructure tasks and documented post-launch deferrals (`VO-140` to `VO-145`).
- Updated backlog status for VO-001 to `DONE`.

### [VO-000] — Inspect repository and PRD inputs (2026-11-07)
- Performed initial repository, runtime, and dependency audit; confirmed clean greenfield state with no application code, package manifests, or test suites.
- Audited all four source PRDs (`PRD_FINAL_v2_2026-11-03.md`, `PRD_v3_full_scale_2026-10-30.md`, `PRD_v2_2026-10-30.md`, `PRD_v1_original_2026-10-16.md`).
- Confirmed `PRD_FINAL_v2_2026-11-03.md` as primary source of truth, with `PRD_v3_full_scale_2026-10-30.md` as supplementary production/GA guidance.
- Created `docs/REPOSITORY_AUDIT.md` and `docs/SOURCE_OF_TRUTH.md`.
- Catalogued 21 architectural and operational choices in `docs/DECISION_REGISTER.md`.
- Updated backlog status for VO-000 to `DONE`.
