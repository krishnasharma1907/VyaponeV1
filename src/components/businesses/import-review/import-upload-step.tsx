"use client";

import React, { useState } from "react";
import { Button, Card, CardContent } from "@/components/ui";
import type { ImportSourceFormat } from "./types";

interface ImportUploadStepProps {
  onParse: (content: string, format: ImportSourceFormat, fileName?: string) => void;
  isLoading: boolean;
  error?: string | null;
}

const SAMPLE_CAFE_JSON = JSON.stringify(
  {
    trade_name: "Chai & Chaska Café",
    legal_name: "Chai & Chaska Food Services LLP",
    niche_slug: "cafe",
    description: "Artisanal chai, freshly baked samosas and bun maska in Indore",
    primary_phone: "+919826012345",
    whatsapp_number: "+919826012345",
    email: "contact@chaiandchaska.in",
    address_line1: "56 Dukan Street, Chhappan Dukan",
    city: "Indore",
    state: "Madhya Pradesh",
    postal_code: "452001",
    gst_number: "23AABCC1234D1Z5",
    pan_number: "AABCC1234D",
    timings: {
      monday: "08:00 - 22:30",
      tuesday: "08:00 - 22:30",
      wednesday: "08:00 - 22:30",
      thursday: "08:00 - 22:30",
      friday: "08:00 - 23:00",
      saturday: "08:00 - 23:30",
      sunday: "08:00 - 23:30",
    },
    items: [
      {
        title: "Special Adrak Elaichi Chai",
        price: 30,
        description: "Freshly crushed ginger and cardamom milk tea",
      },
      {
        title: "Bun Maska with Jam",
        price: 50,
        description: "Warm bakery bun loaded with Amul butter",
      },
      {
        title: "Crispy Indore Samosa (2 pcs)",
        price: 40,
        description: "Served with sweet tamarind and spicy green chutney",
      },
      {
        title: "Cold Coffee with Ice Cream",
        price: 90,
        description: "Thick creamy blended cold coffee",
      },
    ],
  },
  null,
  2,
);

const SAMPLE_MENU_CSV = `Item,Price,Category,Description
Masala Dosa,80,South Indian,Crispy rice crepe filled with spiced potato masala
Paneer Butter Masala,220,Main Course,Cottage cheese cubes simmered in rich tomato butter gravy
Butter Naan,40,Breads,Traditional clay oven tandoori naan brushed with butter
Gulab Jamun (2 pcs),60,Desserts,Warm milk-solid dumplings soaked in rose sugar syrup`;

