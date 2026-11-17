/**
 * VyapOne — Niche & Module Registry Validation Schemas [VO-030, VO-031]
 *
 * Schemas for niche manifests, onboarding questions, conditional evaluation,
 * structured Indian address, validation rules, and answer persistence.
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

export const questionTypeSchema = z.enum([
  "text",
  "number",
  "boolean",
  "select",
  "multiselect",
  "date",
  "time",
  "structured_address",
  "file",
]);

export const questionOptionObjectSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
});

export const questionOptionSchema = z.union([z.string().min(1), questionOptionObjectSchema]);

export const conditionOperatorSchema = z.enum([
  "equals",
  "not_equals",
  "in",
  "not_in",
  "contains",
  "greater_than",
  "less_than",
  "truthy",
  "falsy",
]);

export const questionConditionSchema = z.object({
  dependsOn: z.string().min(1).max(64),
  operator: conditionOperatorSchema,
  value: z.unknown().optional(),
});

export const questionValidationRulesSchema = z.object({
  min: z.number().optional(),
  max: z.number().optional(),
  minLength: z.number().int().nonnegative().optional(),
  maxLength: z.number().int().positive().optional(),
  pattern: z.string().optional(),
  patternError: z.string().optional(),
  customError: z.string().optional(),
});

export const structuredAddressSchema = z.object({
  addressLine1: z.string().min(1, "Address line 1 is required").max(255),
  addressLine2: z.string().max(255).optional(),
  landmark: z.string().max(255).optional(),
  city: z.string().min(1, "City is required").max(100),
  state: z.string().min(1, "State is required").max(100),
  pincode: z.string().regex(/^[1-9][0-9]{5}$/, "Pincode must be a 6-digit Indian PIN code"),
});

export const onboardingQuestionSchema = z.object({
  key: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9_]+$/, "Question key must be lower-snake-case"),
  label: z.string().min(2).max(128),
  description: z.string().max(256).optional(),
  type: questionTypeSchema,
  required: z.boolean().default(false),
  defaultValue: z.unknown().optional(),
  placeholder: z.string().max(128).optional(),
  options: z.array(questionOptionSchema).optional(),
  validation: questionValidationRulesSchema.optional(),
  displayOrder: z.number().int().optional(),
  condition: questionConditionSchema.optional(),
  group: z.string().max(64).optional(),
  helpUrl: z.string().url().max(255).optional(),
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

export const saveBusinessOnboardingAnswersSchema = z.object({
  businessId: z.string().uuid("Invalid business UUID"),
  nicheSlug: z.string().min(2).max(64),
  manifestVersion: z.string().min(1).max(16).default("v1"),
  answers: z.record(z.string(), z.unknown()),
});

export const evaluateOnboardingAnswersSchema = z.object({
  nicheSlug: z.string().min(2).max(64),
  answers: z.record(z.string(), z.unknown()),
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
