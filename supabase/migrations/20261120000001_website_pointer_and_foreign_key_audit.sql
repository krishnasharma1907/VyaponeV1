-- ==============================================================================
-- VyapOne — Website Pointer Privileges, Composite FK Semantics & TIMESTAMPTZ Audit [VO-040 Audit]
--
-- Migration: 20261120000001_website_pointer_and_foreign_key_audit.sql
--
-- Targeted Audit Invariants Addressed:
-- 1. Effective Privilege Lockdown (Audit 1):
--    - In PostgreSQL, table-level UPDATE/INSERT grants override column-level revocations.
--    - Strips ALL table-level and column-level privileges from anon, authenticated, and PUBLIC
--      on both public.sites and public.site_versions.
--    - Grants explicit SELECT on public.sites and public.site_versions to anon and authenticated
--      (enabling legitimate public storefront reads and owner dashboard reads governed by RLS).
--    - Grants explicit, column-level INSERT on public.sites strictly excluding status,
--      current_draft_version_id, and published_version_id.
--    - Grants explicit, column-level UPDATE on public.sites strictly excluding status, business_id,
--      current_draft_version_id, and published_version_id.
--    - Revokes direct INSERT and DELETE on public.site_versions from authenticated;
--      all version creation is restricted to the atomic, authorized procedure
--      save_site_draft_configuration_atomic() (SECURITY DEFINER).
-- 2. Composite Foreign-Key Deletion Semantics (Audit 2):
--    - Composite FKs (id, current_draft_version_id) and (id, published_version_id) with ON DELETE SET NULL
--      attempt to set all child columns to NULL upon deletion of the referenced version, which violates
--      the non-nullable PRIMARY KEY constraint on sites.id.
--    - Changes deletion behavior to ON DELETE RESTRICT, enforcing at DB constraint level that
--      an immutable site version cannot be deleted while referenced as the active draft or published version.
--    - Preserves the same-site guarantee (site_id = sites.id) without attempting invalid PK nullification.
-- 3. TIMESTAMPTZ Correctness (Audit 3):
--    - Replaces session-dependent timezone('utc'::text, now()) default on public.site_versions.created_at
--      with session-independent now().
--    - Updates save_site_draft_configuration_atomic() to use pg_catalog.now() for TIMESTAMPTZ consistency.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Effective Privilege Lockdown on sites and site_versions (Audit 1)
-- ------------------------------------------------------------------------------

-- 1.1 Strip all table-level and column-level grants from untrusted roles
REVOKE ALL ON public.sites FROM anon, authenticated, PUBLIC;
REVOKE ALL ON public.site_versions FROM anon, authenticated, PUBLIC;

-- 1.2 Legitimate Read Privileges (Governed by Table RLS Policies)
-- Public storefront visitors (anon) and authenticated business operators may read sites and versions
GRANT SELECT ON public.sites TO anon, authenticated;
GRANT SELECT ON public.site_versions TO anon, authenticated;

-- 1.3 Column-Level INSERT on public.sites (Excludes status, current_draft_version_id, published_version_id)
-- authenticated clients may insert new sites; status defaults to 'draft', pointers default to NULL.
GRANT INSERT (id, business_id, subdomain, primary_domain, created_at, updated_at)
ON public.sites TO authenticated;

-- 1.4 Column-Level UPDATE on public.sites (Excludes status, business_id, current_draft_version_id, published_version_id)
-- authenticated clients may update non-critical website attributes (subdomain, primary_domain, updated_at).
-- status requires transition_site_status_atomic().
-- version pointers require save_site_draft_configuration_atomic() or publish_site_version_atomic().
GRANT UPDATE (subdomain, primary_domain, updated_at)
ON public.sites TO authenticated;

-- 1.5 Scoped DELETE Privilege on public.sites (Protected by RLS sites_delete_policy: sovereign owner only)
GRANT DELETE ON public.sites TO authenticated;

-- 1.6 Service Role Administrative Privileges
GRANT ALL ON public.sites TO service_role;
GRANT ALL ON public.site_versions TO service_role;

-- ------------------------------------------------------------------------------
-- 2. Composite Foreign-Key Deletion Semantics (Audit 2)
-- ------------------------------------------------------------------------------

-- Drop the flawed ON DELETE SET NULL composite constraints
ALTER TABLE public.sites DROP CONSTRAINT IF EXISTS fk_sites_current_draft_version;
ALTER TABLE public.sites DROP CONSTRAINT IF EXISTS fk_sites_published_version;

-- Re-create composite foreign keys with ON DELETE RESTRICT.
-- Ensures that:
-- 1. Referenced versions cannot be deleted while actively pointed to by a site.
-- 2. PostgreSQL never attempts to nullify sites.id (a non-null primary key).
-- 3. The same-site constraint (id, pointer) -> (site_id, id) remains strictly enforced.
ALTER TABLE public.sites
    ADD CONSTRAINT fk_sites_current_draft_version
    FOREIGN KEY (id, current_draft_version_id)
    REFERENCES public.site_versions(site_id, id)
    ON DELETE RESTRICT;

ALTER TABLE public.sites
    ADD CONSTRAINT fk_sites_published_version
    FOREIGN KEY (id, published_version_id)
    REFERENCES public.site_versions(site_id, id)
    ON DELETE RESTRICT;

-- ------------------------------------------------------------------------------
-- 3. TIMESTAMPTZ Correctness (Audit 3)
-- ------------------------------------------------------------------------------

-- 3.1 Alter site_versions.created_at default from timezone('utc', now()) to now()
ALTER TABLE public.site_versions
    ALTER COLUMN created_at SET DEFAULT now();

-- 3.2 Update save_site_draft_configuration_atomic to use pg_catalog.now()
CREATE OR REPLACE FUNCTION public.save_site_draft_configuration_atomic(
    p_site_id UUID,
    p_business_id UUID,
    p_caller_user_id UUID,
    p_schema_version TEXT,
    p_configuration JSONB,
    p_change_summary TEXT,
    p_referenced_media_ids UUID[]
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

    -- 5. Media Validation (existence, tenant ownership, status = 'ready', verified_at)
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

    -- 6. Atomic Version Number Allocation
    SELECT COALESCE(pg_catalog.max(version_number), 0) + 1
    INTO v_next_version_number
    FROM public.site_versions
    WHERE site_id = p_site_id;

    -- 7. Insert Site Version Record
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

    -- 8. Update Current Draft Version Pointer on public.sites
    UPDATE public.sites
    SET current_draft_version_id = v_new_version.id,
        updated_at = v_now
    WHERE id = p_site_id
    RETURNING * INTO v_updated_site;

    -- 9. Transactional Audit Log Insertion
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
            'schema_version', p_schema_version,
            'page_count', v_page_count,
            'change_summary', p_change_summary
        ),
        NULL,
        v_now
    );

    -- 10. Return Structured Result
    RETURN pg_catalog.jsonb_build_object(
        'version', pg_catalog.row_to_json(v_new_version),
        'site', pg_catalog.row_to_json(v_updated_site)
    );
END;
$$;

ALTER FUNCTION public.save_site_draft_configuration_atomic(UUID, UUID, UUID, TEXT, JSONB, TEXT, UUID[]) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.save_site_draft_configuration_atomic(UUID, UUID, UUID, TEXT, JSONB, TEXT, UUID[]) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.save_site_draft_configuration_atomic(UUID, UUID, UUID, TEXT, JSONB, TEXT, UUID[]) TO authenticated;
