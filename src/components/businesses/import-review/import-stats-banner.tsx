"use client";

import React from "react";
import { Button } from "@/components/ui";
import type { ImportProposalStats, ReviewFilter } from "./types";

interface ImportStatsBannerProps {
  stats: ImportProposalStats;
  currentFilter: ReviewFilter;
  onFilterChange: (filter: ReviewFilter) => void;
  onConfirmAllHighConfidence: () => void;
}

export function ImportStatsBanner({
  stats,
  currentFilter,
  onFilterChange,
  onConfirmAllHighConfidence,
}: ImportStatsBannerProps): React.JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-4)",
        padding: "var(--space-4)",
        background: "var(--color-surface, #ffffff)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--color-border-subtle, #e5e7eb)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      }}
    >
      {/* Header & Quick Action */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "var(--space-3)",
        }}
      >
        <div>
          <h3
            style={{
              fontSize: "var(--font-size-h3)",
              color: "var(--color-text-primary)",
              margin: 0,
            }}
          >
            Review Extracted Facts
          </h3>
          <p
            style={{
              fontSize: "var(--font-size-sm)",
              color: "var(--color-text-secondary)",
              margin: "var(--space-1) 0 0 0",
            }}
          >
            Verify source evidence for each fact. Every price, timing, and material fact requires
            explicit confirmation.
          </p>
        </div>

        {stats.unconfirmedCount > 0 && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onConfirmAllHighConfidence}
            style={{ minHeight: "36px" }}
          >
            ✓ Accept All High-Confidence
          </Button>
        )}
      </div>

      {/* Numerical Indicators */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
          gap: "var(--space-3)",
        }}
      >
        <div
          style={{
            padding: "var(--space-3)",
            borderRadius: "var(--radius-md)",
            background: "var(--color-surface-subtle, #f9fafb)",
            border: "1px solid var(--color-border-subtle, #e5e7eb)",
          }}
        >
          <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-secondary)" }}>
            Total Facts
          </div>
          <div
            style={{
              fontSize: "var(--font-size-h2)",
              fontWeight: 700,
              color: "var(--color-text-primary)",
            }}
          >
            {stats.totalFields}
          </div>
        </div>

        <div
          style={{
            padding: "var(--space-3)",
            borderRadius: "var(--radius-md)",
            background:
              stats.unconfirmedCount > 0 ? "#fffbeb" : "var(--color-surface-subtle, #f9fafb)",
            border: stats.unconfirmedCount > 0 ? "1px solid #fde68a" : "1px solid #e5e7eb",
          }}
        >
          <div
            style={{
              fontSize: "var(--font-size-xs)",
              color: stats.unconfirmedCount > 0 ? "#92400e" : "var(--color-text-secondary)",
              fontWeight: 600,
            }}
          >
            To Confirm
          </div>
          <div
            style={{
              fontSize: "var(--font-size-h2)",
              fontWeight: 700,
              color: stats.unconfirmedCount > 0 ? "#b45309" : "var(--color-text-primary)",
            }}
          >
            {stats.unconfirmedCount}
          </div>
        </div>

        <div
          style={{
            padding: "var(--space-3)",
            borderRadius: "var(--radius-md)",
            background:
              stats.confirmedCount > 0 ? "#f0fdf4" : "var(--color-surface-subtle, #f9fafb)",
            border: stats.confirmedCount > 0 ? "1px solid #bbf7d0" : "1px solid #e5e7eb",
          }}
        >
          <div
            style={{
              fontSize: "var(--font-size-xs)",
              color: stats.confirmedCount > 0 ? "#166534" : "var(--color-text-secondary)",
              fontWeight: 600,
            }}
          >
            Confirmed
          </div>
          <div
            style={{
              fontSize: "var(--font-size-h2)",
              fontWeight: 700,
              color: stats.confirmedCount > 0 ? "#15803d" : "var(--color-text-primary)",
            }}
          >
            {stats.confirmedCount + stats.editedCount}
          </div>
        </div>

        {stats.materialUnconfirmedCount > 0 && (
          <div
            style={{
              padding: "var(--space-3)",
              borderRadius: "var(--radius-md)",
              background: "#fef2f2",
              border: "1px solid #fecaca",
            }}
          >
            <div
              style={{
                fontSize: "var(--font-size-xs)",
                color: "#991b1b",
                fontWeight: 600,
              }}
            >
              Material Unconfirmed
            </div>
            <div
              style={{
                fontSize: "var(--font-size-h2)",
                fontWeight: 700,
                color: "#dc2626",
              }}
            >
              {stats.materialUnconfirmedCount}
            </div>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "var(--font-size-xs)",
            color: "var(--color-text-secondary)",
            marginBottom: "var(--space-1)",
          }}
        >
          <span>Confirmation Progress</span>
          <span>{stats.completionPercentage}% Complete</span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={stats.completionPercentage}
          aria-valuemin={0}
          aria-valuemax={100}
          style={{
            width: "100%",
            height: "8px",
            background: "var(--color-surface-hover, #e5e7eb)",
            borderRadius: "var(--radius-full)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${stats.completionPercentage}%`,
              height: "100%",
              background:
                stats.completionPercentage === 100
                  ? "var(--color-brand-primary, #059669)"
                  : "var(--color-brand-secondary, #2563eb)",
              transition: "width 0.3s ease",
            }}
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div
        style={{
          display: "flex",
          gap: "var(--space-2)",
          flexWrap: "wrap",
          borderTop: "1px solid var(--color-border-subtle, #f3f4f6)",
          paddingTop: "var(--space-3)",
        }}
      >
        {(
          [
            { id: "all", label: `All (${stats.totalFields})` },
            { id: "unconfirmed", label: `To Confirm (${stats.unconfirmedCount})` },
            { id: "confirmed", label: `Confirmed (${stats.confirmedCount + stats.editedCount})` },
            { id: "material", label: `Material (${stats.materialTotalCount})` },
            { id: "rejected", label: `Rejected (${stats.rejectedCount})` },
          ] as const
        ).map((flt) => {
          const isActive = currentFilter === flt.id;
          return (
            <button
              key={flt.id}
              type="button"
              onClick={() => onFilterChange(flt.id)}
              style={{
                padding: "var(--space-1) var(--space-3)",
                borderRadius: "var(--radius-full)",
                border: isActive
                  ? "1px solid var(--color-brand-primary)"
                  : "1px solid var(--color-border-subtle, #e5e7eb)",
                background: isActive
                  ? "var(--color-brand-surface, #eff6ff)"
                  : "var(--color-surface, #ffffff)",
                color: isActive ? "var(--color-brand-primary)" : "var(--color-text-secondary)",
                fontWeight: isActive ? 600 : 500,
                fontSize: "var(--font-size-xs)",
                cursor: "pointer",
                minHeight: "36px",
              }}
            >
              {flt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
