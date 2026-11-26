# CLOUD-006 — Linux CI, OpenNext Runtime & Isolated Supabase Migration Verification

> [!WARNING]
> **Deployment Decision: NO-GO**
> 1. The Linux GitHub Actions workflow `.github/workflows/cloudflare-validation.yml` and verification scripts were authored and statically verified locally, **not pushed to GitHub** and **NOT RUN** on a GitHub-hosted Linux runner.
> 2. **Production Supabase schema readiness: NOT READY / DEFECTIVE.** Clean-database and PostgreSQL runtime inspection during CLOUD-006 uncovered additional SQL defects outside CLOUD-005 scope in `20261117000002` (clean-DB blocker) and `20261122000003` (`publish_site_draft_atomic` runtime column errors `w.plan_id` / `co.limit_override`), plus earlier RPC defects.
> 3. **Production execution authorization: NOT AUTHORIZED.** Zero production database changes, zero `git push` operations, and zero Cloudflare Worker deployments were performed.

---

## 1. Status Separation Matrix

| Track | Status | Evidence & Limiting Factors |
|---|---|---|
| Local static quality gates (`prettier`, `eslint`, `tsc`, full Vitest suite) | **PASS** (108 files, 1360 tests) | Executed locally with `agy-node` (`v24.22.0`) after final script/test edits; 0 lint warnings/errors. |
| Linux CI workflow YAML & structural safety tests | **PASS** (9 tests) | Validated locally in `tests/unit/ci/cloudflare-validation.test.ts` (Prettier YAML parser, SHA pins, trigger/permission/command guards). |
| Linux GitHub Actions runner execution (`workflow_dispatch`) | **NOT RUN** | Workflow has not been pushed to `origin/main` (`VyaponeV1.git`) or manually dispatched yet. |
| Next.js & OpenNext Cloudflare Linux build | **NOT RUN** (Windows **BLOCKED**) | Local Windows host fails `@ast-grep/napi-win32-x64-msvc` lookup on `@opennextjs/cloudflare` CLI; Linux `@ast-grep/napi-linux-x64-gnu@0.45.3` is locked in `pnpm-lock.yaml` for Ubuntu CI. |
| Cloudflare Worker local `workerd` runtime 11-route check | **NOT RUN** (Windows **BLOCKED**) | Covered by `scripts/ci/verify-opennext-runtime.mjs` for Linux runner execution after `.open-next/worker.js` is built. |
| Local isolated PostgreSQL/Supabase migration verification | **NOT RUN** (Windows **BLOCKED**) | Windows host has no Docker Engine, WSL2 distro, or `supabase` CLI binary; covered by `supabase-migration-verification` job + `scripts/ci/verify-supabase-migrations.mjs`. |
| Production Supabase schema readiness | **NOT READY / DEFECTIVE** | 3 pending `20261122*` migrations remain unapplied AND additional schema/runtime SQL defects exist (Section 5). |
| Production deployment / migration execution authorization | **NOT AUTHORIZED** | Requires explicit user approval after SQL remediation and green Linux CI verification. |

---

## 2. Prepared Manual-Only Linux CI Workflow

Created [`.github/workflows/cloudflare-validation.yml`](../.github/workflows/cloudflare-validation.yml) adhering to strict CI security and safety constraints:

- **Trigger:** `workflow_dispatch:` only (zero `push`, `pull_request`, `schedule`, or auto-deploy hooks).
- **Permissions & Concurrency:** Least-privilege `permissions: { contents: read }`, per-workflow concurrency cancellation, explicit `timeout-minutes` per job (`15` / `25` / `25`).
- **Environment & Lockfile Hygiene:** `ubuntu-latest`, Node 24 via `.nvmrc`, `packageManager` (`pnpm@11.21.0`), `pnpm install --frozen-lockfile`, `persist-credentials: false`, and all GitHub Actions pinned to 40-character commit SHAs (`actions/checkout`, `pnpm/action-setup`, `actions/setup-node`).
- **Sanitized Dummy Variables:** Uses loopback URLs (`http://127.0.0.1:8787`, `http://127.0.0.1:54321`), standard local demo JWTs, and placeholder `SESSION_SECRET`; zero production credentials or Cloudflare/Supabase API tokens referenced.
- **Safety Prohibitions Enforced:** Never executes `wrangler deploy`, `opennextjs-cloudflare deploy`, `--remote`, `--linked`, `supabase db push`, or `git push`.

### Workflow Jobs

