-- ==============================================================================
-- VyapOne — Media Quarantine and Public Publication Isolation [VO-032 Correction]
--
-- Enforces that ALL new uploads initially enter private storage (quarantine)
-- regardless of category. Public publication is a distinct, authorized operation
-- requiring readiness, verification, and explicit public bucket copying.
--
-- PRD Authority:
-- - PRD FINAL v2 §15.6: Media (Direct uploads, validation, tenant scoping, safe deletion)
-- - PRD FINAL v2 §17.1: Security Requirements (Private quarantine, upload isolation)
-- ==============================================================================

-- 1. Add published_at timestamp to track when verified media was explicitly made public
ALTER TABLE public.media_items
    ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- 2. Backfill existing public items (if any exist from earlier seeds or tests)
UPDATE public.media_items
SET published_at = COALESCE(verified_at, created_at)
WHERE is_public = true
  AND bucket = 'vyapone-public-media'
  AND published_at IS NULL;

-- 3. Replace chk_media_items_bucket_visibility with hardened check
-- Guarantees that:
-- - Any asset in vyapone-public-media MUST be verified (verified_at IS NOT NULL),
--   ready (status = 'ready'), explicitly published (published_at IS NOT NULL),
--   marked is_public = true, and belong to a publishable category ('business_logo',
--   'catalogue_image', 'website_asset'). Private categories ('document_attachment',
--   'onboarding_upload') can NEVER be public.
-- - Any asset in vyapone-private-media MUST have is_public = false and published_at IS NULL.
-- - Unverified files or pending uploads can NEVER be in vyapone-public-media.
ALTER TABLE public.media_items
    DROP CONSTRAINT IF EXISTS chk_media_items_bucket_visibility;

ALTER TABLE public.media_items
    ADD CONSTRAINT chk_media_items_bucket_visibility CHECK (
        (
            bucket = 'vyapone-public-media'
            AND is_public = true
            AND status = 'ready'
            AND verified_at IS NOT NULL
            AND published_at IS NOT NULL
            AND category IN ('business_logo', 'catalogue_image', 'website_asset')
        )
        OR
        (
            bucket = 'vyapone-private-media'
            AND is_public = false
            AND published_at IS NULL
        )
    );

-- 4. Partial index for fast lookup of published public assets
CREATE INDEX IF NOT EXISTS idx_media_items_published
    ON public.media_items (business_id, category)
    WHERE is_public = true;
