"use client";

import React, { useState } from "react";
import { Badge, Button } from "@/components/ui";
import type { BusinessSummary } from "@/lib/businesses/types";

interface BusinessSwitcherProps {
  businesses: BusinessSummary[];
  activeBusinessId?: string | null;
  onSelectBusiness: (business: BusinessSummary) => void;
  onCreateNew?: () => void;
}

export function BusinessSwitcher({
  businesses,
  activeBusinessId,
  onSelectBusiness,
  onCreateNew,
}: BusinessSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);

  const activeBusiness = businesses.find((b) => b.id === activeBusinessId) ?? businesses[0] ?? null;

  return (
    <div
      style={{ position: "relative", display: "inline-block", width: "100%", maxWidth: "320px" }}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label="Select active business"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          padding: "var(--space-2) var(--space-3)",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--color-border)",
          backgroundColor: "var(--color-surface)",
          cursor: "pointer",
          textAlign: "left",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "2px", overflow: "hidden" }}>
          <span
            style={{
              fontSize: "var(--font-size-body)",
              fontWeight: 600,
              color: "var(--color-text-primary)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {activeBusiness ? activeBusiness.trade_name : "Select Business"}
          </span>
          {activeBusiness && (
            <span
              style={{ fontSize: "var(--font-size-caption)", color: "var(--color-text-secondary)" }}
            >
              {activeBusiness.slug}.vyapone.internal
            </span>
          )}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-1)",
            marginLeft: "var(--space-2)",
          }}
        >
          {activeBusiness && (
            <Badge variant="primary" size="sm">
              {activeBusiness.currentUserRole.toUpperCase()}
            </Badge>
          )}
          <span
            aria-hidden="true"
            style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}
          >
            ▼
          </span>
        </div>
      </button>

      {isOpen && (
        <div
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-md)",
            zIndex: 50,
            maxHeight: "280px",
            overflowY: "auto",
          }}
        >
          {businesses.map((biz) => {
            const isSelected = biz.id === activeBusiness?.id;
            return (
              <div
                key={biz.id}
                role="option"
                aria-selected={isSelected}
                tabIndex={0}
                onClick={() => {
                  onSelectBusiness(biz);
                  setIsOpen(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectBusiness(biz);
                    setIsOpen(false);
                  }
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "var(--space-2) var(--space-3)",
                  cursor: "pointer",
                  backgroundColor: isSelected ? "rgba(11, 110, 79, 0.08)" : "transparent",
                  borderBottom: "1px solid var(--color-border-subtle, #f0ede6)",
                }}
              >
                <div>
                  <div
                    style={{
                      fontWeight: isSelected ? 600 : 500,
                      color: "var(--color-text-primary)",
                    }}
                  >
                    {biz.trade_name}
                  </div>
                  <div
                    style={{
                      fontSize: "var(--font-size-caption)",
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    {biz.slug}
                  </div>
                </div>
                <Badge variant={isSelected ? "primary" : "default"} size="sm">
                  {biz.currentUserRole.toUpperCase()}
                </Badge>
              </div>
            );
          })}

          {onCreateNew && (
            <div style={{ padding: "var(--space-2)", borderTop: "1px solid var(--color-border)" }}>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                style={{ width: "100%" }}
                onClick={() => {
                  setIsOpen(false);
                  onCreateNew();
                }}
              >
                + New Business
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
