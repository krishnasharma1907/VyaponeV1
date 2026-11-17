"use client";

/**
 * VyapOne — Reusable Schema-Driven Form Component [VO-031]
 *
 * Dynamically renders category-specific onboarding questions from versioned manifests.
 * Evaluates declarative conditional logic on the client, hides irrelevant questions,
 * validates inputs according to schema constraints, and handles draft saving.
 *
 * Meets WCAG 2.2 AA accessibility standards.
 */

import React, { useCallback, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { evaluateOnboardingAnswers, validateQuestionAnswer } from "@/lib/niches/service";
import type {
  NicheManifest,
  OnboardingEvaluationResult,
  OnboardingQuestion,
  StructuredAddressValue,
} from "@/lib/niches/types";

export interface SchemaDrivenFormProps {
  manifest: NicheManifest;
  initialAnswers?: Record<string, unknown>;
  onSave?: (
    answers: Record<string, unknown>,
    evalResult: OnboardingEvaluationResult,
  ) => Promise<void> | void;
  readOnly?: boolean;
  className?: string;
  submitButtonText?: string;
}

export function SchemaDrivenForm({
  manifest,
  initialAnswers = {},
  onSave,
  readOnly = false,
  className = "",
  submitButtonText = "Save Onboarding Progress",
}: SchemaDrivenFormProps) {
  const [answers, setAnswers] = useState<Record<string, unknown>>(() => ({
    ...initialAnswers,
  }));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());

  const questions = manifest.onboarding.requiredQuestions;

  // Live evaluation of visibility, validation errors, and completion status
  const evaluation: OnboardingEvaluationResult = useMemo(() => {
    try {
      return evaluateOnboardingAnswers(manifest, answers);
    } catch {
      return {
        isValid: false,
        isComplete: false,
        nicheSlug: manifest.nicheSlug,
        manifestVersion: manifest.version,
        totalQuestions: questions.length,
        visibleQuestions: questions.map((q) => q.key),
        hiddenQuestions: [],
        missingRequiredFields: [],
        validationErrors: [],
        sanitizedAnswers: answers,
      };
    }
  }, [manifest, answers, questions]);

  const handleChange = useCallback(
    (key: string, value: unknown) => {
      if (readOnly) return;
      setAnswers((prev) => ({
        ...prev,
        [key]: value,
      }));
      setTouchedFields((prev) => {
        const next = new Set(prev);
        next.add(key);
        return next;
      });
      setSaveSuccessMessage(null);
    },
    [readOnly],
  );

  const handleBlur = useCallback((key: string) => {
    setTouchedFields((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) return;

    // Mark all visible fields as touched so validation errors show
    setTouchedFields(new Set(evaluation.visibleQuestions));

    if (!onSave) return;

    setIsSubmitting(true);
    setSaveSuccessMessage(null);
    try {
      await onSave(evaluation.sanitizedAnswers, evaluation);
      setSaveSuccessMessage("Onboarding answers saved successfully.");
    } catch {
      // Error handled by parent or toast
    } finally {
      setIsSubmitting(false);
    }
  };

  // Group visible questions by their `group` attribute (or "General")
  const groupedQuestions = useMemo(() => {
    const visibleSet = new Set(evaluation.visibleQuestions);
    const groups: Record<string, OnboardingQuestion[]> = {};

    for (const q of questions) {
      if (!visibleSet.has(q.key)) continue;
      const groupName = q.group
        ? q.group.charAt(0).toUpperCase() + q.group.slice(1)
        : "General Details";
      if (!groups[groupName]) {
        groups[groupName] = [];
      }
      groups[groupName].push(q);
    }

    return groups;
  }, [questions, evaluation.visibleQuestions]);

  const getFieldError = (q: OnboardingQuestion): string | undefined => {
    if (!touchedFields.has(q.key)) return undefined;

    const val = answers[q.key];
    const validationRes = validateQuestionAnswer(q, val);
    if (!validationRes.valid) {
      return validationRes.error;
    }
    return undefined;
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`space-y-6 ${className}`.trim()}
      noValidate
      aria-label={`${manifest.name} Onboarding Form`}
    >
      {/* Header and Completion Status Badge */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-border">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">{manifest.name}</h2>
          <p className="text-sm text-muted-foreground">
            Complete the questions below to customize your business operations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {evaluation.isComplete ? (
            <Badge variant="success">All Required Questions Answered</Badge>
          ) : (
            <Badge variant="warning">
              {evaluation.missingRequiredFields.length} required field
              {evaluation.missingRequiredFields.length === 1 ? "" : "s"} remaining
            </Badge>
          )}
        </div>
      </div>

      {saveSuccessMessage && (
        <div
          role="status"
          className="p-3 text-sm rounded-md bg-green-500/10 text-green-600 border border-green-500/20"
        >
          {saveSuccessMessage}
        </div>
      )}

      {/* Render Questions Grouped by Section */}
      {Object.entries(groupedQuestions).map(([groupTitle, groupItems]) => (
        <Card key={groupTitle} className="p-5 space-y-4">
          <h3 className="text-base font-semibold text-foreground border-b border-border/50 pb-2">
            {groupTitle}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {groupItems.map((q) => {
              const error = getFieldError(q);
              const val = answers[q.key];

              return (
                <div
                  key={q.key}
                  className={
                    q.type === "structured_address" ||
                    (q.type === "text" && (q.validation?.maxLength ?? 0) > 100)
                      ? "col-span-1 md:col-span-2"
                      : "col-span-1"
                  }
                >
                  <QuestionFieldControl
                    question={q}
                    value={val}
                    error={error}
                    disabled={readOnly || isSubmitting}
                    onChange={(newVal) => handleChange(q.key, newVal)}
                    onBlur={() => handleBlur(q.key)}
                  />
                </div>
              );
            })}
          </div>
        </Card>
      ))}

      {/* Action Footer */}
      {!readOnly && (
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <Button type="submit" variant="primary" isLoading={isSubmitting} disabled={isSubmitting}>
            {submitButtonText}
          </Button>
        </div>
      )}
    </form>
  );
}

interface QuestionFieldControlProps {
  question: OnboardingQuestion;
  value: unknown;
  error?: string;
  disabled?: boolean;
  onChange: (value: unknown) => void;
  onBlur: () => void;
}

function QuestionFieldControl({
  question,
  value,
  error,
  disabled,
  onChange,
  onBlur,
}: QuestionFieldControlProps) {
  const options = question.options ?? [];

  switch (question.type) {
    case "text":
      return (
        <Field
          label={question.label}
          helperText={question.description}
          errorMessage={error}
          required={question.required}
        >
          <Input
            type="text"
            placeholder={question.placeholder}
            value={typeof value === "string" ? value : ""}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
          />
        </Field>
      );

    case "number":
      return (
        <Field
          label={question.label}
          helperText={question.description}
          errorMessage={error}
          required={question.required}
        >
          <Input
            type="number"
            placeholder={question.placeholder}
            min={question.validation?.min}
            max={question.validation?.max}
            value={value !== undefined && value !== null ? String(value) : ""}
            disabled={disabled}
            onChange={(e) => {
              const numStr = e.target.value;
              onChange(numStr === "" ? "" : Number(numStr));
            }}
            onBlur={onBlur}
          />
        </Field>
      );

    case "boolean":
      return (
        <div className="py-2">
          <Checkbox
            id={`checkbox-${question.key}`}
            label={question.label}
            checked={Boolean(value)}
            disabled={disabled}
            onChange={(e) => onChange(e.target.checked)}
            onBlur={onBlur}
          />
          {question.description && (
            <p className="text-xs text-muted-foreground mt-1 ml-6">{question.description}</p>
          )}
          {error && (
            <p className="text-xs text-red-500 mt-1 ml-6" role="alert">
              {error}
            </p>
          )}
        </div>
      );

    case "select":
      return (
        <Field
          label={question.label}
          helperText={question.description}
          errorMessage={error}
          required={question.required}
        >
          <Select
            value={typeof value === "string" ? value : ""}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
          >
            <option value="">-- Select an option --</option>
            {options.map((opt) => {
              const optVal = typeof opt === "string" ? opt : opt.value;
              const optLabel = typeof opt === "string" ? opt : opt.label;
              return (
                <option key={optVal} value={optVal}>
                  {optLabel}
                </option>
              );
            })}
          </Select>
        </Field>
      );

    case "multiselect": {
      const selected = Array.isArray(value) ? (value as string[]) : [];

      const toggleOption = (optVal: string) => {
        if (selected.includes(optVal)) {
          onChange(selected.filter((v) => v !== optVal));
        } else {
          onChange([...selected, optVal]);
        }
      };

      return (
        <Field
          label={question.label}
          helperText={question.description ?? "Select all that apply"}
          errorMessage={error}
          required={question.required}
        >
          <div className="space-y-2 pt-1">
            {options.map((opt) => {
              const optVal = typeof opt === "string" ? opt : opt.value;
              const optLabel = typeof opt === "string" ? opt : opt.label;
              return (
                <Checkbox
                  key={optVal}
                  id={`multiselect-${question.key}-${optVal}`}
                  label={optLabel}
                  checked={selected.includes(optVal)}
                  disabled={disabled}
                  onChange={() => toggleOption(optVal)}
                  onBlur={onBlur}
                />
              );
            })}
          </div>
        </Field>
      );
    }

    case "date":
      return (
        <Field
          label={question.label}
          helperText={question.description}
          errorMessage={error}
          required={question.required}
        >
          <Input
            type="date"
            value={typeof value === "string" ? value : ""}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
          />
        </Field>
      );

    case "time":
      return (
        <Field
          label={question.label}
          helperText={question.description}
          errorMessage={error}
          required={question.required}
        >
          <Input
            type="time"
            value={typeof value === "string" ? value : ""}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
          />
        </Field>
      );

    case "structured_address": {
      const addr = (
        typeof value === "object" && value !== null ? value : {}
      ) as Partial<StructuredAddressValue>;

      const updateAddr = (field: keyof StructuredAddressValue, val: string) => {
        onChange({
          ...addr,
          [field]: val,
        });
      };

      return (
        <div className="space-y-3 p-3 rounded-lg border border-border/70 bg-card/50">
          <label className="text-sm font-medium text-foreground block">
            {question.label} {question.required && <span className="text-red-500">*</span>}
          </label>
          {question.description && (
            <p className="text-xs text-muted-foreground">{question.description}</p>
          )}

          <div className="space-y-2">
            <Input
              type="text"
              placeholder="Address Line 1 (Street, Building, Flat No.)"
              value={addr.addressLine1 ?? ""}
              disabled={disabled}
              onChange={(e) => updateAddr("addressLine1", e.target.value)}
              onBlur={onBlur}
            />
            <Input
              type="text"
              placeholder="Address Line 2 (Area, Sector)"
              value={addr.addressLine2 ?? ""}
              disabled={disabled}
              onChange={(e) => updateAddr("addressLine2", e.target.value)}
              onBlur={onBlur}
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Input
                type="text"
                placeholder="City"
                value={addr.city ?? ""}
                disabled={disabled}
                onChange={(e) => updateAddr("city", e.target.value)}
                onBlur={onBlur}
              />
              <Input
                type="text"
                placeholder="State"
                value={addr.state ?? ""}
                disabled={disabled}
                onChange={(e) => updateAddr("state", e.target.value)}
                onBlur={onBlur}
              />
              <Input
                type="text"
                placeholder="6-digit PIN code"
                maxLength={6}
                value={addr.pincode ?? ""}
                disabled={disabled}
                onChange={(e) => updateAddr("pincode", e.target.value)}
                onBlur={onBlur}
              />
            </div>
          </div>
          {error && (
            <p className="text-xs text-red-500" role="alert">
              {error}
            </p>
          )}
        </div>
      );
    }

    case "file":
      return (
        <Field
          label={question.label}
          helperText={question.description ?? "Enter file URL or document link"}
          errorMessage={error}
          required={question.required}
        >
          <Input
            type="text"
            placeholder={question.placeholder ?? "https://..."}
            value={typeof value === "string" ? value : ""}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
          />
        </Field>
      );

    default:
      return null;
  }
}
