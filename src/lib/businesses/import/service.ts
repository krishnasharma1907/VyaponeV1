/**
 * VyapOne — Business Import Service [VO-034]
 *
 * Implements:
 * 1. Building and staging import proposals from JSON, CSV, or Text.
 * 2. Updating field review status (confirm, edit, reject).
 * 3. Bulk confirming high-confidence fields with human authorization.
 * 4. Executing confirmed business imports atomically via `confirm_business_import_atomic` RPC,
 *    guaranteeing all-or-nothing rollback across business provisioning, catalogue items,
 *    and structured audit event recording.
 *
 * Invariant:
 * Every extracted price, timing, and material fact stays unconfirmed until a person accepts it.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";
import { assertWorkspaceAccess } from "@/lib/auth/tenant-access";
import { assertCapacityAvailable } from "@/lib/plans/service";
import { CapacityExceededError } from "@/lib/plans/types";
import { BusinessError } from "../service";
import { evaluateProposalReadiness, parseBusinessImportContent } from "./parser";
import {
  confirmBusinessImportSchema,
  parseBusinessImportSchema,
  type ConfirmBusinessImportInput,
  type ParseBusinessImportInput,
} from "./schemas";
import type {
  BusinessImportProposal,
  ConfirmedImportResult,
  ExtractedCatalogueItem,
} from "./types";
import { confirmAllHighConfidenceFields, updateProposalField } from "./proposal";

export { confirmAllHighConfidenceFields, updateProposalField };
export type { ConfirmedImportResult };

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "business";
}

/**
 * Parses raw input and builds an unconfirmed proposal.
 */
export async function createImportProposal(
  input: ParseBusinessImportInput,
): Promise<BusinessImportProposal> {
  const validated = parseBusinessImportSchema.parse(input);
  return parseBusinessImportContent(
    validated.workspaceId,
    validated.content,
    validated.format,
    validated.sourceFileName,
  );
}

/**
 * Atomically executes a confirmed business import via transactional stored procedure:
 * 1. Validates proposal fields and readiness (no unconfirmed material facts allowed).
 * 2. Checks workspace role and capacity limits.
 * 3. Calls atomic import RPC `confirm_business_import_atomic`.
 * 4. Rolls back entirely if any catalogue item or audit log fails.
 */
