import "server-only";

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { publicConfig } from "@/config/public";
import { ConfigurationError, getEnvVar } from "@/config/env";
import type { Database } from "./types";

/**
 * Server-Side Authenticated Supabase Client
 *
 * Guarded by Next.js `import "server-only"`. This module is designed for
 * Server Components, Server Actions, and Route Handlers.
 *
 * It uses the public anon key combined with request cookies to establish
 * the authenticated user's session. Queries executed through this client
 * strictly respect PostgreSQL Row-Level Security (RLS) policies based on
 * the requesting user's identity (`auth.uid()`).
 *
 * MUTABLE USER STATE IS NOT SHARED: A fresh request-scoped client is created
 * per invocation to prevent cross-request session leakage.
 */

export interface CookieItem {
  name: string;
  value: string;
  options?: CookieOptions;
}

export interface CookieHandler {
  getAll: () =>
    Array<{ name: string; value: string }> | Promise<Array<{ name: string; value: string }>>;
  setAll?: (cookies: CookieItem[]) => void | Promise<void>;
}

/**
 * Creates a request-scoped Supabase client for Server Components, Server Actions,
 * and Route Handlers.
 *
 * @param customCookies Optional custom cookie handler (useful for testing or custom runtimes).
 *                      Defaults to Next.js 15 `await cookies()` from `next/headers`.
 * @throws ConfigurationError if NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is not configured.
 */
export async function createServerSupabaseClient(
  customCookies?: CookieHandler,
): Promise<SupabaseClient<Database>> {
  const url =
    getEnvVar("NEXT_PUBLIC_SUPABASE_URL") ||
    getEnvVar("SUPABASE_URL") ||
    (typeof process !== "undefined" &&
      (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL)) ||
    publicConfig.supabaseUrl;
  const anonKey =
    getEnvVar("NEXT_PUBLIC_SUPABASE_ANON_KEY") ||
    getEnvVar("SUPABASE_ANON_KEY") ||
    (typeof process !== "undefined" &&
      (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY)) ||
    publicConfig.supabaseAnonKey;

  if (!url || !anonKey) {
    throw new ConfigurationError([
      {
        path: "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY",
        message:
          "Supabase server client requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to be configured.",
      },
    ]);
  }

  // If a custom cookie store/handler is provided (e.g. in tests or custom adapters), use it directly
  if (customCookies) {
    return createServerClient<Database>(url, anonKey, {
      cookies: {
        async getAll() {
          return await customCookies.getAll();
        },
        async setAll(cookiesToSet) {
          if (customCookies.setAll) {
            await customCookies.setAll(cookiesToSet);
          }
        },
      },
    });
  }

  // Next.js 15: cookies() is asynchronous
  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // The `setAll` method was called from a Server Component.
          // In Next.js App Router, Server Components cannot mutate cookies directly.
          // This can be ignored if Middleware is refreshing user sessions.
        }
      },
    },
  });
}
