import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

describe("VO-031 Business Onboarding Answers Migration", () => {
  const migrationPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20261118000002_business_onboarding_answers.sql",
  );
  const combinedPath = path.join(process.cwd(), "supabase", "combined_migrations.sql");

  const migrationSql = fs.readFileSync(migrationPath, "utf-8");
  const combinedSql = fs.readFileSync(combinedPath, "utf-8");

  it("verifies migration file exists and is populated", () => {
    expect(migrationSql.length).toBeGreaterThan(500);
  });

  it("verifies public.business_onboarding_answers table schema", () => {
    expect(migrationSql).toContain("CREATE TABLE IF NOT EXISTS public.business_onboarding_answers");
    expect(migrationSql).toContain("id UUID PRIMARY KEY DEFAULT gen_random_uuid()");
    expect(migrationSql).toContain(
      "business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE",
    );
    expect(migrationSql).toContain("niche_slug VARCHAR(64) NOT NULL");
    expect(migrationSql).toContain("manifest_version VARCHAR(16) NOT NULL DEFAULT 'v1'");
    expect(migrationSql).toContain("answers JSONB NOT NULL DEFAULT '{}'::jsonb");
    expect(migrationSql).toContain("is_complete BOOLEAN NOT NULL DEFAULT false");
    expect(migrationSql).toContain("missing_fields JSONB NOT NULL DEFAULT '[]'::jsonb");
    expect(migrationSql).toContain(
      "CONSTRAINT uq_business_onboarding_answers_business UNIQUE (business_id)",
    );
  });

  it("verifies performance indexes for lookup and reporting", () => {
    expect(migrationSql).toContain(
      "CREATE INDEX IF NOT EXISTS idx_business_onboarding_answers_lookup",
    );
    expect(migrationSql).toContain(
      "ON public.business_onboarding_answers (business_id, is_complete)",
    );
    expect(migrationSql).toContain(
      "CREATE INDEX IF NOT EXISTS idx_business_onboarding_answers_niche",
    );
    expect(migrationSql).toContain("ON public.business_onboarding_answers (niche_slug)");
  });

  it("verifies fail-closed ROW LEVEL SECURITY and FORCE RLS", () => {
    expect(migrationSql).toContain(
      "ALTER TABLE public.business_onboarding_answers ENABLE ROW LEVEL SECURITY;",
    );
    expect(migrationSql).toContain(
      "ALTER TABLE public.business_onboarding_answers FORCE ROW LEVEL SECURITY;",
    );
  });

  it("verifies RLS policies for tenant isolation", () => {
    expect(migrationSql).toContain('CREATE POLICY "business_onboarding_answers_select_policy"');
    expect(migrationSql).toContain('CREATE POLICY "business_onboarding_answers_insert_policy"');
    expect(migrationSql).toContain('CREATE POLICY "business_onboarding_answers_update_policy"');
    expect(migrationSql).toContain('CREATE POLICY "business_onboarding_answers_delete_policy"');

    // Sovereign owner or manager check
    expect(migrationSql).toContain("b.sovereign_owner_id = auth.uid()");
    expect(migrationSql).toContain("public.is_business_owner_or_manager(b.id, auth.uid())");
  });

  it("verifies least-privilege grants and public revoke", () => {
    expect(migrationSql).toContain(
      "REVOKE ALL ON public.business_onboarding_answers FROM PUBLIC, anon;",
    );
    expect(migrationSql).toContain(
      "GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_onboarding_answers TO authenticated;",
    );
    expect(migrationSql).toContain(
      "GRANT ALL ON public.business_onboarding_answers TO service_role;",
    );
  });

  it("verifies sync with supabase/combined_migrations.sql", () => {
    expect(combinedSql).toContain("CREATE TABLE IF NOT EXISTS public.business_onboarding_answers");
    expect(combinedSql).toContain(
      "CONSTRAINT uq_business_onboarding_answers_business UNIQUE (business_id)",
    );
    expect(combinedSql).toContain("business_onboarding_answers_select_policy");
  });
});
