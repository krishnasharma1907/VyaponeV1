import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

describe("VO-032 Secure Media Upload Pipeline Migration", () => {
  const migrationPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20261118000003_secure_media_upload_pipeline.sql",
  );
  const combinedPath = path.join(process.cwd(), "supabase", "combined_migrations.sql");

  const migrationSql = fs.readFileSync(migrationPath, "utf-8");
  const combinedSql = fs.readFileSync(combinedPath, "utf-8");

  it("verifies migration file exists and has sufficient length", () => {
    expect(migrationSql.length).toBeGreaterThan(1000);
  });

  it("verifies public.media_items table schema and column types", () => {
    expect(migrationSql).toContain("CREATE TABLE IF NOT EXISTS public.media_items");
    expect(migrationSql).toContain("id UUID PRIMARY KEY DEFAULT gen_random_uuid()");
    expect(migrationSql).toContain(
      "business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE",
    );
    expect(migrationSql).toContain(
      "workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL",
    );
    expect(migrationSql).toContain("uploaded_by UUID NOT NULL REFERENCES public.users(id)");
    expect(migrationSql).toContain("category VARCHAR(32) NOT NULL");
    expect(migrationSql).toContain("bucket VARCHAR(64) NOT NULL");
    expect(migrationSql).toContain("object_key TEXT NOT NULL UNIQUE");
    expect(migrationSql).toContain("original_filename TEXT NOT NULL");
    expect(migrationSql).toContain("declared_content_type VARCHAR(128) NOT NULL");
    expect(migrationSql).toContain("detected_content_type VARCHAR(128)");
    expect(migrationSql).toContain("file_size_bytes BIGINT NOT NULL");
    expect(migrationSql).toContain("width INTEGER");
    expect(migrationSql).toContain("height INTEGER");
    expect(migrationSql).toContain("is_public BOOLEAN NOT NULL DEFAULT false");
    expect(migrationSql).toContain("status VARCHAR(32) NOT NULL DEFAULT 'pending_upload'");
    expect(migrationSql).toContain("metadata JSONB NOT NULL DEFAULT '{}'::jsonb");
    expect(migrationSql).toContain("expires_at TIMESTAMPTZ");
    expect(migrationSql).toContain("verified_at TIMESTAMPTZ");
    expect(migrationSql).toContain(
      "created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())",
    );
    expect(migrationSql).toContain(
      "updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())",
    );
  });

  it("verifies check constraints for categories, statuses and buckets", () => {
    expect(migrationSql).toContain("CONSTRAINT chk_media_items_category CHECK");
    expect(migrationSql).toContain("business_logo");
    expect(migrationSql).toContain("catalogue_image");
    expect(migrationSql).toContain("website_asset");
    expect(migrationSql).toContain("document_attachment");
    expect(migrationSql).toContain("onboarding_upload");

    expect(migrationSql).toContain("CONSTRAINT chk_media_items_status CHECK");
    expect(migrationSql).toContain("pending_upload");
    expect(migrationSql).toContain("ready");
    expect(migrationSql).toContain("failed");
    expect(migrationSql).toContain("archived");

    expect(migrationSql).toContain("CONSTRAINT chk_media_items_bucket CHECK");
    expect(migrationSql).toContain("vyapone-public-media");
    expect(migrationSql).toContain("vyapone-private-media");
  });

  it("verifies performance indexes for tenant scoping, object resolution and TTL", () => {
    expect(migrationSql).toContain("CREATE INDEX IF NOT EXISTS idx_media_items_business_status");
    expect(migrationSql).toContain("ON public.media_items (business_id, status)");

    expect(migrationSql).toContain("CREATE INDEX IF NOT EXISTS idx_media_items_object_key");
    expect(migrationSql).toContain("ON public.media_items (object_key)");

    expect(migrationSql).toContain("CREATE INDEX IF NOT EXISTS idx_media_items_category");
    expect(migrationSql).toContain("ON public.media_items (business_id, category)");

    expect(migrationSql).toContain("CREATE INDEX IF NOT EXISTS idx_media_items_expires_at");
    expect(migrationSql).toContain("ON public.media_items (expires_at)");
  });

  it("verifies fail-closed ROW LEVEL SECURITY and FORCE RLS", () => {
    expect(migrationSql).toContain("ALTER TABLE public.media_items ENABLE ROW LEVEL SECURITY;");
    expect(migrationSql).toContain("ALTER TABLE public.media_items FORCE ROW LEVEL SECURITY;");
  });

  it("verifies RLS policies for tenant isolation, public visibility and authoring", () => {
    expect(migrationSql).toContain('CREATE POLICY "media_items_select_policy"');
    expect(migrationSql).toContain('CREATE POLICY "media_items_insert_policy"');
    expect(migrationSql).toContain('CREATE POLICY "media_items_update_policy"');
    expect(migrationSql).toContain('CREATE POLICY "media_items_delete_policy"');

    // Tenant check
    expect(migrationSql).toContain("b.sovereign_owner_id = auth.uid()");
    expect(migrationSql).toContain("public.is_business_owner_or_manager(b.id, auth.uid())");
    expect(migrationSql).toContain("(is_public = true AND status = 'ready')");
  });

  it("verifies least-privilege grants and public revoke", () => {
    expect(migrationSql).toContain("REVOKE ALL ON public.media_items FROM PUBLIC;");
    expect(migrationSql).toContain("GRANT SELECT ON public.media_items TO anon;");
    expect(migrationSql).toContain(
      "GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_items TO authenticated;",
    );
    expect(migrationSql).toContain("GRANT ALL ON public.media_items TO service_role;");
  });

  it("verifies sync with supabase/combined_migrations.sql", () => {
    expect(combinedSql).toContain("CREATE TABLE IF NOT EXISTS public.media_items");
    expect(combinedSql).toContain("chk_media_items_category");
    expect(combinedSql).toContain("media_items_select_policy");
    expect(combinedSql).toContain("GRANT ALL ON public.media_items TO service_role;");
  });
});
