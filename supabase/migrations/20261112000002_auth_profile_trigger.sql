-- ==============================================================================
-- VyapOne — Auth Profile & Identity Linking Trigger
-- Migration: 20261112000002_auth_profile_trigger.sql
-- Authority: reference/PRD_VERSIONS/PRD_FINAL_v2_2026-11-03.md (§4, §16, §17)
-- Task: VO-021
--
-- Security Invariants:
--   1. Trigger runs with SECURITY DEFINER to bridge auth.users to public.users
--   2. Explicit search_path = public, auth prevents search path hijacking
--   3. No passwords, tokens, or raw credentials duplicated into public tables
--   4. Idempotent ON CONFLICT handling protects against duplicate insert crashes
-- ==============================================================================

-- 1. Create Profile Bootstrap Function
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
    v_display_name TEXT;
    v_preferred_lang TEXT;
BEGIN
    -- Extract display name from user metadata or fallback cleanly
    v_display_name := COALESCE(
        NULLIF(TRIM(NEW.raw_user_meta_data->>'display_name'), ''),
        NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
        NULLIF(TRIM(split_part(NEW.email, '@', 1)), ''),
        NULLIF(TRIM(NEW.phone), ''),
        'VyapOne User'
    );

    v_preferred_lang := COALESCE(
        NULLIF(TRIM(NEW.raw_user_meta_data->>'preferred_language'), ''),
        'en'
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
        NEW.phone,
        'active',
        v_preferred_lang,
        now(),
        now()
    )
    ON CONFLICT (id) DO UPDATE SET
        email = COALESCE(EXCLUDED.email, public.users.email),
        phone_number = COALESCE(EXCLUDED.phone_number, public.users.phone_number),
        updated_at = now();

    -- Insert or update identity record in public.user_auth_identities
    IF NEW.phone IS NOT NULL AND NEW.phone <> '' THEN
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
            NEW.phone,
            NEW.phone_confirmed_at,
            now()
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
            now()
        )
        ON CONFLICT (provider, identifier) DO UPDATE SET
            verified_at = EXCLUDED.verified_at;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- 2. Create Trigger on auth.users (Executed when Supabase Auth creates a user)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'on_auth_user_created'
    ) THEN
        CREATE TRIGGER on_auth_user_created
            AFTER INSERT OR UPDATE ON auth.users
            FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
    END IF;
END $$;
