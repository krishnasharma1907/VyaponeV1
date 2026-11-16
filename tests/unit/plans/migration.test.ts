import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

describe("VO-026 Plans & Capacity Migration Verification", () => {
  const migrationPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20261115000001_plans_entitlements_capacity.sql",
  );

  const sqlContent = fs.readFileSync(migrationPath, "utf-8");

  it("verifies migration file exists and is populated", () => {
    expect(sqlContent.length).toBeGreaterThan(100);
  });

  it("verifies all 3 plan & capacity tables are created with appropriate constraints", () => {
    expect(sqlContent).toContain("CREATE TABLE IF NOT EXISTS public.subscriptions");
    expect(sqlContent).toContain("CREATE TABLE IF NOT EXISTS public.entitlement_overrides");
    expect(sqlContent).toContain("CREATE TABLE IF NOT EXISTS public.capacity_overrides");

    // Foreign keys to workspaces
    expect(sqlContent).toContain("REFERENCES public.workspaces(id)");
  });

  it("verifies workspaces and sites check constraints are updated", () => {
    expect(sqlContent).toContain("workspaces_plan_check");
    expect(sqlContent).toContain("'starter', 'growth', 'pro', 'agency', 'scale'");

    expect(sqlContent).toContain("sites_status_check");
    expect(sqlContent).toContain("'draft', 'published', 'suspended', 'archived'");
  });

  it("verifies FORCE ROW LEVEL SECURITY on all new tables", () => {
    expect(sqlContent).toContain("ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;");
    expect(sqlContent).toContain("ALTER TABLE public.subscriptions FORCE ROW LEVEL SECURITY;");

    expect(sqlContent).toContain(
      "ALTER TABLE public.entitlement_overrides ENABLE ROW LEVEL SECURITY;",
    );
    expect(sqlContent).toContain(
      "ALTER TABLE public.entitlement_overrides FORCE ROW LEVEL SECURITY;",
    );

    expect(sqlContent).toContain(
      "ALTER TABLE public.capacity_overrides ENABLE ROW LEVEL SECURITY;",
    );
    expect(sqlContent).toContain("ALTER TABLE public.capacity_overrides FORCE ROW LEVEL SECURITY;");
  });

  it("verifies fail-closed RLS policies and delete prohibitions", () => {
    // Subscriptions policies
    expect(sqlContent).toContain('"subscriptions_select_policy"');
    expect(sqlContent).toContain('"subscriptions_insert_policy"');
    expect(sqlContent).toContain('"subscriptions_update_policy"');
    expect(sqlContent).toContain('"subscriptions_delete_policy"');

    // Entitlement overrides policies
    expect(sqlContent).toContain('"entitlement_overrides_select_policy"');
    expect(sqlContent).toContain('"entitlement_overrides_insert_policy"');

    // Capacity overrides policies
    expect(sqlContent).toContain('"capacity_overrides_select_policy"');
    expect(sqlContent).toContain('"capacity_overrides_insert_policy"');

    // Deletes prohibited
    expect(sqlContent).toContain("USING (false)");
  });

  it("verifies atomic publishing procedure and triggers are defined", () => {
    expect(sqlContent).toContain(
      "CREATE OR REPLACE FUNCTION public.assert_and_lock_workspace_capacity",
    );
    expect(sqlContent).toContain("CREATE OR REPLACE FUNCTION public.transition_site_status_atomic");
    expect(sqlContent).toContain(
      "CREATE OR REPLACE FUNCTION public.check_site_publish_capacity_trigger",
    );
    expect(sqlContent).toContain(
      "CREATE OR REPLACE FUNCTION public.prevent_site_business_id_change",
    );

    expect(sqlContent).toContain(
      "DROP TRIGGER IF EXISTS trg_check_site_publish_capacity ON public.sites;",
    );
    expect(sqlContent).toContain(
      "DROP TRIGGER IF EXISTS trg_prevent_site_business_id_change ON public.sites;",
    );

    // Dropping unconditional uniqueness on business_id
    expect(sqlContent).toContain(
      "ALTER TABLE public.sites DROP CONSTRAINT IF EXISTS sites_business_id_key;",
    );
    expect(sqlContent).toContain(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_sites_single_published_per_business",
    );
  });

  describe("Forward-Only Hardening Migration (20261116000001_harden_capacity_locking_and_sqlstate.sql)", () => {
    const hardeningMigrationPath = path.join(
      process.cwd(),
      "supabase",
      "migrations",
      "20261116000001_harden_capacity_locking_and_sqlstate.sql",
    );
    const hardeningSql = fs.readFileSync(hardeningMigrationPath, "utf-8");

    it("verifies hardening migration file exists and is populated", () => {
      expect(hardeningSql.length).toBeGreaterThan(100);
    });

    it("verifies dedicated custom SQLSTATE codes are used without collision with predefined codes", () => {
      expect(hardeningSql).toContain("USING ERRCODE = 'VY001'");
      expect(hardeningSql).toContain("USING ERRCODE = 'VY002'");
      expect(hardeningSql).toContain("USING ERRCODE = 'VY003'");
      expect(hardeningSql).toContain("USING ERRCODE = 'VY004'");
      expect(hardeningSql).toContain("USING ERRCODE = 'VY005'");
      expect(hardeningSql).toContain("USING ERRCODE = 'VY006'");

      expect(hardeningSql).not.toContain("USING ERRCODE = 'P0003'");
      expect(hardeningSql).not.toContain("USING ERRCODE = 'P0004'");
      expect(hardeningSql).not.toContain("USING ERRCODE = 'P0005'");
    });

    it("verifies direct status updates are revoked and lock-order inversion is eliminated", () => {
      expect(hardeningSql).toContain(
        "REVOKE UPDATE (status) ON public.sites FROM authenticated, anon, PUBLIC;",
      );
      expect(hardeningSql).toContain("vyapone.in_atomic_site_transition");
      expect(hardeningSql).toContain("ORDER BY id FOR UPDATE");
    });

    it("verifies business archival and restoration trigger is declared", () => {
      expect(hardeningSql).toContain("trg_handle_business_archive_restore");
      expect(hardeningSql).toContain(
        "CREATE OR REPLACE FUNCTION public.handle_business_archive_restore_trigger()",
      );
      expect(hardeningSql).toContain("SET status = 'suspended'");
    });

    it("verifies combined_migrations.sql is strictly synchronized with 20261116000001", () => {
      const combinedPath = path.join(process.cwd(), "supabase", "combined_migrations.sql");
      const combinedSql = fs.readFileSync(combinedPath, "utf-8");

      expect(combinedSql).toContain(
        "-- Migration: 20261116000001_harden_capacity_locking_and_sqlstate.sql",
      );
      expect(combinedSql).toContain("REVOKE UPDATE (status) ON public.sites FROM authenticated");
      expect(combinedSql).toContain("USING ERRCODE = 'VY001'");
      expect(combinedSql).toContain("trg_handle_business_archive_restore");
    });
  });

  describe("Sites Table Privilege Hardening Migration (20261116000002_harden_sites_table_privileges_and_rpc.sql)", () => {
    const privilegeMigrationPath = path.join(
      process.cwd(),
      "supabase",
      "migrations",
      "20261116000002_harden_sites_table_privileges_and_rpc.sql",
    );
    const privilegeSql = fs.readFileSync(privilegeMigrationPath, "utf-8");

    it("verifies privilege migration file exists and is populated", () => {
      expect(privilegeSql.length).toBeGreaterThan(100);
    });

    it("verifies all broad table-level privileges are revoked from untrusted roles", () => {
      expect(privilegeSql).toContain(
        "REVOKE ALL ON public.sites FROM anon, authenticated, PUBLIC;",
      );
    });

    it("verifies SELECT is granted to anon and authenticated", () => {
      expect(privilegeSql).toContain("GRANT SELECT ON public.sites TO anon, authenticated;");
    });

    it("verifies column-level INSERT strictly excludes status", () => {
      expect(privilegeSql).toContain(
        "GRANT INSERT (id, business_id, subdomain, primary_domain, published_version_id, created_at, updated_at)",
      );
      expect(privilegeSql).not.toContain("GRANT INSERT (status)");
      expect(privilegeSql).not.toContain("GRANT INSERT ON public.sites TO authenticated");
    });

    it("verifies column-level UPDATE strictly excludes status and business_id", () => {
      expect(privilegeSql).toContain(
        "GRANT UPDATE (subdomain, primary_domain, published_version_id, updated_at)",
      );
      expect(privilegeSql).not.toContain("GRANT UPDATE (status)");
      expect(privilegeSql).not.toContain("GRANT UPDATE (business_id)");
      expect(privilegeSql).not.toContain("GRANT UPDATE ON public.sites TO authenticated");
    });

    it("verifies DELETE is granted to authenticated and guarded by RLS", () => {
      expect(privilegeSql).toContain("GRANT DELETE ON public.sites TO authenticated;");
    });

    it("verifies service_role maintains administrative access", () => {
      expect(privilegeSql).toContain("GRANT ALL ON public.sites TO service_role;");
    });

    it("verifies unconditional draft enforcement trigger on INSERT", () => {
      expect(privilegeSql).toContain("check_site_insert_status_trigger");
      expect(privilegeSql).toContain("trg_check_site_insert_status");
      expect(privilegeSql).toContain("BEFORE INSERT ON public.sites");
      expect(privilegeSql).toContain("NEW.status IS DISTINCT FROM 'draft'");
      expect(privilegeSql).toContain("USING ERRCODE = 'VY003'");
    });

    it("verifies combined_migrations.sql is strictly synchronized with 20261116000002", () => {
      const combinedPath = path.join(process.cwd(), "supabase", "combined_migrations.sql");
      const combinedSql = fs.readFileSync(combinedPath, "utf-8");

      expect(combinedSql).toContain(
        "-- Migration: 20261116000002_harden_sites_table_privileges_and_rpc.sql",
      );
      expect(combinedSql).toContain("REVOKE ALL ON public.sites FROM anon, authenticated, PUBLIC;");
      expect(combinedSql).toContain("check_site_insert_status_trigger");
    });
  });
});
