-- ==============================================================================
-- VyapOne — Database Migration 20261113000002
-- Task ID: VO-024 — Enforce tenant isolation at database and API layers
-- Scope:
--   1. Create hardened SECURITY DEFINER helper functions with search_path = ''
--      to prevent policy recursion and safely evaluate tenancy boundaries.
--   2. Enforce FORCE ROW LEVEL SECURITY across all 15 tenant tables.
--   3. Define explicit fail-closed SELECT, INSERT, UPDATE, DELETE policies for all tables.
--   4. Guard against cross-tenant record tampering, moving records, and ID guessing.
--   5. Add supporting lookup indexes for RLS evaluation paths.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Helper Functions (SECURITY DEFINER with SET search_path = '')
-- ------------------------------------------------------------------------------

-- 1.1 Evaluates active workspace membership without RLS recursion
CREATE OR REPLACE FUNCTION public.is_workspace_member(
    p_workspace_id UUID,
    p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF p_workspace_id IS NULL OR p_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM public.workspace_members
        WHERE workspace_id = p_workspace_id
          AND user_id = p_user_id
          AND status = 'active'
    );
END;
$$;

-- 1.2 Evaluates workspace administration/ownership
CREATE OR REPLACE FUNCTION public.is_workspace_admin_or_owner(
    p_workspace_id UUID,
    p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF p_workspace_id IS NULL OR p_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Workspace record owner
    IF EXISTS (
        SELECT 1
        FROM public.workspaces
        WHERE id = p_workspace_id
          AND owner_user_id = p_user_id
    ) THEN
        RETURN TRUE;
    END IF;

    -- Active member with administrative role
    RETURN EXISTS (
        SELECT 1
        FROM public.workspace_members
        WHERE workspace_id = p_workspace_id
          AND user_id = p_user_id
          AND status = 'active'
          AND role IN ('workspace_owner', 'workspace_admin', 'reseller_admin')
    );
END;
$$;

-- 1.3 Evaluates sovereign business ownership (anchored strictly to businesses.sovereign_owner_id)
CREATE OR REPLACE FUNCTION public.is_business_sovereign_owner(
    p_business_id UUID,
    p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF p_business_id IS NULL OR p_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM public.businesses
        WHERE id = p_business_id
          AND sovereign_owner_id = p_user_id
    );
END;
$$;

-- 1.4 Evaluates active business membership (sovereign owner OR active business_member)
CREATE OR REPLACE FUNCTION public.is_business_member(
    p_business_id UUID,
    p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF p_business_id IS NULL OR p_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Sovereign owner always holds member authority
    IF EXISTS (
        SELECT 1
        FROM public.businesses
        WHERE id = p_business_id
          AND sovereign_owner_id = p_user_id
    ) THEN
        RETURN TRUE;
    END IF;

    -- Active business member
    RETURN EXISTS (
        SELECT 1
        FROM public.business_members
        WHERE business_id = p_business_id
          AND user_id = p_user_id
          AND status = 'active'
    );
END;
$$;

-- 1.5 Evaluates business management authority (owner or manager role)
CREATE OR REPLACE FUNCTION public.is_business_owner_or_manager(
    p_business_id UUID,
    p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF p_business_id IS NULL OR p_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Sovereign owner always has management authority
    IF EXISTS (
        SELECT 1
        FROM public.businesses
        WHERE id = p_business_id
          AND sovereign_owner_id = p_user_id
    ) THEN
        RETURN TRUE;
    END IF;

    -- Active business member with owner or manager role
    RETURN EXISTS (
        SELECT 1
        FROM public.business_members
        WHERE business_id = p_business_id
          AND user_id = p_user_id
          AND status = 'active'
          AND role IN ('owner', 'manager')
    );
END;
$$;

-- 1.6 Evaluates business access across sovereign owner, business member, and assigned reseller workspace
CREATE OR REPLACE FUNCTION public.can_access_business(
    p_business_id UUID,
    p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_ws_id UUID;
BEGIN
    IF p_business_id IS NULL OR p_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- 1. Sovereign owner
    IF EXISTS (
        SELECT 1
        FROM public.businesses
        WHERE id = p_business_id
          AND sovereign_owner_id = p_user_id
    ) THEN
        RETURN TRUE;
    END IF;

    -- 2. Business member
    IF EXISTS (
        SELECT 1
        FROM public.business_members
        WHERE business_id = p_business_id
          AND user_id = p_user_id
          AND status = 'active'
    ) THEN
        RETURN TRUE;
    END IF;

    -- 3. Reseller workspace member (if business is linked to a workspace)
    SELECT workspace_id INTO v_ws_id
    FROM public.businesses
    WHERE id = p_business_id;

    IF v_ws_id IS NOT NULL THEN
        RETURN public.is_workspace_member(v_ws_id, p_user_id);
    END IF;

    RETURN FALSE;
END;
$$;

-- 1.7 Evaluates management access across business and reseller workspace
CREATE OR REPLACE FUNCTION public.can_manage_business(
    p_business_id UUID,
    p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_ws_id UUID;
BEGIN
    IF p_business_id IS NULL OR p_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- 1. Sovereign owner
    IF EXISTS (
        SELECT 1
        FROM public.businesses
        WHERE id = p_business_id
          AND sovereign_owner_id = p_user_id
    ) THEN
        RETURN TRUE;
    END IF;

    -- 2. Business owner or manager
    IF EXISTS (
        SELECT 1
        FROM public.business_members
        WHERE business_id = p_business_id
          AND user_id = p_user_id
          AND status = 'active'
          AND role IN ('owner', 'manager')
    ) THEN
        RETURN TRUE;
    END IF;

    -- 3. Reseller workspace admin/owner
    SELECT workspace_id INTO v_ws_id
    FROM public.businesses
    WHERE id = p_business_id;

    IF v_ws_id IS NOT NULL THEN
        RETURN public.is_workspace_admin_or_owner(v_ws_id, p_user_id);
    END IF;

    RETURN FALSE;
END;
$$;

-- 1.8 Evaluates location access according to staff location scoping
CREATE OR REPLACE FUNCTION public.can_access_location(
    p_location_id UUID,
    p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_biz_id UUID;
    v_member_loc UUID;
    v_member_role TEXT;
    v_ws_id UUID;
BEGIN
    IF p_location_id IS NULL OR p_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Retrieve the owning business ID for the location
    SELECT business_id INTO v_biz_id
    FROM public.locations
    WHERE id = p_location_id;

    IF v_biz_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- 1. Sovereign owner
    IF EXISTS (
        SELECT 1
        FROM public.businesses
        WHERE id = v_biz_id
          AND sovereign_owner_id = p_user_id
    ) THEN
        RETURN TRUE;
    END IF;

    -- 2. Check business member role and location assignment
    SELECT role, location_id INTO v_member_role, v_member_loc
    FROM public.business_members
    WHERE business_id = v_biz_id
      AND user_id = p_user_id
      AND status = 'active';

    IF FOUND THEN
        -- Owners and managers have all-location access across the business
        IF v_member_role IN ('owner', 'manager') THEN
            RETURN TRUE;
        END IF;

        -- Operational staff/cashiers: access granted if unassigned (NULL) or matched
        IF v_member_loc IS NULL OR v_member_loc = p_location_id THEN
            RETURN TRUE;
        ELSE
            RETURN FALSE;
        END IF;
    END IF;

    -- 3. Reseller workspace admin/owner
    SELECT workspace_id INTO v_ws_id
    FROM public.businesses
    WHERE id = v_biz_id;

    IF v_ws_id IS NOT NULL THEN
        RETURN public.is_workspace_admin_or_owner(v_ws_id, p_user_id);
    END IF;

    RETURN FALSE;
END;
$$;

-- Grant execution to authenticated and anon (RLS policy evaluation context)
REVOKE EXECUTE ON FUNCTION public.is_workspace_member(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_workspace_admin_or_owner(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_business_sovereign_owner(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_business_member(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_business_owner_or_manager(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_access_business(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_manage_business(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_access_location(UUID, UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_workspace_member(UUID, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_workspace_admin_or_owner(UUID, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_business_sovereign_owner(UUID, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_business_member(UUID, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_business_owner_or_manager(UUID, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.can_access_business(UUID, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_business(UUID, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.can_access_location(UUID, UUID) TO authenticated, anon;


-- ------------------------------------------------------------------------------
-- 2. FORCE ROW LEVEL SECURITY on all 15 tenant-owned tables
-- Ensures non-superuser table owners are strictly subject to RLS policies.
-- ------------------------------------------------------------------------------
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_auth_identities FORCE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces FORCE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members FORCE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_invitations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.businesses FORCE ROW LEVEL SECURITY;
ALTER TABLE public.locations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.business_members FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sites FORCE ROW LEVEL SECURITY;
ALTER TABLE public.catalogue_items FORCE ROW LEVEL SECURITY;
ALTER TABLE public.customers FORCE ROW LEVEL SECURITY;
ALTER TABLE public.orders FORCE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_sequences FORCE ROW LEVEL SECURITY;
ALTER TABLE public.bills FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs FORCE ROW LEVEL SECURITY;


-- ------------------------------------------------------------------------------
-- 3. Explicit RLS Policies for Tenant-Owned Tables
-- ------------------------------------------------------------------------------

-- === 3.1 public.users ===
DROP POLICY IF EXISTS "users_select_policy" ON public.users;
DROP POLICY IF EXISTS "users_insert_policy" ON public.users;
DROP POLICY IF EXISTS "users_update_policy" ON public.users;
DROP POLICY IF EXISTS "users_delete_policy" ON public.users;

CREATE POLICY "users_select_policy" ON public.users
    FOR SELECT
    USING (
        id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.user_id = public.users.id
              AND public.is_workspace_member(wm.workspace_id, auth.uid())
        ) OR
        EXISTS (
            SELECT 1 FROM public.business_members bm
            WHERE bm.user_id = public.users.id
              AND public.is_business_member(bm.business_id, auth.uid())
        )
    );

CREATE POLICY "users_insert_policy" ON public.users
    FOR INSERT
    WITH CHECK (id = auth.uid());

CREATE POLICY "users_update_policy" ON public.users
    FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

CREATE POLICY "users_delete_policy" ON public.users
    FOR DELETE
    USING (id = auth.uid());


-- === 3.2 public.user_auth_identities ===
DROP POLICY IF EXISTS "user_auth_identities_select_policy" ON public.user_auth_identities;
DROP POLICY IF EXISTS "user_auth_identities_insert_policy" ON public.user_auth_identities;
DROP POLICY IF EXISTS "user_auth_identities_update_policy" ON public.user_auth_identities;
DROP POLICY IF EXISTS "user_auth_identities_delete_policy" ON public.user_auth_identities;

CREATE POLICY "user_auth_identities_select_policy" ON public.user_auth_identities
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "user_auth_identities_insert_policy" ON public.user_auth_identities
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_auth_identities_update_policy" ON public.user_auth_identities
    FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_auth_identities_delete_policy" ON public.user_auth_identities
    FOR DELETE
    USING (user_id = auth.uid());


-- === 3.3 public.workspaces ===
DROP POLICY IF EXISTS "workspaces_select_policy" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_insert_policy" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_update_policy" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_delete_policy" ON public.workspaces;

CREATE POLICY "workspaces_select_policy" ON public.workspaces
    FOR SELECT
    USING (
        owner_user_id = auth.uid() OR
        public.is_workspace_member(id, auth.uid())
    );

CREATE POLICY "workspaces_insert_policy" ON public.workspaces
    FOR INSERT
    WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "workspaces_update_policy" ON public.workspaces
    FOR UPDATE
    USING (public.is_workspace_admin_or_owner(id, auth.uid()))
    WITH CHECK (public.is_workspace_admin_or_owner(id, auth.uid()));

CREATE POLICY "workspaces_delete_policy" ON public.workspaces
    FOR DELETE
    USING (owner_user_id = auth.uid());


-- === 3.4 public.workspace_members ===
DROP POLICY IF EXISTS "workspace_members_select_policy" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_insert_policy" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_update_policy" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_delete_policy" ON public.workspace_members;

CREATE POLICY "workspace_members_select_policy" ON public.workspace_members
    FOR SELECT
    USING (
        user_id = auth.uid() OR
        public.is_workspace_member(workspace_id, auth.uid())
    );

CREATE POLICY "workspace_members_insert_policy" ON public.workspace_members
    FOR INSERT
    WITH CHECK (public.is_workspace_admin_or_owner(workspace_id, auth.uid()));

CREATE POLICY "workspace_members_update_policy" ON public.workspace_members
    FOR UPDATE
    USING (public.is_workspace_admin_or_owner(workspace_id, auth.uid()))
    WITH CHECK (public.is_workspace_admin_or_owner(workspace_id, auth.uid()));

CREATE POLICY "workspace_members_delete_policy" ON public.workspace_members
    FOR DELETE
    USING (
        user_id = auth.uid() OR
        public.is_workspace_admin_or_owner(workspace_id, auth.uid())
    );


-- === 3.5 public.workspace_invitations ===
DROP POLICY IF EXISTS "workspace_invitations_select_policy" ON public.workspace_invitations;
DROP POLICY IF EXISTS "workspace_invitations_insert_policy" ON public.workspace_invitations;
DROP POLICY IF EXISTS "workspace_invitations_update_policy" ON public.workspace_invitations;
DROP POLICY IF EXISTS "workspace_invitations_delete_policy" ON public.workspace_invitations;

CREATE POLICY "workspace_invitations_select_policy" ON public.workspace_invitations
    FOR SELECT
    USING (
        public.is_workspace_admin_or_owner(workspace_id, auth.uid()) OR
        email = (SELECT email FROM auth.users WHERE id = auth.uid())
    );

CREATE POLICY "workspace_invitations_insert_policy" ON public.workspace_invitations
    FOR INSERT
    WITH CHECK (
        public.is_workspace_admin_or_owner(workspace_id, auth.uid()) AND
        invited_by = auth.uid()
    );

CREATE POLICY "workspace_invitations_update_policy" ON public.workspace_invitations
    FOR UPDATE
    USING (
        public.is_workspace_admin_or_owner(workspace_id, auth.uid()) OR
        email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
    WITH CHECK (
        public.is_workspace_admin_or_owner(workspace_id, auth.uid()) OR
        email = (SELECT email FROM auth.users WHERE id = auth.uid())
    );

CREATE POLICY "workspace_invitations_delete_policy" ON public.workspace_invitations
    FOR DELETE
    USING (public.is_workspace_admin_or_owner(workspace_id, auth.uid()));


-- === 3.6 public.businesses ===
DROP POLICY IF EXISTS "businesses_select_policy" ON public.businesses;
DROP POLICY IF EXISTS "businesses_insert_policy" ON public.businesses;
DROP POLICY IF EXISTS "businesses_update_policy" ON public.businesses;
DROP POLICY IF EXISTS "businesses_delete_policy" ON public.businesses;

CREATE POLICY "businesses_select_policy" ON public.businesses
    FOR SELECT
    USING (
        sovereign_owner_id = auth.uid() OR
        public.is_business_member(id, auth.uid()) OR
        (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id, auth.uid()))
    );

CREATE POLICY "businesses_insert_policy" ON public.businesses
    FOR INSERT
    WITH CHECK (
        sovereign_owner_id = auth.uid() AND
        (workspace_id IS NULL OR public.is_workspace_admin_or_owner(workspace_id, auth.uid()))
    );

CREATE POLICY "businesses_update_policy" ON public.businesses
    FOR UPDATE
    USING (
        sovereign_owner_id = auth.uid() OR
        public.is_business_owner_or_manager(id, auth.uid())
    )
    WITH CHECK (
        sovereign_owner_id = auth.uid() OR
        public.is_business_owner_or_manager(id, auth.uid())
    );

-- Invariant: Resellers CANNOT delete a sovereign business; strictly sovereign_owner_id required
CREATE POLICY "businesses_delete_policy" ON public.businesses
    FOR DELETE
    USING (sovereign_owner_id = auth.uid());


-- === 3.7 public.locations ===
DROP POLICY IF EXISTS "locations_select_policy" ON public.locations;
DROP POLICY IF EXISTS "locations_insert_policy" ON public.locations;
DROP POLICY IF EXISTS "locations_update_policy" ON public.locations;
DROP POLICY IF EXISTS "locations_delete_policy" ON public.locations;

CREATE POLICY "locations_select_policy" ON public.locations
    FOR SELECT
    USING (public.can_access_business(business_id, auth.uid()));

CREATE POLICY "locations_insert_policy" ON public.locations
    FOR INSERT
    WITH CHECK (public.is_business_owner_or_manager(business_id, auth.uid()));

CREATE POLICY "locations_update_policy" ON public.locations
    FOR UPDATE
    USING (public.is_business_owner_or_manager(business_id, auth.uid()))
    WITH CHECK (public.is_business_owner_or_manager(business_id, auth.uid()));

CREATE POLICY "locations_delete_policy" ON public.locations
    FOR DELETE
    USING (public.is_business_sovereign_owner(business_id, auth.uid()));


-- === 3.8 public.business_members ===
DROP POLICY IF EXISTS "business_members_select_policy" ON public.business_members;
DROP POLICY IF EXISTS "business_members_insert_policy" ON public.business_members;
DROP POLICY IF EXISTS "business_members_update_policy" ON public.business_members;
DROP POLICY IF EXISTS "business_members_delete_policy" ON public.business_members;

CREATE POLICY "business_members_select_policy" ON public.business_members
    FOR SELECT
    USING (
        user_id = auth.uid() OR
        public.is_business_sovereign_owner(business_id, auth.uid()) OR
        public.is_business_member(business_id, auth.uid()) OR
        (EXISTS (
            SELECT 1 FROM public.businesses b
            WHERE b.id = public.business_members.business_id
              AND b.workspace_id IS NOT NULL
              AND public.is_workspace_admin_or_owner(b.workspace_id, auth.uid())
        ))
    );

CREATE POLICY "business_members_insert_policy" ON public.business_members
    FOR INSERT
    WITH CHECK (public.is_business_owner_or_manager(business_id, auth.uid()));

CREATE POLICY "business_members_update_policy" ON public.business_members
    FOR UPDATE
    USING (public.is_business_owner_or_manager(business_id, auth.uid()))
    WITH CHECK (public.is_business_owner_or_manager(business_id, auth.uid()));

CREATE POLICY "business_members_delete_policy" ON public.business_members
    FOR DELETE
    USING (
        user_id = auth.uid() OR
        public.is_business_owner_or_manager(business_id, auth.uid())
    );


-- === 3.9 public.sites ===
DROP POLICY IF EXISTS "sites_select_policy" ON public.sites;
DROP POLICY IF EXISTS "sites_insert_policy" ON public.sites;
DROP POLICY IF EXISTS "sites_update_policy" ON public.sites;
DROP POLICY IF EXISTS "sites_delete_policy" ON public.sites;

CREATE POLICY "sites_select_policy" ON public.sites
    FOR SELECT
    USING (
        status = 'published' OR
        public.can_access_business(business_id, auth.uid())
    );

CREATE POLICY "sites_insert_policy" ON public.sites
    FOR INSERT
    WITH CHECK (public.can_manage_business(business_id, auth.uid()));

CREATE POLICY "sites_update_policy" ON public.sites
    FOR UPDATE
    USING (public.can_manage_business(business_id, auth.uid()))
    WITH CHECK (public.can_manage_business(business_id, auth.uid()));

CREATE POLICY "sites_delete_policy" ON public.sites
    FOR DELETE
    USING (public.is_business_sovereign_owner(business_id, auth.uid()));


-- === 3.10 public.catalogue_items ===
DROP POLICY IF EXISTS "catalogue_items_select_policy" ON public.catalogue_items;
DROP POLICY IF EXISTS "catalogue_items_insert_policy" ON public.catalogue_items;
DROP POLICY IF EXISTS "catalogue_items_update_policy" ON public.catalogue_items;
DROP POLICY IF EXISTS "catalogue_items_delete_policy" ON public.catalogue_items;

CREATE POLICY "catalogue_items_select_policy" ON public.catalogue_items
    FOR SELECT
    USING (
        is_available = true OR
        public.can_access_business(business_id, auth.uid())
    );

CREATE POLICY "catalogue_items_insert_policy" ON public.catalogue_items
    FOR INSERT
    WITH CHECK (
        public.can_access_business(business_id, auth.uid()) AND
        (location_id IS NULL OR public.can_access_location(location_id, auth.uid()))
    );

CREATE POLICY "catalogue_items_update_policy" ON public.catalogue_items
    FOR UPDATE
    USING (public.can_access_business(business_id, auth.uid()))
    WITH CHECK (
        public.can_access_business(business_id, auth.uid()) AND
        (location_id IS NULL OR public.can_access_location(location_id, auth.uid()))
    );

CREATE POLICY "catalogue_items_delete_policy" ON public.catalogue_items
    FOR DELETE
    USING (public.is_business_owner_or_manager(business_id, auth.uid()));


-- === 3.11 public.customers ===
DROP POLICY IF EXISTS "customers_select_policy" ON public.customers;
DROP POLICY IF EXISTS "customers_insert_policy" ON public.customers;
DROP POLICY IF EXISTS "customers_update_policy" ON public.customers;
DROP POLICY IF EXISTS "customers_delete_policy" ON public.customers;

CREATE POLICY "customers_select_policy" ON public.customers
    FOR SELECT
    USING (public.can_access_business(business_id, auth.uid()));

CREATE POLICY "customers_insert_policy" ON public.customers
    FOR INSERT
    WITH CHECK (
        public.can_access_business(business_id, auth.uid()) OR
        auth.uid() IS NOT NULL
    );

CREATE POLICY "customers_update_policy" ON public.customers
    FOR UPDATE
    USING (public.can_access_business(business_id, auth.uid()))
    WITH CHECK (public.can_access_business(business_id, auth.uid()));

CREATE POLICY "customers_delete_policy" ON public.customers
    FOR DELETE
    USING (public.is_business_owner_or_manager(business_id, auth.uid()));


-- === 3.12 public.orders ===
DROP POLICY IF EXISTS "orders_select_policy" ON public.orders;
DROP POLICY IF EXISTS "orders_insert_policy" ON public.orders;
DROP POLICY IF EXISTS "orders_update_policy" ON public.orders;
DROP POLICY IF EXISTS "orders_delete_policy" ON public.orders;

CREATE POLICY "orders_select_policy" ON public.orders
    FOR SELECT
    USING (
        public.can_access_business(business_id, auth.uid()) AND
        public.can_access_location(location_id, auth.uid())
    );

CREATE POLICY "orders_insert_policy" ON public.orders
    FOR INSERT
    WITH CHECK (
        public.can_access_business(business_id, auth.uid()) AND
        public.can_access_location(location_id, auth.uid())
    );

CREATE POLICY "orders_update_policy" ON public.orders
    FOR UPDATE
    USING (
        public.can_access_business(business_id, auth.uid()) AND
        public.can_access_location(location_id, auth.uid())
    )
    WITH CHECK (
        public.can_access_business(business_id, auth.uid()) AND
        public.can_access_location(location_id, auth.uid())
    );

-- Invariant: Orders are statutory/financial operational records and must never be deleted
CREATE POLICY "orders_delete_policy" ON public.orders
    FOR DELETE
    USING (false);


-- === 3.13 public.invoice_sequences ===
DROP POLICY IF EXISTS "invoice_sequences_select_policy" ON public.invoice_sequences;
DROP POLICY IF EXISTS "invoice_sequences_insert_policy" ON public.invoice_sequences;
DROP POLICY IF EXISTS "invoice_sequences_update_policy" ON public.invoice_sequences;
DROP POLICY IF EXISTS "invoice_sequences_delete_policy" ON public.invoice_sequences;

CREATE POLICY "invoice_sequences_select_policy" ON public.invoice_sequences
    FOR SELECT
    USING (public.can_access_business(business_id, auth.uid()));

CREATE POLICY "invoice_sequences_insert_policy" ON public.invoice_sequences
    FOR INSERT
    WITH CHECK (public.is_business_owner_or_manager(business_id, auth.uid()));

CREATE POLICY "invoice_sequences_update_policy" ON public.invoice_sequences
    FOR UPDATE
    USING (public.is_business_owner_or_manager(business_id, auth.uid()))
    WITH CHECK (public.is_business_owner_or_manager(business_id, auth.uid()));

-- Invariant: Statutory invoice sequences are strictly gap-free and non-deletable
CREATE POLICY "invoice_sequences_delete_policy" ON public.invoice_sequences
    FOR DELETE
    USING (false);


-- === 3.14 public.bills ===
DROP POLICY IF EXISTS "bills_select_policy" ON public.bills;
DROP POLICY IF EXISTS "bills_insert_policy" ON public.bills;
DROP POLICY IF EXISTS "bills_update_policy" ON public.bills;
DROP POLICY IF EXISTS "bills_delete_policy" ON public.bills;

CREATE POLICY "bills_select_policy" ON public.bills
    FOR SELECT
    USING (
        public.can_access_business(business_id, auth.uid()) AND
        public.can_access_location(location_id, auth.uid())
    );

CREATE POLICY "bills_insert_policy" ON public.bills
    FOR INSERT
    WITH CHECK (
        public.can_access_business(business_id, auth.uid()) AND
        public.can_access_location(location_id, auth.uid())
    );

CREATE POLICY "bills_update_policy" ON public.bills
    FOR UPDATE
    USING (
        public.is_business_owner_or_manager(business_id, auth.uid()) AND
        public.can_access_location(location_id, auth.uid())
    )
    WITH CHECK (
        public.is_business_owner_or_manager(business_id, auth.uid()) AND
        public.can_access_location(location_id, auth.uid())
    );

-- Invariant: Statutory tax invoices are immutable and must never be deleted
CREATE POLICY "bills_delete_policy" ON public.bills
    FOR DELETE
    USING (false);


-- === 3.15 public.audit_logs ===
DROP POLICY IF EXISTS "audit_logs_select_policy" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert_policy" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_update_policy" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_delete_policy" ON public.audit_logs;

CREATE POLICY "audit_logs_select_policy" ON public.audit_logs
    FOR SELECT
    USING (
        (business_id IS NOT NULL AND public.is_business_owner_or_manager(business_id, auth.uid())) OR
        (workspace_id IS NOT NULL AND public.is_workspace_admin_or_owner(workspace_id, auth.uid())) OR
        user_id = auth.uid()
    );

CREATE POLICY "audit_logs_insert_policy" ON public.audit_logs
    FOR INSERT
    WITH CHECK (
        auth.uid() IS NOT NULL AND
        (user_id IS NULL OR user_id = auth.uid())
    );

-- Invariant: Audit logs are strictly append-only; update and delete are forbidden
CREATE POLICY "audit_logs_update_policy" ON public.audit_logs
    FOR UPDATE
    USING (false);

CREATE POLICY "audit_logs_delete_policy" ON public.audit_logs
    FOR DELETE
    USING (false);


-- ------------------------------------------------------------------------------
-- 4. Supporting Indexes for RLS Evaluation Performance
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_business_members_lookup
    ON public.business_members (business_id, user_id, status);

CREATE INDEX IF NOT EXISTS idx_workspace_members_lookup
    ON public.workspace_members (workspace_id, user_id, status);

CREATE INDEX IF NOT EXISTS idx_businesses_owner_ws
    ON public.businesses (sovereign_owner_id, workspace_id);

CREATE INDEX IF NOT EXISTS idx_locations_business_lookup
    ON public.locations (business_id, id);

CREATE INDEX IF NOT EXISTS idx_orders_business_location
    ON public.orders (business_id, location_id);

CREATE INDEX IF NOT EXISTS idx_bills_business_location
    ON public.bills (business_id, location_id);

CREATE INDEX IF NOT EXISTS idx_catalogue_items_business_location
    ON public.catalogue_items (business_id, location_id);
