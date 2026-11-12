import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getServerConfig } from "@/config/server";
import { ConfigurationError } from "@/config/env";
import type { Database } from "./types";

/**
 * Privileged Administrative Supabase Client (Service Role)
 *
 * Guarded by Next.js `import "server-only"`.
 *
 * CRITICAL SECURITY INVARIANTS:
 * 1. This client uses the SUPABASE_SERVICE_ROLE_KEY and COMPLETELY BYPASSES
 *    POSTGRESQL ROW-LEVEL SECURITY (RLS).
 * 2. It MUST NEVER be imported into React Client Components ("use client") or
 *    bundled into client-side browser JavaScript.
 * 3. It MUST NOT be used for routine tenant-scoped user operations. Routine
 *    operations MUST use `createServerSupabaseClient` which enforces RLS.
 * 4. Permitted use cases are strictly limited to:
 *    - System administration (platform-level tenant provisioning)
 *    - External webhook verification handlers (e.g. Razorpay payment webhooks)
 *    - Privileged background workers and cron jobs
 *    - Audit log writing and security event ingestion
 */

/**
 * Creates an administrative Supabase client using the privileged service-role key.
 *
 * Disables session persistence and token auto-refresh since this client operates
 * strictly within stateless server executions.
 *
 * @param customEnv Optional environment dictionary for Cloudflare Pages/Workers context.
 * @throws ConfigurationError if SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL is missing.
 */
export function createAdminSupabaseClient(
  customEnv?: Record<string, string | undefined>,
): SupabaseClient<Database> {
  const config = getServerConfig(customEnv);
  const url = config.supabase.url;
  const serviceRoleKey = config.supabase.serviceRoleKey;

  if (!url || !serviceRoleKey) {
    throw new ConfigurationError([
      {
        path: "SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_URL",
        message:
          "Administrative Supabase client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to be configured.",
      },
    ]);
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
