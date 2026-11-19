"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Button, Card, CardContent } from "@/components/ui";
import {
  confirmBusinessImportAction,
  parseBusinessImportAction,
} from "@/lib/businesses/import/actions";
import {
  confirmAllHighConfidenceFields,
  updateProposalField,
} from "@/lib/businesses/import/proposal";
import type {
  BusinessImportProposal,
  ConfirmedImportResult,
  ImportFieldStatus,
  ImportReviewContainerProps,
  ImportSourceFormat,
  ReviewFilter,
} from "./types";
import { ImportUploadStep } from "./import-upload-step";
import { ImportStatsBanner } from "./import-stats-banner";
import { ImportFieldRow } from "./import-field-row";

export function ImportReviewContainer({
  workspaceId,
  userId: _userId,
  onSuccessRedirect = "/workspace/clients",
}: ImportReviewContainerProps): React.JSX.Element {
  const [phase, setPhase] = useState<"upload" | "review" | "completed">("upload");
  const [proposal, setProposal] = useState<BusinessImportProposal | null>(null);
  const [currentFilter, setCurrentFilter] = useState<ReviewFilter>("all");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [provisionedResult, setProvisionedResult] = useState<ConfirmedImportResult | null>(null);

  // 1. Parse Step
  const handleParse = async (content: string, format: ImportSourceFormat, fileName?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await parseBusinessImportAction({
        workspaceId,
        format,
        content,
        sourceFileName: fileName,
      });

      if (!res.success) {
        setError(res.error);
        return;
      }

      setProposal(res.data);
      setPhase("review");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to parse import content");
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Field Review Updates
  const handleFieldStatusChange = (
    fieldId: string,
    status: ImportFieldStatus,
    editedValue?: unknown,
  ) => {
    if (!proposal) return;
    const updated = updateProposalField(proposal, { fieldId, status, editedValue });
    setProposal(updated);
  };

  // 3. Bulk Confirm High Confidence
  const handleConfirmAllHighConfidence = () => {
    if (!proposal) return;
    const updated = confirmAllHighConfidenceFields(proposal);
    setProposal(updated);
  };

  // 4. Final Submission & Atomic Creation
  const handleProvisionBusiness = async () => {
    if (!proposal) return;
    if (!proposal.isReadyForProvisioning) {
      setError("Please confirm all required fields and material facts before provisioning.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await confirmBusinessImportAction({
        workspaceId,
        proposalId: proposal.id,
        sourceFormat: proposal.sourceFormat,
        sourceFileName: proposal.sourceFileName,
        fields: proposal.fields,
      });

      if (!res.success) {
        setError(res.error);
        return;
      }

      setProvisionedResult(res.data);
      setPhase("completed");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to provision imported store");
    } finally {
      setIsLoading(false);
    }
  };

  // Filtered fields list
  const filteredFields = (proposal?.fields || []).filter((f) => {
    if (currentFilter === "unconfirmed") return f.status === "unconfirmed";
    if (currentFilter === "confirmed") return f.status === "confirmed" || f.status === "edited";
    if (currentFilter === "rejected") return f.status === "rejected";
    if (currentFilter === "material") return f.isMaterial;
    if (currentFilter === "catalogue") return f.category === "catalogue";
    return true;
  });

  // Render Phase 1: Upload Step
  if (phase === "upload") {
    return <ImportUploadStep onParse={handleParse} isLoading={isLoading} error={error} />;
  }

  // Render Phase 3: Completed Success View
  if (phase === "completed" && provisionedResult) {
    return (
      <Card variant="default">
        <CardContent style={{ padding: "var(--space-8)", textAlign: "center" }}>
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              background: "#dcfce7",
              color: "#16a34a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "28px",
              margin: "0 auto var(--space-4) auto",
            }}
          >
            ✓
          </div>
          <h2
            style={{
              fontSize: "var(--font-size-h2)",
              color: "var(--color-text-primary)",
              marginBottom: "var(--space-2)",
            }}
          >
            Client Business Successfully Provisioned!
          </h2>
          <p
            style={{
              color: "var(--color-text-secondary)",
              maxWidth: "500px",
              margin: "0 auto var(--space-6) auto",
            }}
          >
            <strong>{provisionedResult.business.trade_name}</strong> has been initialized with
            verified trade details, primary location, and{" "}
            <strong>{provisionedResult.catalogueItemsCreated} confirmed catalogue items</strong>.
          </p>

          <div
            style={{
              display: "inline-block",
              textAlign: "left",
              background: "var(--color-surface-subtle, #f9fafb)",
              padding: "var(--space-4)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-border-subtle, #e5e7eb)",
              marginBottom: "var(--space-6)",
              fontSize: "var(--font-size-sm)",
            }}
          >
            <div>
              <strong>Store Slug:</strong> {provisionedResult.business.slug}
            </div>
            <div>
              <strong>Location:</strong> {provisionedResult.primaryLocation.name} (
              {provisionedResult.primaryLocation.city})
            </div>
            <div>
              <strong>Status:</strong> Onboarding Draft
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "center", gap: "var(--space-3)" }}>
            <Link href={onSuccessRedirect} style={{ textDecoration: "none" }}>
              <Button variant="primary">View in Client Directory →</Button>
            </Link>
            <Button
              variant="secondary"
              onClick={() => {
                setPhase("upload");
                setProposal(null);
                setProvisionedResult(null);
              }}
            >
              Import Another Business
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Render Phase 2: Review & Confirmation Table
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      {/* Top Banner & Stats */}
      {proposal && (
        <ImportStatsBanner
          stats={proposal.stats}
          currentFilter={currentFilter}
          onFilterChange={setCurrentFilter}
          onConfirmAllHighConfidence={handleConfirmAllHighConfidence}
        />
      )}

      {/* Blocking Warnings (if any required or material facts are unconfirmed) */}
      {proposal && !proposal.isReadyForProvisioning && (
        <div
          role="status"
          style={{
            padding: "var(--space-4)",
            borderRadius: "var(--radius-md)",
            background: "#fffbeb",
            border: "1px solid #fde68a",
            color: "#92400e",
            fontSize: "var(--font-size-sm)",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: "var(--space-1)" }}>
            Action Required Before Provisioning:
          </div>
          <ul style={{ margin: 0, paddingLeft: "var(--space-4)" }}>
            {proposal.blockingReasons.map((reason, idx) => (
              <li key={idx}>{reason}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div
          role="alert"
          style={{
            padding: "var(--space-3) var(--space-4)",
            borderRadius: "var(--radius-md)",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#991b1b",
            fontSize: "var(--font-size-sm)",
          }}
        >
          {error}
        </div>
      )}

      {/* Field Review List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        {filteredFields.length === 0 ? (
          <Card variant="default">
            <CardContent style={{ padding: "var(--space-6)", textAlign: "center" }}>
              <p style={{ color: "var(--color-text-secondary)", margin: 0 }}>
                No facts found for filter &ldquo;{currentFilter}&rdquo;.
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredFields.map((field) => (
            <ImportFieldRow key={field.id} field={field} onStatusChange={handleFieldStatusChange} />
          ))
        )}
      </div>

      {/* Sticky Bottom Confirmation Bar */}
      <div
        style={{
          position: "sticky",
          bottom: "var(--space-4)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "var(--space-3)",
          padding: "var(--space-4)",
          background: "var(--color-surface, #ffffff)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--color-border-subtle, #e5e7eb)",
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
        }}
      >
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            if (window.confirm("Are you sure you want to discard this import proposal?")) {
              setPhase("upload");
              setProposal(null);
            }
          }}
          disabled={isLoading}
          style={{ minHeight: "44px" }}
        >
          Cancel & Start Over
        </Button>

        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <div
            style={{
              fontSize: "var(--font-size-xs)",
              color: "var(--color-text-secondary)",
              textAlign: "right",
            }}
          >
            {proposal?.stats.confirmedCount ?? 0} of {proposal?.stats.totalFields ?? 0} facts
            confirmed
          </div>
          <Button
            type="button"
            variant="primary"
            onClick={handleProvisionBusiness}
            disabled={isLoading || !proposal?.isReadyForProvisioning}
            style={{ minHeight: "44px", minWidth: "220px" }}
          >
            {isLoading ? "Provisioning Store..." : "Confirm & Provision Store ✓"}
          </Button>
        </div>
      </div>
    </div>
  );
}
