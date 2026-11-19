/**
 * VyapOne — Business Import Proposal Manipulation [VO-034]
 *
 * Client-safe pure functions for updating in-memory import proposals.
 * Free of server-only and database dependencies.
 */

import { computeProposalStats, evaluateProposalReadiness } from "./parser";
import type { UpdateProposalFieldStatusInput } from "./schemas";
import type { BusinessImportProposal, ImportFieldStatus } from "./types";

/**
 * Updates a single field's review status within a proposal.
 */
export function updateProposalField(
  proposal: BusinessImportProposal,
  fieldUpdate: UpdateProposalFieldStatusInput,
): BusinessImportProposal {
  const fields = proposal.fields.map((f) => {
    if (f.id !== fieldUpdate.fieldId) {
      return f;
    }

    const newStatus: ImportFieldStatus = fieldUpdate.status;
    let editedValue = f.editedValue;

    if (newStatus === "edited") {
      editedValue =
        fieldUpdate.editedValue !== undefined ? fieldUpdate.editedValue : f.extractedValue;
    }

    return {
      ...f,
      status: newStatus,
      editedValue,
      confirmedAt:
        newStatus === "confirmed" || newStatus === "edited" ? new Date().toISOString() : undefined,
    };
  });

  const stats = computeProposalStats(fields);
  const readiness = evaluateProposalReadiness(fields);

  return {
    ...proposal,
    fields,
    stats,
    isReadyForProvisioning: readiness.isReady,
    blockingReasons: readiness.blockingReasons,
  };
}

/**
 * Bulk confirms all fields that have 'high' confidence and no validation errors.
 * Still requires explicit human initiation.
 */
export function confirmAllHighConfidenceFields(
  proposal: BusinessImportProposal,
): BusinessImportProposal {
  const now = new Date().toISOString();
  const fields = proposal.fields.map((f) => {
    if (f.confidence === "high" && !f.validationError && f.status === "unconfirmed") {
      return {
        ...f,
        status: "confirmed" as const,
        confirmedAt: now,
      };
    }
    return f;
  });

  const stats = computeProposalStats(fields);
  const readiness = evaluateProposalReadiness(fields);

  return {
    ...proposal,
    fields,
    stats,
    isReadyForProvisioning: readiness.isReady,
    blockingReasons: readiness.blockingReasons,
  };
}
