# CLOUD-005 — Supabase Publishing & Rollback Migration Defect Corrections Report

**Task:** CLOUD-005  
**Workspace:** `F:\VyaponeV2`  
**Target Live URL:** https://vyapone.kssharma2022krish.workers.dev/  
**Existing Worker:** `vyapone`  
**Execution Scope:** LOCAL CODE / MIGRATION FILE CORRECTION ONLY  
**Production Database State:** UNMODIFIED (Zero live database writes or executions)  
**Date:** 2026-11-24  

---

## 1. Executive Summary

During release readiness audits CLOUD-002 and CLOUD-004, critical SQL schema reference defects were discovered in pending Supabase migrations `20261122000002_website_rollback_rpc.sql` and `20261122000003_website_publishing_domains_and_qr.sql`. If applied to production, these defects would have caused runtime crashes during website rollback, custom domain operations, and site draft publishing.

Under task **CLOUD-005**, these migrations and their unit test suites were rigorously audited against the real 25-migration historical schema in `supabase/migrations/` and corrected in local code.

### Summary of Actions Taken:
1. **Migration 1 (`20261122000001`):** Verified independently. 100% compliant with existing schema, function signatures, row locks, optimistic concurrency, and audit logging. No modifications required.
2. **Migration 2 (`20261122000002`):** Corrected non-existent table references (`business_memberships`, `workspace_memberships`) to canonical helper `public.can_manage_business(p_business_id, p_caller_user_id)`. Assigned `v_workspace_id := v_site.workspace_id`. Corrected non-existent `audit_logs` columns (`resource_type`, `resource_id`, `metadata`) to canonical columns (`workspace_id`, `resource`, `metadata_json`, `ip_address`).
3. **Migration 3 (`20261122000003`):** Corrected non-existent `audit_logs` columns in `publish_site_draft_atomic`. Replaced invalid role `'agency_admin'` with canonical workspace roles (`'workspace_owner', 'workspace_admin', 'reseller_admin'`). Added sovereign business owner authorization check (`b.sovereign_owner_id = auth.uid()`) across RLS policies for `public.site_domains` and `public.qr_codes`. Handled nullable workspace ID in plan capacity enforcement.
4. **Migration Unit Tests:** Rewrote and strengthened `tests/unit/database/website-rollback-migration.test.ts` and `tests/unit/database/website-publishing-migration.test.ts`. Verified actual column names, canonical tables, function signatures, error codes, and absence of stale identifiers.
5. **Quality Gates:** 100% PASS on TypeScript typecheck (`tsc --noEmit`), ESLint 9 (`eslint .`), Prettier (`prettier --check .`), and focused Vitest migration tests (32/32 tests passing).

---

## 2. Detailed Audit & Corrections by Migration

### 2.1 Migration 1: `20261122000001_website_draft_concurrency_and_optimistic_lock.sql`

- **Status:** **VERIFIED — ZERO DEFECTS FOUND**
- **Analysis:**
  - **Function Replacement:** Safely drops earlier 7-parameter and 8-parameter overloads of `public.save_site_draft_configuration_atomic` before creating the 8-parameter version.
  - **Signature Match:** Function signature `(p_site_id UUID, p_business_id UUID, p_caller_user_id UUID, p_schema_version TEXT, p_configuration JSONB, p_change_summary TEXT, p_referenced_media_ids UUID[], p_expected_base_version_number INT) RETURNS JSONB` matches TypeScript definition in `src/lib/supabase/types.ts` and application RPC call in `src/lib/websites/service.ts`.
  - **Row Locking:** Serializes concurrent saves for the same site using `SELECT ... FROM public.sites s JOIN public.businesses b ON b.id = s.business_id WHERE s.id = p_site_id FOR UPDATE OF s;`.
  - **Authorization:** Uses canonical helper `IF NOT public.can_manage_business(p_business_id, p_caller_user_id) THEN RAISE EXCEPTION ... USING ERRCODE = 'VY021';`.
  - **Optimistic Concurrency:** Compares `v_current_draft_version_number IS DISTINCT FROM p_expected_base_version_number`, throwing `ERRCODE = 'VY049'` on mismatch.
  - **Audit Logging:** Inserts correctly into `public.audit_logs (business_id, workspace_id, user_id, action, resource, metadata_json, ip_address, created_at)`.
  - **Privileges:** `REVOKE ALL ... FROM PUBLIC, anon, service_role;` and `GRANT EXECUTE ... TO authenticated;` adheres to VO-040 security preflight.
  - **File Modification:** None (file was already correct).

---

### 2.2 Migration 2: `20261122000002_website_rollback_rpc.sql`

