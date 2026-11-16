-- ==============================================================================
-- VyapOne Database Migration: 20261116000002_harden_sites_table_privileges_and_rpc.sql
-- Task: VO-026 — Sites Table Privilege Hardening & Zero-Bypass RPC Gate
--
-- Security Invariants Addressed:
-- 1. Eliminate broad table-level UPDATE & INSERT privileges from authenticated on public.sites.
--    In PostgreSQL, a table-level grant supersedes column-level revocations.
-- 2. Grant explicit, column-level INSERT excluding status:
--    Direct INSERT cannot supply status; all new sites default to 'draft'.
-- 3. Install unconditional check_site_insert_status_trigger:
--    Rejects ANY non-draft status on direct INSERT with SQLSTATE VY003, independent of GUCs.
-- 4. Grant explicit, column-level UPDATE excluding status and business_id:
--    Direct UPDATE naming status or business_id is rejected by the PostgreSQL parser/privilege check.
-- 5. Neutralize custom GUC manipulation:
--    Callers setting vyapone.in_atomic_site_transition cannot bypass column-level privilege checks.
-- 6. Enforce transition_site_status_atomic() as the exclusive path for status transitions.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Revoke Broad Table-Level Privileges from Untrusted Roles
-- ------------------------------------------------------------------------------
-- In PostgreSQL, revoking column privileges has NO effect if the role holds table-level grants.
-- Table-level ALL/UPDATE/INSERT are completely stripped from anon, authenticated, and PUBLIC.
REVOKE ALL ON public.sites FROM anon, authenticated, PUBLIC;

-- ------------------------------------------------------------------------------
-- 2. Scoped SELECT Privileges
-- ------------------------------------------------------------------------------
-- anon: public storefront browsing (filtered by RLS sites_select_policy: status = 'published')
-- authenticated: business storefront management and dashboard inspection
GRANT SELECT ON public.sites TO anon, authenticated;

-- ------------------------------------------------------------------------------
-- 3. Scoped Column-Level INSERT Privileges (Strictly Excludes status)
-- ------------------------------------------------------------------------------
-- authenticated clients may insert new sites for businesses they manage.
-- status is intentionally excluded from the column list; all inserts rely on column DEFAULT 'draft'.
-- Any explicit supply of status in direct INSERT statements is rejected with permission denied.
GRANT INSERT (id, business_id, subdomain, primary_domain, published_version_id, created_at, updated_at)
ON public.sites TO authenticated;

-- ------------------------------------------------------------------------------
-- 4. Scoped Column-Level UPDATE Privileges (Strictly Excludes status & business_id)
-- ------------------------------------------------------------------------------
-- authenticated clients may update non-critical website attributes.
-- status and business_id are intentionally excluded; direct UPDATE naming them fails at the parser.
GRANT UPDATE (subdomain, primary_domain, published_version_id, updated_at)
ON public.sites TO authenticated;

-- ------------------------------------------------------------------------------
-- 5. Scoped DELETE Privilege (Protected by RLS sites_delete_policy)
-- ------------------------------------------------------------------------------
-- Sovereign business owners may delete draft sites per RLS policy.
GRANT DELETE ON public.sites TO authenticated;

-- ------------------------------------------------------------------------------
-- 6. Administrative Privileges for Trusted Service Role
-- ------------------------------------------------------------------------------
GRANT ALL ON public.sites TO service_role;

-- ------------------------------------------------------------------------------
-- 7. Defense-in-Depth Trigger: Unconditional Draft Status on Direct INSERT
-- ------------------------------------------------------------------------------
-- Guarantees that even if an execution context supplies a status, direct INSERT can NEVER
-- create a published, archived, or suspended storefront. Publishing requires transition_site_status_atomic().
CREATE OR REPLACE FUNCTION public.check_site_insert_status_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.status IS DISTINCT FROM 'draft' THEN
        RAISE EXCEPTION 'Direct insertion of non-draft site is prohibited. New sites must be created with status draft'
            USING ERRCODE = 'VY003';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_site_insert_status ON public.sites;
CREATE TRIGGER trg_check_site_insert_status
    BEFORE INSERT ON public.sites
    FOR EACH ROW
    EXECUTE FUNCTION public.check_site_insert_status_trigger();

-- ------------------------------------------------------------------------------
-- 8. Trigger Function Execution Privileges
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.check_site_insert_status_trigger() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_site_insert_status_trigger() TO postgres, service_role;
