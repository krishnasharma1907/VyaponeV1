import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { DEFAULT_PLAN_ID, parsePlanId, PLANS } from "./constants";
import {
  CapacityExceededError,
  PlanEntitlementError,
  type CapacityMetric,
  type CapacityUsage,
  type EntitlementEvaluation,
  type FeatureKey,
  type PlanDefinition,
  type PlanId,
  type SubscriptionRow,
  type SubscriptionStatus,
  type WorkspaceSubscriptionDetails,
} from "./types";

/**
 * Resolves the effective plan and subscription details for a given workspace.
 * Fails closed if the workspace does not exist.
 */
export async function resolveWorkspacePlan(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
): Promise<{
  plan: PlanDefinition;
  subscription: SubscriptionRow | null;
  isGracePeriod: boolean;
}> {
  // 1. Fetch workspace plan attribute
  const { data: workspace, error: wsError } = await supabase
    .from("workspaces")
    .select("id, plan, status")
    .eq("id", workspaceId)
    .maybeSingle();

  if (wsError || !workspace) {
    throw new PlanEntitlementError(
      "Workspace not found or inaccessible",
      "WORKSPACE_NOT_FOUND",
      404,
    );
  }

  const workspacePlanId = parsePlanId(workspace.plan);
  if (!workspacePlanId) {
    throw new PlanEntitlementError(
      `Invalid or unknown workspace plan: ${workspace.plan}`,
      "INVALID_PLAN_IDENTIFIER",
      400,
    );
  }

  // 2. Fetch active subscription record if present
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  let isGracePeriod = false;
  let resolvedPlanId: PlanId = workspacePlanId;

  if (subscription) {
    const parsedSubPlan = parsePlanId(subscription.plan_id);
    if (!parsedSubPlan) {
      throw new PlanEntitlementError(
        `Invalid or unknown subscription plan: ${subscription.plan_id}`,
        "INVALID_PLAN_IDENTIFIER",
        400,
      );
    }

    const now = new Date().toISOString();
    const isPastDue = subscription.status === "past_due";
    const inGrace =
      subscription.status === "grace_period" ||
      (isPastDue && subscription.grace_period_end !== null && subscription.grace_period_end > now);

    isGracePeriod = inGrace;

    if (subscription.status === "active") {
      resolvedPlanId = parsedSubPlan;
    } else if (subscription.status === "trialing") {
      if (!subscription.current_period_end || subscription.current_period_end > now) {
        resolvedPlanId = parsedSubPlan;
      } else {
        // Trial expired: degrade to default starter plan
        resolvedPlanId = DEFAULT_PLAN_ID;
      }
    } else if (inGrace) {
      resolvedPlanId = parsedSubPlan;
    } else {
      // Canceled or expired grace period: degrade to default starter plan
      resolvedPlanId = DEFAULT_PLAN_ID;
    }
  }

  const plan = PLANS[resolvedPlanId];
  if (!plan) {
    throw new PlanEntitlementError(
      `Resolved plan ${resolvedPlanId} is not configured`,
      "INVALID_PLAN_IDENTIFIER",
      500,
    );
  }

  return {
    plan,
    subscription: subscription ?? null,
    isGracePeriod,
  };
}

/**
 * Evaluates whether a specific feature is entitled for a workspace or business.
 * Supports explicit database overrides and plan-level entitlement matrix.
 * Fails closed if tenant context cannot be resolved.
 */
