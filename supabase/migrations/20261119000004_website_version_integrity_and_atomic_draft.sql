-- ==============================================================================
-- VyapOne — Website Version Integrity & Atomic Draft Configuration RPC [VO-040 Audit]
--
-- Audit & Corrective Hardening:
-- 1. Composite Relationship Integrity (Audit B):
--    - Enforces that public.site_versions(business_id) strictly matches public.sites(business_id)
--      via composite foreign key fk_site_versions_site_business (site_id, business_id) -> sites(id, business_id).
--    - Enforces that public.sites(current_draft_version_id) and public.sites(published_version_id)
--      strictly reference versions belonging to the SAME site via composite foreign keys:
--      (id, current_draft_version_id) -> site_versions(site_id, id)
--      (id, published_version_id) -> site_versions(site_id, id).
-- 2. Restrict Client Pointer Modification Privileges (Audit C):
--    - Revokes direct column-level UPDATE and INSERT privileges on current_draft_version_id
--      and published_version_id from authenticated, anon, and PUBLIC.
--    - Ensures version pointers are only updated via authorized server-controlled transactions.
-- 3. Version Immutability & Lifecycle Hardening (Audit D):
--    - Hardens prevent_site_version_modification() to strictly reject any tampering with
--      configuration, version_number, site_id, business_id, created_at, created_by, or change_summary.
--    - Permits one-way publication timestamp transition (published_at from NULL to non-null).
--    - Prevents deleting published versions or versions actively referenced by site pointers.
-- 4. Atomic Transactional RPC (Audit A, E, F):
--    - Implements public.save_site_draft_configuration_atomic(...) executing in a single PostgreSQL transaction.
--    - Employs row locking (FOR UPDATE OF sites) to serialize concurrent version saves and prevent collisions.
--    - Verifies session caller identity (auth.uid() = p_caller_user_id), user existence, and business RBAC.
--    - Enforces media readiness (status = 'ready', verified_at IS NOT NULL, approved category, tenant isolation).
--    - Atomically increments version number, inserts site_versions, updates site draft pointer, and logs audit event.
--
-- PRD Authority:
-- - PRD FINAL v2 §6.14: Builder mode — validated JSON site configuration
-- - PRD FINAL v2 §15.3: Builder representation — site metadata, theme tokens, pages, ordered sections
-- - PRD FINAL v2 §16: Initial Data Model — Site, SiteVersion, MediaItems, AuditLogs
-- - PRD FINAL v2 §17: Security & Tenant Isolation
-- ==============================================================================

-- -----------------------------------------------------------------------------
-- 1. Composite Relationship Constraints on sites and site_versions (Audit B)
-- -----------------------------------------------------------------------------

-- 1.1 Composite unique constraint on public.sites (id, business_id)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_sites_id_business_id' AND conrelid = 'public.sites'::regclass
    ) THEN
        ALTER TABLE public.sites
            ADD CONSTRAINT uq_sites_id_business_id UNIQUE (id, business_id);
    END IF;
END $$;

-- 1.2 Composite foreign key on public.site_versions (site_id, business_id) -> public.sites(id, business_id)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'site_versions_site_id_fkey' AND conrelid = 'public.site_versions'::regclass
    ) THEN
        ALTER TABLE public.site_versions DROP CONSTRAINT site_versions_site_id_fkey;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_site_versions_site_business' AND conrelid = 'public.site_versions'::regclass
    ) THEN
        ALTER TABLE public.site_versions
            ADD CONSTRAINT fk_site_versions_site_business
            FOREIGN KEY (site_id, business_id)
            REFERENCES public.sites(id, business_id)
            ON DELETE CASCADE;
    END IF;
END $$;

-- 1.3 Composite unique constraint on public.site_versions (site_id, id)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_site_versions_site_id_id' AND conrelid = 'public.site_versions'::regclass
    ) THEN
        ALTER TABLE public.site_versions
            ADD CONSTRAINT uq_site_versions_site_id_id UNIQUE (site_id, id);
    END IF;
END $$;

-- 1.4 Composite foreign keys on public.sites for current_draft_version_id and published_version_id
DO $$
BEGIN
    -- Drop old single-column FKs
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'sites_current_draft_version_id_fkey' AND conrelid = 'public.sites'::regclass
    ) THEN
        ALTER TABLE public.sites DROP CONSTRAINT sites_current_draft_version_id_fkey;
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_sites_published_version' AND conrelid = 'public.sites'::regclass
    ) THEN
        ALTER TABLE public.sites DROP CONSTRAINT fk_sites_published_version;
    END IF;

    -- Add composite FKs ensuring draft and published versions belong strictly to THIS site
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_sites_current_draft_version' AND conrelid = 'public.sites'::regclass
    ) THEN
        ALTER TABLE public.sites
            ADD CONSTRAINT fk_sites_current_draft_version
            FOREIGN KEY (id, current_draft_version_id)
            REFERENCES public.site_versions(site_id, id)
            ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_sites_published_version' AND conrelid = 'public.sites'::regclass
    ) THEN
        ALTER TABLE public.sites
            ADD CONSTRAINT fk_sites_published_version
            FOREIGN KEY (id, published_version_id)
            REFERENCES public.site_versions(site_id, id)
            ON DELETE SET NULL;
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. Restrict Direct Client Pointer Privileges (Audit C)
-- -----------------------------------------------------------------------------
-- Revoke direct column-level UPDATE and INSERT on version pointers from authenticated and anon.
-- Pointers must only be set by server-authorized procedures.
REVOKE UPDATE (current_draft_version_id) ON public.sites FROM authenticated, anon, PUBLIC;
REVOKE INSERT (current_draft_version_id) ON public.sites FROM authenticated, anon, PUBLIC;

