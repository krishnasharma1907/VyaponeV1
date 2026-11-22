-- VyapOne — Website Publishing, Custom Domains and Dynamic QR Migration [VO-049]
--
-- Migration: 20261122000003_website_publishing_domains_and_qr.sql
-- Invariants:
--   1. Atomic publication of site draft versions via public.publish_site_draft_atomic.
--   2. Enforces live_websites plan capacity on transition from draft to published.
--   3. Strict row locking (FOR UPDATE OF s) serializing concurrent publishing operations.
--   4. Authenticated session caller verification and business authorization check.
--   5. Optimistic concurrency check preventing publish of stale drafts.
--   6. Historical versions are strictly immutable; published_at timestamp is stamped.
--   7. public.site_domains table for custom domain verification lifecycle.
--   8. public.qr_codes table for permanent dynamic QR redirects.
--   9. Automatic provisioning of stable main storefront QR on publish.
--  10. Logs audit event: site.published.

-- ------------------------------------------------------------------------------
-- 1. Site Domains Table (Custom Domain Verification Lifecycle)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.site_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    domain TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending_verification' CHECK (status IN ('pending_verification', 'verified', 'active', 'failed', 'suspended')),
    verification_method TEXT NOT NULL DEFAULT 'dns_txt' CHECK (verification_method IN ('dns_txt', 'dns_cname')),
    verification_token TEXT NOT NULL,
    verification_target TEXT NOT NULL,
    verified_at TIMESTAMPTZ,
    last_checked_at TIMESTAMPTZ,
    ssl_status TEXT NOT NULL DEFAULT 'pending' CHECK (ssl_status IN ('pending', 'active', 'failed')),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_site_domains_updated_at
    BEFORE UPDATE ON public.site_domains
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_site_domains_site_id ON public.site_domains(site_id);
CREATE INDEX IF NOT EXISTS idx_site_domains_business_id ON public.site_domains(business_id);
CREATE INDEX IF NOT EXISTS idx_site_domains_domain ON public.site_domains(domain);
CREATE INDEX IF NOT EXISTS idx_site_domains_status ON public.site_domains(status);

ALTER TABLE public.site_domains ENABLE ROW LEVEL SECURITY;

-- RLS Policies for site_domains: Business owners and workspace admins can view/manage
CREATE POLICY site_domains_select_policy ON public.site_domains
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_members bm
            WHERE bm.business_id = site_domains.business_id
              AND bm.user_id = auth.uid()
              AND bm.status = 'active'
        ) OR EXISTS (
            SELECT 1 FROM public.businesses b
            JOIN public.workspace_members wm ON wm.workspace_id = b.workspace_id
            WHERE b.id = site_domains.business_id
              AND wm.user_id = auth.uid()
              AND wm.status = 'active'
        )
    );

CREATE POLICY site_domains_insert_policy ON public.site_domains
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.business_members bm
            WHERE bm.business_id = site_domains.business_id
              AND bm.user_id = auth.uid()
              AND bm.role IN ('owner', 'manager')
              AND bm.status = 'active'
        ) OR EXISTS (
            SELECT 1 FROM public.businesses b
            JOIN public.workspace_members wm ON wm.workspace_id = b.workspace_id
            WHERE b.id = site_domains.business_id
              AND wm.user_id = auth.uid()
              AND wm.role IN ('workspace_owner', 'agency_admin')
              AND wm.status = 'active'
        )
    );

CREATE POLICY site_domains_update_policy ON public.site_domains
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_members bm
            WHERE bm.business_id = site_domains.business_id
              AND bm.user_id = auth.uid()
              AND bm.role IN ('owner', 'manager')
              AND bm.status = 'active'
        ) OR EXISTS (
            SELECT 1 FROM public.businesses b
            JOIN public.workspace_members wm ON wm.workspace_id = b.workspace_id
            WHERE b.id = site_domains.business_id
              AND wm.user_id = auth.uid()
              AND wm.role IN ('workspace_owner', 'agency_admin')
              AND wm.status = 'active'
        )
    );

CREATE POLICY site_domains_delete_policy ON public.site_domains
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_members bm
            WHERE bm.business_id = site_domains.business_id
              AND bm.user_id = auth.uid()
              AND bm.role = 'owner'
              AND bm.status = 'active'
        ) OR EXISTS (
            SELECT 1 FROM public.businesses b
            JOIN public.workspace_members wm ON wm.workspace_id = b.workspace_id
            WHERE b.id = site_domains.business_id
              AND wm.user_id = auth.uid()
              AND wm.role = 'workspace_owner'
              AND wm.status = 'active'
        )
    );

