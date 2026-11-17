/**
 * VyapOne — Niche & Module Registry Service [VO-030]
 *
 * Implements reusable operations for niche discovery, versioned manifests,
 * module capabilities, dynamic navigation generation, and tenant module lifecycle
 * with strict separation from plan entitlements.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";
import { checkFeatureEntitlement } from "@/lib/plans/service";
import type { FeatureKey } from "@/lib/plans/types";
import { recordAuditEvent } from "@/lib/audit/service";
import { assertBusinessAccess } from "@/lib/auth/tenant-access";
import { CANONICAL_MODULES, CANONICAL_NICHE_GROUPS, DEFAULT_NICHE_MANIFESTS } from "./constants";
import { nicheManifestSchema, structuredAddressSchema } from "./schemas";
import type {
  AvailabilityLabel,
  BusinessModuleItem,
  BusinessOnboardingAnswersRecord,
  DashboardNavItem,
  MissingFieldItem,
  ModuleCategory,
  ModuleEntitlementEvaluation,
  ModuleStatus,
  NicheGroupSummary,
  NicheManifest,
  NicheStatus,
  NicheSummary,
  NicheWithDetails,
  OnboardingEvaluationResult,
  OnboardingQuestion,
  PlatformModuleSummary,
  ValidationErrorItem,
} from "./types";

export class NicheRegistryError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number = 400,
  ) {
    super(message);
    this.name = "NicheRegistryError";
  }
}

/**
 * Lists all active high-level industry niche groups.
 */
export async function listNicheGroups(
  supabase: SupabaseClient<Database>,
): Promise<NicheGroupSummary[]> {
  try {
    const { data, error } = await supabase
      .from("niche_groups")
      .select("id, slug, name, description, display_order, status")
      .eq("status", "active")
      .order("display_order", { ascending: true });

    if (error || !data || data.length === 0) {
      // Fallback to canonical constants if database table not yet populated
      return CANONICAL_NICHE_GROUPS.map((g, idx) => ({
        id: `canonical-group-${g.slug}`,
        slug: g.slug,
        name: g.name,
        description: g.description,
        displayOrder: g.displayOrder,
        status: "active" as NicheStatus,
        nicheCount: idx === 0 ? 8 : 4,
      }));
    }

    return data.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      displayOrder: row.display_order,
      status: row.status as NicheStatus,
    }));
  } catch {
    return CANONICAL_NICHE_GROUPS.map((g) => ({
      id: `canonical-group-${g.slug}`,
      slug: g.slug,
      name: g.name,
      description: g.description,
      displayOrder: g.displayOrder,
      status: "active" as NicheStatus,
    }));
  }
}

/**
 * Fetches a single niche group by slug or UUID.
 */
export async function getNicheGroup(
  supabase: SupabaseClient<Database>,
  slugOrId: string,
): Promise<NicheGroupSummary | null> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId);

  try {
    let query = supabase.from("niche_groups").select("*");
    query = isUuid ? query.eq("id", slugOrId) : query.eq("slug", slugOrId);

    const { data, error } = await query.maybeSingle();

    if (error || !data) {
      const fallback = CANONICAL_NICHE_GROUPS.find((g) => g.slug === slugOrId);
      if (fallback) {
        return {
          id: `canonical-group-${fallback.slug}`,
          slug: fallback.slug,
          name: fallback.name,
          description: fallback.description,
          displayOrder: fallback.displayOrder,
          status: "active",
        };
      }
      return null;
    }

    return {
      id: data.id,
      slug: data.slug,
      name: data.name,
      description: data.description,
      displayOrder: data.display_order,
      status: data.status as NicheStatus,
    };
  } catch {
    const fallback = CANONICAL_NICHE_GROUPS.find((g) => g.slug === slugOrId);
    return fallback
      ? {
          id: `canonical-group-${fallback.slug}`,
          slug: fallback.slug,
          name: fallback.name,
          description: fallback.description,
          displayOrder: fallback.displayOrder,
          status: "active",
        }
      : null;
  }
}

/**
 * Lists all specific business niches with optional group filtering.
 */
