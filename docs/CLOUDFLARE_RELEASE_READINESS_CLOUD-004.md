# CLOUD-004 — VyapOne Final Release Readiness & Deployment Safety Audit Report

**Task:** CLOUD-004  
**Workspace:** `F:\VyaponeV2`  
**Target Cloudflare Worker:** `vyapone`  
**Target Live URL:** `https://vyapone.kssharma2022krish.workers.dev/`  
**Configured Git Remote:** `https://github.com/krishnasharma1907/VyaponeV1.git`  
**Branch:** `main` (baseline commit: `7c61842`, 11 commits ahead of `origin/main` at `67f9141`)  
**Audit Timestamp:** 2026-11-23T08:05:00-08:00  
**Overall Release Recommendation:** **NO-GO (DEPLOYMENT BLOCKED)**

---

## 1. Executive Summary & Overall Decision

A rigorous, read-only deployment readiness audit of the VyapOne application was performed across dependencies, configuration, bundler output, database migrations, hardware constraints, and Git destination safety.

### Overall Recommendation: **NO-GO**

**The deployment must NOT proceed at this time.** Multiple critical blockers prevent a safe, automated production release:
1. **Critical Schema Defects in Pending Migrations:** Migration 2 (`20261122000002`) and Migration 3 (`20261122000003`) contain invalid table names (`business_memberships`, `workspace_memberships`) and invalid column names (`resource_type`, `resource_id`, `metadata` on `audit_logs`). If executed on production Supabase, any attempt to roll back or publish a site will immediately crash with PostgreSQL relation and column errors.
2. **Local Windows Host Build Reproducibility:** On this Windows NTFS host without Developer Mode/elevation, `pnpm opennextjs-cloudflare build` fails during Next.js standalone file tracing with `EPERM: operation not permitted, symlink`. A build that requires manual edits to `node_modules` is non-reproducible and violates quality invariants.
3. **Local Cloudflare Runtime Unavailability:** The host CPU is an Intel Pentium Dual-Core E5800 (Wolfdale architecture, circa 2010) which lacks the AVX instruction set required by Cloudflare's `workerd.exe` binary (`0xC000001D STATUS_ILLEGAL_INSTRUCTION`). WSL is not installed.
4. **Unconfirmed Git Remote & Dashboard Connection:** The remote `VyaponeV1.git` has not been confirmed as the repository wired to Cloudflare Workers Builds for worker `vyapone`. Pushing local `main` (which is 11 commits ahead) could trigger an uncontrolled production deployment of code whose database migrations are unapplied.

---

## 2. Category-by-Category Evaluation Matrix

| Category | Status | Summary & Evidence |
|---|---|---|
| **1. OpenNext Build Reproducibility** | **BLOCKED** | Fails with unpatched `node_modules` on Windows NTFS (`EPERM` on standalone symlinks). Reproducible only in Linux/WSL/CI environments. |
| **2. Wrangler Configuration Correctness** | **PASS** | Validated against official OpenNext Cloudflare specifications (`name: vyapone`, `main: .open-next/worker.js`, `assets: .open-next/assets`, `compatibility_date: 2024-12-30`, `nodejs_compat`). |
| **3. Cloudflare Runtime Verification** | **BLOCKED** | Host CPU (Intel Pentium E5800) lacks AVX extensions. `workerd.exe` terminates with illegal instruction. WSL is not available. |
| **4. Production Supabase Schema Readiness** | **BLOCKED** | Migrations 1–25 applied; 3 pending migrations (`20261122000001`, `20261122000002`, `20261122000003`) remain unapplied on production. |
| **5. Migration Safety** | **BLOCKED** | Critical schema defects identified in migrations 2 and 3 (`business_memberships` vs `business_members`, `resource_type` vs `resource`). Must be corrected prior to execution. |
| **6. Git Repository Destination** | **NOT VERIFIED** | Remote is `VyaponeV1.git` while workspace is `VyaponeV2`. Connection between this remote and the live Cloudflare Worker is unconfirmed from dashboard. |
| **7. Cloudflare Workers Builds Integration** | **NOT VERIFIED** | Cloudflare Workers Builds dashboard settings cannot be queried locally without API tokens. Blind push risks automatic deployment. |
| **8. Environment Configuration** | **PASS** | Strict 3-tier partitioning (Public Client, Server Secrets, Optional Integrations). No secrets committed or exposed. |
| **9. Bundle-Size Compliance** | **PASS** | Worker entrypoint is ~2.2 KB. Server function bundle is well within standard Cloudflare Workers script compression limits. |
| **10. Quality Gates** | **BLOCKED** | `typecheck` PASS, `lint` PASS, `format:check` PASS, `build` PASS. `vitest` fails under Node 22 due to `undici@8.12.4` requiring Node 24+ `zstd`. `opennextjs-cloudflare build` fails on Windows symlinks. |

