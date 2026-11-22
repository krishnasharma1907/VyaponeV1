-- VyapOne — Website Version Rollback RPC [VO-048]
--
-- Migration: 20261122000002_website_rollback_rpc.sql
-- Invariants:
--   1. Atomic transactional rollback via public.rollback_published_site_version_atomic.
--   2. Strict row locking (FOR UPDATE OF s) serializing concurrent rollback and publishing operations.
--   3. Authenticated session caller verification and business authorization check (owner or staff).
--   4. Validates that the target version belongs to the site and was previously published (published_at IS NOT NULL).
--   5. Optimistic concurrency check on current published version preventing silent race conditions.
--   6. Historical versions are strictly immutable and never mutated or deleted on rollback.
--   7. Logs audit event: site.published_version_rolled_back.

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

    -- 3. Lock site row FOR UPDATE (Serializes concurrent operations for the same site)
    SELECT s.id, s.business_id, s.subdomain, s.primary_domain, s.status, s.published_version_id,
           s.current_draft_version_id, s.created_at, s.updated_at, b.workspace_id
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

    -- 4. Verify Authorization
    IF NOT EXISTS (
        SELECT 1 FROM public.business_memberships
        WHERE business_id = p_business_id
          AND user_id = p_caller_user_id
          AND role IN ('owner', 'reseller_admin', 'reseller_staff')
    ) AND NOT EXISTS (
        SELECT 1 FROM public.workspace_memberships wm
        JOIN public.businesses b ON b.workspace_id = wm.workspace_id
        WHERE b.id = p_business_id
          AND wm.user_id = p_caller_user_id
          AND wm.role IN ('owner', 'admin', 'member')
    ) THEN
        RAISE EXCEPTION 'Unauthorized: insufficient business permissions to roll back site' USING ERRCODE = 'VY020';
    END IF;

    -- 5. Concurrency Check on Current Published Version
    IF p_expected_current_published_version_id IS NOT NULL AND
       v_site.published_version_id IS DISTINCT FROM p_expected_current_published_version_id THEN
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

    -- 7. Update Site Record (Point published_version_id to target version, preserve draft pointer)
    UPDATE public.sites
    SET published_version_id = p_target_version_id,
        status = 'published',
        updated_at = v_now
    WHERE id = p_site_id
    RETURNING id, business_id, subdomain, primary_domain, status,
              published_version_id, current_draft_version_id, created_at, updated_at
    INTO v_updated_site;

    -- 8. Audit Log Entry
    INSERT INTO public.audit_logs (
        business_id,
        user_id,
        action,
        resource_type,
        resource_id,
        metadata,
        created_at
    ) VALUES (
        p_business_id,
        p_caller_user_id,
        'site.published_version_rolled_back',
        'site',
        p_site_id,
        pg_catalog.jsonb_build_object(
            'site_id', p_site_id,
            'previous_published_version_id', v_site.published_version_id,
            'rolled_back_to_version_id', v_target_version.id,
            'rolled_back_to_version_number', v_target_version.version_number
        ),
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
