-- ==============================================================================
-- VyapOne — Harden Auth Trigger, Prevent Anonymous Writes & Profile Integrity
-- Migration: 20261115000002_harden_auth_trigger_and_profile_rls.sql
-- Authority: reference/PRD_VERSIONS/PRD_FINAL_v2_2026-11-03.md (§4, §16, §17)
-- Focus: Final Security Hardening — Column-level privileges, Zero unauthenticated
--        writes, Identity theft prevention, Search-path hardening, Profile recovery,
--        Default ACL restrictions, and PII Protection.
-- ==============================================================================

-- 1. Revoke write privileges from anon & PUBLIC across ALL public tables
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, PUBLIC;

-- 2. Grant SELECT privileges to anon strictly on public web storefront browsing tables
GRANT SELECT ON public.sites, public.catalogue_items TO anon;

-- 3. Revoke excessive maintenance privileges (TRUNCATE, TRIGGER) from authenticated
REVOKE TRUNCATE, TRIGGER ON ALL TABLES IN SCHEMA public FROM authenticated, anon, PUBLIC;

-- 4. Harden audit_logs table to be strictly append-only (no update or deletion by application users)
REVOKE UPDATE, DELETE, TRUNCATE ON public.audit_logs FROM authenticated, anon, PUBLIC;

-- 5. Column-level privilege protection for public.users
-- Only display_name and preferred_language are user-editable.
-- Protected columns (id, status, email, phone_number, created_at, updated_at) cannot be modified directly.
REVOKE ALL ON public.users FROM anon, authenticated, PUBLIC;
GRANT SELECT ON public.users TO authenticated;
GRANT UPDATE (display_name, preferred_language) ON public.users TO authenticated;

-- 6. Privilege hardening for public.user_auth_identities
-- Identities are security-sensitive credentials; no direct user INSERT/UPDATE/DELETE is permitted.
REVOKE ALL ON public.user_auth_identities FROM anon, authenticated, PUBLIC;
GRANT SELECT ON public.user_auth_identities TO authenticated;

-- 7. Scope supabase_auth_admin privileges strictly to auth profile provisioning
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM supabase_auth_admin;
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT SELECT, INSERT, UPDATE ON public.users, public.user_auth_identities TO supabase_auth_admin;

-- 8. Harden default privileges for future objects
-- Explicit least privilege: revoke all default table, sequence, and routine privileges from anon, authenticated, and PUBLIC.
-- Every future table must receive its own explicit GRANT and RLS policies in its feature migration.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated, PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated, PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON ROUTINES FROM anon, PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO service_role;

-- 9. Row-Level Security Policies for public.users and public.user_auth_identities
-- Drop direct INSERT policies (profile creation is governed by trigger and secure RPC)
DROP POLICY IF EXISTS "users_insert_policy" ON public.users;

-- Explicitly drop users_delete_policy.
-- In VyapOne, hard deletion of user accounts by end-users is intentionally prohibited.
-- User deactivation/suspension is performed via status transitions ('suspended').
-- Sovereign data deletion is governed by administrative DPDP compliance workflows (VO-124).
-- Because DELETE privilege is revoked from authenticated on public.users, no DELETE policy is created.
DROP POLICY IF EXISTS "users_delete_policy" ON public.users;

DROP POLICY IF EXISTS "users_update_policy" ON public.users;
CREATE POLICY "users_update_policy" ON public.users
    FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Tighten users_select_policy:
-- Users can always view their own profile.
-- Workspace and Business owners/admins can view member profiles within their tenant.
-- Regular peers cannot view other users' private contact details directly from public.users.
DROP POLICY IF EXISTS "users_select_policy" ON public.users;
CREATE POLICY "users_select_policy" ON public.users
    FOR SELECT
    TO authenticated
    USING (
        id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.workspace_members wm_admin
            JOIN public.workspace_members wm_target ON wm_target.workspace_id = wm_admin.workspace_id
            WHERE wm_admin.user_id = auth.uid()
              AND wm_admin.role IN ('owner', 'workspace_owner', 'admin', 'workspace_admin', 'reseller_owner', 'reseller_admin')
              AND wm_target.user_id = public.users.id
        ) OR
        EXISTS (
            SELECT 1 FROM public.business_members bm_admin
            JOIN public.business_members bm_target ON bm_target.business_id = bm_admin.business_id
            WHERE bm_admin.user_id = auth.uid()
              AND bm_admin.role IN ('owner', 'manager')
              AND bm_target.user_id = public.users.id
        )
    );

