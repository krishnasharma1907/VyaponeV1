-- ==============================================================================
-- VyapOne — Harden Media Items Security and Integrity [VO-032 Audit]
--
-- Restricts media metadata write privileges to service-role only,
-- enforces bucket/visibility consistency, adds deletion_pending status,
-- and prevents accidental orphaned storage objects on business deletion.
--
-- PRD Authority:
-- - PRD FINAL v2 §15.6: Media (Direct uploads, validation, tenant scoping, safe deletion)
-- - PRD FINAL v2 §17.1: Security Requirements (Server authorization, tenant isolation)
-- - VO-032 Audit: Privilege separation and upload lifecycle integrity
-- ==============================================================================

-- 1. Update status check constraint to include 'deletion_pending'
ALTER TABLE public.media_items
    DROP CONSTRAINT IF EXISTS chk_media_items_status;

ALTER TABLE public.media_items
    ADD CONSTRAINT chk_media_items_status CHECK (
        status IN ('pending_upload', 'ready', 'failed', 'deletion_pending', 'archived')
    );

-- 2. Add bucket and visibility consistency check
-- Ensures public bucket strictly contains is_public=true assets,
-- and private bucket strictly contains is_public=false assets.
ALTER TABLE public.media_items
    DROP CONSTRAINT IF EXISTS chk_media_items_bucket_visibility;

ALTER TABLE public.media_items
    ADD CONSTRAINT chk_media_items_bucket_visibility CHECK (
        (bucket = 'vyapone-public-media' AND is_public = true) OR
        (bucket = 'vyapone-private-media' AND is_public = false)
    );

-- 3. Prevent accidental orphaned storage objects on business deletion
-- Change ON DELETE CASCADE to ON DELETE RESTRICT on business_id.
-- A business with active or pending media items cannot be deleted without
-- explicit storage teardown / archiving.
ALTER TABLE public.media_items
    DROP CONSTRAINT IF EXISTS media_items_business_id_fkey;

ALTER TABLE public.media_items
    ADD CONSTRAINT media_items_business_id_fkey
    FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE RESTRICT;

-- 4. Index for deletion reconciliation and cleanup
CREATE INDEX IF NOT EXISTS idx_media_items_deletion_pending
    ON public.media_items (business_id, status)
    WHERE status = 'deletion_pending';

-- 5. Revoke direct write privileges from authenticated and anon
-- Authenticated clients receive SELECT only (subject to tenant RLS).
-- All writes (inserting pending items, finalizing verification, deletion lifecycle)
-- must be executed by trusted server-side procedures using the service-role client.
REVOKE INSERT, UPDATE, DELETE ON public.media_items FROM authenticated;
REVOKE ALL ON public.media_items FROM PUBLIC;
GRANT SELECT ON public.media_items TO anon;
GRANT SELECT ON public.media_items TO authenticated;
GRANT ALL ON public.media_items TO service_role;

-- 6. Harden RLS policies for writes to fail-closed (service-role only)
DROP POLICY IF EXISTS "media_items_insert_policy" ON public.media_items;
CREATE POLICY "media_items_insert_policy"
    ON public.media_items
    FOR INSERT
    WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "media_items_update_policy" ON public.media_items;
CREATE POLICY "media_items_update_policy"
    ON public.media_items
    FOR UPDATE
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "media_items_delete_policy" ON public.media_items;
CREATE POLICY "media_items_delete_policy"
    ON public.media_items
    FOR DELETE
    USING (auth.role() = 'service_role');
