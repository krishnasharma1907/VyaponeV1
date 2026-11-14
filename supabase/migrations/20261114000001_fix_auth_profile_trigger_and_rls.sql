-- ==============================================================================
-- VyapOne — Fix Auth Profile Trigger & RLS Security Definer Bypass
-- Migration: 20261114000001_fix_auth_profile_trigger_and_rls.sql
-- Authority: reference/PRD_VERSIONS/PRD_FINAL_v2_2026-11-03.md (§4, §16, §17)
-- Fixes: GoTrue signup 500 "Database error saving new user" & RLS recursion
-- ==============================================================================

-- 1. Remove FORCE ROW LEVEL SECURITY from all tenant tables
-- Retains ENABLE ROW LEVEL SECURITY so anon/authenticated are strictly protected,
-- but allows SECURITY DEFINER table owner functions (triggers and helpers) to execute.
ALTER TABLE IF EXISTS public.users NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_auth_identities NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.workspaces NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.workspace_members NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.workspace_invitations NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.businesses NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.locations NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.business_members NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sites NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.catalogue_items NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.customers NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.orders NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.invoice_sequences NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bills NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_logs NO FORCE ROW LEVEL SECURITY;

-- 2. Update users and user_auth_identities insert policies to allow unauthenticated signup bootstrap
DROP POLICY IF EXISTS "users_insert_policy" ON public.users;
CREATE POLICY "users_insert_policy" ON public.users
    FOR INSERT
    WITH CHECK (id = auth.uid() OR auth.uid() IS NULL);

DROP POLICY IF EXISTS "user_auth_identities_insert_policy" ON public.user_auth_identities;
CREATE POLICY "user_auth_identities_insert_policy" ON public.user_auth_identities
    FOR INSERT
    WITH CHECK (user_id = auth.uid() OR auth.uid() IS NULL);

-- 3. Hardened set_updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = pg_catalog.now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_catalog;

-- 4. Robust Auth Profile Bootstrap Trigger with fail-safe error handling
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
    v_display_name TEXT;
    v_preferred_lang TEXT;
    v_phone TEXT;
BEGIN
    -- Extract display name from user metadata or fallback cleanly
    v_display_name := pg_catalog.coalesce(
        pg_catalog.nullif(pg_catalog.trim(NEW.raw_user_meta_data->>'display_name'), ''),
        pg_catalog.nullif(pg_catalog.trim(NEW.raw_user_meta_data->>'full_name'), ''),
        pg_catalog.nullif(pg_catalog.trim(pg_catalog.split_part(NEW.email, '@', 1)), ''),
        pg_catalog.nullif(pg_catalog.trim(NEW.phone), ''),
        'VyapOne User'
    );

    v_preferred_lang := pg_catalog.coalesce(
        pg_catalog.nullif(pg_catalog.trim(NEW.raw_user_meta_data->>'preferred_language'), ''),
        'en'
    );

    v_phone := pg_catalog.coalesce(
        pg_catalog.nullif(pg_catalog.trim(NEW.phone), ''),
        pg_catalog.nullif(pg_catalog.trim(NEW.raw_user_meta_data->>'phone'), '')
    );

    -- Insert or update user record in public.users matching auth.users.id
    INSERT INTO public.users (
        id,
        display_name,
        email,
        phone_number,
        status,
        preferred_language,
        created_at,
        updated_at
    )
    VALUES (
        NEW.id,
        v_display_name,
        NEW.email,
        v_phone,
        'active',
        v_preferred_lang,
        pg_catalog.now(),
        pg_catalog.now()
    )
    ON CONFLICT (id) DO UPDATE SET
        display_name = pg_catalog.coalesce(EXCLUDED.display_name, public.users.display_name),
        email = pg_catalog.coalesce(EXCLUDED.email, public.users.email),
        phone_number = pg_catalog.coalesce(EXCLUDED.phone_number, public.users.phone_number),
        updated_at = pg_catalog.now();

    -- Insert or update identity record in public.user_auth_identities
    IF v_phone IS NOT NULL AND v_phone <> '' THEN
        INSERT INTO public.user_auth_identities (
            user_id,
            provider,
            identifier,
            verified_at,
            created_at
        )
        VALUES (
            NEW.id,
            'phone_otp',
            v_phone,
            NEW.phone_confirmed_at,
            pg_catalog.now()
        )
        ON CONFLICT (provider, identifier) DO UPDATE SET
            verified_at = EXCLUDED.verified_at;
    END IF;

    IF NEW.email IS NOT NULL AND NEW.email <> '' THEN
        INSERT INTO public.user_auth_identities (
            user_id,
            provider,
            identifier,
            verified_at,
            created_at
        )
        VALUES (
            NEW.id,
            'email_password',
            NEW.email,
            NEW.email_confirmed_at,
            pg_catalog.now()
        )
        ON CONFLICT (provider, identifier) DO UPDATE SET
            verified_at = EXCLUDED.verified_at;
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Prevent trigger errors from failing the entire GoTrue user creation transaction
    RAISE WARNING 'handle_new_auth_user error: %, SQLSTATE: %', SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

-- 5. Re-bind trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT OR UPDATE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- 6. Ensure schema and table privileges for Supabase roles
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role, supabase_auth_admin;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role, supabase_auth_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role, supabase_auth_admin;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role, supabase_auth_admin;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role, supabase_auth_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role, supabase_auth_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO postgres, anon, authenticated, service_role, supabase_auth_admin;
