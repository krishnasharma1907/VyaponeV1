import "server-only";

import { getServerConfig } from "@/config/server";

/**
 * VyapOne Database Connection Foundation
 *
 * Reconciles ADR-002 (PostgreSQL + RLS) with ADR-003 (Full Supabase backend)
 * and ADR-004 (Cloudflare Workers/Pages edge runtime).
 *
 * ARCHITECTURAL INVARIANTS:
 * 1. Connectionless Data API (Primary Runtime):
 *    Standard application queries in Server Components, Actions, and Edge
 *    Route Handlers should primarily execute via the Supabase Data API
 *    (`@supabase/ssr` / `@supabase/supabase-js`) over HTTPS. This eliminates
 *    TCP connection exhaustion and works natively across Cloudflare Workers.
 *
 * 2. Connection Pooling (Supavisor):
 *    When direct PostgreSQL connectivity is required (e.g. DDL migrations in
 *    VO-020 or complex analytical aggregations), connections MUST route
 *    through Supabase's Supavisor connection pooler:
 *    - Port 6543: Transaction pooler (ideal for serverless / short-lived lambdas)
 *    - Port 5432: Session pooler / direct connection (used for DDL migrations)
 *
 * 3. Zero Persistent Sockets on Import:
 *    Database drivers must never open persistent TCP connections at module
 *    import time. Connections must be lazily evaluated and closed promptly.
 */

export interface DatabaseConnectionInfo {
  readonly isConfigured: boolean;
  readonly isDirectConfigured: boolean;
  readonly poolerMode: "transaction_pooler" | "session_pooler" | "unpooled" | "unconfigured";
  readonly host: string | null;
  readonly port: number | null;
  readonly databaseName: string | null;
}

/**
 * Inspects the current database connection configuration without opening a socket.
 *
 * Extracts host, port, and pooler mode safely while ensuring credentials
 * and passwords are NEVER exposed in the returned metadata.
 *
 * @param customEnv Optional environment dictionary for Cloudflare Pages/Workers context.
 */
export function inspectDatabaseConfig(
  customEnv?: Record<string, string | undefined>,
): DatabaseConnectionInfo {
  const config = getServerConfig(customEnv);
  const dbUrl = config.database.url;
  const directUrl = config.database.directUrl;

  if (!dbUrl) {
    return {
      isConfigured: false,
      isDirectConfigured: Boolean(directUrl),
      poolerMode: "unconfigured",
      host: null,
      port: null,
      databaseName: null,
    };
  }

  try {
    const parsed = new URL(dbUrl);
    const port = parsed.port ? parseInt(parsed.port, 10) : 5432;
    const host = parsed.hostname;
    const databaseName = parsed.pathname.replace(/^\//, "") || null;

    let poolerMode: DatabaseConnectionInfo["poolerMode"] = "unpooled";
    if (port === 6543 || parsed.searchParams.get("pgbouncer") === "true") {
      poolerMode = "transaction_pooler";
    } else if (port === 5432 && host.includes("pooler.supabase.com")) {
      poolerMode = "session_pooler";
    }

    return {
      isConfigured: true,
      isDirectConfigured: Boolean(directUrl),
      poolerMode,
      host,
      port,
      databaseName,
    };
  } catch {
    // Malformed URL, return safe unconfigured
    return {
      isConfigured: false,
      isDirectConfigured: Boolean(directUrl),
      poolerMode: "unconfigured",
      host: null,
      port: null,
      databaseName: null,
    };
  }
}
