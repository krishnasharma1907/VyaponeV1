-- ==============================================================================
-- VyapOne — Website Configuration Schema & Site Versions [VO-040]
--
-- Introduces:
-- 1. Security Preflight: Revokes service_role execute grants on atomic creation RPCs,
--    enforcing that normal application creations strictly require an authenticated caller.
-- 2. Public table: public.site_versions for immutable, versioned, structured website configurations.
-- 3. Column updates: current_draft_version_id and published_version_id foreign keys on public.sites.
-- 4. Defense-in-depth: Immutability triggers ensuring historical versions cannot be tampered with.
-- 5. Multi-tenant RLS: Enforces strict tenant isolation across workspaces, businesses, and public viewing.
--
-- PRD Authority:
-- - PRD FINAL v2 §6.14: Builder mode — validated JSON site configuration from approved blocks
-- - PRD FINAL v2 §15.3: Builder representation — site metadata, theme tokens, pages, ordered sections
-- - PRD FINAL v2 §16: Initial Data Model — Site and SiteVersion
-- - PRD FINAL v2 §17: Security and Tenant Isolation
-- ==============================================================================

-- -----------------------------------------------------------------------------
-- 1. Security Preflight: Revoke service_role execution on atomic creation RPCs
-- -----------------------------------------------------------------------------
-- Normal application requests run under the authenticated user session.
-- Revoking service_role ensures no unverified server context can spoof p_caller_user_id.
REVOKE EXECUTE ON FUNCTION public.create_business_with_setup_atomic(
    UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB,
    TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, UUID[], TEXT, JSONB, BOOLEAN, JSONB, TEXT[]
) FROM service_role;

REVOKE EXECUTE ON FUNCTION public.confirm_business_import_atomic(
    UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB,
    TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT[], JSONB, INT
) FROM service_role;

-- -----------------------------------------------------------------------------
-- 2. Create public.site_versions Table
-- -----------------------------------------------------------------------------
CREATE TABLE public.site_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    version_number INT NOT NULL CHECK (version_number > 0),
    schema_version TEXT NOT NULL DEFAULT 'v1',
    configuration JSONB NOT NULL,
    change_summary TEXT,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at TIMESTAMPTZ,
    CONSTRAINT uq_site_versions_site_version UNIQUE (site_id, version_number)
);

-- -----------------------------------------------------------------------------
-- 3. Update public.sites with Draft & Published Version Foreign Keys
-- -----------------------------------------------------------------------------
ALTER TABLE public.sites 
    ADD COLUMN IF NOT EXISTS current_draft_version_id UUID REFERENCES public.site_versions(id) ON DELETE SET NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fk_sites_published_version' AND conrelid = 'public.sites'::regclass
    ) THEN
        ALTER TABLE public.sites 
            ADD CONSTRAINT fk_sites_published_version 
            FOREIGN KEY (published_version_id) REFERENCES public.site_versions(id) ON DELETE SET NULL;
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 4. Indexes for Site Versions
-- -----------------------------------------------------------------------------
CREATE INDEX idx_site_versions_site_id ON public.site_versions (site_id);
CREATE INDEX idx_site_versions_business_id ON public.site_versions (business_id);
CREATE INDEX idx_site_versions_site_version_desc ON public.site_versions (site_id, version_number DESC);
CREATE INDEX idx_site_versions_published ON public.site_versions (site_id, published_at DESC) WHERE published_at IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 5. Immutability Trigger for Site Versions (PRD Rollback & Audit Integrity)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_site_version_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        -- Only published_at is permitted to transition from NULL to timestamp
        IF OLD.site_id <> NEW.site_id OR
           OLD.business_id <> NEW.business_id OR
           OLD.version_number <> NEW.version_number OR
           OLD.schema_version <> NEW.schema_version OR
           OLD.configuration <> NEW.configuration OR
           OLD.created_at <> NEW.created_at OR
           (OLD.published_at IS NOT NULL AND NEW.published_at IS DISTINCT FROM OLD.published_at) THEN
            RAISE EXCEPTION 'Historical site versions are immutable' USING ERRCODE = 'VY040';
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- Published site versions cannot be deleted
        IF OLD.published_at IS NOT NULL THEN
            RAISE EXCEPTION 'Cannot delete a published site version' USING ERRCODE = 'VY040';
        END IF;
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_site_version_modification ON public.site_versions;
CREATE TRIGGER trg_prevent_site_version_modification
    BEFORE UPDATE OR DELETE ON public.site_versions
    FOR EACH ROW EXECUTE FUNCTION public.prevent_site_version_modification();

