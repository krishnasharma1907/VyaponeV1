/**
 * VyapOne — Final Sites Table Direct INSERT & DELETE Authorization Audit Tests [VO-040]
 *
 * Verifies the effective authorization, capacity protection, and audit integrity
 * of direct INSERT and DELETE operations on public.sites across migration history:
 *
 * 1. Static Migration Tests:
 *    - Verifies 20261120000002_revoke_direct_sites_insert_delete.sql revokes INSERT and DELETE
 *      on public.sites from untrusted roles (anon, authenticated, PUBLIC).
 *    - Verifies restrictive RLS policies installed (WITH CHECK (false), USING (false)).
 *    - Verifies combined_migrations.sql contains the forward migration.
 *
 * 2. Mocked Policy & Permission Model Tests:
 *    - Allowed and disallowed site INSERT (preventing draft_websites capacity bypass).
 *    - Allowed and disallowed site DELETE (preventing un-audited destructive deletions).
 *    - Cross-tenant site deletion rejection.
 *    - Audit trail requirements (PRD §17).
 *    - Site-version lifecycle and deletion constraints (ON DELETE RESTRICT, immutability trigger).
 *    - Existing authorized website read/write workflows (SELECT and scoped UPDATE preserved).
 */

import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

describe("VO-040 Sites Table Direct INSERT & DELETE Authorization Audit", () => {
  const rootDir = process.cwd();
  const revokeMigrationPath = path.join(
    rootDir,
    "supabase",
    "migrations",
    "20261120000002_revoke_direct_sites_insert_delete.sql",
  );
  const combinedPath = path.join(rootDir, "supabase", "combined_migrations.sql");

  const revokeSql = fs.readFileSync(revokeMigrationPath, "utf-8");
  const combinedSql = fs.readFileSync(combinedPath, "utf-8");

  // ============================================================================
  // 1. Static Migration Tests
  // ============================================================================
  describe("1. Static Migration Invariants (20261120000002)", () => {
    it("revokes direct INSERT and DELETE privileges on public.sites from untrusted roles", () => {
      expect(revokeSql).toContain(
        "REVOKE INSERT, DELETE ON public.sites FROM anon, authenticated, PUBLIC;",
      );
      expect(revokeSql).not.toMatch(/GRANT (INSERT|DELETE) ON public\.sites TO authenticated/i);
      expect(revokeSql).not.toMatch(/GRANT (INSERT|DELETE) ON public\.sites TO anon/i);
      expect(revokeSql).not.toMatch(/GRANT (INSERT|DELETE) ON public\.sites TO PUBLIC/i);
    });

    it("replaces permissive RLS policies with explicit restrictive policies on public.sites", () => {
      expect(revokeSql).toContain('DROP POLICY IF EXISTS "sites_insert_policy" ON public.sites;');
      expect(revokeSql).toContain('DROP POLICY IF EXISTS "sites_delete_policy" ON public.sites;');

      // Restrictive INSERT policy
      expect(revokeSql).toContain('CREATE POLICY "sites_insert_policy" ON public.sites');
      expect(revokeSql).toContain("FOR INSERT");
      expect(revokeSql).toContain("TO authenticated, anon");
      expect(revokeSql).toContain("WITH CHECK (false);");

      // Restrictive DELETE policy
      expect(revokeSql).toContain('CREATE POLICY "sites_delete_policy" ON public.sites');
      expect(revokeSql).toContain("FOR DELETE");
      expect(revokeSql).toContain("TO authenticated, anon");
      expect(revokeSql).toContain("USING (false);");
    });

    it("confirms service_role maintains full administrative privileges", () => {
      expect(revokeSql).toContain("GRANT ALL ON public.sites TO service_role;");
    });

    it("verifies combined_migrations.sql contains the forward-only revocation migration", () => {
      expect(combinedSql).toContain(
        "-- VyapOne Database Migration: 20261120000002_revoke_direct_sites_insert_delete.sql",
      );
      expect(combinedSql).toContain(
        "REVOKE INSERT, DELETE ON public.sites FROM anon, authenticated, PUBLIC;",
      );
      expect(combinedSql).toContain("WITH CHECK (false);");
      expect(combinedSql).toContain("USING (false);");
    });
  });

  // ============================================================================
  // 2. Mocked Policy & Privilege Engine Tests
  // ============================================================================
  describe("2. Mocked Policy & Permission Engine Simulation", () => {
    interface RoleCatalog {
      tablePrivileges: Set<string>;
      columnPrivileges: {
        insert: Set<string>;
        update: Set<string>;
      };
      rlsPolicies: {
        insert: (context: AuthContext, record: Record<string, unknown>) => boolean;
        update: (context: AuthContext, record: Record<string, unknown>) => boolean;
        delete: (context: AuthContext, record: Record<string, unknown>) => boolean;
        select: (context: AuthContext, record: Record<string, unknown>) => boolean;
      };
    }

    interface AuthContext {
      role: "anon" | "authenticated" | "service_role";
      userId?: string;
      businessId?: string;
      workspaceId?: string;
      isSovereignOwner?: boolean;
      canManageBusiness?: boolean;
    }

    // Cumulative PostgreSQL catalog state following migration 20261120000002
    const cumulativeSitesCatalog: Record<"anon" | "authenticated" | "service_role", RoleCatalog> = {
      anon: {
        tablePrivileges: new Set(["SELECT"]),
        columnPrivileges: {
          insert: new Set(),
          update: new Set(),
        },
        rlsPolicies: {
          insert: () => false,
          update: () => false,
          delete: () => false,
          select: (_ctx, record) => record.status === "published",
        },
      },
      authenticated: {
        // Both INSERT and DELETE are stripped at the table level
        tablePrivileges: new Set(["SELECT"]),
        columnPrivileges: {
          insert: new Set(), // Direct column INSERT revoked
          update: new Set(["subdomain", "primary_domain", "updated_at"]), // Scoped UPDATE preserved
        },
        rlsPolicies: {
          insert: () => false, // RLS sites_insert_policy: WITH CHECK (false)
          delete: () => false, // RLS sites_delete_policy: USING (false)
          update: (ctx, record) => !!ctx.canManageBusiness && ctx.businessId === record.business_id,
          select: (ctx, record) =>
            record.status === "published" ||
            (!!ctx.canManageBusiness && ctx.businessId === record.business_id),
        },
      },
      service_role: {
        tablePrivileges: new Set(["SELECT", "INSERT", "UPDATE", "DELETE", "ALL"]),
        columnPrivileges: {
          insert: new Set([
            "id",
            "business_id",
            "subdomain",
            "primary_domain",
            "status",
            "created_at",
            "updated_at",
          ]),
          update: new Set(["subdomain", "primary_domain", "status", "updated_at"]),
        },
        rlsPolicies: {
          // service_role bypasses RLS
          insert: () => true,
          update: () => true,
          delete: () => true,
          select: () => true,
        },
      },
    };

    function executeInsert(
      role: "anon" | "authenticated" | "service_role",
      ctx: AuthContext,
      record: Record<string, unknown>,
    ): { success: boolean; error?: string } {
      const catalog = cumulativeSitesCatalog[role];

      // 1. Check Table/Column SQL Privileges
      const hasTableInsert =
        catalog.tablePrivileges.has("ALL") || catalog.tablePrivileges.has("INSERT");
      if (!hasTableInsert) {
        const columns = Object.keys(record);
        const hasAllColumns =
          columns.length > 0 && columns.every((c) => catalog.columnPrivileges.insert.has(c));
        if (!hasAllColumns) {
          return {
            success: false,
            error: 'permission denied for table "sites" (SQLSTATE 42501)',
          };
        }
      }

      // 2. Check Row-Level Security
      if (role !== "service_role") {
        if (!catalog.rlsPolicies.insert(ctx, record)) {
          return {
            success: false,
            error: 'new row violates row-level security policy for table "sites" (SQLSTATE 42501)',
          };
        }
      }

      return { success: true };
    }

    function executeDelete(
      role: "anon" | "authenticated" | "service_role",
      ctx: AuthContext,
      record: Record<string, unknown>,
    ): { success: boolean; error?: string } {
      const catalog = cumulativeSitesCatalog[role];

      // 1. Check Table SQL Privileges
      const hasTableDelete =
        catalog.tablePrivileges.has("ALL") || catalog.tablePrivileges.has("DELETE");
      if (!hasTableDelete) {
        return {
          success: false,
          error: 'permission denied for table "sites" (SQLSTATE 42501)',
        };
      }

      // 2. Check Row-Level Security
      if (role !== "service_role") {
        if (!catalog.rlsPolicies.delete(ctx, record)) {
          return {
            success: false,
            error: 'row violates row-level security policy for table "sites" (SQLSTATE 42501)',
          };
        }
      }

      return { success: true };
    }

    function executeUpdate(
      role: "anon" | "authenticated" | "service_role",
      ctx: AuthContext,
      targetRecord: Record<string, unknown>,
      updates: Record<string, unknown>,
    ): { success: boolean; error?: string } {
      const catalog = cumulativeSitesCatalog[role];

      // 1. Check Table/Column SQL Privileges
      const hasTableUpdate =
        catalog.tablePrivileges.has("ALL") || catalog.tablePrivileges.has("UPDATE");
      if (!hasTableUpdate) {
        const columns = Object.keys(updates);
        const hasAllColumns =
          columns.length > 0 && columns.every((c) => catalog.columnPrivileges.update.has(c));
        if (!hasAllColumns) {
          return {
            success: false,
            error: 'permission denied for column of relation "sites" (SQLSTATE 42501)',
          };
        }
      }

      // 2. Check Row-Level Security
      if (role !== "service_role") {
        if (!catalog.rlsPolicies.update(ctx, targetRecord)) {
          return {
            success: false,
            error: 'row violates row-level security policy for table "sites" (SQLSTATE 42501)',
          };
        }
      }

      return { success: true };
    }

    // --------------------------------------------------------------------------
    // A. Direct INSERT Authorization & Capacity Bypass Prevention
    // --------------------------------------------------------------------------
    describe("A. Direct INSERT Authorization & Capacity Protection", () => {
      it("rejects direct site INSERT by authenticated business manager with permission denied", () => {
        const ctx: AuthContext = {
          role: "authenticated",
          userId: "user-1",
          businessId: "biz-1",
          workspaceId: "ws-1",
          canManageBusiness: true,
        };

        const result = executeInsert("authenticated", ctx, {
          business_id: "biz-1",
          subdomain: "unauthorized-draft-site",
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('permission denied for table "sites"');
      });

      it("rejects direct site INSERT even if caller is sovereign business owner", () => {
        const ctx: AuthContext = {
          role: "authenticated",
          userId: "owner-1",
          businessId: "biz-1",
          workspaceId: "ws-1",
          isSovereignOwner: true,
          canManageBusiness: true,
        };

        const result = executeInsert("authenticated", ctx, {
          business_id: "biz-1",
          subdomain: "sovereign-extra-site",
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('permission denied for table "sites"');
      });

      it("demonstrates capacity protection: untrusted caller cannot bypass draft_websites limits", () => {
        // If direct INSERT were permitted, an authenticated tenant could create unlimited draft sites
        // exceeding workspace capacity without invoking assert_and_lock_workspace_capacity.
        // Revocation strictly forces site provisioning through server-controlled workflows.
        const ctx: AuthContext = {
          role: "authenticated",
          userId: "user-1",
          businessId: "biz-1",
          workspaceId: "ws-1",
          canManageBusiness: true,
        };

        for (let i = 1; i <= 20; i++) {
          const result = executeInsert("authenticated", ctx, {
            business_id: "biz-1",
            subdomain: `quota-bypass-${i}`,
          });
          expect(result.success).toBe(false);
        }
      });

      it("demonstrates audit protection: direct INSERT lacks audit logging and is forbidden", () => {
        // Direct table inserts on public.sites do not trigger audit log creation.
        // Legitimate site creation occurs through trusted server procedures that record audit logs.
        const ctx: AuthContext = {
          role: "authenticated",
          userId: "user-1",
          businessId: "biz-1",
          canManageBusiness: true,
        };

        const result = executeInsert("authenticated", ctx, {
          business_id: "biz-1",
          subdomain: "unaudited-site",
        });
        expect(result.success).toBe(false);
      });
    });

    // --------------------------------------------------------------------------
    // B. Direct DELETE Authorization & Destructive Operation Prevention
    // --------------------------------------------------------------------------
    describe("B. Direct DELETE Authorization & Lifecycle Integrity", () => {
      it("rejects direct site DELETE by authenticated business manager with permission denied", () => {
        const ctx: AuthContext = {
          role: "authenticated",
          userId: "manager-1",
          businessId: "biz-1",
          canManageBusiness: true,
        };

        const result = executeDelete("authenticated", ctx, {
          id: "site-1",
          business_id: "biz-1",
          status: "draft",
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('permission denied for table "sites"');
      });

      it("rejects direct site DELETE even by sovereign owner (PRD soft-lifecycle invariant)", () => {
        // Per PRD §9.2 and §17, sites follow a soft lifecycle (draft -> published -> suspended -> archived).
        // Hard deletion destroys audit trail and is prohibited from client execution.
        const ctx: AuthContext = {
          role: "authenticated",
          userId: "owner-1",
          businessId: "biz-1",
          isSovereignOwner: true,
          canManageBusiness: true,
        };

        const result = executeDelete("authenticated", ctx, {
          id: "site-1",
          business_id: "biz-1",
          status: "draft",
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('permission denied for table "sites"');
      });

      it("rejects cross-tenant site DELETE", () => {
        const ctx: AuthContext = {
          role: "authenticated",
          userId: "attacker-1",
          businessId: "biz-attacker",
          canManageBusiness: true,
        };

        const result = executeDelete("authenticated", ctx, {
          id: "site-victim",
          business_id: "biz-victim",
          status: "draft",
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('permission denied for table "sites"');
      });

      it("preserves site-version integrity: active versions cannot be deleted while referenced", () => {
        // Under ON DELETE RESTRICT on fk_sites_current_draft_version and fk_sites_published_version:
        // A version cannot be deleted while pointed to by a site record.
        const site = {
          id: "site-1",
          current_draft_version_id: "version-1",
        };

        const canDeleteReferencedVersion = (versionId: string): boolean => {
          if (site.current_draft_version_id === versionId) {
            return false; // ON DELETE RESTRICT blocks deletion
          }
          return true;
        };

        expect(canDeleteReferencedVersion("version-1")).toBe(false);
        expect(canDeleteReferencedVersion("version-old-unreferenced")).toBe(true);
      });
    });

    // --------------------------------------------------------------------------
    // C. Existing Authorized Website Read/Write Workflows
    // --------------------------------------------------------------------------
    describe("C. Existing Authorized Website Read/Write Workflows", () => {
      it("preserves legitimate SELECT permissions for public storefronts (anon)", () => {
        const anonCtx: AuthContext = { role: "anon" };
        const publishedSite = { id: "site-1", business_id: "biz-1", status: "published" };
        const draftSite = { id: "site-2", business_id: "biz-1", status: "draft" };

        const catalog = cumulativeSitesCatalog.anon;
        expect(catalog.tablePrivileges.has("SELECT")).toBe(true);
        expect(catalog.rlsPolicies.select(anonCtx, publishedSite)).toBe(true);
        expect(catalog.rlsPolicies.select(anonCtx, draftSite)).toBe(false); // Drafts hidden from public
      });

      it("preserves legitimate SELECT permissions for authenticated business operators", () => {
        const authCtx: AuthContext = {
          role: "authenticated",
          userId: "user-1",
          businessId: "biz-1",
          canManageBusiness: true,
        };
        const draftSite = { id: "site-1", business_id: "biz-1", status: "draft" };

        const catalog = cumulativeSitesCatalog.authenticated;
        expect(catalog.tablePrivileges.has("SELECT")).toBe(true);
        expect(catalog.rlsPolicies.select(authCtx, draftSite)).toBe(true);
      });

      it("preserves scoped UPDATE on permitted columns (subdomain, primary_domain, updated_at)", () => {
        const authCtx: AuthContext = {
          role: "authenticated",
          userId: "user-1",
          businessId: "biz-1",
          canManageBusiness: true,
        };
        const targetSite = { id: "site-1", business_id: "biz-1" };

        const result = executeUpdate("authenticated", authCtx, targetSite, {
          subdomain: "new-subdomain",
          primary_domain: "example.com",
          updated_at: new Date().toISOString(),
        });

        expect(result.success).toBe(true);
      });

      it("rejects direct UPDATE on prohibited columns (status, business_id, version pointers)", () => {
        const authCtx: AuthContext = {
          role: "authenticated",
          userId: "user-1",
          businessId: "biz-1",
          canManageBusiness: true,
        };
        const targetSite = { id: "site-1", business_id: "biz-1" };

        // Prohibited status update
        const statusResult = executeUpdate("authenticated", authCtx, targetSite, {
          status: "published",
        });
        expect(statusResult.success).toBe(false);
        expect(statusResult.error).toContain('permission denied for column of relation "sites"');

        // Prohibited business_id update
        const bizResult = executeUpdate("authenticated", authCtx, targetSite, {
          business_id: "other-biz",
        });
        expect(bizResult.success).toBe(false);

        // Prohibited version pointer update
        const draftPointerResult = executeUpdate("authenticated", authCtx, targetSite, {
          current_draft_version_id: "00000000-0000-0000-0000-000000000001",
        });
        expect(draftPointerResult.success).toBe(false);
      });

      it("confirms service_role retains full administrative capabilities for system lifecycle orchestration", () => {
        const serviceCtx: AuthContext = { role: "service_role" };
        const newSite = {
          id: "site-sys-1",
          business_id: "biz-sys-1",
          subdomain: "sys-store",
          status: "draft",
        };

        const insertResult = executeInsert("service_role", serviceCtx, newSite);
        expect(insertResult.success).toBe(true);

        const deleteResult = executeDelete("service_role", serviceCtx, newSite);
        expect(deleteResult.success).toBe(true);
      });
    });
  });
});
