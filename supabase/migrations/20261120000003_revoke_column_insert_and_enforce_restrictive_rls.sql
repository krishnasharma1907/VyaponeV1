-- VyapOne Database Migration: 20261120000003_revoke_column_insert_and_enforce_restrictive_rls.sql
-- Module: Sites Authorization, Column-Level Privilege Revocation & Restrictive RLS Deny [VO-040]
--
-- Objective:
-- 1. Explicitly revoke historical column-level INSERT privileges on public.sites granted in 20261120000001
--    to authenticated ((id, business_id, subdomain, primary_domain, created_at, updated_at)).
--    In PostgreSQL, table-level REVOKE INSERT does not remove prior column-level grants in pg_attribute.attacl.
-- 2. Enforce explicit RESTRICTIVE RLS denial policies on public.sites for INSERT and DELETE.
--    In PostgreSQL, permissive policies combine with OR; adding dedicated AS RESTRICTIVE policies
--    guarantees that even if any permissive policy is ever added or exists, direct client writes
--    remain unconditionally rejected via boolean conjunction (AND).
-- 3. Confirm legitimate SELECT reads, approved domain metadata UPDATEs, and service_role orchestration.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Revoke Column-Level and Table-Level INSERT Privileges on public.sites
-- ------------------------------------------------------------------------------
-- Explicitly revoke column-level INSERT grants from 20261120000001
REVOKE INSERT (
    id,
    business_id,
    subdomain,
    primary_domain,
    created_at,
    updated_at
) ON public.sites FROM anon, authenticated, PUBLIC;

-- Re-affirm table-level REVOKE for INSERT and DELETE
REVOKE INSERT, DELETE ON public.sites FROM anon, authenticated, PUBLIC;

-- ------------------------------------------------------------------------------
-- 2. Install Dedicated RESTRICTIVE RLS Denial Policies on public.sites
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "sites_restrictive_insert_deny" ON public.sites;
DROP POLICY IF EXISTS "sites_restrictive_delete_deny" ON public.sites;

-- Dedicated Restrictive INSERT denial: Combines with AND against all permissive policies.
-- Guarantees that anon and authenticated clients can NEVER directly insert into public.sites.
CREATE POLICY "sites_restrictive_insert_deny" ON public.sites
    AS RESTRICTIVE
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (false);

-- Dedicated Restrictive DELETE denial: Combines with AND against all permissive policies.
-- Guarantees that anon and authenticated clients can NEVER directly delete from public.sites.
CREATE POLICY "sites_restrictive_delete_deny" ON public.sites
    AS RESTRICTIVE
    FOR DELETE
    TO anon, authenticated
    USING (false);

-- ------------------------------------------------------------------------------
-- 3. Re-affirm Administrative and Scoped Privileges
-- ------------------------------------------------------------------------------
-- Preserve legitimate domain metadata update for authenticated clients (governed by sites_update_policy)
GRANT UPDATE (subdomain, primary_domain, updated_at) ON public.sites TO authenticated;

-- Preserve storefront and dashboard read access (governed by sites_select_policy)
GRANT SELECT ON public.sites TO anon, authenticated;

-- Service role retains full administrative privileges for system-level lifecycle RPCs
GRANT ALL ON public.sites TO service_role;
