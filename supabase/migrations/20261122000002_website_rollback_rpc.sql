-- VyapOne — Website Version Rollback RPC [VO-048]
--
-- Migration: 20261122000002_website_rollback_rpc.sql
-- Invariants:
--   1. Atomic transactional rollback via public.rollback_published_site_version_atomic.
--   2. Consistent lock ordering (workspaces -> businesses -> sites FOR UPDATE OF s) preventing deadlocks.
--   3. Authenticated session caller verification and business authorization check (public.can_manage_business).
--   4. Validates that the target version belongs to the site and was previously published (published_at IS NOT NULL).
--   5. Enforces live_websites workspace capacity ONLY when rollback transitions a non-published site into
--      published without an existing live slot for that business. Never rejects capacity-neutral rollbacks.
--   6. Sets transaction-local vyapone.in_atomic_site_transition = 'true' for trigger compliance.
--   7. Optimistic concurrency check on current published version preventing silent race conditions.
--   8. Historical versions are strictly immutable and never mutated or deleted on rollback.
--   9. Logs audit event: site.published_version_rolled_back.

CREATE OR REPLACE FUNCTION public.rollback_published_site_version_atomic(
    p_site_id UUID,
    p_business_id UUID,
    p_caller_user_id UUID,
    p_target_version_id UUID,
    p_expected_current_published_version_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_now TIMESTAMPTZ := pg_catalog.now();
    v_site RECORD;
    v_target_version RECORD;
    v_workspace_id UUID;
    v_updated_site RECORD;
    v_business_has_published BOOLEAN := FALSE;
    v_plan_id TEXT;
    v_base_limit INT := 0;
    v_override INT := 0;
    v_effective_limit INT := 0;
    v_current_live_count INT := 0;
BEGIN
    -- 1. Input Validation
    IF p_site_id IS NULL THEN
        RAISE EXCEPTION 'Site ID cannot be null' USING ERRCODE = 'VY040';
    END IF;
    IF p_business_id IS NULL THEN
        RAISE EXCEPTION 'Business ID cannot be null' USING ERRCODE = 'VY020';
    END IF;
    IF p_caller_user_id IS NULL THEN
        RAISE EXCEPTION 'Caller user ID cannot be null' USING ERRCODE = 'VY020';
    END IF;
    IF p_target_version_id IS NULL THEN
        RAISE EXCEPTION 'Target version ID cannot be null' USING ERRCODE = 'VY040';
    END IF;

    -- 2. Authenticated Caller Identity Verification
    IF auth.uid() IS NOT NULL AND auth.uid() <> p_caller_user_id THEN
        RAISE EXCEPTION 'Access denied: caller does not match authenticated session' USING ERRCODE = 'VY020';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_caller_user_id) THEN
        RAISE EXCEPTION 'Caller user record not found' USING ERRCODE = 'VY020';
    END IF;

    -- 3. Acquire locks in canonical workspace -> business -> site order to prevent lock-order inversion
    SELECT b.workspace_id
    INTO v_workspace_id
    FROM public.sites s
    JOIN public.businesses b ON b.id = s.business_id
    WHERE s.id = p_site_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Site not found: %', p_site_id USING ERRCODE = 'VY040';
    END IF;

    IF v_workspace_id IS NOT NULL THEN
        PERFORM 1 FROM public.workspaces WHERE id = v_workspace_id FOR UPDATE;
    END IF;

    PERFORM 1 FROM public.businesses WHERE id = p_business_id FOR UPDATE;

    SELECT s.id, s.business_id, s.subdomain, s.primary_domain, s.status, s.published_version_id,
           s.current_draft_version_id, s.created_at, s.updated_at,
           b.workspace_id, b.status AS business_status
    INTO v_site
    FROM public.sites s
    JOIN public.businesses b ON b.id = s.business_id
    WHERE s.id = p_site_id
    FOR UPDATE OF s;

    IF v_site.id IS NULL THEN
        RAISE EXCEPTION 'Site not found: %', p_site_id USING ERRCODE = 'VY040';
    END IF;

    IF v_site.business_id <> p_business_id THEN
        RAISE EXCEPTION 'Site does not belong to specified business' USING ERRCODE = 'VY020';
    END IF;

    v_workspace_id := v_site.workspace_id;

    IF v_site.business_status = 'archived' THEN
        RAISE EXCEPTION 'Cannot roll back or publish site for an archived business' USING ERRCODE = 'VY002';
    END IF;

    -- 4. Verify Authorization
    IF NOT public.can_manage_business(p_business_id, p_caller_user_id) THEN
        RAISE EXCEPTION 'Unauthorized: insufficient business permissions to roll back site' USING ERRCODE = 'VY020';
    END IF;

    -- 5. Concurrency Check on Current Published Version
    -- Strictly rejects stale or NULL expectations whenever a published version is active.
    IF v_site.published_version_id IS DISTINCT FROM p_expected_current_published_version_id THEN
        RAISE EXCEPTION 'Rollback conflict: current published version does not match expected version' USING ERRCODE = 'VY049';
    END IF;

    -- 6. Verify Target Version
    SELECT v.id, v.site_id, v.business_id, v.version_number, v.schema_version,
           v.configuration, v.created_by, v.change_summary, v.published_at, v.created_at
    INTO v_target_version
    FROM public.site_versions v
    WHERE v.id = p_target_version_id;

    IF v_target_version.id IS NULL THEN
        RAISE EXCEPTION 'Target site version not found: %', p_target_version_id USING ERRCODE = 'VY040';
    END IF;

    IF v_target_version.site_id <> p_site_id OR v_target_version.business_id <> p_business_id THEN
        RAISE EXCEPTION 'Target version does not belong to this site or business' USING ERRCODE = 'VY020';
    END IF;

    IF v_target_version.published_at IS NULL THEN
        RAISE EXCEPTION 'Cannot rollback to an unpublished draft version; use Restore to Draft instead' USING ERRCODE = 'VY040';
    END IF;

    IF v_site.published_version_id = p_target_version_id THEN
        RAISE EXCEPTION 'Target version is already the active published version' USING ERRCODE = 'VY040';
    END IF;

    -- 7. Enforce Live Website Capacity ONLY when rollback increases live website usage
    -- Rolling back an already-published site, or replacing another published site of the same business,
    -- does not consume an additional live_websites slot and is never rejected for capacity.
    IF v_site.status <> 'published' THEN
        SELECT EXISTS (
            SELECT 1
            FROM public.sites s2
            WHERE s2.business_id = p_business_id
              AND s2.status = 'published'
              AND s2.id <> p_site_id
        ) INTO v_business_has_published;

        IF NOT v_business_has_published AND v_workspace_id IS NOT NULL THEN
            -- Resolve canonical plan from active/trialing/grace subscription or workspace fallback
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
                SELECT w.plan INTO v_plan_id
                FROM public.workspaces w
                WHERE w.id = v_workspace_id;
            END IF;

            IF v_plan_id = 'starter' THEN v_base_limit := 3;
            ELSIF v_plan_id IN ('growth', 'pro') THEN v_base_limit := 8;
            ELSIF v_plan_id = 'agency' THEN v_base_limit := 20;
            ELSIF v_plan_id = 'scale' THEN v_base_limit := 50;
            ELSE
                RAISE EXCEPTION 'Unknown or unsupported plan identifier: %', pg_catalog.coalesce(v_plan_id, 'none')
                    USING ERRCODE = 'VY005';
            END IF;

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

            SELECT pg_catalog.count(DISTINCT s2.business_id)::INT INTO v_current_live_count
            FROM public.sites s2
            JOIN public.businesses b2 ON b2.id = s2.business_id
            WHERE b2.workspace_id = v_workspace_id
              AND b2.status <> 'archived'
              AND s2.status = 'published';

            IF (v_current_live_count + 1) > v_effective_limit THEN
                RAISE EXCEPTION 'Capacity limit reached for live_websites: current %, limit %', v_current_live_count, v_effective_limit
                    USING ERRCODE = 'VY001';
            END IF;
        END IF;

        IF v_business_has_published THEN
            PERFORM pg_catalog.set_config('vyapone.in_atomic_site_transition', 'true', true);
            UPDATE public.sites
            SET status = 'draft',
                updated_at = v_now
            WHERE business_id = p_business_id
              AND status = 'published'
              AND id <> p_site_id;
        END IF;
    END IF;

    -- 8. Set transaction-scoped trigger guard and update Site Record
    PERFORM pg_catalog.set_config('vyapone.in_atomic_site_transition', 'true', true);

    UPDATE public.sites
    SET published_version_id = p_target_version_id,
        status = 'published',
        updated_at = v_now
    WHERE id = p_site_id
    RETURNING id, business_id, subdomain, primary_domain, status,
              published_version_id, current_draft_version_id, created_at, updated_at
    INTO v_updated_site;

    -- 9. Audit Log Entry
    INSERT INTO public.audit_logs (
        business_id,
        workspace_id,
        user_id,
        action,
        resource,
        metadata_json,
        ip_address,
        created_at
    ) VALUES (
        p_business_id,
        v_workspace_id,
        p_caller_user_id,
        'site.published_version_rolled_back',
        'site',
        pg_catalog.jsonb_build_object(
            'site_id', p_site_id,
            'previous_published_version_id', v_site.published_version_id,
            'rolled_back_to_version_id', v_target_version.id,
            'rolled_back_to_version_number', v_target_version.version_number
        ),
        NULL,
        v_now
    );

    RETURN pg_catalog.jsonb_build_object(
        'site', pg_catalog.row_to_json(v_updated_site),
        'targetVersion', pg_catalog.row_to_json(v_target_version)
    );
END;
$$;

-- Revoke direct execution from anon and PUBLIC
REVOKE ALL ON FUNCTION public.rollback_published_site_version_atomic(UUID, UUID, UUID, UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rollback_published_site_version_atomic(UUID, UUID, UUID, UUID, UUID) FROM anon;

-- Grant execution to authenticated and service_role
GRANT EXECUTE ON FUNCTION public.rollback_published_site_version_atomic(UUID, UUID, UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rollback_published_site_version_atomic(UUID, UUID, UUID, UUID, UUID) TO service_role;