export async function listNiches(
  supabase: SupabaseClient<Database>,
  options?: { groupSlug?: string; groupId?: string },
): Promise<NicheSummary[]> {
  try {
    let query = supabase
      .from("niches")
      .select(
        "id, niche_group_id, slug, name, description, availability_label, manifest_version, display_order, status, niche_groups (slug)",
      )
      .eq("status", "active")
      .order("display_order", { ascending: true });

    if (options?.groupId) {
      query = query.eq("niche_group_id", options.groupId);
    }

    const { data, error } = await query;

    if (error || !data || data.length === 0) {
      // Return static fallback niches if offline or empty
      const manifests = Object.values(DEFAULT_NICHE_MANIFESTS);
      const filtered = options?.groupSlug
        ? manifests.filter((m) => m.nicheGroupSlug === options.groupSlug)
        : manifests;

      return filtered.map((m, idx) => ({
        id: `canonical-niche-${m.nicheSlug}`,
        nicheGroupId: `canonical-group-${m.nicheGroupSlug}`,
        nicheGroupSlug: m.nicheGroupSlug,
        slug: m.nicheSlug,
        name: m.name,
        description: null,
        availabilityLabel: m.availabilityLabel,
        manifestVersion: m.version,
        displayOrder: (idx + 1) * 10,
        status: "active",
      }));
    }

    let results = data.map((row) => ({
      id: row.id,
      nicheGroupId: row.niche_group_id,
      nicheGroupSlug: (row.niche_groups as unknown as { slug?: string })?.slug,
      slug: row.slug,
      name: row.name,
      description: row.description,
      availabilityLabel: row.availability_label as AvailabilityLabel,
      manifestVersion: row.manifest_version,
      displayOrder: row.display_order,
      status: row.status as NicheStatus,
    }));

    if (options?.groupSlug) {
      results = results.filter((r) => r.nicheGroupSlug === options.groupSlug);
    }

    return results;
  } catch {
    const manifests = Object.values(DEFAULT_NICHE_MANIFESTS);
    return manifests.map((m, idx) => ({
      id: `canonical-niche-${m.nicheSlug}`,
      nicheGroupId: `canonical-group-${m.nicheGroupSlug}`,
      nicheGroupSlug: m.nicheGroupSlug,
      slug: m.nicheSlug,
      name: m.name,
      description: null,
      availabilityLabel: m.availabilityLabel,
      manifestVersion: m.version,
      displayOrder: (idx + 1) * 10,
      status: "active",
    }));
  }
}

/**
 * Retrieves full details and versioned manifest for a specific niche.
 */
export async function getNiche(
  supabase: SupabaseClient<Database>,
  slugOrId: string,
): Promise<NicheWithDetails | null> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId);

  try {
    let query = supabase.from("niches").select("*, niche_groups (slug)").eq("status", "active");

    query = isUuid ? query.eq("id", slugOrId) : query.eq("slug", slugOrId);

    const { data: niche, error } = await query.maybeSingle();

    if (error || !niche) {
      const fallback = DEFAULT_NICHE_MANIFESTS[slugOrId];
      if (fallback) {
        return {
          id: `canonical-niche-${fallback.nicheSlug}`,
          nicheGroupId: `canonical-group-${fallback.nicheGroupSlug}`,
          nicheGroupSlug: fallback.nicheGroupSlug,
          slug: fallback.nicheSlug,
          name: fallback.name,
          description: null,
          availabilityLabel: fallback.availabilityLabel,
          manifestVersion: fallback.version,
          displayOrder: 10,
          status: "active",
          manifest: fallback,
          modules: fallback.modules.defaultEnabled.map((mKey) => ({
            moduleKey: mKey,
            moduleName: mKey.replace(/_/g, " "),
            category: "operations",
            isDefault: true,
            isRecommended: true,
            presetConfig: {},
          })),
        };
      }
      return null;
    }

    // Parse versioned manifest
    const parsedManifest = nicheManifestSchema.safeParse(niche.manifest);
    const manifest: NicheManifest = parsedManifest.success
      ? (parsedManifest.data as NicheManifest)
      : (DEFAULT_NICHE_MANIFESTS[niche.slug] ?? {
          version: "v1",
          nicheGroupSlug:
            (niche.niche_groups as unknown as { slug?: string })?.slug ?? "other_business",
          nicheSlug: niche.slug,
          name: niche.name,
          availabilityLabel: niche.availability_label as AvailabilityLabel,
          modules: { defaultEnabled: ["website_engine"], recommended: ["website_engine"] },
          onboarding: { requiredQuestions: [] },
          dashboardNavigation: [{ id: "daily_pulse", label: "Daily Pulse", href: "/dashboard" }],
        });

    // Query mapped modules
    const { data: mappings } = await supabase
      .from("niche_modules")
      .select("is_default, is_recommended, preset_config, platform_modules (key, name, category)")
      .eq("niche_id", niche.id)
      .eq("status", "active");

    const modules = (mappings ?? []).map((m) => {
      const mod = m.platform_modules as unknown as {
        key: string;
        name: string;
        category: ModuleCategory;
      };
      return {
        moduleKey: mod.key,
        moduleName: mod.name,
        category: mod.category,
        isDefault: m.is_default,
        isRecommended: m.is_recommended,
        presetConfig: (m.preset_config as Record<string, unknown>) ?? {},
      };
    });

    return {
      id: niche.id,
      nicheGroupId: niche.niche_group_id,
      nicheGroupSlug: (niche.niche_groups as unknown as { slug?: string })?.slug,
      slug: niche.slug,
      name: niche.name,
      description: niche.description,
      availabilityLabel: niche.availability_label as AvailabilityLabel,
      manifestVersion: niche.manifest_version,
      displayOrder: niche.display_order,
      status: niche.status as NicheStatus,
      manifest,
      modules,
    };
  } catch {
    const fallback = DEFAULT_NICHE_MANIFESTS[slugOrId];
    if (!fallback) return null;

    return {
      id: `canonical-niche-${fallback.nicheSlug}`,
      nicheGroupId: `canonical-group-${fallback.nicheGroupSlug}`,
      nicheGroupSlug: fallback.nicheGroupSlug,
      slug: fallback.nicheSlug,
      name: fallback.name,
      description: null,
      availabilityLabel: fallback.availabilityLabel,
      manifestVersion: fallback.version,
      displayOrder: 10,
      status: "active",
      manifest: fallback,
      modules: [],
    };
  }
}

