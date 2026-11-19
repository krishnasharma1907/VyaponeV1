import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

describe("VO-040 Website Configuration Migration Verification", () => {
  const rootDir = process.cwd();
  const migrationPath = path.join(
    rootDir,
    "supabase",
    "migrations",
    "20261119000003_website_configuration_schema.sql",
  );
  const combinedPath = path.join(rootDir, "supabase", "combined_migrations.sql");

  const migrationSql = fs.readFileSync(migrationPath, "utf-8");
  const combinedSql = fs.readFileSync(combinedPath, "utf-8");

  it("verifies migration file exists and is populated with deterministic timestamp", () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    expect(path.basename(migrationPath)).toMatch(/^\d{14}_[a-z0-9_]+\.sql$/);
    expect(migrationSql.length).toBeGreaterThan(1000);
  });

  it("verifies preflight hardening revokes service_role on atomic business creation and import RPCs", () => {
    expect(migrationSql).toContain(
      "REVOKE EXECUTE ON FUNCTION public.create_business_with_setup_atomic",
    );
    expect(migrationSql).toContain(
      "REVOKE EXECUTE ON FUNCTION public.confirm_business_import_atomic",
    );
    expect(migrationSql).toContain("FROM service_role;");
  });

  it("verifies public.site_versions table is created with unique site_id + version_number constraint", () => {
    expect(migrationSql).toContain("CREATE TABLE public.site_versions");
    expect(migrationSql).toContain("version_number INT NOT NULL CHECK (version_number > 0)");
    expect(migrationSql).toContain("schema_version TEXT NOT NULL DEFAULT 'v1'");
    expect(migrationSql).toContain("configuration JSONB NOT NULL");
    expect(migrationSql).toContain(
      "CONSTRAINT uq_site_versions_site_version UNIQUE (site_id, version_number)",
    );
  });

  it("verifies public.sites is updated with current_draft_version_id and published foreign key", () => {
    expect(migrationSql).toContain(
      "current_draft_version_id UUID REFERENCES public.site_versions(id)",
    );
    expect(migrationSql).toContain("fk_sites_published_version");
  });

  it("verifies immutability trigger preventing historical version tampering", () => {
    expect(migrationSql).toContain("prevent_site_version_modification");
    expect(migrationSql).toContain("Historical site versions are immutable");
    expect(migrationSql).toContain("Cannot delete a published site version");
    expect(migrationSql).toContain("trg_prevent_site_version_modification");
  });

  it("verifies Row-Level Security is enabled and forced on site_versions", () => {
    expect(migrationSql).toContain("ALTER TABLE public.site_versions ENABLE ROW LEVEL SECURITY;");
    expect(migrationSql).toContain("ALTER TABLE public.site_versions FORCE ROW LEVEL SECURITY;");
  });

  it("verifies multi-tenant RLS policies allow tenant access and public read only for published versions", () => {
    expect(migrationSql).toContain('CREATE POLICY "site_versions_select_policy"');
    expect(migrationSql).toContain('CREATE POLICY "site_versions_insert_policy"');
    expect(migrationSql).toContain('CREATE POLICY "site_versions_delete_policy"');
    expect(migrationSql).toContain("published_at IS NOT NULL AND EXISTS");
    expect(migrationSql).toContain("s.status = 'published'");
  });

  it("verifies least-privilege grants and revokes", () => {
    expect(migrationSql).toContain("REVOKE ALL ON public.site_versions FROM PUBLIC, anon;");
    expect(migrationSql).toContain("GRANT SELECT ON public.site_versions TO authenticated, anon;");
    expect(migrationSql).toContain(
      "GRANT INSERT, DELETE ON public.site_versions TO authenticated;",
    );
    expect(migrationSql).toContain("GRANT ALL ON public.site_versions TO service_role;");
  });

  it("verifies migration is accurately appended to supabase/combined_migrations.sql", () => {
    expect(combinedSql).toContain("CREATE TABLE public.site_versions");
    expect(combinedSql).toContain("uq_site_versions_site_version");
  });
});
