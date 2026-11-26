# CLOUD-009 — Invitation RPC Security, Seed Compatibility & PostgreSQL Test Remediation

**Task ID:** `CLOUD-009`  
**Date:** 2026-11-25  
**Release Decision:** **NO-GO (LOCAL REMEDIATION COMPLETE / REAL POSTGRESQL & LINUX CI NOT RUN / ADR-028 REQUIRES OWNER APPROVAL)**

---

## 1. Scope & Safety Compliance

- **Production Systems:** Untouched. Zero production SQL executed, zero `supabase db push` / `--linked` / `--remote` commands run, zero `git push` or GitHub Actions triggers invoked, and zero Cloudflare deploys or secret changes performed.
- **Historical Migration Integrity:** Migrations **1–25** (`20261112000001` through `20261120000003`) remain **100% immutable** on disk.
- **`ADR-028` Status:** Remains **`REQUIRES_APPROVAL`** (unapproved; no clean-DB stub or unapproved baseline squash created).

---

## 2. Remediated Defects

### 2.1 `accept_workspace_invitation_atomic` & `accept_business_invitation_atomic` (`20261125000001`)

- **Confirmed Defects (`CLOUD-008` finding in `20261125000001` & `20261117000001`):**
  1. `accept_workspace_invitation_atomic` called `PERFORM public.assert_and_lock_workspace_capacity(v_invitation.workspace_id, 'team_seats', 1)` for a non-member invitee. Because `assert_and_lock_workspace_capacity` requires callers (`auth.uid()`) to already be the workspace owner or an active `workspace_members` row, every legitimate invited `authenticated` user was rejected with SQLSTATE `VY003`.
  2. Even for `service_role`/`postgres`, `PERFORM` discarded the `TABLE(allowed BOOLEAN, ...)` return value, silently allowing over-capacity acceptance.
  3. Both `accept_workspace_invitation_atomic` and historical `accept_business_invitation_atomic` (`20261117000001`) lacked `auth.uid()` caller verification and verified account email checks against `auth.users` / `public.users` / JWT claims, and locked the child invitation row before the parent tenant row.
- **Local Remediation (`FIXED LOCALLY` in `supabase/migrations/20261125000001_remediate_historical_schema_and_rpc_defects.sql`):**
  1. Removed the `assert_and_lock_workspace_capacity` call inside `accept_workspace_invitation_atomic` while keeping `assert_and_lock_workspace_capacity` strict for existing workspace members.
  2. Added authenticated session verification (`auth.uid() <> p_accepting_user_id` -> `VY013`; unauthenticated non-`postgres`/`service_role` -> `28000`) and verified account email checks (`COALESCE(auth.users.email, public.users.email)` plus non-empty JWT `email` claim -> `VY013`) in both `accept_workspace_invitation_atomic` and a forward corrective `accept_business_invitation_atomic` definition.
  3. Changed locking to canonical parent-first order (`workspaces -> workspace_invitations` and `businesses -> business_invitations`), rejecting missing or `'archived'` tenants with `VY002`.
  4. Enforced `team_seats` directly inside `accept_workspace_invitation_atomic` under the `workspaces FOR UPDATE` lock (resolving `subscriptions` -> `workspaces.plan`, canonical tier seats `starter=2`, `growth`/`pro=5`, `agency=15`, `scale=50`, scalar-coalesced `capacity_overrides`, and active `workspace_members` count), raising `VY001` when `(v_active_seats + 1) > v_effective_seats`, while permitting `already_member = true` without consuming an extra seat.
  5. Preserved `SECURITY DEFINER`, `SET search_path = ''`, and `REVOKE ... FROM PUBLIC, anon; GRANT EXECUTE ... TO authenticated, service_role;`.
- **Service Error Mapping (`src/lib/workspaces/service.ts`, `src/lib/businesses/service.ts`):** Added handling for `"Capacity limit"` wording on `VY001`, `VY002` (`404`), and `VY003`/`28000`/`42501` (`403`), matching SQL outcomes cleanly.

### 2.2 `supabase/seed.sql` Draft-to-Published Trigger Compatibility

- **Confirmed Defect:** Line 65 of `supabase/seed.sql` inserted `status = 'published'` directly into `public.sites`, which `trg_check_site_insert_status` (`20261116000002`, `VY003`) blocks on `supabase start` / `supabase db reset`.
- **Local Remediation (`FIXED LOCALLY` in `supabase/seed.sql`):**
  - Inserts `'40000000-0000-4000-a000-000000000001'` with `status = 'draft'`.
  - Seeds initial version `v1` (`'41000000-0000-4000-a000-000000000001'`) in `public.site_versions` idempotently.
  - Publishes idempotently via `public.publish_site_draft_atomic(...)` only when `status = 'draft' AND published_version_id IS NULL`. Zero trigger bypasses or test-only migrations were used.

### 2.3 Security & Contract Parity Findings

