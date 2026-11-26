-- VyapOne — Website Publishing, Custom Domains and Dynamic QR Migration [VO-049]
--
-- Migration: 20261122000003_website_publishing_domains_and_qr.sql
-- Invariants:
--   1. Atomic publication of site draft versions via public.publish_site_draft_atomic.
--   2. Consistent lock ordering (workspaces -> businesses -> sites FOR UPDATE OF s) preventing deadlocks.
--   3. Enforces canonical live_websites workspace plan capacity on draft-to-published transition
--      (subscriptions -> workspaces.plan + capacity_overrides.additional_capacity + distinct non-archived business count).
--   4. Sets transaction-local vyapone.in_atomic_site_transition = 'true' for trigger compliance.
--   5. Authenticated session caller verification and business/sovereign/workspace authorization check.
--   6. Optimistic concurrency check preventing publish of stale drafts (VY049).
--   7. Historical versions are strictly immutable; published_at timestamp is stamped.
--   8. public.site_domains table for custom domain verification lifecycle.
--   9. public.qr_codes table for permanent dynamic QR redirects with canonical { type: "storefront" } config.
--  10. Automatic provisioning of stable main storefront QR on publish returning mainQrCode row.
--  11. Logs audit event: site.published.

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
            WHERE b.id = site_domains.business_id
              AND b.sovereign_owner_id = auth.uid()
        ) OR EXISTS (
            SELECT 1 FROM public.businesses b
            JOIN public.workspace_members wm ON wm.workspace_id = b.workspace_id
            WHERE b.id = site_domains.business_id
              AND wm.user_id = auth.uid()
              AND wm.status = 'active'
        ) OR EXISTS (
            SELECT 1 FROM public.businesses b
            JOIN public.workspaces w ON w.id = b.workspace_id
            WHERE b.id = site_domains.business_id
              AND w.owner_user_id = auth.uid()
        )
    );

