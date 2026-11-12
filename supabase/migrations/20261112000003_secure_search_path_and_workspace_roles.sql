-- ==============================================================================
-- VyapOne — Secure Search Path & Workspace Roles Expansion
-- Migration: 20261112000003_secure_search_path_and_workspace_roles.sql
-- Authority: reference/PRD_VERSIONS/PRD_FINAL_v2_2026-11-03.md (§4, §16, §17)
-- Task: VO-022
--
-- Security Invariants:
--   1. Re-define handle_new_auth_user() with SET search_path = '' and fully qualified
--      pg_catalog and public references to eliminate search path hijacking.
--   2. Expand workspace_members role constraint to support canonical workspace roles:
--      'workspace_owner', 'workspace_admin', 'workspace_member' alongside backwards-
--      compatible 'reseller_admin' and 'reseller_staff'.
--   3. Create public.workspace_invitations with secure token hashes, expiry, and RLS.
-- ==============================================================================

-- 1. Redefine handle_new_auth_user with SET search_path = '' and schema-qualified references
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
    v_display_name TEXT;
    v_preferred_lang TEXT;
BEGIN
    -- Extract display name from user metadata or fallback cleanly using pg_catalog
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
        pg_catalog.now(),
        pg_catalog.now()
    )
    ON CONFLICT (id) DO UPDATE SET
        email = pg_catalog.coalesce(EXCLUDED.email, public.users.email),
        phone_number = pg_catalog.coalesce(EXCLUDED.phone_number, public.users.phone_number),
        updated_at = pg_catalog.now();

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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 2. Expand role check constraint on public.workspace_members
ALTER TABLE public.workspace_members DROP CONSTRAINT IF EXISTS workspace_members_role_check;
ALTER TABLE public.workspace_members ADD CONSTRAINT workspace_members_role_check
    CHECK (role IN ('workspace_owner', 'workspace_admin', 'workspace_member', 'reseller_admin', 'reseller_staff'));

-- 3. Create public.workspace_invitations table for secure invitation lifecycle
CREATE TABLE IF NOT EXISTS public.workspace_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('workspace_owner', 'workspace_admin', 'workspace_member', 'reseller_admin', 'reseller_staff')),
    token_hash TEXT NOT NULL UNIQUE,
    invited_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspace_invitations_workspace_id ON public.workspace_invitations (workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_email ON public.workspace_invitations (email);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_token_hash ON public.workspace_invitations (token_hash);
ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY;
