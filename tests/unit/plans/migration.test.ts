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
});
