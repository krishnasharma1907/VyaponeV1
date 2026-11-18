/**
 * VyapOne — Storage Provider Factory and Exports [VO-032]
 */

import { MemoryStorageProvider } from "./memory-storage";
import { SupabaseStorageProvider } from "./supabase-storage";
import type { IStorageProvider } from "./types";

export * from "./types";
export * from "./memory-storage";
export { SupabaseStorageProvider } from "./supabase-storage";

export class StorageConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageConfigurationError";
  }
}

let defaultProviderInstance: IStorageProvider | null = null;

export interface StorageProviderOptions {
  provider?: "supabase" | "memory";
}

/**
 * Returns an instance of IStorageProvider based on environment configuration or override.
 * In automated unit tests or when explicitly configured in non-production, returns a MemoryStorageProvider.
 *
 * CRITICAL SECURITY INVARIANT:
 * MemoryStorageProvider is strictly forbidden in production (NODE_ENV === 'production').
 * Missing or invalid production storage credentials will fail closed.
 */
export function getStorageProvider(options?: StorageProviderOptions): IStorageProvider {
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction && options?.provider === "memory") {
    throw new StorageConfigurationError(
      "MemoryStorageProvider is strictly prohibited in production environment. Direct-to-storage media pipeline must use configured durable storage.",
    );
  }

  if (options?.provider === "memory") {
    return new MemoryStorageProvider();
  }

  // If running in test environment and not explicitly requesting live Supabase
  if (process.env.NODE_ENV === "test" && options?.provider !== "supabase") {
    if (!defaultProviderInstance || !(defaultProviderInstance instanceof MemoryStorageProvider)) {
      defaultProviderInstance = new MemoryStorageProvider();
    }
    return defaultProviderInstance;
  }

  return new SupabaseStorageProvider();
}

/**
 * Helper for testing: injects or resets the default storage provider instance.
 */
export function _setStorageProviderForTesting(provider: IStorageProvider | null): void {
  defaultProviderInstance = provider;
}
