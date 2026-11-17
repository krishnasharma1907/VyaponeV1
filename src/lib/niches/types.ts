/**
 * VyapOne — Niche & Module Registry Types [VO-030]
 *
 * Defines contracts for niche groups, specific niches, versioned manifests,
 * platform modules, niche-to-module mappings, and tenant business module configurations.
 */

import type { Database } from "@/lib/supabase/types";
import type { FeatureKey } from "@/lib/plans/types";

export type AvailabilityLabel = "live_operational" | "informational_with_enquiry" | "coming_soon";

export type NicheStatus = "active" | "inactive" | "deprecated";

export type ModuleCategory = "core" | "operations" | "growth" | "compliance" | "commerce";

export type ModuleStatus = "active" | "beta" | "coming_soon" | "deprecated";

export type QuestionType =
  | "text"
  | "number"
  | "boolean"
  | "select"
  | "multiselect"
  | "date"
  | "time"
  | "structured_address"
  | "file";

export interface QuestionOption {
  value: string;
  label: string;
  description?: string;
}

export type ConditionOperator =
  | "equals"
  | "not_equals"
  | "in"
  | "not_in"
  | "contains"
  | "greater_than"
  | "less_than"
  | "truthy"
  | "falsy";

export interface QuestionCondition {
  dependsOn: string;
  operator: ConditionOperator;
  value?: unknown;
}

export interface QuestionValidationRules {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  patternError?: string;
  customError?: string;
}

export interface StructuredAddressValue {
  addressLine1: string;
  addressLine2?: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string; // 6-digit Indian PIN
}

export interface OnboardingQuestion {
  key: string;
  label: string;
  description?: string;
  type: QuestionType;
  required: boolean;
  defaultValue?: unknown;
  placeholder?: string;
  options?: Array<string | QuestionOption>;
  validation?: QuestionValidationRules;
  displayOrder?: number;
  condition?: QuestionCondition;
  group?: string; // e.g. "profile", "operations", "services", "catalog", "delivery"
  helpUrl?: string;
}

export interface MissingFieldItem {
  key: string;
  label: string;
  group?: string;
  message: string;
}

export interface ValidationErrorItem {
  key: string;
  label: string;
  group?: string;
  error: string;
}

export interface OnboardingEvaluationResult {
  isValid: boolean;
  isComplete: boolean;
  nicheSlug: string;
  manifestVersion: string;
  totalQuestions: number;
  visibleQuestions: string[];
  hiddenQuestions: string[];
  missingRequiredFields: MissingFieldItem[];
  validationErrors: ValidationErrorItem[];
  sanitizedAnswers: Record<string, unknown>;
}

export interface BusinessOnboardingAnswersRecord {
  id: string;
  businessId: string;
  nicheSlug: string;
  manifestVersion: string;
  answers: Record<string, unknown>;
  isComplete: boolean;
  missingFields: MissingFieldItem[];
  createdAt: string;
  updatedAt: string;
}

export interface DashboardNavItem {
  id: string;
  label: string;
  href: string;
  icon?: string;
  requiredModule?: string;
}

export interface NichePresets {
  websiteBlocks?: string[];
  suggestedTags?: string[];
  sampleOfferings?: string[];
}

export interface NicheManifest {
  version: "v1";
  nicheGroupSlug: string;
  nicheSlug: string;
  name: string;
  availabilityLabel: AvailabilityLabel;
  modules: {
    defaultEnabled: string[];
    recommended: string[];
  };
  onboarding: {
    requiredQuestions: OnboardingQuestion[];
  };
  dashboardNavigation: DashboardNavItem[];
  presets?: NichePresets;
}

export type NicheGroupRow = Database["public"]["Tables"]["niche_groups"]["Row"];
export type NicheRow = Database["public"]["Tables"]["niches"]["Row"];
export type PlatformModuleRow = Database["public"]["Tables"]["platform_modules"]["Row"];
export type NicheModuleRow = Database["public"]["Tables"]["niche_modules"]["Row"];
export type BusinessModuleRow = Database["public"]["Tables"]["business_modules"]["Row"];
export type BusinessOnboardingAnswersRow =
  Database["public"]["Tables"]["business_onboarding_answers"]["Row"];

export interface NicheGroupSummary {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  displayOrder: number;
  status: NicheStatus;
  nicheCount?: number;
}

export interface NicheSummary {
  id: string;
  nicheGroupId: string;
  nicheGroupSlug?: string;
  slug: string;
  name: string;
  description: string | null;
  availabilityLabel: AvailabilityLabel;
  manifestVersion: string;
  displayOrder: number;
  status: NicheStatus;
}

export interface NicheWithDetails extends NicheSummary {
  manifest: NicheManifest;
  modules: Array<{
    moduleKey: string;
    moduleName: string;
    category: ModuleCategory;
    isDefault: boolean;
    isRecommended: boolean;
    presetConfig: Record<string, unknown>;
  }>;
}

export interface PlatformModuleSummary {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: ModuleCategory;
  entitlementFeatureKey: FeatureKey | null;
  status: ModuleStatus;
  displayOrder: number;
}

export interface BusinessModuleItem {
  id: string;
  businessId: string;
  moduleKey: string;
  moduleName?: string;
  category?: ModuleCategory;
  isEnabled: boolean;
  customConfig: Record<string, unknown>;
  enabledAt: string;
  updatedAt: string;
}

export interface ModuleEntitlementEvaluation {
  allowed: boolean;
  reason?: string;
  isEnabled: boolean;
  isEntitled: boolean;
  moduleKey: string;
  entitlementFeatureKey?: FeatureKey | null;
}
