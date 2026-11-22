-- VyapOne — Website Draft Concurrency & Optimistic Lock RPC [VO-044 Audit C]
--
-- Migration: 20261122000001_website_draft_concurrency_and_optimistic_lock.sql
-- Invariants:
--   1. Replaces save_site_draft_configuration_atomic with 8-parameter version including p_expected_base_version_number.
--   2. Atomically verifies caller's expected base version against current draft version number under FOR UPDATE lock.
--   3. Rejects stale concurrent saves with SQLSTATE 'VY049' (Concurrency conflict).
--   4. Preserves draft isolation (only mutates current_draft_version_id, never touches published_version_id or status).

-- Drop previous 7-parameter overload to prevent calling ambiguity
DROP FUNCTION IF EXISTS public.save_site_draft_configuration_atomic(UUID, UUID, UUID, TEXT, JSONB, TEXT, UUID[]);

CREATE OR REPLACE FUNCTION public.save_site_draft_configuration_atomic(
    p_site_id UUID,
    p_business_id UUID,
    p_caller_user_id UUID,
    p_schema_version TEXT,
    p_configuration JSONB,
    p_change_summary TEXT,
    p_referenced_media_ids UUID[],
    p_expected_base_version_number INT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_now TIMESTAMPTZ := pg_catalog.now();
    v_site RECORD;
    v_workspace_id UUID;
    v_valid_media_count INT;
    v_current_draft_version_number INT := NULL;
    v_next_version_number INT;
    v_new_version RECORD;
    v_updated_site RECORD;
    v_page_count INT;
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
    IF p_schema_version IS NULL OR p_schema_version <> 'v1' THEN
        RAISE EXCEPTION 'Unsupported schema version: %', COALESCE(p_schema_version, 'null') USING ERRCODE = 'VY040';
    END IF;
    IF p_configuration IS NULL OR pg_catalog.jsonb_typeof(p_configuration) <> 'object' THEN
        RAISE EXCEPTION 'Configuration must be a valid JSON object' USING ERRCODE = 'VY040';
    END IF;

    -- Verify JSON configuration internal identifiers match arguments
    IF (p_configuration->>'siteId')::uuid <> p_site_id THEN
        RAISE EXCEPTION 'Configuration siteId mismatch' USING ERRCODE = 'VY040';
    END IF;
    IF (p_configuration->>'businessId')::uuid <> p_business_id THEN
        RAISE EXCEPTION 'Configuration businessId mismatch' USING ERRCODE = 'VY040';
    END IF;
    IF (p_configuration->>'schemaVersion') <> p_schema_version THEN
        RAISE EXCEPTION 'Configuration schemaVersion mismatch' USING ERRCODE = 'VY040';
    END IF;

    -- 2. Authenticated Caller Identity Verification
    IF auth.uid() IS NOT NULL AND auth.uid() <> p_caller_user_id THEN
        RAISE EXCEPTION 'Access denied: caller does not match authenticated session' USING ERRCODE = 'VY020';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_caller_user_id) THEN
        RAISE EXCEPTION 'Caller user record not found' USING ERRCODE = 'VY020';
    END IF;

    -- 3. Site Tenancy & Row Lock (Serializes concurrent saves for the same site)
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
        RAISE EXCEPTION 'Site does not belong to specified business' USING ERRCODE = 'VY024';
    END IF;

    v_workspace_id := v_site.workspace_id;

    -- 4. Business Authorization Verification
    IF NOT public.can_manage_business(p_business_id, p_caller_user_id) THEN
        RAISE EXCEPTION 'You do not have permission to modify websites for this business' USING ERRCODE = 'VY021';
    END IF;

    -- 5. Server-Enforced Optimistic Concurrency Check (VO-044 Audit C)
    IF p_expected_base_version_number IS NOT NULL THEN
        IF v_site.current_draft_version_id IS NOT NULL THEN
            SELECT version_number INTO v_current_draft_version_number
            FROM public.site_versions
            WHERE id = v_site.current_draft_version_id;

            IF v_current_draft_version_number IS NOT NULL AND v_current_draft_version_number <> p_expected_base_version_number THEN
                RAISE EXCEPTION 'Concurrency conflict: current draft version is %, but save was based on version %',
                    v_current_draft_version_number, p_expected_base_version_number
                    USING ERRCODE = 'VY049';
            END IF;
        END IF;
    END IF;

    -- 6. Media Validation (existence, tenant ownership, status = 'ready', verified_at)
    IF p_referenced_media_ids IS NOT NULL AND pg_catalog.cardinality(p_referenced_media_ids) > 0 THEN
        SELECT pg_catalog.count(*)
        INTO v_valid_media_count
        FROM public.media_items m
        WHERE m.id = ANY(p_referenced_media_ids)
          AND (m.business_id = p_business_id OR (v_workspace_id IS NOT NULL AND m.workspace_id = v_workspace_id))
          AND m.status = 'ready'
          AND m.verified_at IS NOT NULL
          AND m.category IN ('business_logo', 'catalogue_image', 'website_asset', 'onboarding_upload');

        IF v_valid_media_count < pg_catalog.cardinality(p_referenced_media_ids) THEN
            IF EXISTS (
                SELECT 1 FROM public.media_items m
                WHERE m.id = ANY(p_referenced_media_ids)
                  AND m.business_id <> p_business_id
                  AND (v_workspace_id IS NULL OR m.workspace_id <> v_workspace_id)
            ) THEN
                RAISE EXCEPTION 'Cross-tenant media violation: referenced media belongs to another tenant' USING ERRCODE = 'VY024';
            ELSIF EXISTS (
                SELECT 1 FROM public.media_items m
                WHERE m.id = ANY(p_referenced_media_ids)
                  AND (m.status <> 'ready' OR m.verified_at IS NULL)
            ) THEN
                RAISE EXCEPTION 'Referenced media item is not verified and ready for use' USING ERRCODE = 'VY032';
            ELSE
                RAISE EXCEPTION 'One or more referenced media items were not found' USING ERRCODE = 'VY032';
            END IF;
        END IF;
    END IF;

    -- 7. Atomic Version Number Allocation
    SELECT COALESCE(pg_catalog.max(version_number), 0) + 1
    INTO v_next_version_number
    FROM public.site_versions
    WHERE site_id = p_site_id;

    -- 8. Insert Site Version Record
    INSERT INTO public.site_versions (
        site_id,
        business_id,
        version_number,
        schema_version,
        configuration,
        change_summary,
        created_by,
        created_at,
        published_at
    ) VALUES (
        p_site_id,
        p_business_id,
        v_next_version_number,
        p_schema_version,
        p_configuration,
        p_change_summary,
        p_caller_user_id,
        v_now,
        NULL
    )
    RETURNING * INTO v_new_version;

    -- 9. Update Current Draft Version Pointer on public.sites
    UPDATE public.sites
    SET current_draft_version_id = v_new_version.id,
        updated_at = v_now
    WHERE id = p_site_id
    RETURNING * INTO v_updated_site;

    -- 10. Transactional Audit Log Insertion
    v_page_count := COALESCE(pg_catalog.jsonb_array_length(p_configuration->'pages'), 0);

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
        'site.version_created',
        'site',
        pg_catalog.jsonb_build_object(
            'site_id', p_site_id,
            'version_id', v_new_version.id,
            'version_number', v_next_version_number,
            'base_version_number', p_expected_base_version_number,
            'schema_version', p_schema_version,
            'page_count', v_page_count,
            'change_summary', p_change_summary
        ),
        NULL,
        v_now
    );

    RETURN pg_catalog.jsonb_build_object(
        'site', pg_catalog.to_jsonb(v_updated_site),
        'version', pg_catalog.to_jsonb(v_new_version)
    );
END;
$$;

-- Permissions and Ownership
ALTER FUNCTION public.save_site_draft_configuration_atomic(UUID, UUID, UUID, TEXT, JSONB, TEXT, UUID[], INT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.save_site_draft_configuration_atomic(UUID, UUID, UUID, TEXT, JSONB, TEXT, UUID[], INT) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.save_site_draft_configuration_atomic(UUID, UUID, UUID, TEXT, JSONB, TEXT, UUID[], INT) TO authenticated;
