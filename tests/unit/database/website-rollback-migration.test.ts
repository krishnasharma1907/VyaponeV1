import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

describe("VO-048 Website Rollback RPC Migration Verification", () => {
  const rootDir = process.cwd();
  const rollbackMigrationPath = path.join(
    rootDir,
    "supabase",
    "migrations",
    "20261122000002_website_rollback_rpc.sql",
  );

  it("verifies the rollback migration file exists", () => {
    expect(fs.existsSync(rollbackMigrationPath)).toBe(true);
  });

  const sql = fs.readFileSync(rollbackMigrationPath, "utf-8");

  it("defines public.rollback_published_site_version_atomic with SECURITY DEFINER", () => {
    expect(sql).toContain(
      "CREATE OR REPLACE FUNCTION public.rollback_published_site_version_atomic",
    );
    expect(sql).toContain("SECURITY DEFINER");
    expect(sql).toContain("SET search_path = ''");
  });

  it("validates all required input parameters", () => {
    expect(sql).toContain("p_site_id UUID");
    expect(sql).toContain("p_business_id UUID");
    expect(sql).toContain("p_caller_user_id UUID");
    expect(sql).toContain("p_target_version_id UUID");
    expect(sql).toContain("p_expected_current_published_version_id UUID");

    expect(sql).toContain("IF p_site_id IS NULL THEN");
    expect(sql).toContain("IF p_business_id IS NULL THEN");
    expect(sql).toContain("IF p_caller_user_id IS NULL THEN");
    expect(sql).toContain("IF p_target_version_id IS NULL THEN");
  });

  it("enforces session caller authentication and user record verification", () => {
    expect(sql).toContain("IF auth.uid() IS NOT NULL AND auth.uid() <> p_caller_user_id THEN");
    expect(sql).toContain("Access denied: caller does not match authenticated session");
    expect(sql).toContain("FROM public.users WHERE id = p_caller_user_id");
  });

  it("locks the site row FOR UPDATE to serialize concurrent operations", () => {
    expect(sql).toContain("FROM public.sites s");
    expect(sql).toContain("JOIN public.businesses b ON b.id = s.business_id");
    expect(sql).toContain("WHERE s.id = p_site_id");
    expect(sql).toContain("FOR UPDATE OF s;");
  });

  it("validates multi-tenant business ownership", () => {
    expect(sql).toContain("IF v_site.business_id <> p_business_id THEN");
    expect(sql).toContain("Site does not belong to specified business");
  });

  it("checks business/workspace role authorization", () => {
    expect(sql).toContain("FROM public.business_memberships");
    expect(sql).toContain("role IN ('owner', 'reseller_admin', 'reseller_staff')");
    expect(sql).toContain("FROM public.workspace_memberships wm");
  });

  it("enforces optimistic concurrency on current published version", () => {
    expect(sql).toContain("IF p_expected_current_published_version_id IS NOT NULL AND");
    expect(sql).toContain(
      "v_site.published_version_id IS DISTINCT FROM p_expected_current_published_version_id THEN",
    );
    expect(sql).toContain(
      "Rollback conflict: current published version does not match expected version",
    );
    expect(sql).toContain("ERRCODE = 'VY049'");
  });

  it("validates target version belongs to site and was previously published", () => {
    expect(sql).toContain("FROM public.site_versions v");
    expect(sql).toContain("WHERE v.id = p_target_version_id");
    expect(sql).toContain(
      "IF v_target_version.site_id <> p_site_id OR v_target_version.business_id <> p_business_id THEN",
    );
    expect(sql).toContain("IF v_target_version.published_at IS NULL THEN");
    expect(sql).toContain(
      "Cannot rollback to an unpublished draft version; use Restore to Draft instead",
    );
    expect(sql).toContain("IF v_site.published_version_id = p_target_version_id THEN");
    expect(sql).toContain("Target version is already the active published version");
  });

  it("updates site published pointer without modifying historical versions", () => {
    expect(sql).toContain("UPDATE public.sites");
    expect(sql).toContain("SET published_version_id = p_target_version_id");
    expect(sql).toContain("status = 'published'");
    // Does NOT update or delete from public.site_versions
    expect(sql).not.toContain("UPDATE public.site_versions");
    expect(sql).not.toContain("DELETE FROM public.site_versions");
  });

  it("records audit log entry for published version rollback", () => {
    expect(sql).toContain("INSERT INTO public.audit_logs");
    expect(sql).toContain("'site.published_version_rolled_back'");
  });

  it("revokes execute from anon/PUBLIC and grants execute to authenticated/service_role", () => {
    expect(sql).toContain(
      "REVOKE ALL ON FUNCTION public.rollback_published_site_version_atomic(UUID, UUID, UUID, UUID, UUID) FROM PUBLIC;",
    );
    expect(sql).toContain(
      "REVOKE ALL ON FUNCTION public.rollback_published_site_version_atomic(UUID, UUID, UUID, UUID, UUID) FROM anon;",
    );
    expect(sql).toContain(
      "GRANT EXECUTE ON FUNCTION public.rollback_published_site_version_atomic(UUID, UUID, UUID, UUID, UUID) TO authenticated;",
    );
    expect(sql).toContain(
      "GRANT EXECUTE ON FUNCTION public.rollback_published_site_version_atomic(UUID, UUID, UUID, UUID, UUID) TO service_role;",
    );
  });
});