export async function checkFeatureEntitlement(
  supabase: SupabaseClient<Database>,
  params: {
    workspaceId?: string;
    businessId?: string;
    feature: FeatureKey;
  },
): Promise<EntitlementEvaluation> {
  const { workspaceId, businessId, feature } = params;

  let effectiveWorkspaceId = workspaceId;

  // If businessId is provided without workspaceId, resolve its workspace_id
  if (businessId && !effectiveWorkspaceId) {
    const { data: business } = await supabase
      .from("businesses")
      .select("workspace_id")
      .eq("id", businessId)
      .maybeSingle();

    if (business?.workspace_id) {
      effectiveWorkspaceId = business.workspace_id;
    }
  }

  const now = new Date().toISOString();

  // 1. Check for business-scoped explicit override first (highest precedence)
  if (businessId) {
    const { data: bizOverride } = await supabase
      .from("entitlement_overrides")
      .select("*")
      .eq("business_id", businessId)
      .eq("feature_key", feature)
      .maybeSingle();

    if (bizOverride) {
      // Check if override has expired
      const isExpired = bizOverride.expires_at !== null && bizOverride.expires_at < now;
      if (!isExpired) {
        return {
          enabled: bizOverride.is_enabled,
          feature,
          source: "override",
          reason: bizOverride.reason ?? "Business-specific entitlement override",
          expiresAt: bizOverride.expires_at,
        };
      }
    }
  }

  // 2. Check for workspace-scoped explicit override (second precedence)
  if (effectiveWorkspaceId) {
    const { data: wsOverride } = await supabase
      .from("entitlement_overrides")
      .select("*")
      .eq("workspace_id", effectiveWorkspaceId)
      .eq("feature_key", feature)
      .maybeSingle();

    if (wsOverride) {
      const isExpired = wsOverride.expires_at !== null && wsOverride.expires_at < now;
      if (!isExpired) {
        return {
          enabled: wsOverride.is_enabled,
          feature,
          source: "override",
          reason: wsOverride.reason ?? "Workspace-wide entitlement override",
          expiresAt: wsOverride.expires_at,
        };
      }
    }
  }

  // 3. Evaluate base plan feature matrix
  if (!effectiveWorkspaceId) {
    return {
      enabled: false,
      feature,
      source: "default",
      reason: "Tenant context not found",
    };
  }

  const { plan } = await resolveWorkspacePlan(supabase, effectiveWorkspaceId);
  const isEnabled = Boolean(plan.features[feature]);

  return {
    enabled: isEnabled,
    feature,
    source: "plan",
    reason: isEnabled
      ? `Included in ${plan.name} plan`
      : `Feature '${feature}' requires a plan upgrade from ${plan.name}`,
  };
}

/**
 * Asserts that a feature is entitled, throwing PlanEntitlementError if disabled.
 */
export async function assertFeatureEntitled(
  supabase: SupabaseClient<Database>,
  params: {
    workspaceId?: string;
    businessId?: string;
    feature: FeatureKey;
  },
): Promise<EntitlementEvaluation> {
  const result = await checkFeatureEntitlement(supabase, params);

  if (!result.enabled) {
    throw new PlanEntitlementError(
      result.reason ?? `Feature '${params.feature}' is not enabled for this tenant`,
      "FEATURE_NOT_ENTITLED",
      403,
      params.feature,
    );
  }

  return result;
}

/**
 * Calculates current consumption, limits, and remaining allowance for a measurable capacity metric.
 * Strictly adheres to PRD FINAL v2 §9.2 counting rules:
 * - One live website slot represents one live business (sites.status = 'published').
 * - Draft sites use a separate controlled allowance (sites.status = 'draft').
 * - Archived sites and archived businesses DO NOT consume live or draft slots.
 * - Connecting a custom domain does not consume another slot.
 */