-- -----------------------------------------------------------------------------
-- 6. Row-Level Security on public.site_versions
-- -----------------------------------------------------------------------------
ALTER TABLE public.site_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_versions FORCE ROW LEVEL SECURITY;

-- 6.1 SELECT Policy: Public can view published versions of published sites;
-- Authorized members/owners can view all versions of their sites.
DROP POLICY IF EXISTS "site_versions_select_policy" ON public.site_versions;
CREATE POLICY "site_versions_select_policy" ON public.site_versions
FOR SELECT TO authenticated, anon
USING (
    -- Public storefront: published site version of a published storefront
    (published_at IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.sites s
        WHERE s.id = site_versions.site_id AND s.status = 'published'
    ))
    OR
    -- Authenticated tenant members
    (auth.uid() IS NOT NULL AND (
        EXISTS (
            SELECT 1 FROM public.business_members bm
            WHERE bm.business_id = site_versions.business_id
              AND bm.user_id = auth.uid()
              AND bm.status = 'active'
        )
        OR
        EXISTS (
            SELECT 1 FROM public.businesses b
            WHERE b.id = site_versions.business_id
              AND b.sovereign_owner_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM public.businesses b
            JOIN public.workspace_members wm ON wm.workspace_id = b.workspace_id
            WHERE b.id = site_versions.business_id
              AND wm.user_id = auth.uid()
              AND wm.role IN ('workspace_owner', 'workspace_admin', 'reseller_admin')
        )
    ))
);

-- 6.2 INSERT Policy: Only authorized business managers or workspace admins
DROP POLICY IF EXISTS "site_versions_insert_policy" ON public.site_versions;
CREATE POLICY "site_versions_insert_policy" ON public.site_versions
FOR INSERT TO authenticated
WITH CHECK (
    auth.uid() IS NOT NULL AND (
        EXISTS (
            SELECT 1 FROM public.business_members bm
            WHERE bm.business_id = site_versions.business_id
              AND bm.user_id = auth.uid()
              AND bm.role IN ('owner', 'manager')
              AND bm.status = 'active'
        )
        OR
        EXISTS (
            SELECT 1 FROM public.businesses b
            WHERE b.id = site_versions.business_id
              AND b.sovereign_owner_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM public.businesses b
            JOIN public.workspace_members wm ON wm.workspace_id = b.workspace_id
            WHERE b.id = site_versions.business_id
              AND wm.user_id = auth.uid()
              AND wm.role IN ('workspace_owner', 'workspace_admin', 'reseller_admin')
        )
    )
);

-- 6.3 DELETE Policy: Draft versions may be deleted only by business owners or workspace owners
DROP POLICY IF EXISTS "site_versions_delete_policy" ON public.site_versions;
CREATE POLICY "site_versions_delete_policy" ON public.site_versions
FOR DELETE TO authenticated
USING (
    auth.uid() IS NOT NULL AND (
        EXISTS (
            SELECT 1 FROM public.business_members bm
            WHERE bm.business_id = site_versions.business_id
              AND bm.user_id = auth.uid()
              AND bm.role = 'owner'
              AND bm.status = 'active'
        )
        OR
        EXISTS (
            SELECT 1 FROM public.businesses b
            WHERE b.id = site_versions.business_id
              AND b.sovereign_owner_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM public.businesses b
            JOIN public.workspace_members wm ON wm.workspace_id = b.workspace_id
            WHERE b.id = site_versions.business_id
              AND wm.user_id = auth.uid()
              AND wm.role IN ('workspace_owner', 'workspace_admin', 'reseller_admin')
        )
    )
);

-- -----------------------------------------------------------------------------
-- 7. Scoped Grants & Permissions
-- -----------------------------------------------------------------------------
REVOKE ALL ON public.site_versions FROM PUBLIC, anon;

GRANT SELECT ON public.site_versions TO authenticated, anon;
GRANT INSERT, DELETE ON public.site_versions TO authenticated;
GRANT ALL ON public.site_versions TO service_role;

-- Grant column-level access on public.sites for current_draft_version_id
GRANT INSERT (current_draft_version_id) ON public.sites TO authenticated;
GRANT UPDATE (current_draft_version_id) ON public.sites TO authenticated;
