/**
 * VyapOne — Niche & Module Registry Validation Schemas [VO-030]
 */

import { z } from "zod";

export const availabilityLabelSchema = z.enum([
  "live_operational",
  "informational_with_enquiry",
  "coming_soon",
]);

export const moduleCategorySchema = z.enum([
  "core",
  "operations",
  "growth",
  "compliance",
  "commerce",
]);

export const moduleStatusSchema = z.enum(["active", "beta", "coming_soon", "deprecated"]);

export const nicheStatusSchema = z.enum(["active", "inactive", "deprecated"]);

export const onboardingQuestionSchema = z.object({
  key: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9_]+$/, "Question key must be lower-snake-case"),
  label: z.string().min(2).max(128),
  description: z.string().max(256).optional(),
  type: z.enum(["text", "number", "select", "multiselect", "boolean", "file"]),
  required: z.boolean().default(false),
  options: z.array(z.string().min(1)).optional(),
  placeholder: z.string().max(128).optional(),
});

export const dashboardNavItemSchema = z.object({
  id: z.string().min(2).max(64),
  label: z.string().min(2).max(64),
  href: z.string().min(1).max(256),
  icon: z.string().max(64).optional(),
  requiredModule: z.string().max(64).optional(),
});

export const nichePresetsSchema = z.object({
  websiteBlocks: z.array(z.string()).optional(),
  suggestedTags: z.array(z.string()).optional(),
  sampleOfferings: z.array(z.string()).optional(),
});

export const nicheManifestSchema = z.object({
  version: z.literal("v1"),
  nicheGroupSlug: z.string().min(2).max(64),
  nicheSlug: z.string().min(2).max(64),
  name: z.string().min(2).max(128),
  availabilityLabel: availabilityLabelSchema,
  modules: z.object({
    defaultEnabled: z.array(z.string()),
    recommended: z.array(z.string()),
  }),
  onboarding: z.object({
    requiredQuestions: z.array(onboardingQuestionSchema),
  }),
  dashboardNavigation: z.array(dashboardNavItemSchema),
  presets: nichePresetsSchema.optional(),
});

export const enableBusinessModuleSchema = z.object({
  businessId: z.string().uuid("Invalid business UUID"),
  moduleKey: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9_]+$/, "Module key must be lower_snake_case"),
  customConfig: z.record(z.string(), z.unknown()).optional(),
});

export const disableBusinessModuleSchema = z.object({
  businessId: z.string().uuid("Invalid business UUID"),
  moduleKey: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9_]+$/, "Module key must be lower_snake_case"),
});
