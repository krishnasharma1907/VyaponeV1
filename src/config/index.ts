/**
 * VyapOne Application Configuration Layer
 *
 * Provides typed, validated, and security-isolated environment configuration.
 *
 * Modules:
 * - `@/config/public`: Client-safe public configuration (usable in client components and server)
 * - `@/config/server`: Privileged server-only configuration (guarded by `server-only`)
 * - `@/config/env`: Core validation schemas and validation engine
 */

export { publicConfig, getPublicConfig, type PublicConfig } from "./public";
export {
  validateEnvironment,
  ConfigurationError,
  publicEnvSchema,
  serverCoreEnvSchema,
  optionalIntegrationsEnvSchema,
  type ValidatedConfig,
  type PublicEnvInput,
  type ServerCoreEnvInput,
  type OptionalIntegrationsEnvInput,
} from "./env";
