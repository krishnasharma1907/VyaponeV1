/**
 * VyapOne Supabase Client Foundation
 *
 * Provides strongly-typed client factories with strict compile-time
 * and runtime isolation between browser and server execution contexts:
 *
 * 1. Browser Client:
 *    Import from `@/lib/supabase/client` or `@/lib/supabase`
 *    Usable in React Client Components ("use client") and browser runtime.
 *
 * 2. Server Client (Authenticated with RLS):
 *    Import from `@/lib/supabase/server`
 *    Guarded by `server-only`. Usable in Server Components, Actions, and Route Handlers.
 *
 * 3. Middleware Session Handler:
 *    Import from `@/lib/supabase/middleware`
 *    Refreshes auth cookies in Next.js Middleware.
 *
 * 4. Administrative Client (Service Role, Bypasses RLS):
 *    Import from `@/lib/supabase/admin`
 *    Guarded by `server-only`. For platform provisioning, webhooks, and cron jobs only.
 */

export { createBrowserSupabaseClient, _resetBrowserClientForTesting } from "./client";
export type { Database, Json } from "./types";
