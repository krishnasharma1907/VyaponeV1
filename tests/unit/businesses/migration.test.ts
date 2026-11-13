import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

describe("Database Migration Static Validation [VO-023]", () => {
  const migrationPath = path.resolve(
    process.cwd(),
    "supabase/migrations/20261113000001_business_location_core.sql",
  );

  it("verifies migration file exists and is readable", () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    const content = fs.readFileSync(migrationPath, "utf-8");
    expect(content.length).toBeGreaterThan(100);
  });

  it("verifies nullable workspace_id to support DIY businesses", () => {
    const content = fs.readFileSync(migrationPath, "utf-8");
    expect(content).toContain("ALTER TABLE public.businesses");
    expect(content).toContain("ALTER COLUMN workspace_id DROP NOT NULL;");
  });

  it("verifies partial unique index enforcing single primary location per business", () => {
    const content = fs.readFileSync(migrationPath, "utf-8");
    expect(content).toContain(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_locations_primary_per_business",
    );
    expect(content).toContain("ON public.locations (business_id)");
    expect(content).toContain("WHERE is_primary = true;");
  });

  it("verifies atomic bootstrap function has secure search path and SECURITY DEFINER", () => {
    const content = fs.readFileSync(migrationPath, "utf-8");
    expect(content).toContain(
      "CREATE OR REPLACE FUNCTION public.create_business_with_primary_location",
    );
    expect(content).toContain("SECURITY DEFINER");
    expect(content).toContain("SET search_path = ''");
    expect(content).toContain("v_caller_id := auth.uid();");
  });

  it("verifies least-privilege execute grants on atomic function", () => {
    const content = fs.readFileSync(migrationPath, "utf-8");
    expect(content).toContain(
      "REVOKE EXECUTE ON FUNCTION public.create_business_with_primary_location FROM PUBLIC;",
    );
    expect(content).toContain(
      "GRANT EXECUTE ON FUNCTION public.create_business_with_primary_location TO authenticated;",
    );
  });
});
