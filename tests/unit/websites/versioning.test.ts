import { describe, expect, it } from "vitest";
import {
  CURRENT_SCHEMA_VERSION,
  detectConfigurationVersion,
  isSupportedSchemaVersion,
  migrateWebsiteConfiguration,
  SUPPORTED_SCHEMA_VERSIONS,
} from "@/lib/websites/versioning";
import { buildInitialWebsiteConfiguration } from "@/lib/websites/defaults";

describe("VO-040 Website Configuration Versioning Engine", () => {
  const validSiteId = "11111111-1111-4111-8111-111111111111";
  const validBusinessId = "22222222-2222-4222-8222-222222222222";

  const sampleV1Config = buildInitialWebsiteConfiguration({
    siteId: validSiteId,
    businessId: validBusinessId,
    tradeName: "Mumbai Chaat Hub",
    subdomain: "mumbaichaathub",
  });

  describe("version constants and detection", () => {
    it("reports CURRENT_SCHEMA_VERSION as 'v1'", () => {
      expect(CURRENT_SCHEMA_VERSION).toBe("v1");
      expect(SUPPORTED_SCHEMA_VERSIONS).toContain("v1");
    });

    it("isSupportedSchemaVersion returns true for 'v1' and false for unsupported versions", () => {
      expect(isSupportedSchemaVersion("v1")).toBe(true);
      expect(isSupportedSchemaVersion("v2")).toBe(false);
      expect(isSupportedSchemaVersion("beta")).toBe(false);
      expect(isSupportedSchemaVersion(null)).toBe(false);
      expect(isSupportedSchemaVersion(1)).toBe(false);
    });

    it("detects configuration version from schemaVersion property", () => {
      expect(detectConfigurationVersion(sampleV1Config)).toBe("v1");
      expect(detectConfigurationVersion({ schemaVersion: "v2" })).toBe("v2");
    });

    it("detects configuration version from legacy draft aliases", () => {
      expect(detectConfigurationVersion({ version: 1 })).toBe("v1");
      expect(detectConfigurationVersion({ schema_version: "v1" })).toBe("v1");
    });

    it("returns null for documents without identifiable schema version", () => {
      expect(detectConfigurationVersion(null)).toBeNull();
      expect(detectConfigurationVersion("invalid")).toBeNull();
      expect(detectConfigurationVersion({})).toBeNull();
    });
  });

  describe("migrateWebsiteConfiguration", () => {
    it("successfully validates and normalizes a conforming v1 configuration document", () => {
      const migrated = migrateWebsiteConfiguration(sampleV1Config);
      expect(migrated.schemaVersion).toBe("v1");
      expect(migrated.siteId).toBe(validSiteId);
      expect(migrated.businessId).toBe(validBusinessId);
    });

    it("rejects non-object configurations with descriptive error", () => {
      expect(() => migrateWebsiteConfiguration(null)).toThrow(
        "Invalid configuration: document must be an object",
      );
      expect(() => migrateWebsiteConfiguration("not-an-object")).toThrow(
        "Invalid configuration: document must be an object",
      );
    });

    it("rejects configurations with missing schemaVersion", () => {
      expect(() => migrateWebsiteConfiguration({ pages: [] })).toThrow(
        "Invalid configuration: missing or unrecognized schemaVersion",
      );
    });

    it("rejects unsupported future schema versions with helpful message", () => {
      expect(() =>
        migrateWebsiteConfiguration({
          schemaVersion: "v99",
          siteId: validSiteId,
        }),
      ).toThrow("Unsupported schema version 'v99'. Supported versions: v1");
    });

    it("throws descriptive error when v1 configuration fails schema validation", () => {
      const invalidV1 = {
        schemaVersion: "v1",
        siteId: "not-a-uuid",
        businessId: validBusinessId,
      };

      expect(() => migrateWebsiteConfiguration(invalidV1)).toThrow(
        "Website configuration schema validation failed",
      );
    });
  });
});
