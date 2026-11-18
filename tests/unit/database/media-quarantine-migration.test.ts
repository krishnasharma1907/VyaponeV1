/**
 * VyapOne — Media Quarantine & Publication Migration Verification [VO-032 Correction]
 */

import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

describe("VO-032 Migration 20261118000005: Media Quarantine and Publication Isolation", () => {
  const migrationPath = join(
    process.cwd(),
    "supabase/migrations/20261118000005_media_quarantine_and_publication.sql",
  );
  const combinedPath = join(process.cwd(), "supabase/combined_migrations.sql");

  const migrationSql = readFileSync(migrationPath, "utf8");
  const combinedSql = readFileSync(combinedPath, "utf8");

  it("adds published_at timestamp to public.media_items", () => {
    expect(migrationSql).toContain("ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ");
    expect(combinedSql).toContain("ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ");
  });

  it("backfills existing public items with verified_at or created_at", () => {
    expect(migrationSql).toContain("UPDATE public.media_items");
    expect(migrationSql).toContain("SET published_at = COALESCE(verified_at, created_at)");
    expect(migrationSql).toContain("WHERE is_public = true");
  });

  it("hardens chk_media_items_bucket_visibility to enforce public requirements strictly", () => {
    expect(migrationSql).toContain("chk_media_items_bucket_visibility");
    expect(migrationSql).toContain("bucket = 'vyapone-public-media'");
    expect(migrationSql).toContain("is_public = true");
    expect(migrationSql).toContain("status = 'ready'");
    expect(migrationSql).toContain("verified_at IS NOT NULL");
    expect(migrationSql).toContain("published_at IS NOT NULL");
    expect(migrationSql).toContain(
      "category IN ('business_logo', 'catalogue_image', 'website_asset')",
    );
  });

  it("enforces that private assets have is_public=false and published_at IS NULL", () => {
    expect(migrationSql).toContain("bucket = 'vyapone-private-media'");
    expect(migrationSql).toContain("is_public = false");
    expect(migrationSql).toContain("published_at IS NULL");
  });

  it("creates a partial index for published media items", () => {
    expect(migrationSql).toContain("CREATE INDEX IF NOT EXISTS idx_media_items_published");
    expect(migrationSql).toContain("ON public.media_items (business_id, category)");
    expect(migrationSql).toContain("WHERE is_public = true");
  });

  it("is fully synchronized in supabase/combined_migrations.sql", () => {
    expect(combinedSql).toContain("chk_media_items_bucket_visibility CHECK");
    expect(combinedSql).toContain("published_at TIMESTAMPTZ");
    expect(combinedSql).toContain("idx_media_items_published");
  });
});
