import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { publicConfig } from "@/config/public";
import { ConfigurationError } from "@/config/env";
import type { Database } from "./types";

/**
 * Browser-Safe Supabase Client
 *
 * This client is safe for use in React Client Components ("use client")
 * and client-side browser execution. It authenticates requests via the
 * public Supabase anon key and relies on PostgreSQL Row-Level Security (RLS)
 * for authorization.
 *
 * PRIVILEGED KEYS (SERVICE ROLE KEYS, DATABASE PASSWORDS) MUST NEVER BE
 * IMPORTED OR USED IN THIS MODULE.
 */

let browserClientInstance: SupabaseClient<Database> | null = null;

/**
 * Creates or retrieves the memoized browser Supabase client.
 *
 * In browser runtime, memoizes a single client instance to prevent multiple
 * GoTrue auth listeners or redundant connection channels.
 *
 * @throws ConfigurationError if NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is not configured.
 */
export function createBrowserSupabaseClient(): SupabaseClient<Database> {
  const url =
    (typeof process !== "undefined" &&
      (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL)) ||
    publicConfig.supabaseUrl;
  const anonKey =
    (typeof process !== "undefined" &&
      (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY)) ||
    publicConfig.supabaseAnonKey;

  if (!url || !anonKey) {
    throw new ConfigurationError([
      {
        path: "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY",
        message:
          "Supabase browser client requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to be configured.",
      },
    ]);
  }

  // In browser runtime, return the cached client instance
  if (typeof window !== "undefined") {
    if (!browserClientInstance) {
      browserClientInstance = createBrowserClient<Database>(url, anonKey);
    }
    return browserClientInstance;
  }

  // During SSR or static evaluation, create a fresh client
  return createBrowserClient<Database>(url, anonKey);
}

/**
 * For testing purposes only: clears the memoized browser client instance.
 */
export function _resetBrowserClientForTesting(): void {
  browserClientInstance = null;
}
