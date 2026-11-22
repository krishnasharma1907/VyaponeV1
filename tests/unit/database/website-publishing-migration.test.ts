import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

describe("VO-049 Website Publishing, Domains & QR Migration Verification", () => {
  const rootDir = process.cwd();
  const migrationPath = path.join(
    rootDir,
    "supabase",
    "migrations",
    "20261122000003_website_publishing_domains_and_qr.sql",
  );

  it("verifies the VO-049 migration file exists", () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
  });

  const sql = fs.readFileSync(migrationPath, "utf-8");

  it("creates public.site_domains table with RLS and domain uniqueness", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.site_domains");
    expect(sql).toContain("domain TEXT NOT NULL UNIQUE");
    expect(sql).toContain("status TEXT NOT NULL DEFAULT 'pending_verification'");
    expect(sql).toContain("verification_token TEXT NOT NULL");
    expect(sql).toContain("ALTER TABLE public.site_domains ENABLE ROW LEVEL SECURITY;");
  });

  it("creates public.qr_codes table with RLS and slug uniqueness", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.qr_codes");
    expect(sql).toContain("public_slug TEXT NOT NULL UNIQUE");
    expect(sql).toContain("destination_configuration JSONB NOT NULL");
    expect(sql).toContain("scan_count INTEGER NOT NULL DEFAULT 0");
    expect(sql).toContain("ALTER TABLE public.qr_codes ENABLE ROW LEVEL SECURITY;");
  });

  it("defines public.publish_site_draft_atomic with SECURITY DEFINER and search_path", () => {
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.publish_site_draft_atomic");
    expect(sql).toContain("SECURITY DEFINER");
    expect(sql).toContain("SET search_path = ''");
  });

  it("locks the site row FOR UPDATE to serialize concurrent publishing operations", () => {
    expect(sql).toContain("FROM public.sites s");
    expect(sql).toContain("JOIN public.businesses b ON b.id = s.business_id");
    expect(sql).toContain("WHERE s.id = p_site_id");
    expect(sql).toContain("FOR UPDATE OF s;");
  });

  it("validates session caller authentication and user record existence", () => {
    expect(sql).toContain("IF auth.uid() IS NOT NULL AND auth.uid() <> p_caller_user_id THEN");
    expect(sql).toContain("Access denied: caller does not match authenticated session");
    expect(sql).toContain("FROM public.users WHERE id = p_caller_user_id");
  });

  it("verifies caller publishing authorization", () => {
    expect(sql).toContain("FROM public.business_members");
    expect(sql).toContain("FROM public.workspace_members");
    expect(sql).toContain("b.sovereign_owner_id = p_caller_user_id");
  });

  it("verifies target version belongs to site and business", () => {
    expect(sql).toContain("IF v_target_version.id IS NULL THEN");
    expect(sql).toContain(
      "IF v_target_version.site_id <> p_site_id OR v_target_version.business_id <> p_business_id THEN",
    );
  });

  it("enforces optimistic concurrency on draft version number", () => {
    expect(sql).toContain("p_expected_draft_version_number IS NOT NULL");
    expect(sql).toContain("v_target_version.version_number <> p_expected_draft_version_number");
    expect(sql).toContain("ERRCODE = 'VY049'");
  });

  it("enforces live_websites plan capacity on draft-to-published transition", () => {
    expect(sql).toContain("IF v_site.status <> 'published' THEN");
    expect(sql).toContain("metric = 'live_websites'");
    expect(sql).toContain("Capacity limit reached for live_websites");
  });

  it("stamps published_at timestamp on the target version row", () => {
    expect(sql).toContain("IF v_target_version.published_at IS NULL THEN");
    expect(sql).toContain("UPDATE public.site_versions");
    expect(sql).toContain("SET published_at = v_now");
  });

  it("automatically provisions stable main storefront QR code on publish", () => {
    expect(sql).toContain("FROM public.qr_codes");
    expect(sql).toContain("type = 'main_storefront'");
    expect(sql).toContain("INSERT INTO public.qr_codes");
    expect(sql).toContain("'Main Storefront QR'");
  });

  it("logs structured site.published audit event", () => {
    expect(sql).toContain("action,");
    expect(sql).toContain("'site.published'");
    expect(sql).toContain("'version_id', v_target_version.id");
  });

  it("revokes execution from PUBLIC and anon, grants to authenticated and service_role", () => {
    expect(sql).toContain(
      "REVOKE ALL ON FUNCTION public.publish_site_draft_atomic(UUID, UUID, UUID, UUID, INT) FROM PUBLIC;",
    );
    expect(sql).toContain(
      "REVOKE ALL ON FUNCTION public.publish_site_draft_atomic(UUID, UUID, UUID, UUID, INT) FROM anon;",
    );
    expect(sql).toContain(
      "GRANT EXECUTE ON FUNCTION public.publish_site_draft_atomic(UUID, UUID, UUID, UUID, INT) TO authenticated;",
    );
    expect(sql).toContain(
      "GRANT EXECUTE ON FUNCTION public.publish_site_draft_atomic(UUID, UUID, UUID, UUID, INT) TO service_role;",
    );
  });
});
