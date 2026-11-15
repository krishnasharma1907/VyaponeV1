-- ==============================================================================
-- Migration: 20261115000001_plans_entitlements_capacity.sql
-- Description: VO-026 Plans, Subscriptions, Entitlements and Capacity Model
-- Standards: Adheres to PRD FINAL v2 §9.1, §9.2, §16 and multi-tenant security
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Schema Extensions & Constraint Updates
-- ------------------------------------------------------------------------------

-- 1.1 Support all canonical plan identifiers in workspaces ('starter', 'growth', 'pro', 'agency', 'scale')
ALTER TABLE public.workspaces DROP CONSTRAINT IF EXISTS workspaces_plan_check;
ALTER TABLE public.workspaces ADD CONSTRAINT workspaces_plan_check 
    CHECK (plan IN ('starter', 'growth', 'pro', 'agency', 'scale'));

-- 1.2 Support 'archived' status for sites per PRD §9.2 counting rules
ALTER TABLE public.sites DROP CONSTRAINT IF EXISTS sites_status_check;
ALTER TABLE public.sites ADD CONSTRAINT sites_status_check 
    CHECK (status IN ('draft', 'published', 'suspended', 'archived'));

-- 1.3 PRD §9.2 rule 1: Enforce at most one live published storefront per business
-- Prevents double-counting and guarantees 1 website slot = 1 live business
CREATE UNIQUE INDEX IF NOT EXISTS idx_sites_single_published_per_business 
    ON public.sites (business_id) 
    WHERE status = 'published';

-- ------------------------------------------------------------------------------
-- 2. Subscriptions Table (Workspace Commercial Plan Assignment)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trialing', 'past_due', 'grace_period', 'canceled')),
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
    current_period_end TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
    grace_period_end TIMESTAMPTZ,
    provider_reference TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT subscriptions_workspace_unique UNIQUE (workspace_id)
);

CREATE TRIGGER trg_subscriptions_updated_at
    BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_subscriptions_workspace_id ON public.subscriptions (workspace_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_status ON public.subscriptions (plan_id, status);

-- ------------------------------------------------------------------------------
-- 3. Entitlement Overrides Table (Feature Grants / Add-ons)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.entitlement_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    feature_key TEXT NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    expires_at TIMESTAMPTZ,
    reason TEXT,
    granted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_override_scope CHECK (
        (workspace_id IS NOT NULL AND business_id IS NULL) OR
        (workspace_id IS NULL AND business_id IS NOT NULL)
    )
);

CREATE TRIGGER trg_entitlement_overrides_updated_at
    BEFORE UPDATE ON public.entitlement_overrides
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_entitlement_overrides_ws ON public.entitlement_overrides (workspace_id);
CREATE INDEX IF NOT EXISTS idx_entitlement_overrides_biz ON public.entitlement_overrides (business_id);
CREATE INDEX IF NOT EXISTS idx_entitlement_overrides_feature ON public.entitlement_overrides (feature_key);

-- ------------------------------------------------------------------------------
-- 4. Capacity Overrides Table (Additional Website / Seat Quotas)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.capacity_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    metric TEXT NOT NULL,
    additional_capacity INTEGER NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ,
    reason TEXT,
    granted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT capacity_overrides_workspace_metric_unique UNIQUE (workspace_id, metric)
);

CREATE TRIGGER trg_capacity_overrides_updated_at
    BEFORE UPDATE ON public.capacity_overrides
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_capacity_overrides_ws_metric ON public.capacity_overrides (workspace_id, metric);

-- ------------------------------------------------------------------------------
-- 5. Row-Level Security & Tenant Isolation Enforcement
-- ------------------------------------------------------------------------------
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.entitlement_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entitlement_overrides FORCE ROW LEVEL SECURITY;

ALTER TABLE public.capacity_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capacity_overrides FORCE ROW LEVEL SECURITY;

-- 5.1 Subscriptions RLS Policies
CREATE POLICY "subscriptions_select_policy" ON public.subscriptions
    FOR SELECT
    USING (public.is_workspace_member(workspace_id));

CREATE POLICY "subscriptions_insert_policy" ON public.subscriptions
    FOR INSERT
    WITH CHECK (public.is_workspace_admin_or_owner(workspace_id));

CREATE POLICY "subscriptions_update_policy" ON public.subscriptions
    FOR UPDATE
    USING (public.is_workspace_admin_or_owner(workspace_id))
    WITH CHECK (public.is_workspace_admin_or_owner(workspace_id));

CREATE POLICY "subscriptions_delete_policy" ON public.subscriptions
    FOR DELETE
    USING (false);

-- 5.2 Entitlement Overrides RLS Policies
CREATE POLICY "entitlement_overrides_select_policy" ON public.entitlement_overrides
    FOR SELECT
    USING (
        (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id)) OR
        (business_id IS NOT NULL AND public.can_access_business(business_id))
    );

CREATE POLICY "entitlement_overrides_insert_policy" ON public.entitlement_overrides
    FOR INSERT
    WITH CHECK (false);

