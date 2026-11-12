import "server-only";

import { validateEnvironment, type ValidatedConfig } from "./env";

/**
 * Server-Only Privileged Configuration
 *
 * This module is guarded by Next.js `import "server-only"`. Any attempt to import
 * this file or its exports within a React Client Component ("use client") will
 * result in a compile-time build error.
 *
 * It contains privileged database connection strings, Supabase service-role keys,
 * session encryption secrets, and third-party integration credentials.
 */

let cachedConfig: ValidatedConfig["server"] | null = null;

/**
 * Returns the validated server-only configuration.
 * Memoizes the configuration on first access during the process lifetime.
 *
 * @param rawEnv Optional raw environment record (defaults to process.env).
 *               Enables passing explicit Cloudflare Pages/Workers context bindings.
 */
export function getServerConfig(
  rawEnv: Record<string, string | undefined> = process.env,
): ValidatedConfig["server"] {
  // If no custom env is passed and we have a cached version, return it
  if (rawEnv === process.env && cachedConfig) {
    return cachedConfig;
  }

  const validated = validateEnvironment(rawEnv);

  if (rawEnv === process.env) {
    cachedConfig = validated.server;
  }

  return validated.server;
}

/**
 * Default server configuration singleton for standard server-side usage.
 */
export const serverConfig = getServerConfig();

/**
 * For testing purposes only: clears the memoized server configuration.
 */
export function _resetServerConfigForTesting(): void {
  cachedConfig = null;
}