CREATE POLICY site_domains_insert_policy ON public.site_domains
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.sites s
            WHERE s.id = site_domains.site_id
              AND s.business_id = site_domains.business_id
        ) AND (
            EXISTS (
                SELECT 1 FROM public.business_members bm
                WHERE bm.business_id = site_domains.business_id
                  AND bm.user_id = auth.uid()
                  AND bm.role IN ('owner', 'manager')
                  AND bm.status = 'active'
            ) OR EXISTS (
                SELECT 1 FROM public.businesses b
                WHERE b.id = site_domains.business_id
                  AND b.sovereign_owner_id = auth.uid()
            ) OR EXISTS (
                SELECT 1 FROM public.businesses b
                JOIN public.workspace_members wm ON wm.workspace_id = b.workspace_id
                WHERE b.id = site_domains.business_id
                  AND wm.user_id = auth.uid()
                  AND wm.role IN ('workspace_owner', 'workspace_admin', 'reseller_admin')
                  AND wm.status = 'active'
            ) OR EXISTS (
                SELECT 1 FROM public.businesses b
                JOIN public.workspaces w ON w.id = b.workspace_id
                WHERE b.id = site_domains.business_id
                  AND w.owner_user_id = auth.uid()
            )
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
            WHERE b.id = site_domains.business_id
              AND b.sovereign_owner_id = auth.uid()
        ) OR EXISTS (
            SELECT 1 FROM public.businesses b
            JOIN public.workspace_members wm ON wm.workspace_id = b.workspace_id
            WHERE b.id = site_domains.business_id
              AND wm.user_id = auth.uid()
              AND wm.role IN ('workspace_owner', 'workspace_admin', 'reseller_admin')
              AND wm.status = 'active'
        ) OR EXISTS (
            SELECT 1 FROM public.businesses b
            JOIN public.workspaces w ON w.id = b.workspace_id
            WHERE b.id = site_domains.business_id
              AND w.owner_user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.sites s
            WHERE s.id = site_domains.site_id
              AND s.business_id = site_domains.business_id
        ) AND (
            EXISTS (
                SELECT 1 FROM public.business_members bm
                WHERE bm.business_id = site_domains.business_id
                  AND bm.user_id = auth.uid()
                  AND bm.role IN ('owner', 'manager')
                  AND bm.status = 'active'
            ) OR EXISTS (
                SELECT 1 FROM public.businesses b
                WHERE b.id = site_domains.business_id
                  AND b.sovereign_owner_id = auth.uid()
            ) OR EXISTS (
                SELECT 1 FROM public.businesses b
                JOIN public.workspace_members wm ON wm.workspace_id = b.workspace_id
                WHERE b.id = site_domains.business_id
                  AND wm.user_id = auth.uid()
                  AND wm.role IN ('workspace_owner', 'workspace_admin', 'reseller_admin')
                  AND wm.status = 'active'
            ) OR EXISTS (
                SELECT 1 FROM public.businesses b
                JOIN public.workspaces w ON w.id = b.workspace_id
                WHERE b.id = site_domains.business_id
                  AND w.owner_user_id = auth.uid()
            )
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
            WHERE b.id = site_domains.business_id
              AND b.sovereign_owner_id = auth.uid()
        ) OR EXISTS (
            SELECT 1 FROM public.businesses b
            JOIN public.workspace_members wm ON wm.workspace_id = b.workspace_id
            WHERE b.id = site_domains.business_id
              AND wm.user_id = auth.uid()
              AND wm.role IN ('workspace_owner', 'workspace_admin', 'reseller_admin')
              AND wm.status = 'active'
        ) OR EXISTS (
            SELECT 1 FROM public.businesses b
            JOIN public.workspaces w ON w.id = b.workspace_id
            WHERE b.id = site_domains.business_id
              AND w.owner_user_id = auth.uid()
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
    destination_configuration JSONB NOT NULL DEFAULT '{"type":"storefront"}'::jsonb,
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
            WHERE b.id = qr_codes.business_id
              AND b.sovereign_owner_id = auth.uid()
        ) OR EXISTS (
            SELECT 1 FROM public.businesses b
            JOIN public.workspace_members wm ON wm.workspace_id = b.workspace_id
            WHERE b.id = qr_codes.business_id
              AND wm.user_id = auth.uid()
              AND wm.status = 'active'
        ) OR EXISTS (
            SELECT 1 FROM public.businesses b
            JOIN public.workspaces w ON w.id = b.workspace_id
            WHERE b.id = qr_codes.business_id
              AND w.owner_user_id = auth.uid()
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
            WHERE b.id = qr_codes.business_id
              AND b.sovereign_owner_id = auth.uid()
        ) OR EXISTS (
            SELECT 1 FROM public.businesses b
            JOIN public.workspace_members wm ON wm.workspace_id = b.workspace_id
            WHERE b.id = qr_codes.business_id
              AND wm.user_id = auth.uid()
              AND wm.role IN ('workspace_owner', 'workspace_admin', 'reseller_admin')
              AND wm.status = 'active'
        ) OR EXISTS (
            SELECT 1 FROM public.businesses b
            JOIN public.workspaces w ON w.id = b.workspace_id
            WHERE b.id = qr_codes.business_id
              AND w.owner_user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.sites s
            WHERE s.id = qr_codes.site_id
              AND s.business_id = qr_codes.business_id
        ) AND (
            EXISTS (
                SELECT 1 FROM public.business_members bm
                WHERE bm.business_id = qr_codes.business_id
                  AND bm.user_id = auth.uid()
                  AND bm.role IN ('owner', 'manager')
                  AND bm.status = 'active'
            ) OR EXISTS (
                SELECT 1 FROM public.businesses b
                WHERE b.id = qr_codes.business_id
                  AND b.sovereign_owner_id = auth.uid()
            ) OR EXISTS (
                SELECT 1 FROM public.businesses b
                JOIN public.workspace_members wm ON wm.workspace_id = b.workspace_id
                WHERE b.id = qr_codes.business_id
                  AND wm.user_id = auth.uid()
                  AND wm.role IN ('workspace_owner', 'workspace_admin', 'reseller_admin')
                  AND wm.status = 'active'
            ) OR EXISTS (
                SELECT 1 FROM public.businesses b
                JOIN public.workspaces w ON w.id = b.workspace_id
                WHERE b.id = qr_codes.business_id
                  AND w.owner_user_id = auth.uid()
            )
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
    v_business_has_published BOOLEAN := FALSE;
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

    -- 3. Acquire locks in canonical workspace -> business -> site order (serializes concurrent operations)
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
        RAISE EXCEPTION 'Cannot publish site for an archived business' USING ERRCODE = 'VY002';
    END IF;

    -- 4. Verify Authorization (Business Owner/Manager, Sovereign Owner, or Workspace Admin/Owner)
    IF NOT EXISTS (
        SELECT 1 FROM public.business_members
        WHERE business_id = p_business_id
          AND user_id = p_caller_user_id
          AND role IN ('owner', 'manager')
          AND status = 'active'
    ) AND NOT EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = v_workspace_id
          AND wm.user_id = p_caller_user_id
          AND wm.role IN ('workspace_owner', 'workspace_admin', 'reseller_admin')
          AND wm.status = 'active'
    ) AND NOT EXISTS (
        SELECT 1 FROM public.workspaces w
        WHERE w.id = v_workspace_id
          AND w.owner_user_id = p_caller_user_id
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

    -- Optimistic concurrency check on draft version (reject NULL bypass)
    IF p_expected_draft_version_number IS NULL THEN
        RAISE EXCEPTION 'Publish conflict: expected draft version number is required'
            USING ERRCODE = 'VY049';
    END IF;
    IF p_expected_draft_version_number IS NOT NULL AND
       v_target_version.version_number <> p_expected_draft_version_number THEN
        RAISE EXCEPTION 'Publish conflict: target draft version (%) does not match expected version (%)',
            v_target_version.version_number, p_expected_draft_version_number USING ERRCODE = 'VY049';
    END IF;

    -- 6. Enforce Plan Capacity (if transitioning from draft/non-published to published)
    -- If site is ALREADY published (republishing updated draft), capacity was already accounted for.
    IF v_site.status <> 'published' AND v_workspace_id IS NOT NULL THEN
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

        -- Null-safe capacity override lookup (0 rows must resolve to 0, never NULL)
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

        -- Count distinct non-archived live businesses in workspace (PRD §9.2)
        SELECT pg_catalog.count(DISTINCT s2.business_id)::INT INTO v_current_live_count
        FROM public.sites s2
        JOIN public.businesses b2 ON b2.id = s2.business_id
        WHERE b2.workspace_id = v_workspace_id
          AND b2.status <> 'archived'
          AND s2.status = 'published';

        -- Account for whether this business already has another published site (slot replacement)
        SELECT EXISTS (
            SELECT 1
            FROM public.sites s2
            WHERE s2.business_id = p_business_id
              AND s2.status = 'published'
              AND s2.id <> p_site_id
        ) INTO v_business_has_published;

        IF v_business_has_published THEN
            IF v_current_live_count > v_effective_limit THEN
                RAISE EXCEPTION 'Capacity limit reached for live_websites: workspace exceeds plan allowance (% max)', v_effective_limit
                    USING ERRCODE = 'VY001';
            END IF;

            -- Demote prior published site of this business atomically before publishing target site
            PERFORM pg_catalog.set_config('vyapone.in_atomic_site_transition', 'true', true);
            UPDATE public.sites
            SET status = 'draft',
                updated_at = v_now
            WHERE business_id = p_business_id
              AND status = 'published'
              AND id <> p_site_id;
        ELSE
            IF (v_current_live_count + 1) > v_effective_limit THEN
                RAISE EXCEPTION 'Capacity limit reached for live_websites: workspace exceeds plan allowance (% max)', v_effective_limit
                    USING ERRCODE = 'VY001';
            END IF;
        END IF;
    END IF;

    -- 7. Update Target Version: Stamp published_at if not already stamped
    IF v_target_version.published_at IS NULL THEN
        UPDATE public.site_versions
        SET published_at = v_now
        WHERE id = p_target_version_id
        RETURNING * INTO v_target_version;
    END IF;

    -- 8. Set transaction-scoped trigger guard and update Site Record
    PERFORM pg_catalog.set_config('vyapone.in_atomic_site_transition', 'true', true);

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
    SELECT *
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
            pg_catalog.jsonb_build_object('type', 'storefront'),
            'active',
            v_now,
            v_now
        )
        RETURNING *
        INTO v_main_qr;
    END IF;

    -- 10. Audit Log Entry
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
        'site.published',
        'site',
        pg_catalog.jsonb_build_object(
            'site_id', p_site_id,
            'version_id', v_target_version.id,
            'version_number', v_target_version.version_number,
            'subdomain', v_updated_site.subdomain,
            'primary_domain', v_updated_site.primary_domain,
            'qr_slug', v_main_qr.public_slug
        ),
        NULL,
        v_now
    );

    RETURN pg_catalog.jsonb_build_object(
        'site', pg_catalog.row_to_json(v_updated_site),
        'publishedVersion', pg_catalog.row_to_json(v_target_version),
        'mainQrCode', pg_catalog.row_to_json(v_main_qr)
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
