# CLOUD-008 — Clean Database Recovery Strategy & Linux CI / PostgreSQL Verification Readiness

> [!WARNING]
> **Release Decision: NO-GO (BLOCKED — USER / OWNER AUTHORIZATION & REAL POSTGRESQL VERIFICATION REQUIRED)**  
> This assessment is **read-only architecture and documentation only**. Zero historical migrations were modified, zero baseline/squash migrations were created, zero production SQL statements were run, zero Git pushes or GitHub Actions dispatches were triggered, and zero Cloudflare Worker changes were performed.
> **Actual PostgreSQL / Linux `workerd` execution on this host: `NOT RUN`** (`docker`, `supabase`, `psql`, and `git` are not installed on `PATH`).

---

## 1. Reconciled Migration Inventory (`supabase/migrations/`)

All **29** `.sql` files on disk in sorted timestamp order, evaluated strictly against existing verified evidence ([`CLOUDFLARE_PREFLIGHT_CLOUD-002.md`](file:///f:/VyaponeV2/docs/CLOUDFLARE_PREFLIGHT_CLOUD-002.md), which inspected `https://fjoezwoyowihbxacmoyp.supabase.co` via PostgREST OpenAPI introspection — **not** `supabase_migrations.schema_migrations`):

> [!IMPORTANT]
> **Evidence Boundary Note:** `CLOUD-002` PostgREST OpenAPI introspection proved the existence of **29 public tables/views** and **20 public RPC signatures** (including 7-arg `save_site_draft_configuration_atomic`, while missing `site_domains`, `qr_codes`, `rollback_published_site_version_atomic`, and `publish_site_draft_atomic`). Because OpenAPI introspection does **not** read `supabase_migrations.schema_migrations`, triggers, column ACL revocations, or RLS `AS RESTRICTIVE` clauses, presence in `schema_migrations` is marked **`NOT VERIFIED`** wherever only trigger/ACL/policy changes exist or exact `schema_migrations` row timestamps remain unqueried.

| Pos | Timestamp / Version | Filename | Class | Evidence of Production Application | Modified Locally | Clean Bootstrap Required |
|---:|---|---|---|---|---|---|
| 01 | `20261112000001` | `20261112000001_initial_schema.sql` | Historical | **PARTIAL (`CLOUD-002`) / `schema_migrations` NOT VERIFIED** — All 14 base tables present in OpenAPI | No | Yes |
| 02 | `20261112000002` | `20261112000002_auth_profile_trigger.sql` | Historical | **NOT VERIFIED** — Auth trigger `on_auth_user_created` / fn replaced later; invisible to OpenAPI | No | Yes |
| 03 | `20261112000003` | `20261112000003_secure_search_path_and_workspace_roles.sql` | Historical | **PARTIAL (`CLOUD-002`) / `schema_migrations` NOT VERIFIED** — `workspace_invitations` table present | No | Yes |
| 04 | `20261113000001` | `20261113000001_business_location_core.sql` | Historical | **PARTIAL (`CLOUD-002`) / `schema_migrations` NOT VERIFIED** — `create_business_with_primary_location` RPC present | No | Yes |
| 05 | `20261113000002` | `20261113000002_enforce_tenant_isolation.sql` | Historical | **PARTIAL (`CLOUD-002`) / `schema_migrations` NOT VERIFIED** — All 8 tenancy helper RPCs present | No | Yes |
| 06 | `20261114000001` | `20261114000001_fix_auth_profile_trigger_and_rls.sql` | Historical | **NOT VERIFIED** — `NO FORCE RLS`, grants, trigger replacement invisible to OpenAPI | No | Yes |
| 07 | `20261114000002` | `20261114000002_business_profile_settings.sql` | Historical | **NOT VERIFIED** (per `CLOUD-002` summary list; column/policy alterations not listed individually in `CLOUD-002`) | No | Yes |
| 08 | `20261115000001` | `20261115000001_plans_entitlements_capacity.sql` | Historical | **PARTIAL (`CLOUD-002`) / `schema_migrations` NOT VERIFIED** — `subscriptions`, `entitlement_overrides`, `capacity_overrides`, 2 RPCs present | No | Yes |
| 09 | `20261115000002` | `20261115000002_harden_auth_trigger_and_profile_rls.sql` | Historical | **PARTIAL (`CLOUD-002`) / `schema_migrations` NOT VERIFIED** — `user_directory` view & `ensure_user_profile` RPC present | No | Yes |
| 10 | `20261116000001` | `20261116000001_harden_capacity_locking_and_sqlstate.sql` | Historical | **PARTIAL (`CLOUD-002`) / `schema_migrations` NOT VERIFIED** — `raise_capacity_exceeded` RPC present | No | Yes |
| 11 | `20261116000002` | `20261116000002_harden_sites_table_privileges_and_rpc.sql` | Historical | **NOT VERIFIED** — Column-level grants & `check_site_insert_status_trigger` invisible to OpenAPI | No | Yes |
| 12 | `20261117000001` | `20261117000001_team_invitations_and_membership_lifecycle.sql` | Historical | **PARTIAL (`CLOUD-002`) / `schema_migrations` NOT VERIFIED** — `business_invitations` table & 3 RPCs present | No | Yes |
| 13 | `20261117000002` | `20261117000002_audit_and_notification_foundation.sql` | Historical | **PARTIAL (`CLOUD-002`) / `schema_migrations` NOT VERIFIED** — `notifications` table & `create_in_app_notification` RPC present; **out-of-band `update_updated_at_column()` unknown** | No | Yes **(BLOCKS)** |
| 14 | `20261118000001` | `20261118000001_niche_and_module_registry.sql` | Historical | **PARTIAL (`CLOUD-002`) / `schema_migrations` NOT VERIFIED** — `niche_groups`, `niches`, `platform_modules`, `niche_modules`, `business_modules` present | No | Yes (incl. seed DML) |
| 15 | `20261118000002` | `20261118000002_business_onboarding_answers.sql` | Historical | **PARTIAL (`CLOUD-002`) / `schema_migrations` NOT VERIFIED** — `business_onboarding_answers` table present | No | Yes |
| 16 | `20261118000003` | `20261118000003_secure_media_upload_pipeline.sql` | Historical | **PARTIAL (`CLOUD-002`) / `schema_migrations` NOT VERIFIED** — `media_items` table present | No | Yes |
| 17 | `20261118000004` | `20261118000004_harden_media_items_security.sql` | Historical | **NOT VERIFIED** — Check constraints/FK/RLS updates invisible to OpenAPI list | No | Yes |
| 18 | `20261118000005` | `20261118000005_media_quarantine_and_publication.sql` | Historical | **NOT VERIFIED** — Column `published_at`/check constraint updates invisible to OpenAPI list | No | Yes |
| 19 | `20261119000001` | `20261119000001_atomic_business_creation.sql` | Historical | **PARTIAL (`CLOUD-002`) / `schema_migrations` NOT VERIFIED** — `create_business_with_setup_atomic` RPC present | No | Yes |
| 20 | `20261119000002` | `20261119000002_atomic_business_import.sql` | Historical | **PARTIAL (`CLOUD-002`) / `schema_migrations` NOT VERIFIED** — `confirm_business_import_atomic` RPC present | No | Yes |
| 21 | `20261119000003` | `20261119000003_website_configuration_schema.sql` | Historical | **PARTIAL (`CLOUD-002`) / `schema_migrations` NOT VERIFIED** — `site_versions` table present | No | Yes |
| 22 | `20261119000004` | `20261119000004_website_version_integrity_and_atomic_draft.sql` | Historical | **PARTIAL (`CLOUD-002`) / `schema_migrations` NOT VERIFIED** — 7-param `save_site_draft_configuration_atomic` present | No | Yes |
| 23 | `20261120000001` | `20261120000001_website_pointer_and_foreign_key_audit.sql` | Historical | **NOT VERIFIED** — Replaces 7-param RPC & FK `ON DELETE RESTRICT`; indistinguishable from #22 in OpenAPI name list | No | Yes |
| 24 | `20261120000002` | `20261120000002_revoke_direct_sites_insert_delete.sql` | Historical | **NOT VERIFIED** — `REVOKE`/`CREATE POLICY` invisible to OpenAPI | No | Yes |
| 25 | `20261120000003` | `20261120000003_revoke_column_insert_and_enforce_restrictive_rls.sql` | Historical | **NOT VERIFIED** — Column `REVOKE INSERT` + `AS RESTRICTIVE` policies invisible to OpenAPI | No | Yes |
| 26 | `20261122000001` | `20261122000001_website_draft_concurrency_and_optimistic_lock.sql` | Pending | **Confirmed NOT APPLIED** (`CLOUD-002` observed 7-param `save_site_draft_configuration_atomic`, not 8-param) | No (verified `CLOUD-005`/`CLOUD-007`) | Yes |
| 27 | `20261122000002` | `20261122000002_website_rollback_rpc.sql` | Pending | **Confirmed NOT APPLIED** (`rollback_published_site_version_atomic` absent in `CLOUD-002`) | Yes (`CLOUD-005`, `CLOUD-007`) | Yes |
| 28 | `20261122000003` | `20261122000003_website_publishing_domains_and_qr.sql` | Pending | **Confirmed NOT APPLIED** (`site_domains`, `qr_codes`, `publish_site_draft_atomic` absent in `CLOUD-002`) | Yes (`CLOUD-005`, `CLOUD-007`) | Yes |
| 29 | `20261125000001` | `20261125000001_remediate_historical_schema_and_rpc_defects.sql` | Pending Corrective | **Confirmed NOT APPLIED** (new forward remediation created in `CLOUD-007`) | Created (`CLOUD-007`) | Yes |

### Reconciliation of `CLOUD-004` vs `CLOUD-007` 25th-Migration Discrepancy
- [`CLOUDFLARE_RELEASE_READINESS_CLOUD-004.md`](file:///f:/VyaponeV2/docs/CLOUDFLARE_RELEASE_READINESS_CLOUD-004.md) (line 47) referenced `"migration 25 (20261121000002_website_editor_draft_persistence.sql)"`.
- Exhaustive repository search confirms `20261121000002_website_editor_draft_persistence.sql` **does not exist** anywhere in `supabase/migrations/`, `supabase/combined_migrations.sql`, `src/`, `tests/`, or `CLOUD-002`.
- [`CLOUDFLARE_PREFLIGHT_CLOUD-002.md`](file:///f:/VyaponeV2/docs/CLOUDFLARE_PREFLIGHT_CLOUD-002.md) (line 46) and `supabase/migrations/` sorting confirm the actual 25th migration is [`20261120000003_revoke_column_insert_and_enforce_restrictive_rls.sql`](file:///f:/VyaponeV2/supabase/migrations/20261120000003_revoke_column_insert_and_enforce_restrictive_rls.sql). `CLOUD-004` line 47 was a documentation citation error.

---

## 2. Diagnosis of Clean-Database Bootstrap Failures

### 2.1 Primary Failure: `20261117000002_audit_and_notification_foundation.sql`
- **Exact failing DDL statement (lines 89–92):**
  ```sql
  CREATE OR REPLACE TRIGGER trg_notifications_updated_at
      BEFORE UPDATE ON public.notifications
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  ```
- **Exact missing function signature:** `public.update_updated_at_column()` (0-parameter `TRIGGER` function).
- **Preceding migration history (01–12):**
  - [`20261112000001_initial_schema.sql`](file:///f:/VyaponeV2/supabase/migrations/20261112000001_initial_schema.sql) (lines 23–29) defines **`public.set_updated_at()`** (`RETURNS TRIGGER`), and attaches it to 10 core tables (`users`, `workspaces`, `businesses`, `locations`, `sites`, `catalogue_items`, `customers`, `orders`, `invoice_sequences`, `bills`).
  - [`20261114000001_fix_auth_profile_trigger_and_rls.sql`](file:///f:/VyaponeV2/supabase/migrations/20261114000001_fix_auth_profile_trigger_and_rls.sql) (lines 39–45) hardens `public.set_updated_at()`. [`20261115000001_plans_entitlements_capacity.sql`](file:///f:/VyaponeV2/supabase/migrations/20261115000001_plans_entitlements_capacity.sql) (lines 48, 75, 99) also uses `public.set_updated_at()`.
  - No migration (01–29) defines `public.update_updated_at_column()`.
- **Extensions & external bootstrap:** Only `pgcrypto` is enabled (`20261112000001` line 20). Neither PostgreSQL 15 nor default Supabase schemas pre-define `public.update_updated_at_column()`.
- **Why empty bootstrap aborts here (while other historical RPC defects passed DDL):** PostgreSQL validates PL/pgSQL function bodies lazily on invocation (allowing `workspace_members.updated_at` in #12, `niches.niche_group_slug` in #19/#20, and `sites.published_at` in #08/#10 to load cleanly until called), **but `CREATE TRIGGER ... EXECUTE FUNCTION ...` resolves the target function OID in `pg_proc` at DDL parse time**. An empty database stops at migration #13 with `ERROR: function public.update_updated_at_column() does not exist` (`SQLSTATE 42883`), preventing forward migration `20261125000001` from ever being reached. *(Actual PostgreSQL execution: **`NOT RUN`** locally on Windows.)*

### 2.2 Secondary Clean-Reset Failure Discovered: `supabase/seed.sql`
- [`supabase/config.toml`](file:///f:/VyaponeV2/supabase/config.toml) configures `[db] major_version = 15` with default seeding enabled (`supabase/seed.sql` runs automatically at the end of `supabase start` and `supabase db reset`).
- [`supabase/seed.sql`](file:///f:/VyaponeV2/supabase/seed.sql) (lines 63–65) executes:
  ```sql
  INSERT INTO public.sites (id, business_id, primary_domain, subdomain, status)
  VALUES ('40000000-0000-4000-a000-000000000001', ..., 'published')
  ```
- Even after resolving `20261117000002`, [`20261116000002_harden_sites_table_privileges_and_rpc.sql`](file:///f:/VyaponeV2/supabase/migrations/20261116000002_harden_sites_table_privileges_and_rpc.sql) installs unconditional trigger `trg_check_site_insert_status` (`BEFORE INSERT ON public.sites`), which rejects any non-`'draft'` insert with **`VY003`** even for superuser `postgres` (and `trg_check_site_publish_capacity` rejects direct `'published'` without `vyapone.in_atomic_site_transition = 'true'`). Therefore `supabase start` / `supabase db reset --local --yes` without `--no-seed` (or updating `seed.sql`) will fail right after migration #29.

---

## 3. Clean-Database Recovery Strategy Evaluation

### Option A — Historical Migration Correction
- **Mechanism:** Edit `20261117000002_audit_and_notification_foundation.sql` line 92 in place (`update_updated_at_column()` -> `set_updated_at()`), keeping forward migration `20261125000001` to converge live production DBs.
- **Drift & Supabase Tracking:** Violates strict migration immutability (`DATABASE_MIGRATIONS.md` §3.1). Supabase CLI tracks applied filenames primarily by version timestamp (`supabase_migrations.schema_migrations`), so future `db push` skips already-applied `20261117000002`; however, git history diverges from whatever SQL ran in production, and if `update_updated_at_column()` existed out-of-band in production, local fresh DBs will not mirror whether any other out-of-band production drift exists.
- **Behavior:** Fresh DBs pass #13 (though still need `20261125000001` for #12/#19/#20/#10 runtime fixes and `--no-seed` / `seed.sql` fix); existing production remains consistent once `20261125000001` re-points `trg_notifications_updated_at` -> `set_updated_at()`.

### Option B — Baseline / Squash Strategy
- **Mechanism:** Replace active pre-pending migrations (01–25) with a verified single baseline `<= 20261120000003` (archive historical 01–25 outside active `supabase/migrations/`), reconcile `supabase_migrations.schema_migrations` (`supabase migration repair`), and replay `20261122000001`–`20261125000001` cleanly.
- **Critical Repository Risks & Generation Method:**
  1. `supabase migration squash` replays existing local migrations (so it **cannot bypass `20261117000002`** directly unless snapshot comes from live production via `supabase db dump`).
  2. Official Supabase behavior: **`supabase migration squash` omits DML statements** (`INSERT`/`UPDATE`/`DELETE`). Migration [`20261118000001_niche_and_module_registry.sql`](file:///f:/VyaponeV2/supabase/migrations/20261118000001_niche_and_module_registry.sql) (lines 312–851) populates **essential runtime catalog data** (`niche_groups`, `platform_modules`, `niches`, `niche_modules`), which MUST be preserved alongside the schema baseline (or `seed.sql` / dedicated migration).
  3. **Auth Triggers, RLS & Grants Risks:** Must capture cross-schema trigger `on_auth_user_created` on `auth.users`, `supabase_auth_admin` grants (`20261114000001` / `20261115000002`), `pgcrypto` extension, `FORCE ROW LEVEL SECURITY` + `AS RESTRICTIVE` policies (`20261120000003`), and column-level ACL revocations on `sites`, `users`, `notifications`, `media_items` (standard `supabase db dump --role-only` + schema dump review needed).
  4. **Existing Environment Compatibility:** Running `supabase migration repair --status reverted <01..25>` and `--status applied <baseline>` on production has high operational blast radius if mis-ordered and cannot safely proceed before exporting/inspecting production state.

### Option C — Separate Clean-Bootstrap Process (CI-Only Script / Test Stub)
- **Mechanism:** Maintain a parallel CI-only bootstrap script bypassing `20261117000002` or defining fake helpers.
- **Assessment:** Test-only workaround; violates Single Source of Truth (`DATABASE_MIGRATIONS.md` §1) and invalidates migration verification because CI no longer tests the real migration chain. **NOT RECOMMENDED.**

### Option D — Alternative Recovery Strategy (Two-Step Production-Audited Governance) — **TECHNICALLY RECOMMENDED GATE**
1. **Prerequisite Step (Read-Only Production Audit, Requires Authorization):** Inspect live production `supabase_migrations.schema_migrations`, `pg_proc` (`update_updated_at_column` / `set_updated_at`), and `supabase db diff --linked` (read-only) to determine ground truth on migrations 01–25 before altering any migration artifact.
2. **Decision Branch Based on Audit:**
   - **Preferred clean architecture (Option D -> Verified Option B):** If out-of-band production drift exists alongside `update_updated_at_column()`, take a production `supabase db dump` baseline (`<= 20261120000003`) explicitly preserving `20261118000001` catalog rows, `auth.users` triggers, `pgcrypto`, grants, and RLS/column ACLs, paired with controlled `supabase migration repair` + backup.
   - **Minimal low-risk alternative (Option D -> Signed Option A):** If read-only diff proves production schema matches migrations 01–25 100% except `update_updated_at_column()` was created out-of-band, an **explicitly approved one-line historical exception in `20261117000002` (`set_updated_at()`) + immutable ADR audit entry** avoids destructive `supabase_migrations.schema_migrations` surgery on production while keeping `20261125000001` cleanly convergent on both fresh and live DBs.

---

## 4. ADR-028 Comparison Table & Decision Proposal

| Criteria | Option A (Edit `20261117000002` in place) | Option B (Squashed Baseline + `migration repair`) | Option C (Separate CI Bootstrap) | Option D (Read-Only Prod Audit -> Audited B or Signed A) |
|---|---|---|---|---|
| **Production history safety** | Medium (breaks file immutability; relies on prod keeping applied timestamp) | Medium-Low unless audited & backed up (`migration repair` touches prod tracking) | High (prod untouched) | **High** (verifies prod `schema_migrations` & `pg_proc` before any write) |
| **Fresh installation support** | **High** (once #13 uses `set_updated_at()`; still needs #29 for #12/#19/#20/#10 runtime fixes) | **High** (if `20261118000001` DML, `auth.users` trigger & ACLs preserved) | Partial (CI-only; local `supabase db reset` still broken) | **High** (first-class support on fresh DBs & CI) |
| **Existing environment compatibility** | High (`20261125000001` converges live DB trigger cleanly) | Requires `migration repair` on prod + staging | High locally/CI only | **High** (`20261125000001` converges prod cleanly) |
| **Supabase CLI compatibility** | High for future `db push`; violates immutable audit norm | High once reconciled; `migration squash` drops `20261118000001` DML | Low (`supabase start`/`db reset` remain broken natively) | **High** (follows documented CLI diagnostics & repair rules) |
| **Recovery complexity** | **Low** (1-line change + `20261125000001`) | **High** (schema + DML + auth trigger + ACL export + repair) | Medium (dual maintenance burden) | **Medium** (gated by fast read-only SQL check first) |
| **Future maintainability** | High once converged; carries historical footnote | **Highest** (clean single baseline if done after audit) | **Poor** (permanent drift between CI and prod chain) | **Highest** |

### Classification Summary for `ADR-028` (`Status: REQUIRES_APPROVAL`)
- **Technically recommended:** **Option D** (Read-only production `schema_migrations` + `pg_proc` + schema-diff inspection first, then executing either a verified production-backed baseline **Option B** with preserved `20261118000001` seeds/ACLs/`auth.users` triggers or a narrowly authorized **Option A** historical fix on `20261117000002`).
- **Requires project-owner approval:** All three governance steps — (1) read-only production introspection clearance, (2) choice between Option B baseline vs signed Option A exception in `20261117000002`, and (3) production `supabase migration repair` if Option B is chosen.
- **Not recommended:** **Option C** (diverges CI from production chain) and **unverified/blind Option A or Option B** without inspecting production first.
- **Not verified:** Actual production `supabase_migrations.schema_migrations` rows and whether `public.update_updated_at_column()` exists out-of-band in production PostgreSQL.

---

## 5. CLOUD-006 Linux Workflow Validation & Execution Feasibility

### 5.1 Workflow Inspection ([`.github/workflows/cloudflare-validation.yml`](file:///f:/VyaponeV2/.github/workflows/cloudflare-validation.yml))

| Check Item | Observed Configuration | Classification |
|---|---|---|
| Trigger | `on: workflow_dispatch:` only (lines 3–4); no `push`/`pull_request` | **PASS** |
| Permissions & Checkout | `contents: read`, `persist-credentials: false`, zero write tokens | **PASS** |
| Linux Runner / Tooling | `ubuntu-latest`, Node 24 via `.nvmrc` + explicit major assertion (`24`), `pnpm@11.21.0`, `pnpm install --frozen-lockfile`, 40-char SHA pins | **PASS** |
| OpenNext Build & Preview | `pnpm build` -> `pnpm exec opennextjs-cloudflare build` -> `node scripts/ci/verify-opennext-runtime.mjs` (`opennextjs-cloudflare preview --port 8787 --ip 127.0.0.1`; confirmed `--remote` defaults `false` in CLI) | **PASS** |
| No Cloudflare API Tokens | Uses sanitized dummy env vars (`127.0.0.1` URLs, local demo anon JWT, dummy service key & secret); no `CLOUDFLARE_API_TOKEN` | **PASS** |
| No Production DB Credentials | `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres` enforced strictly loopback by `assertLocalDatabaseUrl()` | **PASS** |
| Local-Only Supabase CLI | SHA-256 verified Supabase CLI `v2.54.11`; runs `supabase start`, `supabase db reset --local --yes`, `supabase migration list --local`, `supabase stop --no-backup`; zero `--linked`/`--remote`/`db push` | **PASS (Safe Scope)** |
| Job Timeouts & Concurrency | `15` / `25` / `25` min timeouts; concurrency `cancel-in-progress: true` | **PASS** |
| Artifacts Handling | No `actions/upload-artifact` used; summaries written to `$GITHUB_STEP_SUMMARY` (Supabase logs tail-40 only; full logs ephemeral on failure) | **PASS** (minor diagnostic trade-off) |
| Clean-DB Execution Readiness | Fails cleanly at `supabase start` (`20261117000002` missing `update_updated_at_column()`) AND at `seed.sql` (`sites` `'published'` insert rejected by `VY003`) | **BLOCKED (`ADR-028` + `seed.sql`/`--no-seed`)** |

> [!CAUTION]
> **Note on `.github/workflows/ci.yml`:** Unlike `cloudflare-validation.yml`, [`ci.yml`](file:///f:/VyaponeV2/.github/workflows/ci.yml) triggers on `push: branches: [main]` and `pull_request: branches: [main]`.

### 5.2 Execution Feasibility & GitHub / Cloudflare Constraints
- **Current status:** **NOT RUN** on GitHub.
- **Why even a non-production feature branch cannot blindly run `workflow_dispatch`:**
  1. Per official GitHub Actions behavior, `workflow_dispatch` workflows **must exist on the repository's default branch (`main`)** to appear in the UI and be dispatchable via UI (testing before merge via `gh workflow run ... --ref <branch>` still requires pushing a branch and workflow existence/permissions verification). `.github/workflows/cloudflare-validation.yml` was added locally after `origin/main` (`67f9141`) and does **not** exist on GitHub yet.
  2. Remote is [`https://github.com/krishnasharma1907/VyaponeV1.git`](https://github.com/krishnasharma1907/VyaponeV1.git) while workspace is `F:\VyaponeV2` (discrepancy unresolved).
  3. [`CLOUDFLARE_RELEASE_READINESS_CLOUD-004.md`](file:///f:/VyaponeV2/docs/CLOUDFLARE_RELEASE_READINESS_CLOUD-004.md) confirms Cloudflare Workers Builds dashboard integration is **`NOT VERIFIED`** — both production `main` auto-deploy and **non-production preview branch builds** could execute on push.
- **Verdict:** **`BLOCKED — USER AUTHORIZATION REQUIRED`**.
- **Exact minimal action requiring authorization (not performed):**
  1. Confirm in Cloudflare Dashboard (`Workers & Pages > vyapone > Settings > Builds`) and GitHub whether automatic production & preview builds on `VyaponeV1.git` are paused/disconnected, or designate an unlinked verification repo/branch.
  2. Authorize pushing the reviewed branch/workflow commit to GitHub, approving `ADR-028` + CI `--no-seed`/`seed.sql` alignment, and dispatching `Cloudflare & Supabase Validation` (`workflow_dispatch`).

---

## 6. PostgreSQL Test Coverage Review & Newly Identified Runtime Gaps

### 6.1 Static vs Mock vs Real PostgreSQL Audit
Inspection of all **26** Vitest database, migration, privilege, and tenant-isolation test files confirms:
- **0 / 26** Vitest test files connect to PostgreSQL (`pg` is only imported by [`scripts/ci/verify-supabase-migrations.mjs`](file:///f:/VyaponeV2/scripts/ci/verify-supabase-migrations.mjs)). Static regex assertions verify DDL text only; they do **not** prove PostgreSQL execution.
- **18 files** are strictly static file/regex checks (`fs.readFileSync`).
- **4 files** combine static SQL assertions with pure TypeScript mock engines ([`draft-concurrency-simulation.test.ts`](file:///f:/VyaponeV2/tests/unit/database/draft-concurrency-simulation.test.ts), [`sites-authorization-audit.test.ts`](file:///f:/VyaponeV2/tests/unit/database/sites-authorization-audit.test.ts), [`website-pointer-privilege-audit.test.ts`](file:///f:/VyaponeV2/tests/unit/database/website-pointer-privilege-audit.test.ts), [`site-privilege-audit.test.ts`](file:///f:/VyaponeV2/tests/unit/plans/site-privilege-audit.test.ts)).
- **4 files** test factories/config parsing with mocks ([`connection.test.ts`](file:///f:/VyaponeV2/tests/unit/database/connection.test.ts), [`tenant-isolation.test.ts`](file:///f:/VyaponeV2/tests/unit/security/tenant-isolation.test.ts), [`cross-tenant-isolation.test.ts`](file:///f:/VyaponeV2/tests/integration/cross-tenant-isolation.test.ts), [`multi-tenant-isolation.test.ts`](file:///f:/VyaponeV2/tests/integration/multi-tenant-isolation.test.ts)).
- [`supabase/tests/00001_schema_test.sql`](file:///f:/VyaponeV2/supabase/tests/00001_schema_test.sql) (32 pgTAP assertions on initial 14 tables) is real SQL (`NOT RUN`; not yet invoked by CI).
- [`supabase/combined_migrations.sql`](file:///f:/VyaponeV2/supabase/combined_migrations.sql) ends at `20261122000001` (stale vs `20261122000002`, `20261122000003`, `20261125000001`).

### 6.2 Review of [`scripts/ci/verify-supabase-migrations.mjs`](file:///f:/VyaponeV2/scripts/ci/verify-supabase-migrations.mjs) (All **`NOT RUN`** Locally)

| Capability Target | Current Status in Script | Specific Gaps / Defects Identified |
|---|---|---|
| Apply complete migration chain | **BLOCKED** | Blocked in CI at `20261117000002` (`ADR-028`) and `seed.sql` (`VY003`). Script itself does not query `supabase_migrations.schema_migrations` to assert all 29 versions applied. |
| Verify migrations 26, 27, 28, 29 | **PARTIAL (`NOT RUN`)** | **Critical bug discovered in `20261125000001` / Check #7:** `accept_workspace_invitation_atomic` (line 109) calls `PERFORM assert_and_lock_workspace_capacity(...)` while [`verify-supabase-migrations.mjs`](file:///f:/VyaponeV2/scripts/ci/verify-supabase-migrations.mjs) (line 655) and [`src/lib/workspaces/service.ts`](file:///f:/VyaponeV2/src/lib/workspaces/service.ts) execute as the invited `authenticated` user (`strangerUser`), causing `assert_and_lock_workspace_capacity` (lines 980–989) to reject the invitee with **`VY003`** AND ignore `allowed = false` via `PERFORM`! Script also omits runtime calls for `create_business_with_setup_atomic` & `confirm_business_import_atomic` niche joins. |
| Check RPC signatures | **PARTIAL (`NOT RUN`)** | Logs `pg_get_function_identity_arguments(p.oid)` for migrations 26–28 RPCs without asserting exact argument signatures, and omits `pg_proc` / grant checks for migration #29 RPCs (`create_business_with_setup_atomic` / `confirm_business_import_atomic` `service_role` revoke, `accept_workspace_invitation_atomic`, etc.). |
| Check RLS & grants | **PARTIAL (`NOT RUN`)** | Checks `site_domains` & `qr_codes` RLS + table privileges and `site_domains` `SELECT` for owner vs stranger, but omits `authenticated` `INSERT`/`UPDATE`/`DELETE` RLS tests on `site_domains` & `qr_codes` and `qr_codes` `UPDATE` scan-count behavior. |
| Owner & unauthorized access | **PARTIAL (`NOT RUN`)** | Tests `sovereign_owner_id` & stranger `VY020` on publish/rollback, but omits `business_members` `manager` allow, `cashier`/`staff` deny, `workspace_members` admin allow, and `VY002` archived business rejection. |
| Capacity enforcement | **PASS in script (`NOT RUN`)** | Tests zero-row `capacity_overrides` (`starter=3`, 4th business `VY001`) and capacity-neutral vs capacity-increasing rollback (`VY001`), but omits `accept_workspace_invitation_atomic` `team_seats` `VY001` & active `capacity_overrides` extension. |
| Concurrency conflicts (`VY049`) | **PARTIAL (`NOT RUN`)** | Tests `save_site_draft_configuration_atomic` stale `VY049`, but omits `publish_site_draft_atomic` stale draft `VY049`, `rollback_published_site_version_atomic` stale pointer `VY049`, and true dual-connection lock contention. |
| Rollback transaction behavior | **PARTIAL (`NOT RUN`)** | Verifies pointer swap & history preservation, but omits unpublished-draft rejection (`VY040`), same-business slot replacement demotion, and `audit_logs` row verification. |
| QR config & responses | **PASS in script (`NOT RUN`)** | Verifies `publish_site_draft_atomic` returns `mainQrCode` + `destination_configuration.type === 'storefront'` + `anon` active-only filter (`qr/service.ts` scan update under RLS untested). |
| Notification & invitation triggers | **PARTIAL (`NOT RUN`)** | Verifies `trg_notifications_updated_at` -> `set_updated_at()` & executes `UPDATE notifications`, but does not assert `updated_at > created_at`; invitation acceptance check #7 is **expected to fail with `VY003`** due to `assert_and_lock_workspace_capacity` caller check! |

---

## 7. Approved-Only Production Migration Execution Runbook

> [!CAUTION]
> **DO NOT EXECUTE WITHOUT EXPLICIT APPROVAL, `ADR-028` RESOLUTION, FIXING `accept_workspace_invitation_atomic` (`20261125000001`), AND GREEN LINUX POSTGRESQL CI.**

### 7.1 Target Order & Inter-Migration Dependencies
1. `20261122000001_website_draft_concurrency_and_optimistic_lock.sql` — Depends on `sites`, `site_versions`, `media_items`, `audit_logs`, `can_manage_business`. Drops 7-arg overload, creates 8-arg `save_site_draft_configuration_atomic`.
2. `20261122000002_website_rollback_rpc.sql` — Depends on `workspaces`, `businesses`, `sites`, `site_versions`, `subscriptions`, `capacity_overrides`, `can_manage_business`, `audit_logs`; sets `vyapone.in_atomic_site_transition = 'true'` compatible with both `20261116000001` and `20261125000001`.
3. `20261122000003_website_publishing_domains_and_qr.sql` — Depends on `workspaces`, `businesses`, `workspace_members`, `business_members`, `sites`, `site_versions`, `subscriptions`, `capacity_overrides`, `set_updated_at`, `audit_logs`; creates `site_domains` & `qr_codes` and `publish_site_draft_atomic`.
4. `20261125000001_remediate_historical_schema_and_rpc_defects.sql` *(requires `accept_workspace_invitation_atomic` `VY003`/`VY001` fix before execution)* — Re-points `trg_notifications_updated_at` -> `set_updated_at()`, fixes #12/#19/#20/#10/#08 RPCs & `check_site_publish_capacity_trigger()`.

### 7.2 Mandatory Pre-Migration & Backup Requirements
- **Backup:** Take a Supabase point-in-time recovery bookmark / Dashboard snapshot AND an offline schema+data backup before any DDL (`pg_dump` over direct port 5432, encrypted outside repo).
- **Pre-migration read-only checks (run via authorized SQL Editor / pipeline):**
  ```sql
  -- A. Inspect applied migration versions on production (ground truth for ADR-028)
  SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;

  -- B. Check whether out-of-band update_updated_at_column() exists in production
  SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE p.proname IN ('update_updated_at_column', 'set_updated_at');

  -- C. Confirm prerequisites & ensure target objects do not unexpectedly exist yet
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN ('sites', 'site_versions', 'audit_logs', 'business_members', 'workspace_members', 'notifications', 'site_domains', 'qr_codes');

  SELECT p.proname, pg_get_function_identity_arguments(p.oid)
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN ('save_site_draft_configuration_atomic', 'rollback_published_site_version_atomic', 'publish_site_draft_atomic', 'can_manage_business');
  ```

### 7.3 Post-Migration Verification Queries
- **Expected Tables:** `public.site_domains` and `public.qr_codes` (both `relrowsecurity = true`).
- **Expected RPCs & Trigger:**
  - `save_site_draft_configuration_atomic(uuid, uuid, uuid, text, jsonb, text, uuid[], integer)` (`authenticated` only; `service_role` & `anon` false)
  - `rollback_published_site_version_atomic(uuid, uuid, uuid, uuid, uuid)` (`authenticated`, `service_role` true; `anon` false)
  - `publish_site_draft_atomic(uuid, uuid, uuid, uuid, integer)` (`authenticated`, `service_role` true; `anon` false)
  - `trg_notifications_updated_at` on `public.notifications` executing `public.set_updated_at()`
  ```sql
  SELECT c.relname, c.relrowsecurity
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname IN ('site_domains', 'qr_codes', 'notifications');

  SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args,
         p.prosecdef, p.proconfig,
         has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec,
         has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_exec,
         has_function_privilege('service_role', p.oid, 'EXECUTE') AS svc_exec
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN (
      'save_site_draft_configuration_atomic',
      'rollback_published_site_version_atomic',
      'publish_site_draft_atomic',
      'accept_workspace_invitation_atomic',
      'create_business_with_setup_atomic',
      'confirm_business_import_atomic'
    )
  ORDER BY p.proname;

  SELECT t.tgname, p.proname AS trigger_fn
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_proc p ON p.oid = t.tgfoid
  WHERE c.relname = 'notifications' AND t.tgname = 'trg_notifications_updated_at';
  ```

### 7.4 Failure & Rollback Strategy + Application Compatibility
- **Transaction Safety:** Execute each migration file inside a single transaction (`BEGIN; ... COMMIT;`) when applying manually so partial DDL aborts cleanly.
- **Recovery on Post-Commit Regression:** Restore pre-migration backup / PITR snapshot OR execute a pre-reviewed forward compensating SQL migration; never edit applied history ad hoc.
- **Application Compatibility Verification ([`types.ts`](file:///f:/VyaponeV2/src/lib/supabase/types.ts), [`service.ts`](file:///f:/VyaponeV2/src/lib/websites/service.ts), [`qr/service.ts`](file:///f:/VyaponeV2/src/lib/websites/qr/service.ts)):**
  - Confirm `save_site_draft_configuration_atomic` accepts 8 args (`p_expected_base_version_number`).
  - Confirm `publish_site_draft_atomic` returns `mainQrCode` (with `destination_configuration.type === "storefront"`) before deploying the updated OpenNext Worker (`deploy` must follow, never precede, migrations).
  - Confirm [`service.ts`](file:///f:/VyaponeV2/src/lib/websites/service.ts) receives `VY001`, `VY002`, `VY005`, `VY049` cleanly from PostgREST.

---

## 8. Final Blocker Register (`NO-GO`)

1. **`ADR-028` Unapproved Clean-DB Recovery (`REQUIRES OWNER APPROVAL` / `BLOCKED`):** `20261117000002` calls missing `public.update_updated_at_column()`; read-only production check + owner decision required before touching historical/baseline state.
2. **Newly Identified `accept_workspace_invitation_atomic` Runtime Defect (`BLOCKED`):** Calling `assert_and_lock_workspace_capacity` as an invited non-member rejects with `VY003` and ignores `allowed = false` (`20261125000001` & `20261117000001`).
3. **`supabase/seed.sql` / `--no-seed` CI Reset Blocker (`BLOCKED`):** `seed.sql` inserts `status = 'published'` into `public.sites`, failing `VY003` triggers during `supabase start` / `supabase db reset --local`.
4. **PostgreSQL & Linux `workerd` Execution (`NOT RUN` / `NOT VERIFIED`):** Docker/PostgreSQL/Git absent locally; remote CI push & dispatch **`BLOCKED — USER AUTHORIZATION REQUIRED`** pending Cloudflare Workers Builds & `VyaponeV1.git` confirmation.
