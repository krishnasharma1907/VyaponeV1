/**
 * VyapOne — Final Sites Table Direct INSERT & DELETE Authorization Audit Tests [VO-040]
 *
 * Verifies the effective authorization, capacity protection, and audit integrity
 * of direct INSERT and DELETE operations on public.sites across migration history:
 *
 * 1. Static Migration Tests:
 *    - Verifies 20261120000002_revoke_direct_sites_insert_delete.sql revokes table-level INSERT/DELETE.
 *    - Verifies 20261120000003_revoke_column_insert_and_enforce_restrictive_rls.sql explicitly
 *      revokes column-level INSERT on (id, business_id, subdomain, primary_domain, created_at, updated_at).
 *    - Verifies dedicated AS RESTRICTIVE denial policies installed (WITH CHECK (false), USING (false)).
 *    - Verifies combined_migrations.sql contains all forward migrations.
 *
 * 2. Mocked Policy & Permission Model Tests (PostgreSQL Dual-Tier Privilege & RLS Simulation):
 *    - Column-level privilege revocation verification (closing the pg_attribute.attacl gap).
 *    - Restrictive RLS policy conjunction (AND-combinator across permissive policies).
 *    - Allowed and disallowed site INSERT (preventing draft_websites capacity bypass).
 *    - Allowed and disallowed site DELETE (preventing un-audited destructive deletions).
 *    - Cross-tenant site mutation rejection.
 *    - Audit trail preservation (PRD §17).
 *    - Site-version lifecycle and deletion constraints (ON DELETE RESTRICT).
 *    - Existing authorized website read/write workflows (SELECT and scoped UPDATE preserved).
 */

import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

