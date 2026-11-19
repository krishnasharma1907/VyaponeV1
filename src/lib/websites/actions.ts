/**
 * VyapOne — Website Configuration Server Actions [VO-040]
 *
 * Provides authenticated Server Actions for website configuration workflows.
 */

"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { saveSiteDraftInputSchema, type SaveSiteDraftInput } from "./schemas";
import {
  getSiteByBusinessId,
  getSiteConfiguration,
  saveSiteDraftConfiguration,
  WebsiteError,
} from "./service";
import type {
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
