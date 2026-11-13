-- ==============================================================================
-- VyapOne — Database Migration 20261113000001
-- Task ID: VO-023 — Implement business and location core
-- Scope:
--   1. Allow DIY businesses by making businesses.workspace_id nullable.
--   2. Enforce single primary location invariant per business.
--   3. Create atomic business + primary location + initial owner bootstrap function.
-- ==============================================================================

-- 1. Support DIY businesses: make workspace_id NULLABLE in public.businesses
-- Direct business owners can establish a sovereign business without a reseller workspace.
ALTER TABLE public.businesses
    ALTER COLUMN workspace_id DROP NOT NULL;

-- 2. Enforce exactly one primary location per business via partial unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_locations_primary_per_business
    ON public.locations (business_id)
    WHERE is_primary = true;

-- 3. Atomic business bootstrap function (SECURITY DEFINER with secure search_path)
-- Creates business, primary location, and initial owner membership in a single transaction.
CREATE OR REPLACE FUNCTION public.create_business_with_primary_location(
    p_legal_name TEXT,
    p_trade_name TEXT,
    p_slug TEXT,
    p_location_name TEXT,
    p_address_line1 TEXT,
    p_city TEXT,
    p_state TEXT,
    p_postal_code TEXT,
    p_workspace_id UUID DEFAULT NULL,
    p_gst_number TEXT DEFAULT NULL,
    p_pan_number TEXT DEFAULT NULL,
    p_address_line2 TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_caller_id UUID;
    v_business_id UUID;
    v_location_id UUID;
    v_member_id UUID;
    v_location_slug TEXT;
BEGIN
    -- 1. Derive caller identity strictly from auth.uid()
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'UNAUTHENTICATED: Caller must be authenticated to create a business'
            USING ERRCODE = '42501';
    END IF;

    -- 2. If workspace_id is provided, verify caller has active management role in workspace
    IF p_workspace_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.workspace_members
            WHERE workspace_id = p_workspace_id
              AND user_id = v_caller_id
              AND status = 'active'
              AND role IN ('workspace_owner', 'workspace_admin', 'reseller_admin')
        ) THEN
            RAISE EXCEPTION 'UNAUTHORIZED: Caller does not have management permission in the specified workspace'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    -- 3. Check for business slug collision
    IF EXISTS (SELECT 1 FROM public.businesses WHERE slug = p_slug) THEN
        RAISE EXCEPTION 'SLUG_CONFLICT: A business with slug "%" already exists', p_slug
            USING ERRCODE = '23505';
    END IF;

    -- 4. Insert business record with caller as sovereign_owner_id
    INSERT INTO public.businesses (
        workspace_id,
        legal_name,
        trade_name,
        slug,
        gst_number,
        pan_number,
        status,
        currency_code,
        sovereign_owner_id
    ) VALUES (
        p_workspace_id,
        p_legal_name,
        p_trade_name,
        p_slug,
        p_gst_number,
        p_pan_number,
        'onboarding',
        'INR',
        v_caller_id
    )
    RETURNING id INTO v_business_id;

    -- 5. Insert primary location for the business
    v_location_slug := 'main';
    INSERT INTO public.locations (
        business_id,
        name,
        slug,
        address_line1,
        address_line2,
        city,
        state,
        postal_code,
        is_primary
    ) VALUES (
        v_business_id,
        p_location_name,
        v_location_slug,
        p_address_line1,
        p_address_line2,
        p_city,
        p_state,
        p_postal_code,
        true
    )
    RETURNING id INTO v_location_id;

    -- 6. Insert initial business owner membership
    INSERT INTO public.business_members (
        business_id,
        user_id,
        role,
        location_id,
        permissions,
        status
    ) VALUES (
        v_business_id,
        v_caller_id,
        'owner',
        v_location_id,
        '{"can_bill": true, "can_manage_catalogue": true, "can_view_reports": true, "can_edit_settings": true}'::jsonb,
        'active'
    )
    RETURNING id INTO v_member_id;

    -- 7. Record append-only audit log
    INSERT INTO public.audit_logs (
        business_id,
        workspace_id,
        user_id,
        action,
        resource,
        metadata_json
    ) VALUES (
        v_business_id,
        p_workspace_id,
        v_caller_id,
        'business.created',
        'businesses',
        pg_catalog.jsonb_build_object(
            'trade_name', p_trade_name,
            'slug', p_slug,
            'primary_location_id', v_location_id,
            'workspace_id', p_workspace_id
        )
    );

    RETURN pg_catalog.jsonb_build_object(
        'business_id', v_business_id,
        'location_id', v_location_id,
        'member_id', v_member_id,
        'slug', p_slug
    );
END;
$$;

-- Restrict function execution to authenticated callers only
REVOKE EXECUTE ON FUNCTION public.create_business_with_primary_location FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_business_with_primary_location TO authenticated;
