-- ==============================================================================
-- VyapOne — Business Onboarding Answers Schema [VO-031]
--
-- Persistent storage for niche-specific onboarding answers, draft progress,
-- missing-field state, and manifest versioning, isolated per tenant business.
--
-- PRD Authority:
-- - PRD FINAL v2 §7: Supported Business Niches (9 niche groups, onboarding questions)
-- - PRD FINAL v2 §14.2 / FR-03: Niche onboarding (preserve progress, conditional inputs)
-- - PRD FINAL v2 §16: Initial Data Model
-- - PRD FINAL v2 §17: Security & Tenant Isolation
-- ==============================================================================

-- 1. Business Onboarding Answers Table
CREATE TABLE IF NOT EXISTS public.business_onboarding_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    niche_slug VARCHAR(64) NOT NULL,
    manifest_version VARCHAR(16) NOT NULL DEFAULT 'v1',
    answers JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_complete BOOLEAN NOT NULL DEFAULT false,
    missing_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT uq_business_onboarding_answers_business UNIQUE (business_id)
);

CREATE INDEX IF NOT EXISTS idx_business_onboarding_answers_lookup
    ON public.business_onboarding_answers (business_id, is_complete);

CREATE INDEX IF NOT EXISTS idx_business_onboarding_answers_niche
    ON public.business_onboarding_answers (niche_slug);

-- 2. Row-Level Security Configuration
ALTER TABLE public.business_onboarding_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_onboarding_answers FORCE ROW LEVEL SECURITY;

-- Select Policy: Sovereign owner, business managers, or parent workspace admins
CREATE POLICY "business_onboarding_answers_select_policy"
    ON public.business_onboarding_answers
    FOR SELECT
    USING (
        auth.role() = 'service_role' OR
        EXISTS (
            SELECT 1 FROM public.businesses b
            WHERE b.id = business_onboarding_answers.business_id
              AND (
                  b.sovereign_owner_id = auth.uid() OR
                  public.is_business_owner_or_manager(b.id, auth.uid()) OR
                  (b.workspace_id IS NOT NULL AND public.is_workspace_admin_or_owner(b.workspace_id, auth.uid()))
              )
        )
    );

-- Insert Policy: Authorized business staff or sovereign owners
CREATE POLICY "business_onboarding_answers_insert_policy"
    ON public.business_onboarding_answers
    FOR INSERT
    WITH CHECK (
        auth.role() = 'service_role' OR
        EXISTS (
            SELECT 1 FROM public.businesses b
            WHERE b.id = business_onboarding_answers.business_id
              AND (
                  b.sovereign_owner_id = auth.uid() OR
                  public.is_business_owner_or_manager(b.id, auth.uid()) OR
                  (b.workspace_id IS NOT NULL AND public.is_workspace_admin_or_owner(b.workspace_id, auth.uid()))
              )
        )
    );

-- Update Policy: Authorized business staff or sovereign owners
CREATE POLICY "business_onboarding_answers_update_policy"
    ON public.business_onboarding_answers
    FOR UPDATE
    USING (
        auth.role() = 'service_role' OR
        EXISTS (
            SELECT 1 FROM public.businesses b
            WHERE b.id = business_onboarding_answers.business_id
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
            WHERE b.id = business_onboarding_answers.business_id
              AND (
                  b.sovereign_owner_id = auth.uid() OR
                  public.is_business_owner_or_manager(b.id, auth.uid()) OR
                  (b.workspace_id IS NOT NULL AND public.is_workspace_admin_or_owner(b.workspace_id, auth.uid()))
              )
        )
    );

-- Delete Policy: Sovereign owner or workspace admin
CREATE POLICY "business_onboarding_answers_delete_policy"
    ON public.business_onboarding_answers
    FOR DELETE
    USING (
        auth.role() = 'service_role' OR
        EXISTS (
            SELECT 1 FROM public.businesses b
            WHERE b.id = business_onboarding_answers.business_id
              AND (
                  b.sovereign_owner_id = auth.uid() OR
                  (b.workspace_id IS NOT NULL AND public.is_workspace_admin_or_owner(b.workspace_id, auth.uid()))
              )
        )
    );

-- Grant privileges strictly to authenticated and service_role
REVOKE ALL ON public.business_onboarding_answers FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_onboarding_answers TO authenticated;
GRANT ALL ON public.business_onboarding_answers TO service_role;
