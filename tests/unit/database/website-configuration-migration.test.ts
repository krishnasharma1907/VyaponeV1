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
  const pointerAuditMigrationPath = path.join(
    rootDir,
    "supabase",
    "migrations",
    "20261120000001_website_pointer_and_foreign_key_audit.sql",
  );
  const combinedPath = path.join(rootDir, "supabase", "combined_migrations.sql");

  const migrationSql = fs.readFileSync(migrationPath, "utf-8");
  const auditMigrationSql = fs.readFileSync(auditMigrationPath, "utf-8");
  const pointerAuditSql = fs.readFileSync(pointerAuditMigrationPath, "utf-8");
  const combinedSql = fs.readFileSync(combinedPath, "utf-8");

  it("verifies migration files exist and are populated with deterministic timestamps", () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    expect(path.basename(migrationPath)).toMatch(/^\d{14}_[a-z0-9_]+\.sql$/);
    expect(migrationSql.length).toBeGreaterThan(1000);

    expect(fs.existsSync(auditMigrationPath)).toBe(true);
    expect(path.basename(auditMigrationPath)).toMatch(/^\d{14}_[a-z0-9_]+\.sql$/);
    expect(auditMigrationSql.length).toBeGreaterThan(1000);

    expect(fs.existsSync(pointerAuditMigrationPath)).toBe(true);
    expect(path.basename(pointerAuditMigrationPath)).toMatch(/^\d{14}_[a-z0-9_]+\.sql$/);
    expect(pointerAuditSql.length).toBeGreaterThan(1000);
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

  it("verifies effective privilege lockdown: table-level revokes and scoped column grants (Audit 1)", () => {
    // Both tables have ALL privileges stripped from untrusted roles
    expect(pointerAuditSql).toContain(
      "REVOKE ALL ON public.sites FROM anon, authenticated, PUBLIC;",
    );
    expect(pointerAuditSql).toContain(
      "REVOKE ALL ON public.site_versions FROM anon, authenticated, PUBLIC;",
    );

    // Legitimate read access is preserved
    expect(pointerAuditSql).toContain("GRANT SELECT ON public.sites TO anon, authenticated;");
    expect(pointerAuditSql).toContain(
      "GRANT SELECT ON public.site_versions TO anon, authenticated;",
    );

    // Scoped column-level INSERT on sites strictly excludes status, current_draft_version_id, published_version_id
    expect(pointerAuditSql).toContain(
      "GRANT INSERT (id, business_id, subdomain, primary_domain, created_at, updated_at)",
    );
    expect(pointerAuditSql).not.toMatch(
      /GRANT INSERT \([^)]*current_draft_version_id[^)]*\) ON public\.sites TO authenticated/i,
    );
    expect(pointerAuditSql).not.toMatch(
      /GRANT INSERT \([^)]*published_version_id[^)]*\) ON public\.sites TO authenticated/i,
    );
    expect(pointerAuditSql).not.toMatch(
      /GRANT INSERT \([^)]*status[^)]*\) ON public\.sites TO authenticated/i,
    );

    // Scoped column-level UPDATE on sites strictly excludes status, business_id, current_draft_version_id, published_version_id
    expect(pointerAuditSql).toContain(
      "GRANT UPDATE (subdomain, primary_domain, updated_at)\nON public.sites TO authenticated;",
    );
    expect(pointerAuditSql).not.toMatch(
      /GRANT UPDATE \([^)]*current_draft_version_id[^)]*\) ON public\.sites TO authenticated/i,
    );
    expect(pointerAuditSql).not.toMatch(
      /GRANT UPDATE \([^)]*published_version_id[^)]*\) ON public\.sites TO authenticated/i,
    );

    // public.site_versions: no direct write grants to authenticated or anon
    expect(pointerAuditSql).not.toMatch(
      /GRANT (INSERT|UPDATE|DELETE|ALL) ON public\.site_versions TO authenticated/i,
    );
    expect(pointerAuditSql).not.toMatch(
      /GRANT (INSERT|UPDATE|DELETE|ALL) ON public\.site_versions TO anon/i,
    );

    // service_role administrative grants
    expect(pointerAuditSql).toContain("GRANT ALL ON public.sites TO service_role;");
    expect(pointerAuditSql).toContain("GRANT ALL ON public.site_versions TO service_role;");
  });

  it("verifies composite foreign-key deletion semantics are set to ON DELETE RESTRICT (Audit 2)", () => {
    // Drops SET NULL composite foreign keys
    expect(pointerAuditSql).toContain(
      "ALTER TABLE public.sites DROP CONSTRAINT IF EXISTS fk_sites_current_draft_version;",
    );
    expect(pointerAuditSql).toContain(
      "ALTER TABLE public.sites DROP CONSTRAINT IF EXISTS fk_sites_published_version;",
    );

    // Adds composite FKs with ON DELETE RESTRICT
    expect(pointerAuditSql).toContain("ADD CONSTRAINT fk_sites_current_draft_version");
    expect(pointerAuditSql).toContain("FOREIGN KEY (id, current_draft_version_id)");
    expect(pointerAuditSql).toContain("REFERENCES public.site_versions(site_id, id)");
    expect(pointerAuditSql).toContain("ON DELETE RESTRICT;");

    expect(pointerAuditSql).toContain("ADD CONSTRAINT fk_sites_published_version");
    expect(pointerAuditSql).toContain("FOREIGN KEY (id, published_version_id)");
    expect(pointerAuditSql).toContain("REFERENCES public.site_versions(site_id, id)");

    // Confirms ADD CONSTRAINT statements use ON DELETE RESTRICT and do not use SET NULL
    const addConstraintBlocks = pointerAuditSql
      .split("ADD CONSTRAINT")
      .slice(1)
      .join("ADD CONSTRAINT");
    expect(addConstraintBlocks).not.toContain("ON DELETE SET NULL");
  });

  it("verifies TIMESTAMPTZ correctness: site_versions.created_at default set to now() (Audit 3)", () => {
    expect(pointerAuditSql).toContain("ALTER TABLE public.site_versions");
    expect(pointerAuditSql).toContain("ALTER COLUMN created_at SET DEFAULT now();");
    // Verify save_site_draft_configuration_atomic uses now()
    expect(pointerAuditSql).toContain("v_now TIMESTAMPTZ := pg_catalog.now();");
  });

  it("verifies all VO-040 migrations are accurately appended to supabase/combined_migrations.sql", () => {
    expect(combinedSql).toContain("CREATE TABLE public.site_versions");
    expect(combinedSql).toContain("uq_site_versions_site_version");
    expect(combinedSql).toContain("uq_sites_id_business_id");
    expect(combinedSql).toContain("fk_site_versions_site_business");
    expect(combinedSql).toContain("save_site_draft_configuration_atomic");
    expect(combinedSql).toContain("fk_sites_current_draft_version");
    expect(combinedSql).toContain("ON DELETE RESTRICT;");
    expect(combinedSql).toContain(
      "ALTER TABLE public.site_versions\n    ALTER COLUMN created_at SET DEFAULT now();",
    );
  });
});
