# CLOUD-007 — Comprehensive SQL Defect Remediation & Schema Contract Alignment

> [!WARNING]
> **Release Decision: NO-GO (LOCAL REMEDIATION COMPLETE / POSTGRESQL EXECUTION & LINUX CI NOT RUN)**  
> All SQL schema/RPC defects identified in `CLOUD-006` and `CLOUD-007` inside pending migrations (`20261122000002`, `20261122000003`), historical runtime RPCs (`20261125000001`), and `src/lib/websites/service.ts` have been remediated **locally**. No production database writes, Git pushes, GitHub Actions runs, or Cloudflare deployments were executed. Isolated real PostgreSQL execution (`scripts/ci/verify-supabase-migrations.mjs`) remains **`NOT RUN` / `NOT VERIFIED`** on this Windows host because Docker / WSL2 / local PostgreSQL are unavailable, and clean-DB initialization (`supabase db reset`) remains **`BLOCKED`** at immutable historical migration `20261117000002` pending an approved migration-history recovery decision (`ADR-028`).

---

## 1. Migration History Safety & Classification

Before modifying any SQL files, all repository migrations (`supabase/migrations/`) were classified into three strict tiers:

| Tier | Range / Files | Production Status | Edit Policy & Remediation Strategy |
|---|---|---|---|
| **Historical (Immutable)** | Migrations 1–25 (`20261112000001_initial_schema.sql` through `20261120000003_revoke_column_insert_and_enforce_restrictive_rls.sql`) | Applied in production per `CLOUD-002` | **UNTOUCHED / IMMUTABLE.** Never edited in place and never masked with fake stubs. Note historical numbering variance: `CLOUD-004` cited `20261121000002` as #25, whereas migration #25 on disk is `20261120000003_revoke_column_insert_and_enforce_restrictive_rls.sql`. |
| **Pending Production** | Migrations 26–28 (`20261122000001`, `20261122000002`, `20261122000003`) | Unapplied in production | `20261122000001` verified unchanged; `20261122000002` and `20261122000003` remediated directly in place. |
| **Forward Corrective** | Migration 29 (`20261125000001_remediate_historical_schema_and_rpc_defects.sql`) | New pending migration | Additive/compatible forward remediation (`CREATE OR REPLACE FUNCTION`, trigger replacement) fixing confirmed runtime SQL defects from migrations 1–25 safely on top of existing schema. |

---

## 2. Classification of Historical, Pending & Application Findings

