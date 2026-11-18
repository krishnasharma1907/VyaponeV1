"use client";

import React, { useMemo, useState } from "react";
import { Badge, Button, Field, Input } from "@/components/ui";
import { DEFAULT_NICHE_MANIFESTS } from "@/lib/niches/constants";
import { isQuestionVisible, validateQuestionAnswer } from "@/lib/niches/service";
import type { NicheManifest, OnboardingQuestion } from "@/lib/niches/types";
import type { WizardFormData } from "./types";

interface StepQuestionsProps {
  formData: WizardFormData;
  manifest?: NicheManifest | null;
  onChangeAnswers: (answers: Record<string, unknown>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepQuestions({
  formData,
  manifest: passedManifest,
  onChangeAnswers,
  onNext,
  onBack,
}: StepQuestionsProps): React.JSX.Element {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const manifest = useMemo(() => {
    if (passedManifest) return passedManifest;
    return (
      DEFAULT_NICHE_MANIFESTS[formData.niche_slug] ?? DEFAULT_NICHE_MANIFESTS["other_business"]
    );
  }, [passedManifest, formData.niche_slug]);

  const questions = useMemo(() => {
    return manifest?.onboarding?.requiredQuestions ?? [];
  }, [manifest]);

  const questionMap = useMemo(() => {
    const map = new Map<string, OnboardingQuestion>();
    for (const q of questions) {
      map.set(q.key, q);
    }
    return map;
  }, [questions]);

  // Determine visibility for every question based on current answers
  const visibleQuestions = useMemo(() => {
    return questions.filter((q) => {
      return isQuestionVisible(q, formData.onboarding_answers, questionMap);
    });
  }, [questions, formData.onboarding_answers, questionMap]);

  const handleFieldChange = (key: string, value: unknown) => {
    const nextAnswers = {
      ...formData.onboarding_answers,
      [key]: value,
    };
    onChangeAnswers(nextAnswers);

    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    for (const q of visibleQuestions) {
      const val = formData.onboarding_answers[q.key];
      const result = validateQuestionAnswer(q, val);
      if (!result.valid) {
        errs[q.key] = result.error ?? `${q.label} is invalid`;
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onNext();
    }
  };

  return (
    <form
      onSubmit={handleContinue}
      noValidate
      style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}
    >
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <h2
            style={{
              fontSize: "var(--font-size-h2)",
              color: "var(--color-text-primary)",
              margin: "0 0 var(--space-1) 0",
            }}
          >
            {manifest?.name ?? "Business"} Setup Questions
          </h2>
          <Badge variant="info">Category Schema</Badge>
        </div>
        <p
          style={{
            fontSize: "var(--font-size-body)",
            color: "var(--color-text-secondary)",
            margin: 0,
          }}
        >
          These details automatically configure the catalogue, services, and booking options for
          your website and dashboard.
        </p>
      </div>

      {visibleQuestions.length === 0 ? (
        <div
          style={{
            padding: "var(--space-6)",
            background: "var(--color-surface)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--color-border-subtle)",
            textAlign: "center",
          }}
        >
          <p style={{ margin: 0, color: "var(--color-text-secondary)" }}>
            No category-specific questions required for this niche. You may proceed directly to the
            proposal review.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-4)",
            background: "var(--color-surface)",
            padding: "var(--space-4)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--color-border-subtle)",
          }}
        >
          {visibleQuestions.map((q) => {
            const currentVal = formData.onboarding_answers[q.key];
            const error = errors[q.key];

            return (
              <div
                key={q.key}
                style={{
                  paddingBottom: "var(--space-3)",
                  borderBottom: "1px solid var(--color-border-subtle)",
                }}
              >
                {/* Text Question */}
                {q.type === "text" && (
                  <Field
                    id={q.key}
                    label={q.label}
                    required={q.required}
                    helperText={q.description}
                    errorMessage={error}
                  >
                    <Input
                      id={q.key}
                      name={q.key}
                      value={(currentVal as string) ?? ""}
                      onChange={(e) => handleFieldChange(q.key, e.target.value)}
                      placeholder={q.description ?? `Enter ${q.label}`}
                      aria-required={q.required}
                      aria-invalid={Boolean(error)}
                      style={{ minHeight: "44px" }}
                    />
                  </Field>
                )}

                {/* Number Question */}
                {q.type === "number" && (
                  <Field
                    id={q.key}
                    label={q.label}
                    required={q.required}
                    helperText={q.description}
                    errorMessage={error}
                  >
                    <Input
                      id={q.key}
                      name={q.key}
                      type="number"
                      value={
                        currentVal !== undefined && currentVal !== null ? String(currentVal) : ""
                      }
                      onChange={(e) => {
                        const num = e.target.value === "" ? "" : Number(e.target.value);
                        handleFieldChange(q.key, num);
                      }}
                      placeholder={q.description ?? "0"}
                      aria-required={q.required}
                      aria-invalid={Boolean(error)}
                      style={{ minHeight: "44px" }}
                    />
                  </Field>
                )}

                {/* Boolean Question */}
                {q.type === "boolean" && (
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "var(--font-size-sm)",
                        fontWeight: 600,
                        color: "var(--color-text-primary)",
                        marginBottom: "var(--space-1)",
                      }}
                    >
                      {q.label} {q.required && <span aria-hidden="true">*</span>}
                    </label>
                    {q.description && (
                      <p
                        style={{
                          fontSize: "var(--font-size-xs, 0.75rem)",
                          color: "var(--color-text-secondary)",
                          margin: "0 0 var(--space-2) 0",
                        }}
                      >
                        {q.description}
                      </p>
                    )}
                    <div style={{ display: "flex", gap: "var(--space-3)" }}>
                      <button
                        type="button"
                        onClick={() => handleFieldChange(q.key, true)}
                        style={{
                          flex: 1,
                          minHeight: "44px",
                          padding: "var(--space-2) var(--space-4)",
                          borderRadius: "var(--radius-md)",
                          border:
                            currentVal === true
                              ? "2px solid var(--color-brand-primary)"
                              : "1px solid var(--color-border-subtle)",
                          background:
                            currentVal === true
                              ? "var(--color-brand-primary-light, #e6f4ea)"
                              : "var(--color-surface)",
                          color:
                            currentVal === true
                              ? "var(--color-brand-primary)"
                              : "var(--color-text-primary)",
                          fontWeight: currentVal === true ? 600 : 400,
                          cursor: "pointer",
                        }}
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFieldChange(q.key, false)}
                        style={{
                          flex: 1,
                          minHeight: "44px",
                          padding: "var(--space-2) var(--space-4)",
                          borderRadius: "var(--radius-md)",
                          border:
                            currentVal === false
                              ? "2px solid var(--color-brand-primary)"
                              : "1px solid var(--color-border-subtle)",
                          background:
                            currentVal === false
                              ? "var(--color-brand-primary-light, #e6f4ea)"
                              : "var(--color-surface)",
                          color:
                            currentVal === false
                              ? "var(--color-brand-primary)"
                              : "var(--color-text-primary)",
                          fontWeight: currentVal === false ? 600 : 400,
                          cursor: "pointer",
                        }}
                      >
                        No
                      </button>
                    </div>
                    {error && (
                      <div
                        style={{
                          color: "var(--color-error, #dc2626)",
                          fontSize: "var(--font-size-xs, 0.75rem)",
                          marginTop: "var(--space-1)",
                        }}
                      >
                        {error}
                      </div>
                    )}
                  </div>
                )}

                {/* Select Question */}
                {q.type === "select" && (
                  <Field
                    id={q.key}
                    label={q.label}
                    required={q.required}
                    helperText={q.description}
                    errorMessage={error}
                  >
                    <select
                      id={q.key}
                      name={q.key}
                      value={(currentVal as string) ?? ""}
                      onChange={(e) => handleFieldChange(q.key, e.target.value)}
                      aria-required={q.required}
                      aria-invalid={Boolean(error)}
                      style={{
                        width: "100%",
                        height: "44px",
                        padding: "0 var(--space-3)",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--color-border-subtle)",
                        background: "var(--color-surface)",
                        color: "var(--color-text-primary)",
                        fontSize: "var(--font-size-body)",
                      }}
                    >
                      <option value="">Select an option...</option>
                      {q.options?.map((opt) => {
                        const val = typeof opt === "string" ? opt : opt.value;
                        const label = typeof opt === "string" ? opt : opt.label;
                        return (
                          <option key={val} value={val}>
                            {label}
                          </option>
                        );
                      })}
                    </select>
                  </Field>
                )}

                {/* Multi-Select Question */}
                {q.type === "multiselect" && (
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "var(--font-size-sm)",
                        fontWeight: 600,
                        color: "var(--color-text-primary)",
                        marginBottom: "var(--space-1)",
                      }}
                    >
                      {q.label} {q.required && <span aria-hidden="true">*</span>}
                    </label>
                    {q.description && (
                      <p
                        style={{
                          fontSize: "var(--font-size-xs, 0.75rem)",
                          color: "var(--color-text-secondary)",
                          margin: "0 0 var(--space-2) 0",
                        }}
                      >
                        {q.description}
                      </p>
                    )}
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "var(--space-2)",
                        marginTop: "var(--space-1)",
                      }}
                    >
                      {q.options?.map((opt) => {
                        const val = typeof opt === "string" ? opt : opt.value;
                        const label = typeof opt === "string" ? opt : opt.label;
                        const selectedList = Array.isArray(currentVal)
                          ? (currentVal as string[])
                          : [];
                        const isChecked = selectedList.includes(val);

                        return (
                          <button
                            key={val}
                            type="button"
                            onClick={() => {
                              const nextList = isChecked
                                ? selectedList.filter((item) => item !== val)
                                : [...selectedList, val];
                              handleFieldChange(q.key, nextList);
                            }}
                            style={{
                              padding: "var(--space-2) var(--space-3)",
                              borderRadius: "var(--radius-full)",
                              border: isChecked
                                ? "2px solid var(--color-brand-primary)"
                                : "1px solid var(--color-border-subtle)",
                              background: isChecked
                                ? "var(--color-brand-primary-light, #e6f4ea)"
                                : "var(--color-surface)",
                              color: isChecked
                                ? "var(--color-brand-primary)"
                                : "var(--color-text-primary)",
                              fontWeight: isChecked ? 600 : 400,
                              fontSize: "var(--font-size-sm)",
                              cursor: "pointer",
                              minHeight: "44px",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "var(--space-1)",
                            }}
                          >
                            <span aria-hidden="true">{isChecked ? "✓" : "+"}</span> {label}
                          </button>
                        );
                      })}
                    </div>
                    {error && (
                      <div
                        style={{
                          color: "var(--color-error, #dc2626)",
                          fontSize: "var(--font-size-xs, 0.75rem)",
                          marginTop: "var(--space-1)",
                        }}
                      >
                        {error}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Navigation Buttons */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "var(--space-3)",
          paddingTop: "var(--space-4)",
          borderTop: "1px solid var(--color-border-subtle)",
        }}
      >
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          style={{ minHeight: "44px", minWidth: "120px" }}
        >
          &larr; Back to Media
        </Button>
        <Button type="submit" variant="primary" style={{ minHeight: "44px", minWidth: "180px" }}>
          Review & Proposal &rarr;
        </Button>
      </div>
    </form>
  );
}
