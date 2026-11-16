-- ==============================================================================
-- VyapOne Database Migration: 20261116000001_harden_capacity_locking_and_sqlstate.sql
-- Task: VO-026 — Final Capacity, Locking Inversion & SQLSTATE Hardening Gate
--
-- Security & Integrity Invariants Addressed:
-- 1. Correct custom SQLSTATE codes (VY001-VY006) preventing collision with predefined PostgreSQL codes.
-- 2. Eliminate lock-order inversion: revoke direct UPDATE(status) from authenticated clients;
--    require transition_site_status_atomic() for all publishing and capacity-checked transitions.
-- 3. Verify exact row-lock syntax: ORDER BY id precedes FOR UPDATE clause.
-- 4. Draft capacity verification during replacement: ensure net-neutral or projected drafts do not
--    exceed draft allowance, especially when workspace is in an exceeded state post-downgrade.
-- 5. Business archival/restoration safety: demote published sites to suspended when a business is
--    archived or restored, preventing silent live slot leakage without atomic republication.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Direct Site Status Write Restrictions (Zero-Bypass & Deadlock Elimination)
-- ------------------------------------------------------------------------------
-- Revoke direct UPDATE privilege on status column of public.sites from authenticated and anon clients.
-- Authenticated users must invoke transition_site_status_atomic() to publish or alter status.
REVOKE UPDATE (status) ON public.sites FROM authenticated, anon, PUBLIC;

-- ------------------------------------------------------------------------------
-- 2. Dedicated Custom SQLSTATE Exception Helpers
-- ------------------------------------------------------------------------------
-- VY001: Capacity Limit Exceeded
-- VY002: Invalid Business Lifecycle State
-- VY003: Permission Denied / Prohibited Direct Transition
-- VY004: Tenant Boundary Violation
-- VY005: Unknown or Unsupported Plan Identifier
-- VY006: Immutable Field Mutation Prohibited