/**
 * Retrieves the full versioned NicheManifest for a given niche slug or id.
 */
export async function getNicheManifest(
  supabase: SupabaseClient<Database>,
  slugOrId: string,
): Promise<NicheManifest> {
  const niche = await getNiche(supabase, slugOrId);
  if (!niche) {
    throw new NicheRegistryError(
      `Niche '${slugOrId}' not found in registry`,
      "NICHE_NOT_FOUND",
      404,
    );
  }
  return niche.manifest;
}

/**
 * Lists all reusable platform capability modules.
 */
export async function listPlatformModules(
  supabase: SupabaseClient<Database>,
  options?: { category?: ModuleCategory },
): Promise<PlatformModuleSummary[]> {
  try {
    let query = supabase
      .from("platform_modules")
      .select("*")
      .eq("status", "active")
      .order("display_order", { ascending: true });

    if (options?.category) {
      query = query.eq("category", options.category);
    }

    const { data, error } = await query;

    if (error || !data || data.length === 0) {
      const filtered = options?.category
        ? CANONICAL_MODULES.filter((m) => m.category === options.category)
        : CANONICAL_MODULES;

      return filtered.map((m) => ({
        id: `canonical-module-${m.key}`,
        key: m.key,
        name: m.name,
        description: m.description,
        category: m.category,
        entitlementFeatureKey: m.entitlementFeatureKey ?? null,
        status: m.status,
        displayOrder: m.displayOrder,
      }));
    }

    return data.map((row) => ({
      id: row.id,
      key: row.key,
      name: row.name,
      description: row.description,
      category: row.category as ModuleCategory,
      entitlementFeatureKey: (row.entitlement_feature_key as FeatureKey) ?? null,
      status: row.status as ModuleStatus,
      displayOrder: row.display_order,
    }));
  } catch {
    const filtered = options?.category
      ? CANONICAL_MODULES.filter((m) => m.category === options.category)
      : CANONICAL_MODULES;

    return filtered.map((m) => ({
      id: `canonical-module-${m.key}`,
      key: m.key,
      name: m.name,
      description: m.description,
      category: m.category,
      entitlementFeatureKey: m.entitlementFeatureKey ?? null,
      status: m.status,
      displayOrder: m.displayOrder,
    }));
  }
}

/**
 * Fetches a single platform module by key or UUID.
 */
export async function getPlatformModule(
  supabase: SupabaseClient<Database>,
  keyOrId: string,
): Promise<PlatformModuleSummary | null> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(keyOrId);

  try {
    let query = supabase.from("platform_modules").select("*");
    query = isUuid ? query.eq("id", keyOrId) : query.eq("key", keyOrId);

    const { data, error } = await query.maybeSingle();

    if (error || !data) {
      const fallback = CANONICAL_MODULES.find((m) => m.key === keyOrId);
      if (fallback) {
        return {
          id: `canonical-module-${fallback.key}`,
          key: fallback.key,
          name: fallback.name,
          description: fallback.description,
          category: fallback.category,
          entitlementFeatureKey: fallback.entitlementFeatureKey ?? null,
          status: fallback.status,
          displayOrder: fallback.displayOrder,
        };
      }
      return null;
    }

    return {
      id: data.id,
      key: data.key,
      name: data.name,
      description: data.description,
      category: data.category as ModuleCategory,
      entitlementFeatureKey: (data.entitlement_feature_key as FeatureKey) ?? null,
      status: data.status as ModuleStatus,
      displayOrder: data.display_order,
    };
  } catch {
    const fallback = CANONICAL_MODULES.find((m) => m.key === keyOrId);
    return fallback
      ? {
          id: `canonical-module-${fallback.key}`,
          key: fallback.key,
          name: fallback.name,
          description: fallback.description,
          category: fallback.category,
          entitlementFeatureKey: fallback.entitlementFeatureKey ?? null,
          status: fallback.status,
          displayOrder: fallback.displayOrder,
        }
      : null;
  }
}

