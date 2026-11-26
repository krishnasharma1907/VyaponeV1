import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Static contract validation tests for CLOUD-007 historical schema and RPC remediations.
 *
 * NOTE: Static SQL file assertions verify structure, parameter signatures, grants, and
 * defect removal only; they do NOT constitute live PostgreSQL execution. Behavioral
 * PostgreSQL execution verification belongs in `scripts/ci/verify-supabase-migrations.mjs`.
 */
describe("CLOUD-007 Forward Corrective Migration Verification (20261125000001)", () => {
  const rootDir = process.cwd();
  const migrationsDir = path.join(rootDir, "supabase", "migrations");
  const remediationPath = path.join(
    migrationsDir,
    "20261125000001_remediate_historical_schema_and_rpc_defects.sql",
  );

  it("defines 20261125000001 corrective migration cleanly after pending migrations", () => {
    expect(fs.existsSync(remediationPath)).toBe(true);
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    expect(files.at(-1)).toBe("20261125000001_remediate_historical_schema_and_rpc_defects.sql");
  });

  const sql = fs.readFileSync(remediationPath, "utf-8");
  const executableSql = sql.replace(/--.*$/gm, "");

  it("keeps production-applied historical migrations immutable and intact on disk", () => {
    const immutables = [
      "20261115000001_plans_entitlements_capacity.sql",
      "20261116000001_harden_capacity_locking_and_sqlstate.sql",
      "20261117000001_team_invitations_and_membership_lifecycle.sql",
      "20261117000002_audit_and_notification_foundation.sql",
      "20261119000001_atomic_business_creation.sql",
      "20261119000002_atomic_business_import.sql",
    ];
    for (const file of immutables) {
      expect(fs.existsSync(path.join(migrationsDir, file))).toBe(true);
    }

    // Verify original immutable trigger reference was NOT rewritten silently
    const notifMigration = fs.readFileSync(
      path.join(migrationsDir, "20261117000002_audit_and_notification_foundation.sql"),
      "utf-8",
    );
    expect(notifMigration).toContain("EXECUTE FUNCTION public.update_updated_at_column();");
  });

  it("re-points trg_notifications_updated_at to canonical public.set_updated_at()", () => {
    expect(executableSql).toContain(
      "DROP TRIGGER IF EXISTS trg_notifications_updated_at ON public.notifications;",
    );
    expect(executableSql).toContain("CREATE TRIGGER trg_notifications_updated_at");
    expect(executableSql).toContain("BEFORE UPDATE ON public.notifications");
    expect(executableSql).toContain("EXECUTE FUNCTION public.set_updated_at();");
    expect(executableSql).not.toContain("update_updated_at_column()");
  });

  it("remediates accept_workspace_invitation_atomic with identity/email verification, direct team_seats VY001 enforcement, and no workspace_members.updated_at", () => {
    expect(executableSql).toContain(
      "CREATE OR REPLACE FUNCTION public.accept_workspace_invitation_atomic(",
    );
    const acceptFnStart = executableSql.indexOf(
      "CREATE OR REPLACE FUNCTION public.accept_workspace_invitation_atomic(",
    );
    const acceptFnEnd = executableSql.indexOf(
      "REVOKE ALL ON FUNCTION public.accept_workspace_invitation_atomic",
    );
    const acceptFnBody = executableSql.slice(acceptFnStart, acceptFnEnd);

    // Must not call assert_and_lock_workspace_capacity() for non-member invitees (which rejects VY003 / discards PERFORM)
    expect(acceptFnBody).not.toContain("assert_and_lock_workspace_capacity");
    expect(acceptFnBody).toContain("auth.uid()");
    expect(acceptFnBody).toContain("FROM public.users pu");
    expect(acceptFnBody).toContain("LEFT JOIN auth.users au ON au.id = pu.id");
    expect(acceptFnBody).toContain("USING ERRCODE = 'VY013'");
    expect(acceptFnBody).toContain("FROM public.workspaces w");
    expect(acceptFnBody).toContain("FOR UPDATE");
    expect(acceptFnBody).toContain("IF (v_active_seats + 1) > v_effective_seats THEN");
    expect(acceptFnBody).toContain("USING ERRCODE = 'VY001'");

    const workspaceMemberUpsertMatch = acceptFnBody.match(
      /INSERT INTO public\.workspace_members\s*\([^;]*;/i,
    );
    expect(workspaceMemberUpsertMatch).not.toBeNull();
    expect(workspaceMemberUpsertMatch![0]).toContain("role = EXCLUDED.role,");
    expect(workspaceMemberUpsertMatch![0]).toContain("status = 'active';");
    expect(workspaceMemberUpsertMatch![0]).not.toMatch(/updated_at/i);
    expect(executableSql).toContain(
      "GRANT EXECUTE ON FUNCTION public.accept_workspace_invitation_atomic(TEXT, UUID, TEXT) TO authenticated, service_role;",
    );
  });

  it("remediates accept_business_invitation_atomic with caller identity, verified email, archived check, and canonical lock ordering", () => {
    expect(executableSql).toContain(
      "CREATE OR REPLACE FUNCTION public.accept_business_invitation_atomic(",
    );
    const bizAcceptStart = executableSql.indexOf(
      "CREATE OR REPLACE FUNCTION public.accept_business_invitation_atomic(",
    );
    const bizAcceptEnd = executableSql.indexOf(
      "REVOKE ALL ON FUNCTION public.accept_business_invitation_atomic",
    );
    const bizAcceptBody = executableSql.slice(bizAcceptStart, bizAcceptEnd);

    expect(bizAcceptBody).toContain("auth.uid()");
    expect(bizAcceptBody).toContain("LEFT JOIN auth.users au ON au.id = pu.id");
    expect(bizAcceptBody).toContain("USING ERRCODE = 'VY013'");
    expect(bizAcceptBody).toContain("FROM public.businesses b");
    expect(bizAcceptBody).toContain("v_business_status = 'archived'");
    expect(bizAcceptBody).toContain("USING ERRCODE = 'VY002'");
    expect(executableSql).toContain(
      "GRANT EXECUTE ON FUNCTION public.accept_business_invitation_atomic(TEXT, UUID, TEXT) TO authenticated, service_role;",
    );
  });

  it("remediates niche_group join in create_business_with_setup_atomic and confirm_business_import_atomic while preserving service_role revocation", () => {
    expect(executableSql).toContain(
      "CREATE OR REPLACE FUNCTION public.create_business_with_setup_atomic(",
    );
    expect(executableSql).toContain(
      "CREATE OR REPLACE FUNCTION public.confirm_business_import_atomic(",
    );
    expect(executableSql).not.toContain("niche_group_slug");

    const joinOccurrences = sql.match(
      /SELECT n\.id, ng\.slug INTO v_niche_id, v_category[\s\S]*?FROM public\.niches n[\s\S]*?JOIN public\.niche_groups ng ON ng\.id = n\.niche_group_id/g,
    );
    expect(joinOccurrences).not.toBeNull();
    expect(joinOccurrences!.length).toBe(2);

    // Must preserve VO-040 security preflight revoking service_role execution
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.create_business_with_setup_atomic(");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.confirm_business_import_atomic(");
    expect(sql).toContain("FROM PUBLIC, anon, service_role;");
  });

  it("fixes check_site_publish_capacity_trigger GUC NULL check, capacity zero-row coalesce, and sites.published_at error", () => {
    expect(sql).toContain(
      "CREATE OR REPLACE FUNCTION public.check_site_publish_capacity_trigger()",
    );
    expect(sql).toContain(
      "IF pg_catalog.current_setting('vyapone.in_atomic_site_transition', true) IS DISTINCT FROM 'true' THEN",
    );

    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.assert_and_lock_workspace_capacity(");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.transition_site_status_atomic(");

    const scalarCoalesceMatches = sql.match(
      /pg_catalog\.coalesce\(\s*\(\s*SELECT co\.additional_capacity/g,
    );
    expect(scalarCoalesceMatches).not.toBeNull();
    expect(scalarCoalesceMatches!.length).toBeGreaterThanOrEqual(4);

    // transition_site_status_atomic must NOT reference non-existent public.sites.published_at
    const transitionStart = sql.indexOf(
      "CREATE OR REPLACE FUNCTION public.transition_site_status_atomic(",
    );
    const transitionBody = sql.slice(transitionStart);
    expect(transitionBody).not.toMatch(/UPDATE public\.sites[\s\S]*published_at\s*=/);
  });
});
