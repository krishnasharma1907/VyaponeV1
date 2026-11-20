-- ==============================================================================
-- VyapOne Database Migration: 20261120000002_revoke_direct_sites_insert_delete.sql
-- Task: VO-040 — Final Sites Table Direct INSERT & DELETE Authorization Audit
--
-- Security Invariants & Rationale:
-- 1. Revoke Direct INSERT on public.sites from untrusted roles:
--    - Direct INSERT allows authenticated clients to create draft sites without passing
--      through VO-026 workspace plan capacity enforcement ('draft_websites').
--    - Direct INSERT bypasses append-only audit logging in public.audit_logs (PRD §17).
--    - Direct INSERT bypasses subdomain validation, reserved keyword checks, and atomic initialization.
--    - Legitimate site provisioning is server-owned and executed via trusted, audited RPCs
--      or service_role transactions.
-- 2. Revoke Direct DELETE on public.sites from untrusted roles:
--    - The canonical PRD (§9.2, §17) does NOT authorize hard deletion of sites; sites follow
--      a soft-lifecycle state machine ('draft' -> 'published' -> 'suspended' -> 'archived').
--    - Direct DELETE on public.sites completely destroys the site record without an audit trail.
--    - Direct DELETE attempts cascading delete into site_versions, which conflicts with
--      immutable published versions and composite foreign-key RESTRICT constraints (VY005).
--    - Direct DELETE leaves private media references in quarantine orphaned.
-- 3. Defend RLS Boundary on public.sites:
--    - Drops permissive sites_insert_policy and sites_delete_policy.
--    - Installs explicit restrictive policies rejecting direct INSERT and DELETE for untrusted roles.
-- 4. Preserve Legitimate Access:
--    - SELECT remains granted to anon and authenticated (governed by sites_select_policy).
--    - UPDATE (subdomain, primary_domain, updated_at) remains granted to authenticated (governed by sites_update_policy).
--    - ALL privileges remain granted to service_role for system orchestration.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Revoke Direct INSERT and DELETE Privileges on public.sites
-- ------------------------------------------------------------------------------
REVOKE INSERT, DELETE ON public.sites FROM anon, authenticated, PUBLIC;

-- ------------------------------------------------------------------------------
-- 2. Restrict Direct INSERT and DELETE in Row-Level Security
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "sites_insert_policy" ON public.sites;
DROP POLICY IF EXISTS "sites_delete_policy" ON public.sites;

-- Explicitly reject direct inserts from untrusted roles
CREATE POLICY "sites_insert_policy" ON public.sites
    FOR INSERT
    TO authenticated, anon
    WITH CHECK (false);

-- Explicitly reject direct deletes from untrusted roles
CREATE POLICY "sites_delete_policy" ON public.sites
    FOR DELETE
    TO authenticated, anon
    USING (false);

-- ------------------------------------------------------------------------------
-- 3. Confirm Service Role Administrative Privileges
-- ------------------------------------------------------------------------------
GRANT ALL ON public.sites TO service_role;