/**
 * Retrieves all enabled module records for a specific business.
 */
export async function getBusinessModules(
  supabase: SupabaseClient<Database>,
  businessId: string,
): Promise<BusinessModuleItem[]> {
  const { data, error } = await supabase
    .from("business_modules")
    .select("*, platform_modules (name, category)")
    .eq("business_id", businessId)
    .eq("is_enabled", true);

  if (error || !data) {
    return [];
  }

  return data.map((row) => {
    const mod = row.platform_modules as unknown as {
      name?: string;
      category?: ModuleCategory;
    } | null;
    return {
      id: row.id,
      businessId: row.business_id,
      moduleKey: row.module_key,
      moduleName: mod?.name,
      category: mod?.category,
      isEnabled: row.is_enabled,
      customConfig: (row.custom_config as Record<string, unknown>) ?? {},
      enabledAt: row.enabled_at,
      updatedAt: row.updated_at,
    };
  });
}

/**
 * Evaluates the 5-stage module lifecycle check for a business:
 * 1. Module exists in platform registry.
 * 2. Module is active.
 * 3. Module is enabled for the business in business_modules.
 * 4. Plan entitlement service checks if tenant workspace plan includes the feature.
 * 5. Returns whether execution/usage is permitted.
 */
export async function canBusinessUseModule(
  supabase: SupabaseClient<Database>,
  businessId: string,
  moduleKey: string,
): Promise<ModuleEntitlementEvaluation> {
  // 1. Module existence in platform registry
  const platformModule = await getPlatformModule(supabase, moduleKey);
  if (!platformModule) {
    return {
      allowed: false,
      reason: `Module '${moduleKey}' is not registered in the platform module catalogue`,
      isEnabled: false,
      isEntitled: false,
      moduleKey,
    };
  }

  // 2. Module active status
  if (platformModule.status === "coming_soon" || platformModule.status === "deprecated") {
    return {
      allowed: false,
      reason: `Module '${moduleKey}' is currently ${platformModule.status}`,
      isEnabled: false,
      isEntitled: false,
      moduleKey,
    };
  }

  // 3. Business enablement check
  const { data: bizModule } = await supabase
    .from("business_modules")
    .select("is_enabled")
    .eq("business_id", businessId)
    .eq("module_key", moduleKey)
    .maybeSingle();

  const isEnabled = bizModule?.is_enabled ?? false;
  if (!isEnabled) {
    return {
      allowed: false,
      reason: `Module '${moduleKey}' is not enabled for this business`,
      isEnabled: false,
      isEntitled: false,
      moduleKey,
      entitlementFeatureKey: platformModule.entitlementFeatureKey,
    };
  }

  // 4. Plan Entitlement Separation:
  // If the module has an associated plan feature key, evaluate entitlement via Plan Service
  if (platformModule.entitlementFeatureKey) {
    // Resolve parent workspace for the business
    const { data: business } = await supabase
      .from("businesses")
      .select("workspace_id")
      .eq("id", businessId)
      .maybeSingle();

    if (business?.workspace_id) {
      const evalResult = await checkFeatureEntitlement(supabase, {
        workspaceId: business.workspace_id,
        feature: platformModule.entitlementFeatureKey,
      });

      if (!evalResult.enabled) {
        return {
          allowed: false,
          reason:
            evalResult.reason ?? `Tenant subscription plan does not entitle module '${moduleKey}'`,
          isEnabled: true,
          isEntitled: false,
          moduleKey,
          entitlementFeatureKey: platformModule.entitlementFeatureKey,
        };
      }
    }
  }

  // 5. Permitted
  return {
    allowed: true,
    isEnabled: true,
    isEntitled: true,
    moduleKey,
    entitlementFeatureKey: platformModule.entitlementFeatureKey,
  };
}

/**
 * Enables a platform module for a business.
 * Validates caller authority and enforces fail-closed checks.
 */