| ID | Target Migration / Module | Reported or Discovered Defect | Status | Notes / Verification |
|---|---|---|---|---|
| **2A** | `20261117000002_audit_and_notification_foundation.sql` | `trg_notifications_updated_at` calls `public.update_updated_at_column()`, which does not exist in migrations 1–28 (`public.set_updated_at()` is canonical). | **FIXED LOCALLY** (live upgrade) / **BLOCKED** & **REQUIRES SEPARATE APPROVAL** (clean-DB reset) | `20261125000001` drops and recreates `trg_notifications_updated_at` pointing to `public.set_updated_at()` so updates on existing/production DBs work safely. Clean from-zero DB bootstrap still stops at `20261117000002` unless a separate recovery plan (`ADR-028`) is approved. |
| **2B** | `20261117000001_team_invitations_and_membership_lifecycle.sql` | `accept_workspace_invitation_atomic(TEXT, UUID, TEXT)` referenced non-existent `workspace_members.updated_at` (`workspace_members` has `id, workspace_id, user_id, role, status, created_at`). | **FIXED LOCALLY** / Unconfirmed sibling **VERIFIED** safe | Replaced in `20261125000001` omitting `workspace_members.updated_at` while keeping `workspaces` row locking, `team_seats` capacity check, and `authenticated`/`service_role` grants. Verified `accept_business_invitation_atomic` already omitted `updated_at` cleanly. |
| **2C** | `20261119000001_atomic_business_creation.sql` & `20261119000002_atomic_business_import.sql` | Queried non-existent `niches.niche_group_slug` instead of joining `public.niche_groups ng ON ng.id = n.niche_group_id` (`20261118000001`). | **FIXED LOCALLY** | Verified `src/lib/businesses/service.ts` and `src/lib/businesses/import/service.ts` pass canonical `category` strings matching `ng.slug`. Replaced both functions in `20261125000001` while preserving VO-040 grants (`REVOKE ... FROM PUBLIC, anon, service_role; GRANT EXECUTE ... TO authenticated;`). |
| **2D** | `20261115000001_plans_entitlements_capacity.sql` & `20261116000001_harden_capacity_locking_and_sqlstate.sql` | 1) `transition_site_status_atomic` updates non-existent `sites.published_at`;<br>2) `check_site_publish_capacity_trigger()` used `<> 'true'` on `current_setting('vyapone.in_atomic_site_transition', true)`, evaluating `NULL` (falsy/bypass) when unset;<br>3) `SELECT coalesce(additional_capacity, 0) INTO v_override` assigns `NULL` on 0 rows (`v_base + NULL = NULL`, bypassing capacity checks);<br>4) `scale.locations_per_business` was `25` vs `50` in `src/lib/plans/constants.ts`. | **FIXED LOCALLY** | `20261125000001` replaces `check_site_publish_capacity_trigger()`, `assert_and_lock_workspace_capacity()`, and `transition_site_status_atomic()`, fixing all four issues (`IS DISTINCT FROM 'true'`, scalar-coalesced `(SELECT ...)`, removing `sites.published_at`, setting `scale.locations_per_business := 50`). Noted that `assert_and_lock_workspace_capacity` retains workspace-level `VY003` enforcement for direct workspace callers while business owners/managers publish/rollback via lock-consistent site RPCs. |
| **M1** | `20261122000001_website_draft_concurrency_and_optimistic_lock.sql` | `save_site_draft_configuration_atomic` contract and security audit. | **VERIFIED** (no edits needed) | Confirmed `8-arg` signature, `can_manage_business`, `FOR UPDATE OF s`, `VY049` optimistic concurrency check, canonical `audit_logs` columns, and strict `authenticated` grant. |
| **M2** | `20261122000002_website_rollback_rpc.sql` | Rollback to a historical version of an unpublished site could bypass `live_websites` capacity checks, lock out of canonical order, or publish for archived businesses. | **FIXED LOCALLY** | Enforced canonical lock ordering (`workspaces` -> `businesses` -> `sites FOR UPDATE OF s`), rejected archived businesses (`VY002`), added canonical `live_websites` capacity enforcement (`ERRCODE = 'VY001'`, strictly when `v_site.status <> 'published'` and the business has no other published site so capacity-neutral rollbacks remain permitted; same-business slot replacement demotes prior published site), and sets `pg_catalog.set_config('vyapone.in_atomic_site_transition', 'true', true)`. |
| **M3** | `20261122000003_website_publishing_domains_and_qr.sql` | Referenced non-existent `workspaces.plan_id` and `capacity_overrides.limit_override`; returned `'mainQrSlug'` instead of `'mainQrCode'`; omitted `type = 'storefront'` in QR insert/default; lacked capacity bypass GUC flag, lock ordering, archived business guard (`VY002`), distinct live business count, and canonical error `SQLSTATE`. | **FIXED LOCALLY** | Updated `qr_codes.destination_configuration` default and insert to `{"type":"storefront"}`; updated `publish_site_draft_atomic` to return `'mainQrCode', pg_catalog.row_to_json(v_main_qr)`; fixed plan lookup (`subscriptions` -> `workspaces.plan`), scalar-coalesced `capacity_overrides.additional_capacity`, canonical plan tiers (`starter=3, growth/pro=8, agency=20, scale=50`), distinct non-archived live business counting, same-business replacement demotion, archived business rejection (`VY002`), `workspaces -> businesses -> sites` lock ordering, `bm.role IN ('owner', 'manager')` + `workspaces.owner_user_id` RLS/RPC parity, `ERRCODE = 'VY001'`, and `set_config('vyapone.in_atomic_site_transition', 'true', true)`. |
| **APP-1** | `src/lib/websites/service.ts` | Optimistic conflict (`VY049`) checks matched generic conflict strings before capacity errors (`VY001`, `VY042`, `"limit reached"`, `"Capacity limit"`), and `VY002` / `VY005` lacked structured codes. | **FIXED LOCALLY** | Updated `publishSiteDraft` and `rollbackPublishedVersion` error mapping to evaluate capacity errors prior to `CONFLICT` and map `VY002` (`BUSINESS_ARCHIVED`) and `VY005` (`INVALID_PLAN`). |

