import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

describe("VO-030 Niche and Module Registry Migration", () => {
  const migrationPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20261118000001_niche_and_module_registry.sql",
  );
  const combinedPath = path.join(process.cwd(), "supabase", "combined_migrations.sql");

  const migrationSql = fs.readFileSync(migrationPath, "utf-8");
  const combinedSql = fs.readFileSync(combinedPath, "utf-8");

  it("verifies migration file exists and is populated", () => {
    expect(migrationSql.length).toBeGreaterThan(500);
  });

  it("verifies public.niche_groups table schema", () => {
    expect(migrationSql).toContain("CREATE TABLE IF NOT EXISTS public.niche_groups");
    expect(migrationSql).toContain("id UUID PRIMARY KEY DEFAULT gen_random_uuid()");
    expect(migrationSql).toContain("slug VARCHAR(64) NOT NULL UNIQUE");
    expect(migrationSql).toContain("name VARCHAR(128) NOT NULL");
    expect(migrationSql).toContain("display_order INTEGER NOT NULL DEFAULT 0");
    expect(migrationSql).toContain("status VARCHAR(32) NOT NULL DEFAULT 'active'");
  });

  it("verifies public.niches table schema and foreign keys", () => {
    expect(migrationSql).toContain("CREATE TABLE IF NOT EXISTS public.niches");
    expect(migrationSql).toContain(
      "niche_group_id UUID NOT NULL REFERENCES public.niche_groups(id)",
    );
    expect(migrationSql).toContain("slug VARCHAR(64) NOT NULL UNIQUE");
    expect(migrationSql).toContain("name VARCHAR(128) NOT NULL");
    expect(migrationSql).toContain(
      "availability_label VARCHAR(64) NOT NULL DEFAULT 'informational_with_enquiry'",
    );
    expect(migrationSql).toContain("manifest JSONB NOT NULL DEFAULT '{}'::jsonb");
  });

  it("verifies public.platform_modules table schema", () => {
    expect(migrationSql).toContain("CREATE TABLE IF NOT EXISTS public.platform_modules");
    expect(migrationSql).toContain("key VARCHAR(64) NOT NULL UNIQUE");
    expect(migrationSql).toContain("name VARCHAR(128) NOT NULL");
    expect(migrationSql).toContain("category VARCHAR(64) NOT NULL DEFAULT 'operations'");
    expect(migrationSql).toContain("entitlement_feature_key VARCHAR(64)");
  });

  it("verifies public.niche_modules mapping table schema", () => {
    expect(migrationSql).toContain("CREATE TABLE IF NOT EXISTS public.niche_modules");
    expect(migrationSql).toContain("niche_id UUID NOT NULL REFERENCES public.niches(id)");
    expect(migrationSql).toContain(
      "module_id UUID NOT NULL REFERENCES public.platform_modules(id)",
    );
    expect(migrationSql).toContain("is_default BOOLEAN NOT NULL DEFAULT false");
    expect(migrationSql).toContain("is_recommended BOOLEAN NOT NULL DEFAULT true");
    expect(migrationSql).toContain("preset_config JSONB NOT NULL DEFAULT '{}'::jsonb");
    expect(migrationSql).toContain("UNIQUE (niche_id, module_id)");
  });

  it("verifies public.business_modules tenant table schema", () => {
    expect(migrationSql).toContain("CREATE TABLE IF NOT EXISTS public.business_modules");
    expect(migrationSql).toContain("business_id UUID NOT NULL REFERENCES public.businesses(id)");
    expect(migrationSql).toContain(
      "module_key VARCHAR(64) NOT NULL REFERENCES public.platform_modules(key)",
    );
    expect(migrationSql).toContain("is_enabled BOOLEAN NOT NULL DEFAULT true");
    expect(migrationSql).toContain("custom_config JSONB NOT NULL DEFAULT '{}'::jsonb");
    expect(migrationSql).toContain("UNIQUE (business_id, module_key)");
  });

  it("verifies businesses.niche_id foreign key addition", () => {
    expect(migrationSql).toContain(
      "ADD COLUMN niche_id UUID REFERENCES public.niches(id) ON DELETE SET NULL",
    );
  });

  it("verifies fail-closed ROW LEVEL SECURITY and FORCE RLS on all 5 tables", () => {
    const tables = [
      "niche_groups",
      "niches",
      "platform_modules",
      "niche_modules",
      "business_modules",
    ];

    for (const table of tables) {
      expect(migrationSql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`);
      expect(migrationSql).toContain(`ALTER TABLE public.${table} FORCE ROW LEVEL SECURITY;`);
    }
  });

  it("verifies seed statements exist for canonical groups and 21 modules", () => {
    expect(migrationSql).toContain("'food_hospitality'");
    expect(migrationSql).toContain("'retail_commerce'");
    expect(migrationSql).toContain("'beauty_wellness_fitness'");
    expect(migrationSql).toContain("'real_estate'");

    expect(migrationSql).toContain("'website_engine'");
    expect(migrationSql).toContain("'catalogue_services'");
    expect(migrationSql).toContain("'orders'");
    expect(migrationSql).toContain("'appointments'");
    expect(migrationSql).toContain("'udhaar_balances'");
    expect(migrationSql).toContain("'gst_billing'");
  });

  it("verifies synchronization with combined_migrations.sql", () => {
    expect(combinedSql).toContain("Niche & Module Registry [VO-030]");
    expect(combinedSql).toContain("CREATE TABLE IF NOT EXISTS public.niche_groups");
    expect(combinedSql).toContain("CREATE TABLE IF NOT EXISTS public.business_modules");
  });
});
