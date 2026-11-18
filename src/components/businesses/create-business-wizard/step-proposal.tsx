"use client";

import React, { useMemo } from "react";
import { Badge, Button, Card, CardContent } from "@/components/ui";
import { DEFAULT_NICHE_MANIFESTS } from "@/lib/niches/constants";
import type { NicheManifest } from "@/lib/niches/types";
import type { WizardFormData } from "./types";

interface StepProposalProps {
  formData: WizardFormData;
  manifest?: NicheManifest | null;
  isSubmitting: boolean;
  onConfirm: () => void;
  onEditFacts: () => void;
  onSaveDraft: () => void;
  lastSavedAt?: string | null;
}

export function StepProposal({
  formData,
  manifest: passedManifest,
  isSubmitting,
  onConfirm,
  onEditFacts,
  onSaveDraft,
  lastSavedAt,
}: StepProposalProps): React.JSX.Element {
  const manifest = useMemo(() => {
    if (passedManifest) return passedManifest;
    return (
      DEFAULT_NICHE_MANIFESTS[formData.niche_slug] ?? DEFAULT_NICHE_MANIFESTS["other_business"]
    );
  }, [passedManifest, formData.niche_slug]);

  // Derived pages based on niche
  const anticipatedPages = useMemo(() => {
    const slug = formData.niche_slug;
    if (slug === "restaurant" || slug === "cafe") {
      return [
        "Home Showcase",
        "Food & Drink Menu",
        "Dine-in / Ordering",
        "About Us",
        "Location & Hours",
      ];
    }
    if (slug === "salon" || slug === "gym_fitness") {
      return [
        "Home Showcase",
        "Services & Pricing",
        "Appointments & Bookings",
        "About Us",
        "Location & Contact",
      ];
    }
    if (slug === "kirana" || slug === "boutique_retail") {
      return [
        "Home Showcase",
        "Product Catalogue",
        "WhatsApp Quick Order",
        "Store Timings & Location",
      ];
    }
    return [
      "Home Showcase",
      "Services & Offerings",
      "Enquiry & Quotation",
      "About Us",
      "Contact & Location",
    ];
  }, [formData.niche_slug]);

  // Modules enabled by default
  const defaultModules = useMemo(() => {
    return manifest?.modules?.defaultEnabled ?? ["website_engine"];
  }, [manifest]);

  // Missing optional details checklist
  const missingItems = useMemo(() => {
    const items: string[] = [];
    if (!formData.logo_media_id && !formData.logo_preview_url) {
      items.push("Storefront Logo (defaults to stylized typography)");
    }
    if (!formData.gst_number) {
      items.push("GSTIN statutory number (can be added in Settings)");
    }
    if (!formData.pan_number) {
      items.push("PAN statutory number (can be added in Settings)");
    }
    if (!formData.primary_phone && !formData.whatsapp_number) {
      items.push("Direct customer call/WhatsApp number");
    }
    return items;
  }, [formData]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <h2
            style={{
              fontSize: "var(--font-size-h2)",
              color: "var(--color-text-primary)",
              margin: "0 0 var(--space-1) 0",
            }}
          >
            Review Setup Proposal
          </h2>
          <Badge variant="success">Proposal Ready</Badge>
        </div>
        <p
          style={{
            fontSize: "var(--font-size-body)",
            color: "var(--color-text-secondary)",
            margin: 0,
          }}
        >
          Review your business configuration and generated website blueprint before confirming
          setup.
        </p>
      </div>

      {/* Main Proposal Card */}
      <Card variant="elevated" style={{ overflow: "hidden" }}>
        {/* Header Banner */}
        <div
          style={{
            background:
              "linear-gradient(135deg, var(--color-brand-primary, #0B6E4F) 0%, #0A3D2E 100%)",
            color: "#ffffff",
            padding: "var(--space-5)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              flexWrap: "wrap",
              gap: "var(--space-3)",
            }}
          >
            <div>
              <span
                style={{
                  display: "inline-block",
                  fontSize: "var(--font-size-xs, 0.75rem)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "#a7f3d0",
                  marginBottom: "var(--space-1)",
                }}
              >
                {manifest?.name ?? "Business Setup"}
              </span>
              <h3
                style={{
                  fontSize: "var(--font-size-h2)",
                  fontWeight: 700,
                  margin: 0,
                  color: "#ffffff",
                }}
              >
                {formData.trade_name}
              </h3>
              <p
                style={{
                  margin: "var(--space-1) 0 0 0",
                  color: "#e6f4ea",
                  fontSize: "var(--font-size-sm)",
                }}
              >
                {formData.address_line1}, {formData.city}, {formData.state} - {formData.postal_code}
              </p>
            </div>
            {formData.logo_preview_url && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={formData.logo_preview_url}
                alt="Logo Preview"
                style={{
                  width: "64px",
                  height: "64px",
                  borderRadius: "var(--radius-md)",
                  border: "2px solid #ffffff",
                  objectFit: "contain",
                  background: "#ffffff",
                }}
              />
            )}
          </div>
        </div>

        <CardContent
          style={{
            padding: "var(--space-5)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-5)",
          }}
        >
          {/* Blueprint Section: Public Pages & Customer Actions */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "var(--space-4)",
            }}
          >
            <div
              style={{
                padding: "var(--space-4)",
                background: "var(--color-surface)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--color-border-subtle)",
              }}
            >
              <h4
                style={{
                  fontSize: "var(--font-size-body-bold, 1rem)",
                  fontWeight: 600,
                  margin: "0 0 var(--space-2) 0",
                  color: "var(--color-text-primary)",
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                }}
              >
                <span aria-hidden="true">&#128196;</span> Public Pages to Generate
              </h4>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: "var(--space-4)",
                  fontSize: "var(--font-size-sm)",
                  color: "var(--color-text-secondary)",
                }}
              >
                {anticipatedPages.map((page) => (
                  <li key={page} style={{ marginBottom: "var(--space-1)" }}>
                    {page}
                  </li>
                ))}
              </ul>
            </div>

            <div
              style={{
                padding: "var(--space-4)",
                background: "var(--color-surface)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--color-border-subtle)",
              }}
            >
              <h4
                style={{
                  fontSize: "var(--font-size-body-bold, 1rem)",
                  fontWeight: 600,
                  margin: "0 0 var(--space-2) 0",
                  color: "var(--color-text-primary)",
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                }}
              >
                <span aria-hidden="true">&#9881;</span> Active Operational Modules
              </h4>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "var(--space-2)",
                  marginTop: "var(--space-1)",
                }}
              >
                {defaultModules.map((m) => (
                  <Badge key={m} variant="default">
                    {m.replace(/_/g, " ")}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {/* Visual Theme Direction */}
          <div
            style={{
              padding: "var(--space-3) var(--space-4)",
              background: "var(--color-surface-subtle, #f9fafb)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-border-subtle)",
              fontSize: "var(--font-size-sm)",
            }}
          >
            <div
              style={{
                fontWeight: 600,
                color: "var(--color-text-primary)",
                marginBottom: "var(--space-1)",
              }}
            >
              Visual & Design System Tokens (PRD §15.1)
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-3)",
                flexWrap: "wrap",
                color: "var(--color-text-secondary)",
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-1)" }}>
                <span
                  style={{
                    width: "12px",
                    height: "12px",
                    borderRadius: "50%",
                    background: "#FAF8F3",
                    border: "1px solid #ccc",
                  }}
                />{" "}
                Canvas (Warm White)
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-1)" }}>
                <span
                  style={{
                    width: "12px",
                    height: "12px",
                    borderRadius: "50%",
                    background: "#0B6E4F",
                  }}
                />{" "}
                Primary (Emerald)
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-1)" }}>
                <span
                  style={{
                    width: "12px",
                    height: "12px",
                    borderRadius: "50%",
                    background: "#F5A524",
                  }}
                />{" "}
                Accent (Marigold)
              </span>
            </div>
          </div>

          {/* Missing / Optional Details Checklist */}
          {missingItems.length > 0 && (
            <div
              style={{
                padding: "var(--space-4)",
                borderRadius: "var(--radius-md)",
                background: "#fffbeb",
                border: "1px solid #fef3c7",
              }}
            >
              <h4
                style={{
                  fontSize: "var(--font-size-sm)",
                  fontWeight: 600,
                  margin: "0 0 var(--space-2) 0",
                  color: "#92400e",
                }}
              >
                Post-Setup Items (Optional)
              </h4>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: "var(--space-4)",
                  fontSize: "var(--font-size-sm)",
                  color: "#b45309",
                }}
              >
                {missingItems.map((item) => (
                  <li key={item} style={{ marginBottom: "var(--space-1)" }}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Actions */}
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
        <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
          <Button
            type="button"
            variant="outline"
            onClick={onEditFacts}
            disabled={isSubmitting}
            style={{ minHeight: "44px" }}
          >
            &larr; Make Changes
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onSaveDraft}
            disabled={isSubmitting}
            style={{ minHeight: "44px" }}
          >
            Save Draft
          </Button>
          {lastSavedAt && (
            <span
              style={{
                fontSize: "var(--font-size-xs, 0.75rem)",
                color: "var(--color-text-secondary)",
              }}
            >
              Draft saved
            </span>
          )}
        </div>

        <Button
          type="button"
          variant="primary"
          onClick={onConfirm}
          disabled={isSubmitting}
          style={{
            minHeight: "48px",
            minWidth: "200px",
            fontSize: "var(--font-size-body-bold, 1rem)",
            background: "var(--color-brand-accent, #F5A524)",
            color: "#10201A",
            border: "none",
            fontWeight: 700,
          }}
        >
          {isSubmitting ? "Building Setup..." : "Looks good, build it \u2192"}
        </Button>
      </div>
    </div>
  );
}
