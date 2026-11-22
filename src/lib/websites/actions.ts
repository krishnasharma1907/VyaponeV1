/**
 * VyapOne — Website Configuration Server Actions [VO-040]
 *
 * Provides authenticated Server Actions for website configuration workflows.
 */

"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  getSiteVersionsQuerySchema,
  restoreVersionToDraftInputSchema,
  rollbackPublishedVersionInputSchema,
  saveSiteDraftInputSchema,
  type RestoreVersionToDraftInput,
  type RollbackPublishedVersionInput,
  type SaveSiteDraftInput,
} from "./schemas";
import {
  getSiteByBusinessId,
  getSiteConfiguration,
  getSiteConfigurationById,
  getSiteVersionHistory,
  loadOwnerWebsiteWorkspace,
  restoreVersionToDraft,
  rollbackPublishedVersion,
  saveSiteDraftConfiguration,
  WebsiteError,
  type OwnerWebsiteWorkspaceData,
} from "./service";
import type {
  GetSiteVersionsResult,
  RestoreVersionToDraftResult,
  RollbackPublishedVersionResult,
  SaveSiteDraftResult,
  SiteRow,
  SiteVersionRow,
  WebsiteActionResult,
  WebsiteConfiguration,
} from "./types";

function sanitizeError(error: unknown): { error: string; code?: string } {
  if (error instanceof WebsiteError) {
    return { error: error.message, code: error.code };
  }
  if (error instanceof Error) {
    return { error: error.message, code: "INTERNAL_ERROR" };
  }
  return { error: "An unexpected error occurred", code: "UNKNOWN_ERROR" };
}

/**
 * Retrieves the website record for a given business.
 */
export async function getSiteAction(
  businessId: string,
): Promise<WebsiteActionResult<SiteRow | null>> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Authentication required", code: "UNAUTHENTICATED" };
    }

    const site = await getSiteByBusinessId(supabase, businessId);
    return { success: true, data: site };
  } catch (error) {
    return { success: false, ...sanitizeError(error) };
  }
}

/**
 * Retrieves the validated configuration document for a site version.
 */
export async function getSiteConfigurationAction(
  siteId: string,
  versionNumber?: number,
): Promise<WebsiteActionResult<{ version: SiteVersionRow; configuration: WebsiteConfiguration }>> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Authentication required", code: "UNAUTHENTICATED" };
    }

    const result = await getSiteConfiguration(supabase, siteId, versionNumber);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, ...sanitizeError(error) };
  }
}

/**
 * Loads the authenticated owner's website workspace.
 * Resolves verified business facts, locations, catalogue items, and current draft.
 * Prevents unauthorized or cross-business access (VO-044 Audit B & D).
 */
export async function loadOwnerWebsiteWorkspaceAction(
  businessId?: string,
): Promise<WebsiteActionResult<OwnerWebsiteWorkspaceData>> {
  try {
    const supabase = await createServerSupabaseClient();
    const data = await loadOwnerWebsiteWorkspace(supabase, businessId);
    return { success: true, data };
  } catch (error) {
    return { success: false, ...sanitizeError(error) };
  }
}

/**
 * Saves a new draft configuration version for a site.
 */
export async function saveSiteDraftConfigurationAction(
  rawInput: SaveSiteDraftInput,
): Promise<WebsiteActionResult<SaveSiteDraftResult>> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Authentication required", code: "UNAUTHENTICATED" };
    }

    const parseResult = saveSiteDraftInputSchema.safeParse(rawInput);
    if (!parseResult.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parseResult.error.issues) {
        const path = issue.path.join(".");
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return {
        success: false,
        error: "Validation failed: please review the configuration schema",
        code: "VALIDATION_FAILED",
        validationErrors: fieldErrors,
      };
    }

    const result = await saveSiteDraftConfiguration(supabase, user.id, parseResult.data);

    revalidatePath("/dashboard/website");
    revalidatePath("/workspace/clients");

    return { success: true, data: result };
  } catch (error) {
    return { success: false, ...sanitizeError(error) };
  }
}

/**
 * Retrieves the version history and status summaries for a site [VO-048].
 */
export async function getSiteVersionsAction(
  siteId: string,
  options?: { limit?: number; offset?: number },
): Promise<WebsiteActionResult<GetSiteVersionsResult>> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Authentication required", code: "UNAUTHENTICATED" };
    }

    const queryResult = getSiteVersionsQuerySchema.safeParse({ siteId, ...options });
    if (!queryResult.success) {
      return {
        success: false,
        error: "Invalid version query parameters",
        code: "VALIDATION_FAILED",
      };
    }

    const result = await getSiteVersionHistory(supabase, queryResult.data.siteId, {
      limit: queryResult.data.limit,
      offset: queryResult.data.offset,
    });

    return { success: true, data: result };
  } catch (error) {
    return { success: false, ...sanitizeError(error) };
  }
}

/**
 * Retrieves the configuration document for a specific historical version ID [VO-048].
 */
export async function getSiteVersionByIdAction(
  siteId: string,
  versionId: string,
): Promise<WebsiteActionResult<{ version: SiteVersionRow; configuration: WebsiteConfiguration }>> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Authentication required", code: "UNAUTHENTICATED" };
    }

    const result = await getSiteConfigurationById(supabase, siteId, versionId);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, ...sanitizeError(error) };
  }
}

/**
 * Rolls back the site's live published version to a previously published version [VO-048].
 */
export async function rollbackPublishedVersionAction(
  rawInput: RollbackPublishedVersionInput,
): Promise<WebsiteActionResult<RollbackPublishedVersionResult>> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Authentication required", code: "UNAUTHENTICATED" };
    }

    const parseResult = rollbackPublishedVersionInputSchema.safeParse(rawInput);
    if (!parseResult.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parseResult.error.issues) {
        const path = issue.path.join(".");
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return {
        success: false,
        error: "Validation failed: please check rollback parameters",
        code: "VALIDATION_FAILED",
        validationErrors: fieldErrors,
      };
    }

    const result = await rollbackPublishedVersion(supabase, user.id, parseResult.data);

    revalidatePath("/dashboard/website");
    revalidatePath("/workspace/clients");
    revalidatePath(`/s/${result.site.subdomain}`, "layout");

    return { success: true, data: result };
  } catch (error) {
    return { success: false, ...sanitizeError(error) };
  }
}

/**
 * Restores a historical version into a new working draft [VO-048].
 */
export async function restoreVersionToDraftAction(
  rawInput: RestoreVersionToDraftInput,
): Promise<WebsiteActionResult<RestoreVersionToDraftResult>> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Authentication required", code: "UNAUTHENTICATED" };
    }

    const parseResult = restoreVersionToDraftInputSchema.safeParse(rawInput);
    if (!parseResult.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parseResult.error.issues) {
        const path = issue.path.join(".");
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return {
        success: false,
        error: "Validation failed: please check restore parameters",
        code: "VALIDATION_FAILED",
        validationErrors: fieldErrors,
      };
    }

    const result = await restoreVersionToDraft(supabase, user.id, parseResult.data);

    revalidatePath("/dashboard/website");
    revalidatePath("/workspace/clients");

    return { success: true, data: result };
  } catch (error) {
    return { success: false, ...sanitizeError(error) };
  }
}
