import type { FeatureKey, PlanDefinition, PlanId } from "./types";

/**
 * Standard base features shared across all tiers.
 */
const BASE_FEATURES: Record<FeatureKey, boolean> = {
  website_engine: true,
  catalogue_services: true,
  enquiries_leads: true,
  orders: true,
  appointments: false,
  inventory: false,
  qr_management: true,
  feedback_reviews: false,
  analytics: true,
  custom_domain: false,
  white_label: false,
  client_billing: false,
  smart_ai_bot: false,
  whatsapp_broadcasts: false,
  gst_e_invoicing: false,
  priority_support: false,
  dedicated_support: false,
};

/**
 * Master Plan Definitions adhering strictly to PRD FINAL v2 §9.1 & §9.2.
 * Commercial pricing values are explicit hypotheses pending reseller validation (ADR-011).
 */
export const PLANS: Record<PlanId, PlanDefinition> = {
  starter: {
    id: "starter",
    name: "Starter",
    positioning: "New reseller testing the service",
    priceMonthlyMinor: 39900, // ₹399 in minor units (paise)
    currencyCode: "INR",
    isHypothesis: true,
    capacities: {
      live_websites: 3,
      draft_websites: 10,
      team_seats: 2,
      locations_per_business: 1,
      catalogue_items_per_business: 50,
    },
    features: {
      ...BASE_FEATURES,
    },
  },

  growth: {
    id: "growth",
    name: "Growth",
    positioning: "Active freelancer or small agency",
    priceMonthlyMinor: 99900, // ₹999 in minor units (paise)
    currencyCode: "INR",
    isHypothesis: true,
    capacities: {
      live_websites: 8,
      draft_websites: 25,
      team_seats: 5,
      locations_per_business: 3,
      catalogue_items_per_business: 250,
    },
    features: {
      ...BASE_FEATURES,
      appointments: true,
      inventory: true,
      feedback_reviews: true,
      custom_domain: true,
    },
  },

  // Alias for 'growth' matching legacy database schemas and seed configurations
  pro: {
    id: "pro",
    name: "Growth (Pro)",
    positioning: "Active freelancer or small agency",
    priceMonthlyMinor: 99900,
    currencyCode: "INR",
    isHypothesis: true,
    capacities: {
      live_websites: 8,
      draft_websites: 25,
      team_seats: 5,
      locations_per_business: 3,
      catalogue_items_per_business: 250,
    },
    features: {
      ...BASE_FEATURES,
      appointments: true,
      inventory: true,
      feedback_reviews: true,
      custom_domain: true,
    },
  },

  agency: {
    id: "agency",
    name: "Agency",
    positioning: "Team managing several clients",
    priceMonthlyMinor: 199900, // ₹1,999 in minor units (paise)
    currencyCode: "INR",
    isHypothesis: true,
    capacities: {
      live_websites: 20,
      draft_websites: 50,
      team_seats: 15,
      locations_per_business: 10,
      catalogue_items_per_business: 1000,
    },
    features: {
      ...BASE_FEATURES,
      appointments: true,
      inventory: true,
      feedback_reviews: true,
      custom_domain: true,
      white_label: true,
      client_billing: true,
      priority_support: true,
    },
  },

  scale: {
    id: "scale",
    name: "Scale",
    positioning: "Higher-volume agency or franchise operation",
    priceMonthlyMinor: 0, // Configured quote per PRD §9.1
    currencyCode: "INR",
    isHypothesis: true,
    capacities: {
      live_websites: 50,
      draft_websites: 100,
      team_seats: 50,
      locations_per_business: 50,
      catalogue_items_per_business: 5000,
    },
    features: {
      ...BASE_FEATURES,
      appointments: true,
      inventory: true,
      feedback_reviews: true,
      custom_domain: true,
      white_label: true,
      client_billing: true,
      smart_ai_bot: true,
      whatsapp_broadcasts: true,
      gst_e_invoicing: true,
      priority_support: true,
      dedicated_support: true,
    },
  },
};

export const DEFAULT_PLAN_ID: PlanId = "starter";

/**
 * Normalizes legacy plan keys (e.g. 'pro' -> 'growth') while maintaining backward compatibility.
 */
export function normalizePlanId(planId: string | null | undefined): PlanId {
  if (!planId) return DEFAULT_PLAN_ID;
  const lower = planId.toLowerCase();
  if (lower in PLANS) {
    return lower as PlanId;
  }
  return DEFAULT_PLAN_ID;
}
