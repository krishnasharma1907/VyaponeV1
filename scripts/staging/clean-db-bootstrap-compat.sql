-- ==============================================================================
-- VyapOne — STAGING-ONLY Clean Empty Database Bootstrap Compatibility Helper
-- File: scripts/staging/clean-db-bootstrap-compat.sql
--
-- WARNING:
--   - FOR ISOLATED NEW STAGING DATABASES ONLY (VyapOne-Staging).
--   - NEVER EXECUTE AGAINST PRODUCTION (project ref: fjoezwoyowihbxacmoyp).
--   - NOT A MIGRATION IN `supabase/migrations/`. Historical migrations 1-25
--     (20261112000001 through 20261120000003) remain strictly unmodified.
--
-- BACKGROUND (STAGING-001 / ADR-028):
--   Historical migration #13 (`20261117000002_audit_and_notification_foundation.sql`)
--   binds `trg_notifications_updated_at` to `public.update_updated_at_column()`,
--   which does not exist on a fresh empty database (`20261112000001` only defines
--   `public.set_updated_at()`). Forward corrective migration #29
--   (`20261125000001_remediate_historical_schema_and_rpc_defects.sql`) switches
--   that trigger to canonical `public.set_updated_at()`.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- STAGE 1: Run BEFORE `supabase db push` on a fresh EMPTY VyapOne-Staging DB
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    IF pg_catalog.to_regprocedure('public.update_updated_at_column()') IS NULL THEN
        CREATE FUNCTION public.update_updated_at_column()
        RETURNS TRIGGER
        LANGUAGE plpgsql
        SET search_path = ''
        AS $fn$
        BEGIN
            NEW.updated_at = pg_catalog.now();
            RETURN NEW;
        END;
        $fn$;
    END IF;
END
$$;

-- ------------------------------------------------------------------------------
-- STAGE 2: Run AFTER migrations 1-29 (`20261112000001` .. `20261125000001`) pass
-- ------------------------------------------------------------------------------
-- Uncomment and execute STAGE 2 ONLY once `20261125000001` has replaced
-- `trg_notifications_updated_at` with `public.set_updated_at()` so staging has
-- zero temporary shim drift:
--
-- DROP FUNCTION IF EXISTS public.update_updated_at_column();