REVOKE UPDATE (published_version_id) ON public.sites FROM authenticated, anon, PUBLIC;
REVOKE INSERT (published_version_id) ON public.sites FROM authenticated, anon, PUBLIC;

-- -----------------------------------------------------------------------------
-- 3. Hardened Immutability & Lifecycle Trigger on site_versions (Audit D)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_site_version_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        -- Strictly disallow modifying any core configuration or metadata field
        IF OLD.site_id <> NEW.site_id OR
           OLD.business_id <> NEW.business_id OR
           OLD.version_number <> NEW.version_number OR
           OLD.schema_version <> NEW.schema_version OR
           OLD.configuration <> NEW.configuration OR
           OLD.created_at <> NEW.created_at OR
           OLD.created_by IS DISTINCT FROM NEW.created_by OR
           OLD.change_summary IS DISTINCT FROM NEW.change_summary THEN
            RAISE EXCEPTION 'Historical site versions are immutable and cannot be updated' USING ERRCODE = 'VY040';
        END IF;

        -- Lifecycle check: published_at can only transition once from NULL to non-null
        IF OLD.published_at IS NOT NULL AND NEW.published_at IS DISTINCT FROM OLD.published_at THEN
            RAISE EXCEPTION 'Published site version timestamp is immutable' USING ERRCODE = 'VY040';
        END IF;

        IF OLD.published_at IS NULL AND NEW.published_at IS NOT NULL THEN
            -- Allowed: one-way publication timestamp transition by authorized publisher
            RETURN NEW;
        END IF;

        -- Direct updates that do not publish are rejected
        IF OLD.published_at IS NULL AND NEW.published_at IS NULL THEN
            RAISE EXCEPTION 'Draft site versions are immutable; save a new version to apply changes' USING ERRCODE = 'VY040';
        END IF;

        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- Published versions cannot be deleted
        IF OLD.published_at IS NOT NULL THEN
            RAISE EXCEPTION 'Cannot delete a published site version' USING ERRCODE = 'VY040';
        END IF;

        -- Versions actively referenced as active draft or published version cannot be deleted
        IF EXISTS (
            SELECT 1 FROM public.sites
            WHERE current_draft_version_id = OLD.id OR published_version_id = OLD.id
        ) THEN
            RAISE EXCEPTION 'Cannot delete a site version currently referenced as active draft or published version' USING ERRCODE = 'VY040';
        END IF;

        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. Atomic Transactional RPC: save_site_draft_configuration_atomic (Audit A, E, F)
-- -----------------------------------------------------------------------------
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
    v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
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

    -- 5. Media Validation (Audit E: existence, tenant ownership, status = 'ready', verified_at)
    IF p_referenced_media_ids IS NOT NULL AND pg_catalog.cardinality(p_referenced_media_ids) > 0 THEN
        -- Check that all referenced media IDs exist, belong to this tenant, and are verified ready
        SELECT pg_catalog.count(*)
        INTO v_valid_media_count
        FROM public.media_items m
        WHERE m.id = ANY(p_referenced_media_ids)
          AND (m.business_id = p_business_id OR (v_workspace_id IS NOT NULL AND m.workspace_id = v_workspace_id))
          AND m.status = 'ready'
          AND m.verified_at IS NOT NULL
          AND m.category IN ('business_logo', 'catalogue_image', 'website_asset', 'onboarding_upload');

        IF v_valid_media_count < pg_catalog.cardinality(p_referenced_media_ids) THEN
            -- Identify exact cause of failure for descriptive error
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
    -- Site is locked FOR UPDATE, guaranteeing clean sequential numbering under concurrent saves
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

-- -----------------------------------------------------------------------------
-- 5. Execution Grants for save_site_draft_configuration_atomic
-- -----------------------------------------------------------------------------
ALTER FUNCTION public.save_site_draft_configuration_atomic(UUID, UUID, UUID, TEXT, JSONB, TEXT, UUID[]) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.save_site_draft_configuration_atomic(UUID, UUID, UUID, TEXT, JSONB, TEXT, UUID[]) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.save_site_draft_configuration_atomic(UUID, UUID, UUID, TEXT, JSONB, TEXT, UUID[]) TO authenticated;