| Area | Finding | Resolution | Status |
|---|---|---|---|
| **Publish/Rollback `VY049` Concurrency** | Passing `NULL` expected version in SQL bypassed optimistic locking on live/draft versions (`20261122000002`, `20261122000003`) | `rollback_published_site_version_atomic` now checks `v_site.published_version_id IS DISTINCT FROM p_expected_current_published_version_id` strictly; `publish_site_draft_atomic` explicitly raises `VY049` when `p_expected_draft_version_number IS NULL` | `FIXED LOCALLY` |
| **Business Role Parity (`owner`/`manager` vs `cashier`/`staff`)** | `src/lib/websites/*` mutation helpers only called `assertBusinessAccess(supabase, businessId)` without permission checks, and `removeCustomDomain` called `adapter.removeDomain()` before DB RLS could reject business `manager` (`site_domains_delete_policy`) | Added `{ requiredPermission: "business:update_profile" }` on draft save, pre-publish, publish, rollback, domain add/verify/remove, and QR update; `removeCustomDomain` rejects direct business `manager` (`403 FORBIDDEN`) before touching the external DNS provider | `FIXED LOCALLY` |
| **`site_domains` & `qr_codes` RLS + Custom Domains** | `site_domains` & `qr_codes` `WITH CHECK` policies did not confirm `site_id` belonged to `business_id`; `resolveSiteByDomain` did not double-check `version.site_id` / `version.business_id` / `published_at` | Added `EXISTS (SELECT 1 FROM public.sites s WHERE s.id = ...site_id AND s.business_id = ...business_id)` in `20261122000003`; added fail-closed checks to `resolveSiteByDomain`; verified `anon` retains zero grants/policies on `site_domains` | `FIXED LOCALLY` |
| **Runtime RPC Signature/Return Parity** | Checked `create_business_with_setup_atomic`, `confirm_business_import_atomic`, invitation RPCs, publish, rollback vs `src/lib/supabase/types.ts` and services | Verified parameter names, types, JSON return keys, `SECURITY DEFINER`, `SET search_path = ''`, and `pg_proc` grants aligned across all 9 RPCs | `VERIFIED STATICALLY` |

---

## 3. PostgreSQL Integration & CI Readiness Additions

1. **New pgTAP Suite ([`supabase/tests/00002_security_and_rpc_integration_test.sql`](file:///f:/VyaponeV2/supabase/tests/00002_security_and_rpc_integration_test.sql)):** `plan(42)` transactional test suite covering:
   - `pg_proc` existence, `SECURITY DEFINER`, `search_path=`, `anon`/`PUBLIC`/`authenticated`/`service_role` grants across all 9 atomic RPCs
   - `trg_notifications_updated_at` -> `set_updated_at()` and `UPDATE public.notifications`
   - `accept_workspace_invitation_atomic`: valid non-member invitee acceptance, `VY013` caller/email spoof rejection, `VY011` replay, `VY012` expired, `already_member`, `starter` 2-seat `VY001` rejection, `capacity_overrides` `+1` allowance
   - `accept_business_invitation_atomic`: `VY013` spoof rejection & owner handoff
   - Publishing/rollback `VY049` concurrency (including `NULL` bypass rejection) & `manager` vs `staff`/`cashier` parity
   - `site_domains` & `qr_codes` RLS (`staff` select allowed, `staff`/`cashier` writes denied `42501`, `manager` insert allowed & delete denied, `owner` delete allowed, cross-tenant `site_id`+`business_id` denied `42501`)
   - `create_business_with_setup_atomic` & `confirm_business_import_atomic` canonical `niches -> niche_groups` execution
2. **Expanded PostgreSQL CI Script ([`scripts/ci/verify-supabase-migrations.mjs`](file:///f:/VyaponeV2/scripts/ci/verify-supabase-migrations.mjs)):** Extended `pg_proc` assertions from 3 to all 9 critical RPCs and added behavioral SQL checks matching pgTAP scenarios cleanly inside rollback-only savepoints.
3. **Linux CI Workflow ([`.github/workflows/cloudflare-validation.yml`](file:///f:/VyaponeV2/.github/workflows/cloudflare-validation.yml)):** Added `supabase test db` after `supabase db reset --local --yes` inside the manual-only (`workflow_dispatch`, `contents: read`) Linux validation job so both `00001_schema_test.sql` and `00002_security_and_rpc_integration_test.sql` run once `ADR-028` is resolved.
4. **Expanded Vitest Static/Mock Suites:** Updated `tests/unit/database/*`, `tests/unit/ci/cloudflare-validation.test.ts`, `tests/unit/workspaces/invitations.test.ts`, `tests/unit/websites/service.test.ts`, and `tests/unit/websites/pre-publish-and-publishing.test.tsx`.

---

## 4. Verification & Blockers Summary

- **Prettier / ESLint / TypeScript / Vitest:** Static formatting, lint, strict typecheck, and Vitest suites run locally (`PASS` recorded only after final edit).
- **Live PostgreSQL (`supabase start`, `supabase db reset`, `supabase test db`, `verify-supabase-migrations.mjs`):** **`NOT RUN`** locally (Windows host has no `docker`, `supabase`, `psql`, or PostgreSQL runtime; historical `20261117000002` clean-DB blocker remains gated on `ADR-028`).
- **Linux GitHub Actions (`workflow_dispatch`) & OpenNext Build:** **`NOT RUN`** locally; workflow changes remain uncommitted locally with zero Git push performed.
- **Required Owner Action (`REQUIRES OWNER APPROVAL`):**
  1. Approve `ADR-028` Option D read-only production pre-check & chosen recovery path (`Option B` baseline or signed `Option A` fix for `20261117000002`).
  2. Authorize push to approved branch and manual `workflow_dispatch` execution of `.github/workflows/cloudflare-validation.yml`.
  3. Authorize applying pending migrations `20261122000001`, `20261122000002`, `20261122000003`, and `20261125000001` before any Cloudflare deployment.