describe("VO-040 Sites Table Direct INSERT & DELETE Authorization Audit", () => {
  const rootDir = process.cwd();
  const tableRevokeMigrationPath = path.join(
    rootDir,
    "supabase",
    "migrations",
    "20261120000002_revoke_direct_sites_insert_delete.sql",
  );
  const columnRevokeMigrationPath = path.join(
    rootDir,
    "supabase",
    "migrations",
    "20261120000003_revoke_column_insert_and_enforce_restrictive_rls.sql",
  );
  const combinedPath = path.join(rootDir, "supabase", "combined_migrations.sql");

  const tableRevokeSql = fs.readFileSync(tableRevokeMigrationPath, "utf-8");
  const columnRevokeSql = fs.readFileSync(columnRevokeMigrationPath, "utf-8");
  const combinedSql = fs.readFileSync(combinedPath, "utf-8");

  // ============================================================================
  // 1. Static Migration Tests
  // ============================================================================
  describe("1. Static Migration Invariants", () => {
    it("verifies migration files exist and have deterministic timestamps", () => {
      expect(fs.existsSync(tableRevokeMigrationPath)).toBe(true);
      expect(path.basename(tableRevokeMigrationPath)).toMatch(/^\d{14}_[a-z0-9_]+\.sql$/);

      expect(fs.existsSync(columnRevokeMigrationPath)).toBe(true);
      expect(path.basename(columnRevokeMigrationPath)).toMatch(/^\d{14}_[a-z0-9_]+\.sql$/);
      expect(columnRevokeSql.length).toBeGreaterThan(500);
    });

    it("verifies 20261120000002 revokes table-level INSERT and DELETE privileges on public.sites", () => {
      expect(tableRevokeSql).toContain(
        "REVOKE INSERT, DELETE ON public.sites FROM anon, authenticated, PUBLIC;",
      );
      expect(tableRevokeSql).not.toMatch(
        /GRANT (INSERT|DELETE) ON public\.sites TO authenticated/i,
      );
    });

    it("verifies 20261120000003 explicitly revokes historical column-level INSERT privileges", () => {
      // Must explicitly revoke column-level grants from 20261120000001
      expect(columnRevokeSql).toContain("REVOKE INSERT (");
      expect(columnRevokeSql).toContain("id,");
      expect(columnRevokeSql).toContain("business_id,");
      expect(columnRevokeSql).toContain("subdomain,");
      expect(columnRevokeSql).toContain("primary_domain,");
      expect(columnRevokeSql).toContain("created_at,");
      expect(columnRevokeSql).toContain("updated_at");
      expect(columnRevokeSql).toContain(") ON public.sites FROM anon, authenticated, PUBLIC;");
    });

    it("verifies 20261120000003 installs dedicated AS RESTRICTIVE denial policies on public.sites", () => {
      expect(columnRevokeSql).toContain(
        'DROP POLICY IF EXISTS "sites_restrictive_insert_deny" ON public.sites;',
      );
      expect(columnRevokeSql).toContain(
        'DROP POLICY IF EXISTS "sites_restrictive_delete_deny" ON public.sites;',
      );

      // Dedicated Restrictive INSERT denial
      expect(columnRevokeSql).toContain(
        'CREATE POLICY "sites_restrictive_insert_deny" ON public.sites',
      );
      expect(columnRevokeSql).toContain("AS RESTRICTIVE");
      expect(columnRevokeSql).toContain("FOR INSERT");
      expect(columnRevokeSql).toContain("TO anon, authenticated");
      expect(columnRevokeSql).toContain("WITH CHECK (false);");

      // Dedicated Restrictive DELETE denial
      expect(columnRevokeSql).toContain(
        'CREATE POLICY "sites_restrictive_delete_deny" ON public.sites',
      );
      expect(columnRevokeSql).toContain("AS RESTRICTIVE");
      expect(columnRevokeSql).toContain("FOR DELETE");
      expect(columnRevokeSql).toContain("TO anon, authenticated");
      expect(columnRevokeSql).toContain("USING (false);");
    });

    it("verifies approved UPDATE, SELECT, and service_role administrative grants are preserved", () => {
      expect(columnRevokeSql).toContain(
        "GRANT UPDATE (subdomain, primary_domain, updated_at) ON public.sites TO authenticated;",
      );
      expect(columnRevokeSql).toContain("GRANT SELECT ON public.sites TO anon, authenticated;");
      expect(columnRevokeSql).toContain("GRANT ALL ON public.sites TO service_role;");
    });

    it("verifies combined_migrations.sql contains both forward migrations", () => {
      expect(combinedSql).toContain(
        "-- VyapOne Database Migration: 20261120000002_revoke_direct_sites_insert_delete.sql",
      );
      expect(combinedSql).toContain(
        "-- VyapOne Database Migration: 20261120000003_revoke_column_insert_and_enforce_restrictive_rls.sql",
      );
      expect(combinedSql).toContain("sites_restrictive_insert_deny");
      expect(combinedSql).toContain("sites_restrictive_delete_deny");
      expect(combinedSql).toContain("AS RESTRICTIVE");
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
      permissivePolicies: {
        insert: Array<(context: AuthContext, record: Record<string, unknown>) => boolean>;
        update: Array<(context: AuthContext, record: Record<string, unknown>) => boolean>;
        delete: Array<(context: AuthContext, record: Record<string, unknown>) => boolean>;
        select: Array<(context: AuthContext, record: Record<string, unknown>) => boolean>;
      };
      restrictivePolicies: {
        insert: Array<(context: AuthContext, record: Record<string, unknown>) => boolean>;
        update: Array<(context: AuthContext, record: Record<string, unknown>) => boolean>;
        delete: Array<(context: AuthContext, record: Record<string, unknown>) => boolean>;
        select: Array<(context: AuthContext, record: Record<string, unknown>) => boolean>;
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

    // Cumulative PostgreSQL catalog state following migrations 20261120000002 and 20261120000003
    const cumulativeSitesCatalog: Record<"anon" | "authenticated" | "service_role", RoleCatalog> = {
      anon: {
        tablePrivileges: new Set(["SELECT"]),
        columnPrivileges: {
          insert: new Set(),
          update: new Set(),
        },
        permissivePolicies: {
          insert: [() => false], // sites_insert_policy (WITH CHECK false)
          update: [],
          delete: [() => false], // sites_delete_policy (USING false)
          select: [(_ctx, record) => record.status === "published"],
        },
        restrictivePolicies: {
          insert: [() => false], // sites_restrictive_insert_deny (WITH CHECK false)
          update: [],
          delete: [() => false], // sites_restrictive_delete_deny (USING false)
          select: [],
        },
      },
      authenticated: {
        tablePrivileges: new Set(["SELECT"]),
        columnPrivileges: {
          insert: new Set(), // Direct column INSERT explicitly revoked in 20261120000003
          update: new Set(["subdomain", "primary_domain", "updated_at"]), // Scoped UPDATE preserved
        },
        permissivePolicies: {
          insert: [() => false], // sites_insert_policy (WITH CHECK false)
          delete: [() => false], // sites_delete_policy (USING false)
          update: [
            (ctx, record) => !!ctx.canManageBusiness && ctx.businessId === record.business_id,
          ],
          select: [
            (ctx, record) =>
              record.status === "published" ||
              (!!ctx.canManageBusiness && ctx.businessId === record.business_id),
          ],
        },
        restrictivePolicies: {
          insert: [() => false], // sites_restrictive_insert_deny (AS RESTRICTIVE WITH CHECK false)
          delete: [() => false], // sites_restrictive_delete_deny (AS RESTRICTIVE USING false)
          update: [],
          select: [],
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
        permissivePolicies: {
          insert: [() => true],
          update: [() => true],
          delete: [() => true],
          select: [() => true],
        },
        restrictivePolicies: {
          insert: [],
          update: [],
          delete: [],
          select: [],
        },
      },
    };

    /**
     * Executes an INSERT adhering to PostgreSQL standard authorization rules:
     * 1. Privilege Check: Table INSERT OR Column INSERT for all inserted columns.
     * 2. RLS Permissive Policies: Combined with OR (at least one must be true).
     * 3. RLS Restrictive Policies: Combined with AND (all must be true).
     */
    function executeInsert(
      role: "anon" | "authenticated" | "service_role",
      ctx: AuthContext,
      record: Record<string, unknown>,
      additionalPermissivePolicy?: (
        context: AuthContext,
        record: Record<string, unknown>,
      ) => boolean,
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

      // 2. Check Row-Level Security (bypassed by service_role)
      if (role !== "service_role") {
        const permissiveList = [...catalog.permissivePolicies.insert];
        if (additionalPermissivePolicy) {
          permissiveList.push(additionalPermissivePolicy);
        }

        // Permissive policies combine with OR: at least one must pass
        const permissivePass =
          permissiveList.length === 0 || permissiveList.some((p) => p(ctx, record));
        if (!permissivePass) {
          return {
            success: false,
            error: 'new row violates row-level security policy for table "sites" (SQLSTATE 42501)',
          };
        }

        // Restrictive policies combine with AND: all must pass
        const restrictivePass = catalog.restrictivePolicies.insert.every((p) => p(ctx, record));
        if (!restrictivePass) {
          return {
            success: false,
            error:
              'new row violates restrictive row-level security policy for table "sites" (SQLSTATE 42501)',
          };
        }
      }

      return { success: true };
    }

    /**
     * Executes a DELETE adhering to PostgreSQL standard authorization rules:
     * 1. Privilege Check: Table DELETE privilege.
     * 2. RLS Permissive Policies: Combined with OR.
     * 3. RLS Restrictive Policies: Combined with AND.
     */
    function executeDelete(
      role: "anon" | "authenticated" | "service_role",
      ctx: AuthContext,
      record: Record<string, unknown>,
      additionalPermissivePolicy?: (
        context: AuthContext,
        record: Record<string, unknown>,
      ) => boolean,
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
        const permissiveList = [...catalog.permissivePolicies.delete];
        if (additionalPermissivePolicy) {
          permissiveList.push(additionalPermissivePolicy);
        }

        // Permissive policies combine with OR
        const permissivePass =
          permissiveList.length === 0 || permissiveList.some((p) => p(ctx, record));
        if (!permissivePass) {
          return {
            success: false,
            error: 'row violates row-level security policy for table "sites" (SQLSTATE 42501)',
          };
        }

        // Restrictive policies combine with AND
        const restrictivePass = catalog.restrictivePolicies.delete.every((p) => p(ctx, record));
        if (!restrictivePass) {
          return {
            success: false,
            error:
              'row violates restrictive row-level security policy for table "sites" (SQLSTATE 42501)',
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
        const permissivePass = catalog.permissivePolicies.update.some((p) => p(ctx, targetRecord));
        if (!permissivePass) {
          return {
            success: false,
            error: 'row violates row-level security policy for table "sites" (SQLSTATE 42501)',
          };
        }

        const restrictivePass = catalog.restrictivePolicies.update.every((p) =>
          p(ctx, targetRecord),
        );
        if (!restrictivePass) {
          return {
            success: false,
            error:
              'row violates restrictive row-level security policy for table "sites" (SQLSTATE 42501)',
          };
        }
      }

      return { success: true };
    }

    // --------------------------------------------------------------------------
    // A. Column-Level Privilege & Restrictive RLS Conjunction
    // --------------------------------------------------------------------------
    describe("A. Column-Level Privilege & Restrictive RLS Conjunction", () => {
      it("proves column-level INSERT privileges are empty for authenticated role", () => {
        const catalog = cumulativeSitesCatalog.authenticated;
        expect(catalog.columnPrivileges.insert.size).toBe(0);
        expect(catalog.tablePrivileges.has("INSERT")).toBe(false);
      });

      it("proves restrictive RLS policy blocks INSERT even if another permissive policy allows it", () => {
        // Assume an adversary or buggy migration injected a permissive policy that returns true:
        const permissiveBypass = () => true;

        const ctx: AuthContext = {
          role: "authenticated",
          userId: "user-1",
          businessId: "biz-1",
          canManageBusiness: true,
        };

        // Temporarily simulate having column-level privileges to isolate RLS evaluation:
        const originalInsertCols = new Set(
          cumulativeSitesCatalog.authenticated.columnPrivileges.insert,
        );
        cumulativeSitesCatalog.authenticated.columnPrivileges.insert = new Set([
          "id",
          "business_id",
          "subdomain",
          "created_at",
          "updated_at",
        ]);

        try {
          const result = executeInsert(
            "authenticated",
            ctx,
            {
              id: "00000000-0000-0000-0000-000000000001",
              business_id: "biz-1",
              subdomain: "adversary-site",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            permissiveBypass,
          );

          // Must be rejected by the RESTRICTIVE policy despite the permissive bypass!
          expect(result.success).toBe(false);
          expect(result.error).toContain(
            'new row violates restrictive row-level security policy for table "sites"',
          );
        } finally {
          cumulativeSitesCatalog.authenticated.columnPrivileges.insert = originalInsertCols;
        }
      });

      it("proves restrictive RLS policy blocks DELETE even if another permissive policy allows it", () => {
        const permissiveBypass = () => true;

        const ctx: AuthContext = {
          role: "authenticated",
          userId: "owner-1",
          businessId: "biz-1",
          isSovereignOwner: true,
          canManageBusiness: true,
        };

        // Temporarily simulate having table DELETE privilege to isolate RLS evaluation:
        cumulativeSitesCatalog.authenticated.tablePrivileges.add("DELETE");

        try {
          const result = executeDelete(
            "authenticated",
            ctx,
            {
              id: "site-1",
              business_id: "biz-1",
              status: "draft",
            },
            permissiveBypass,
          );

          // Must be rejected by the RESTRICTIVE policy despite the permissive bypass!
          expect(result.success).toBe(false);
          expect(result.error).toContain(
            'row violates restrictive row-level security policy for table "sites"',
          );
        } finally {
          cumulativeSitesCatalog.authenticated.tablePrivileges.delete("DELETE");
        }
      });
    });

    // --------------------------------------------------------------------------
    // B. Direct INSERT Authorization & Capacity Protection
    // --------------------------------------------------------------------------
    describe("B. Direct INSERT Authorization & Capacity Protection", () => {
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
    // C. Direct DELETE Authorization & Lifecycle Integrity
    // --------------------------------------------------------------------------
    describe("C. Direct DELETE Authorization & Lifecycle Integrity", () => {
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
        const site = {
          id: "site-1",
          current_draft_version_id: "version-1",
        };

        const canDeleteReferencedVersion = (versionId: string): boolean => {
          if (site.current_draft_version_id === versionId) {
            return false;
          }
          return true;
        };

        expect(canDeleteReferencedVersion("version-1")).toBe(false);
        expect(canDeleteReferencedVersion("version-old-unreferenced")).toBe(true);
      });
    });

    // --------------------------------------------------------------------------
    // D. Existing Authorized Website Read/Write Workflows
    // --------------------------------------------------------------------------
    describe("D. Existing Authorized Website Read/Write Workflows", () => {
      it("preserves legitimate SELECT permissions for public storefronts (anon)", () => {
        const anonCtx: AuthContext = { role: "anon" };
        const publishedSite = { id: "site-1", business_id: "biz-1", status: "published" };
        const draftSite = { id: "site-2", business_id: "biz-1", status: "draft" };

        const catalog = cumulativeSitesCatalog.anon;
        expect(catalog.tablePrivileges.has("SELECT")).toBe(true);
        expect(catalog.permissivePolicies.select.some((p) => p(anonCtx, publishedSite))).toBe(true);
        expect(catalog.permissivePolicies.select.some((p) => p(anonCtx, draftSite))).toBe(false);
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
        expect(catalog.permissivePolicies.select.some((p) => p(authCtx, draftSite))).toBe(true);
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
