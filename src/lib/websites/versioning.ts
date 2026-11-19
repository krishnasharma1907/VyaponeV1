/**
 * VyapOne — Website Configuration Versioning & Migration Engine [VO-040]
 *
 * Implements deterministic schema version detection, forward-migration transforms,
 * and version-compatibility validation for structured website configurations.
 * Aligns with PRD FINAL v2 §15.3, §15.7.
 */

import { websiteConfigurationSchema } from "./schemas";
import type { SchemaVersion, WebsiteConfiguration } from "./types";

export const SUPPORTED_SCHEMA_VERSIONS: readonly SchemaVersion[] = ["v1"] as const;

export const CURRENT_SCHEMA_VERSION: SchemaVersion = "v1";

/**
 * Checks if a given version string is among supported configuration versions.
 */
export function isSupportedSchemaVersion(version: unknown): version is SchemaVersion {
  if (typeof version !== "string") return false;
  return (SUPPORTED_SCHEMA_VERSIONS as readonly string[]).includes(version);
}

/**
 * Detects the schema version of an unvalidated configuration document.
 */
export function detectConfigurationVersion(rawConfig: unknown): string | null {
  if (!rawConfig || typeof rawConfig !== "object") return null;
  const config = rawConfig as Record<string, unknown>;
  if (typeof config.schemaVersion === "string") {
    return config.schemaVersion;
  }
  // If version field is present as a number (e.g. from early draft sketches)
  if (config.version === 1 || config.schema_version === "v1") {
    return "v1";
  }
  return null;
}

/**
 * Validates and migrates any stored configuration to the current supported schema version.
 * Throws a descriptive error if the configuration version is unsupported or cannot be parsed.
 */
export function migrateWebsiteConfiguration(rawConfig: unknown): WebsiteConfiguration {
  if (!rawConfig || typeof rawConfig !== "object") {
    throw new Error("Invalid configuration: document must be an object");
  }

  const detectedVersion = detectConfigurationVersion(rawConfig);
  if (!detectedVersion) {
    throw new Error("Invalid configuration: missing or unrecognized schemaVersion");
  }

  if (!isSupportedSchemaVersion(detectedVersion)) {
    throw new Error(
      `Unsupported schema version '${detectedVersion}'. Supported versions: ${SUPPORTED_SCHEMA_VERSIONS.join(", ")}`,
    );
  }

  // Version 1 validation & normalization
  if (detectedVersion === "v1") {
    const parseResult = websiteConfigurationSchema.safeParse(rawConfig);
    if (!parseResult.success) {
      const issues = parseResult.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ");
      throw new Error(`Website configuration schema validation failed: ${issues}`);
    }
    return parseResult.data;
  }

  throw new Error(`No migration pathway available for schema version: ${detectedVersion}`);
}
