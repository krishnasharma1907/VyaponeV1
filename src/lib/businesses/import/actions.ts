"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { assertWorkspaceAccess } from "@/lib/auth/tenant-access";
import type { BusinessActionResult } from "../types";
import {
  confirmBusinessImportSchema,
  parseBusinessImportSchema,
  type ConfirmBusinessImportInput,
  type ParseBusinessImportInput,
} from "./schemas";
import {
  createImportProposal,
  executeConfirmedBusinessImport,
  type ConfirmedImportResult,
} from "./service";
import type { BusinessImportProposal } from "./types";

/**
 * Server Action: Parses import payload and returns staged unconfirmed proposal.
 */
export async function parseBusinessImportAction(
  input: ParseBusinessImportInput,
): Promise<BusinessActionResult<BusinessImportProposal>> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        success: false,
        error: "Authentication required to parse business imports",
        code: "UNAUTHENTICATED",
      };
    }

    const validated = parseBusinessImportSchema.parse(input);

    // Verify workspace access
    await assertWorkspaceAccess(supabase, validated.workspaceId, {
      requiredPermission: "workspace:manage_businesses",
    });

    const proposal = await createImportProposal(validated);
    return {
      success: true,
      data: proposal,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to parse business import";
    return {
      success: false,
      error: message,
      code: "PARSE_IMPORT_FAILED",
    };
  }
}

/**
 * Server Action: Atomically provisions client business from confirmed review proposal.
 */
export async function confirmBusinessImportAction(
  input: ConfirmBusinessImportInput,
): Promise<BusinessActionResult<ConfirmedImportResult>> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        success: false,
        error: "Authentication required to confirm business import",
        code: "UNAUTHENTICATED",
      };
    }

    const validated = confirmBusinessImportSchema.parse(input);

    const result = await executeConfirmedBusinessImport(supabase, user.id, validated);

    // Invalidate clients directory cache
    revalidatePath("/workspace/clients");
    revalidatePath("/workspace/clients/new");

    return {
      success: true,
      data: result,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to confirm business import";
    return {
      success: false,
      error: message,
      code: "CONFIRM_IMPORT_FAILED",
    };
  }
}
