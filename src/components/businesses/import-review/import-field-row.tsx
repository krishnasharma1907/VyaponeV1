"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui";
import { formatPaiseToRupees } from "@/lib/businesses/import/parser";
import type { ExtractedCatalogueItem, ImportFieldStatus, ImportReviewField } from "./types";

interface ImportFieldRowProps {
  field: ImportReviewField;
  onStatusChange: (fieldId: string, status: ImportFieldStatus, editedValue?: unknown) => void;
}

export function ImportFieldRow({ field, onStatusChange }: ImportFieldRowProps): React.JSX.Element {
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editValue, setEditValue] = useState<string>(() => {
    if (field.category === "catalogue" && field.extractedValue) {
      const item = field.extractedValue as ExtractedCatalogueItem;
      return `${item.title} | ${item.priceMinor / 100}`;
    }
    if (typeof field.extractedValue === "object" && field.extractedValue !== null) {
      return JSON.stringify(field.editedValue || field.extractedValue);
    }
    return String(field.editedValue ?? field.extractedValue ?? "");
  });

  const handleConfirm = () => {
    setIsEditing(false);
    onStatusChange(field.id, "confirmed");
  };

  const handleReject = () => {
    setIsEditing(false);
    onStatusChange(field.id, "rejected");
  };

  const handleSaveEdit = () => {
    setIsEditing(false);
    let finalValue: unknown = editValue;

    if (field.category === "catalogue" && field.extractedValue) {
      const item = { ...(field.extractedValue as ExtractedCatalogueItem) };
      if (editValue.includes("|")) {
        const [t, p] = editValue.split("|");
        item.title = t.trim();
        const parsedP = parseFloat(p.trim());
        item.priceMinor = isNaN(parsedP) ? 0 : Math.round(parsedP * 100);
      } else {
        item.title = editValue.trim();
      }
      finalValue = item;
    }

    onStatusChange(field.id, "edited", finalValue);
  };

  const isConfirmed = field.status === "confirmed" || field.status === "edited";
  const isRejected = field.status === "rejected";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
        padding: "var(--space-3) var(--space-4)",
        borderRadius: "var(--radius-md)",
        background: isRejected
          ? "var(--color-surface-hover, #f3f4f6)"
          : isConfirmed
            ? "var(--color-surface, #ffffff)"
            : "#fffdfa",
        border: isRejected
          ? "1px solid var(--color-border-subtle, #e5e7eb)"
          : isConfirmed
            ? "1px solid var(--color-brand-primary-light, #bbf7d0)"
            : "1px solid #fde68a",
        opacity: isRejected ? 0.65 : 1,
        transition: "all 0.2s ease",
      }}
    >
      {/* Header Row: Category, Label, Material Badge, Status */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "var(--space-2)",
        }}
      >
        <div
          style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}
        >
          <span
            style={{
              fontSize: "var(--font-size-xs)",
              fontWeight: 600,
              textTransform: "uppercase",
              padding: "2px 6px",
              borderRadius: "4px",
              background: "var(--color-surface-hover, #f3f4f6)",
              color: "var(--color-text-secondary)",
            }}
          >
            {field.category}
          </span>
          <span
            style={{
              fontWeight: 600,
              fontSize: "var(--font-size-sm)",
              color: "var(--color-text-primary)",
            }}
          >
            {field.label}
          </span>
          {field.isRequired && (
            <span style={{ fontSize: "var(--font-size-xs)", color: "#b91c1c", fontWeight: 700 }}>
              *Required
            </span>
          )}
          {field.isMaterial && (
            <span
              style={{
                fontSize: "10px",
                fontWeight: 700,
                color: "#b45309",
                background: "#fef3c7",
                padding: "1px 5px",
                borderRadius: "3px",
              }}
            >
              Material Fact
            </span>
          )}
        </div>

        {/* Confidence & Status Badges */}
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <span
            style={{
              fontSize: "var(--font-size-xs)",
              color:
                field.confidence === "high"
                  ? "#15803d"
                  : field.confidence === "medium"
                    ? "#b45309"
                    : "#6b7280",
            }}
          >
            {field.confidence === "high"
              ? "High confidence"
              : field.confidence === "medium"
                ? "Medium confidence"
                : "Low confidence"}
          </span>

          {field.status === "unconfirmed" && (
            <span
              style={{
                fontSize: "var(--font-size-xs)",
                fontWeight: 600,
                color: "#b45309",
                background: "#fef3c7",
                padding: "2px 8px",
                borderRadius: "var(--radius-full)",
                border: "1px solid #fde68a",
              }}
            >
              To Confirm
            </span>
          )}
          {field.status === "confirmed" && (
            <span
              style={{
                fontSize: "var(--font-size-xs)",
                fontWeight: 600,
                color: "#15803d",
                background: "#dcfce7",
                padding: "2px 8px",
                borderRadius: "var(--radius-full)",
                border: "1px solid #bbf7d0",
              }}
            >
              ✓ Confirmed
            </span>
          )}
          {field.status === "edited" && (
            <span
              style={{
                fontSize: "var(--font-size-xs)",
                fontWeight: 600,
                color: "#1d4ed8",
                background: "#dbeafe",
                padding: "2px 8px",
                borderRadius: "var(--radius-full)",
                border: "1px solid #bfdbfe",
              }}
            >
              ✎ Edited & Confirmed
            </span>
          )}
          {field.status === "rejected" && (
            <span
              style={{
                fontSize: "var(--font-size-xs)",
                fontWeight: 600,
                color: "#4b5563",
                background: "#f3f4f6",
                padding: "2px 8px",
                borderRadius: "var(--radius-full)",
                border: "1px solid #e5e7eb",
              }}
            >
              ✕ Rejected
            </span>
          )}
        </div>
      </div>

      {/* Value Display / Edit Form */}
      {isEditing ? (
        <div
          style={{
            display: "flex",
            gap: "var(--space-2)",
            alignItems: "center",
            marginTop: "var(--space-1)",
          }}
        >
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            style={{
              flex: 1,
              padding: "var(--space-2)",
              fontSize: "var(--font-size-sm)",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--color-border-subtle, #d1d5db)",
            }}
          />
          <Button size="sm" variant="primary" onClick={handleSaveEdit}>
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <div
          style={{
            fontSize: "var(--font-size-body)",
            color: "var(--color-text-primary)",
            fontWeight: 500,
            textDecoration: isRejected ? "line-through" : "none",
          }}
        >
          {field.category === "catalogue" && field.extractedValue ? (
            (() => {
              const item = (field.editedValue || field.extractedValue) as ExtractedCatalogueItem;
              return (
                <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
                  <span>{item.title}</span>
                  <strong style={{ color: "var(--color-brand-primary)" }}>
                    {formatPaiseToRupees(item.priceMinor)}
                  </strong>
                  {item.category && (
                    <span
                      style={{
                        fontSize: "var(--font-size-xs)",
                        color: "var(--color-text-secondary)",
                      }}
                    >
                      ({item.category})
                    </span>
                  )}
                </div>
              );
            })()
          ) : typeof field.extractedValue === "object" && field.extractedValue !== null ? (
            <span>{JSON.stringify(field.editedValue || field.extractedValue)}</span>
          ) : (
            <span>{String(field.editedValue ?? field.extractedValue)}</span>
          )}
        </div>
      )}

      {/* Source Evidence Citation */}
      <div
        style={{
          fontSize: "var(--font-size-xs)",
          color: "var(--color-text-secondary)",
          background: "var(--color-surface-subtle, #f9fafb)",
          padding: "var(--space-1) var(--space-2)",
          borderRadius: "var(--radius-sm)",
          borderLeft: "3px solid var(--color-border-subtle, #d1d5db)",
          fontStyle: "italic",
        }}
      >
        Evidence: {field.sourceEvidence}
      </div>

      {/* Validation Error Message */}
      {field.validationError && !isRejected && (
        <div style={{ fontSize: "var(--font-size-xs)", color: "#b91c1c", fontWeight: 600 }}>
          ⚠ {field.validationError}
        </div>
      )}

      {/* Action Buttons */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: "var(--space-2)",
          marginTop: "var(--space-1)",
        }}
      >
        {!isEditing && (
          <>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setIsEditing(true)}
              style={{ minHeight: "36px", color: "var(--color-text-secondary)" }}
            >
              Edit
            </Button>
            {field.status !== "rejected" && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleReject}
                style={{ minHeight: "36px", color: "#b91c1c" }}
              >
                Reject
              </Button>
            )}
            {field.status !== "confirmed" && (
              <Button
                type="button"
                size="sm"
                variant="primary"
                onClick={handleConfirm}
                style={{ minHeight: "36px" }}
              >
                ✓ Confirm
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
