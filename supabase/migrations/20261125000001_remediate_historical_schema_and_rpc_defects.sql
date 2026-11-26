-- ==============================================================================
-- VyapOne — Forward Corrective Migration for Historical Schema & RPC Defects
-- Migration: 20261125000001_remediate_historical_schema_and_rpc_defects.sql
-- Tasks: CLOUD-007, CLOUD-009
--
-- Scope (Additive / Compatible Forward Remediation Only — Migrations 1-25 Immutable):
--   1. Notification updated_at trigger (20261117000002): re-point trg_notifications_updated_at
--      to canonical hardened public.set_updated_at() instead of out-of-band update_updated_at_column().
--   2. Workspace & business invitation acceptance (20261117000001):
--      a. accept_workspace_invitation_atomic(): enforce authenticated caller session & verified
--         account email (closing caller/email spoofing), remove non-existent workspace_members.updated_at,
--         lock workspaces -> workspace_invitations in canonical order before counting seats, and
--         enforce team_seats capacity directly under lock (raising VY001 instead of discarding
--         PERFORM or rejecting unjoined invitees with VY003 in assert_and_lock_workspace_capacity).
--      b. accept_business_invitation_atomic(): enforce authenticated caller session, verified account
--         email, archived-business guard, and canonical businesses -> business_invitations lock order.
--   3. Niche group lookup (20261119000001 & 20261119000002): replace create_business_with_setup_atomic()
--      and confirm_business_import_atomic() replacing non-existent niches.niche_group_slug with
--      JOIN public.niche_groups ng ON ng.id = n.niche_group_id while preserving 20261119000003
--      service_role execute revocations.
--   4. Capacity and site status remediation (20261115000001 & 20261116000001):
--      a. Harden check_site_publish_capacity_trigger() GUC comparison to IS DISTINCT FROM 'true'.
--      b. Fix zero-row capacity_overrides SELECT ... INTO NULL bypass in
--         assert_and_lock_workspace_capacity() and transition_site_status_atomic().
--      c. Remove non-existent public.sites.published_at assignment in transition_site_status_atomic().
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Notification updated_at Trigger Remediation (fixes 20261117000002)
-- ------------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_notifications_updated_at ON public.notifications;
CREATE TRIGGER trg_notifications_updated_at
    BEFORE UPDATE ON public.notifications
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------------------------
-- 2. Atomic Workspace & Business Invitation Acceptance Remediation (fixes 20261117000001)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_workspace_invitation_atomic(
    p_token_hash TEXT,
    p_accepting_user_id UUID,
    p_accepting_user_email TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_caller_id UUID;
    v_verified_email TEXT;
    v_workspace_id UUID;
    v_workspace_plan TEXT;
    v_workspace_status TEXT;
    v_invitation RECORD;
    v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
    v_existing_active_count INT := 0;
    v_plan_id TEXT;
    v_base_seats INT := 0;
    v_override INT := 0;
    v_effective_seats INT := 0;
    v_active_seats INT := 0;
BEGIN
    IF p_token_hash IS NULL OR pg_catalog.length(pg_catalog.trim(p_token_hash)) = 0 THEN
        RAISE EXCEPTION 'Token hash cannot be empty' USING ERRCODE = 'VY010';
    END IF;

    IF p_accepting_user_id IS NULL THEN
        RAISE EXCEPTION 'Accepting user ID cannot be null' USING ERRCODE = 'VY010';
    END IF;

    IF p_accepting_user_email IS NULL OR pg_catalog.length(pg_catalog.trim(p_accepting_user_email)) = 0 THEN
        RAISE EXCEPTION 'Accepting user email cannot be empty' USING ERRCODE = 'VY013';
    END IF;

    -- 1. Caller session & verified account email verification (prevents identity/email spoofing)
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        IF session_user NOT IN ('postgres', 'service_role')
           AND pg_catalog.coalesce(auth.jwt() ->> 'role', '') <> 'service_role' THEN
            RAISE EXCEPTION 'Unauthenticated execution: caller must be authenticated' USING ERRCODE = '28000';
        END IF;
    ELSIF v_caller_id <> p_accepting_user_id THEN
        RAISE EXCEPTION 'Access denied: accepting user does not match authenticated session' USING ERRCODE = 'VY013';
    END IF;

    IF v_caller_id IS NOT NULL
       AND pg_catalog.nullif(pg_catalog.trim(auth.jwt() ->> 'email'), '') IS NOT NULL THEN
        IF pg_catalog.lower(pg_catalog.trim(auth.jwt() ->> 'email')) <> pg_catalog.lower(pg_catalog.trim(p_accepting_user_email)) THEN
            RAISE EXCEPTION 'Authenticated session email does not match supplied email' USING ERRCODE = 'VY013';
        END IF;
    END IF;

    SELECT pg_catalog.coalesce(
               pg_catalog.nullif(pg_catalog.trim(au.email), ''),
               pg_catalog.nullif(pg_catalog.trim(pu.email), '')
           )
    INTO v_verified_email
    FROM public.users pu
    LEFT JOIN auth.users au ON au.id = pu.id
    WHERE pu.id = p_accepting_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Accepting user record not found' USING ERRCODE = 'VY010';
    END IF;

    IF v_verified_email IS NULL THEN
        RAISE EXCEPTION 'Authenticated account must have a verified email address' USING ERRCODE = 'VY013';
    END IF;

    IF pg_catalog.lower(v_verified_email) <> pg_catalog.lower(pg_catalog.trim(p_accepting_user_email)) THEN
        RAISE EXCEPTION 'Authenticated account email does not match supplied email' USING ERRCODE = 'VY013';
    END IF;

    -- 2. Resolve workspace_id and lock in canonical workspaces -> workspace_invitations order
    SELECT wi.workspace_id INTO v_workspace_id
    FROM public.workspace_invitations wi
    WHERE wi.token_hash = p_token_hash;

    IF v_workspace_id IS NULL THEN
        RAISE EXCEPTION 'Invalid or nonexistent invitation token' USING ERRCODE = 'VY010';
    END IF;

    SELECT w.plan, w.status
    INTO v_workspace_plan, v_workspace_status
    FROM public.workspaces w
    WHERE w.id = v_workspace_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Workspace not found: %', v_workspace_id USING ERRCODE = 'VY002';
    END IF;

    IF v_workspace_status = 'archived' THEN
        RAISE EXCEPTION 'Cannot accept invitation for an archived workspace' USING ERRCODE = 'VY002';
    END IF;

    -- 3. Lock the invitation record to prevent concurrent acceptance / replay
    SELECT * INTO v_invitation
    FROM public.workspace_invitations
    WHERE token_hash = p_token_hash
    FOR UPDATE;

    IF v_invitation.id IS NULL THEN
        RAISE EXCEPTION 'Invalid or nonexistent invitation token' USING ERRCODE = 'VY010';
    END IF;

    -- 4. Status verification
    IF v_invitation.status <> 'pending' THEN
        RAISE EXCEPTION 'Invitation is no longer valid (status: %)', v_invitation.status USING ERRCODE = 'VY011';
    END IF;

    -- 5. Expiration verification
    IF v_invitation.expires_at < v_now THEN
        UPDATE public.workspace_invitations
        SET status = 'expired', updated_at = v_now
        WHERE id = v_invitation.id;

        RAISE EXCEPTION 'Invitation has expired' USING ERRCODE = 'VY012';
    END IF;

    -- 6. Case-insensitive email match verification
    IF pg_catalog.lower(pg_catalog.trim(v_invitation.email)) <> pg_catalog.lower(v_verified_email) THEN
        RAISE EXCEPTION 'Authenticated user email does not match invitation recipient' USING ERRCODE = 'VY013';
    END IF;

    -- 7. Check existing active membership (re-accepting does not consume another seat)
    SELECT pg_catalog.count(*)::INT INTO v_existing_active_count
    FROM public.workspace_members
    WHERE workspace_id = v_invitation.workspace_id
      AND user_id = p_accepting_user_id
      AND status = 'active';

    IF v_existing_active_count > 0 THEN
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

    -- 8. Direct Team-Seat Capacity Enforcement under locked workspace row
    --    (Do NOT call assert_and_lock_workspace_capacity because invitee is not yet a member,
    --    and callers must serialize on workspaces FOR UPDATE and raise VY001 when full.)
    SELECT s.plan_id INTO v_plan_id
    FROM public.subscriptions s
    WHERE s.workspace_id = v_invitation.workspace_id
      AND (
          s.status = 'active'
          OR (s.status = 'trialing' AND (s.current_period_end IS NULL OR s.current_period_end > v_now))
          OR (s.status = 'past_due' AND s.grace_period_end IS NOT NULL AND s.grace_period_end > v_now)
          OR (s.status = 'grace_period' AND (s.grace_period_end IS NULL OR s.grace_period_end > v_now))
      )
    ORDER BY s.created_at DESC
    LIMIT 1;

    IF v_plan_id IS NULL THEN
        v_plan_id := v_workspace_plan;
    END IF;

    IF v_plan_id = 'starter' THEN v_base_seats := 2;
    ELSIF v_plan_id IN ('growth', 'pro') THEN v_base_seats := 5;
    ELSIF v_plan_id = 'agency' THEN v_base_seats := 15;
    ELSIF v_plan_id = 'scale' THEN v_base_seats := 50;
    ELSE
        RAISE EXCEPTION 'Unknown or unsupported plan identifier: %', pg_catalog.coalesce(v_plan_id, 'none')
            USING ERRCODE = 'VY005';
    END IF;

    v_override := pg_catalog.coalesce(
        (
            SELECT co.additional_capacity
            FROM public.capacity_overrides co
            WHERE co.workspace_id = v_invitation.workspace_id
              AND co.metric = 'team_seats'
              AND (co.expires_at IS NULL OR co.expires_at > v_now)
            ORDER BY co.created_at DESC
            LIMIT 1
        ),
        0
    );

    v_effective_seats := v_base_seats + v_override;

    SELECT pg_catalog.count(*)::INT INTO v_active_seats
    FROM public.workspace_members
    WHERE workspace_id = v_invitation.workspace_id
      AND status = 'active';

    IF (v_active_seats + 1) > v_effective_seats THEN
        RAISE EXCEPTION 'Capacity limit reached for team_seats: active %, limit %',
            v_active_seats, v_effective_seats
            USING ERRCODE = 'VY001';
    END IF;

    -- 9. Upsert membership into public.workspace_members (schema has id, workspace_id, user_id, role, status, created_at)
    INSERT INTO public.workspace_members (
        workspace_id,
        user_id,
        role,
        status,
        created_at
    )
    VALUES (
        v_invitation.workspace_id,
        p_accepting_user_id,
        v_invitation.role,
        'active',
        v_now
    )
    ON CONFLICT (workspace_id, user_id) DO UPDATE SET
        role = EXCLUDED.role,
        status = 'active';

    -- 10. Mark invitation as accepted
    UPDATE public.workspace_invitations
    SET status = 'accepted', updated_at = v_now
    WHERE id = v_invitation.id;

    -- 11. Record immutable audit log
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

REVOKE ALL ON FUNCTION public.accept_workspace_invitation_atomic(TEXT, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_workspace_invitation_atomic(TEXT, UUID, TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.accept_business_invitation_atomic(
    p_token_hash TEXT,
    p_accepting_user_id UUID,
    p_accepting_user_email TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_caller_id UUID;
    v_verified_email TEXT;
    v_business_id UUID;
    v_business_status TEXT;
    v_invitation RECORD;
    v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
    v_existing_active_count INT := 0;
BEGIN
    IF p_token_hash IS NULL OR pg_catalog.length(pg_catalog.trim(p_token_hash)) = 0 THEN
        RAISE EXCEPTION 'Token hash cannot be empty' USING ERRCODE = 'VY010';
    END IF;

    IF p_accepting_user_id IS NULL THEN
        RAISE EXCEPTION 'Accepting user ID cannot be null' USING ERRCODE = 'VY010';
    END IF;

    IF p_accepting_user_email IS NULL OR pg_catalog.length(pg_catalog.trim(p_accepting_user_email)) = 0 THEN
        RAISE EXCEPTION 'Accepting user email cannot be empty' USING ERRCODE = 'VY013';
    END IF;

    -- 1. Caller session & verified account email verification (prevents caller/email spoofing & owner theft)
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        IF session_user NOT IN ('postgres', 'service_role')
           AND pg_catalog.coalesce(auth.jwt() ->> 'role', '') <> 'service_role' THEN
            RAISE EXCEPTION 'Unauthenticated execution: caller must be authenticated' USING ERRCODE = '28000';
        END IF;
    ELSIF v_caller_id <> p_accepting_user_id THEN
        RAISE EXCEPTION 'Access denied: accepting user does not match authenticated session' USING ERRCODE = 'VY013';
    END IF;

    IF v_caller_id IS NOT NULL
       AND pg_catalog.nullif(pg_catalog.trim(auth.jwt() ->> 'email'), '') IS NOT NULL THEN
        IF pg_catalog.lower(pg_catalog.trim(auth.jwt() ->> 'email')) <> pg_catalog.lower(pg_catalog.trim(p_accepting_user_email)) THEN
            RAISE EXCEPTION 'Authenticated session email does not match supplied email' USING ERRCODE = 'VY013';
        END IF;
    END IF;

    SELECT pg_catalog.coalesce(
               pg_catalog.nullif(pg_catalog.trim(au.email), ''),
               pg_catalog.nullif(pg_catalog.trim(pu.email), '')
           )
    INTO v_verified_email
    FROM public.users pu
    LEFT JOIN auth.users au ON au.id = pu.id
    WHERE pu.id = p_accepting_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Accepting user record not found' USING ERRCODE = 'VY010';
    END IF;

    IF v_verified_email IS NULL THEN
        RAISE EXCEPTION 'Authenticated account must have a verified email address' USING ERRCODE = 'VY013';
    END IF;

    IF pg_catalog.lower(v_verified_email) <> pg_catalog.lower(pg_catalog.trim(p_accepting_user_email)) THEN
        RAISE EXCEPTION 'Authenticated account email does not match supplied email' USING ERRCODE = 'VY013';
    END IF;

    -- 2. Resolve business_id and lock in canonical businesses -> business_invitations order
    SELECT bi.business_id INTO v_business_id
    FROM public.business_invitations bi
    WHERE bi.token_hash = p_token_hash;

    IF v_business_id IS NULL THEN
        RAISE EXCEPTION 'Invalid or nonexistent invitation token' USING ERRCODE = 'VY010';
    END IF;

    SELECT b.status INTO v_business_status
    FROM public.businesses b
    WHERE b.id = v_business_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Business not found: %', v_business_id USING ERRCODE = 'VY002';
    END IF;

    IF v_business_status = 'archived' THEN
        RAISE EXCEPTION 'Cannot accept invitation for an archived business' USING ERRCODE = 'VY002';
    END IF;

    -- 3. Lock invitation record to prevent replay and race conditions
    SELECT * INTO v_invitation
    FROM public.business_invitations
    WHERE token_hash = p_token_hash
    FOR UPDATE;

    IF v_invitation.id IS NULL THEN
        RAISE EXCEPTION 'Invalid or nonexistent invitation token' USING ERRCODE = 'VY010';
    END IF;

    -- 4. Status verification
    IF v_invitation.status <> 'pending' THEN
        RAISE EXCEPTION 'Invitation is no longer valid (status: %)', v_invitation.status USING ERRCODE = 'VY011';
    END IF;

    -- 5. Expiration verification
    IF v_invitation.expires_at < v_now THEN
        UPDATE public.business_invitations
        SET status = 'expired', updated_at = v_now
        WHERE id = v_invitation.id;

        RAISE EXCEPTION 'Invitation has expired' USING ERRCODE = 'VY012';
    END IF;

    -- 6. Case-insensitive email match verification
    IF pg_catalog.lower(pg_catalog.trim(v_invitation.email)) <> pg_catalog.lower(v_verified_email) THEN
        RAISE EXCEPTION 'Authenticated user email does not match invitation recipient' USING ERRCODE = 'VY013';
    END IF;

    -- 7. Sovereign Business Ownership Integration
    IF v_invitation.role = 'owner' THEN
        UPDATE public.businesses
        SET sovereign_owner_id = p_accepting_user_id,
            updated_at = v_now
        WHERE id = v_invitation.business_id
          AND sovereign_owner_id = v_invitation.invited_by;
    END IF;

    -- 8. Check if user is already an active member of this business
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

    -- 9. Upsert membership into public.business_members
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

    -- 10. Mark invitation as accepted
    UPDATE public.business_invitations
    SET status = 'accepted', updated_at = v_now
    WHERE id = v_invitation.id;

    -- 11. Record immutable audit log
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

REVOKE ALL ON FUNCTION public.accept_business_invitation_atomic(TEXT, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_business_invitation_atomic(TEXT, UUID, TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 3. Business Creation & Import Niche Join Remediation (fixes 20261119000001 & 20261119000002)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_business_with_setup_atomic(
    p_workspace_id UUID,
    p_caller_user_id UUID,
    p_trade_name TEXT,
    p_legal_name TEXT,
    p_slug TEXT,
    p_niche_slug TEXT,
    p_category TEXT,
    p_description TEXT,
    p_gst_number TEXT,
    p_pan_number TEXT,
    p_tax_scheme TEXT,
    p_contact JSONB,
    p_location_name TEXT,
    p_address_line1 TEXT,
    p_address_line2 TEXT,
    p_city TEXT,
    p_state TEXT,
    p_postal_code TEXT,
    p_logo_media_id UUID,
    p_showcase_media_ids UUID[],
    p_manifest_version TEXT,
    p_sanitized_answers JSONB,
    p_is_onboarding_complete BOOLEAN,
    p_missing_fields JSONB,
    p_default_modules TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
    v_business_id UUID;
    v_location_id UUID;
    v_member_id UUID;
    v_niche_id UUID := NULL;
    v_category TEXT := p_category;
    v_slug TEXT;
    v_base_slug TEXT;
    v_media_row RECORD;
    v_media_id UUID;
    v_mod_key TEXT;
    v_cap_allowed BOOLEAN;
    v_cap_current INT;
    v_cap_limit INT;
    v_cap_reason TEXT;
    v_biz_json JSONB;
    v_loc_json JSONB;
BEGIN
    IF p_workspace_id IS NULL THEN
        RAISE EXCEPTION 'Workspace ID cannot be null' USING ERRCODE = 'VY020';
    END IF;
    IF p_caller_user_id IS NULL THEN
        RAISE EXCEPTION 'Caller user ID cannot be null' USING ERRCODE = 'VY020';
    END IF;
    IF p_trade_name IS NULL OR pg_catalog.length(pg_catalog.trim(p_trade_name)) = 0 THEN
        RAISE EXCEPTION 'Trade name cannot be empty' USING ERRCODE = 'VY023';
    END IF;
    IF p_address_line1 IS NULL OR pg_catalog.length(pg_catalog.trim(p_address_line1)) = 0 THEN
        RAISE EXCEPTION 'Address line 1 cannot be empty' USING ERRCODE = 'VY023';
    END IF;
    IF p_postal_code IS NULL OR p_postal_code !~ '^[1-9][0-9]{5}$' THEN
        RAISE EXCEPTION 'Invalid Indian PIN code (must be 6 digits, not starting with 0)' USING ERRCODE = 'VY023';
    END IF;

    IF auth.uid() IS NOT NULL AND auth.uid() <> p_caller_user_id THEN
        RAISE EXCEPTION 'Access denied: caller does not match authenticated user session' USING ERRCODE = 'VY020';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_caller_user_id) THEN
        RAISE EXCEPTION 'Caller user record not found' USING ERRCODE = 'VY020';
    END IF;

    IF NOT public.is_workspace_admin_or_owner(p_workspace_id, p_caller_user_id) THEN
        RAISE EXCEPTION 'You do not have management permissions in the specified workspace' USING ERRCODE = 'VY021';
    END IF;

    SELECT allowed, current_count, effective_limit, reason
    INTO v_cap_allowed, v_cap_current, v_cap_limit, v_cap_reason
    FROM public.assert_and_lock_workspace_capacity(p_workspace_id, 'draft_websites', 1);

    IF NOT v_cap_allowed THEN
        RAISE EXCEPTION 'Workspace draft website limit reached (%/%): %', v_cap_current, v_cap_limit, v_cap_reason
            USING ERRCODE = 'VY001';
    END IF;

    -- Corrected canonical niche & niche_group join (replaces non-existent niches.niche_group_slug)
    IF p_niche_slug IS NOT NULL AND pg_catalog.length(pg_catalog.trim(p_niche_slug)) > 0 THEN
        SELECT n.id, ng.slug INTO v_niche_id, v_category
        FROM public.niches n
        JOIN public.niche_groups ng ON ng.id = n.niche_group_id
        WHERE n.slug = p_niche_slug;

        IF v_category IS NULL THEN
            v_category := COALESCE(p_category, 'other_business');
        END IF;
    ELSE
        v_category := COALESCE(p_category, 'other_business');
    END IF;

    v_base_slug := COALESCE(p_slug, p_trade_name);
    v_base_slug := pg_catalog.regexp_replace(
        pg_catalog.regexp_replace(pg_catalog.lower(v_base_slug), '[^a-z0-9]+', '-', 'g'),
        '^-+|-+$', '', 'g'
    );
    IF pg_catalog.length(v_base_slug) < 2 THEN
        v_base_slug := 'store-' || pg_catalog.substr(pg_catalog.md5(pg_catalog.random()::text), 1, 6);
    END IF;

    v_slug := v_base_slug;
    IF EXISTS (SELECT 1 FROM public.businesses WHERE slug = v_slug) THEN
        v_slug := v_base_slug || '-' || pg_catalog.substr(pg_catalog.md5(pg_catalog.random()::text), 1, 4);
    END IF;

    INSERT INTO public.businesses (
        workspace_id,
        legal_name,
        trade_name,
        slug,
        category,
        niche_id,
        description,
        gst_number,
        pan_number,
        tax_scheme,
        contact_configuration,
        address_configuration,
        status,
        currency_code,
        sovereign_owner_id,
        created_at,
        updated_at
    ) VALUES (
        p_workspace_id,
        COALESCE(p_legal_name, p_trade_name),
        p_trade_name,
        v_slug,
        v_category,
        v_niche_id,
        p_description,
        p_gst_number,
        p_pan_number,
        COALESCE(p_tax_scheme, 'unregistered'),
        COALESCE(p_contact, '{}'::jsonb),
        jsonb_build_object(
            'address_line1', p_address_line1,
            'address_line2', p_address_line2,
            'city', p_city,
            'state', p_state,
            'postal_code', p_postal_code,
            'country', 'India'
        ),
        'onboarding',
        'INR',
        p_caller_user_id,
        v_now,
        v_now
    )
    RETURNING id INTO v_business_id;

    INSERT INTO public.locations (
        business_id,
        name,
        slug,
        address_line1,
        address_line2,
        city,
        state,
        postal_code,
        is_primary,
        created_at,
        updated_at
    ) VALUES (
        v_business_id,
        COALESCE(p_location_name, 'Main Store'),
        'main',
        p_address_line1,
        p_address_line2,
        p_city,
        p_state,
        p_postal_code,
        true,
        v_now,
        v_now
    )
    RETURNING id INTO v_location_id;

    INSERT INTO public.business_members (
        business_id,
        user_id,
        role,
        location_id,
        permissions,
        status,
        created_at
    ) VALUES (
        v_business_id,
        p_caller_user_id,
        'owner',
        v_location_id,
        jsonb_build_object(
            'can_bill', true,
            'can_manage_catalogue', true,
            'can_view_reports', true,
            'can_edit_settings', true
        ),
        'active',
        v_now
    )
    RETURNING id INTO v_member_id;

    IF p_logo_media_id IS NOT NULL THEN
        SELECT * INTO v_media_row
        FROM public.media_items
        WHERE id = p_logo_media_id
        FOR UPDATE;

        IF v_media_row.id IS NULL THEN
            RAISE EXCEPTION 'Logo media item not found' USING ERRCODE = 'VY030';
        END IF;
        IF v_media_row.uploaded_by <> p_caller_user_id THEN
            RAISE EXCEPTION 'Logo media item does not belong to authorized caller' USING ERRCODE = 'VY030';
        END IF;
        IF v_media_row.workspace_id IS NOT NULL AND v_media_row.workspace_id <> p_workspace_id THEN
            RAISE EXCEPTION 'Logo media item belongs to a different workspace' USING ERRCODE = 'VY030';
        END IF;
        IF v_media_row.business_id IS NOT NULL AND v_media_row.business_id <> v_business_id THEN
            RAISE EXCEPTION 'Logo media item is already linked to another business' USING ERRCODE = 'VY030';
        END IF;
        IF v_media_row.bucket <> 'vyapone-private-media' OR v_media_row.is_public = true OR v_media_row.published_at IS NOT NULL THEN
            RAISE EXCEPTION 'Logo media item violates private quarantine invariant' USING ERRCODE = 'VY030';
        END IF;

        UPDATE public.media_items
        SET business_id = v_business_id,
            workspace_id = p_workspace_id,
            updated_at = v_now
        WHERE id = p_logo_media_id;
    END IF;

    IF p_showcase_media_ids IS NOT NULL AND pg_catalog.cardinality(p_showcase_media_ids) > 0 THEN
        FOREACH v_media_id IN ARRAY p_showcase_media_ids LOOP
            SELECT * INTO v_media_row
            FROM public.media_items
            WHERE id = v_media_id
            FOR UPDATE;

            IF v_media_row.id IS NULL THEN
                RAISE EXCEPTION 'Showcase media item not found: %', v_media_id USING ERRCODE = 'VY030';
            END IF;
            IF v_media_row.uploaded_by <> p_caller_user_id THEN
                RAISE EXCEPTION 'Showcase media item does not belong to caller: %', v_media_id USING ERRCODE = 'VY030';
            END IF;
            IF v_media_row.workspace_id IS NOT NULL AND v_media_row.workspace_id <> p_workspace_id THEN
                RAISE EXCEPTION 'Showcase media item belongs to a different workspace: %', v_media_id USING ERRCODE = 'VY030';
            END IF;
            IF v_media_row.business_id IS NOT NULL AND v_media_row.business_id <> v_business_id THEN
                RAISE EXCEPTION 'Showcase media item is already linked to another business: %', v_media_id USING ERRCODE = 'VY030';
            END IF;
            IF v_media_row.bucket <> 'vyapone-private-media' OR v_media_row.is_public = true OR v_media_row.published_at IS NOT NULL THEN
                RAISE EXCEPTION 'Showcase media item violates private quarantine invariant: %', v_media_id USING ERRCODE = 'VY030';
            END IF;

            UPDATE public.media_items
            SET business_id = v_business_id,
                workspace_id = p_workspace_id,
                updated_at = v_now
            WHERE id = v_media_id;
        END LOOP;
    END IF;

    INSERT INTO public.business_onboarding_answers (
        business_id,
        niche_slug,
        manifest_version,
        answers,
        is_complete,
        missing_fields,
        created_at,
        updated_at
    ) VALUES (
        v_business_id,
        COALESCE(p_niche_slug, 'other_business'),
        COALESCE(p_manifest_version, 'v1'),
        COALESCE(p_sanitized_answers, '{}'::jsonb),
        COALESCE(p_is_onboarding_complete, false),
        COALESCE(p_missing_fields, '[]'::jsonb),
        v_now,
        v_now
    );

    IF p_default_modules IS NOT NULL AND pg_catalog.cardinality(p_default_modules) > 0 THEN
        FOREACH v_mod_key IN ARRAY p_default_modules LOOP
            IF EXISTS (SELECT 1 FROM public.platform_modules WHERE key = v_mod_key) THEN
                INSERT INTO public.business_modules (
                    business_id,
                    module_key,
                    is_enabled,
                    custom_config,
                    enabled_at,
                    updated_at
                ) VALUES (
                    v_business_id,
                    v_mod_key,
                    true,
                    '{}'::jsonb,
                    v_now,
                    v_now
                )
                ON CONFLICT (business_id, module_key) DO NOTHING;
            END IF;
        END LOOP;
    END IF;

    INSERT INTO public.audit_logs (
        business_id,
        workspace_id,
        user_id,
        action,
        resource,
        metadata_json,
        created_at
    ) VALUES (
        v_business_id,
        p_workspace_id,
        p_caller_user_id,
        'business.created_with_setup',
        'businesses',
        jsonb_build_object(
            'trade_name', p_trade_name,
            'slug', v_slug,
            'niche_slug', p_niche_slug,
            'category', v_category,
            'manifest_version', COALESCE(p_manifest_version, 'v1'),
            'is_onboarding_complete', COALESCE(p_is_onboarding_complete, false),
            'has_logo', (p_logo_media_id IS NOT NULL),
            'showcase_count', COALESCE(pg_catalog.cardinality(p_showcase_media_ids), 0)
        ),
        v_now
    );

    SELECT pg_catalog.row_to_json(b.*)::jsonb INTO v_biz_json
    FROM public.businesses b WHERE b.id = v_business_id;

    SELECT pg_catalog.row_to_json(l.*)::jsonb INTO v_loc_json
    FROM public.locations l WHERE l.id = v_location_id;

    RETURN jsonb_build_object(
        'business', v_biz_json,
        'primary_location', v_loc_json,
        'business_id', v_business_id,
        'location_id', v_location_id,
        'niche_slug', COALESCE(p_niche_slug, 'other_business'),
        'is_complete', COALESCE(p_is_onboarding_complete, false)
    );
END;
$$;

-- Preserve VO-040 security preflight: revoke service_role, allow authenticated only
REVOKE ALL ON FUNCTION public.create_business_with_setup_atomic(
    UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB,
    TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, UUID[], TEXT, JSONB, BOOLEAN, JSONB, TEXT[]
) FROM PUBLIC, anon, service_role;

GRANT EXECUTE ON FUNCTION public.create_business_with_setup_atomic(
    UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB,
    TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, UUID[], TEXT, JSONB, BOOLEAN, JSONB, TEXT[]
) TO authenticated;

CREATE OR REPLACE FUNCTION public.confirm_business_import_atomic(
    p_workspace_id UUID,
    p_caller_user_id UUID,
    p_trade_name TEXT,
    p_legal_name TEXT,
    p_slug TEXT,
    p_niche_slug TEXT,
    p_category TEXT,
    p_description TEXT,
    p_gst_number TEXT,
    p_pan_number TEXT,
    p_tax_scheme TEXT,
    p_contact JSONB,
    p_location_name TEXT,
    p_address_line1 TEXT,
    p_address_line2 TEXT,
    p_city TEXT,
    p_state TEXT,
    p_postal_code TEXT,
    p_timings_answers JSONB,
    p_import_proposal_id TEXT,
    p_source_format TEXT,
    p_source_file_name TEXT,
    p_default_modules TEXT[],
    p_catalogue_items JSONB,
    p_reviewed_fields_count INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
    v_business_id UUID;
    v_location_id UUID;
    v_member_id UUID;
    v_niche_id UUID := NULL;
    v_category TEXT := p_category;
    v_slug TEXT;
    v_base_slug TEXT;
    v_mod_key TEXT;
    v_cap_allowed BOOLEAN;
    v_cap_current INT;
    v_cap_limit INT;
    v_cap_reason TEXT;
    v_biz_json JSONB;
    v_loc_json JSONB;
    v_item_record JSONB;
    v_item_title TEXT;
    v_price_minor BIGINT;
    v_catalogue_count INT := 0;
BEGIN
    IF p_workspace_id IS NULL THEN
        RAISE EXCEPTION 'Workspace ID cannot be null' USING ERRCODE = 'VY020';
    END IF;
    IF p_caller_user_id IS NULL THEN
        RAISE EXCEPTION 'Caller user ID cannot be null' USING ERRCODE = 'VY020';
    END IF;
    IF p_trade_name IS NULL OR pg_catalog.length(pg_catalog.trim(p_trade_name)) = 0 THEN
        RAISE EXCEPTION 'Trade name cannot be empty' USING ERRCODE = 'VY023';
    END IF;
    IF p_address_line1 IS NULL OR pg_catalog.length(pg_catalog.trim(p_address_line1)) = 0 THEN
        RAISE EXCEPTION 'Address line 1 cannot be empty' USING ERRCODE = 'VY023';
    END IF;
    IF p_postal_code IS NULL OR p_postal_code !~ '^[1-9][0-9]{5}$' THEN
        RAISE EXCEPTION 'Invalid Indian PIN code (must be 6 digits, not starting with 0)' USING ERRCODE = 'VY023';
    END IF;

    IF auth.uid() IS NOT NULL AND auth.uid() <> p_caller_user_id THEN
        RAISE EXCEPTION 'Access denied: caller does not match authenticated user session' USING ERRCODE = 'VY020';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_caller_user_id) THEN
        RAISE EXCEPTION 'Caller user record not found' USING ERRCODE = 'VY020';
    END IF;

    IF NOT public.is_workspace_admin_or_owner(p_workspace_id, p_caller_user_id) THEN
        RAISE EXCEPTION 'You do not have management permissions in the specified workspace' USING ERRCODE = 'VY021';
    END IF;

    SELECT allowed, current_count, effective_limit, reason
    INTO v_cap_allowed, v_cap_current, v_cap_limit, v_cap_reason
    FROM public.assert_and_lock_workspace_capacity(p_workspace_id, 'draft_websites', 1);

    IF NOT v_cap_allowed THEN
        RAISE EXCEPTION 'Workspace draft website limit reached (%/%): %', v_cap_current, v_cap_limit, v_cap_reason
            USING ERRCODE = 'VY001';
    END IF;

    IF p_import_proposal_id IS NOT NULL AND pg_catalog.length(pg_catalog.trim(p_import_proposal_id)) > 0 THEN
        IF EXISTS (
            SELECT 1 FROM public.audit_logs
            WHERE workspace_id = p_workspace_id
              AND action = 'business.import_confirmed'
              AND metadata_json->>'proposal_id' = p_import_proposal_id
        ) THEN
            RAISE EXCEPTION 'Import proposal % has already been confirmed and provisioned', p_import_proposal_id
                USING ERRCODE = 'VY024';
        END IF;
    END IF;

    -- Corrected canonical niche & niche_group join (replaces non-existent niches.niche_group_slug)
    IF p_niche_slug IS NOT NULL AND pg_catalog.length(pg_catalog.trim(p_niche_slug)) > 0 THEN
        SELECT n.id, ng.slug INTO v_niche_id, v_category
        FROM public.niches n
        JOIN public.niche_groups ng ON ng.id = n.niche_group_id
        WHERE n.slug = p_niche_slug;

        IF v_category IS NULL THEN
            v_category := COALESCE(p_category, 'other_business');
        END IF;
    ELSE
        v_category := COALESCE(p_category, 'other_business');
    END IF;

    v_base_slug := COALESCE(p_slug, p_trade_name);
    v_base_slug := pg_catalog.regexp_replace(
        pg_catalog.regexp_replace(pg_catalog.lower(v_base_slug), '[^a-z0-9]+', '-', 'g'),
        '^-+|-+$', '', 'g'
    );
    IF pg_catalog.length(v_base_slug) < 2 THEN
        v_base_slug := 'store-' || pg_catalog.substr(pg_catalog.md5(pg_catalog.random()::text), 1, 6);
    END IF;

    v_slug := v_base_slug;
    IF EXISTS (SELECT 1 FROM public.businesses WHERE slug = v_slug) THEN
        v_slug := v_base_slug || '-' || pg_catalog.substr(pg_catalog.md5(pg_catalog.random()::text), 1, 4);
    END IF;

    INSERT INTO public.businesses (
        workspace_id,
        legal_name,
        trade_name,
        slug,
        category,
        niche_id,
        description,
        gst_number,
        pan_number,
        tax_scheme,
        contact_configuration,
        address_configuration,
        status,
        currency_code,
        sovereign_owner_id,
        created_at,
        updated_at
    ) VALUES (
        p_workspace_id,
        COALESCE(p_legal_name, p_trade_name),
        p_trade_name,
        v_slug,
        v_category,
        v_niche_id,
        p_description,
        p_gst_number,
        p_pan_number,
        COALESCE(p_tax_scheme, 'unregistered'),
        COALESCE(p_contact, '{}'::jsonb),
        jsonb_build_object(
            'address_line1', p_address_line1,
            'address_line2', p_address_line2,
            'city', p_city,
            'state', p_state,
            'postal_code', p_postal_code,
            'country', 'India'
        ),
        'onboarding',
        'INR',
        p_caller_user_id,
        v_now,
        v_now
    )
    RETURNING id INTO v_business_id;

    INSERT INTO public.locations (
        business_id,
        name,
        slug,
        address_line1,
        address_line2,
        city,
        state,
        postal_code,
        is_primary,
        created_at,
        updated_at
    ) VALUES (
        v_business_id,
        COALESCE(p_location_name, 'Main Store'),
        'main',
        p_address_line1,
        p_address_line2,
        p_city,
        p_state,
        p_postal_code,
        true,
        v_now,
        v_now
    )
    RETURNING id INTO v_location_id;

    INSERT INTO public.business_members (
        business_id,
        user_id,
        role,
        location_id,
        permissions,
        status,
        created_at
    ) VALUES (
        v_business_id,
        p_caller_user_id,
        'owner',
        v_location_id,
        jsonb_build_object(
            'can_bill', true,
            'can_manage_catalogue', true,
            'can_view_reports', true,
            'can_edit_settings', true
        ),
        'active',
        v_now
    )
    RETURNING id INTO v_member_id;

    INSERT INTO public.business_onboarding_answers (
        business_id,
        niche_slug,
        manifest_version,
        answers,
        is_complete,
        missing_fields,
        created_at,
        updated_at
    ) VALUES (
        v_business_id,
        COALESCE(p_niche_slug, 'other_business'),
        'v1',
        jsonb_build_object(
            'import_source', COALESCE(p_source_format, 'unknown'),
            'import_proposal_id', p_import_proposal_id
        ) || COALESCE(p_timings_answers, '{}'::jsonb),
        true,
        '[]'::jsonb,
        v_now,
        v_now
    );

    IF p_default_modules IS NOT NULL AND pg_catalog.cardinality(p_default_modules) > 0 THEN
        FOREACH v_mod_key IN ARRAY p_default_modules LOOP
            IF EXISTS (SELECT 1 FROM public.platform_modules WHERE key = v_mod_key) THEN
                INSERT INTO public.business_modules (
                    business_id,
                    module_key,
                    is_enabled,
                    custom_config,
                    enabled_at,
                    updated_at
                ) VALUES (
                    v_business_id,
                    v_mod_key,
                    true,
                    '{}'::jsonb,
                    v_now,
                    v_now
                )
                ON CONFLICT (business_id, module_key) DO NOTHING;
            END IF;
        END LOOP;
    END IF;

    IF p_catalogue_items IS NOT NULL AND pg_catalog.jsonb_typeof(p_catalogue_items) = 'array' THEN
        FOR v_item_record IN SELECT * FROM pg_catalog.jsonb_array_elements(p_catalogue_items) LOOP
            v_item_title := pg_catalog.trim((v_item_record->>'title')::text);
            IF v_item_title IS NULL OR pg_catalog.length(v_item_title) = 0 THEN
                RAISE EXCEPTION 'Catalogue item title cannot be empty' USING ERRCODE = 'VY025';
            END IF;

            v_price_minor := (v_item_record->>'price_minor')::BIGINT;
            IF v_price_minor IS NULL OR v_price_minor < 0 THEN
                RAISE EXCEPTION 'Catalogue item price must be a non-negative integer minor unit' USING ERRCODE = 'VY025';
            END IF;

            INSERT INTO public.catalogue_items (
                business_id,
                location_id,
                title,
                description,
                price_minor,
                currency_code,
                sku,
                is_available,
                created_at,
                updated_at
            ) VALUES (
                v_business_id,
                v_location_id,
                v_item_title,
                v_item_record->>'description',
                v_price_minor,
                COALESCE(v_item_record->>'currency_code', 'INR'),
                v_item_record->>'sku',
                true,
                v_now,
                v_now
            );

            v_catalogue_count := v_catalogue_count + 1;
        END LOOP;
    END IF;

    INSERT INTO public.audit_logs (
        business_id,
        workspace_id,
        user_id,
        action,
        resource,
        metadata_json,
        created_at
    ) VALUES (
        v_business_id,
        p_workspace_id,
        p_caller_user_id,
        'business.import_confirmed',
        'businesses',
        jsonb_build_object(
            'proposal_id', p_import_proposal_id,
            'source_format', p_source_format,
            'source_file_name', p_source_file_name,
            'total_fields_reviewed', p_reviewed_fields_count,
            'confirmed_catalogue_items', v_catalogue_count,
            'provisioned_business_id', v_business_id
        ),
        v_now
    );

    SELECT pg_catalog.row_to_json(b.*)::jsonb INTO v_biz_json
    FROM public.businesses b WHERE b.id = v_business_id;

    SELECT pg_catalog.row_to_json(l.*)::jsonb INTO v_loc_json
    FROM public.locations l WHERE l.id = v_location_id;

    RETURN jsonb_build_object(
        'business', v_biz_json,
        'primary_location', v_loc_json,
        'business_id', v_business_id,
        'location_id', v_location_id,
        'catalogue_items_created', v_catalogue_count,
        'audit_log_action', 'business.import_confirmed'
    );
END;
$$;

-- Preserve VO-040 security preflight: revoke service_role, allow authenticated only
REVOKE ALL ON FUNCTION public.confirm_business_import_atomic(
    UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB,
    TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT[], JSONB, INT
) FROM PUBLIC, anon, service_role;

GRANT EXECUTE ON FUNCTION public.confirm_business_import_atomic(
    UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB,
    TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT[], JSONB, INT
) TO authenticated;

-- ------------------------------------------------------------------------------
-- 4. Plan Capacity & Site Transition Remediation (fixes 20261115000001 & 20261116000001)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_site_publish_capacity_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_workspace_id UUID;
    v_biz_status TEXT;
BEGIN
    -- Direct updates to published outside atomic procedures are strictly prohibited.
    -- Use IS DISTINCT FROM so NULL (unset GUC) fails closed rather than evaluating NULL <> 'true' as false.
    IF NEW.status = 'published' AND (OLD.status IS NULL OR OLD.status <> 'published') THEN
        IF pg_catalog.current_setting('vyapone.in_atomic_site_transition', true) IS DISTINCT FROM 'true' THEN
            RAISE EXCEPTION 'Direct site status transitions to published are prohibited. Use atomic publish/transition procedures instead'
                USING ERRCODE = 'VY003';
        END IF;

        SELECT b.workspace_id, b.status INTO v_workspace_id, v_biz_status
        FROM public.businesses b
        WHERE b.id = NEW.business_id;

        IF v_biz_status IS NULL THEN
            RAISE EXCEPTION 'Parent business not found for site' USING ERRCODE = 'VY002';
        END IF;

        IF v_biz_status = 'archived' THEN
            RAISE EXCEPTION 'Cannot publish site for an archived business' USING ERRCODE = 'VY002';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.check_site_publish_capacity_trigger() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_site_publish_capacity_trigger() TO postgres, service_role;

CREATE OR REPLACE FUNCTION public.assert_and_lock_workspace_capacity(
    p_workspace_id UUID,
    p_metric TEXT,
    p_requested_units INT DEFAULT 1
)
RETURNS TABLE (
    allowed BOOLEAN,
    current_count INT,
    effective_limit INT,
    remaining INT,
    reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_caller_id UUID;
    v_plan_id TEXT;
    v_base_limit INT := 0;
    v_override INT := 0;
    v_effective_limit INT := 0;
    v_current INT := 0;
    v_remaining INT := 0;
    v_now TIMESTAMPTZ := pg_catalog.now();
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        IF session_user NOT IN ('postgres', 'service_role') AND coalesce(auth.jwt() ->> 'role', '') <> 'service_role' THEN
            RAISE EXCEPTION 'Unauthenticated execution: caller must be authenticated' USING ERRCODE = '28000';
        END IF;
    ELSE
        IF NOT EXISTS (
            SELECT 1 FROM public.workspaces WHERE id = p_workspace_id AND owner_user_id = v_caller_id
        ) AND NOT EXISTS (
            SELECT 1 FROM public.workspace_members
            WHERE workspace_id = p_workspace_id
              AND user_id = v_caller_id
              AND status = 'active'
        ) THEN
            RAISE EXCEPTION 'Access denied to workspace %', p_workspace_id USING ERRCODE = 'VY003';
        END IF;
    END IF;

    IF p_metric NOT IN ('live_websites', 'draft_websites', 'team_seats', 'locations_per_business', 'catalogue_items_per_business') THEN
        RAISE EXCEPTION 'Unsupported capacity metric: %', p_metric USING ERRCODE = 'VY001';
    END IF;

    PERFORM 1 FROM public.workspaces WHERE id = p_workspace_id FOR UPDATE;

    SELECT s.plan_id INTO v_plan_id
    FROM public.subscriptions s
    WHERE s.workspace_id = p_workspace_id
      AND (
          s.status = 'active'
          OR (s.status = 'trialing' AND (s.current_period_end IS NULL OR s.current_period_end > v_now))
          OR (s.status = 'past_due' AND s.grace_period_end IS NOT NULL AND s.grace_period_end > v_now)
          OR (s.status = 'grace_period' AND (s.grace_period_end IS NULL OR s.grace_period_end > v_now))
      )
    ORDER BY s.created_at DESC
    LIMIT 1;

    IF v_plan_id IS NULL THEN
        SELECT plan INTO v_plan_id FROM public.workspaces WHERE id = p_workspace_id;
    END IF;

    IF v_plan_id IS NULL THEN
        RAISE EXCEPTION 'Workspace not found: %', p_workspace_id USING ERRCODE = 'VY002';
    END IF;

    IF v_plan_id = 'starter' THEN
        IF p_metric = 'live_websites' THEN v_base_limit := 3;
        ELSIF p_metric = 'draft_websites' THEN v_base_limit := 10;
        ELSIF p_metric = 'team_seats' THEN v_base_limit := 2;
        ELSIF p_metric = 'locations_per_business' THEN v_base_limit := 1;
        ELSIF p_metric = 'catalogue_items_per_business' THEN v_base_limit := 50;
        END IF;
    ELSIF v_plan_id IN ('growth', 'pro') THEN
        IF p_metric = 'live_websites' THEN v_base_limit := 8;
        ELSIF p_metric = 'draft_websites' THEN v_base_limit := 25;
        ELSIF p_metric = 'team_seats' THEN v_base_limit := 5;
        ELSIF p_metric = 'locations_per_business' THEN v_base_limit := 3;
        ELSIF p_metric = 'catalogue_items_per_business' THEN v_base_limit := 250;
        END IF;
    ELSIF v_plan_id = 'agency' THEN
        IF p_metric = 'live_websites' THEN v_base_limit := 20;
        ELSIF p_metric = 'draft_websites' THEN v_base_limit := 50;
        ELSIF p_metric = 'team_seats' THEN v_base_limit := 15;
        ELSIF p_metric = 'locations_per_business' THEN v_base_limit := 10;
        ELSIF p_metric = 'catalogue_items_per_business' THEN v_base_limit := 1000;
        END IF;
    ELSIF v_plan_id = 'scale' THEN
        IF p_metric = 'live_websites' THEN v_base_limit := 50;
        ELSIF p_metric = 'draft_websites' THEN v_base_limit := 100;
        ELSIF p_metric = 'team_seats' THEN v_base_limit := 50;
        ELSIF p_metric = 'locations_per_business' THEN v_base_limit := 50;
        ELSIF p_metric = 'catalogue_items_per_business' THEN v_base_limit := 5000;
        END IF;
    ELSE
        RAISE EXCEPTION 'Unknown or unsupported plan identifier: %', coalesce(v_plan_id, 'none') USING ERRCODE = 'VY005';
    END IF;

    -- Null-safe override lookup (0 rows resolves to 0, preventing NULL arithmetic bypass)
    v_override := pg_catalog.coalesce(
        (
            SELECT co.additional_capacity
            FROM public.capacity_overrides co
            WHERE co.workspace_id = p_workspace_id
              AND co.metric = p_metric
              AND (co.expires_at IS NULL OR co.expires_at > v_now)
            LIMIT 1
        ),
        0
    );

    v_effective_limit := v_base_limit + v_override;

    IF p_metric = 'live_websites' THEN
        SELECT count(DISTINCT s.business_id)::INT INTO v_current
        FROM public.sites s
        JOIN public.businesses b ON b.id = s.business_id
        WHERE b.workspace_id = p_workspace_id
          AND b.status <> 'archived'
          AND s.status = 'published';
    ELSIF p_metric = 'draft_websites' THEN
        SELECT count(*)::INT INTO v_current
        FROM public.sites s
        JOIN public.businesses b ON b.id = s.business_id
        WHERE b.workspace_id = p_workspace_id
          AND b.status <> 'archived'
          AND s.status = 'draft';
    ELSIF p_metric = 'team_seats' THEN
        SELECT count(*)::INT INTO v_current
        FROM public.workspace_members
        WHERE workspace_id = p_workspace_id
          AND status = 'active';
    ELSIF p_metric = 'locations_per_business' THEN
        SELECT coalesce(max(loc_count), 0)::INT INTO v_current
        FROM (
            SELECT count(*)::INT AS loc_count
            FROM public.locations l
            JOIN public.businesses b ON b.id = l.business_id
            WHERE b.workspace_id = p_workspace_id
              AND b.status <> 'archived'
            GROUP BY l.business_id
        ) sub;
    ELSIF p_metric = 'catalogue_items_per_business' THEN
        SELECT coalesce(max(cat_count), 0)::INT INTO v_current
        FROM (
            SELECT count(*)::INT AS cat_count
            FROM public.catalogue_items c
            JOIN public.businesses b ON b.id = c.business_id
            WHERE b.workspace_id = p_workspace_id
              AND b.status <> 'archived'
            GROUP BY c.business_id
        ) sub;
    END IF;

    v_remaining := GREATEST(0, v_effective_limit - v_current);

    IF (v_current + p_requested_units) > v_effective_limit THEN
        RETURN QUERY SELECT false, v_current, v_effective_limit, v_remaining, 'Capacity limit reached for ' || p_metric;
    ELSE
        RETURN QUERY SELECT true, v_current, v_effective_limit, v_remaining, 'Capacity available';
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_and_lock_workspace_capacity(UUID, TEXT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assert_and_lock_workspace_capacity(UUID, TEXT, INT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.transition_site_status_atomic(
    p_site_id UUID,
    p_target_status TEXT
)
RETURNS TABLE (
    success BOOLEAN,
    status TEXT,
    reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_caller_id UUID;
    v_business_id UUID;
    v_workspace_id UUID;
    v_sovereign_owner_id UUID;
    v_current_status TEXT;
    v_biz_status TEXT;
    v_plan_id TEXT;
    v_base_limit INT := 0;
    v_override INT := 0;
    v_effective_limit INT := 0;
    v_current_live_count INT := 0;
    v_current_draft_count INT := 0;
    v_projected_draft_count INT := 0;
    v_draft_limit INT := 0;
    v_draft_override INT := 0;
    v_effective_draft_limit INT := 0;
    v_business_has_published BOOLEAN := false;
    v_is_authorized BOOLEAN := false;
    v_now TIMESTAMPTZ := pg_catalog.now();
BEGIN
    PERFORM pg_catalog.set_config('vyapone.in_atomic_site_transition', 'true', true);

    SELECT s.business_id, s.status, b.workspace_id, b.status, b.sovereign_owner_id
    INTO v_business_id, v_current_status, v_workspace_id, v_biz_status, v_sovereign_owner_id
    FROM public.sites s
    JOIN public.businesses b ON b.id = s.business_id
    WHERE s.id = p_site_id;

    IF v_business_id IS NULL OR v_workspace_id IS NULL THEN
        RETURN QUERY SELECT false, 'not_found'::TEXT, 'Site or parent business not found'::TEXT;
        RETURN;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.businesses
        WHERE id = v_business_id AND workspace_id = v_workspace_id
    ) THEN
        RAISE EXCEPTION 'Tenant boundary violation: business does not belong to specified workspace' USING ERRCODE = 'VY004';
    END IF;

    PERFORM 1 FROM public.workspaces WHERE id = v_workspace_id FOR UPDATE;
    PERFORM 1 FROM public.businesses WHERE id = v_business_id FOR UPDATE;
    PERFORM 1 FROM public.sites WHERE business_id = v_business_id ORDER BY id FOR UPDATE;

    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        IF session_user NOT IN ('postgres', 'service_role') AND coalesce(auth.jwt() ->> 'role', '') <> 'service_role' THEN
            RAISE EXCEPTION 'Unauthenticated execution: caller must be authenticated' USING ERRCODE = '28000';
        END IF;
    ELSE
        SELECT (
            EXISTS (SELECT 1 FROM public.workspaces WHERE id = v_workspace_id AND owner_user_id = v_caller_id)
            OR EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = v_workspace_id AND user_id = v_caller_id AND status = 'active' AND role = 'workspace_owner')
            OR EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = v_workspace_id AND user_id = v_caller_id AND status = 'active' AND role IN ('workspace_admin', 'reseller_admin'))
            OR (v_sovereign_owner_id = v_caller_id)
            OR EXISTS (SELECT 1 FROM public.business_members WHERE business_id = v_business_id AND user_id = v_caller_id AND status = 'active' AND role IN ('owner', 'manager'))
        ) INTO v_is_authorized;

        IF NOT v_is_authorized THEN
            RAISE EXCEPTION 'Access denied: caller does not possess required publishing permissions for site %', p_site_id
                USING ERRCODE = 'VY003';
        END IF;
    END IF;

    IF p_target_status NOT IN ('draft', 'published', 'archived', 'suspended') THEN
        RETURN QUERY SELECT false, v_current_status, 'Invalid target status'::TEXT;
        RETURN;
    END IF;

    IF p_target_status IN ('archived', 'suspended') THEN
        UPDATE public.sites SET status = p_target_status, updated_at = pg_catalog.now() WHERE id = p_site_id;
        RETURN QUERY SELECT true, p_target_status, 'Status updated'::TEXT;
        RETURN;
    END IF;

    IF v_biz_status = 'archived' THEN
        IF p_target_status = 'published' THEN
            RETURN QUERY SELECT false, v_current_status, 'Cannot publish site for an archived business'::TEXT;
        ELSE
            RETURN QUERY SELECT false, v_current_status, 'Cannot modify site for an archived business'::TEXT;
        END IF;
        RETURN;
    END IF;

    IF v_current_status = p_target_status THEN
        RETURN QUERY SELECT true, v_current_status, 'Already in target status'::TEXT;
        RETURN;
    END IF;

    SELECT s.plan_id INTO v_plan_id
    FROM public.subscriptions s
    WHERE s.workspace_id = v_workspace_id
      AND (
          s.status = 'active'
          OR (s.status = 'trialing' AND (s.current_period_end IS NULL OR s.current_period_end > v_now))
          OR (s.status = 'past_due' AND s.grace_period_end IS NOT NULL AND s.grace_period_end > v_now)
          OR (s.status = 'grace_period' AND (s.grace_period_end IS NULL OR s.grace_period_end > v_now))
      )
    ORDER BY s.created_at DESC
    LIMIT 1;

    IF v_plan_id IS NULL THEN
        SELECT plan INTO v_plan_id FROM public.workspaces WHERE id = v_workspace_id;
    END IF;

    IF v_plan_id = 'starter' THEN
        v_base_limit := 3;
        v_draft_limit := 10;
    ELSIF v_plan_id IN ('growth', 'pro') THEN
        v_base_limit := 8;
        v_draft_limit := 25;
    ELSIF v_plan_id = 'agency' THEN
        v_base_limit := 20;
        v_draft_limit := 50;
    ELSIF v_plan_id = 'scale' THEN
        v_base_limit := 50;
        v_draft_limit := 100;
    ELSE
        RETURN QUERY SELECT false, v_current_status, 'Unknown or unsupported plan identifier: ' || coalesce(v_plan_id, 'none');
        RETURN;
    END IF;

    IF p_target_status = 'published' THEN
        v_override := pg_catalog.coalesce(
            (
                SELECT co.additional_capacity
                FROM public.capacity_overrides co
                WHERE co.workspace_id = v_workspace_id
                  AND co.metric = 'live_websites'
                  AND (co.expires_at IS NULL OR co.expires_at > v_now)
                LIMIT 1
            ),
            0
        );

        v_effective_limit := v_base_limit + v_override;

        SELECT count(DISTINCT s.business_id)::INT INTO v_current_live_count
        FROM public.sites s
        JOIN public.businesses b ON b.id = s.business_id
        WHERE b.workspace_id = v_workspace_id
          AND b.status <> 'archived'
          AND s.status = 'published';

        SELECT exists(
            SELECT 1 FROM public.sites
            WHERE business_id = v_business_id
              AND status = 'published'
              AND id <> p_site_id
        ) INTO v_business_has_published;

        IF v_business_has_published THEN
            IF v_current_live_count > v_effective_limit THEN
                RETURN QUERY SELECT false, v_current_status, 'Capacity limit reached for live_websites: workspace exceeds plan allowance'::TEXT;
                RETURN;
            END IF;
        ELSE
            IF v_current_live_count + 1 > v_effective_limit THEN
                RETURN QUERY SELECT false, v_current_status, 'Capacity limit reached for live_websites'::TEXT;
                RETURN;
            END IF;
        END IF;

        v_draft_override := pg_catalog.coalesce(
            (
                SELECT co.additional_capacity
                FROM public.capacity_overrides co
                WHERE co.workspace_id = v_workspace_id
                  AND co.metric = 'draft_websites'
                  AND (co.expires_at IS NULL OR co.expires_at > v_now)
                LIMIT 1
            ),
            0
        );

        v_effective_draft_limit := v_draft_limit + v_draft_override;

        SELECT count(*)::INT INTO v_current_draft_count
        FROM public.sites s
        JOIN public.businesses b ON b.id = s.business_id
        WHERE b.workspace_id = v_workspace_id
          AND b.status <> 'archived'
          AND s.status = 'draft';

        IF v_business_has_published THEN
            IF v_current_status = 'draft' THEN
                v_projected_draft_count := v_current_draft_count;
            ELSE
                v_projected_draft_count := v_current_draft_count + 1;
            END IF;

            IF v_projected_draft_count > v_effective_draft_limit THEN
                RETURN QUERY SELECT false, v_current_status, 'Capacity limit reached for draft_websites: workspace exceeds draft allowance'::TEXT;
                RETURN;
            END IF;
        END IF;

        UPDATE public.sites
        SET status = 'draft', updated_at = pg_catalog.now()
        WHERE business_id = v_business_id
          AND status = 'published'
          AND id <> p_site_id;

        -- Note: public.sites has no published_at column (published_at lives on site_versions)
        UPDATE public.sites
        SET status = 'published',
            updated_at = pg_catalog.now()
        WHERE id = p_site_id;

        RETURN QUERY SELECT true, 'published'::TEXT, 'Site published successfully'::TEXT;
        RETURN;
    END IF;

    IF p_target_status = 'draft' AND v_current_status = 'archived' THEN
        v_draft_override := pg_catalog.coalesce(
            (
                SELECT co.additional_capacity
                FROM public.capacity_overrides co
                WHERE co.workspace_id = v_workspace_id
                  AND co.metric = 'draft_websites'
                  AND (co.expires_at IS NULL OR co.expires_at > v_now)
                LIMIT 1
            ),
            0
        );

        v_effective_draft_limit := v_draft_limit + v_draft_override;

        SELECT count(*)::INT INTO v_current_draft_count
        FROM public.sites s
        JOIN public.businesses b ON b.id = s.business_id
        WHERE b.workspace_id = v_workspace_id
          AND b.status <> 'archived'
          AND s.status = 'draft';

        IF v_current_draft_count + 1 > v_effective_draft_limit THEN
            RETURN QUERY SELECT false, v_current_status, 'Capacity limit reached for draft_websites'::TEXT;
            RETURN;
        END IF;

        UPDATE public.sites SET status = 'draft', updated_at = pg_catalog.now() WHERE id = p_site_id;
        RETURN QUERY SELECT true, 'draft'::TEXT, 'Draft restored successfully'::TEXT;
        RETURN;
    END IF;

    UPDATE public.sites SET status = p_target_status, updated_at = pg_catalog.now() WHERE id = p_site_id;
    RETURN QUERY SELECT true, p_target_status, 'Status updated'::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.transition_site_status_atomic(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transition_site_status_atomic(UUID, TEXT) TO authenticated, service_role;