-- ------------------------------------------------------------------------------
-- 2. QR Codes Table (Permanent Dynamic QR Redirects)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.qr_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'main_storefront' CHECK (type IN ('main_storefront', 'page', 'catalogue', 'table', 'booking', 'offer', 'custom')),
    public_slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL DEFAULT 'Main Storefront QR',
    destination_configuration JSONB NOT NULL DEFAULT '{"targetType":"storefront"}'::jsonb,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
    scan_count INTEGER NOT NULL DEFAULT 0 CHECK (scan_count >= 0),
    last_scanned_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_qr_codes_updated_at
    BEFORE UPDATE ON public.qr_codes
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_qr_codes_site_id ON public.qr_codes(site_id);
CREATE INDEX IF NOT EXISTS idx_qr_codes_business_id ON public.qr_codes(business_id);
CREATE INDEX IF NOT EXISTS idx_qr_codes_public_slug ON public.qr_codes(public_slug);
CREATE INDEX IF NOT EXISTS idx_qr_codes_status ON public.qr_codes(status);

ALTER TABLE public.qr_codes ENABLE ROW LEVEL SECURITY;

-- Public can select active QR codes for redirect resolution
CREATE POLICY qr_codes_public_select ON public.qr_codes
    FOR SELECT TO anon, authenticated
    USING (status = 'active');

-- Business members and workspace admins can view all QR codes for their business
CREATE POLICY qr_codes_business_select ON public.qr_codes
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_members bm
            WHERE bm.business_id = qr_codes.business_id
              AND bm.user_id = auth.uid()
              AND bm.status = 'active'
        ) OR EXISTS (
            SELECT 1 FROM public.businesses b
            JOIN public.workspace_members wm ON wm.workspace_id = b.workspace_id
            WHERE b.id = qr_codes.business_id
              AND wm.user_id = auth.uid()
              AND wm.status = 'active'
        )
    );

CREATE POLICY qr_codes_business_manage ON public.qr_codes
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_members bm
            WHERE bm.business_id = qr_codes.business_id
              AND bm.user_id = auth.uid()
              AND bm.role IN ('owner', 'manager')
              AND bm.status = 'active'
        ) OR EXISTS (
            SELECT 1 FROM public.businesses b
            JOIN public.workspace_members wm ON wm.workspace_id = b.workspace_id
            WHERE b.id = qr_codes.business_id
              AND wm.user_id = auth.uid()
              AND wm.role IN ('workspace_owner', 'agency_admin')
              AND wm.status = 'active'
        )
    );