CREATE POLICY "entitlement_overrides_update_policy" ON public.entitlement_overrides
    FOR UPDATE
    USING (false);

CREATE POLICY "entitlement_overrides_delete_policy" ON public.entitlement_overrides
    FOR DELETE
    USING (false);

-- 5.3 Capacity Overrides RLS Policies
CREATE POLICY "capacity_overrides_select_policy" ON public.capacity_overrides
    FOR SELECT
    USING (public.is_workspace_member(workspace_id));

CREATE POLICY "capacity_overrides_insert_policy" ON public.capacity_overrides
    FOR INSERT
    WITH CHECK (false);

CREATE POLICY "capacity_overrides_update_policy" ON public.capacity_overrides
    FOR UPDATE
    USING (false);

CREATE POLICY "capacity_overrides_delete_policy" ON public.capacity_overrides
    FOR DELETE
    USING (false);

-- ------------------------------------------------------------------------------
-- 6. Atomic Concurrency-Safe Capacity Reservation & Site Transition Functions
-- ------------------------------------------------------------------------------
-- 6. Atomic Capacity Assertion & Mutative Publishing Procedures
-- ------------------------------------------------------------------------------
-- Protects against time-of-check to time-of-use (TOCTOU) race conditions when
-- multiple concurrent requests attempt to create/publish sites or add team seats.
-- Uses transaction-scoped row locking (SELECT ... FOR UPDATE on public.workspaces).
-- All procedures are strictly SECURITY DEFINER with empty search_path,
-- caller authorization via auth.uid(), and fail-closed plan resolution.

CREATE OR REPLACE FUNCTION public.assert_and_lock_workspace_capacity(
    p_workspace_id UUID,
    p_metric TEXT,
    p_requested_quantity INT DEFAULT 1
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
    v_now TIMESTAMPTZ := pg_catalog.now();
BEGIN
    -- 1. Caller Authorization (prevent cross-tenant snooping)
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        IF current_user NOT IN ('postgres', 'service_role') THEN
            RAISE EXCEPTION 'Unauthenticated execution' USING ERRCODE = '28000';
        END IF;
    ELSE
        IF NOT EXISTS (
            SELECT 1 FROM public.workspaces w
            WHERE w.id = p_workspace_id AND w.owner_user_id = v_caller_id
        ) AND NOT EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = p_workspace_id 
              AND wm.user_id = v_caller_id 
              AND wm.status = 'active'
        ) THEN
            RAISE EXCEPTION 'Access denied to workspace %', p_workspace_id USING ERRCODE = '42501';
        END IF;
    END IF;

    -- 2. Transaction-scoped row lock on the workspace to serialize concurrent operations
    PERFORM 1 FROM public.workspaces WHERE id = p_workspace_id FOR UPDATE;

    -- 3. Resolve plan from active/grace subscription or workspace plan fallback
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
        RETURN QUERY SELECT false, 0, 0, 0, 'Workspace not found';
        RETURN;
    END IF;

    -- 4. Normalize canonical plan to base limits (PRD §9.1)
    -- Unknown plans FAIL CLOSED per strict security invariants
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
        RETURN QUERY SELECT false, 0, 0, 0, 'Unknown or unsupported plan identifier: ' || coalesce(v_plan_id, 'none');
        RETURN;
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
        -- Distinct live businesses (archived businesses excluded)
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
    END IF;

    -- 7. Evaluate remaining capacity
    IF v_current + p_requested_quantity > v_effective_limit THEN
        RETURN QUERY SELECT
            false,
            v_current,
            v_effective_limit,
            pg_catalog.greatest(0, v_effective_limit - v_current),
            'Capacity limit reached for ' || p_metric;
    ELSE
        RETURN QUERY SELECT
            true,
            v_current,
            v_effective_limit,
            v_effective_limit - (v_current + p_requested_quantity),
            'Capacity available'::TEXT;
    END IF;
END;
$$;

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
    v_current_status TEXT;
    v_biz_status TEXT;
    v_allowed BOOLEAN;
    v_reason TEXT;
