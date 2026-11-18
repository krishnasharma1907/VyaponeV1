"use client";

import React, { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent } from "@/components/ui";
import { createBusinessWithSetupAction } from "@/lib/businesses/actions";
import { DEFAULT_NICHE_MANIFESTS } from "@/lib/niches/constants";
import { clearWizardDraft, loadWizardDraft, saveWizardDraft } from "./draft-storage";
import { StepFacts } from "./step-facts";
import { StepMedia } from "./step-media";
import { StepNiche } from "./step-niche";
import { StepProposal } from "./step-proposal";
import { StepQuestions } from "./step-questions";
import type { CreateBusinessWizardProps, WizardFormData, WizardStep } from "./types";

const INITIAL_FORM_DATA: WizardFormData = {
  niche_slug: "",
  niche_group_slug: "",
  niche_name: "",
  trade_name: "",
  legal_name: "",
  slug: "",
  description: "",
  location_name: "Main Store",
  address_line1: "",
  address_line2: "",
  city: "",
  state: "",
  postal_code: "",
  primary_phone: "",
  whatsapp_number: "",
  email: "",
  gst_number: "",
  pan_number: "",
  tax_scheme: "unregistered",
  logo_media_id: null,
  logo_preview_url: null,
  showcase_media_ids: [],
  showcase_preview_urls: [],
  onboarding_answers: {},
  businessId: null,
};

const STEP_LABELS: Record<WizardStep, string> = {
  1: "Niche Selection",
  2: "Basic Facts",
  3: "Media Uploads",
  4: "Category Questions",
  5: "Proposal & Review",
};

