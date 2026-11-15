import type { Database } from "@/lib/supabase/types";

export type PlanId = "starter" | "growth" | "pro" | "agency" | "scale";

export type SubscriptionStatus = "active" | "trialing" | "past_due" | "grace_period" | "canceled";

export type FeatureKey =
  | "website_engine"
  | "catalogue_services"
  | "enquiries_leads"
  | "orders"
  | "appointments"
  | "inventory"
  | "qr_management"
  | "feedback_reviews"
  | "analytics"
  | "custom_domain"
  | "white_label"
  | "client_billing"
  | "smart_ai_bot"
  | "whatsapp_broadcasts"
  | "gst_e_invoicing"
  | "priority_support"
  | "dedicated_support";

export type CapacityMetric =
  | "live_websites"
  | "draft_websites"
  | "team_seats"
  | "locations_per_business"
  | "catalogue_items_per_business";

export interface PlanCapacities {
  live_websites: number;
  draft_websites: number;
  team_seats: number;
  locations_per_business: number;
  catalogue_items_per_business: number;
}

export interface PlanDefinition {
  id: PlanId;
  name: string;
  positioning: string;
  priceMonthlyMinor: number; // e.g. 39900 = ₹399
  currencyCode: string; // ISO 4217, "INR"
  isHypothesis: boolean; // True per PRD §9.1 and ADR-011
  capacities: PlanCapacities;
  features: Record<FeatureKey, boolean>;
}

export interface EntitlementEvaluation {
  enabled: boolean;
  feature: FeatureKey;
  source: "plan" | "override" | "default";
  reason?: string;
  expiresAt?: string | null;
}

export interface CapacityUsage {
  metric: CapacityMetric;
  current: number;
  baseLimit: number;
  overrideCapacity: number;
  effectiveLimit: number;
  remaining: number;
  isUnlimited: boolean;
  isExceeded: boolean;
}

export interface WorkspaceSubscriptionDetails {
  planId: PlanId;
  planName: string;
  status: SubscriptionStatus;
  isGracePeriod: boolean;
  currentPeriodEnd: string | null;
  gracePeriodEnd: string | null;
  capacities: Record<CapacityMetric, CapacityUsage>;
  features: Record<FeatureKey, EntitlementEvaluation>;
}

export type SubscriptionRow = Database["public"]["Tables"]["subscriptions"]["Row"];
export type EntitlementOverrideRow = Database["public"]["Tables"]["entitlement_overrides"]["Row"];
export type CapacityOverrideRow = Database["public"]["Tables"]["capacity_overrides"]["Row"];

export class PlanEntitlementError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly feature?: FeatureKey;

  constructor(
    message: string,
    code = "FEATURE_NOT_ENTITLED",
    statusCode = 403,
    feature?: FeatureKey,
  ) {
    super(message);
    this.name = "PlanEntitlementError";
    this.code = code;
    this.statusCode = statusCode;
    this.feature = feature;
  }
}

export class CapacityExceededError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly metric: CapacityMetric;
  readonly current: number;
  readonly limit: number;

  constructor(
    message: string,
    metric: CapacityMetric,
    current: number,
    limit: number,
    code = "CAPACITY_EXCEEDED",
    statusCode = 403,
  ) {
    super(message);
    this.name = "CapacityExceededError";
    this.code = code;
    this.statusCode = statusCode;
    this.metric = metric;
    this.current = current;
    this.limit = limit;
  }
}