export async function enableBusinessModule(
  supabase: SupabaseClient<Database>,
  input: {
    businessId: string;
    moduleKey: string;
    callerUserId: string;
    customConfig?: Record<string, unknown>;
  },
): Promise<BusinessModuleItem> {
  // Authorize caller: must be owner, manager, or parent workspace admin
  await assertBusinessAccess(supabase, input.businessId, {
    requiredRole: "manager",
  });

  // Verify module exists and is active
  const platformModule = await getPlatformModule(supabase, input.moduleKey);
  if (
    !platformModule ||
    platformModule.status === "coming_soon" ||
    platformModule.status === "deprecated"
  ) {
    throw new NicheRegistryError(
      `Cannot enable module '${input.moduleKey}': module is not active or registered`,
      "MODULE_UNAVAILABLE",
      400,
    );
  }

  const { data: updated, error } = await supabase
    .from("business_modules")
    .upsert(
      {
        business_id: input.businessId,
        module_key: input.moduleKey,
        is_enabled: true,
        custom_config: (input.customConfig ?? {}) as Json,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "business_id,module_key" },
    )
    .select("*")
    .single();

  if (error || !updated) {
    throw new NicheRegistryError(
      error?.message ?? "Failed to enable business module",
      "MODULE_ENABLE_FAILED",
      500,
    );
  }

  // Record audit log
  await recordAuditEvent(supabase, {
    businessId: input.businessId,
    actorUserId: input.callerUserId,
    action: "business.module_enabled",
    resource: "business_modules",
    metadata: {
      moduleKey: input.moduleKey,
      moduleName: platformModule.name,
    },
  });

  return {
    id: updated.id,
    businessId: updated.business_id,
    moduleKey: updated.module_key,
    moduleName: platformModule.name,
    category: platformModule.category,
    isEnabled: updated.is_enabled,
    customConfig: (updated.custom_config as Record<string, unknown>) ?? {},
    enabledAt: updated.enabled_at,
    updatedAt: updated.updated_at,
  };
}

/**
 * Disables a platform module for a business.
 * Validates caller authority.
 */
export async function disableBusinessModule(
  supabase: SupabaseClient<Database>,
  input: {
    businessId: string;
    moduleKey: string;
    callerUserId: string;
  },
): Promise<{ success: boolean }> {
  await assertBusinessAccess(supabase, input.businessId, {
    requiredRole: "manager",
  });

  // Cannot disable core website_engine
  if (input.moduleKey === "website_engine") {
    throw new NicheRegistryError(
      "The core website engine cannot be disabled.",
      "CORE_MODULE_REQUIRED",
      400,
    );
  }

  const { error } = await supabase
    .from("business_modules")
    .update({
      is_enabled: false,
      updated_at: new Date().toISOString(),
    })
    .eq("business_id", input.businessId)
    .eq("module_key", input.moduleKey);

  if (error) {
    throw new NicheRegistryError(
      error.message ?? "Failed to disable business module",
      "MODULE_DISABLE_FAILED",
      500,
    );
  }

  // Record audit log
  await recordAuditEvent(supabase, {
    businessId: input.businessId,
    actorUserId: input.callerUserId,
    action: "business.module_disabled",
    resource: "business_modules",
    metadata: {
      moduleKey: input.moduleKey,
    },
  });

  return { success: true };
}

/**
 * Dynamically resolves dashboard navigation items based on the niche's versioned manifest
 * and the business's currently enabled modules without bespoke routing code!
 *
 * Acceptance Criterion: All FINAL PRD niche groups can be represented without new bespoke routing code.
 */
export function resolveDashboardNavigation(
  manifest: NicheManifest,
  enabledModuleKeys: string[],
): DashboardNavItem[] {
  const enabledSet = new Set(enabledModuleKeys);

  // Core items with no requiredModule are always shown;
  // Module-linked items are displayed only when that module is enabled!
  return manifest.dashboardNavigation.filter((item) => {
    if (!item.requiredModule) {
      return true;
    }
    return enabledSet.has(item.requiredModule);
  });
}

/**
 * ==============================================================================
 * Onboarding Schema Engine & Conditional Validation [VO-031]
 * ==============================================================================
 */

/**
 * Detects circular condition dependencies using depth-first search (DFS).
 * Returns an array of question keys participating in a cycle, or empty array if acyclic.
 */
export function detectCircularConditions(questions: OnboardingQuestion[]): string[] {
  const questionMap = new Map<string, OnboardingQuestion>();
  for (const q of questions) {
    questionMap.set(q.key, q);
  }

  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const cycleMembers: string[] = [];

  function dfs(key: string, path: string[]): boolean {
    visited.add(key);
    recursionStack.add(key);

    const question = questionMap.get(key);
    if (question?.condition?.dependsOn) {
      const depKey = question.condition.dependsOn;
      if (questionMap.has(depKey)) {
        if (recursionStack.has(depKey)) {
          const cycleStartIndex = path.indexOf(depKey);
          if (cycleStartIndex !== -1) {
            cycleMembers.push(...path.slice(cycleStartIndex), key);
          } else {
            cycleMembers.push(depKey, key);
          }
          return true;
        }
        if (!visited.has(depKey)) {
          if (dfs(depKey, [...path, key])) {
            return true;
          }
        }
      }
    }

    recursionStack.delete(key);
    return false;
  }

  for (const q of questions) {
    if (!visited.has(q.key)) {
      if (dfs(q.key, [q.key])) {
        break;
      }
    }
  }

  return Array.from(new Set(cycleMembers));
}

/**
 * Validates condition dependency references and ensures no self-reference or circular loops.
 */