export function CreateBusinessWizard({
  workspaceId,
  nicheGroups,
  niches,
  initialNicheSlug,
  onSuccess,
  onCancel,
}: CreateBusinessWizardProps): React.JSX.Element {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [formData, setFormData] = useState<WizardFormData>(() => {
    if (initialNicheSlug) {
      const match = niches.find((n) => n.slug === initialNicheSlug);
      return {
        ...INITIAL_FORM_DATA,
        niche_slug: initialNicheSlug,
        niche_group_slug: match?.nicheGroupSlug ?? "",
        niche_name: match?.name ?? initialNicheSlug,
      };
    }
    return INITIAL_FORM_DATA;
  });

  const [draftPrompt, setDraftPrompt] = useState<{
    savedAt: string;
    step: WizardStep;
    data: WizardFormData;
  } | null>(null);

  const [lastSavedNotice, setLastSavedNotice] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Check for unsaved draft on mount
  useEffect(() => {
    const existingDraft = loadWizardDraft(workspaceId);
    if (existingDraft && (existingDraft.data.trade_name || existingDraft.data.niche_slug)) {
      setDraftPrompt({
        savedAt: existingDraft.savedAt,
        step: existingDraft.step,
        data: existingDraft.data,
      });
    }
  }, [workspaceId]);

  const handleResumeDraft = () => {
    if (draftPrompt) {
      setFormData(draftPrompt.data);
      setCurrentStep(draftPrompt.step);
      setDraftPrompt(null);
    }
  };

  const handleDiscardDraft = () => {
    clearWizardDraft(workspaceId);
    setDraftPrompt(null);
  };

  const handleManualSaveDraft = () => {
    const ok = saveWizardDraft(workspaceId, formData, currentStep);
    if (ok) {
      setLastSavedNotice(new Date().toLocaleTimeString());
      setTimeout(() => setLastSavedNotice(null), 3000);
    }
  };

  const updateFormData = (updates: Partial<WizardFormData>) => {
    setFormData((prev) => {
      const next = { ...prev, ...updates };
      saveWizardDraft(workspaceId, next, currentStep);
      return next;
    });
  };

  const goToStep = (step: WizardStep) => {
    setCurrentStep(step);
    saveWizardDraft(workspaceId, formData, step);
    setServerError(null);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleConfirmSubmit = () => {
    setServerError(null);

    startTransition(async () => {
      const result = await createBusinessWithSetupAction({
        workspace_id: workspaceId,
        niche_slug: formData.niche_slug,
        niche_group_slug: formData.niche_group_slug || undefined,
        trade_name: formData.trade_name,
        legal_name: formData.legal_name || formData.trade_name,
        slug: formData.slug || undefined,
        description: formData.description || undefined,
        primary_location: {
          name: formData.location_name || "Main Store",
          address_line1: formData.address_line1,
          address_line2: formData.address_line2 || null,
          city: formData.city,
          state: formData.state,
          postal_code: formData.postal_code,
        },
        contact: {
          primary_phone: formData.primary_phone || null,
          whatsapp_number: formData.whatsapp_number || null,
          email: formData.email || null,
        },
        gst_number: formData.gst_number || null,
        pan_number: formData.pan_number || null,
        tax_scheme: formData.tax_scheme,
        logo_media_id: formData.logo_media_id,
        showcase_media_ids: formData.showcase_media_ids,
        onboarding_answers: formData.onboarding_answers,
        proposal_confirmed: true,
      });

      if (!result.success) {
        setServerError(result.error);
        return;
      }

      // Success: clear client-side draft
      clearWizardDraft(workspaceId);

      if (onSuccess) {
        onSuccess({
          businessId: result.data.business.id,
          slug: result.data.business.slug,
          tradeName: result.data.business.trade_name,
          isComplete: result.data.isComplete,
        });
      } else {
        router.push("/workspace/clients");
      }
    });
  };

  const currentManifest = DEFAULT_NICHE_MANIFESTS[formData.niche_slug] ?? null;

  return (
    <div
      style={{
        maxWidth: "840px",
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-4)",
      }}
    >
      {/* Draft Restore Notification Banner */}
      {draftPrompt && (
        <div
          role="alert"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "var(--space-3)",
            padding: "var(--space-3) var(--space-4)",
            borderRadius: "var(--radius-lg)",
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            color: "#1e40af",
            fontSize: "var(--font-size-sm)",
          }}
        >
          <div>
            <strong>Unsaved Setup Draft Available:</strong> Progress found for{" "}
            <em>{draftPrompt.data.trade_name || draftPrompt.data.niche_name || "New Business"}</em>{" "}
            (saved {new Date(draftPrompt.savedAt).toLocaleTimeString()}).
          </div>
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <Button size="sm" variant="primary" onClick={handleResumeDraft}>
              Resume Draft
            </Button>
            <Button size="sm" variant="outline" onClick={handleDiscardDraft}>
              Start Fresh
            </Button>
          </div>
        </div>
      )}

      {/* Stepper Header (Optimized for 390px Mobile Viewport) */}
      <Card variant="default">
        <CardContent style={{ padding: "var(--space-4)" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "var(--space-2)",
            }}
          >
            <div>
              <span
                style={{
                  fontSize: "var(--font-size-xs, 0.75rem)",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "var(--color-brand-primary)",
                }}
              >
                Step {currentStep} of 5
              </span>
              <h1
                style={{
                  fontSize: "var(--font-size-body-bold, 1.1rem)",
                  color: "var(--color-text-primary)",
                  margin: 0,
                }}
              >
                {STEP_LABELS[currentStep]}
              </h1>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              {lastSavedNotice && (
                <span
                  style={{
                    fontSize: "var(--font-size-xs, 0.75rem)",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  Saved at {lastSavedNotice}
                </span>
              )}
              {onCancel && (
                <Button size="sm" variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
              )}
            </div>
          </div>

          {/* Visual Progress Bar */}
          <div
            role="progressbar"
            aria-valuenow={currentStep * 20}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Step ${currentStep} of 5: ${STEP_LABELS[currentStep]}`}
            style={{
              width: "100%",
              height: "6px",
              background: "var(--color-border-subtle, #e5e7eb)",
              borderRadius: "var(--radius-full)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${currentStep * 20}%`,
                height: "100%",
                background: "var(--color-brand-primary, #0B6E4F)",
                transition: "width 0.3s ease",
              }}
            />
          </div>

          {/* Step Pill Links */}
          <nav
            aria-label="Wizard Steps"
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: "var(--space-3)",
              gap: "var(--space-1)",
              overflowX: "auto",
              paddingBottom: "var(--space-1)",
            }}
          >
            {([1, 2, 3, 4, 5] as WizardStep[]).map((stepNum) => {
              const isCurrent = currentStep === stepNum;
              const isPast = currentStep > stepNum;
              return (
                <button
                  key={stepNum}
                  type="button"
                  onClick={() => {
                    // Allow navigating back to completed steps
                    if (isPast) {
                      goToStep(stepNum);
                    }
                  }}
                  disabled={!isPast && !isCurrent}
                  style={{
                    border: "none",
                    background: "none",
                    padding: "var(--space-1) var(--space-2)",
                    fontSize: "var(--font-size-xs, 0.75rem)",
                    fontWeight: isCurrent ? 700 : 500,
                    color: isCurrent
                      ? "var(--color-brand-primary)"
                      : isPast
                        ? "var(--color-text-primary)"
                        : "var(--color-text-secondary)",
                    cursor: isPast ? "pointer" : "default",
                    whiteSpace: "nowrap",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <span
                    style={{
                      width: "18px",
                      height: "18px",
                      borderRadius: "50%",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: isCurrent
                        ? "var(--color-brand-primary)"
                        : isPast
                          ? "var(--color-brand-primary-light, #e6f4ea)"
                          : "var(--color-surface-subtle, #f3f4f6)",
                      color: isCurrent ? "#ffffff" : "var(--color-text-primary)",
                      fontSize: "10px",
                    }}
                  >
                    {isPast ? "✓" : stepNum}
                  </span>
                  <span>{STEP_LABELS[stepNum]}</span>
                </button>
              );
            })}
          </nav>
        </CardContent>
      </Card>

      {/* Server Error Alert */}
      {serverError && (
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
          <strong>Setup Error:</strong> {serverError}
        </div>
      )}

      {/* Step Content */}
      <Card variant="default">
        <CardContent style={{ padding: "var(--space-5)" }}>
          {currentStep === 1 && (
            <StepNiche
              formData={formData}
              nicheGroups={nicheGroups}
              niches={niches}
              onSelectNiche={(nicheSlug, nicheGroupSlug, nicheName) => {
                updateFormData({
                  niche_slug: nicheSlug,
                  niche_group_slug: nicheGroupSlug,
                  niche_name: nicheName,
                });
              }}
              onNext={() => goToStep(2)}
            />
          )}

          {currentStep === 2 && (
            <StepFacts
              formData={formData}
              onChange={updateFormData}
              onNext={() => goToStep(3)}
              onBack={() => goToStep(1)}
            />
          )}

          {currentStep === 3 && (
            <StepMedia
              formData={formData}
              onChange={updateFormData}
              onNext={() => goToStep(4)}
              onBack={() => goToStep(2)}
            />
          )}

          {currentStep === 4 && (
            <StepQuestions
              formData={formData}
              manifest={currentManifest}
              onChangeAnswers={(answers) => updateFormData({ onboarding_answers: answers })}
              onNext={() => goToStep(5)}
              onBack={() => goToStep(3)}
            />
          )}

          {currentStep === 5 && (
            <StepProposal
              formData={formData}
              manifest={currentManifest}
              isSubmitting={isPending}
              onConfirm={handleConfirmSubmit}
              onEditFacts={() => goToStep(2)}
              onSaveDraft={handleManualSaveDraft}
              lastSavedAt={lastSavedNotice}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
