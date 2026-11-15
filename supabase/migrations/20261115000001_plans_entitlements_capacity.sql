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
