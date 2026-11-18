/**
 * VyapOne — Storage Provider Factory and Exports [VO-032]
 */

import { MemoryStorageProvider } from "./memory-storage";
import { SupabaseStorageProvider } from "./supabase-storage";
import type { IStorageProvider } from "./types";

export * from "./types";
export * from "./memory-storage";
export { SupabaseStorageProvider } from "./supabase-storage";

let defaultProviderInstance: IStorageProvider | null = null;

export interface StorageProviderOptions {
  provider?: "supabase" | "memory";
}

/**
 * Returns an instance of IStorageProvider based on environment configuration or override.
 * In automated unit tests or when configured with provider="memory", returns a MemoryStorageProvider.
 */
export function getStorageProvider(options?: StorageProviderOptions): IStorageProvider {
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
