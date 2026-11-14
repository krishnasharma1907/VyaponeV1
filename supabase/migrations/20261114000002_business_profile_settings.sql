-- ==============================================================================
-- VyapOne — Business Profile Settings & Tenant Isolation Hardening
-- Migration: 20261114000002_business_profile_settings.sql
-- Authority: reference/PRD_VERSIONS/PRD_FINAL_v2_2026-11-03.md (§4, §16, §17)
-- Task: VO-025
--
-- Scope:
--   1. Expand public.businesses with category, description, localization,
--      tax scheme, contacts, timings, and facts provenance.
--   2. Enforce VO-024 security review gate fixes:
--      - audit_logs_insert_policy tenant scope validation.
--      - businesses_update_policy sovereign ownership immutability.
--      - catalogue_items_select_policy published site boundary scoping.
-- ==============================================================================

-- 1. Expand public.businesses with business profile fields
ALTER TABLE public.businesses
    ADD COLUMN IF NOT EXISTS category TEXT,
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS preferred_language TEXT NOT NULL DEFAULT 'en',
    ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    ADD COLUMN IF NOT EXISTS tax_scheme TEXT NOT NULL DEFAULT 'unregistered'
        CHECK (tax_scheme IN ('registered', 'composition', 'unregistered', 'exempt')),
    ADD COLUMN IF NOT EXISTS contact_configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS address_configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS timings_configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS facts_provenance JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 2. Performance index for industry/category searches
CREATE INDEX IF NOT EXISTS idx_businesses_category ON public.businesses (category);

-- 3. VO-024 Security Gate Fix 1: Audit Log Tenant Scope Isolation
-- Ensures an actor cannot insert audit records targeting an unrelated business or workspace
DROP POLICY IF EXISTS "audit_logs_insert_policy" ON public.audit_logs;
CREATE POLICY "audit_logs_insert_policy" ON public.audit_logs
    FOR INSERT
    WITH CHECK (
        auth.uid() IS NOT NULL AND
        (user_id IS NULL OR user_id = auth.uid()) AND
        (business_id IS NULL OR public.can_access_business(business_id, auth.uid())) AND
        (workspace_id IS NULL OR public.is_workspace_member(workspace_id, auth.uid()))
    );

-- 4. VO-024 Security Gate Fix 2: Sovereign Ownership & Workspace Immutability
-- Prohibits operational managers or callers from reassigning sovereign_owner_id or moving workspaces
DROP POLICY IF EXISTS "businesses_update_policy" ON public.businesses;
CREATE POLICY "businesses_update_policy" ON public.businesses
    FOR UPDATE
    USING (
        sovereign_owner_id = auth.uid() OR
        public.is_business_owner_or_manager(id, auth.uid())
    )
    WITH CHECK (
        -- sovereign_owner_id cannot be tampered with or reassigned during business updates
        sovereign_owner_id = (SELECT b.sovereign_owner_id FROM public.businesses b WHERE b.id = public.businesses.id) AND
        (
            (workspace_id IS NULL AND (SELECT b.workspace_id FROM public.businesses b WHERE b.id = public.businesses.id) IS NULL) OR
            (workspace_id = (SELECT b.workspace_id FROM public.businesses b WHERE b.id = public.businesses.id))
        ) AND
        (
            sovereign_owner_id = auth.uid() OR
            public.is_business_owner_or_manager(id, auth.uid())
        )
    );

-- 5. VO-024 Security Gate Fix 3: Catalogue Exposure Bounded to Published Sites
-- Prevents unauthenticated global table scraping across all tenant businesses
DROP POLICY IF EXISTS "catalogue_items_select_policy" ON public.catalogue_items;
CREATE POLICY "catalogue_items_select_policy" ON public.catalogue_items
    FOR SELECT
    USING (
        public.can_access_business(business_id, auth.uid()) OR
        (
            is_available = true AND
            EXISTS (
                SELECT 1 FROM public.sites s
                WHERE s.business_id = public.catalogue_items.business_id
                  AND s.status = 'published'
            )
        )
    );
