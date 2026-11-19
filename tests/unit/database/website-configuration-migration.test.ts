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
  const auditMigrationPath = path.join(
    rootDir,
    "supabase",
    "migrations",
    "20261119000004_website_version_integrity_and_atomic_draft.sql",
  );
  const combinedPath = path.join(rootDir, "supabase", "combined_migrations.sql");

  const migrationSql = fs.readFileSync(migrationPath, "utf-8");
  const auditMigrationSql = fs.readFileSync(auditMigrationPath, "utf-8");
  const combinedSql = fs.readFileSync(combinedPath, "utf-8");

  it("verifies migration files exist and are populated with deterministic timestamps", () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    expect(path.basename(migrationPath)).toMatch(/^\d{14}_[a-z0-9_]+\.sql$/);
    expect(migrationSql.length).toBeGreaterThan(1000);

    expect(fs.existsSync(auditMigrationPath)).toBe(true);
    expect(path.basename(auditMigrationPath)).toMatch(/^\d{14}_[a-z0-9_]+\.sql$/);
    expect(auditMigrationSql.length).toBeGreaterThan(1000);
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

  it("verifies composite relationship integrity constraints (Audit B)", () => {
    // 1. Composite unique constraint on sites(id, business_id)
    expect(auditMigrationSql).toContain("uq_sites_id_business_id");
    expect(auditMigrationSql).toContain("UNIQUE (id, business_id)");

    // 2. Composite foreign key from site_versions(site_id, business_id) to sites(id, business_id)
    expect(auditMigrationSql).toContain("fk_site_versions_site_business");
    expect(auditMigrationSql).toContain("FOREIGN KEY (site_id, business_id)");
    expect(auditMigrationSql).toContain("REFERENCES public.sites(id, business_id)");

    // 3. Composite unique constraint on site_versions(site_id, id)
    expect(auditMigrationSql).toContain("uq_site_versions_site_id_id");
    expect(auditMigrationSql).toContain("UNIQUE (site_id, id)");

    // 4. Composite foreign keys guaranteeing pointers reference versions of the SAME site
    expect(auditMigrationSql).toContain("fk_sites_current_draft_version");
    expect(auditMigrationSql).toContain("FOREIGN KEY (id, current_draft_version_id)");
    expect(auditMigrationSql).toContain("REFERENCES public.site_versions(site_id, id)");

    expect(auditMigrationSql).toContain("fk_sites_published_version");
    expect(auditMigrationSql).toContain("FOREIGN KEY (id, published_version_id)");
  });

  it("verifies direct client pointer modification privileges are revoked (Audit C)", () => {
    expect(auditMigrationSql).toContain(
      "REVOKE UPDATE (current_draft_version_id) ON public.sites FROM authenticated, anon, PUBLIC;",
    );
    expect(auditMigrationSql).toContain(
      "REVOKE INSERT (current_draft_version_id) ON public.sites FROM authenticated, anon, PUBLIC;",
    );
    expect(auditMigrationSql).toContain(
      "REVOKE UPDATE (published_version_id) ON public.sites FROM authenticated, anon, PUBLIC;",
    );
    expect(auditMigrationSql).toContain(
      "REVOKE INSERT (published_version_id) ON public.sites FROM authenticated, anon, PUBLIC;",
    );
  });

  it("verifies hardened version immutability and lifecycle checks (Audit D)", () => {
    expect(auditMigrationSql).toContain("prevent_site_version_modification");
    expect(auditMigrationSql).toContain("Historical site versions are immutable");
    expect(auditMigrationSql).toContain("Published site version timestamp is immutable");
    expect(auditMigrationSql).toContain("Cannot delete a published site version");
    expect(auditMigrationSql).toContain(
      "Cannot delete a site version currently referenced as active draft or published version",
    );
  });

  it("verifies atomic transactional draft RPC implementation (Audit A, E, F)", () => {
    expect(auditMigrationSql).toContain(
      "CREATE OR REPLACE FUNCTION public.save_site_draft_configuration_atomic",
    );
    expect(auditMigrationSql).toContain("SECURITY DEFINER");
    expect(auditMigrationSql).toContain("SET search_path = ''");
    // Row lock on sites to serialize concurrent saves
    expect(auditMigrationSql).toContain("FOR UPDATE OF s");
    // Caller identity verification against session
    expect(auditMigrationSql).toContain(
      "auth.uid() IS NOT NULL AND auth.uid() <> p_caller_user_id",
    );
    // Business RBAC check
    expect(auditMigrationSql).toContain(
      "public.can_manage_business(p_business_id, p_caller_user_id)",
    );
    // Media readiness and category validation
    expect(auditMigrationSql).toContain("m.status = 'ready'");
    expect(auditMigrationSql).toContain("m.verified_at IS NOT NULL");
    expect(auditMigrationSql).toContain(
      "m.category IN ('business_logo', 'catalogue_image', 'website_asset', 'onboarding_upload')",
    );
    // Version increment & pointer update
    expect(auditMigrationSql).toContain("INSERT INTO public.site_versions");
    expect(auditMigrationSql).toContain("UPDATE public.sites");
    expect(auditMigrationSql).toContain("current_draft_version_id = v_new_version.id");
    // Audit log insertion
    expect(auditMigrationSql).toContain("INSERT INTO public.audit_logs");
    expect(auditMigrationSql).toContain("'site.version_created'");
  });

  it("verifies execution grants on save_site_draft_configuration_atomic (Audit G)", () => {
    expect(auditMigrationSql).toContain("OWNER TO postgres;");
    expect(auditMigrationSql).toContain(
      "REVOKE ALL ON FUNCTION public.save_site_draft_configuration_atomic(UUID, UUID, UUID, TEXT, JSONB, TEXT, UUID[]) FROM PUBLIC, anon, service_role;",
    );
    expect(auditMigrationSql).toContain(
      "GRANT EXECUTE ON FUNCTION public.save_site_draft_configuration_atomic(UUID, UUID, UUID, TEXT, JSONB, TEXT, UUID[]) TO authenticated;",
    );
  });

  it("verifies both migrations are accurately appended to supabase/combined_migrations.sql", () => {
    expect(combinedSql).toContain("CREATE TABLE public.site_versions");
    expect(combinedSql).toContain("uq_site_versions_site_version");
    expect(combinedSql).toContain("uq_sites_id_business_id");
    expect(combinedSql).toContain("fk_site_versions_site_business");
    expect(combinedSql).toContain("save_site_draft_configuration_atomic");
  });
});
