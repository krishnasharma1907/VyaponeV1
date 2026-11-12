import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Database Migration: Secure Search Path & Workspace Roles [VO-022]", () => {
  const rootDir = process.cwd();
  const migrationPath = path.join(
    rootDir,
    "supabase",
    "migrations",
    "20261112000003_secure_search_path_and_workspace_roles.sql",
  );

  it("verifies the VO-022 migration file exists", () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
  });

  it("verifies SECURITY DEFINER function sets search_path = '' to eliminate hijacking", () => {
    const content = fs.readFileSync(migrationPath, "utf-8");
    expect(content).toContain("SECURITY DEFINER SET search_path = ''");
  });

  it("verifies all internal function calls and tables are schema-qualified", () => {
    const content = fs.readFileSync(migrationPath, "utf-8");

    // Qualified pg_catalog function calls
    expect(content).toContain("pg_catalog.coalesce");
    expect(content).toContain("pg_catalog.nullif");
    expect(content).toContain("pg_catalog.trim");
    expect(content).toContain("pg_catalog.split_part");
    expect(content).toContain("pg_catalog.now()");

    // Qualified public tables
    expect(content).toContain("public.users");
    expect(content).toContain("public.user_auth_identities");
  });

  it("verifies workspace_members role constraint is expanded for canonical roles", () => {
    const content = fs.readFileSync(migrationPath, "utf-8");
    expect(content).toContain("workspace_members_role_check");
    expect(content).toContain("'workspace_owner'");
    expect(content).toContain("'workspace_admin'");
    expect(content).toContain("'workspace_member'");
    expect(content).toContain("'reseller_admin'");
    expect(content).toContain("'reseller_staff'");
  });

  it("verifies public.workspace_invitations table creation and security properties", () => {
    const content = fs.readFileSync(migrationPath, "utf-8");

    expect(content).toMatch(
      /CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?public\.workspace_invitations/i,
    );
    expect(content).toContain("token_hash TEXT NOT NULL UNIQUE");
    expect(content).toContain("expires_at TIMESTAMPTZ NOT NULL");
    expect(content).toMatch(
      /ALTER\s+TABLE\s+public\.workspace_invitations\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY;/i,
    );
  });
});
