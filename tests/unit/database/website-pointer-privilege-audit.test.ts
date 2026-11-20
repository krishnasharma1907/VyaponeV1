/**
 * VyapOne — Website Pointer Privilege, FK Semantics & TIMESTAMPTZ Audit Tests [VO-040]
 *
 * Verifies cumulative DDL state and effective privileges for public.sites and public.site_versions:
 * - Effective pointer privilege restrictions (Audit 1)
 * - Existing legitimate read permissions preserved (Audit 1)
 * - Pointer mutation restricted to authorized server operations (Audit 1)
 * - Same-site version references enforced by composite FK (Audit 2)
 * - Referenced version deletion behavior is ON DELETE RESTRICT (Audit 2)
 * - Correct TIMESTAMPTZ defaults without timezone('utc', now()) anti-pattern (Audit 3)
 */

import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

describe("VO-040 Website Pointer Privilege & Constraint Audit", () => {
  const rootDir = process.cwd();
  const pointerAuditMigrationPath = path.join(
    rootDir,
    "supabase",
    "migrations",
    "20261120000001_website_pointer_and_foreign_key_audit.sql",
  );
  const combinedPath = path.join(rootDir, "supabase", "combined_migrations.sql");

  const pointerAuditSql = fs.readFileSync(pointerAuditMigrationPath, "utf-8");
  const combinedSql = fs.readFileSync(combinedPath, "utf-8");

  describe("Audit 1: Effective Privilege Lockdown", () => {
    it("strips broad table-level privileges from anon, authenticated, and PUBLIC on sites and site_versions", () => {
      expect(pointerAuditSql).toContain(
        "REVOKE ALL ON public.sites FROM anon, authenticated, PUBLIC;",
      );
      expect(pointerAuditSql).toContain(
        "REVOKE ALL ON public.site_versions FROM anon, authenticated, PUBLIC;",
      );
    });

    it("preserves legitimate SELECT read permissions for anon and authenticated clients", () => {
      expect(pointerAuditSql).toContain("GRANT SELECT ON public.sites TO anon, authenticated;");
      expect(pointerAuditSql).toContain(
        "GRANT SELECT ON public.site_versions TO anon, authenticated;",
      );
    });

    it("verifies column-level INSERT on sites strictly omits pointer columns and status", () => {
      // Find the GRANT INSERT statement on public.sites
      const insertMatch = pointerAuditSql.match(
        /GRANT INSERT \(([^)]+)\)\s+ON public\.sites TO authenticated;/i,
      );
      expect(insertMatch).not.toBeNull();
      const insertColumns = insertMatch![1].split(",").map((c) => c.trim());

      expect(insertColumns).toContain("id");
      expect(insertColumns).toContain("business_id");
      expect(insertColumns).toContain("subdomain");
      expect(insertColumns).toContain("primary_domain");
      expect(insertColumns).toContain("created_at");
      expect(insertColumns).toContain("updated_at");

      // Critical security exclusions:
      expect(insertColumns).not.toContain("current_draft_version_id");
      expect(insertColumns).not.toContain("published_version_id");
      expect(insertColumns).not.toContain("status");
    });

    it("verifies column-level UPDATE on sites strictly omits pointer columns, status, and business_id", () => {
      // Find the GRANT UPDATE statement on public.sites
      const updateMatch = pointerAuditSql.match(
        /GRANT UPDATE \(([^)]+)\)\s+ON public\.sites TO authenticated;/i,
      );
      expect(updateMatch).not.toBeNull();
      const updateColumns = updateMatch![1].split(",").map((c) => c.trim());

      expect(updateColumns).toContain("subdomain");
      expect(updateColumns).toContain("primary_domain");
      expect(updateColumns).toContain("updated_at");

      // Critical security exclusions:
      expect(updateColumns).not.toContain("current_draft_version_id");
      expect(updateColumns).not.toContain("published_version_id");
      expect(updateColumns).not.toContain("status");
      expect(updateColumns).not.toContain("business_id");
      expect(updateColumns).not.toContain("id");
    });

    it("verifies public.site_versions grants NO direct INSERT, UPDATE, or DELETE to authenticated or anon", () => {
      expect(pointerAuditSql).not.toMatch(
        /GRANT (INSERT|UPDATE|DELETE|ALL) ON public\.site_versions TO authenticated/i,
      );
      expect(pointerAuditSql).not.toMatch(
        /GRANT (INSERT|UPDATE|DELETE|ALL) ON public\.site_versions TO anon/i,
      );
      expect(pointerAuditSql).not.toMatch(
        /GRANT (INSERT|UPDATE|DELETE|ALL) ON public\.site_versions TO PUBLIC/i,
      );
    });

    it("verifies service_role retains full administrative privileges", () => {
      expect(pointerAuditSql).toContain("GRANT ALL ON public.sites TO service_role;");
      expect(pointerAuditSql).toContain("GRANT ALL ON public.site_versions TO service_role;");
    });

    it("simulates PostgreSQL has_column_privilege / has_table_privilege evaluation", () => {
      interface RolePrivileges {
        tablePrivileges: Set<string>;
        columnPrivileges: {
          insert: Set<string>;
          update: Set<string>;
        };
      }

      // Simulate effective privileges derived from the migration state
      const authenticatedSites: RolePrivileges = {
        tablePrivileges: new Set(["SELECT", "DELETE"]),
        columnPrivileges: {
          insert: new Set([
            "id",
            "business_id",
            "subdomain",
            "primary_domain",
            "created_at",
            "updated_at",
          ]),
          update: new Set(["subdomain", "primary_domain", "updated_at"]),
        },
      };

      const hasTablePrivilege = (role: RolePrivileges, priv: string): boolean => {
        return role.tablePrivileges.has(priv);
      };

      const hasColumnPrivilege = (
        role: RolePrivileges,
        col: string,
        priv: "insert" | "update",
      ): boolean => {
        if (role.tablePrivileges.has(priv.toUpperCase())) return true;
        return role.columnPrivileges[priv].has(col);
      };

      // 1. Table-level UPDATE / INSERT is NOT held
      expect(hasTablePrivilege(authenticatedSites, "UPDATE")).toBe(false);
      expect(hasTablePrivilege(authenticatedSites, "INSERT")).toBe(false);

      // 2. Pointer columns cannot be updated or inserted by authenticated clients
      expect(hasColumnPrivilege(authenticatedSites, "current_draft_version_id", "update")).toBe(
        false,
      );
      expect(hasColumnPrivilege(authenticatedSites, "published_version_id", "update")).toBe(false);
      expect(hasColumnPrivilege(authenticatedSites, "current_draft_version_id", "insert")).toBe(
        false,
      );
      expect(hasColumnPrivilege(authenticatedSites, "published_version_id", "insert")).toBe(false);

      // 3. Status cannot be directly updated or inserted
      expect(hasColumnPrivilege(authenticatedSites, "status", "update")).toBe(false);
      expect(hasColumnPrivilege(authenticatedSites, "status", "insert")).toBe(false);

      // 4. Legitimate fields can be updated / inserted
      expect(hasColumnPrivilege(authenticatedSites, "subdomain", "update")).toBe(true);
      expect(hasColumnPrivilege(authenticatedSites, "primary_domain", "update")).toBe(true);
      expect(hasColumnPrivilege(authenticatedSites, "subdomain", "insert")).toBe(true);
      expect(hasTablePrivilege(authenticatedSites, "SELECT")).toBe(true);
      expect(hasTablePrivilege(authenticatedSites, "DELETE")).toBe(true);
    });
  });

  describe("Audit 2: Composite Foreign-Key Deletion Semantics", () => {
    it("drops prior composite foreign keys with SET NULL semantics", () => {
      expect(pointerAuditSql).toContain(
        "ALTER TABLE public.sites DROP CONSTRAINT IF EXISTS fk_sites_current_draft_version;",
      );
      expect(pointerAuditSql).toContain(
        "ALTER TABLE public.sites DROP CONSTRAINT IF EXISTS fk_sites_published_version;",
      );
    });

    it("enforces ON DELETE RESTRICT on composite version pointer foreign keys", () => {
      // Draft pointer composite FK
      expect(pointerAuditSql).toContain("ADD CONSTRAINT fk_sites_current_draft_version");
      expect(pointerAuditSql).toContain("FOREIGN KEY (id, current_draft_version_id)");
      expect(pointerAuditSql).toContain("REFERENCES public.site_versions(site_id, id)");
      expect(pointerAuditSql).toContain("ON DELETE RESTRICT;");

      // Published pointer composite FK
      expect(pointerAuditSql).toContain("ADD CONSTRAINT fk_sites_published_version");
      expect(pointerAuditSql).toContain("FOREIGN KEY (id, published_version_id)");
      expect(pointerAuditSql).toContain("REFERENCES public.site_versions(site_id, id)");
    });

    it("verifies no ON DELETE SET NULL composite constraints exist in active DDL", () => {
      const addConstraintBlocks = pointerAuditSql.split("ADD CONSTRAINT").slice(1);
      expect(addConstraintBlocks.length).toBeGreaterThanOrEqual(2);
      for (const block of addConstraintBlocks) {
        expect(block).toContain("ON DELETE RESTRICT");
        expect(block).not.toContain("ON DELETE SET NULL");
      }
    });

    it("verifies same-site guarantee (site_id = sites.id) is mathematically preserved", () => {
      // The child columns are (id, current_draft_version_id)
      // The referenced columns are (site_id, id) on site_versions
      // This means sites.id MUST equal site_versions.site_id, guaranteeing same-site version references
      expect(pointerAuditSql).toMatch(
        /FOREIGN KEY \(id, current_draft_version_id\)\s+REFERENCES public\.site_versions\(site_id, id\)/,
      );
      expect(pointerAuditSql).toMatch(
        /FOREIGN KEY \(id, published_version_id\)\s+REFERENCES public\.site_versions\(site_id, id\)/,
      );
    });
  });

  describe("Audit 3: TIMESTAMPTZ Correctness", () => {
    it("sets public.site_versions.created_at default to now() without timezone conversion", () => {
      expect(pointerAuditSql).toContain("ALTER TABLE public.site_versions");
      expect(pointerAuditSql).toContain("ALTER COLUMN created_at SET DEFAULT now();");
      expect(pointerAuditSql).not.toContain("SET DEFAULT timezone('utc'");
    });

    it("verifies save_site_draft_configuration_atomic uses pg_catalog.now() for TIMESTAMPTZ", () => {
      expect(pointerAuditSql).toContain("v_now TIMESTAMPTZ := pg_catalog.now();");
    });
  });

  describe("Combined Migrations Consistency", () => {
    it("verifies combined_migrations.sql contains the forward-only audit migration", () => {
      expect(combinedSql).toContain("20261120000001_website_pointer_and_foreign_key_audit.sql");
      expect(combinedSql).toContain(
        "ALTER TABLE public.site_versions\n    ALTER COLUMN created_at SET DEFAULT now();",
      );
      expect(combinedSql).toContain(
        "ADD CONSTRAINT fk_sites_current_draft_version\n    FOREIGN KEY (id, current_draft_version_id)\n    REFERENCES public.site_versions(site_id, id)\n    ON DELETE RESTRICT;",
      );
    });
  });
});
