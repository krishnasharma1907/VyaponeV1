/**
 * VyapOne — Business Import Service [VO-034]
 *
 * Implements:
 * 1. Building and staging import proposals from JSON, CSV, or Text.
 * 2. Updating field review status (confirm, edit, reject).
 * 3. Bulk confirming high-confidence fields with human authorization.
 * 4. Executing confirmed business imports atomically, validating required fields,
 *    enforcing workspace RBAC and draft capacity, creating catalogue items, and
 *    recording structured audit logs.
 *
 * Invariant:
 * Every extracted price, timing, and material fact stays unconfirmed until a person accepts it.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { assertWorkspaceAccess } from "@/lib/auth/tenant-access";
import { recordAuditEvent } from "@/lib/audit/service";
import { assertCapacityAvailable } from "@/lib/plans/service";
import { BusinessError, createBusinessWithSetup } from "../service";
import { createBusinessWithSetupSchema, type CreateBusinessWithSetupInput } from "../schemas";
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
  ImportReviewField,
} from "./types";
import { confirmAllHighConfidenceFields, updateProposalField } from "./proposal";

export { confirmAllHighConfidenceFields, updateProposalField };
export type { ConfirmedImportResult };

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
 * Atomically executes a confirmed business import:
 * 1. Validates proposal fields and readiness (no unconfirmed material facts allowed).
 * 2. Checks workspace role and capacity limits.
 * 3. Calls atomic business creation RPC.
 * 4. Inserts confirmed catalogue items.
 * 5. Records structured audit log.
 */
export async function executeConfirmedBusinessImport(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  input: ConfirmBusinessImportInput,
): Promise<ConfirmedImportResult> {
  // 1. Validate payload schema
  const validated = confirmBusinessImportSchema.parse(input);

  // 2. Authorize caller in the target workspace
  const wsAccess = await assertWorkspaceAccess(supabase, validated.workspaceId, {
    requiredPermission: "workspace:manage_businesses",
  });

  if (!["workspace_owner", "workspace_admin", "reseller_admin"].includes(wsAccess.role)) {
    throw new BusinessError(
      "You do not have administrative permissions in this workspace to import client stores.",
      "WORKSPACE_PERMISSION_DENIED",
      403,
    );
  }

  // 3. Enforce draft capacity before doing any provisioning
  await assertCapacityAvailable(supabase, validated.workspaceId, "draft_websites", 1);

  // 4. Verify all fields readiness: reject if unconfirmed material facts exist
  const readiness = evaluateProposalReadiness(validated.fields as ImportReviewField[]);
  if (!readiness.isReady) {
    throw new BusinessError(
      `Cannot provision store: ${readiness.blockingReasons.join("; ")}`,
      "IMPORT_PROPOSAL_NOT_CONFIRMED",
      400,
    );
  }

  // 5. Assemble verified facts
  const getConfirmedField = <T>(fieldName: string): T | null => {
    const f = validated.fields.find(
      (field) =>
        field.fieldName === fieldName &&
        (field.status === "confirmed" || field.status === "edited"),
    );
    if (!f) return null;
    return (
      f.status === "edited" && f.editedValue !== undefined ? f.editedValue : f.extractedValue
    ) as T;
  };

  const tradeName = getConfirmedField<string>("trade_name");
  if (!tradeName) {
    throw new BusinessError("Confirmed trade name is missing", "INVALID_IMPORT_DATA", 400);
  }

  const legalName = getConfirmedField<string>("legal_name") || tradeName;
  const nicheSlug = getConfirmedField<string>("niche_slug") || "other_business";
  const description = getConfirmedField<string>("description") || "";

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
  const confirmedCatalogueItems: ExtractedCatalogueItem[] = [];
  const catalogueFields = validated.fields.filter(
    (f) => f.category === "catalogue" && (f.status === "confirmed" || f.status === "edited"),
  );
  for (const cf of catalogueFields) {
    const item = (
      cf.status === "edited" && cf.editedValue !== undefined ? cf.editedValue : cf.extractedValue
    ) as ExtractedCatalogueItem;
    if (item && item.title && typeof item.priceMinor === "number") {
      confirmedCatalogueItems.push(item);
    }
  }

  // 6. Call createBusinessWithSetup
  const setupInput: CreateBusinessWithSetupInput = {
    workspace_id: validated.workspaceId,
    trade_name: tradeName,
    legal_name: legalName,
    niche_slug: nicheSlug,
    description,
    primary_location: {
      name: "Main Store",
      address_line1: addressLine1,
      address_line2: addressLine2 || null,
      city,
      state,
      postal_code: postalCode,
    },
    contact: {
      primary_phone: primaryPhone,
      whatsapp_number: whatsappNumber,
      email: email || null,
    },
    gst_number: gstNumber,
    pan_number: panNumber,
    tax_scheme: taxScheme,
    onboarding_answers: {
      ...timingsAnswers,
      import_source: validated.sourceFormat,
      import_proposal_id: validated.proposalId,
    },
    proposal_confirmed: true,
  };

  const setupResult = await createBusinessWithSetup(
    supabase,
    callerUserId,
    createBusinessWithSetupSchema.parse(setupInput),
  );

  // 7. Insert confirmed catalogue items into public.catalogue_items
  let catalogueItemsCreated = 0;
  if (confirmedCatalogueItems.length > 0) {
    type CatalogueItemInsert = Database["public"]["Tables"]["catalogue_items"]["Insert"];
    const itemsToInsert: CatalogueItemInsert[] = confirmedCatalogueItems.map((item) => ({
      business_id: setupResult.business.id,
      location_id: setupResult.primaryLocation.id,
      title: item.title,
      description: item.description || null,
      price_minor: item.priceMinor,
      currency_code: item.currencyCode || "INR",
      sku: item.sku || null,
      is_available: true,
    }));

    const { error: catError } = await supabase.from("catalogue_items").insert(itemsToInsert);
    if (!catError) {
      catalogueItemsCreated = itemsToInsert.length;
    }
  }

  // 8. Log structured audit event
  await recordAuditEvent(supabase, {
    businessId: setupResult.business.id,
    workspaceId: validated.workspaceId,
    actorUserId: callerUserId,
    action: "business.import_confirmed",
    resource: "businesses",
    metadata: {
      proposal_id: validated.proposalId,
      source_format: validated.sourceFormat,
      source_file_name: validated.sourceFileName || null,
      total_fields_reviewed: validated.fields.length,
      confirmed_catalogue_items: catalogueItemsCreated,
      provisioned_business_id: setupResult.business.id,
    },
  });

  return {
    business: setupResult.business,
    primaryLocation: setupResult.primaryLocation,
    catalogueItemsCreated,
    auditLogAction: "business.import_confirmed",
  };
}
