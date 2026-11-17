/**
 * VyapOne — Centralized Audit Logging Service [VO-028]
 *
 * Provides append-only, tenant-scoped audit logging with automatic credential redaction,
 * strict tenant boundary enforcement, and server-side actor attribution.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";
import { assertBusinessAccess, assertWorkspaceAccess } from "@/lib/auth/tenant-access";
import { redactSensitiveData } from "./redaction";
import type { AuditEventInput, AuditLogRecord, AuditQueryOptions, AuditQueryResult } from "./types";

function mapAuditRow(row: Database["public"]["Tables"]["audit_logs"]["Row"]): AuditLogRecord {
  return {
    id: row.id,
    businessId: row.business_id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    action: row.action,
    resource: row.resource,
    metadata: (row.metadata_json as Record<string, unknown>) ?? {},
    ipAddress: row.ip_address,
    createdAt: row.created_at,
  };
}

/**
 * Records an immutable audit log entry with automated sensitive data redaction.
 */
export async function recordAuditEvent(
  supabase: SupabaseClient<Database>,
  input: AuditEventInput,
): Promise<AuditLogRecord> {
  let resolvedActorId: string | null = input.actorUserId ?? null;

  // If actorUserId was not explicitly supplied, try to derive from active session
  if (input.actorUserId === undefined) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      resolvedActorId = user?.id ?? null;
    } catch {
      resolvedActorId = null;
    }
  }

  // Redact any credentials or secrets in metadata
  const sanitizedMetadata = input.metadata
    ? (redactSensitiveData(input.metadata) as Record<string, unknown>)
    : {};

  const { data, error } = await supabase
    .from("audit_logs")
    .insert({
      workspace_id: input.workspaceId ?? null,
      business_id: input.businessId ?? null,
      user_id: resolvedActorId,
      action: input.action,
      resource: input.resource,
      metadata_json: sanitizedMetadata as Json,
      ip_address: input.ipAddress ?? null,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`Failed to record audit event: ${error?.message ?? "unknown error"}`);
  }

  return mapAuditRow(data);
}

/**
 * Lists audit logs scoped strictly to a reseller workspace.
 * Requires caller to be a workspace admin or workspace owner.
 */
export async function listWorkspaceAuditLogs(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  options?: AuditQueryOptions,
): Promise<AuditQueryResult> {
  // Authorization check: must be workspace member with admin or owner role
  await assertWorkspaceAccess(supabase, workspaceId, {
    requiredRole: "workspace_admin",
  });

  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 100);
  const offset = Math.max(options?.offset ?? 0, 0);

  let query = supabase
    .from("audit_logs")
    .select("*", { count: "exact" })
    .eq("workspace_id", workspaceId);

  if (options?.action) {
    query = query.eq("action", options.action);
  }
  if (options?.resource) {
    query = query.eq("resource", options.resource);
  }
  if (options?.userId) {
    query = query.eq("user_id", options.userId);
  }
  if (options?.startDate) {
    query = query.gte("created_at", options.startDate);
  }
  if (options?.endDate) {
    query = query.lte("created_at", options.endDate);
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to fetch workspace audit logs: ${error.message}`);
  }

  return {
    logs: (data ?? []).map(mapAuditRow),
    totalCount: count ?? 0,
  };
}

/**
 * Lists audit logs scoped strictly to a business tenant.
 * Requires caller to be business sovereign owner or business manager/owner member.
 */
export async function listBusinessAuditLogs(
  supabase: SupabaseClient<Database>,
  businessId: string,
  options?: AuditQueryOptions,
): Promise<AuditQueryResult> {
  // Authorization check: must have business management access
  await assertBusinessAccess(supabase, businessId, {
    requiredRole: "manager",
  });

  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 100);
  const offset = Math.max(options?.offset ?? 0, 0);

  let query = supabase
    .from("audit_logs")
    .select("*", { count: "exact" })
    .eq("business_id", businessId);

  if (options?.action) {
    query = query.eq("action", options.action);
  }
  if (options?.resource) {
    query = query.eq("resource", options.resource);
  }
  if (options?.userId) {
    query = query.eq("user_id", options.userId);
  }
  if (options?.startDate) {
    query = query.gte("created_at", options.startDate);
  }
  if (options?.endDate) {
    query = query.lte("created_at", options.endDate);
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to fetch business audit logs: ${error.message}`);
  }

  return {
    logs: (data ?? []).map(mapAuditRow),
    totalCount: count ?? 0,
  };
}
