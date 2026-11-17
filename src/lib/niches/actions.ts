"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { assertAuthenticatedUser, sanitizeTenantError } from "@/lib/auth/tenant-access";
import { disableBusinessModuleSchema, enableBusinessModuleSchema } from "./schemas";
import {
  canBusinessUseModule,
  disableBusinessModule,
  enableBusinessModule,
  getBusinessModules,
  getNiche,
  getNicheManifest,
  listNicheGroups,
  listNiches,
  listPlatformModules,
} from "./service";
import type {
  BusinessModuleItem,
  ModuleCategory,
  ModuleEntitlementEvaluation,
  NicheGroupSummary,
  NicheManifest,
  NicheSummary,
  NicheWithDetails,
  PlatformModuleSummary,
} from "./types";

export interface RegistryActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export async function listNicheGroupsAction(): Promise<RegistryActionResult<NicheGroupSummary[]>> {
  try {
    const supabase = await createServerSupabaseClient();
    const groups = await listNicheGroups(supabase);
    return { success: true, data: groups };
  } catch (err) {
    const sanitized = sanitizeTenantError(err);
    return { success: false, error: sanitized.error, code: sanitized.code };
  }
}

export async function listNichesAction(options?: {
  groupSlug?: string;
  groupId?: string;
}): Promise<RegistryActionResult<NicheSummary[]>> {
  try {
    const supabase = await createServerSupabaseClient();
    const niches = await listNiches(supabase, options);
    return { success: true, data: niches };
  } catch (err) {
    const sanitized = sanitizeTenantError(err);
    return { success: false, error: sanitized.error, code: sanitized.code };
  }
}

export async function getNicheDetailsAction(
  slugOrId: string,
): Promise<RegistryActionResult<NicheWithDetails | null>> {
  try {
    const supabase = await createServerSupabaseClient();
    const niche = await getNiche(supabase, slugOrId);
    return { success: true, data: niche };
  } catch (err) {
    const sanitized = sanitizeTenantError(err);
    return { success: false, error: sanitized.error, code: sanitized.code };
  }
}

export async function getNicheManifestAction(
  slugOrId: string,
): Promise<RegistryActionResult<NicheManifest>> {
  try {
    const supabase = await createServerSupabaseClient();
    const manifest = await getNicheManifest(supabase, slugOrId);
    return { success: true, data: manifest };
  } catch (err) {
    const sanitized = sanitizeTenantError(err);
    return { success: false, error: sanitized.error, code: sanitized.code };
  }
}

export async function listPlatformModulesAction(options?: {
  category?: ModuleCategory;
}): Promise<RegistryActionResult<PlatformModuleSummary[]>> {
  try {
    const supabase = await createServerSupabaseClient();
    const modules = await listPlatformModules(supabase, options);
    return { success: true, data: modules };
  } catch (err) {
    const sanitized = sanitizeTenantError(err);
    return { success: false, error: sanitized.error, code: sanitized.code };
  }
}

export async function getBusinessModulesAction(
  businessId: string,
): Promise<RegistryActionResult<BusinessModuleItem[]>> {
  try {
    const supabase = await createServerSupabaseClient();
    await assertAuthenticatedUser(supabase);
    const modules = await getBusinessModules(supabase, businessId);
    return { success: true, data: modules };
  } catch (err) {
    const sanitized = sanitizeTenantError(err);
    return { success: false, error: sanitized.error, code: sanitized.code };
  }
}

export async function canBusinessUseModuleAction(
  businessId: string,
  moduleKey: string,
): Promise<RegistryActionResult<ModuleEntitlementEvaluation>> {
  try {
    const supabase = await createServerSupabaseClient();
    await assertAuthenticatedUser(supabase);
    const result = await canBusinessUseModule(supabase, businessId, moduleKey);
    return { success: true, data: result };
  } catch (err) {
    const sanitized = sanitizeTenantError(err);
    return { success: false, error: sanitized.error, code: sanitized.code };
  }
}

export async function enableBusinessModuleAction(
  rawInput: unknown,
): Promise<RegistryActionResult<BusinessModuleItem>> {
  try {
    const supabase = await createServerSupabaseClient();
    const caller = await assertAuthenticatedUser(supabase);

    const parsed = enableBusinessModuleSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid module enable input",
        code: "VALIDATION_FAILED",
      };
    }

    const item = await enableBusinessModule(supabase, {
      businessId: parsed.data.businessId,
      moduleKey: parsed.data.moduleKey,
      callerUserId: caller.id,
      customConfig: parsed.data.customConfig as Record<string, unknown> | undefined,
    });

    return { success: true, data: item };
  } catch (err) {
    const sanitized = sanitizeTenantError(err);
    return { success: false, error: sanitized.error, code: sanitized.code };
  }
}

export async function disableBusinessModuleAction(
  rawInput: unknown,
): Promise<RegistryActionResult<{ success: boolean }>> {
  try {
    const supabase = await createServerSupabaseClient();
    const caller = await assertAuthenticatedUser(supabase);

    const parsed = disableBusinessModuleSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid module disable input",
        code: "VALIDATION_FAILED",
      };
    }

    const res = await disableBusinessModule(supabase, {
      businessId: parsed.data.businessId,
      moduleKey: parsed.data.moduleKey,
      callerUserId: caller.id,
    });

    return { success: true, data: res };
  } catch (err) {
    const sanitized = sanitizeTenantError(err);
    return { success: false, error: sanitized.error, code: sanitized.code };
  }
}