export async function getCapacityUsage(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  metric: CapacityMetric,
): Promise<CapacityUsage> {
  // 1. Resolve workspace base plan
  const { plan } = await resolveWorkspacePlan(supabase, workspaceId);
  const baseLimit = plan.capacities[metric] ?? 0;

  // 2. Check for capacity overrides (e.g. purchased add-on slots)
  const now = new Date().toISOString();
  const { data: capOverride } = await supabase
    .from("capacity_overrides")
    .select("additional_capacity, expires_at")
    .eq("workspace_id", workspaceId)
    .eq("metric", metric)
    .maybeSingle();

  let overrideCapacity = 0;
  if (capOverride) {
    const isExpired = capOverride.expires_at !== null && capOverride.expires_at < now;
    if (!isExpired) {
      overrideCapacity = capOverride.additional_capacity;
    }
  }

  const effectiveLimit = baseLimit + overrideCapacity;
  let current = 0;

  // 3. Count server-side usage from trusted database state
  if (metric === "live_websites" || metric === "draft_websites") {
    const targetStatus = metric === "live_websites" ? "published" : "draft";

    // Fetch active businesses under this workspace (excluding archived)
    const { data: businesses } = await supabase
      .from("businesses")
      .select("id")
      .eq("workspace_id", workspaceId)
      .neq("status", "archived");

    const businessIds = (businesses ?? []).map((b) => b.id);

    if (businessIds.length > 0) {
      if (metric === "live_websites") {
        // PRD §9.2 rule 1: One website slot represents one live business.
        // Support both detailed row data (for deduplication) and head-only count.
        const { data: publishedSites, count } = await supabase
          .from("sites")
          .select("business_id", { count: "exact" })
          .in("business_id", businessIds)
          .eq("status", "published");

        if (Array.isArray(publishedSites) && publishedSites.length > 0) {
          const uniqueBusinesses = new Set(publishedSites.map((s) => s.business_id));
          current = uniqueBusinesses.size;
        } else {
          current = count ?? 0;
        }
      } else {
        const { count } = await supabase
          .from("sites")
          .select("id", { count: "exact", head: true })
          .in("business_id", businessIds)
          .eq("status", targetStatus);

        current = count ?? 0;
      }
    }
  } else if (metric === "team_seats") {
    const { count } = await supabase
      .from("workspace_members")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("status", "active");

    current = count ?? 0;
  } else if (metric === "locations_per_business") {
    const { data: businesses } = await supabase
      .from("businesses")
      .select("id")
      .eq("workspace_id", workspaceId)
      .neq("status", "archived");

    let maxLocations = 0;
    if (businesses && businesses.length > 0) {
      for (const b of businesses) {
        const { count } = await supabase
          .from("locations")
          .select("id", { count: "exact", head: true })
          .eq("business_id", b.id);
        if ((count ?? 0) > maxLocations) {
          maxLocations = count ?? 0;
        }
      }
    }
    current = maxLocations;
  } else if (metric === "catalogue_items_per_business") {
    const { data: businesses } = await supabase
      .from("businesses")
      .select("id")
      .eq("workspace_id", workspaceId)
      .neq("status", "archived");

    let maxItems = 0;
    if (businesses && businesses.length > 0) {
      for (const b of businesses) {
        const { count } = await supabase
          .from("catalogue_items")
          .select("id", { count: "exact", head: true })
          .eq("business_id", b.id);
        if ((count ?? 0) > maxItems) {
          maxItems = count ?? 0;
        }
      }
    }
    current = maxItems;
  }

  const remaining = Math.max(0, effectiveLimit - current);
  const isExceeded = current >= effectiveLimit;

  return {
    metric,
    current,
    baseLimit,
    overrideCapacity,
    effectiveLimit,
    remaining,
    isUnlimited: false,
    isExceeded,
  };
}

/**
 * Asserts that capacity is available for a proposed operation.
 * Concurrency-safe: attempts atomic database locking RPC first, falling back to application calculation.
 * Throws CapacityExceededError if operation would exceed the effective limit.
 */
export async function assertCapacityAvailable(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  metric: CapacityMetric,
  requestedQuantity = 1,
): Promise<CapacityUsage> {
  // 1. Concurrency-Safe: Attempt atomic database locking RPC if available
  if (typeof supabase.rpc === "function") {
    try {
      const { data, error } = await supabase.rpc("assert_and_lock_workspace_capacity", {
        p_workspace_id: workspaceId,
        p_metric: metric,
        p_requested_quantity: requestedQuantity,
      });

      if (!error && Array.isArray(data) && data.length > 0) {
        const result = data[0];

        if (!result.allowed) {
          throw new CapacityExceededError(
            result.reason || `Capacity limit reached for ${metric}`,
            metric,
            result.current_count,
            result.effective_limit,
          );
        }

        return {
          metric,
          current: result.current_count,
          baseLimit: result.effective_limit,
          overrideCapacity: 0,
          effectiveLimit: result.effective_limit,
          remaining: result.remaining,
          isUnlimited: false,
          isExceeded: false,
        };
      }
    } catch (rpcErr) {
      if (rpcErr instanceof CapacityExceededError) {
        throw rpcErr;
      }
      // Fall through to application-layer calculation for mock/offline clients
    }
  }

  // 2. Application-layer capacity calculation fallback
  const usage = await getCapacityUsage(supabase, workspaceId, metric);

  if (usage.current + requestedQuantity > usage.effectiveLimit) {
    throw new CapacityExceededError(
      `Capacity limit reached for ${metric}. Allowed: ${usage.effectiveLimit}, Current: ${usage.current}, Requested: ${requestedQuantity}. Please upgrade your plan or archive unused resources.`,
      metric,
      usage.current,
      usage.effectiveLimit,
    );
  }

  return usage;
}