-- ------------------------------------------------------------------------------
-- 3. Atomic Publishing RPC: public.publish_site_draft_atomic
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.publish_site_draft_atomic(
    p_site_id UUID,
    p_business_id UUID,
    p_caller_user_id UUID,
    p_target_version_id UUID,
    p_expected_draft_version_number INT
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
    v_plan_id TEXT;
    v_base_limit INT := 0;
    v_override INT := 0;
    v_effective_limit INT := 0;
    v_current_live_count INT := 0;
    v_main_qr RECORD;
    v_qr_slug TEXT;
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

    -- 3. Lock site row FOR UPDATE (Serializes concurrent publish/rollback operations)
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

    v_workspace_id := v_site.workspace_id;

    -- 4. Verify Authorization (Owner or Workspace Admin/Owner)
    IF NOT EXISTS (
        SELECT 1 FROM public.business_members
        WHERE business_id = p_business_id
          AND user_id = p_caller_user_id
          AND role = 'owner'
          AND status = 'active'
    ) AND NOT EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = v_workspace_id
          AND wm.user_id = p_caller_user_id
          AND wm.role IN ('workspace_owner', 'agency_admin')
          AND wm.status = 'active'
    ) AND NOT EXISTS (
        SELECT 1 FROM public.businesses b
        WHERE b.id = p_business_id
          AND b.sovereign_owner_id = p_caller_user_id
    ) THEN
        RAISE EXCEPTION 'Unauthorized: insufficient permissions to publish website' USING ERRCODE = 'VY020';
    END IF;

    -- 5. Verify Target Version
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

    -- Optimistic concurrency check on draft version
    IF p_expected_draft_version_number IS NOT NULL AND
       v_target_version.version_number <> p_expected_draft_version_number THEN
        RAISE EXCEPTION 'Publish conflict: target draft version (% ) does not match expected version (%)',
            v_target_version.version_number, p_expected_draft_version_number USING ERRCODE = 'VY049';
    END IF;

    -- 6. Enforce Plan Capacity (if transitioning from draft to published)
    -- If site is ALREADY published (republishing updated draft), capacity was already accounted for.
    IF v_site.status <> 'published' THEN
        -- Lock workspace row FOR UPDATE to serialize capacity accounting
        SELECT w.plan_id INTO v_plan_id
        FROM public.workspaces w
        WHERE w.id = v_workspace_id
        FOR UPDATE;

        IF v_plan_id IS NULL THEN
            v_plan_id := 'free';
        END IF;

        -- Determine base limit
        IF v_plan_id = 'starter' THEN v_base_limit := 3;
        ELSIF v_plan_id = 'growth' THEN v_base_limit := 8;
        ELSIF v_plan_id = 'scale' THEN v_base_limit := 20;
        ELSIF v_plan_id = 'enterprise' THEN v_base_limit := 50;
        ELSE v_base_limit := 1;
        END IF;

        -- Check capacity override
        SELECT COALESCE(co.limit_override, 0) INTO v_override
        FROM public.capacity_overrides co
        WHERE co.workspace_id = v_workspace_id
          AND co.metric = 'live_websites';

        v_effective_limit := v_base_limit + v_override;

        -- Count current live websites in workspace
        SELECT COUNT(s2.id) INTO v_current_live_count
        FROM public.sites s2
        JOIN public.businesses b2 ON b2.id = s2.business_id
        WHERE b2.workspace_id = v_workspace_id
          AND s2.status = 'published';

        IF v_current_live_count >= v_effective_limit THEN
            RAISE EXCEPTION 'Capacity limit reached for live_websites: workspace exceeds plan allowance (% max)', v_effective_limit
                USING ERRCODE = 'VY049';
        END IF;
    END IF;

    -- 7. Update Target Version: Stamp published_at if not already stamped
    IF v_target_version.published_at IS NULL THEN
        UPDATE public.site_versions
        SET published_at = v_now
        WHERE id = p_target_version_id
        RETURNING * INTO v_target_version;
    END IF;

    -- 8. Update Site Record (Point published_version_id to target version)
    UPDATE public.sites
    SET published_version_id = p_target_version_id,
        current_draft_version_id = p_target_version_id,
        status = 'published',
        updated_at = v_now
    WHERE id = p_site_id
    RETURNING id, business_id, subdomain, primary_domain, status,
              published_version_id, current_draft_version_id, created_at, updated_at
    INTO v_updated_site;

    -- 9. Ensure Stable Main Storefront QR Code Exists [PRD §5.6, §8.9, §17.3 FR-08]
    SELECT id, public_slug, destination_configuration, status
    INTO v_main_qr
    FROM public.qr_codes
    WHERE site_id = p_site_id
      AND type = 'main_storefront'
    LIMIT 1;

    IF v_main_qr.id IS NULL THEN
        v_qr_slug := 'qr_' || pg_catalog.substr(pg_catalog.replace(p_site_id::TEXT, '-', ''), 1, 10);
        INSERT INTO public.qr_codes (
            site_id,
            business_id,
            type,
            public_slug,
            title,
            destination_configuration,
            status,
            created_at,
            updated_at
        ) VALUES (
            p_site_id,
            p_business_id,
            'main_storefront',
            v_qr_slug,
            'Main Storefront QR',
            pg_catalog.jsonb_build_object(
                'targetType', 'storefront',
                'subdomain', v_site.subdomain
            ),
            'active',
            v_now,
            v_now
        )
        RETURNING id, public_slug, destination_configuration, status
        INTO v_main_qr;
    END IF;

    -- 10. Audit Log Entry
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
        'site.published',
        'site',
        p_site_id,
        pg_catalog.jsonb_build_object(
            'site_id', p_site_id,
            'version_id', v_target_version.id,
            'version_number', v_target_version.version_number,
            'subdomain', v_updated_site.subdomain,
            'primary_domain', v_updated_site.primary_domain,
            'qr_slug', v_main_qr.public_slug
        ),
        v_now
    );

    RETURN pg_catalog.jsonb_build_object(
        'site', pg_catalog.row_to_json(v_updated_site),
        'publishedVersion', pg_catalog.row_to_json(v_target_version),
        'mainQrSlug', v_main_qr.public_slug
    );
END;
$$;

-- Privileges
REVOKE ALL ON FUNCTION public.publish_site_draft_atomic(UUID, UUID, UUID, UUID, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.publish_site_draft_atomic(UUID, UUID, UUID, UUID, INT) FROM anon;

GRANT EXECUTE ON FUNCTION public.publish_site_draft_atomic(UUID, UUID, UUID, UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_site_draft_atomic(UUID, UUID, UUID, UUID, INT) TO service_role;

GRANT ALL ON TABLE public.site_domains TO service_role;
GRANT ALL ON TABLE public.qr_codes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.site_domains TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.qr_codes TO authenticated;
GRANT SELECT ON TABLE public.qr_codes TO anon;
