"use client";

import React, { useMemo, useState } from "react";
import { Badge, Button, Input } from "@/components/ui";
import type { NicheGroupSummary, NicheSummary } from "@/lib/niches/types";
import type { WizardFormData } from "./types";

interface StepNicheProps {
  formData: WizardFormData;
  nicheGroups: NicheGroupSummary[];
  niches: NicheSummary[];
  onSelectNiche: (nicheSlug: string, nicheGroupSlug: string, nicheName: string) => void;
  onNext: () => void;
}

export function StepNiche({
  formData,
  nicheGroups,
  niches,
  onSelectNiche,
  onNext,
}: StepNicheProps): React.JSX.Element {
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const filteredNiches = useMemo(() => {
    return niches.filter((n) => {
      const matchesGroup =
        selectedGroup === "all" ||
        n.nicheGroupSlug === selectedGroup ||
        (selectedGroup === "other_business" && n.slug === "other_business");

      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !query ||
        n.name.toLowerCase().includes(query) ||
        n.slug.toLowerCase().includes(query) ||
        (n.description && n.description.toLowerCase().includes(query));

      return matchesGroup && matchesSearch;
    });
  }, [niches, selectedGroup, searchQuery]);

  const selectedNicheObj = useMemo(() => {
    return niches.find((n) => n.slug === formData.niche_slug);
  }, [niches, formData.niche_slug]);

  const getAvailabilityBadge = (label: string) => {
    switch (label) {
      case "live_operational":
        return <Badge variant="success">Ready to Launch</Badge>;
      case "informational_with_enquiry":
        return <Badge variant="info">Website & Enquiries</Badge>;
      default:
        return <Badge variant="default">Coming Soon</Badge>;
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      <div>
        <h2
          style={{
            fontSize: "var(--font-size-h2)",
            color: "var(--color-text-primary)",
            margin: "0 0 var(--space-1) 0",
          }}
        >
          Select Business Niche
        </h2>
        <p
          style={{
            fontSize: "var(--font-size-body)",
            color: "var(--color-text-secondary)",
            margin: 0,
          }}
        >
          Choose your merchant industry to load category-tailored modules, questions, and approved
          website blocks.
        </p>
      </div>

      {/* Search Input */}
      <div>
        <Input
          type="search"
          placeholder="Search niches (e.g. Café, Salon, Kirana, Gym)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search business niches"
          style={{ minHeight: "44px" }}
        />
      </div>

      {/* Niche Group Chips / Filter Bar */}
      <div
        role="tablist"
        aria-label="Filter by industry group"
        style={{
          display: "flex",
          gap: "var(--space-2)",
          overflowX: "auto",
          paddingBottom: "var(--space-2)",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={selectedGroup === "all"}
          onClick={() => setSelectedGroup("all")}
          style={{
            padding: "var(--space-2) var(--space-3)",
            borderRadius: "var(--radius-full)",
            border:
              selectedGroup === "all"
                ? "2px solid var(--color-brand-primary)"
                : "1px solid var(--color-border-subtle)",
            background:
              selectedGroup === "all"
                ? "var(--color-brand-primary-light, #e6f4ea)"
                : "var(--color-surface)",
            color:
              selectedGroup === "all"
                ? "var(--color-brand-primary)"
                : "var(--color-text-secondary)",
            fontWeight: selectedGroup === "all" ? 600 : 400,
            fontSize: "var(--font-size-sm)",
            cursor: "pointer",
            whiteSpace: "nowrap",
            minHeight: "44px",
            display: "inline-flex",
            alignItems: "center",
          }}
        >
          All Industries
        </button>
        {nicheGroups.map((g) => {
          const isSelected = selectedGroup === g.slug;
          return (
            <button
              key={g.slug}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => setSelectedGroup(g.slug)}
              style={{
                padding: "var(--space-2) var(--space-3)",
                borderRadius: "var(--radius-full)",
                border: isSelected
                  ? "2px solid var(--color-brand-primary)"
                  : "1px solid var(--color-border-subtle)",
                background: isSelected
                  ? "var(--color-brand-primary-light, #e6f4ea)"
                  : "var(--color-surface)",
                color: isSelected ? "var(--color-brand-primary)" : "var(--color-text-secondary)",
                fontWeight: isSelected ? 600 : 400,
                fontSize: "var(--font-size-sm)",
                cursor: "pointer",
                whiteSpace: "nowrap",
                minHeight: "44px",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              {g.name}
            </button>
          );
        })}
      </div>

      {/* Niches Grid */}
      <div
        role="radiogroup"
        aria-label="Available business niches"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: "var(--space-3)",
        }}
      >
        {filteredNiches.map((niche) => {
          const isSelected = formData.niche_slug === niche.slug;
          return (
            <div
              key={niche.slug}
              role="radio"
              aria-checked={isSelected}
              tabIndex={0}
              onClick={() =>
                onSelectNiche(niche.slug, niche.nicheGroupSlug ?? "other_business", niche.name)
              }
              onKeyDown={(e) => {
                if (e.key === " " || e.key === "Enter") {
                  e.preventDefault();
                  onSelectNiche(niche.slug, niche.nicheGroupSlug ?? "other_business", niche.name);
                }
              }}
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                padding: "var(--space-4)",
                borderRadius: "var(--radius-lg)",
                border: isSelected
                  ? "2px solid var(--color-brand-primary)"
                  : "1px solid var(--color-border-subtle)",
                background: isSelected
                  ? "var(--color-surface-selected, #f0fdf4)"
                  : "var(--color-surface)",
                cursor: "pointer",
                transition: "border-color 0.15s ease, background-color 0.15s ease",
                minHeight: "100px",
                outline: "none",
                position: "relative",
              }}
            >
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "var(--space-2)",
                    marginBottom: "var(--space-1)",
                  }}
                >
                  <h3
                    style={{
                      fontSize: "var(--font-size-body-bold, 1rem)",
                      fontWeight: 600,
                      color: "var(--color-text-primary)",
                      margin: 0,
                    }}
                  >
                    {niche.name}
                  </h3>
                  {getAvailabilityBadge(niche.availabilityLabel)}
                </div>
                {niche.description && (
                  <p
                    style={{
                      fontSize: "var(--font-size-sm)",
                      color: "var(--color-text-secondary)",
                      margin: "var(--space-1) 0 0 0",
                    }}
                  >
                    {niche.description}
                  </p>
                )}
              </div>

              {isSelected && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-1)",
                    color: "var(--color-brand-primary)",
                    fontSize: "var(--font-size-sm)",
                    fontWeight: 600,
                    marginTop: "var(--space-2)",
                  }}
                >
                  <span aria-hidden="true">&#10003;</span> Selected Niche
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredNiches.length === 0 && (
        <div
          style={{
            padding: "var(--space-6)",
            textAlign: "center",
            color: "var(--color-text-secondary)",
            background: "var(--color-surface-subtle, #f9fafb)",
            borderRadius: "var(--radius-md)",
          }}
        >
          <p style={{ margin: "0 0 var(--space-2) 0" }}>No matching niches found for your query.</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setSelectedGroup("all");
              setSearchQuery("");
            }}
          >
            Clear Filters
          </Button>
        </div>
      )}

      {/* Selected Action Bar */}
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
        <div style={{ fontSize: "var(--font-size-body)" }}>
          {selectedNicheObj ? (
            <span>
              Chosen: <strong>{selectedNicheObj.name}</strong>
            </span>
          ) : (
            <span style={{ color: "var(--color-text-secondary)" }}>
              Please select a niche above to proceed.
            </span>
          )}
        </div>
        <Button
          variant="primary"
          onClick={onNext}
          disabled={!formData.niche_slug}
          style={{ minHeight: "44px", minWidth: "160px" }}
        >
          Continue to Basic Facts &rarr;
        </Button>
      </div>
    </div>
  );
}
