-- ==============================================================================
-- VyapOne — Secure Media Upload Pipeline Schema [VO-032]
--
-- Direct-to-storage media management, tenant-isolated object storage paths,
-- category-scoped upload limits, content verification, and safe deletion.
--
-- PRD Authority:
-- - PRD FINAL v2 §15.6: Media (Direct uploads, validation, tenant scoping, safe deletion)
-- - PRD FINAL v2 §16: Initial Data Model
-- - PRD FINAL v2 §17.1: Security Requirements (Server authorization, tenant isolation)
-- - ADR-003: Storage candidate & facade abstraction
-- ==============================================================================

-- 1. Create Media Items Table
CREATE TABLE IF NOT EXISTS public.media_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
    uploaded_by UUID NOT NULL REFERENCES public.users(id),
    category VARCHAR(32) NOT NULL,
    bucket VARCHAR(64) NOT NULL,
    object_key TEXT NOT NULL UNIQUE,
    original_filename TEXT NOT NULL,
    declared_content_type VARCHAR(128) NOT NULL,
    detected_content_type VARCHAR(128),
    file_size_bytes BIGINT NOT NULL,
    width INTEGER,
    height INTEGER,
    is_public BOOLEAN NOT NULL DEFAULT false,
    status VARCHAR(32) NOT NULL DEFAULT 'pending_upload',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    expires_at TIMESTAMPTZ,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT chk_media_items_category CHECK (
        category IN ('business_logo', 'catalogue_image', 'website_asset', 'document_attachment', 'onboarding_upload')
    ),
    CONSTRAINT chk_media_items_status CHECK (
        status IN ('pending_upload', 'ready', 'failed', 'archived')
    ),
    CONSTRAINT chk_media_items_bucket CHECK (
        bucket IN ('vyapone-public-media', 'vyapone-private-media')
    )
);

-- 2. Indexes for tenant lookup, object key resolution and lifecycle management
CREATE INDEX IF NOT EXISTS idx_media_items_business_status
    ON public.media_items (business_id, status);

CREATE INDEX IF NOT EXISTS idx_media_items_object_key
    ON public.media_items (object_key);

CREATE INDEX IF NOT EXISTS idx_media_items_category
    ON public.media_items (business_id, category);

CREATE INDEX IF NOT EXISTS idx_media_items_expires_at
    ON public.media_items (expires_at)
    WHERE status = 'pending_upload';

-- 3. Row-Level Security Configuration (Fail-Closed)
ALTER TABLE public.media_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_items FORCE ROW LEVEL SECURITY;

-- Select Policy:
-- - Platform service role has administrative access.
-- - Public ready assets (e.g. published website images, logos) are viewable publicly.
-- - Sovereign business owners, business managers, or parent workspace admins have full read access.
CREATE POLICY "media_items_select_policy"
    ON public.media_items
    FOR SELECT
    USING (
        auth.role() = 'service_role' OR
        (is_public = true AND status = 'ready') OR
        EXISTS (
            SELECT 1 FROM public.businesses b
            WHERE b.id = media_items.business_id
              AND (
                  b.sovereign_owner_id = auth.uid() OR
                  public.is_business_owner_or_manager(b.id, auth.uid()) OR
                  (b.workspace_id IS NOT NULL AND public.is_workspace_admin_or_owner(b.workspace_id, auth.uid()))
              )
        )
    );

-- Insert Policy:
-- - Service role or authorized business owner/manager who is the uploader.
CREATE POLICY "media_items_insert_policy"
    ON public.media_items
    FOR INSERT
    WITH CHECK (
        auth.role() = 'service_role' OR
        (
            uploaded_by = auth.uid() AND
            EXISTS (
                SELECT 1 FROM public.businesses b
                WHERE b.id = media_items.business_id
                  AND (
                      b.sovereign_owner_id = auth.uid() OR
                      public.is_business_owner_or_manager(b.id, auth.uid()) OR
                      (b.workspace_id IS NOT NULL AND public.is_workspace_admin_or_owner(b.workspace_id, auth.uid()))
                  )
            )
        )
    );

-- Update Policy:
-- - Service role or authorized business owner/manager.
CREATE POLICY "media_items_update_policy"
    ON public.media_items
    FOR UPDATE
    USING (
        auth.role() = 'service_role' OR
        EXISTS (
            SELECT 1 FROM public.businesses b
            WHERE b.id = media_items.business_id
              AND (
                  b.sovereign_owner_id = auth.uid() OR
                  public.is_business_owner_or_manager(b.id, auth.uid()) OR
                  (b.workspace_id IS NOT NULL AND public.is_workspace_admin_or_owner(b.workspace_id, auth.uid()))
              )
        )
    )
    WITH CHECK (
        auth.role() = 'service_role' OR
        EXISTS (
            SELECT 1 FROM public.businesses b
            WHERE b.id = media_items.business_id
              AND (
                  b.sovereign_owner_id = auth.uid() OR
                  public.is_business_owner_or_manager(b.id, auth.uid()) OR
                  (b.workspace_id IS NOT NULL AND public.is_workspace_admin_or_owner(b.workspace_id, auth.uid()))
              )
        )
    );

-- Delete Policy:
-- - Service role or sovereign business owner / manager / workspace admin.
CREATE POLICY "media_items_delete_policy"
    ON public.media_items
    FOR DELETE
    USING (
        auth.role() = 'service_role' OR
        EXISTS (
            SELECT 1 FROM public.businesses b
            WHERE b.id = media_items.business_id
              AND (
                  b.sovereign_owner_id = auth.uid() OR
                  public.is_business_owner_or_manager(b.id, auth.uid()) OR
                  (b.workspace_id IS NOT NULL AND public.is_workspace_admin_or_owner(b.workspace_id, auth.uid()))
              )
        )
    );

-- 4. Grant privileges strictly to authenticated and service_role, read-only for anon (on public items)
REVOKE ALL ON public.media_items FROM PUBLIC;
GRANT SELECT ON public.media_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_items TO authenticated;
GRANT ALL ON public.media_items TO service_role;
