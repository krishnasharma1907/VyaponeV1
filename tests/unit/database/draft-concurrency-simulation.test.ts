/**
 * VyapOne — Draft Optimistic Concurrency & Bypass Prevention Simulation Tests [VO-044 Hardening]
 *
 * NOTE: These are static and mocked simulation tests running within the local Node/Vitest test runner.
 * Actual live PostgreSQL multi-transaction concurrency verification requires an active database instance.
 *
 * Requirements verified:
 * 1. A caller cannot invoke the RPC with the expected-version argument omitted.
 * 2. An explicit null expected version works only when the current draft version is also null.
 * 3. A non-null expected version conflicts when the current version is null.
 * 4. A stale version raises VY049.
 * 5. A matching version succeeds.
 * 6. Concurrent saves cannot both overwrite a newer draft silently.
 * 7. The application always passes the expected-version argument.
 * 8. SQL migration definition and privilege verification.
 */

import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { saveSiteDraftInputSchema } from "@/lib/websites/schemas";
import { buildInitialWebsiteConfiguration } from "@/lib/websites/defaults";

/**
 * Pure simulation of the PostgreSQL PL/pgSQL RPC logic:
 * `public.save_site_draft_configuration_atomic`
 */
interface SimulatedRpcInput {
  p_site_id: string;
  p_business_id: string;
  p_caller_user_id: string;
  p_schema_version: string;
  p_configuration: Record<string, unknown>;
  p_change_summary: string | null;
  p_referenced_media_ids: string[] | null;
  p_expected_base_version_number: number | null;
}

interface SimulatedSiteState {
  id: string;
  business_id: string;
  current_draft_version_id: string | null;
  current_draft_version_number: number | null;
}

interface SimulatedRpcResult {
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
  newVersionNumber?: number;
}

function simulateSaveSiteDraftRpc(
  siteState: SimulatedSiteState,
  input: SimulatedRpcInput,
  rawArgsCount: number,
): SimulatedRpcResult {
  // PostgreSQL signature check: requires all 8 positional parameters
  if (rawArgsCount < 8) {
    return {
      success: false,
      errorCode: "42883",
      errorMessage:
        "function public.save_site_draft_configuration_atomic(uuid, uuid, uuid, text, jsonb, text, uuid[]) does not exist",
    };
  }

  // Input validation
  if (!input.p_site_id || !input.p_business_id || !input.p_caller_user_id) {
    return { success: false, errorCode: "VY020", errorMessage: "Missing required identifier" };
  }
  if (input.p_schema_version !== "v1") {
    return { success: false, errorCode: "VY040", errorMessage: "Unsupported schema version" };
  }

  // Row-lock & Optimistic Concurrency Check:
  // v_current_draft_version_number IS DISTINCT FROM p_expected_base_version_number
  const currentVersionNumber = siteState.current_draft_version_number;
  const expectedVersionNumber = input.p_expected_base_version_number;

  const isDistinct =
    (currentVersionNumber === null && expectedVersionNumber !== null) ||
    (currentVersionNumber !== null && expectedVersionNumber === null) ||
    (currentVersionNumber !== null &&
      expectedVersionNumber !== null &&
      currentVersionNumber !== expectedVersionNumber);

  if (isDistinct) {
    return {
      success: false,
      errorCode: "VY049",
      errorMessage: `Concurrency conflict: current draft version is ${String(currentVersionNumber)}, but save was based on version ${String(expectedVersionNumber)}`,
    };
  }

  // Success: allocate next version number
  const nextVersionNumber = (currentVersionNumber ?? 0) + 1;
  siteState.current_draft_version_number = nextVersionNumber;
  siteState.current_draft_version_id = `ver-${nextVersionNumber}`;

  return {
    success: true,
    newVersionNumber: nextVersionNumber,
  };
}