/**
 * Validates whether a site status transition conforms to capacity rules.
 * Concurrency-safe: attempts atomic database site transition RPC first, falling back to application calculation.
 * Documented rules (§9.2):
 * - Transition to 'archived' or 'suspended' is ALWAYS permitted (frees capacity).
 * - Transition from 'draft' to 'published' requires live_websites capacity.
 * - If site is ALREADY 'published', re-publishing does not consume an extra slot.
 * - Restoring an archived site to 'draft' requires draft_websites capacity.
 */
export async function checkSiteTransitionCapacity(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  siteId: string,
  targetStatus: "draft" | "published" | "suspended" | "archived",
): Promise<{ allowed: boolean; reason?: string }> {
  // Archiving or suspending never requires capacity
  if (targetStatus === "archived" || targetStatus === "suspended") {
    return { allowed: true };
  }

  // 1. Concurrency-Safe: Attempt atomic database RPC if available
  if (typeof supabase.rpc === "function") {
    try {
      const { data, error } = await supabase.rpc("transition_site_status_atomic", {
        p_site_id: siteId,
        p_target_status: targetStatus,
      });

      if (!error && Array.isArray(data) && data.length > 0) {
        const result = data[0];
        return {
          allowed: result.success,
          reason: result.success ? undefined : result.reason,
        };
      }
    } catch {
      // Fall through to application-layer calculation for mock/offline clients
    }
  }

  // 2. Application-layer site transition evaluation fallback
  // Fetch current site status
  const { data: site } = await supabase
    .from("sites")
    .select("id, status")
    .eq("id", siteId)
    .maybeSingle();

  const currentStatus = site?.status ?? "draft";

  // If already at target status, no additional slot is consumed
  if (currentStatus === targetStatus) {
    return { allowed: true };
  }

  if (targetStatus === "published") {
    try {
      await assertCapacityAvailable(supabase, workspaceId, "live_websites", 1);
      return { allowed: true };
    } catch (err) {
      if (err instanceof CapacityExceededError) {
        return {
          allowed: false,
          reason: `Live website limit reached (${err.limit} sites). Upgrade plan to publish more live sites.`,
        };
      }
      throw err;
    }
  }

  if (targetStatus === "draft" && currentStatus === "archived") {
    try {
      await assertCapacityAvailable(supabase, workspaceId, "draft_websites", 1);
      return { allowed: true };
    } catch (err) {
      if (err instanceof CapacityExceededError) {
        return {
          allowed: false,
          reason: `Draft website allowance reached (${err.limit} drafts). Upgrade plan or archive unused drafts.`,
        };
      }
      throw err;
    }
  }

  return { allowed: true };
}

/**
 * Compiles a complete summary of workspace subscription, capacities, and entitlements.
 */
export async function getWorkspaceSubscriptionDetails(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
): Promise<WorkspaceSubscriptionDetails> {
  const { plan, subscription, isGracePeriod } = await resolveWorkspacePlan(supabase, workspaceId);

  const metrics: CapacityMetric[] = [
    "live_websites",
    "draft_websites",
    "team_seats",
    "locations_per_business",
    "catalogue_items_per_business",
  ];

  const capacityEntries = await Promise.all(
    metrics.map(async (m) => {
      const usage = await getCapacityUsage(supabase, workspaceId, m);
      return [m, usage] as const;
    }),
  );

  const capacities = Object.fromEntries(capacityEntries) as Record<CapacityMetric, CapacityUsage>;

  const featureKeys: FeatureKey[] = [
    "website_engine",
    "catalogue_services",
    "enquiries_leads",
    "orders",
    "appointments",
    "inventory",
    "qr_management",
    "feedback_reviews",
    "analytics",
    "custom_domain",
    "white_label",
    "client_billing",
    "smart_ai_bot",
    "whatsapp_broadcasts",
    "gst_e_invoicing",
    "priority_support",
    "dedicated_support",
  ];

  const featureEntries = await Promise.all(
    featureKeys.map(async (f) => {
      const evalResult = await checkFeatureEntitlement(supabase, {
        workspaceId,
        feature: f,
      });
      return [f, evalResult] as const;
    }),
  );

  const features = Object.fromEntries(featureEntries) as Record<FeatureKey, EntitlementEvaluation>;

  return {
    planId: plan.id,
    planName: plan.name,
    status: (subscription?.status as SubscriptionStatus) ?? "active",
    isGracePeriod,
    currentPeriodEnd: subscription?.current_period_end ?? null,
    gracePeriodEnd: subscription?.grace_period_end ?? null,
    capacities,
    features,
  };
}