CREATE OR REPLACE FUNCTION public.raise_capacity_exceeded(
    p_metric TEXT,
    p_current INT,
    p_limit INT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RAISE EXCEPTION 'Capacity limit reached for %: current %, limit %', p_metric, p_current, p_limit
        USING ERRCODE = 'VY001';
END;
$$;

REVOKE ALL ON FUNCTION public.raise_capacity_exceeded(TEXT, INT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.raise_capacity_exceeded(TEXT, INT, INT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 3. Site Status Trigger Guard (Eliminates Reverse Lock Order & Deadlocks)
-- ------------------------------------------------------------------------------
-- Ensures no caller can acquire a site row lock directly and then wait on workspace locks.
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
    -- Direct updates to published outside the atomic procedure are strictly prohibited
    IF NEW.status = 'published' AND (OLD.status IS NULL OR OLD.status <> 'published') THEN
        IF pg_catalog.current_setting('vyapone.in_atomic_site_transition', true) <> 'true' THEN
            RAISE EXCEPTION 'Direct site status transitions to published are prohibited. Use transition_site_status_atomic() instead'
                USING ERRCODE = 'VY003';
        END IF;

        -- Verify parent business lifecycle state
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

DROP TRIGGER IF EXISTS trg_check_site_publish_capacity ON public.sites;
CREATE TRIGGER trg_check_site_publish_capacity
    BEFORE INSERT OR UPDATE OF status ON public.sites
    FOR EACH ROW
    EXECUTE FUNCTION public.check_site_publish_capacity_trigger();

-- ------------------------------------------------------------------------------
-- 4. Immutable business_id Trigger (SQLSTATE VY006)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_site_business_id_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.business_id <> OLD.business_id THEN
        RAISE EXCEPTION 'business_id on public.sites is immutable and cannot be modified'
            USING ERRCODE = 'VY006';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_site_business_id_change ON public.sites;
CREATE TRIGGER trg_prevent_site_business_id_change
    BEFORE UPDATE OF business_id ON public.sites
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_site_business_id_change();

-- ------------------------------------------------------------------------------
-- 5. Business Archival and Restoration Safety Trigger
-- ------------------------------------------------------------------------------
-- Prevents an archived business from silently restoring with a published storefront
-- and bypassing workspace live website capacity limits.
CREATE OR REPLACE FUNCTION public.handle_business_archive_restore_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- When a business is archived or restored from archived, demote any published sites to suspended.
    -- This ensures that a restored business does not silently consume a live website slot without
    -- explicit republication through transition_site_status_atomic().
    IF (NEW.status = 'archived' AND OLD.status <> 'archived')
       OR (OLD.status = 'archived' AND NEW.status <> 'archived') THEN
        UPDATE public.sites
        SET status = 'suspended', updated_at = pg_catalog.now()
        WHERE business_id = NEW.id
          AND status = 'published';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_business_archive_restore ON public.businesses;
CREATE TRIGGER trg_handle_business_archive_restore
    BEFORE UPDATE OF status ON public.businesses
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_business_archive_restore_trigger();

-- ------------------------------------------------------------------------------
-- 6. Atomic Workspace Capacity Assertion Procedure (SQLSTATE VY001-VY005)
-- ------------------------------------------------------------------------------
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
    -- 1. Caller Authentication
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        IF session_user NOT IN ('postgres', 'service_role') AND coalesce(auth.jwt() ->> 'role', '') <> 'service_role' THEN
            RAISE EXCEPTION 'Unauthenticated execution: caller must be authenticated' USING ERRCODE = '28000';
        END IF;
    ELSE
        -- 2. Caller Tenant Authorization
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

    -- Validate metric parameter
    IF p_metric NOT IN ('live_websites', 'draft_websites', 'team_seats', 'locations_per_business', 'catalogue_items_per_business') THEN
        RAISE EXCEPTION 'Unsupported capacity metric: %', p_metric USING ERRCODE = 'VY001';
    END IF;

    -- 3. Acquire transaction-scoped row lock on the workspace record
    PERFORM 1 FROM public.workspaces WHERE id = p_workspace_id FOR UPDATE;

    -- Resolve canonical plan
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

    -- 4. Normalize canonical plan to base limits (PRD §9.1)
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
        ELSIF p_metric = 'locations_per_business' THEN v_base_limit := 25;
        ELSIF p_metric = 'catalogue_items_per_business' THEN v_base_limit := 5000;
        END IF;
    ELSE
        -- Unknown plan ID: FAIL CLOSED
        RAISE EXCEPTION 'Unknown or unsupported plan identifier: %', coalesce(v_plan_id, 'none') USING ERRCODE = 'VY005';
    END IF;

    -- 5. Check capacity overrides
    SELECT coalesce(additional_capacity, 0) INTO v_override
    FROM public.capacity_overrides
    WHERE workspace_id = p_workspace_id
      AND metric = p_metric
      AND (expires_at IS NULL OR expires_at > v_now);

    v_effective_limit := v_base_limit + v_override;

    -- 6. Count current live/draft sites or team seats (PRD §9.2 Counting Rules)
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

    -- 7. Evaluate capacity availability
    IF (v_current + p_requested_units) > v_effective_limit THEN
        RETURN QUERY SELECT false, v_current, v_effective_limit, v_remaining, 'Capacity limit reached for ' || p_metric;
    ELSE
        RETURN QUERY SELECT true, v_current, v_effective_limit, v_remaining, 'Capacity available';
    END IF;
END;
$$;

-- ------------------------------------------------------------------------------
-- 7. Atomic Site Status Transition Procedure (SQLSTATE VY001-VY004)
-- ------------------------------------------------------------------------------
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
    -- Set transaction-scoped config flag allowing trigger execution
    PERFORM pg_catalog.set_config('vyapone.in_atomic_site_transition', 'true', true);

    -- 1. Fetch site, business, and parent workspace
    SELECT s.business_id, s.status, b.workspace_id, b.status, b.sovereign_owner_id
    INTO v_business_id, v_current_status, v_workspace_id, v_biz_status, v_sovereign_owner_id
    FROM public.sites s
    JOIN public.businesses b ON b.id = s.business_id
    WHERE s.id = p_site_id;

    IF v_business_id IS NULL OR v_workspace_id IS NULL THEN
        RETURN QUERY SELECT false, 'not_found'::TEXT, 'Site or parent business not found'::TEXT;
        RETURN;
    END IF;

    -- Validate workspace-business containment
    IF NOT EXISTS (
        SELECT 1 FROM public.businesses
        WHERE id = v_business_id AND workspace_id = v_workspace_id
    ) THEN
        RAISE EXCEPTION 'Tenant boundary violation: business does not belong to specified workspace' USING ERRCODE = 'VY004';
    END IF;

    -- 2. Transaction-scoped row lock on workspace first to serialize all concurrent operations
    PERFORM 1 FROM public.workspaces WHERE id = v_workspace_id FOR UPDATE;

    -- 3. Lock business row and all sites of this business in consistent order (ORDER BY id precedes FOR UPDATE)
    PERFORM 1 FROM public.businesses WHERE id = v_business_id FOR UPDATE;
    PERFORM 1 FROM public.sites WHERE business_id = v_business_id ORDER BY id FOR UPDATE;

    -- 4. Caller Authentication & Exact Role-Based Authorization
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        IF session_user NOT IN ('postgres', 'service_role') AND coalesce(auth.jwt() ->> 'role', '') <> 'service_role' THEN
            RAISE EXCEPTION 'Unauthenticated execution: caller must be authenticated' USING ERRCODE = '28000';
        END IF;
    ELSE
        -- Validate exact authorized roles:
        -- - Workspace owner
        -- - Workspace admin / Reseller admin
        -- - Sovereign business owner
        -- - Business owner or manager
        -- Strictly excluded: workspace_member, reseller_staff, cashier, staff
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

    -- Validate target status parameter
    IF p_target_status NOT IN ('draft', 'published', 'archived', 'suspended') THEN
        RETURN QUERY SELECT false, v_current_status, 'Invalid target status'::TEXT;
        RETURN;
    END IF;

    -- 5. Archiving or Suspending is ALWAYS permitted and frees capacity (PRD §9.2)
    -- Authorized users can archive/suspend even if the business is archived (cleanup)
    IF p_target_status IN ('archived', 'suspended') THEN
        UPDATE public.sites SET status = p_target_status, updated_at = pg_catalog.now() WHERE id = p_site_id;
        RETURN QUERY SELECT true, p_target_status, 'Status updated'::TEXT;
        RETURN;
    END IF;

    -- Invariant: Archived businesses cannot publish or restore storefronts
    IF v_biz_status = 'archived' THEN
        IF p_target_status = 'published' THEN
            RETURN QUERY SELECT false, v_current_status, 'Cannot publish site for an archived business'::TEXT;
        ELSE
            RETURN QUERY SELECT false, v_current_status, 'Cannot modify site for an archived business'::TEXT;
        END IF;
        RETURN;
    END IF;

    -- Idempotency Check
    IF v_current_status = p_target_status THEN
        RETURN QUERY SELECT true, v_current_status, 'Already in target status'::TEXT;
        RETURN;
    END IF;

    -- 6. Resolve canonical effective plan
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
        -- Fail closed on unknown plan
        RETURN QUERY SELECT false, v_current_status, 'Unknown or unsupported plan identifier: ' || coalesce(v_plan_id, 'none');
        RETURN;
    END IF;

    -- 7. If publishing: check live AND draft capacity before modifying any existing published sites
    IF p_target_status = 'published' THEN
        SELECT coalesce(additional_capacity, 0) INTO v_override
        FROM public.capacity_overrides
        WHERE workspace_id = v_workspace_id
          AND metric = 'live_websites'
          AND (expires_at IS NULL OR expires_at > v_now);

        v_effective_limit := v_base_limit + v_override;

        -- Calculate existing live business usage correctly (PRD §9.2)
        SELECT count(DISTINCT s.business_id)::INT INTO v_current_live_count
        FROM public.sites s
        JOIN public.businesses b ON b.id = s.business_id
        WHERE b.workspace_id = v_workspace_id
          AND b.status <> 'archived'
          AND s.status = 'published';

        -- Account for currently published site of this business
        SELECT exists(
            SELECT 1 FROM public.sites
            WHERE business_id = v_business_id
              AND status = 'published'
              AND id <> p_site_id
        ) INTO v_business_has_published;

        -- 7.1 Evaluate Live Website Capacity
        IF v_business_has_published THEN
            -- Replacement: business already has a published site.
            -- If plan capacity is already exceeded (e.g. after downgrade), replacement is rejected.
            IF v_current_live_count > v_effective_limit THEN
                RETURN QUERY SELECT false, v_current_status, 'Capacity limit reached for live_websites: workspace exceeds plan allowance'::TEXT;
                RETURN;
            END IF;
        ELSE
            -- New live business: consumes 1 slot
            IF v_current_live_count + 1 > v_effective_limit THEN
                RETURN QUERY SELECT false, v_current_status, 'Capacity limit reached for live_websites'::TEXT;
                RETURN;
            END IF;
        END IF;

        -- 7.2 Evaluate Draft Capacity During Replacement (PRD §9.2)
        SELECT coalesce(additional_capacity, 0) INTO v_draft_override
        FROM public.capacity_overrides
        WHERE workspace_id = v_workspace_id
          AND metric = 'draft_websites'
          AND (expires_at IS NULL OR expires_at > v_now);

        v_effective_draft_limit := v_draft_limit + v_draft_override;

        SELECT count(*)::INT INTO v_current_draft_count
        FROM public.sites s
        JOIN public.businesses b ON b.id = s.business_id
        WHERE b.workspace_id = v_workspace_id
          AND b.status <> 'archived'
          AND s.status = 'draft';

        IF v_business_has_published THEN
            -- Replacement demotes old published site to draft (+1 draft).
            -- If target site was draft, target ceases to be draft (-1 draft). Projected delta = 0.
            -- If target site was not draft, target was not in draft count. Projected delta = +1.
            IF v_current_status = 'draft' THEN
                v_projected_draft_count := v_current_draft_count;
            ELSE
                v_projected_draft_count := v_current_draft_count + 1;
            END IF;

            -- If projected drafts exceed allowance (e.g. workspace is above limit following downgrade), reject
            IF v_projected_draft_count > v_effective_draft_limit THEN
                RETURN QUERY SELECT false, v_current_status, 'Capacity limit reached for draft_websites: workspace exceeds draft allowance'::TEXT;
                RETURN;
            END IF;
        END IF;

        -- ONLY AFTER ALL CHECKS SUCCEED: Demote old published site and publish target site
        UPDATE public.sites
        SET status = 'draft', updated_at = pg_catalog.now()
        WHERE business_id = v_business_id
          AND status = 'published'
          AND id <> p_site_id;

        UPDATE public.sites 
        SET status = 'published', 
            published_at = coalesce(published_at, pg_catalog.now()),
            updated_at = pg_catalog.now() 
        WHERE id = p_site_id;

        RETURN QUERY SELECT true, 'published'::TEXT, 'Site published successfully'::TEXT;
        RETURN;
    END IF;

    -- 8. If restoring archived to draft: check draft capacity atomically
    IF p_target_status = 'draft' AND v_current_status = 'archived' THEN
        SELECT coalesce(additional_capacity, 0) INTO v_draft_override
        FROM public.capacity_overrides
        WHERE workspace_id = v_workspace_id
          AND metric = 'draft_websites'
          AND (expires_at IS NULL OR expires_at > v_now);

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

-- ------------------------------------------------------------------------------
-- 8. Function Execution Privileges
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.assert_and_lock_workspace_capacity(UUID, TEXT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assert_and_lock_workspace_capacity(UUID, TEXT, INT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.transition_site_status_atomic(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transition_site_status_atomic(UUID, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.check_site_publish_capacity_trigger() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_site_publish_capacity_trigger() TO postgres, service_role;

REVOKE ALL ON FUNCTION public.prevent_site_business_id_change() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prevent_site_business_id_change() TO postgres, service_role;

REVOKE ALL ON FUNCTION public.handle_business_archive_restore_trigger() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.handle_business_archive_restore_trigger() TO postgres, service_role;