- **Status:** **CORRECTED**
- **Defects Remediated:**
  1. **Invalid Authorization Relations (Lines 74–85):**
     - *Defect:* Checked `FROM public.business_memberships` and `FROM public.workspace_memberships wm` with non-existent roles `reseller_staff` and `member`. These tables do not exist in the database (actual tables are `public.business_members` and `public.workspace_members`).
     - *Correction:* Replaced with canonical security helper `public.can_manage_business(p_business_id, p_caller_user_id)` which comprehensively verifies sovereign business ownership (`businesses.sovereign_owner_id`), active business owner/manager roles (`business_members.role IN ('owner', 'manager')`), and parent workspace management roles (`is_workspace_admin_or_owner`).
     - *Error Code:* Preserved `ERRCODE = 'VY020'` with message `'Unauthorized: insufficient business permissions to roll back site'`.
  2. **Unassigned Workspace Identifier (Line 29, 72):**
     - *Defect:* Variable `v_workspace_id UUID;` was declared but never assigned from the locked site/business record before being used.
     - *Correction:* Explicitly assigned `v_workspace_id := v_site.workspace_id;` immediately after the `FOR UPDATE OF s` row lock.
  3. **Non-Existent Columns in Audit Log Insert (Lines 129–136):**
     - *Defect:* Inserted into `resource_type`, `resource_id`, and `metadata`. These columns do not exist on `public.audit_logs`.
     - *Correction:* Aligned with the canonical `public.audit_logs` schema from `20261112000001_initial_schema.sql`:
       - `workspace_id`: `v_workspace_id`
       - `resource`: `'site'`
       - `metadata_json`: `pg_catalog.jsonb_build_object('site_id', p_site_id, 'previous_published_version_id', v_site.published_version_id, 'rolled_back_to_version_id', v_target_version.id, 'rolled_back_to_version_number', v_target_version.version_number)`
       - `ip_address`: `NULL`
       - `created_at`: `v_now`
- **Security & Safety Invariants Preserved:**
  - `SECURITY DEFINER` and `SET search_path = ''` retained.
  - Caller session verification `auth.uid() <> p_caller_user_id` retained.
  - Concurrency token check on `p_expected_current_published_version_id` retained (`VY049`).
  - Target version immutable validation (`published_at IS NOT NULL`) retained.
  - Historical version rows in `public.site_versions` remain strictly immutable (zero updates/deletions).
  - Privileges revoked from PUBLIC/anon; granted to `authenticated` and `service_role`.

---

### 2.3 Migration 3: `20261122000003_website_publishing_domains_and_qr.sql`

- **Status:** **CORRECTED**
- **Defects Remediated:**
  1. **Non-Existent Columns in Audit Log Insert (Lines 407–430):**
     - *Defect:* In `public.publish_site_draft_atomic`, the audit log insert referenced `resource_type`, `resource_id`, and `metadata`.
     - *Correction:* Aligned to canonical `public.audit_logs (business_id, workspace_id, user_id, action, resource, metadata_json, ip_address, created_at)`.
  2. **Invalid Workspace Role `'agency_admin'` across RLS Policies & RPC:**
     - *Defect:* Policies on `site_domains`, `qr_codes`, and the authorization check in `publish_site_draft_atomic` referenced role `'agency_admin'`. The check constraint on `public.workspace_members` (`workspace_members_role_check`) only allows `('workspace_owner', 'workspace_admin', 'workspace_member', 'reseller_admin', 'reseller_staff')`.
     - *Correction:* Replaced `'agency_admin'` with canonical workspace management roles: `'workspace_owner', 'workspace_admin', 'reseller_admin'`.
  3. **Missing Sovereign Business Owner in RLS Policies:**
     - *Defect:* RLS policies for `public.site_domains` and `public.qr_codes` required callers to be `business_members` or `workspace_members`. Direct DIY businesses (which have `workspace_id IS NULL`) could not manage domains or QR codes if querying via sovereign owner context.
     - *Correction:* Added `OR EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = site_domains.business_id AND b.sovereign_owner_id = auth.uid())` across SELECT, INSERT, UPDATE, and DELETE policies for `site_domains` and SELECT/MANAGE policies for `qr_codes`.
  4. **Nullable Workspace ID in Plan Capacity Check (Lines 333–360):**
     - *Defect:* If a DIY business without a reseller workspace published a site, the capacity check attempted to lock `public.workspaces WHERE id = NULL`, defaulting to a free plan with limit 1 instead of bypassing workspace plan limits.
     - *Correction:* Guarded capacity check with `IF v_site.status <> 'published' AND v_workspace_id IS NOT NULL THEN`.
  5. **Typo in Exception Message (Line 327):**
     - *Defect:* Format string had unintended whitespace `(% )`.
     - *Correction:* Corrected to `(%)`.

---

## 3. SQL Migration Safety Analysis