---

## 3. Detailed Audit of Pending Supabase Migrations

The production database is at migration 25 (`20261121000002_website_editor_draft_persistence.sql`). Three migrations are pending:

### Migration 1: `20261122000001_website_draft_concurrency_and_optimistic_lock.sql`
- **Purpose:** Replaces `save_site_draft_configuration_atomic` with an 8-parameter overload including `p_expected_base_version_number`.
- **Audit Assessment:** **SAFE (Subject to Execution Order)**
- **Findings:**
  - Safely drops old 7-parameter and 8-parameter overloads.
  - Implements row locking `FOR UPDATE OF s` on `public.sites`.
  - Uses canonical helper `public.can_manage_business(p_business_id, p_caller_user_id)`.
  - Inserts correctly into `public.audit_logs (business_id, workspace_id, user_id, action, resource, metadata_json, ip_address, created_at)`.
  - Grants execute to `authenticated` role.

### Migration 2: `20261122000002_website_rollback_rpc.sql`
- **Purpose:** Implements `rollback_published_site_version_atomic` RPC for rolling back published websites.
- **Audit Assessment:** **DEFECTIVE — EXECUTION BLOCKED**
- **Critical Defects:**
  1. **Non-Existent Relation in Authorization Check (lines 74–85):**
     ```sql
     SELECT 1 FROM public.business_memberships ...
     SELECT 1 FROM public.workspace_memberships wm ...
     ```
     The production schema defines `public.business_members` and `public.workspace_members`. `business_memberships` and `workspace_memberships` do not exist.
  2. **Non-Existent Columns in Audit Log Insert (lines 129–136):**
     ```sql
     INSERT INTO public.audit_logs (
         business_id, user_id, action, resource_type, resource_id, metadata, created_at
     )
     ```
     The schema defines `resource TEXT` and `metadata_json JSONB`. There are no `resource_type`, `resource_id`, or `metadata` columns. Calling this function will throw runtime PostgreSQL errors.

### Migration 3: `20261122000003_website_publishing_domains_and_qr.sql`
- **Purpose:** Creates `public.site_domains` and `public.qr_codes` tables; implements `publish_site_draft_atomic` RPC.
- **Audit Assessment:** **DEFECTIVE — EXECUTION BLOCKED**
- **Critical Defects:**
  1. **Non-Existent Columns in Audit Log Insert (lines 407–415):**
     ```sql
     INSERT INTO public.audit_logs (
         business_id, user_id, action, resource_type, resource_id, metadata, created_at
     )
     ```
     `resource_type`, `resource_id`, and `metadata` do not exist on `public.audit_logs`. Calling `publish_site_draft_atomic` will fail at step 10 with `column "resource_type" does not exist`.

---

## 4. Safe Production Migration Runbook & Corrected SQL

> [!WARNING]
> **Do not execute raw migrations `20261122000002` and `20261122000003` as currently committed.**  
> Use the corrected SQL definitions below during authorized manual execution.

