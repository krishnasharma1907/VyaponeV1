import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

describe("VO-034 Atomic Business Import Migration Verification", () => {
  const rootDir = process.cwd();
  const migrationPath = path.join(
    rootDir,
    "supabase",
    "migrations",
    "20261119000002_atomic_business_import.sql",
  );
  const combinedPath = path.join(rootDir, "supabase", "combined_migrations.sql");

  const migrationSql = fs.readFileSync(migrationPath, "utf-8");
  const combinedSql = fs.readFileSync(combinedPath, "utf-8");

  it("verifies migration file exists and is populated with deterministic timestamp", () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    expect(path.basename(migrationPath)).toMatch(/^\d{14}_[a-z0-9_]+\.sql$/);
    expect(migrationSql.length).toBeGreaterThan(1000);
  });

  it("verifies public.confirm_business_import_atomic is created with SECURITY DEFINER and empty search_path", () => {
    expect(migrationSql).toContain(
      "CREATE OR REPLACE FUNCTION public.confirm_business_import_atomic",
    );
    expect(migrationSql).toContain("SECURITY DEFINER");
    expect(migrationSql).toContain("SET search_path = ''");
  });

  it("verifies session caller verification and existence checks inside the transaction", () => {
    expect(migrationSql).toContain("IF auth.uid() IS NOT NULL AND auth.uid() <> p_caller_user_id");
    expect(migrationSql).toContain("USING ERRCODE = 'VY020'");
    expect(migrationSql).toContain("SELECT 1 FROM public.users WHERE id = p_caller_user_id");
  });

  it("verifies workspace authorization check using is_workspace_admin_or_owner inside transactional boundary", () => {
    expect(migrationSql).toContain(
      "IF NOT public.is_workspace_admin_or_owner(p_workspace_id, p_caller_user_id) THEN",
    );
    expect(migrationSql).toContain("USING ERRCODE = 'VY021'");
  });

  it("verifies concurrency-safe draft_websites capacity locking via assert_and_lock_workspace_capacity", () => {
    expect(migrationSql).toContain("public.assert_and_lock_workspace_capacity");
    expect(migrationSql).toContain("'draft_websites'");
    expect(migrationSql).toContain("USING ERRCODE = 'VY001'");
  });

  it("verifies idempotency protection against duplicate proposal submissions", () => {
    expect(migrationSql).toContain("SELECT 1 FROM public.audit_logs");
    expect(migrationSql).toContain("metadata_json->>'proposal_id' = p_import_proposal_id");
    expect(migrationSql).toContain("USING ERRCODE = 'VY024'");
  });

  it("verifies atomic catalogue items insertion with constraint checks", () => {
    expect(migrationSql).toContain("jsonb_array_elements(p_catalogue_items)");
    expect(migrationSql).toContain("INSERT INTO public.catalogue_items");
    expect(migrationSql).toContain("v_price_minor < 0");
    expect(migrationSql).toContain("USING ERRCODE = 'VY025'");
  });

  it("verifies transactional audit event logging inside the stored procedure", () => {
    expect(migrationSql).toContain("INSERT INTO public.audit_logs");
    expect(migrationSql).toContain("'business.import_confirmed'");
    expect(migrationSql).toContain("'businesses'");
  });

  it("verifies sensitive tax identifiers (PAN, GSTIN) are excluded from audit metadata", () => {
    const auditInsertBlock = migrationSql.slice(
      migrationSql.indexOf("INSERT INTO public.audit_logs"),
    );
    expect(auditInsertBlock).not.toContain("p_pan_number");
    expect(auditInsertBlock).not.toContain("p_gst_number");
  });

  it("verifies least-privilege grants and revokes", () => {
    expect(migrationSql).toContain("REVOKE ALL ON FUNCTION public.confirm_business_import_atomic");
    expect(migrationSql).toContain("FROM PUBLIC, anon;");
    expect(migrationSql).toContain(
      "GRANT EXECUTE ON FUNCTION public.confirm_business_import_atomic",
    );
    expect(migrationSql).toContain("TO authenticated, service_role;");
  });

  it("verifies migration is accurately appended to supabase/combined_migrations.sql", () => {
    expect(combinedSql).toContain(
      "CREATE OR REPLACE FUNCTION public.confirm_business_import_atomic",
    );
  });
});