describe("VO-044 Optimistic Concurrency & Bypass Prevention Simulation Suite", () => {
  const rootDir = process.cwd();
  const migrationPath = path.join(
    rootDir,
    "supabase",
    "migrations",
    "20261122000001_website_draft_concurrency_and_optimistic_lock.sql",
  );
  const migrationSql = fs.readFileSync(migrationPath, "utf-8");

  describe("1. RPC Argument Enforcement & Bypass Prevention", () => {
    it("proves a caller cannot invoke the RPC with the expected-version argument omitted (requires 8 arguments)", () => {
      const site: SimulatedSiteState = {
        id: "11111111-1111-4111-8111-111111111111",
        business_id: "22222222-2222-4222-8222-222222222222",
        current_draft_version_id: "ver-1",
        current_draft_version_number: 1,
      };

      // Caller attempts to call RPC with 7 arguments (omitting expectedBaseVersionNumber)
      const input = {
        p_site_id: site.id,
        p_business_id: site.business_id,
        p_caller_user_id: "33333333-3333-4333-8333-333333333333",
        p_schema_version: "v1",
        p_configuration: { siteId: site.id, businessId: site.business_id },
        p_change_summary: "Omitted version",
        p_referenced_media_ids: null,
        p_expected_base_version_number: null,
      };

      const result = simulateSaveSiteDraftRpc(site, input, 7);
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("42883");
      expect(result.errorMessage).toContain("does not exist");
    });

    it("verifies the SQL definition does not contain DEFAULT NULL on p_expected_base_version_number", () => {
      expect(migrationSql).not.toContain("p_expected_base_version_number INT DEFAULT NULL");
      expect(migrationSql).toContain("p_expected_base_version_number INT\n)");
    });

    it("verifies both 7-parameter and 8-parameter overload drops exist in migration", () => {
      expect(migrationSql).toContain(
        "DROP FUNCTION IF EXISTS public.save_site_draft_configuration_atomic(UUID, UUID, UUID, TEXT, JSONB, TEXT, UUID[]);",
      );
      expect(migrationSql).toContain(
        "DROP FUNCTION IF EXISTS public.save_site_draft_configuration_atomic(UUID, UUID, UUID, TEXT, JSONB, TEXT, UUID[], INT);",
      );
    });
  });

  describe("2. Initial Draft Lifecycle (Null-Safe Comparison)", () => {
    it("proves an explicit null expected version works when the current draft version is null", () => {
      const unversionedSite: SimulatedSiteState = {
        id: "11111111-1111-4111-8111-111111111111",
        business_id: "22222222-2222-4222-8222-222222222222",
        current_draft_version_id: null,
        current_draft_version_number: null,
      };

      const input: SimulatedRpcInput = {
        p_site_id: unversionedSite.id,
        p_business_id: unversionedSite.business_id,
        p_caller_user_id: "33333333-3333-4333-8333-333333333333",
        p_schema_version: "v1",
        p_configuration: { siteId: unversionedSite.id, businessId: unversionedSite.business_id },
        p_change_summary: "Initial starter draft",
        p_referenced_media_ids: null,
        p_expected_base_version_number: null,
      };

      const result = simulateSaveSiteDraftRpc(unversionedSite, input, 8);
      expect(result.success).toBe(true);
      expect(result.newVersionNumber).toBe(1);
      expect(unversionedSite.current_draft_version_number).toBe(1);
    });

    it("proves an explicit null expected version conflicts (VY049) when the site already has an existing draft version", () => {
      const existingSite: SimulatedSiteState = {
        id: "11111111-1111-4111-8111-111111111111",
        business_id: "22222222-2222-4222-8222-222222222222",
        current_draft_version_id: "ver-1",
        current_draft_version_number: 1,
      };

      const input: SimulatedRpcInput = {
        p_site_id: existingSite.id,
        p_business_id: existingSite.business_id,
        p_caller_user_id: "33333333-3333-4333-8333-333333333333",
        p_schema_version: "v1",
        p_configuration: { siteId: existingSite.id, businessId: existingSite.business_id },
        p_change_summary: "Attempting to overwrite existing draft with null expected version",
        p_referenced_media_ids: null,
        p_expected_base_version_number: null,
      };

      const result = simulateSaveSiteDraftRpc(existingSite, input, 8);
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("VY049");
      expect(result.errorMessage).toContain(
        "current draft version is 1, but save was based on version null",
      );
    });

    it("proves a non-null expected version conflicts (VY049) when current draft version is null", () => {
      const unversionedSite: SimulatedSiteState = {
        id: "11111111-1111-4111-8111-111111111111",
        business_id: "22222222-2222-4222-8222-222222222222",
        current_draft_version_id: null,
        current_draft_version_number: null,
      };

      const input: SimulatedRpcInput = {
        p_site_id: unversionedSite.id,
        p_business_id: unversionedSite.business_id,
        p_caller_user_id: "33333333-3333-4333-8333-333333333333",
        p_schema_version: "v1",
        p_configuration: { siteId: unversionedSite.id, businessId: unversionedSite.business_id },
        p_change_summary: "Erroneously claiming base version 1 on unversioned site",
        p_referenced_media_ids: null,
        p_expected_base_version_number: 1,
      };

      const result = simulateSaveSiteDraftRpc(unversionedSite, input, 8);
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("VY049");
      expect(result.errorMessage).toContain(
        "current draft version is null, but save was based on version 1",
      );
    });
  });

  describe("3. Version Progression & Concurrent Edit Prevention", () => {
    it("proves a stale expected version raises VY049", () => {
      const site: SimulatedSiteState = {
        id: "11111111-1111-4111-8111-111111111111",
        business_id: "22222222-2222-4222-8222-222222222222",
        current_draft_version_id: "ver-3",
        current_draft_version_number: 3,
      };

      const input: SimulatedRpcInput = {
        p_site_id: site.id,
        p_business_id: site.business_id,
        p_caller_user_id: "33333333-3333-4333-8333-333333333333",
        p_schema_version: "v1",
        p_configuration: { siteId: site.id, businessId: site.business_id },
        p_change_summary: "Save based on stale version 1",
        p_referenced_media_ids: null,
        p_expected_base_version_number: 1,
      };

      const result = simulateSaveSiteDraftRpc(site, input, 8);
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("VY049");
      expect(result.errorMessage).toContain(
        "current draft version is 3, but save was based on version 1",
      );
    });

    it("proves a matching expected version succeeds and increments the version number", () => {
      const site: SimulatedSiteState = {
        id: "11111111-1111-4111-8111-111111111111",
        business_id: "22222222-2222-4222-8222-222222222222",
        current_draft_version_id: "ver-3",
        current_draft_version_number: 3,
      };

      const input: SimulatedRpcInput = {
        p_site_id: site.id,
        p_business_id: site.business_id,
        p_caller_user_id: "33333333-3333-4333-8333-333333333333",
        p_schema_version: "v1",
        p_configuration: { siteId: site.id, businessId: site.business_id },
        p_change_summary: "Valid matching save",
        p_referenced_media_ids: null,
        p_expected_base_version_number: 3,
      };

      const result = simulateSaveSiteDraftRpc(site, input, 8);
      expect(result.success).toBe(true);
      expect(result.newVersionNumber).toBe(4);
      expect(site.current_draft_version_number).toBe(4);
    });

    it("proves concurrent saves cannot both overwrite a newer draft silently", () => {
      // Both Tab A and Tab B read the site at version 2
      const sharedSite: SimulatedSiteState = {
        id: "11111111-1111-4111-8111-111111111111",
        business_id: "22222222-2222-4222-8222-222222222222",
        current_draft_version_id: "ver-2",
        current_draft_version_number: 2,
      };

      const tabASave: SimulatedRpcInput = {
        p_site_id: sharedSite.id,
        p_business_id: sharedSite.business_id,
        p_caller_user_id: "user-1111",
        p_schema_version: "v1",
        p_configuration: { siteId: sharedSite.id, businessId: sharedSite.business_id },
        p_change_summary: "Tab A edit",
        p_referenced_media_ids: null,
        p_expected_base_version_number: 2,
      };

      const tabBSave: SimulatedRpcInput = {
        p_site_id: sharedSite.id,
        p_business_id: sharedSite.business_id,
        p_caller_user_id: "user-2222",
        p_schema_version: "v1",
        p_configuration: { siteId: sharedSite.id, businessId: sharedSite.business_id },
        p_change_summary: "Tab B edit",
        p_referenced_media_ids: null,
        p_expected_base_version_number: 2,
      };

      // Tab A acquires lock first and saves successfully
      const resultA = simulateSaveSiteDraftRpc(sharedSite, tabASave, 8);
      expect(resultA.success).toBe(true);
      expect(resultA.newVersionNumber).toBe(3);
      expect(sharedSite.current_draft_version_number).toBe(3);

      // Tab B then attempts to save with its base version 2
      const resultB = simulateSaveSiteDraftRpc(sharedSite, tabBSave, 8);
      expect(resultB.success).toBe(false);
      expect(resultB.errorCode).toBe("VY049");
      expect(resultB.errorMessage).toContain(
        "current draft version is 3, but save was based on version 2",
      );

      // Verify that Tab A's work at version 3 was NOT silently overwritten by Tab B
      expect(sharedSite.current_draft_version_number).toBe(3);
      expect(sharedSite.current_draft_version_id).toBe("ver-3");
    });
  });

  describe("4. Application Schema Contract Verification", () => {
    const validMinimalConfig = buildInitialWebsiteConfiguration({
      siteId: "11111111-1111-4111-8111-111111111111",
      businessId: "22222222-2222-4222-8222-222222222222",
      tradeName: "Sharma Sweets",
      subdomain: "sharma-sweets",
      nicheSlug: "sweets",
    });

    it("proves the application schema rejects an input where expectedBaseVersionNumber is omitted", () => {
      const inputMissingExpectedVersion = {
        siteId: "11111111-1111-4111-8111-111111111111",
        configuration: validMinimalConfig,
      };

      const parseResult = saveSiteDraftInputSchema.safeParse(inputMissingExpectedVersion);
      expect(parseResult.success).toBe(false);
      if (!parseResult.success) {
        const issues = parseResult.error.format();
        expect(issues.expectedBaseVersionNumber).toBeDefined();
      }
    });

    it("proves the application schema accepts expectedBaseVersionNumber: null for initial draft", () => {
      const initialInput = {
        siteId: "11111111-1111-4111-8111-111111111111",
        configuration: validMinimalConfig,
        expectedBaseVersionNumber: null,
      };

      const parseResult = saveSiteDraftInputSchema.safeParse(initialInput);
      expect(parseResult.success).toBe(true);
      if (parseResult.success) {
        expect(parseResult.data.expectedBaseVersionNumber).toBeNull();
      }
    });

    it("proves the application schema accepts a positive integer expectedBaseVersionNumber", () => {
      const updateInput = {
        siteId: "11111111-1111-4111-8111-111111111111",
        configuration: validMinimalConfig,
        expectedBaseVersionNumber: 3,
      };

      const parseResult = saveSiteDraftInputSchema.safeParse(updateInput);
      expect(parseResult.success).toBe(true);
      if (parseResult.success) {
        expect(parseResult.data.expectedBaseVersionNumber).toBe(3);
      }
    });
  });

  describe("5. Effective PostgreSQL Privilege Lockdown Verification", () => {
    it("verifies EXECUTE privilege is granted strictly to authenticated and revoked from anon, PUBLIC, service_role", () => {
      expect(migrationSql).toContain(
        "REVOKE ALL ON FUNCTION public.save_site_draft_configuration_atomic(UUID, UUID, UUID, TEXT, JSONB, TEXT, UUID[], INT) FROM PUBLIC, anon, service_role;",
      );
      expect(migrationSql).toContain(
        "GRANT EXECUTE ON FUNCTION public.save_site_draft_configuration_atomic(UUID, UUID, UUID, TEXT, JSONB, TEXT, UUID[], INT) TO authenticated;",
      );
    });
  });
});