### Pre-Migration Verification Query
Execute in Supabase SQL Editor to verify baseline schema readiness:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('sites', 'site_versions', 'audit_logs', 'business_members', 'workspace_members');
```
Expected result: 5 rows returned.

### Step 1: Execute Migration 1
Execute `supabase/migrations/20261122000001_website_draft_concurrency_and_optimistic_lock.sql` verbatim.

### Step 2: Execute Corrected Migration 2 (Rollback RPC)
Apply this corrected definition fixing authorization tables and audit log columns:
```sql
CREATE OR REPLACE FUNCTION public.rollback_published_site_version_atomic(
    p_site_id UUID,
    p_business_id UUID,
    p_caller_user_id UUID,
    p_target_version_id UUID,
    p_expected_current_published_version_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_now TIMESTAMPTZ := pg_catalog.now();
    v_site RECORD;
    v_target_version RECORD;
    v_workspace_id UUID;
    v_updated_site RECORD;
BEGIN
    -- 1. Input Validation
    IF p_site_id IS NULL THEN RAISE EXCEPTION 'Site ID cannot be null' USING ERRCODE = 'VY040'; END IF;
    IF p_business_id IS NULL THEN RAISE EXCEPTION 'Business ID cannot be null' USING ERRCODE = 'VY020'; END IF;
    IF p_caller_user_id IS NULL THEN RAISE EXCEPTION 'Caller user ID cannot be null' USING ERRCODE = 'VY020'; END IF;
    IF p_target_version_id IS NULL THEN RAISE EXCEPTION 'Target version ID cannot be null' USING ERRCODE = 'VY040'; END IF;

    -- 2. Caller Identity Verification
    IF auth.uid() IS NOT NULL AND auth.uid() <> p_caller_user_id THEN
        RAISE EXCEPTION 'Access denied: caller does not match authenticated session' USING ERRCODE = 'VY020';
    END IF;

    -- 3. Row Lock
    SELECT s.id, s.business_id, s.subdomain, s.primary_domain, s.status, s.published_version_id,
           s.current_draft_version_id, s.created_at, s.updated_at, b.workspace_id
    INTO v_site
    FROM public.sites s
    JOIN public.businesses b ON b.id = s.business_id
    WHERE s.id = p_site_id
    FOR UPDATE OF s;

    IF v_site.id IS NULL THEN RAISE EXCEPTION 'Site not found: %', p_site_id USING ERRCODE = 'VY040'; END IF;
    IF v_site.business_id <> p_business_id THEN RAISE EXCEPTION 'Site does not belong to specified business' USING ERRCODE = 'VY020'; END IF;

    v_workspace_id := v_site.workspace_id;

    -- 4. Corrected Authorization Check (Using canonical can_manage_business helper)
    IF NOT public.can_manage_business(p_business_id, p_caller_user_id) THEN
        RAISE EXCEPTION 'Unauthorized: insufficient business permissions to roll back site' USING ERRCODE = 'VY020';
    END IF;

    -- 5. Concurrency Check
    IF p_expected_current_published_version_id IS NOT NULL AND
       v_site.published_version_id IS DISTINCT FROM p_expected_current_published_version_id THEN
        RAISE EXCEPTION 'Rollback conflict: current published version does not match expected version' USING ERRCODE = 'VY049';
    END IF;

    -- 6. Target Version Verification
    SELECT v.id, v.site_id, v.business_id, v.version_number, v.schema_version,
           v.configuration, v.created_by, v.change_summary, v.published_at, v.created_at
    INTO v_target_version
    FROM public.site_versions v
    WHERE v.id = p_target_version_id;

    IF v_target_version.id IS NULL THEN RAISE EXCEPTION 'Target site version not found: %', p_target_version_id USING ERRCODE = 'VY040'; END IF;
    IF v_target_version.site_id <> p_site_id OR v_target_version.business_id <> p_business_id THEN
        RAISE EXCEPTION 'Target version does not belong to this site or business' USING ERRCODE = 'VY020';
    END IF;
    IF v_target_version.published_at IS NULL THEN
        RAISE EXCEPTION 'Cannot rollback to an unpublished draft version; use Restore to Draft instead' USING ERRCODE = 'VY040';
    END IF;
    IF v_site.published_version_id = p_target_version_id THEN
        RAISE EXCEPTION 'Target version is already the active published version' USING ERRCODE = 'VY040';
    END IF;

    -- 7. Update Site Record
    UPDATE public.sites
    SET published_version_id = p_target_version_id,
        status = 'published',
        updated_at = v_now
    WHERE id = p_site_id
    RETURNING id, business_id, subdomain, primary_domain, status,
              published_version_id, current_draft_version_id, created_at, updated_at
    INTO v_updated_site;

    -- 8. Corrected Audit Log Insert (Matching public.audit_logs schema)
    INSERT INTO public.audit_logs (
        business_id,
        workspace_id,
        user_id,
        action,
        resource,
        metadata_json,
        ip_address,
        created_at
    ) VALUES (
        p_business_id,
        v_workspace_id,
        p_caller_user_id,
        'site.published_version_rolled_back',
        'site',
        pg_catalog.jsonb_build_object(
            'site_id', p_site_id,
            'previous_published_version_id', v_site.published_version_id,
            'rolled_back_to_version_id', v_target_version.id,
            'rolled_back_to_version_number', v_target_version.version_number
        ),
        NULL,
        v_now
    );

    RETURN pg_catalog.jsonb_build_object(
        'site', pg_catalog.row_to_json(v_updated_site),
        'publishedVersion', pg_catalog.row_to_json(v_target_version)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.rollback_published_site_version_atomic(UUID, UUID, UUID, UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rollback_published_site_version_atomic(UUID, UUID, UUID, UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.rollback_published_site_version_atomic(UUID, UUID, UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rollback_published_site_version_atomic(UUID, UUID, UUID, UUID, UUID) TO service_role;
```

### Step 3: Execute Migration 3 with Corrected Audit Insert
Apply tables `site_domains`, `qr_codes`, and their policies from `20261122000003_website_publishing_domains_and_qr.sql`, replacing lines 407–430 in `publish_site_draft_atomic` with:
```sql
    -- 10. Corrected Audit Log Entry
    INSERT INTO public.audit_logs (
        business_id,
        workspace_id,
        user_id,
        action,
        resource,
        metadata_json,
        ip_address,
        created_at
    ) VALUES (
        p_business_id,
        v_workspace_id,
        p_caller_user_id,
        'site.published',
        'site',
        pg_catalog.jsonb_build_object(
            'site_id', p_site_id,
            'version_id', v_target_version.id,
            'version_number', v_target_version.version_number,
            'subdomain', v_updated_site.subdomain,
            'primary_domain', v_updated_site.primary_domain,
            'qr_slug', v_main_qr.public_slug
        ),
        NULL,
        v_now
    );
```

### Post-Migration Verification Queries
```sql
-- 1. Check newly created tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name IN ('site_domains', 'qr_codes');

-- 2. Check all 3 updated/new RPC functions
SELECT routine_name, routine_type FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN ('save_site_draft_configuration_atomic', 'rollback_published_site_version_atomic', 'publish_site_draft_atomic');
```
Expected result: 2 tables returned, 3 functions returned.

---

## 5. Host Architecture & Runtime Findings

- **Host Processor:** Intel Pentium Dual-Core CPU E5800 @ 3.20GHz (Family 6 Model 23 Stepping 10, Wolfdale architecture).
- **Instruction Set Limitation:** Lacks AVX/AVX2 extensions.
- **Workerd Binary Behavior:** Cloudflare's `workerd.exe` binary immediately terminates on execution with `0xC000001D STATUS_ILLEGAL_INSTRUCTION` (exit code `3221225501`).
- **WSL Status:** WSL is not installed/enabled.
- **Node Engine Compatibility:**
  - `package.json` specifies `"node": ">=24.0.0"`.
  - Node `v22.14.0` on this host lacks `zlib.createZstdDecompress`, causing `undici@8.12.4` (pulled by `jsdom`) to fail with `TypeError: Cannot read properties of undefined (reading 'bind')` across Vitest suites.
  - On Node 24+ in standard Linux CI/CD, this error is non-existent.
- **Local Preview Status:** **EXPLICITLY BLOCKED** on this machine. Production route verification was conducted against the local Next.js production server (`next start` on port 3005), which confirmed all 11 core routes functioning correctly.

---

## 6. Git Destination & Cloudflare Builds Audit

- **Current Local Branch:** `main` (commit `7c61842`).
- **Remote Tracking:** `origin/main` is at commit `67f9141` (`feat(vo-041): build approved block library foundation with 13 canonical components and safe renderer`).
- **Commits Ahead:** Local `main` is **11 commits ahead** of `origin/main`.
- **Remote Discrepancy:** Remote URL is `https://github.com/krishnasharma1907/VyaponeV1.git`. Workspace is `VyaponeV2`.
- **Cloudflare Git Integration:**
  - The live worker `vyapone` (`https://vyapone.kssharma2022krish.workers.dev/`) currently serves commit `67f9141`.
  - If Cloudflare Workers Builds is connected to `origin/main` on `VyaponeV1.git`, **running `git push origin main` will immediately trigger a live production deployment** of the new codebase before the database migrations are applied, causing downtime on site publishing, rollback, and QR routes.
  - Pushing to `origin/main` without manual database migration execution is strictly forbidden.

---

## 7. Quality Gates Summary

| Gate | Command | Exit Code | Result | Notes |
|---|---|---|---|---|
| **TypeScript** | `pnpm typecheck` | `0` | **PASS** | 0 type errors across entire codebase |
| **ESLint 9** | `pnpm lint` | `0` | **PASS** | 0 lint errors, 0 warnings (`.open-next` ignored) |
| **Prettier** | `pnpm format:check` | `0` | **PASS** | 100% formatted |
| **Next.js Production Build** | `pnpm build` | `0` | **PASS** | 40/40 routes compiled successfully |
| **Vitest Test Suite** | `pnpm vitest run` | `1` | **BLOCKED** | Node 22 runtime incompatibility (`undici` zstd requires Node 24+) |
| **OpenNext Cloudflare Build** | `pnpm opennextjs-cloudflare build` | `1` | **BLOCKED** | Windows NTFS non-admin symlink `EPERM` during standalone trace |
| **Wrangler Dry-Run** | `pnpm wrangler deploy --dry-run` | `1` | **BLOCKED** | Requires `.open-next/worker.js` generated from OpenNext build |

---

## 8. Release Blocker Checklist & Action Items

Before deployment can be approved (transition to GO):
- [ ] **Fix Migration 2 & 3 in Codebase:** Update `20261122000002` and `20261122000003` (and their unit test assertions) to use `can_manage_business` and correct `audit_logs` column names (`resource`, `metadata_json`).
- [ ] **Execute Supabase Migrations:** Apply migrations 1, 2 (corrected), and 3 (corrected) manually in the Supabase Dashboard SQL Editor using the runbook.
- [ ] **Verify Production Database:** Run post-migration verification queries to confirm table and RPC availability.
- [ ] **Establish Linux/Node 24 CI Runner:** Build the OpenNext worker bundle in GitHub Actions or Cloudflare Workers Builds on Ubuntu with Node 24 to produce a reproducible `.open-next/worker.js`.
- [ ] **Confirm Cloudflare Dashboard Git Connection:** Verify in Cloudflare Dashboard whether `vyapone` is connected to `VyaponeV1.git` or if a manual Wrangler CLI deployment is intended.
- [ ] **User Authorization:** Obtain explicit approval to push `main` or deploy the Worker.
