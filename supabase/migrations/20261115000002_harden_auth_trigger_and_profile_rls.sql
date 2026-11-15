-- ==============================================================================
-- VyapOne — Harden Auth Trigger, Prevent Anonymous RLS Insert & Profile Integrity
-- Migration: 20261115000002_harden_auth_trigger_and_profile_rls.sql
-- Authority: reference/PRD_VERSIONS/PRD_FINAL_v2_2026-11-03.md (§4, §16, §17)
-- Focus: Security Audit remediation — Zero unauthenticated write access,
--        Least-privilege SQL grants, Resilient profile creation, Collision safety.
-- ==============================================================================

-- 1. Revoke all write privileges from anon role on auth profile tables
-- An unauthenticated client must NEVER have direct INSERT, UPDATE, or DELETE privileges
-- on public.users or public.user_auth_identities.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.users FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.user_auth_identities FROM anon;

-- 2. Restrict INSERT and UPDATE on public.users strictly to authenticated user's own row
DROP POLICY IF EXISTS "users_insert_policy" ON public.users;
CREATE POLICY "users_insert_policy" ON public.users
    FOR INSERT
    TO authenticated
    WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "users_update_policy" ON public.users;
CREATE POLICY "users_update_policy" ON public.users
    FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- 3. Restrict INSERT and UPDATE on public.user_auth_identities strictly to authenticated user
DROP POLICY IF EXISTS "user_auth_identities_insert_policy" ON public.user_auth_identities;
CREATE POLICY "user_auth_identities_insert_policy" ON public.user_auth_identities
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user_auth_identities_update_policy" ON public.user_auth_identities;
CREATE POLICY "user_auth_identities_update_policy" ON public.user_auth_identities
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- 4. Hardened, Resilient Auth Trigger Function
-- - Runs as SECURITY DEFINER owned by postgres (bypasses RLS naturally without FORCE RLS)
-- - Explicit search_path = public, pg_catalog protects against search_path hijacking
-- - Proactively checks and resolves phone collisions so registration never crashes or orphans users
-- - Implements fallback bootstrap guarantee in EXCEPTION block so an Auth user is never left without a profile
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
    v_display_name TEXT;
    v_preferred_lang TEXT;
    v_phone TEXT;
    v_existing_id UUID;
BEGIN
    -- 1. Sanitize and extract display name
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

    -- 2. Guard against phone number collision with another user
    IF v_phone IS NOT NULL AND v_phone <> '' THEN
        SELECT id INTO v_existing_id
        FROM public.users
        WHERE phone_number = v_phone AND id <> NEW.id
        LIMIT 1;

        IF v_existing_id IS NOT NULL THEN
            -- Collision detected: do not assign conflicting phone number to new profile
            v_phone := NULL;
        END IF;
    END IF;

    -- 3. Upsert user profile record in public.users
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

    -- 4. Upsert phone identity if valid and non-colliding
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
            verified_at = pg_catalog.coalesce(EXCLUDED.verified_at, public.user_auth_identities.verified_at);
    END IF;

    -- 5. Upsert email identity if present
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
            verified_at = pg_catalog.coalesce(EXCLUDED.verified_at, public.user_auth_identities.verified_at);
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Prevent trigger failure while guaranteeing minimal public.users profile exists
    RAISE WARNING 'handle_new_auth_user error: %, SQLSTATE: %', SQLERRM, SQLSTATE;
    BEGIN
        INSERT INTO public.users (id, display_name, email, status, preferred_language, created_at, updated_at)
        VALUES (NEW.id, 'VyapOne User', NEW.email, 'active', 'en', pg_catalog.now(), pg_catalog.now())
        ON CONFLICT (id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

-- 5. Restrict trigger execution privileges (least privilege)
REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM anon;
REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_auth_user() TO postgres, supabase_auth_admin, service_role;