BEGIN
    -- 1. Fetch site, business, and parent workspace
    SELECT s.business_id, s.status, b.workspace_id, b.status
    INTO v_business_id, v_current_status, v_workspace_id, v_biz_status
    FROM public.sites s
    JOIN public.businesses b ON b.id = s.business_id
    WHERE s.id = p_site_id;

    IF v_workspace_id IS NULL THEN
        RETURN QUERY SELECT false, 'not_found'::TEXT, 'Site not found'::TEXT;
        RETURN;
    END IF;

    -- 2. Caller Authorization
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        IF current_user NOT IN ('postgres', 'service_role') THEN
            RAISE EXCEPTION 'Unauthenticated execution' USING ERRCODE = '28000';
        END IF;
    ELSE
        IF NOT EXISTS (
            SELECT 1 FROM public.workspaces w
            WHERE w.id = v_workspace_id AND w.owner_user_id = v_caller_id
        ) AND NOT EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = v_workspace_id 
              AND wm.user_id = v_caller_id 
              AND wm.status = 'active'
        ) AND NOT EXISTS (
            SELECT 1 FROM public.business_members bm
            WHERE bm.business_id = v_business_id
              AND bm.user_id = v_caller_id
              AND bm.role IN ('owner', 'admin')
        ) THEN
            RAISE EXCEPTION 'Access denied to site %', p_site_id USING ERRCODE = '42501';
        END IF;
    END IF;

    -- 3. Invariant: Archived businesses cannot publish or modify storefronts
    IF v_biz_status = 'archived' THEN
        RETURN QUERY SELECT false, v_current_status, 'Cannot modify site for an archived business'::TEXT;
        RETURN;
    END IF;

    -- 4. If already in target status, idempotent success
    IF v_current_status = p_target_status THEN
        RETURN QUERY SELECT true, v_current_status, 'Already in target status'::TEXT;
        RETURN;
    END IF;

    -- 5. Archiving or suspending is always permitted and frees capacity (PRD §9.2)
    IF p_target_status IN ('archived', 'suspended') THEN
        UPDATE public.sites SET status = p_target_status, updated_at = pg_catalog.now() WHERE id = p_site_id;
        RETURN QUERY SELECT true, p_target_status, 'Status updated'::TEXT;
        RETURN;
    END IF;

    -- 6. If publishing: acquire workspace lock, check capacity, and mutate in the same transaction
    IF p_target_status = 'published' THEN
        -- Unpublish any existing published site for the same business (1 live site per business)
        UPDATE public.sites
        SET status = 'draft', updated_at = pg_catalog.now()
        WHERE business_id = v_business_id
          AND status = 'published'
          AND id <> p_site_id;

        -- Lock workspace & check live website capacity
        SELECT c.allowed, c.reason INTO v_allowed, v_reason
        FROM public.assert_and_lock_workspace_capacity(v_workspace_id, 'live_websites', 1) c;

        IF NOT v_allowed THEN
            RETURN QUERY SELECT false, v_current_status, v_reason;
            RETURN;
        END IF;

        UPDATE public.sites 
        SET status = 'published', 
            published_at = coalesce(published_at, pg_catalog.now()),
            updated_at = pg_catalog.now() 
        WHERE id = p_site_id;

        RETURN QUERY SELECT true, 'published'::TEXT, 'Site published successfully'::TEXT;
        RETURN;
    END IF;

    -- 7. If restoring archived to draft: check draft capacity atomically
    IF p_target_status = 'draft' AND v_current_status = 'archived' THEN
        SELECT c.allowed, c.reason INTO v_allowed, v_reason
        FROM public.assert_and_lock_workspace_capacity(v_workspace_id, 'draft_websites', 1) c;

        IF NOT v_allowed THEN
            RETURN QUERY SELECT false, v_current_status, v_reason;
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
-- 7. Direct Mutation Trigger Guard (Zero-Bypass Capacity Defense)
-- ------------------------------------------------------------------------------
-- Ensures that ANY direct UPDATE or INSERT on public.sites to status = 'published'
-- (via Server Actions, raw SQL, or client APIs) automatically executes inside
-- the transaction with the workspace row lock and capacity enforcement.

CREATE OR REPLACE FUNCTION public.check_site_publish_capacity_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_workspace_id UUID;
    v_biz_status TEXT;
    v_allowed BOOLEAN;
    v_reason TEXT;
BEGIN
    IF NEW.status = 'published' AND (OLD.status IS NULL OR OLD.status <> 'published') THEN
        SELECT b.workspace_id, b.status INTO v_workspace_id, v_biz_status
        FROM public.businesses b
        WHERE b.id = NEW.business_id;

        IF v_biz_status = 'archived' THEN
            RAISE EXCEPTION 'Cannot publish site for an archived business' USING ERRCODE = 'P0004';
        END IF;

        -- Unpublish other sites for this business to uphold PRD §9.2 rule 1
        UPDATE public.sites
        SET status = 'draft', updated_at = pg_catalog.now()
        WHERE business_id = NEW.business_id
          AND status = 'published'
          AND id <> NEW.id;

        -- Validate capacity with workspace row lock
        SELECT c.allowed, c.reason INTO v_allowed, v_reason
        FROM public.assert_and_lock_workspace_capacity(v_workspace_id, 'live_websites', 1) c;

        IF NOT v_allowed THEN
            RAISE EXCEPTION '%', v_reason USING ERRCODE = 'P0003';
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

-- Function Execution Privileges
REVOKE ALL ON FUNCTION public.assert_and_lock_workspace_capacity(UUID, TEXT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assert_and_lock_workspace_capacity(UUID, TEXT, INT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.transition_site_status_atomic(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transition_site_status_atomic(UUID, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.check_site_publish_capacity_trigger() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_site_publish_capacity_trigger() TO postgres, service_role;
