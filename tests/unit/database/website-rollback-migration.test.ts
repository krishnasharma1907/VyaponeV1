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

  it("defines public.rollback_published_site_version_atomic with SECURITY DEFINER and secure search_path", () => {
    expect(sql).toContain(
      "CREATE OR REPLACE FUNCTION public.rollback_published_site_version_atomic",
    );
    expect(sql).toContain("RETURNS JSONB");
    expect(sql).toContain("LANGUAGE plpgsql");
    expect(sql).toContain("SECURITY DEFINER");
    expect(sql).toContain("SET search_path = ''");
  });

  it("validates all required input parameters with appropriate error codes", () => {
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

  it("locks workspace -> business -> site in canonical order and rejects archived businesses", () => {
    expect(sql).toContain("PERFORM 1 FROM public.workspaces WHERE id = v_workspace_id FOR UPDATE;");
    expect(sql).toContain("PERFORM 1 FROM public.businesses WHERE id = p_business_id FOR UPDATE;");
    expect(sql).toContain("FROM public.sites s");
    expect(sql).toContain("JOIN public.businesses b ON b.id = s.business_id");
    expect(sql).toContain("WHERE s.id = p_site_id");
    expect(sql).toContain("FOR UPDATE OF s;");
    expect(sql).toContain("IF v_site.business_status = 'archived' THEN");
    expect(sql).toContain("ERRCODE = 'VY002'");
  });

  it("validates multi-tenant business ownership", () => {
    expect(sql).toContain("IF v_site.business_id <> p_business_id THEN");
    expect(sql).toContain("Site does not belong to specified business");
  });

  it("checks business authorization via canonical can_manage_business helper", () => {
    expect(sql).toContain("v_workspace_id := v_site.workspace_id;");
    expect(sql).toContain(
      "IF NOT public.can_manage_business(p_business_id, p_caller_user_id) THEN",
    );
    expect(sql).toContain("Unauthorized: insufficient business permissions to roll back site");
    expect(sql).toContain("ERRCODE = 'VY020'");
  });

  it("does not contain stale or non-existent membership relations", () => {
    expect(sql).not.toContain("public.business_memberships");
    expect(sql).not.toContain("public.workspace_memberships");
    expect(sql).not.toContain("business_memberships");
    expect(sql).not.toContain("workspace_memberships");
  });

  it("enforces strict optimistic concurrency on current published version without NULL bypass", () => {
    expect(sql).toContain(
      "IF v_site.published_version_id IS DISTINCT FROM p_expected_current_published_version_id THEN",
    );
    expect(sql).not.toContain("IF p_expected_current_published_version_id IS NOT NULL AND");
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

  it("enforces live_websites capacity only when rollback increases live usage and sets atomic transition GUC", () => {
    expect(sql).toContain("IF v_site.status <> 'published' THEN");
    expect(sql).toContain("IF NOT v_business_has_published AND v_workspace_id IS NOT NULL THEN");
    expect(sql).toContain("SELECT w.plan INTO v_plan_id");
    expect(sql).toContain("co.additional_capacity");
    expect(sql).toContain("pg_catalog.count(DISTINCT s2.business_id)");
    expect(sql).toContain("b2.status <> 'archived'");
    expect(sql).toContain("ERRCODE = 'VY001'");
    expect(sql).toContain(
      "PERFORM pg_catalog.set_config('vyapone.in_atomic_site_transition', 'true', true);",
    );
  });

  it("updates site published pointer without modifying historical versions", () => {
    expect(sql).toContain("UPDATE public.sites");
    expect(sql).toContain("SET published_version_id = p_target_version_id");
    expect(sql).toContain("status = 'published'");
    // Does NOT update or delete from public.site_versions
    expect(sql).not.toContain("UPDATE public.site_versions");
    expect(sql).not.toContain("DELETE FROM public.site_versions");
  });

  it("records audit log entry using actual canonical schema columns", () => {
    expect(sql).toContain("INSERT INTO public.audit_logs (");
    expect(sql).toContain("business_id,");
    expect(sql).toContain("workspace_id,");
    expect(sql).toContain("user_id,");
    expect(sql).toContain("action,");
    expect(sql).toContain("resource,");
    expect(sql).toContain("metadata_json,");
    expect(sql).toContain("ip_address,");
    expect(sql).toContain("created_at");
    expect(sql).toContain("'site.published_version_rolled_back'");

    // Strictly ensure invalid legacy columns are absent
    expect(sql).not.toContain("resource_type");
    expect(sql).not.toContain("resource_id");
    expect(sql).not.toMatch(/INSERT INTO\s+public\.audit_logs[^(]*\([^)]*\bmetadata\b[^_]/i);
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
