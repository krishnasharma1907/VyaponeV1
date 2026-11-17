-- ==============================================================================
-- VyapOne — VO-027 Team Invitations and Membership Lifecycle Migration
-- Migration: 20261117000001_team_invitations_and_membership_lifecycle.sql
--
-- Requirements:
-- 1. Create public.business_invitations table with SHA-256 token hashing, expiry,
--    and RLS policies enforcing domain isolation between workspaces and businesses.
-- 2. Provide atomic acceptance RPCs:
--    - accept_workspace_invitation_atomic: locks invitation, checks expiry,
--      matches recipient email, enforces team_seats capacity via
--      assert_and_lock_workspace_capacity(), upserts active workspace_members,
--      updates invitation status to 'accepted', and logs audit record.
--    - accept_business_invitation_atomic: locks invitation, checks expiry,
--      matches recipient email, sets sovereign_owner_id when role = 'owner',
--      upserts active business_members, updates status to 'accepted', and logs audit.
-- 3. Standardized Custom SQLSTATE error codes:
--    - VY010: Invalid or nonexistent invitation token
--    - VY011: Invitation is not pending (already accepted, revoked, or expired)
--    - VY012: Invitation has expired
--    - VY013: Recipient email mismatch with authenticated caller
--    - VY001: Capacity exceeded (team_seats)
-- ==============================================================================

-- 1. Create public.business_invitations table
CREATE TABLE IF NOT EXISTS public.business_invitations (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'cashier', 'staff')),
    location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
    permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
    token_hash TEXT NOT NULL UNIQUE,
    invited_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.clock_timestamp()
);

-- Indexes for performance and lookup
CREATE INDEX IF NOT EXISTS idx_business_invitations_business_id 
    ON public.business_invitations (business_id);

CREATE INDEX IF NOT EXISTS idx_business_invitations_email 
    ON public.business_invitations (lower(email));

CREATE INDEX IF NOT EXISTS idx_business_invitations_token_hash 
    ON public.business_invitations (token_hash);

-- Enforce single pending invitation per email per business
CREATE UNIQUE INDEX IF NOT EXISTS idx_business_invitations_pending_unique 
    ON public.business_invitations (business_id, lower(email)) 
    WHERE status = 'pending';

-- Enable Row Level Security
ALTER TABLE public.business_invitations ENABLE ROW LEVEL SECURITY;

