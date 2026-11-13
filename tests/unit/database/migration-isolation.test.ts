import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

describe("Database Migration Static Validation: Tenant Isolation [VO-024]", () => {
  const migrationPath = path.resolve(
    process.cwd(),
    "supabase/migrations/20261113000002_enforce_tenant_isolation.sql",
  );

  let sql: string;

  it("verifies the migration file exists and is readable", () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    sql = fs.readFileSync(migrationPath, "utf-8");
    expect(sql.length).toBeGreaterThan(1000);
  });

  describe("SECURITY DEFINER Helper Functions", () => {
    const requiredFunctions = [
      "is_workspace_member",
      "is_workspace_admin_or_owner",
      "is_business_sovereign_owner",
      "is_business_member",
      "is_business_owner_or_manager",
      "can_access_business",
      "can_manage_business",
      "can_access_location",
    ];

    it("verifies all 8 tenancy helper functions are declared", () => {
      if (!sql) sql = fs.readFileSync(migrationPath, "utf-8");
      for (const fn of requiredFunctions) {
        expect(sql).toContain(`FUNCTION public.${fn}`);
      }
    });

    it("verifies each helper function enforces SECURITY DEFINER and secure search_path", () => {
      if (!sql) sql = fs.readFileSync(migrationPath, "utf-8");
      // Count SECURITY DEFINER occurrences
      const secDefMatches = sql.match(/SECURITY DEFINER/g);
      expect(secDefMatches).not.toBeNull();
      expect(secDefMatches!.length).toBeGreaterThanOrEqual(8);

      // Count search_path = '' occurrences
      const searchPathMatches = sql.match(/SET search_path = ''/g);
      expect(searchPathMatches).not.toBeNull();
      expect(searchPathMatches!.length).toBeGreaterThanOrEqual(8);
    });

    it("verifies execute is revoked from PUBLIC and granted to authenticated & anon", () => {
      if (!sql) sql = fs.readFileSync(migrationPath, "utf-8");
      for (const fn of requiredFunctions) {
        expect(sql).toContain(`REVOKE EXECUTE ON FUNCTION public.${fn}`);
        expect(sql).toContain(`GRANT EXECUTE ON FUNCTION public.${fn}`);
      }
    });
  });

  describe("FORCE ROW LEVEL SECURITY", () => {
    const allTenantTables = [
      "users",
      "user_auth_identities",
      "workspaces",
      "workspace_members",
      "workspace_invitations",
      "businesses",
      "locations",
      "business_members",
      "sites",
      "catalogue_items",
      "customers",
      "orders",
      "invoice_sequences",
      "bills",
      "audit_logs",
    ];

    it("verifies FORCE ROW LEVEL SECURITY is enabled across all 15 tenant-owned tables", () => {
      if (!sql) sql = fs.readFileSync(migrationPath, "utf-8");
      for (const table of allTenantTables) {
        expect(sql).toContain(`ALTER TABLE public.${table} FORCE ROW LEVEL SECURITY;`);
      }
    });
  });

  describe("Explicit RLS Policy Coverage", () => {
    const allTenantTables = [
      "users",
      "user_auth_identities",
      "workspaces",
      "workspace_members",
      "workspace_invitations",
      "businesses",
      "locations",
      "business_members",
      "sites",
      "catalogue_items",
      "customers",
      "orders",
      "invoice_sequences",
      "bills",
      "audit_logs",
    ];

    it("verifies every table has explicit SELECT, INSERT, UPDATE, and DELETE policies", () => {
      if (!sql) sql = fs.readFileSync(migrationPath, "utf-8");
      for (const table of allTenantTables) {
        expect(sql).toContain(`CREATE POLICY "${table}_select_policy" ON public.${table}`);
        expect(sql).toContain(`CREATE POLICY "${table}_insert_policy" ON public.${table}`);
        expect(sql).toContain(`CREATE POLICY "${table}_update_policy" ON public.${table}`);
        expect(sql).toContain(`CREATE POLICY "${table}_delete_policy" ON public.${table}`);
      }
    });

    it("verifies that at least 60 explicit policies are defined", () => {
      if (!sql) sql = fs.readFileSync(migrationPath, "utf-8");
      const policyMatches = sql.match(/CREATE POLICY/g);
      expect(policyMatches).not.toBeNull();
      expect(policyMatches!.length).toBeGreaterThanOrEqual(60);
    });

    it("verifies append-only tables prohibit UPDATE and DELETE", () => {
      if (!sql) sql = fs.readFileSync(migrationPath, "utf-8");
      // Audit logs append-only
      expect(sql).toMatch(/CREATE POLICY "audit_logs_update_policy"[\s\S]*?USING \(false\)/);
      expect(sql).toMatch(/CREATE POLICY "audit_logs_delete_policy"[\s\S]*?USING \(false\)/);

      // Orders and bills non-deletable
      expect(sql).toMatch(/CREATE POLICY "orders_delete_policy"[\s\S]*?USING \(false\)/);
      expect(sql).toMatch(/CREATE POLICY "bills_delete_policy"[\s\S]*?USING \(false\)/);

      // Invoice sequences non-deletable
      expect(sql).toMatch(/CREATE POLICY "invoice_sequences_delete_policy"[\s\S]*?USING \(false\)/);
    });

    it("verifies sovereign business deletion cannot be performed by reseller members", () => {
      if (!sql) sql = fs.readFileSync(migrationPath, "utf-8");
      expect(sql).toMatch(
        /CREATE POLICY "businesses_delete_policy"[\s\S]*?USING \(sovereign_owner_id = auth\.uid\(\)\)/,
      );
    });
  });

  describe("Supporting Performance Indexes", () => {
    it("verifies supporting indexes exist for RLS evaluation paths", () => {
      if (!sql) sql = fs.readFileSync(migrationPath, "utf-8");
      expect(sql).toContain("CREATE INDEX IF NOT EXISTS idx_business_members_lookup");
      expect(sql).toContain("CREATE INDEX IF NOT EXISTS idx_workspace_members_lookup");
      expect(sql).toContain("CREATE INDEX IF NOT EXISTS idx_businesses_owner_ws");
      expect(sql).toContain("CREATE INDEX IF NOT EXISTS idx_locations_business_lookup");
      expect(sql).toContain("CREATE INDEX IF NOT EXISTS idx_orders_business_location");
      expect(sql).toContain("CREATE INDEX IF NOT EXISTS idx_bills_business_location");
      expect(sql).toContain("CREATE INDEX IF NOT EXISTS idx_catalogue_items_business_location");
    });
  });
});