export async function executeConfirmedBusinessImport(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  input: ConfirmBusinessImportInput,
): Promise<ConfirmedImportResult> {
  const validated = confirmBusinessImportSchema.parse(input);

  // 1. Authorize workspace management access
  const wsAccess = await assertWorkspaceAccess(supabase, validated.workspaceId, {
    requiredPermission: "workspace:manage_businesses",
  });

  if (!["workspace_owner", "workspace_admin", "reseller_admin"].includes(wsAccess.role)) {
    throw new BusinessError(
      "You do not have administrative permissions in the specified workspace",
      "WORKSPACE_PERMISSION_DENIED",
      403,
    );
  }

  // 2. Validate proposal readiness on the server
  const readiness = evaluateProposalReadiness(validated.fields);
  if (!readiness.isReady) {
    throw new BusinessError(
      `Cannot provision store: ${readiness.blockingReasons.join("; ")}`,
      "IMPORT_NOT_READY",
      400,
    );
  }

  // 3. Enforce draft capacity before proceeding
  try {
    await assertCapacityAvailable(supabase, validated.workspaceId, "draft_websites", 1);
  } catch (capErr: unknown) {
    if (capErr instanceof CapacityExceededError) {
      throw new BusinessError(
        capErr.message || "Capacity limit reached for draft websites. Please upgrade your plan.",
        "CAPACITY_EXCEEDED",
        403,
      );
    }
    if (capErr instanceof Error && capErr.message.includes("ATOMIC_RPC_UNAVAILABLE")) {
      throw capErr;
    }
  }

  // 4. Extract confirmed values
  const getConfirmedField = <T = unknown>(fieldName: string): T | undefined => {
    const f = validated.fields.find(
      (field) =>
        field.fieldName === fieldName &&
        (field.status === "confirmed" || field.status === "edited"),
    );
    if (!f) return undefined;
    return (
      f.status === "edited" && f.editedValue !== undefined ? f.editedValue : f.extractedValue
    ) as T;
  };

  // Identity
  const tradeName = getConfirmedField<string>("trade_name");
  if (!tradeName || tradeName.trim().length === 0) {
    throw new BusinessError("Confirmed trade name is missing", "INVALID_IMPORT_DATA", 400);
  }
  const legalName = getConfirmedField<string>("legal_name") || tradeName;
  const description = getConfirmedField<string>("description") || undefined;
  const nicheSlug = getConfirmedField<string>("niche_slug") || "other_business";
  const category = getConfirmedField<string>("category") || "other_business";

  // Contact
  const primaryPhone = getConfirmedField<string>("primary_phone") || "+919999999999";
  const whatsappNumber = getConfirmedField<string>("whatsapp_number") || primaryPhone;
  const email = getConfirmedField<string>("email") || undefined;

  // Location
  const addressLine1 = getConfirmedField<string>("address_line1");
  if (!addressLine1) {
    throw new BusinessError("Confirmed address line 1 is missing", "INVALID_IMPORT_DATA", 400);
  }
  const addressLine2 = getConfirmedField<string>("address_line2") || undefined;
  const city = getConfirmedField<string>("city") || "Indore";
  const state = getConfirmedField<string>("state") || "Madhya Pradesh";
  const postalCode = getConfirmedField<string>("postal_code") || "452001";

  // Statutory Tax
  const gstNumber = getConfirmedField<string>("gst_number") || null;
  const panNumber = getConfirmedField<string>("pan_number") || null;
  const taxScheme = gstNumber ? "registered" : "unregistered";

  // Timings & Answers
  const timingsAnswers: Record<string, unknown> = {};
  const timingFields = validated.fields.filter(
    (f) => f.category === "timings" && (f.status === "confirmed" || f.status === "edited"),
  );
  for (const tf of timingFields) {
    timingsAnswers[tf.fieldName] =
      tf.status === "edited" && tf.editedValue !== undefined ? tf.editedValue : tf.extractedValue;
  }

  // Catalogue Items
  const confirmedCatalogueItems: Array<{
    title: string;
    price_minor: number;
    currency_code: string;
    description?: string | null;
    sku?: string | null;
  }> = [];
  const catalogueFields = validated.fields.filter(
    (f) => f.category === "catalogue" && (f.status === "confirmed" || f.status === "edited"),
  );
  for (const cf of catalogueFields) {
    const item = (
      cf.status === "edited" && cf.editedValue !== undefined ? cf.editedValue : cf.extractedValue
    ) as ExtractedCatalogueItem;
    if (item && item.title && typeof item.priceMinor === "number") {
      if (item.priceMinor < 0) {
        throw new BusinessError(
          `Catalogue item '${item.title}' has invalid negative price`,
          "INVALID_CATALOGUE_ITEM",
          400,
        );
      }
      confirmedCatalogueItems.push({
        title: item.title.trim(),
        price_minor: item.priceMinor,
        currency_code: item.currencyCode || "INR",
        description: item.description || null,
        sku: item.sku || null,
      });
    }
  }

  // 5. Genuine All-or-Nothing Atomic Database Provisioning
  if (typeof supabase.rpc !== "function") {
    throw new BusinessError(
      "Atomic stored procedure confirm_business_import_atomic is required",
      "ATOMIC_RPC_REQUIRED",
      500,
    );
  }

  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    "confirm_business_import_atomic",
    {
      p_workspace_id: validated.workspaceId,
      p_caller_user_id: callerUserId,
      p_trade_name: tradeName.trim(),
      p_legal_name: legalName.trim(),
      p_slug: slugify(tradeName),
      p_niche_slug: nicheSlug,
      p_category: category,
      p_description: description ?? null,
      p_gst_number: gstNumber,
      p_pan_number: panNumber,
      p_tax_scheme: taxScheme,
      p_contact: {
        primary_phone: primaryPhone,
        whatsapp_number: whatsappNumber,
        email: email || null,
      } as unknown as Json,
      p_location_name: "Main Store",
      p_address_line1: addressLine1.trim(),
      p_address_line2: addressLine2 ?? null,
      p_city: city.trim(),
      p_state: state.trim(),
      p_postal_code: postalCode.trim(),
      p_timings_answers: timingsAnswers as unknown as Json,
      p_import_proposal_id: validated.proposalId,
      p_source_format: validated.sourceFormat,
      p_source_file_name: validated.sourceFileName ?? null,
      p_default_modules: ["website_engine"],
      p_catalogue_items: confirmedCatalogueItems as unknown as Json,
      p_reviewed_fields_count: validated.fields.length,
    },
  );

  if (rpcError) {
    if (rpcError.code === "VY001") {
      throw new BusinessError(
        rpcError.message || "Workspace draft website limit reached. Please upgrade your plan.",
        "CAPACITY_EXCEEDED",
        403,
      );
    }
    if (rpcError.code === "VY020" || rpcError.code === "VY021") {
      throw new BusinessError(
        rpcError.message || "You do not have management permissions in the specified workspace",
        "WORKSPACE_PERMISSION_DENIED",
        403,
      );
    }
    if (rpcError.code === "VY023") {
      throw new BusinessError(
        rpcError.message || "Validation failed for required import fields",
        "INVALID_IMPORT_DATA",
        400,
      );
    }
    if (rpcError.code === "VY024") {
      throw new BusinessError(
        rpcError.message ||
          `Import proposal '${validated.proposalId}' has already been confirmed and provisioned`,
        "DUPLICATE_IMPORT_PROPOSAL",
        409,
      );
    }
    if (rpcError.code === "VY025") {
      throw new BusinessError(
        rpcError.message || "Validation failed for confirmed catalogue items",
        "INVALID_CATALOGUE_ITEM",
        400,
      );
    }
    if (rpcError.code === "23505" || (rpcError.message && rpcError.message.includes("slug"))) {
      throw new BusinessError("A business with this slug already exists", "SLUG_CONFLICT", 409);
    }
    throw new BusinessError(
      rpcError.message || "Failed to confirm business import",
      "IMPORT_PROVISION_FAILED",
      500,
    );
  }

  if (rpcResult) {
    const res = rpcResult as unknown as {
      business: Database["public"]["Tables"]["businesses"]["Row"];
      primary_location: Database["public"]["Tables"]["locations"]["Row"];
      business_id: string;
      location_id: string;
      catalogue_items_created: number;
      audit_log_action: string;
    };

    return {
      business: res.business,
      primaryLocation: res.primary_location,
      catalogueItemsCreated: res.catalogue_items_created,
      auditLogAction: res.audit_log_action,
    };
  }

  throw new BusinessError(
    "Import confirmation RPC returned empty response",
    "EMPTY_RPC_RESPONSE",
    500,
  );
}
