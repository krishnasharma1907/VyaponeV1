"use server";

import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { assertAuthenticatedUser, assertWorkspaceAccess } from "@/lib/auth/tenant-access";
import { capacityMetricSchema, featureKeySchema } from "./schemas";
import {
  assertCapacityAvailable,
  checkFeatureEntitlement,
  checkSiteTransitionCapacity,
  getWorkspaceSubscriptionDetails,
} from "./service";
import type { CapacityUsage, EntitlementEvaluation, WorkspaceSubscriptionDetails } from "./types";
import { CapacityExceededError, PlanEntitlementError } from "./types";

export type ActionResult<T> =
  | { success: true; data: T }
  | {
      success: false;
      error: string;
      code: string;
      statusCode: number;
    };

function sanitizeError(err: unknown): {
  error: string;
  code: string;
  statusCode: number;
} {
  if (err instanceof PlanEntitlementError) {
    return {
      error: err.message,
      code: err.code,
      statusCode: err.statusCode,
    };
  }

  if (err instanceof CapacityExceededError) {
    return {
      error: err.message,
      code: err.code,
      statusCode: err.statusCode,
    };
  }

  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();

  if (
    lower.includes("postgres") ||
    lower.includes("fatal") ||
    lower.includes("column") ||
    lower.includes("relation") ||
    lower.includes("syntax error") ||
    lower.includes("sql")
  ) {
    return {
      error: "A database error occurred. Please try again later.",
      code: "DATABASE_ERROR",
      statusCode: 500,
    };
  }

  return {
    error: message || "An unexpected error occurred.",
    code: "INTERNAL_ERROR",
    statusCode: 500,
  };
}

/**
 * Server action to retrieve complete plan, capacity, and entitlement details for a workspace.
 */
export async function getWorkspaceSubscriptionDetailsAction(
  workspaceId: string,
): Promise<ActionResult<WorkspaceSubscriptionDetails>> {
  try {
    const supabase = await createServerSupabaseClient();
    await assertAuthenticatedUser(supabase);
    await assertWorkspaceAccess(supabase, workspaceId);

    const details = await getWorkspaceSubscriptionDetails(supabase, workspaceId);
    return { success: true, data: details };
  } catch (err) {
    const sanitized = sanitizeError(err);
    return { success: false, ...sanitized };
  }
}

/**
 * Server action to evaluate whether a feature is entitled for a workspace.
 */
export async function checkFeatureEntitlementAction(
  workspaceId: string,
  feature: string,
): Promise<ActionResult<EntitlementEvaluation>> {
  try {
    const parsedFeature = featureKeySchema.safeParse(feature);
    if (!parsedFeature.success) {
      return {
        success: false,
        error: "Invalid feature key provided",
        code: "VALIDATION_ERROR",
        statusCode: 400,
      };
    }

    const supabase = await createServerSupabaseClient();
    await assertAuthenticatedUser(supabase);
    await assertWorkspaceAccess(supabase, workspaceId);

    const evaluation = await checkFeatureEntitlement(supabase, {
      workspaceId,
      feature: parsedFeature.data,
    });

    return { success: true, data: evaluation };
  } catch (err) {
    const sanitized = sanitizeError(err);
    return { success: false, ...sanitized };
  }
}

/**
 * Server action to check whether capacity is available for an operation.
 */
export async function assertCapacityAvailableAction(
  workspaceId: string,
  metric: string,
  quantity = 1,
): Promise<ActionResult<CapacityUsage>> {
  try {
    const parsedMetric = capacityMetricSchema.safeParse(metric);
    if (!parsedMetric.success) {
      return {
        success: false,
        error: "Invalid capacity metric provided",
        code: "VALIDATION_ERROR",
        statusCode: 400,
      };
    }

    const supabase = await createServerSupabaseClient();
    await assertAuthenticatedUser(supabase);
    await assertWorkspaceAccess(supabase, workspaceId);

    const usage = await assertCapacityAvailable(supabase, workspaceId, parsedMetric.data, quantity);

    return { success: true, data: usage };
  } catch (err) {
    const sanitized = sanitizeError(err);
    return { success: false, ...sanitized };
  }
}

/**
 * Server action to validate whether a site status transition conforms to capacity rules.
 */
export async function checkSiteTransitionCapacityAction(
  workspaceId: string,
  siteId: string,
  targetStatus: "draft" | "published" | "suspended" | "archived",
): Promise<ActionResult<{ allowed: boolean; reason?: string }>> {
  try {
    const supabase = await createServerSupabaseClient();
    await assertAuthenticatedUser(supabase);
    await assertWorkspaceAccess(supabase, workspaceId);

    const result = await checkSiteTransitionCapacity(supabase, workspaceId, siteId, targetStatus);

    return { success: true, data: result };
  } catch (err) {
    const sanitized = sanitizeError(err);
    return { success: false, ...sanitized };
  }
}