1. **`quality-gates`**: Asserts Node major `24`, installs frozen lockfile, runs `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, and `pnpm test`.
2. **`opennext-build-and-runtime`**:
   - Verifies clean working tree (`git status --porcelain`) to guarantee zero manual `node_modules` edits are required on Linux.
   - Inspects installed `@opennextjs/cloudflare` CLI help (`--version`, `--help`, `preview --help`).
   - Executes & times `pnpm build` and `pnpm exec opennextjs-cloudflare build`, verifies `.open-next/worker.js` and `.open-next/assets`, logs bundle sizes to `$GITHUB_STEP_SUMMARY`, and executes `node scripts/ci/verify-opennext-runtime.mjs`.
3. **`supabase-migration-verification`**:
   - Downloads Supabase CLI `v2.54.11` (`supabase_linux_amd64.tar.gz`) from official GitHub Releases and verifies SHA-256 against the release checksum manifest (`sha256sum --check`).
   - Starts an isolated local Docker Supabase stack (`supabase start`), resets cleanly (`supabase db reset --local --yes`), inspects `supabase migration list --local`, runs `node scripts/ci/verify-supabase-migrations.mjs`, captures logs, and tears down (`supabase stop --no-backup`).

---

## 3. OpenNext Local Worker Runtime Route Verification Plan

Implemented in [`scripts/ci/verify-opennext-runtime.mjs`](../scripts/ci/verify-opennext-runtime.mjs):
- Spawns `pnpm exec opennextjs-cloudflare preview --port 8787 --ip 127.0.0.1` with ephemeral `.dev.vars` (only if absent, always removed in `finally`) and terminates the full process group cleanly on exit.
- Inspects captured Worker stdout/stderr logs for fatal runtime exceptions (`UnhandledPromiseRejection`, `ReferenceError:`, `SyntaxError:`, `FATAL ERROR`, `workerd` crashes).
- Probes all 11 required routes with `redirect: "manual"`:

| Route | Expected Status | Expected Behavior / Content Check | Isolated DB Limitation Note |
|---|---|---|---|
| `/` | `200` | `text/html` containing `VyapOne`, no Next.js exception banner | Static/SSR portal page |
| `/login` | `200` | `text/html` rendering sign-in page without exception banner | Client auth form |
| `/dashboard` | `302/303/307/308` | Redirect `Location` includes `/login` & `next=%2Fdashboard` | Protected route middleware check |
| `/robots.txt` | `200` | `text/plain` containing `User-Agent:`, `Disallow: /dashboard/`, `Sitemap:` | Metadata route |
| `/sitemap.xml` | `200` | XML `<urlset>` + `<loc>` entries | Falls back to static URLs when DB isolated |
| `/s/preview` | `200` or `404` | Non-empty `text/html`, no unhandled HTTP 500 exception | No seeded DB; graceful Storefront Not Found page |
| `/privacy` | `200` | `text/html` matching Privacy & DPDP/VyapOne text | Static legal page |
| `/auth/callback` | `302/303/307/308` | Redirect `Location` includes `/login` when `code` omitted | Auth callback guard |
| `/counter` | `302/303/307/308` | Redirect `Location` includes `/login` & `next=%2Fcounter` | Protected route middleware check |
| `/workspace` | `302/303/307/308` | Redirect `Location` includes `/login` & `next=%2Fworkspace` | Protected route middleware check |
| `/qr/test-slug` | `404` or `503` (not `500`) | Handles unconfigured/isolated DB safely without Worker crash | Active QR redirect requires seeded DB |

---

## 4. Isolated PostgreSQL Migration Verification Script

Implemented in [`scripts/ci/verify-supabase-migrations.mjs`](../scripts/ci/verify-supabase-migrations.mjs):
- Strictly validates `DATABASE_URL` hostname is loopback (`127.0.0.1`, `localhost`, or `::1`), refusing non-local targets.
- Verifies schema & privilege catalog state: `public.site_domains` & `public.qr_codes` tables + RLS enabled, `has_table_privilege` grants for `anon`/`authenticated`/`service_role`, and `pg_proc` metadata (`SECURITY DEFINER`, `search_path=''`, execute privileges) for `save_site_draft_configuration_atomic`, `rollback_published_site_version_atomic`, and `publish_site_draft_atomic`.
- Runs transactional (`BEGIN ... ROLLBACK` with `SAVEPOINT`) behavioral checks against real PostgreSQL RLS policies and PL/pgSQL RPCs: unauthorized publish & rollback denial (`VY020`), draft save & `VY049` optimistic lock check, valid owner publish atomicity, rollback pointer update preserving `site_versions` history, `anon` active-only `qr_codes` filter & `site_domains` denial, and sovereign owner (`sovereign_owner_id`) isolation.

---

## 5. Critical SQL Migration Defects Discovered (Outside CLOUD-005 Scope)

> [!CAUTION]
> **Full disclosure:** Deep schema-to-migration cross-verification during CLOUD-006 identified the following unaddressed SQL defects. Per CLOUD-006 instructions, NO superficial stubs or silent bypasses were added to make invalid SQL pass. These defects must be remediated in a follow-up migration task before production deployment.

### 5.1 Clean-Database Migration Chain Blocker (Will Fail `supabase db reset` / `supabase start`)

- **`supabase/migrations/20261117000002_audit_and_notification_foundation.sql` (line 92):**
  Creates trigger `trg_notifications_updated_at` executing `public.update_updated_at_column()`. No migration in `supabase/migrations/` defines `public.update_updated_at_column()` (the repository's canonical trigger function from `20261112000001` and `20261114000001` is `public.set_updated_at()`). On a fresh/disposable PostgreSQL database, `supabase db reset --local` will fail cleanly at `20261117000002`.

### 5.2 Runtime Column & Contract Defects in Pending Migration `20261122000003` (`publish_site_draft_atomic`)

While `CREATE FUNCTION` succeeds at DDL time, invoking `public.publish_site_draft_atomic` at runtime in PostgreSQL will fail or misbehave due to:
1. **`w.plan_id` (`line 335`):** Queries `w.plan_id` from `public.workspaces`, whereas `public.workspaces` defines `plan` (`starter | growth | pro | agency | scale`), not `plan_id`.
2. **`co.limit_override` (`line 353`):** Queries `co.limit_override` from `public.capacity_overrides`, whereas `public.capacity_overrides` defines `additional_capacity` (and `expires_at`). Also, when zero override rows match, `SELECT COALESCE(co.limit_override, 0) INTO v_override` leaves `v_override` as `NULL` in PL/pgSQL (`0 rows` assigns `NULL`), turning `v_base_limit + v_override` into `NULL`.
3. **Plan Limit & Capacity Counting Divergence:** Skips `public.subscriptions` lookup, uses non-canonical plan limits (`scale = 20`, `enterprise = 50`, fallback `'free'`) vs `20261116000001` / `src/lib/plans/constants.ts`, and counts `COUNT(s2.id)` instead of distinct non-archived businesses (`b2.status <> 'archived'`).
4. **Return Shape & QR Configuration Mismatch:** Returns `'mainQrSlug', v_main_qr.public_slug` while `src/lib/websites/service.ts` expects `mainQrCode` (`QrCodeRow`), and stores `destination_configuration` `{"targetType":"storefront"}` while `src/lib/websites/schemas.ts` / `qr/service.ts` expect `{"type":"storefront"}`.
5. **Transition GUC & Rollback Capacity Check:** Neither `20261122000003` (`publish_site_draft_atomic`) nor `20261122000002` (`rollback_published_site_version_atomic`) sets `vyapone.in_atomic_site_transition = 'true'` before setting `sites.status = 'published'` (guarded by `20261116000001`), and rollback does not re-check `live_websites` capacity if rolling back a non-published (`draft`/`suspended`) site.

### 5.3 Earlier Applied Migration Defects Discovered During Full-Chain Audit

- **`20261117000001_team_invitations_and_membership_lifecycle.sql` (lines 229, 242):** Inserts/updates `updated_at` on `public.workspace_members`, which has no `updated_at` column (`20261112000001`).
- **`20261119000001` & `20261119000002`:** Query `niche_group_slug` on `public.niches`, whereas `20261118000001` defines `niche_group_id`.
- **`20261115000001` (lines 536, 686) & `20261116000001` (line 570):** Update/reference `published_at` on `public.sites`, which has no `published_at` column (`published_at` lives on `public.site_versions`).

---

## 6. Local Host Verification Results (`F:\VyaponeV2` Windows Host)

Executed after final script/test edits using `agy-node` (`v24.22.0`):
- **Prettier check** (`prettier --check .github/workflows/cloudflare-validation.yml scripts/ci/verify-opennext-runtime.mjs scripts/ci/verify-supabase-migrations.mjs tests/unit/ci/cloudflare-validation.test.ts`): **PASS**
- **ESLint** (`eslint.js` on the 3 `.mjs`/`.ts` files): **PASS** (0 errors, 0 warnings)
- **TypeScript typecheck** (`tsc --noEmit`): **PASS** (exit code `0`)
- **Full Vitest suite** (`vitest.mjs run`): **PASS** — `108 passed (108)` test files, `1360 passed (1360)` tests (includes `tests/unit/ci/cloudflare-validation.test.ts` [9 tests] and `tests/unit/ci/workflow.test.ts` [7 tests])
- **Next.js / OpenNext Cloudflare build & `workerd` runtime preview:** **NOT RUN / BLOCKED on Windows** (missing `@ast-grep/napi-win32-x64-msvc` native binding for `@opennextjs/cloudflare`)
- **Isolated Docker Supabase PostgreSQL test:** **NOT RUN / BLOCKED on Windows** (no Docker Engine, WSL2 distro, or `supabase` CLI binary installed locally)

---

## 7. Instructions for Manual Linux CI Trigger

Once SQL remediation for the defects in Section 5 is completed and reviewed, and you explicitly authorize pushing the workflow commit to `https://github.com/krishnasharma1907/VyaponeV1.git`:
1. Push the reviewed commit to a branch on GitHub.
2. Open **GitHub Actions -> `Cloudflare & Supabase Validation`**.
3. Click **Run workflow** (`workflow_dispatch`) on the target branch.
4. Review job summaries (`OpenNext Build Summary`, `Local Cloudflare Worker Runtime Route Matrix`, and `Isolated PostgreSQL Migration Verification`) before making any deployment decision.
