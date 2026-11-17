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

export interface OnboardingQuestion {
  key: string;
  label: string;
  description?: string;
  type: "text" | "number" | "select" | "multiselect" | "boolean" | "file";
  required: boolean;
  options?: string[];
  placeholder?: string;
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
