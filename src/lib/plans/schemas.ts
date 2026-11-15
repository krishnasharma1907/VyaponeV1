import { z } from "zod";

export const planIdSchema = z.enum(["starter", "growth", "pro", "agency", "scale"]);

export const subscriptionStatusSchema = z.enum([
  "active",
  "trialing",
  "past_due",
  "grace_period",
  "canceled",
]);

export const featureKeySchema = z.enum([
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
]);

export const capacityMetricSchema = z.enum([
  "live_websites",
  "draft_websites",
  "team_seats",
  "locations_per_business",
  "catalogue_items_per_business",
]);

export const checkEntitlementSchema = z
  .object({
    workspace_id: z.string().uuid("Invalid workspace ID").optional(),
    business_id: z.string().uuid("Invalid business ID").optional(),
    feature: featureKeySchema,
  })
  .refine(
    (data) => Boolean(data.workspace_id || data.business_id),
    "Either workspace_id or business_id must be provided to evaluate an entitlement",
  );

export const checkCapacitySchema = z.object({
  workspace_id: z.string().uuid("Invalid workspace ID"),
  metric: capacityMetricSchema,
  quantity: z.number().int().min(1).default(1),
});

export const createEntitlementOverrideSchema = z
  .object({
    workspace_id: z.string().uuid("Invalid workspace ID").optional(),
    business_id: z.string().uuid("Invalid business ID").optional(),
    feature_key: featureKeySchema,
    is_enabled: z.boolean().default(true),
    expires_at: z.string().datetime().nullable().optional(),
    reason: z
      .string()
      .trim()
      .max(200, "Reason must not exceed 200 characters")
      .nullable()
      .optional(),
  })
  .refine(
    (data) => Boolean(data.workspace_id) !== Boolean(data.business_id),
    "Exactly one of workspace_id or business_id must be provided",
  );

export const createCapacityOverrideSchema = z.object({
  workspace_id: z.string().uuid("Invalid workspace ID"),
  metric: capacityMetricSchema,
  additional_capacity: z
    .number()
    .int("Additional capacity must be an integer")
    .min(1, "Additional capacity must be at least 1"),
  expires_at: z.string().datetime().nullable().optional(),
  reason: z.string().trim().max(200, "Reason must not exceed 200 characters").nullable().optional(),
});