-- 2. Authorization helper for business managers / owners
CREATE OR REPLACE FUNCTION public.is_business_manager_or_owner(p_business_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_is_authorized BOOLEAN := FALSE;
BEGIN
    IF p_business_id IS NULL OR p_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- A. Sovereign owner check
    SELECT EXISTS (
        SELECT 1 FROM public.businesses
        WHERE id = p_business_id AND sovereign_owner_id = p_user_id
    ) INTO v_is_authorized;

    IF v_is_authorized THEN
        RETURN TRUE;
    END IF;

    -- B. Active business member check (owner or manager)
    SELECT EXISTS (
        SELECT 1 FROM public.business_members
        WHERE business_id = p_business_id
          AND user_id = p_user_id
          AND status = 'active'
          AND role IN ('owner', 'manager')
    ) INTO v_is_authorized;

    IF v_is_authorized THEN
        RETURN TRUE;
    END IF;

    -- C. Parent workspace admin or owner check
    SELECT EXISTS (
        SELECT 1 FROM public.businesses b
        JOIN public.workspace_members wm ON wm.workspace_id = b.workspace_id
        WHERE b.id = p_business_id
          AND wm.user_id = p_user_id
          AND wm.status = 'active'
          AND wm.role IN ('workspace_owner', 'workspace_admin', 'reseller_admin')
    ) INTO v_is_authorized;

    RETURN v_is_authorized;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- RLS Policies for public.business_invitations
DROP POLICY IF EXISTS "business_invitations_select_policy" ON public.business_invitations;
DROP POLICY IF EXISTS "business_invitations_insert_policy" ON public.business_invitations;
DROP POLICY IF EXISTS "business_invitations_update_policy" ON public.business_invitations;
DROP POLICY IF EXISTS "business_invitations_delete_policy" ON public.business_invitations;

CREATE POLICY "business_invitations_select_policy" ON public.business_invitations
    FOR SELECT
    USING (
        public.is_business_manager_or_owner(business_id, auth.uid()) OR
        lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
    );

CREATE POLICY "business_invitations_insert_policy" ON public.business_invitations
    FOR INSERT
    WITH CHECK (
        public.is_business_manager_or_owner(business_id, auth.uid()) AND
        invited_by = auth.uid()
    );

CREATE POLICY "business_invitations_update_policy" ON public.business_invitations
    FOR UPDATE
    USING (
        public.is_business_manager_or_owner(business_id, auth.uid()) OR
        lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
    )
    WITH CHECK (
        public.is_business_manager_or_owner(business_id, auth.uid()) OR
        lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
    );

CREATE POLICY "business_invitations_delete_policy" ON public.business_invitations
    FOR DELETE
    USING (public.is_business_manager_or_owner(business_id, auth.uid()));

-- 3. Atomic Workspace Invitation Acceptance RPC
CREATE OR REPLACE FUNCTION public.accept_workspace_invitation_atomic(
    p_token_hash TEXT,
    p_accepting_user_id UUID,
    p_accepting_user_email TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_invitation RECORD;
    v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
    v_existing_active_count INT;
BEGIN
    -- Input sanitization
    IF p_token_hash IS NULL OR pg_catalog.length(pg_catalog.trim(p_token_hash)) = 0 THEN
        RAISE EXCEPTION 'Token hash cannot be empty' USING ERRCODE = 'VY010';
    END IF;

    IF p_accepting_user_id IS NULL THEN
        RAISE EXCEPTION 'Accepting user ID cannot be null' USING ERRCODE = 'VY010';
    END IF;

    IF p_accepting_user_email IS NULL OR pg_catalog.length(pg_catalog.trim(p_accepting_user_email)) = 0 THEN
        RAISE EXCEPTION 'Accepting user email cannot be empty' USING ERRCODE = 'VY013';
    END IF;

    -- 1. Lock the invitation record to prevent concurrent acceptance / replay
    SELECT * INTO v_invitation
    FROM public.workspace_invitations
    WHERE token_hash = p_token_hash
    FOR UPDATE;

    IF v_invitation.id IS NULL THEN
        RAISE EXCEPTION 'Invalid or nonexistent invitation token' USING ERRCODE = 'VY010';
    END IF;

    -- 2. Status verification
    IF v_invitation.status <> 'pending' THEN
        RAISE EXCEPTION 'Invitation is no longer valid (status: %)', v_invitation.status USING ERRCODE = 'VY011';
    END IF;

    -- 3. Expiration verification
    IF v_invitation.expires_at < v_now THEN
        UPDATE public.workspace_invitations
        SET status = 'expired', updated_at = v_now
        WHERE id = v_invitation.id;

        RAISE EXCEPTION 'Invitation has expired' USING ERRCODE = 'VY012';
    END IF;

    -- 4. Case-insensitive email match verification
    IF pg_catalog.lower(pg_catalog.trim(v_invitation.email)) <> pg_catalog.lower(pg_catalog.trim(p_accepting_user_email)) THEN
        RAISE EXCEPTION 'Authenticated user email does not match invitation recipient' USING ERRCODE = 'VY013';
    END IF;

    -- 5. Team-Seat Capacity Integration
    -- Call assert_and_lock_workspace_capacity, which locks public.workspaces FOR UPDATE
    -- and enforces that (current_active_members + 1) <= effective_team_seats.
    -- If capacity exceeded, it raises exception with SQLSTATE 'VY001' and aborts transaction.
    PERFORM public.assert_and_lock_workspace_capacity(v_invitation.workspace_id, 'team_seats', 1);

    -- 6. Check if user is already an active member of this workspace
    SELECT pg_catalog.count(*)::INT INTO v_existing_active_count
    FROM public.workspace_members
    WHERE workspace_id = v_invitation.workspace_id
      AND user_id = p_accepting_user_id
      AND status = 'active';

    IF v_existing_active_count > 0 THEN
        -- Mark invitation as accepted since user is already active member
        UPDATE public.workspace_invitations
        SET status = 'accepted', updated_at = v_now
        WHERE id = v_invitation.id;

        RETURN jsonb_build_object(
            'success', true,
            'workspace_id', v_invitation.workspace_id,
            'role', v_invitation.role,
            'invitation_id', v_invitation.id,
            'already_member', true
        );
    END IF;

    -- 7. Upsert membership into public.workspace_members
    INSERT INTO public.workspace_members (
        workspace_id,
        user_id,
        role,
        status,
        created_at,
        updated_at
    )
    VALUES (
        v_invitation.workspace_id,
        p_accepting_user_id,
        v_invitation.role,
        'active',
        v_now,
        v_now
    )
    ON CONFLICT (workspace_id, user_id) DO UPDATE SET
        role = EXCLUDED.role,
        status = 'active',
        updated_at = v_now;

    -- 8. Mark invitation as accepted
    UPDATE public.workspace_invitations
    SET status = 'accepted', updated_at = v_now
    WHERE id = v_invitation.id;

    -- 9. Record immutable audit log
    INSERT INTO public.audit_logs (
        workspace_id,
        user_id,
        action,
        resource,
        metadata_json
    )
    VALUES (
        v_invitation.workspace_id,
        p_accepting_user_id,
        'workspace.invitation_accepted',
        'workspace_members',
        jsonb_build_object(
            'invitation_id', v_invitation.id,
            'recipient_email', v_invitation.email,
            'assigned_role', v_invitation.role
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'workspace_id', v_invitation.workspace_id,
        'role', v_invitation.role,
        'invitation_id', v_invitation.id,
        'already_member', false
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 4. Atomic Business Invitation Acceptance RPC
CREATE OR REPLACE FUNCTION public.accept_business_invitation_atomic(
    p_token_hash TEXT,
    p_accepting_user_id UUID,
    p_accepting_user_email TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_invitation RECORD;
    v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
    v_existing_active_count INT;
BEGIN
    -- Input sanitization
    IF p_token_hash IS NULL OR pg_catalog.length(pg_catalog.trim(p_token_hash)) = 0 THEN
        RAISE EXCEPTION 'Token hash cannot be empty' USING ERRCODE = 'VY010';
    END IF;

    IF p_accepting_user_id IS NULL THEN
        RAISE EXCEPTION 'Accepting user ID cannot be null' USING ERRCODE = 'VY010';
    END IF;

    IF p_accepting_user_email IS NULL OR pg_catalog.length(pg_catalog.trim(p_accepting_user_email)) = 0 THEN
        RAISE EXCEPTION 'Accepting user email cannot be empty' USING ERRCODE = 'VY013';
    END IF;

    -- 1. Lock invitation record to prevent replay and race conditions
    SELECT * INTO v_invitation
    FROM public.business_invitations
    WHERE token_hash = p_token_hash
    FOR UPDATE;

    IF v_invitation.id IS NULL THEN
        RAISE EXCEPTION 'Invalid or nonexistent invitation token' USING ERRCODE = 'VY010';
    END IF;

    -- 2. Status verification
    IF v_invitation.status <> 'pending' THEN
        RAISE EXCEPTION 'Invitation is no longer valid (status: %)', v_invitation.status USING ERRCODE = 'VY011';
    END IF;

    -- 3. Expiration verification
    IF v_invitation.expires_at < v_now THEN
        UPDATE public.business_invitations
        SET status = 'expired', updated_at = v_now
        WHERE id = v_invitation.id;

        RAISE EXCEPTION 'Invitation has expired' USING ERRCODE = 'VY012';
    END IF;

    -- 4. Case-insensitive email match verification
    IF pg_catalog.lower(pg_catalog.trim(v_invitation.email)) <> pg_catalog.lower(pg_catalog.trim(p_accepting_user_email)) THEN
        RAISE EXCEPTION 'Authenticated user email does not match invitation recipient' USING ERRCODE = 'VY013';
    END IF;

    -- 5. Sovereign Business Ownership Integration:
    -- If the invited role is 'owner', and the business sovereign_owner_id was temporarily
    -- held by the creator/reseller, assign sovereign ownership to the accepting merchant owner.
    IF v_invitation.role = 'owner' THEN
        UPDATE public.businesses
        SET sovereign_owner_id = p_accepting_user_id,
            updated_at = v_now
        WHERE id = v_invitation.business_id
          AND sovereign_owner_id = v_invitation.invited_by;
    END IF;

    -- 6. Check if user is already an active member of this business
    SELECT pg_catalog.count(*)::INT INTO v_existing_active_count
    FROM public.business_members
    WHERE business_id = v_invitation.business_id
      AND user_id = p_accepting_user_id
      AND status = 'active';

    IF v_existing_active_count > 0 THEN
        UPDATE public.business_invitations
        SET status = 'accepted', updated_at = v_now
        WHERE id = v_invitation.id;

        RETURN jsonb_build_object(
            'success', true,
            'business_id', v_invitation.business_id,
            'role', v_invitation.role,
            'invitation_id', v_invitation.id,
            'already_member', true
        );
    END IF;

    -- 7. Upsert membership into public.business_members
    INSERT INTO public.business_members (
        business_id,
        user_id,
        role,
        location_id,
        permissions,
        status,
        created_at
    )
    VALUES (
        v_invitation.business_id,
        p_accepting_user_id,
        v_invitation.role,
        v_invitation.location_id,
        v_invitation.permissions,
        'active',
        v_now
    )
    ON CONFLICT (business_id, user_id) DO UPDATE SET
        role = EXCLUDED.role,
        location_id = pg_catalog.coalesce(EXCLUDED.location_id, business_members.location_id),
        permissions = EXCLUDED.permissions,
        status = 'active';

    -- 8. Mark invitation as accepted
    UPDATE public.business_invitations
    SET status = 'accepted', updated_at = v_now
    WHERE id = v_invitation.id;

    -- 9. Record immutable audit log
    INSERT INTO public.audit_logs (
        business_id,
        user_id,
        action,
        resource,
        metadata_json
    )
    VALUES (
        v_invitation.business_id,
        p_accepting_user_id,
        'business.invitation_accepted',
        'business_members',
        jsonb_build_object(
            'invitation_id', v_invitation.id,
            'recipient_email', v_invitation.email,
            'assigned_role', v_invitation.role
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'business_id', v_invitation.business_id,
        'role', v_invitation.role,
        'invitation_id', v_invitation.id,
        'already_member', false
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 5. Revocation and Privilege Configuration
-- Revoke all privileges from PUBLIC and anon
REVOKE ALL ON FUNCTION public.is_business_manager_or_owner(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_workspace_invitation_atomic(TEXT, UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_business_invitation_atomic(TEXT, UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.business_invitations FROM PUBLIC, anon;

-- Grant execution to authenticated and service_role
GRANT EXECUTE ON FUNCTION public.is_business_manager_or_owner(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accept_workspace_invitation_atomic(TEXT, UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accept_business_invitation_atomic(TEXT, UUID, TEXT) TO authenticated, service_role;

-- Grant controlled table privileges to authenticated and service_role
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.business_invitations TO authenticated, service_role;