export function validateConditionDependencies(questions: OnboardingQuestion[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const questionKeys = new Set(questions.map((q) => q.key));

  for (const q of questions) {
    if (q.condition) {
      if (q.condition.dependsOn === q.key) {
        errors.push(`Question '${q.key}' cannot depend on itself.`);
      } else if (!questionKeys.has(q.condition.dependsOn)) {
        errors.push(
          `Question '${q.key}' depends on non-existent question '${q.condition.dependsOn}'.`,
        );
      }
    }
  }

  const cycles = detectCircularConditions(questions);
  if (cycles.length > 0) {
    errors.push(`Circular dependency detected involving questions: ${cycles.join(" -> ")}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Evaluates whether a question should be shown based on current answers and dependencies.
 * Also recursively verifies that parent questions are visible (cascading conditions).
 */
export function isQuestionVisible(
  question: OnboardingQuestion,
  answers: Record<string, unknown>,
  allQuestionsMap?: Map<string, OnboardingQuestion>,
  evaluatingSet?: Set<string>,
): boolean {
  if (!question.condition) {
    return true;
  }

  const { dependsOn, operator, value: expectedValue } = question.condition;

  // Prevent infinite loops in case of cycles
  const currentEvaluating = evaluatingSet ?? new Set<string>();
  if (currentEvaluating.has(question.key)) {
    return false;
  }
  currentEvaluating.add(question.key);

  // If question map provided, verify that parent question itself is visible!
  if (allQuestionsMap && allQuestionsMap.has(dependsOn)) {
    const parentQuestion = allQuestionsMap.get(dependsOn)!;
    const parentVisible = isQuestionVisible(
      parentQuestion,
      answers,
      allQuestionsMap,
      currentEvaluating,
    );
    if (!parentVisible) {
      return false;
    }
  }

  const actualValue = answers[dependsOn];

  switch (operator) {
    case "equals": {
      if (typeof expectedValue === "boolean") {
        return Boolean(actualValue) === expectedValue;
      }
      return actualValue === expectedValue;
    }
    case "not_equals": {
      if (typeof expectedValue === "boolean") {
        return Boolean(actualValue) !== expectedValue;
      }
      return actualValue !== expectedValue;
    }
    case "in": {
      if (!Array.isArray(expectedValue)) return false;
      return (expectedValue as unknown[]).some((v) => v === actualValue);
    }
    case "not_in": {
      if (!Array.isArray(expectedValue)) return true;
      return !(expectedValue as unknown[]).some((v) => v === actualValue);
    }
    case "contains": {
      if (Array.isArray(actualValue)) {
        return actualValue.includes(expectedValue as never);
      }
      if (typeof actualValue === "string") {
        return actualValue.includes(String(expectedValue));
      }
      return false;
    }
    case "greater_than": {
      const actualNum = Number(actualValue);
      const expectedNum = Number(expectedValue);
      if (isNaN(actualNum) || isNaN(expectedNum)) return false;
      return actualNum > expectedNum;
    }
    case "less_than": {
      const actualNum = Number(actualValue);
      const expectedNum = Number(expectedValue);
      if (isNaN(actualNum) || isNaN(expectedNum)) return false;
      return actualNum < expectedNum;
    }
    case "truthy": {
      return Boolean(actualValue) && actualValue !== "" && actualValue !== 0;
    }
    case "falsy": {
      return !actualValue || actualValue === "" || actualValue === 0 || actualValue === false;
    }
    default:
      return false;
  }
}

/**
 * Validates a single question answer according to its type and validation constraints.
 */
export function validateQuestionAnswer(
  question: OnboardingQuestion,
  value: unknown,
): { valid: boolean; error?: string } {
  const isEmpty =
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0) ||
    (typeof value === "object" &&
      !Array.isArray(value) &&
      Object.keys(value as object).length === 0);

  if (isEmpty) {
    if (question.required) {
      return { valid: false, error: `${question.label} is required` };
    }
    return { valid: true };
  }

  const validation = question.validation;

  switch (question.type) {
    case "text": {
      if (typeof value !== "string") {
        return { valid: false, error: `${question.label} must be a text value` };
      }
      const trimmed = value.trim();
      if (question.required && trimmed.length === 0) {
        return { valid: false, error: `${question.label} cannot be empty` };
      }
      if (validation?.minLength !== undefined && trimmed.length < validation.minLength) {
        return {
          valid: false,
          error:
            validation.customError ??
            `${question.label} must be at least ${validation.minLength} characters`,
        };
      }
      if (validation?.maxLength !== undefined && trimmed.length > validation.maxLength) {
        return {
          valid: false,
          error:
            validation.customError ??
            `${question.label} cannot exceed ${validation.maxLength} characters`,
        };
      }
      if (validation?.pattern) {
        const regex = new RegExp(validation.pattern);
        if (!regex.test(trimmed)) {
          return {
            valid: false,
            error:
              validation.patternError ??
              validation.customError ??
              `${question.label} is formatted incorrectly`,
          };
        }
      }
      return { valid: true };
    }

    case "number": {
      const num = typeof value === "number" ? value : Number(value);
      if (isNaN(num)) {
        return { valid: false, error: `${question.label} must be a valid number` };
      }
      if (validation?.min !== undefined && num < validation.min) {
        return {
          valid: false,
          error: validation.customError ?? `${question.label} must be at least ${validation.min}`,
        };
      }
      if (validation?.max !== undefined && num > validation.max) {
        return {
          valid: false,
          error: validation.customError ?? `${question.label} cannot exceed ${validation.max}`,
        };
      }
      return { valid: true };
    }

    case "boolean": {
      if (typeof value !== "boolean" && value !== "true" && value !== "false") {
        return { valid: false, error: `${question.label} must be yes or no` };
      }
      return { valid: true };
    }

    case "select": {
      if (typeof value !== "string") {
        return { valid: false, error: `${question.label} must be a selection` };
      }
      if (question.options && question.options.length > 0) {
        const allowedValues = question.options.map((opt) =>
          typeof opt === "string" ? opt : opt.value,
        );
        if (!allowedValues.includes(value)) {
          return {
            valid: false,
            error: `${question.label} contains an invalid option '${value}'`,
          };
        }
      }
      return { valid: true };
    }

    case "multiselect": {
      if (!Array.isArray(value)) {
        return { valid: false, error: `${question.label} must be a list of selections` };
      }
      if (question.options && question.options.length > 0) {
        const allowedValues = question.options.map((opt) =>
          typeof opt === "string" ? opt : opt.value,
        );
        for (const item of value) {
          if (typeof item !== "string" || !allowedValues.includes(item)) {
            return {
              valid: false,
              error: `${question.label} contains an invalid option '${item}'`,
            };
          }
        }
      }
      return { valid: true };
    }

    case "date": {
      if (typeof value !== "string") {
        return { valid: false, error: `${question.label} must be a date string` };
      }
      // ISO YYYY-MM-DD
      const dateRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
      if (!dateRegex.test(value)) {
        return { valid: false, error: `${question.label} must be formatted as YYYY-MM-DD` };
      }
      const parsedDate = new Date(`${value}T00:00:00Z`);
      if (isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== value) {
        return { valid: false, error: `${question.label} is an invalid calendar date` };
      }
      return { valid: true };
    }

    case "time": {
      if (typeof value !== "string") {
        return { valid: false, error: `${question.label} must be a time string` };
      }
      // 24-hr HH:mm
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      if (!timeRegex.test(value)) {
        return { valid: false, error: `${question.label} must be in 24-hour HH:mm format` };
      }
      return { valid: true };
    }

    case "structured_address": {
      const parseResult = structuredAddressSchema.safeParse(value);
      if (!parseResult.success) {
        const firstError = parseResult.error.issues[0]?.message ?? "Invalid address structure";
        return { valid: false, error: `${question.label}: ${firstError}` };
      }
      return { valid: true };
    }

    case "file": {
      if (typeof value !== "string" || value.trim().length === 0) {
        return { valid: false, error: `${question.label} must be a valid file reference` };
      }
      return { valid: true };
    }

    default:
      return { valid: true };
  }
}

/**
 * Evaluates onboarding answers against a manifest:
 * - Checks conditional visibility
 * - Detects missing required fields among visible questions
 * - Validates input formats
 * - Strips hidden/irrelevant answers to ensure clean state
 */
export function evaluateOnboardingAnswers(
  manifest: NicheManifest,
  rawAnswers: Record<string, unknown>,
): OnboardingEvaluationResult {
  const questions = manifest.onboarding.requiredQuestions;
  const depCheck = validateConditionDependencies(questions);
  if (!depCheck.valid) {
    throw new NicheRegistryError(
      `Manifest has invalid question conditions: ${depCheck.errors.join("; ")}`,
      "INVALID_MANIFEST_CONDITIONS",
      500,
    );
  }

  const questionMap = new Map<string, OnboardingQuestion>();
  for (const q of questions) {
    questionMap.set(q.key, q);
  }

  const visibleQuestions: string[] = [];
  const hiddenQuestions: string[] = [];
  const missingRequiredFields: MissingFieldItem[] = [];
  const validationErrors: ValidationErrorItem[] = [];
  const sanitizedAnswers: Record<string, unknown> = {};

  for (const q of questions) {
    const visible = isQuestionVisible(q, rawAnswers, questionMap);
    if (!visible) {
      hiddenQuestions.push(q.key);
      // Stripped from sanitizedAnswers - irrelevant/hidden questions are never stored!
      continue;
    }

    visibleQuestions.push(q.key);
    const rawVal = rawAnswers[q.key] !== undefined ? rawAnswers[q.key] : q.defaultValue;

    const isEmpty =
      rawVal === undefined ||
      rawVal === null ||
      rawVal === "" ||
      (Array.isArray(rawVal) && rawVal.length === 0) ||
      (typeof rawVal === "object" &&
        !Array.isArray(rawVal) &&
        Object.keys(rawVal as object).length === 0);

    if (isEmpty && q.required) {
      missingRequiredFields.push({
        key: q.key,
        label: q.label,
        group: q.group,
        message: `${q.label} is required`,
      });
    }

    if (!isEmpty) {
      const validationResult = validateQuestionAnswer(q, rawVal);
      if (!validationResult.valid) {
        validationErrors.push({
          key: q.key,
          label: q.label,
          group: q.group,
          error: validationResult.error ?? "Invalid value",
        });
      }
      sanitizedAnswers[q.key] = rawVal;
    }
  }

  const isValid = validationErrors.length === 0;
  const isComplete = isValid && missingRequiredFields.length === 0;

  return {
    isValid,
    isComplete,
    nicheSlug: manifest.nicheSlug,
    manifestVersion: manifest.version,
    totalQuestions: questions.length,
    visibleQuestions,
    hiddenQuestions,
    missingRequiredFields,
    validationErrors,
    sanitizedAnswers,
  };
}

/**
 * Saves or updates niche onboarding answers for a business tenant.
 * Validates manager authority, strips conditionally hidden answers,
 * records an audit log, and preserves strict plan entitlement separation.
 */
export async function saveBusinessOnboardingAnswers(
  supabase: SupabaseClient<Database>,
  input: {
    businessId: string;
    nicheSlug: string;
    manifestVersion?: string;
    answers: Record<string, unknown>;
    callerUserId: string;
  },
): Promise<BusinessOnboardingAnswersRecord> {
  // Validate caller permissions: requires manager role or sovereign owner
  await assertBusinessAccess(supabase, input.businessId, {
    requiredRole: "manager",
  });

  // Fetch the authoritative manifest for the given niche
  const manifest = await getNicheManifest(supabase, input.nicheSlug);

  // Evaluate answers against authoritative schema & conditions
  const evaluation = evaluateOnboardingAnswers(manifest, input.answers);

  if (!evaluation.isValid) {
    const errorDetails = evaluation.validationErrors
      .map((e) => `${e.label}: ${e.error}`)
      .join("; ");
    throw new NicheRegistryError(
      `Onboarding answers validation failed: ${errorDetails}`,
      "ONBOARDING_ANSWERS_INVALID",
      400,
    );
  }

  const version = input.manifestVersion ?? manifest.version;

  // Persist answers to database (atomic upsert per business)
  const { data: record, error } = await supabase
    .from("business_onboarding_answers")
    .upsert(
      {
        business_id: input.businessId,
        niche_slug: input.nicheSlug,
        manifest_version: version,
        answers: evaluation.sanitizedAnswers as Json,
        is_complete: evaluation.isComplete,
        missing_fields: evaluation.missingRequiredFields as unknown as Json,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "business_id" },
    )
    .select("*")
    .single();

  if (error || !record) {
    throw new NicheRegistryError(
      error?.message ?? "Failed to save business onboarding answers",
      "ONBOARDING_PERSISTENCE_FAILED",
      500,
    );
  }

  // Audit event
  await recordAuditEvent(supabase, {
    businessId: input.businessId,
    actorUserId: input.callerUserId,
    action: "business.onboarding_answers_saved",
    resource: "business_onboarding_answers",
    metadata: {
      nicheSlug: input.nicheSlug,
      manifestVersion: version,
      isComplete: evaluation.isComplete,
      missingCount: evaluation.missingRequiredFields.length,
      answeredCount: Object.keys(evaluation.sanitizedAnswers).length,
    },
  });

  return {
    id: record.id,
    businessId: record.business_id,
    nicheSlug: record.niche_slug,
    manifestVersion: record.manifest_version,
    answers: (record.answers as Record<string, unknown>) ?? {},
    isComplete: record.is_complete,
    missingFields: (record.missing_fields as unknown as MissingFieldItem[]) ?? [],
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

/**
 * Retrieves persisted onboarding answers for a business.
 */
export async function getBusinessOnboardingAnswers(
  supabase: SupabaseClient<Database>,
  businessId: string,
  callerUserId?: string,
): Promise<BusinessOnboardingAnswersRecord | null> {
  if (callerUserId) {
    await assertBusinessAccess(supabase, businessId, {
      requiredRole: "staff",
    });
  }

  const { data, error } = await supabase
    .from("business_onboarding_answers")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    businessId: data.business_id,
    nicheSlug: data.niche_slug,
    manifestVersion: data.manifest_version,
    answers: (data.answers as Record<string, unknown>) ?? {},
    isComplete: data.is_complete,
    missingFields: (data.missing_fields as unknown as MissingFieldItem[]) ?? [],
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}
