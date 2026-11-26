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

  describe("Site Domains Table & Constraints", () => {
    it("creates public.site_domains table with RLS, foreign keys, and domain uniqueness", () => {
      expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.site_domains");
      expect(sql).toContain("site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE");
      expect(sql).toContain(
        "business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE",
      );
      expect(sql).toContain("domain TEXT NOT NULL UNIQUE");
      expect(sql).toContain("status TEXT NOT NULL DEFAULT 'pending_verification'");
      expect(sql).toContain("verification_token TEXT NOT NULL");
      expect(sql).toContain("verification_target TEXT NOT NULL");
      expect(sql).toContain("ALTER TABLE public.site_domains ENABLE ROW LEVEL SECURITY;");
    });

    it("creates set_updated_at trigger and indexes on site_domains", () => {
      expect(sql).toContain("CREATE TRIGGER trg_site_domains_updated_at");
      expect(sql).toContain("BEFORE UPDATE ON public.site_domains");
      expect(sql).toContain("EXECUTE FUNCTION public.set_updated_at();");

      expect(sql).toContain("CREATE INDEX IF NOT EXISTS idx_site_domains_site_id");
      expect(sql).toContain("CREATE INDEX IF NOT EXISTS idx_site_domains_business_id");
      expect(sql).toContain("CREATE INDEX IF NOT EXISTS idx_site_domains_domain");
      expect(sql).toContain("CREATE INDEX IF NOT EXISTS idx_site_domains_status");
    });

    it("configures site_domains RLS policies using canonical relations and roles", () => {
      expect(sql).toContain("CREATE POLICY site_domains_select_policy ON public.site_domains");
      expect(sql).toContain("CREATE POLICY site_domains_insert_policy ON public.site_domains");
      expect(sql).toContain("CREATE POLICY site_domains_update_policy ON public.site_domains");
      expect(sql).toContain("CREATE POLICY site_domains_delete_policy ON public.site_domains");

      // Verify canonical tables are referenced
      expect(sql).toContain("FROM public.business_members bm");
      expect(sql).toContain("FROM public.workspace_members wm");
      expect(sql).toContain("b.sovereign_owner_id = auth.uid()");

      // Verify canonical workspace roles are checked (no non-existent agency_admin)
      expect(sql).not.toContain("'agency_admin'");
      expect(sql).toContain("wm.role IN ('workspace_owner', 'workspace_admin', 'reseller_admin')");
    });
  });

  describe("QR Codes Table & Constraints", () => {
    it("creates public.qr_codes table with RLS, foreign keys, and slug uniqueness", () => {
      expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.qr_codes");
      expect(sql).toContain("site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE");
      expect(sql).toContain(
        "business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE",
      );
      expect(sql).toContain("public_slug TEXT NOT NULL UNIQUE");
      expect(sql).toContain(
        'destination_configuration JSONB NOT NULL DEFAULT \'{"type":"storefront"}\'::jsonb',
      );
      expect(sql).toContain("scan_count INTEGER NOT NULL DEFAULT 0 CHECK (scan_count >= 0)");
      expect(sql).toContain("ALTER TABLE public.qr_codes ENABLE ROW LEVEL SECURITY;");
    });

    it("creates set_updated_at trigger and indexes on qr_codes", () => {
      expect(sql).toContain("CREATE TRIGGER trg_qr_codes_updated_at");
      expect(sql).toContain("BEFORE UPDATE ON public.qr_codes");
      expect(sql).toContain("EXECUTE FUNCTION public.set_updated_at();");

      expect(sql).toContain("CREATE INDEX IF NOT EXISTS idx_qr_codes_site_id");
      expect(sql).toContain("CREATE INDEX IF NOT EXISTS idx_qr_codes_business_id");
      expect(sql).toContain("CREATE INDEX IF NOT EXISTS idx_qr_codes_public_slug");
      expect(sql).toContain("CREATE INDEX IF NOT EXISTS idx_qr_codes_status");
    });

    it("configures qr_codes RLS policies for public scan and tenant management", () => {
      expect(sql).toContain("CREATE POLICY qr_codes_public_select ON public.qr_codes");
      expect(sql).toContain("CREATE POLICY qr_codes_business_select ON public.qr_codes");
      expect(sql).toContain("CREATE POLICY qr_codes_business_manage ON public.qr_codes");

      expect(sql).toContain("status = 'active'");
      expect(sql).toContain("bm.role IN ('owner', 'manager')");
      expect(sql).toContain("wm.role IN ('workspace_owner', 'workspace_admin', 'reseller_admin')");
    });
  });

  describe("Atomic Publishing RPC: public.publish_site_draft_atomic", () => {
    it("defines public.publish_site_draft_atomic with SECURITY DEFINER and secure search_path", () => {
      expect(sql).toContain("CREATE OR REPLACE FUNCTION public.publish_site_draft_atomic");
      expect(sql).toContain("p_site_id UUID");
      expect(sql).toContain("p_business_id UUID");
      expect(sql).toContain("p_caller_user_id UUID");
      expect(sql).toContain("p_target_version_id UUID");
      expect(sql).toContain("p_expected_draft_version_number INT");
      expect(sql).toContain("RETURNS JSONB");
      expect(sql).toContain("LANGUAGE plpgsql");
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

    it("verifies caller publishing authorization using canonical tables and roles", () => {
      expect(sql).toContain("FROM public.business_members");
      expect(sql).toContain("FROM public.workspace_members wm");
      expect(sql).toContain("wm.role IN ('workspace_owner', 'workspace_admin', 'reseller_admin')");
      expect(sql).toContain("b.sovereign_owner_id = p_caller_user_id");
      expect(sql).not.toContain("public.business_memberships");
      expect(sql).not.toContain("public.workspace_memberships");
      expect(sql).not.toContain("'agency_admin'");
    });

    it("verifies target version belongs to site and business", () => {
      expect(sql).toContain("IF v_target_version.id IS NULL THEN");
      expect(sql).toContain(
        "IF v_target_version.site_id <> p_site_id OR v_target_version.business_id <> p_business_id THEN",
      );
    });

    it("enforces strict optimistic concurrency on draft version number including NULL rejection", () => {
      expect(sql).toContain("IF p_expected_draft_version_number IS NULL THEN");
      expect(sql).toContain("p_expected_draft_version_number IS NOT NULL");
      expect(sql).toContain("v_target_version.version_number <> p_expected_draft_version_number");
      expect(sql).toContain("ERRCODE = 'VY049'");
    });

    it("enforces same-business site ownership in site_domains and qr_codes RLS policies", () => {
      expect(sql).toContain("WHERE s.id = site_domains.site_id");
      expect(sql).toContain("AND s.business_id = site_domains.business_id");
      expect(sql).toContain("WHERE s.id = qr_codes.site_id");
      expect(sql).toContain("AND s.business_id = qr_codes.business_id");
    });

    it("enforces live_websites plan capacity on draft-to-published transition without zero-row NULL bypass", () => {
      expect(sql).toContain("IF v_site.status <> 'published' AND v_workspace_id IS NOT NULL THEN");
      expect(sql).toContain("FROM public.subscriptions s");
      expect(sql).toContain("SELECT w.plan INTO v_plan_id");
      expect(sql).toContain("SELECT co.additional_capacity");
      expect(sql).toContain("metric = 'live_websites'");
      expect(sql).toContain("pg_catalog.count(DISTINCT s2.business_id)");
      expect(sql).toContain("b2.status <> 'archived'");
      expect(sql).toContain("Capacity limit reached for live_websites");
      expect(sql).toContain("ERRCODE = 'VY001'");
      expect(sql).not.toContain("w.plan_id");
      expect(sql).not.toContain("limit_override");
    });

    it("acquires canonical workspace -> business -> site lock order, rejects archived businesses, and sets atomic GUC", () => {
      expect(sql).toContain(
        "PERFORM 1 FROM public.workspaces WHERE id = v_workspace_id FOR UPDATE;",
      );
      expect(sql).toContain(
        "PERFORM 1 FROM public.businesses WHERE id = p_business_id FOR UPDATE;",
      );
      expect(sql).toContain("IF v_site.business_status = 'archived' THEN");
      expect(sql).toContain(
        "PERFORM pg_catalog.set_config('vyapone.in_atomic_site_transition', 'true', true);",
      );
    });

    it("stamps published_at timestamp on the target version row", () => {
      expect(sql).toContain("IF v_target_version.published_at IS NULL THEN");
      expect(sql).toContain("UPDATE public.site_versions");
      expect(sql).toContain("SET published_at = v_now");
    });

    it("automatically provisions stable main storefront QR code with canonical destination config and returns mainQrCode", () => {
      expect(sql).toContain("FROM public.qr_codes");
      expect(sql).toContain("type = 'main_storefront'");
      expect(sql).toContain("INSERT INTO public.qr_codes");
      expect(sql).toContain("'Main Storefront QR'");
      expect(sql).toContain("pg_catalog.jsonb_build_object('type', 'storefront')");
      expect(sql).toContain("'mainQrCode', pg_catalog.row_to_json(v_main_qr)");
      expect(sql).not.toContain("targetType");
      expect(sql).not.toContain("mainQrSlug");
    });

    it("logs structured site.published audit event using canonical audit_logs schema", () => {
      expect(sql).toContain("INSERT INTO public.audit_logs (");
      expect(sql).toContain("business_id,");
      expect(sql).toContain("workspace_id,");
      expect(sql).toContain("user_id,");
      expect(sql).toContain("action,");
      expect(sql).toContain("resource,");
      expect(sql).toContain("metadata_json,");
      expect(sql).toContain("ip_address,");
      expect(sql).toContain("created_at");

      expect(sql).toContain("'site.published'");
      expect(sql).toContain("'version_id', v_target_version.id");

      // Verify invalid legacy columns are absent
      expect(sql).not.toContain("resource_type");
      expect(sql).not.toContain("resource_id");
      expect(sql).not.toMatch(/INSERT INTO\s+public\.audit_logs[^(]*\([^)]*\bmetadata\b[^_]/i);
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

    it("grants table permissions on site_domains and qr_codes", () => {
      expect(sql).toContain("GRANT ALL ON TABLE public.site_domains TO service_role;");
      expect(sql).toContain("GRANT ALL ON TABLE public.qr_codes TO service_role;");
      expect(sql).toContain(
        "GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.site_domains TO authenticated;",
      );
      expect(sql).toContain(
        "GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.qr_codes TO authenticated;",
      );
      expect(sql).toContain("GRANT SELECT ON TABLE public.qr_codes TO anon;");
    });
  });
});