| Metric | Migration 1 (`20261122000001`) | Migration 2 (`20261122000002`) | Migration 3 (`20261122000003`) |
|---|---|---|---|
| **Type** | Replacement (`CREATE OR REPLACE`) | New Function (`CREATE OR REPLACE`) | New Tables & New Function |
| **Existing Data Modified** | None | None | None |
| **Existing Objects Dropped** | Old function overloads dropped safely | None | None |
| **Idempotency / Retry Safe** | Yes (`DROP IF EXISTS`, `CREATE OR REPLACE`) | Yes (`CREATE OR REPLACE`) | Yes (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`) |
| **Dependencies** | Requires `public.sites`, `public.site_versions`, `public.can_manage_business`, `public.audit_logs` | Requires Migration 1 & `public.site_versions` | Requires `public.sites`, `public.businesses`, `public.workspaces`, `public.set_updated_at` |
| **Rollback Implication** | Restores 7-parameter `save_site_draft_configuration_atomic` | Drop function `rollback_published_site_version_atomic` | Drop tables `site_domains`, `qr_codes`; drop function `publish_site_draft_atomic` |

---

## 4. Test Strengthening & Verification Results

### 4.1 Unit Test Suites Strengthened:
1. `tests/unit/database/website-rollback-migration.test.ts`:
   - Updated from 12 weak assertions to 13 strict schema assertions.
   - Removed old tests that asserted non-existent `business_memberships` / `workspace_memberships`.
   - Added assertions for `can_manage_business`, `v_workspace_id := v_site.workspace_id;`, and exact canonical `audit_logs` columns.
   - Added negative assertions: `expect(sql).not.toContain("resource_type")`, `expect(sql).not.toContain("business_memberships")`.
2. `tests/unit/database/website-publishing-migration.test.ts`:
   - Updated from 14 weak assertions to 19 structured, categorized assertions.
   - Added validation of table columns, foreign keys (`ON DELETE CASCADE`), indexes, and triggers (`set_updated_at`).
   - Added validation of canonical roles (`workspace_owner`, `workspace_admin`, `reseller_admin`) and sovereign owner checks.
   - Added validation of canonical `audit_logs` columns and rejection of `resource_type` / `resource_id`.

### 4.2 Quality Gate Summary:

| Quality Gate | Command | Exit Code | Result | Notes |
|---|---|---|---|---|
| **TypeScript Typecheck** | `agy-node ./node_modules/typescript/bin/tsc --noEmit` | `0` | **PASS** | 0 type errors across entire repository |
| **ESLint 9** | `agy-node ./node_modules/eslint/bin/eslint.js .` | `0` | **PASS** | 0 errors, 0 warnings with resolved plugins |
| **Prettier Code Style** | `agy-node ./node_modules/prettier/bin/prettier.cjs --check .` | `0` | **PASS** | 100% formatted |
| **Focused Migration Tests** | `agy-node ./node_modules/vitest/vitest.mjs run tests/unit/database/website-rollback-migration.test.ts tests/unit/database/website-publishing-migration.test.ts` | `0` | **PASS** | 2 test files, 32/32 tests passed |
| **Related Database/Service Tests** | `agy-node ./node_modules/vitest/vitest.mjs run tests/unit/database/draft-concurrency-simulation.test.ts tests/unit/database/website-pointer-privilege-audit.test.ts tests/unit/websites/versioning.test.ts tests/unit/websites/service.test.ts` | `0` | **PASS** | 4 test files, 59/59 tests passed |

---

## 5. PostgreSQL Integration Verification Limitations

- **Local Database Environment:** Neither local PostgreSQL, Supabase CLI, `psql`, nor `pg_isready` is installed or running on this Windows host.
- **Production Safety Guarantee:** In accordance with strict instructions, no tests or scripts were connected to the remote production Supabase database (`https://fjoezwoyowihbxacmoyp.supabase.co`).
- **PostgreSQL Integration Status:** Static SQL validation and application service mocking pass with 100% confidence. Live PostgreSQL execution of the 3 migrations remains pending manual application via the Supabase Dashboard SQL Editor or an authorized disposable staging database runner.

---

## 6. Required Production Migration Execution Order

When authorized, apply the 3 migrations in this exact sequential order in the Supabase Dashboard SQL Editor:

1. **Step 1:** Execute `supabase/migrations/20261122000001_website_draft_concurrency_and_optimistic_lock.sql` verbatim.
2. **Step 2:** Execute `supabase/migrations/20261122000002_website_rollback_rpc.sql` (corrected).
3. **Step 3:** Execute `supabase/migrations/20261122000003_website_publishing_domains_and_qr.sql` (corrected).

### Post-Migration Verification Queries:
```sql
-- 1. Confirm tables created:
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name IN ('site_domains', 'qr_codes');

-- 2. Confirm all 3 RPC functions exist with correct signatures:
SELECT routine_name, routine_type FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN ('save_site_draft_configuration_atomic', 'rollback_published_site_version_atomic', 'publish_site_draft_atomic');
```
Expected result: 2 tables returned, 3 functions returned.