DROP POLICY IF EXISTS "user_auth_identities_insert_policy" ON public.user_auth_identities;
DROP POLICY IF EXISTS "user_auth_identities_update_policy" ON public.user_auth_identities;
DROP POLICY IF EXISTS "user_auth_identities_delete_policy" ON public.user_auth_identities;

DROP POLICY IF EXISTS "user_auth_identities_select_policy" ON public.user_auth_identities;
CREATE POLICY "user_auth_identities_select_policy" ON public.user_auth_identities
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- 10. User Directory Projection View
-- Exposes non-sensitive profile information for workspace and business team directories.
-- Strictly omits private contact details (email, phone_number) from peer members.
CREATE OR REPLACE VIEW public.user_directory
WITH (security_invoker = true) AS
SELECT
    u.id,
    u.display_name,
    u.status,
    u.preferred_language
FROM public.users u
WHERE
    u.id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.user_id = u.id
          AND public.is_workspace_member(wm.workspace_id, auth.uid())
    ) OR
    EXISTS (
        SELECT 1 FROM public.business_members bm
        WHERE bm.user_id = u.id
          AND public.is_business_member(bm.business_id, auth.uid())
    );

GRANT SELECT ON public.user_directory TO authenticated;

-- 11. Hardened Auth Trigger Function
-- - SECURITY DEFINER owned by postgres (bypasses RLS naturally)
-- - SET search_path = '' strictly protects against search_path hijacking
-- - All relation and function references are schema-qualified
-- - Standard SQL constructs (coalesce, nullif, trim) used without invalid pg_catalog prefix
-- - Dual-check phone collision handling ensures duplicate phone numbers do not violate unique constraints
-- - Identity conflict protection: ON CONFLICT ... WHERE user_id = EXCLUDED.user_id prevents identity theft
-- - Unexpected fatal errors are propagated so GoTrue transactions abort atomically (zero silent suppression)
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_display_name pg_catalog.text;
    v_preferred_lang pg_catalog.text;
    v_phone pg_catalog.text;
    v_existing_id pg_catalog.uuid;
BEGIN
    -- 1. Sanitize and extract display name
    v_display_name := coalesce(
        nullif(trim(NEW.raw_user_meta_data->>'display_name'), ''),
        nullif(trim(NEW.raw_user_meta_data->>'full_name'), ''),
        nullif(trim(pg_catalog.split_part(NEW.email, '@', 1)), ''),
        nullif(trim(NEW.phone), ''),
        'VyapOne User'
    );

    v_preferred_lang := coalesce(
        nullif(trim(NEW.raw_user_meta_data->>'preferred_language'), ''),
        'en'
    );

    v_phone := coalesce(
        nullif(trim(NEW.phone), ''),
        nullif(trim(NEW.raw_user_meta_data->>'phone'), '')
    );

    -- 2. Guard against phone number collision with another user (both in users and identities)
    IF v_phone IS NOT NULL AND v_phone <> '' THEN
        SELECT id INTO v_existing_id
        FROM public.users
        WHERE phone_number = v_phone AND id <> NEW.id
        LIMIT 1;

        IF v_existing_id IS NOT NULL THEN
            v_phone := NULL;
        ELSE
            SELECT user_id INTO v_existing_id
            FROM public.user_auth_identities
            WHERE provider = 'phone_otp' AND identifier = v_phone AND user_id <> NEW.id
            LIMIT 1;

            IF v_existing_id IS NOT NULL THEN
                v_phone := NULL;
            END IF;
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
        display_name = coalesce(EXCLUDED.display_name, public.users.display_name),
        email = coalesce(EXCLUDED.email, public.users.email),
        phone_number = coalesce(EXCLUDED.phone_number, public.users.phone_number),
        updated_at = pg_catalog.now();

    -- 4. Upsert phone identity if valid and non-colliding
    -- Guard: Only update verification timestamp if the identity already belongs to this user
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
            verified_at = coalesce(EXCLUDED.verified_at, public.user_auth_identities.verified_at)
        WHERE public.user_auth_identities.user_id = EXCLUDED.user_id;
    END IF;

    -- 5. Upsert email identity if present
    -- Guard: Only update verification timestamp if the identity already belongs to this user
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
            verified_at = coalesce(EXCLUDED.verified_at, public.user_auth_identities.verified_at)
        WHERE public.user_auth_identities.user_id = EXCLUDED.user_id;
    END IF;

    RETURN NEW;