---

## 3. Clean-DB History Recovery Options (Requires Separate Approval)

Because immutable historical migration `20261117000002_audit_and_notification_foundation.sql` calls missing `public.update_updated_at_column()`, an empty database (`supabase db reset` / isolated CI `supabase db push` starting from migration #1) **stops at `20261117000002`**. Even though `20261125000001` cleanly upgrades any existing database (including production if `update_updated_at_column()` existed there out-of-band), clean-room bootstrap requires an explicit governance choice:

1. **Option A (Recommended for clean CI + parity):** After exporting production's exact applied baseline (`supabase db dump --schema public` excluding sensitive rows) and verifying what exists in production for `public.update_updated_at_column()`, create a separately approved squashed baseline migration up through `20261120000003` with `supabase migration repair` synchronization, keeping pending migrations `20261122000001`–`20261125000001` cleanly testable from empty databases.
2. **Option B (Minimal targeted historical exception):** Obtain explicit approval to add a minimal backward-compatible trigger fix or clean-history exception on `20261117000002` ONLY after inspecting production's `pg_proc` / `supabase_migrations.schema_migrations` state.

No historical rewrite or workaround was performed in `CLOUD-007` (`ADR-028`: `REQUIRES_APPROVAL`).

---

## 4. Modified & Verified Repository Files

- `supabase/migrations/20261122000002_website_rollback_rpc.sql` (modified)
- `supabase/migrations/20261122000003_website_publishing_domains_and_qr.sql` (modified)
- `supabase/migrations/20261125000001_remediate_historical_schema_and_rpc_defects.sql` (created)
- `src/lib/websites/service.ts` (modified)
- `scripts/ci/verify-supabase-migrations.mjs` (expanded for `mainQrCode`, `type=storefront`, zero-row `capacity_overrides`, capacity-neutral vs capacity-increasing rollback, `trg_notifications_updated_at -> set_updated_at()`, `accept_workspace_invitation_atomic`, `transition_site_status_atomic`, GUC direct-update block, all split into single-statement parameterized `client.query` calls)
- `tests/unit/database/website-rollback-migration.test.ts` (modified)
- `tests/unit/database/website-publishing-migration.test.ts` (modified)
- `tests/unit/database/schema-remediation-migration.test.ts` (created)
- `tests/unit/websites/pre-publish-and-publishing.test.tsx` (modified)
- `tests/unit/websites/versions-rollback.test.tsx` (modified)
- `tests/unit/ci/cloudflare-validation.test.ts` (modified)
- `docs/SUPABASE_SCHEMA_REMEDIATION_CLOUD-007.md`, `docs/DECISION_REGISTER.md`, `docs/CLOUDFLARE_DEPLOYMENT.md`, `docs/PROGRESS.md`, `docs/CHANGELOG.md` (created/updated)

---

## 5. Production Migration Sequence & Remaining Blockers

Once clean-DB recovery (`ADR-028`) and Linux CI PostgreSQL verification are approved and pass:

1. **Production migration order (pending only):**
   1. `20261122000001_website_draft_concurrency_and_optimistic_lock.sql`
   2. `20261122000002_website_rollback_rpc.sql`
   3. `20261122000003_website_publishing_domains_and_qr.sql`
   4. `20261125000001_remediate_historical_schema_and_rpc_defects.sql`
2. **Unverified runtime gates (`NOT VERIFIED` / `NOT RUN` locally):**
   - `scripts/ci/verify-supabase-migrations.mjs` execution against real PostgreSQL 15/17 (`NOT RUN` on Windows without Docker/PostgreSQL).
   - `.github/workflows/cloudflare-validation.yml` Linux OpenNext build & `workerd` runtime probe (`NOT RUN`; local code not pushed).
3. **Final Release Status:** **NO-GO** until Linux CI (`CLOUD-006`) executes against a real PostgreSQL environment resolving `ADR-028`, all live-DB integration tests pass, and explicit deployment authorization is granted.
