import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

describe("VO-027 Team Invitations & Membership Lifecycle Migration Verification", () => {
  const rootDir = process.cwd();
  const migrationPath = path.join(
    rootDir,
    "supabase",
    "migrations",
    "20261117000001_team_invitations_and_membership_lifecycle.sql",
  );
  const combinedPath = path.join(rootDir, "supabase", "combined_migrations.sql");

  const migrationSql = fs.readFileSync(migrationPath, "utf-8");
  const combinedSql = fs.readFileSync(combinedPath, "utf-8");

  it("verifies migration file exists and is populated with deterministic timestamp", () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    expect(path.basename(migrationPath)).toMatch(/^\d{14}_[a-z0-9_]+\.sql$/);
    expect(migrationSql.length).toBeGreaterThan(500);
  });

  it("verifies public.business_invitations table is created with required schema & constraints", () => {
    expect(migrationSql).toContain("CREATE TABLE IF NOT EXISTS public.business_invitations");
    expect(migrationSql).toContain("business_id UUID NOT NULL REFERENCES public.businesses(id)");
    expect(migrationSql).toContain("email TEXT NOT NULL");
    expect(migrationSql).toContain(
      "role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'cashier', 'staff'))",
    );
    expect(migrationSql).toContain("token_hash TEXT NOT NULL UNIQUE");
    expect(migrationSql).toContain("invited_by UUID NOT NULL REFERENCES public.users(id)");
    expect(migrationSql).toContain(
      "status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired'))",
    );
    expect(migrationSql).toContain("expires_at TIMESTAMPTZ NOT NULL");
    expect(migrationSql).toContain("created_at TIMESTAMPTZ NOT NULL");
    expect(migrationSql).toContain("updated_at TIMESTAMPTZ NOT NULL");
  });

  it("verifies partial unique index on (business_id, lower(email)) WHERE status = 'pending'", () => {
    expect(migrationSql).toContain("idx_business_invitations_pending_unique");
    expect(migrationSql).toContain("ON public.business_invitations (business_id, lower(email))");
    expect(migrationSql).toContain("WHERE status = 'pending'");
  });

  it("verifies RLS is enabled on public.business_invitations", () => {
    expect(migrationSql).toContain(
      "ALTER TABLE public.business_invitations ENABLE ROW LEVEL SECURITY;",
    );
  });

  it("verifies RLS helper function is SECURITY DEFINER with empty search_path", () => {
    expect(migrationSql).toContain(
      "CREATE OR REPLACE FUNCTION public.is_business_manager_or_owner",
    );
    expect(migrationSql).toContain("SECURITY DEFINER");
    expect(migrationSql).toContain("SET search_path = ''");
  });

  it("verifies RLS policies on business_invitations prevent unauthorized access", () => {
    expect(migrationSql).toContain('"business_invitations_select_policy"');
    expect(migrationSql).toContain('"business_invitations_insert_policy"');
    expect(migrationSql).toContain('"business_invitations_update_policy"');
    expect(migrationSql).toContain('"business_invitations_delete_policy"');
  });

  it("verifies accept_workspace_invitation_atomic stored procedure implementation", () => {
    expect(migrationSql).toContain(
      "CREATE OR REPLACE FUNCTION public.accept_workspace_invitation_atomic",
    );
    expect(migrationSql).toContain("SECURITY DEFINER");
    expect(migrationSql).toContain("SET search_path = ''");
    expect(migrationSql).toContain("FOR UPDATE");

    // Standardized SQLSTATE error codes
    expect(migrationSql).toContain("'VY010'"); // token not found
    expect(migrationSql).toContain("'VY011'"); // inactive status
    expect(migrationSql).toContain("'VY012'"); // expired
    expect(migrationSql).toContain("'VY013'"); // email mismatch

    // Concurrency-safe capacity check
    expect(migrationSql).toContain(
      "public.assert_and_lock_workspace_capacity(v_invitation.workspace_id, 'team_seats', 1)",
    );

    // Upsert into workspace_members
    expect(migrationSql).toContain("INSERT INTO public.workspace_members");
    expect(migrationSql).toContain("ON CONFLICT (workspace_id, user_id)");
  });

  it("verifies accept_business_invitation_atomic stored procedure implementation", () => {
    expect(migrationSql).toContain(
      "CREATE OR REPLACE FUNCTION public.accept_business_invitation_atomic",
    );
    expect(migrationSql).toContain("SECURITY DEFINER");
    expect(migrationSql).toContain("SET search_path = ''");
    expect(migrationSql).toContain("FOR UPDATE");

    // Standardized SQLSTATE error codes
    expect(migrationSql).toContain("'VY010'");
    expect(migrationSql).toContain("'VY011'");
    expect(migrationSql).toContain("'VY012'");
    expect(migrationSql).toContain("'VY013'");

    // Sovereign owner update when role is owner
    expect(migrationSql).toContain("UPDATE public.businesses");
    expect(migrationSql).toContain("SET sovereign_owner_id = p_accepting_user_id");

    // Upsert into business_members
    expect(migrationSql).toContain("INSERT INTO public.business_members");
    expect(migrationSql).toContain("ON CONFLICT (business_id, user_id)");
  });

  it("verifies privilege revocation from PUBLIC and anon, granting strictly to authenticated and service_role", () => {
    expect(migrationSql).toContain(
      "REVOKE ALL ON TABLE public.business_invitations FROM PUBLIC, anon;",
    );
    expect(migrationSql).toContain(
      "REVOKE ALL ON FUNCTION public.is_business_manager_or_owner(UUID, UUID) FROM PUBLIC, anon;",
    );
    expect(migrationSql).toContain(
      "REVOKE ALL ON FUNCTION public.accept_workspace_invitation_atomic(TEXT, UUID, TEXT) FROM PUBLIC, anon;",
    );
    expect(migrationSql).toContain(
      "REVOKE ALL ON FUNCTION public.accept_business_invitation_atomic(TEXT, UUID, TEXT) FROM PUBLIC, anon;",
    );

    expect(migrationSql).toContain(
      "GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.business_invitations TO authenticated, service_role;",
    );
    expect(migrationSql).toContain(
      "GRANT EXECUTE ON FUNCTION public.accept_workspace_invitation_atomic(TEXT, UUID, TEXT) TO authenticated, service_role;",
    );
    expect(migrationSql).toContain(
      "GRANT EXECUTE ON FUNCTION public.accept_business_invitation_atomic(TEXT, UUID, TEXT) TO authenticated, service_role;",
    );
  });

  it("verifies migration content is synchronized into combined_migrations.sql", () => {
    expect(combinedSql).toContain("CREATE TABLE IF NOT EXISTS public.business_invitations");
    expect(combinedSql).toContain("accept_workspace_invitation_atomic");
    expect(combinedSql).toContain("accept_business_invitation_atomic");
  });
});