END;
$$;

-- 12. Restrict trigger execution privileges (least privilege)
-- Trigger functions must not be directly invocable by anon or authenticated RPC
REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_auth_user() TO postgres, supabase_auth_admin, service_role;

-- 13. Secure Profile Recovery RPC
-- Allows authenticated users to safely provision or recover their profile if missing
-- Strictly uses auth.uid() and auth.users verified data; caller cannot forge another user's profile
CREATE OR REPLACE FUNCTION public.ensure_user_profile(
    p_display_name pg_catalog.text DEFAULT NULL,
    p_preferred_language pg_catalog.text DEFAULT NULL
)
RETURNS pg_catalog.jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id pg_catalog.uuid;
    v_email pg_catalog.text;
    v_phone pg_catalog.text;
    v_raw_meta pg_catalog.jsonb;
    v_display_name pg_catalog.text;
    v_pref_lang pg_catalog.text;
    v_existing_id pg_catalog.uuid;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
    END IF;

    SELECT email, phone, raw_user_meta_data
    INTO v_email, v_phone, v_raw_meta
    FROM auth.users
    WHERE id = v_user_id;

    IF v_email IS NULL AND v_phone IS NULL THEN
        RAISE EXCEPTION 'Auth user record not found' USING ERRCODE = 'P0002';
    END IF;

    v_display_name := coalesce(
        nullif(trim(p_display_name), ''),
        nullif(trim(v_raw_meta->>'display_name'), ''),
        nullif(trim(v_raw_meta->>'full_name'), ''),
        nullif(trim(pg_catalog.split_part(v_email, '@', 1)), ''),
        nullif(trim(v_phone), ''),
        'VyapOne User'
    );

    v_pref_lang := coalesce(
        nullif(trim(p_preferred_language), ''),
        nullif(trim(v_raw_meta->>'preferred_language'), ''),
        'en'
    );

    v_phone := coalesce(
        nullif(trim(v_phone), ''),
        nullif(trim(v_raw_meta->>'phone'), '')
    );

    IF v_phone IS NOT NULL AND v_phone <> '' THEN
        SELECT id INTO v_existing_id
        FROM public.users
        WHERE phone_number = v_phone AND id <> v_user_id
        LIMIT 1;

        IF v_existing_id IS NOT NULL THEN
            v_phone := NULL;
        END IF;
    END IF;

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
        v_user_id,
        v_display_name,
        v_email,
        v_phone,
        'active',
        v_pref_lang,
        pg_catalog.now(),
        pg_catalog.now()
    )
    ON CONFLICT (id) DO UPDATE SET
        display_name = coalesce(EXCLUDED.display_name, public.users.display_name),
        email = coalesce(EXCLUDED.email, public.users.email),
        phone_number = coalesce(EXCLUDED.phone_number, public.users.phone_number),
        updated_at = pg_catalog.now();

    RETURN pg_catalog.jsonb_build_object(
        'success', true,
        'user_id', v_user_id,
        'display_name', v_display_name
    );
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_user_profile(pg_catalog.text, pg_catalog.text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_user_profile(pg_catalog.text, pg_catalog.text) TO authenticated, service_role;