export function ImportUploadStep({
  onParse,
  isLoading,
  error,
}: ImportUploadStepProps): React.JSX.Element {
  const [format, setFormat] = useState<ImportSourceFormat>("json");
  const [content, setContent] = useState<string>("");
  const [fileName, setFileName] = useState<string | undefined>(undefined);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setValidationError("File size must be less than 2 MB");
      return;
    }

    setFileName(file.name);
    setValidationError(null);

    // Auto-detect format from extension
    if (file.name.endsWith(".json")) {
      setFormat("json");
    } else if (file.name.endsWith(".csv") || file.name.endsWith(".tsv")) {
      setFormat("csv");
    } else {
      setFormat("text");
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === "string") {
        setContent(text);
      }
    };
    reader.onerror = () => {
      setValidationError("Failed to read file contents");
    };
    reader.readAsText(file);
  };

  const handleLoadSample = (sampleType: "json" | "csv") => {
    if (sampleType === "json") {
      setFormat("json");
      setContent(SAMPLE_CAFE_JSON);
      setFileName("sample-chai-chaska.json");
    } else {
      setFormat("csv");
      setContent(SAMPLE_MENU_CSV);
      setFileName("sample-menu.csv");
    }
    setValidationError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      setValidationError("Please paste or upload content before reviewing");
      return;
    }
    setValidationError(null);
    onParse(content, format, fileName);
  };

  return (
    <Card variant="default">
      <CardContent style={{ padding: "var(--space-6)" }}>
        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}
        >
          <div>
            <h2
              style={{
                fontSize: "var(--font-size-h2)",
                color: "var(--color-text-primary)",
                margin: "0 0 var(--space-1) 0",
              }}
            >
              Import Business Data & Catalogue
            </h2>
            <p
              style={{
                fontSize: "var(--font-size-body)",
                color: "var(--color-text-secondary)",
                margin: 0,
              }}
            >
              Upload a structured export or paste raw store data. Extracted facts, prices, and
              timings will be staged for your review and explicit human confirmation.
            </p>
          </div>

          {/* Format Selection */}
          <div>
            <label
              id="format-selector-label"
              style={{
                display: "block",
                fontSize: "var(--font-size-sm)",
                fontWeight: 600,
                color: "var(--color-text-primary)",
                marginBottom: "var(--space-2)",
              }}
            >
              Select Import Source Format
            </label>
            <div
              role="radiogroup"
              aria-labelledby="format-selector-label"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                gap: "var(--space-3)",
              }}
            >
              {(
                [
                  { id: "json", label: "JSON Export", desc: "Structured store data" },
                  { id: "csv", label: "CSV / Menu", desc: "Tabular catalogue or profile" },
                  { id: "text", label: "Text / Paste", desc: "WhatsApp or copied notes" },
                ] as const
              ).map((fmt) => {
                const isSelected = format === fmt.id;
                return (
                  <button
                    key={fmt.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => {
                      setFormat(fmt.id);
                      setValidationError(null);
                    }}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      padding: "var(--space-3) var(--space-4)",
                      borderRadius: "var(--radius-md)",
                      border: isSelected
                        ? "2px solid var(--color-brand-primary)"
                        : "1px solid var(--color-border-subtle, #e5e7eb)",
                      background: isSelected
                        ? "var(--color-brand-surface, #eff6ff)"
                        : "var(--color-surface, #ffffff)",
                      cursor: "pointer",
                      textAlign: "left",
                      minHeight: "44px",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 600,
                        fontSize: "var(--font-size-sm)",
                        color: isSelected
                          ? "var(--color-brand-primary)"
                          : "var(--color-text-primary)",
                      }}
                    >
                      {fmt.label}
                    </span>
                    <span
                      style={{
                        fontSize: "var(--font-size-xs)",
                        color: "var(--color-text-secondary)",
                        marginTop: "2px",
                      }}
                    >
                      {fmt.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* File Upload & Samples Toolbar */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "var(--space-2)",
            }}
          >
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--space-2)",
                padding: "var(--space-2) var(--space-3)",
                background: "var(--color-surface-hover, #f3f4f6)",
                border: "1px solid var(--color-border-subtle, #d1d5db)",
                borderRadius: "var(--radius-md)",
                cursor: "pointer",
                fontSize: "var(--font-size-sm)",
                color: "var(--color-text-primary)",
                minHeight: "44px",
              }}
            >
              <span>📁 Upload File ({format.toUpperCase()})</span>
              <input
                type="file"
                accept={
                  format === "json" ? ".json" : format === "csv" ? ".csv,.tsv" : ".txt,.json,.csv"
                }
                onChange={handleFileUpload}
                style={{ display: "none" }}
              />
            </label>

            {/* Quick Demo Sample Buttons */}
            <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => handleLoadSample("json")}
              >
                Load Sample JSON
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => handleLoadSample("csv")}
              >
                Load Sample Menu CSV
              </Button>
            </div>
          </div>

          {fileName && (
            <div
              style={{
                fontSize: "var(--font-size-xs)",
                color: "var(--color-brand-primary)",
                background: "var(--color-brand-surface, #eff6ff)",
                padding: "var(--space-1) var(--space-3)",
                borderRadius: "var(--radius-sm)",
                display: "inline-block",
                alignSelf: "flex-start",
              }}
            >
              Active File: <strong>{fileName}</strong>
            </div>
          )}

          {/* Textarea for Raw Data */}
          <div>
            <label
              htmlFor="import-content-input"
              style={{
                display: "block",
                fontSize: "var(--font-size-sm)",
                fontWeight: 600,
                color: "var(--color-text-primary)",
                marginBottom: "var(--space-1)",
              }}
            >
              Or Paste Content Directly
            </label>
            <textarea
              id="import-content-input"
              rows={9}
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                setValidationError(null);
              }}
              placeholder={
                format === "json"
                  ? 'Paste raw JSON e.g. {"trade_name": "My Shop", "primary_phone": "9876543210", ...}'
                  : format === "csv"
                    ? "Paste CSV rows e.g. Item,Price,Category\\nPaneer Tikka,220,Starter"
                    : "Paste raw text e.g. Sharma Sweets, Indiranagar. Contact: 9876543210. Open daily 9am to 9pm."
              }
              style={{
                width: "100%",
                padding: "var(--space-3)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--color-border-subtle, #d1d5db)",
                fontFamily: "monospace",
                fontSize: "var(--font-size-sm)",
                background: "var(--color-surface, #ffffff)",
                color: "var(--color-text-primary)",
                boxSizing: "border-box",
                resize: "vertical",
              }}
            />
          </div>

          {/* Error display */}
          {(validationError || error) && (
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
              {validationError || error}
            </div>
          )}

          {/* Submit Action */}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button
              type="submit"
              variant="primary"
              disabled={isLoading || !content.trim()}
              style={{ minHeight: "44px", minWidth: "160px" }}
            >
              {isLoading ? "Parsing Facts..." : "Extract & Review Facts →"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
