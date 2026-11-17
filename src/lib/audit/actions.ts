"use server";

import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { sanitizeTenantError, TenantAccessError } from "@/lib/auth/tenant-access";
import { listAuditLogsSchema } from "./schemas";
import { listBusinessAuditLogs, listWorkspaceAuditLogs } from "./service";
import type { AuditQueryResult } from "./types";

export interface AuditActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  statusCode?: number;
}

function handleAuditActionError(err: unknown): AuditActionResult<never> {
  if (err instanceof TenantAccessError) {
    const sanitized = sanitizeTenantError(err);
    return {
      success: false,
      error: sanitized.error,
      code: sanitized.code,
      statusCode: sanitized.status,
    };
  }
  const message = err instanceof Error ? err.message : "An unexpected error occurred";
  return {
    success: false,
    error: message,
    code: "AUDIT_QUERY_FAILED",
    statusCode: 500,
  };
}

/**
 * Server Action to list audit logs for a workspace.
 * Requires caller to be workspace admin or owner.
 */
export async function listWorkspaceAuditLogsAction(
  workspaceId: string,
  options?: unknown,
): Promise<AuditActionResult<AuditQueryResult>> {
  try {
    const parsedOptions = options ? listAuditLogsSchema.parse(options) : undefined;
    const supabase = await createServerSupabaseClient();
    const result = await listWorkspaceAuditLogs(supabase, workspaceId, parsedOptions);
    return {
      success: true,
      data: result,
    };
  } catch (err) {
    return handleAuditActionError(err);
  }
}

/**
 * Server Action to list audit logs for a business.
 * Requires caller to be business sovereign owner or manager.
 */
export async function listBusinessAuditLogsAction(
  businessId: string,
  options?: unknown,
): Promise<AuditActionResult<AuditQueryResult>> {
  try {
    const parsedOptions = options ? listAuditLogsSchema.parse(options) : undefined;
    const supabase = await createServerSupabaseClient();
    const result = await listBusinessAuditLogs(supabase, businessId, parsedOptions);
    return {
      success: true,
      data: result,
    };
  } catch (err) {
    return handleAuditActionError(err);
  }
}
