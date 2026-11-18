"use client";

import React, { useRef, useState } from "react";
import { Badge, Button } from "@/components/ui";
import { MediaUploader } from "@/components/media/media-uploader";
import type { MediaItem } from "@/lib/media/types";
import type { WizardFormData } from "./types";

interface StepMediaProps {
  formData: WizardFormData;
  onChange: (updates: Partial<WizardFormData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepMedia({
  formData,
  onChange,
  onNext,
  onBack,
}: StepMediaProps): React.JSX.Element {
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setUploadNotice("Logo file must be under 5 MB.");
      return;
    }

    setLogoFile(file);
    const objectUrl = URL.createObjectURL(file);
    onChange({
      logo_preview_url: objectUrl,
    });
    setUploadNotice(null);
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    if (formData.logo_preview_url && formData.logo_preview_url.startsWith("blob:")) {
      URL.revokeObjectURL(formData.logo_preview_url);
    }
    onChange({
      logo_media_id: null,
      logo_preview_url: null,
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleMediaUploaderSuccess = (item: MediaItem) => {
    onChange({
      logo_media_id: item.id,
      logo_preview_url: item.url ?? formData.logo_preview_url,
    });
    setUploadNotice("Store logo uploaded and held in private quarantine.");
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
          Media & Storefront Assets
        </h2>
        <p
          style={{
            fontSize: "var(--font-size-body)",
            color: "var(--color-text-secondary)",
            margin: 0,
          }}
        >
          Upload your business logo and shopfront imagery. Customers trust businesses with real
          storefront photos.
        </p>
      </div>

      {/* Quarantine Isolation Notice */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "var(--space-3)",
          padding: "var(--space-3) var(--space-4)",
          borderRadius: "var(--radius-md)",
          background: "var(--color-surface-subtle, #f0fdf4)",
          border: "1px solid var(--color-brand-primary-light, #bbf7d0)",
          fontSize: "var(--font-size-sm)",
          color: "var(--color-brand-primary)",
        }}
      >
        <span aria-hidden="true" style={{ fontSize: "1.1rem" }}>
          &#128274;
        </span>
        <div>
          <strong>Tenant Privacy & Quarantine Protection:</strong>
          <br />
          All media uploads enter an encrypted, private quarantine bucket (
          <code>vyapone-private-media</code>). Only authorized owners can inspect assets until site
          publication.
        </div>
      </div>

      {/* Store Logo Section */}
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3
            style={{
              fontSize: "var(--font-size-body-bold, 1rem)",
              margin: 0,
              color: "var(--color-text-primary)",
            }}
          >
            Storefront Logo / Brand Mark
          </h3>
          <Badge variant="default">Recommended</Badge>
        </div>

        {formData.businessId ? (
          <MediaUploader
            businessId={formData.businessId}
            category="business_logo"
            label="Upload Business Logo"
            hint="PNG, JPEG, WebP, or SVG up to 5 MB"
            initialMediaUrl={formData.logo_preview_url ?? undefined}
            onUploadSuccess={handleMediaUploaderSuccess}
            onUploadError={(err) => setUploadNotice(`Upload error: ${err}`)}
          />
        ) : (
          <div>
            {formData.logo_preview_url ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-4)",
                  padding: "var(--space-3)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--color-border-subtle)",
                  background: "var(--color-surface)",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={formData.logo_preview_url}
                  alt="Store Logo Preview"
                  style={{
                    width: "72px",
                    height: "72px",
                    objectFit: "contain",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--color-border-subtle)",
                    background: "#ffffff",
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      color: "var(--color-text-primary)",
                      fontSize: "var(--font-size-sm)",
                    }}
                  >
                    {logoFile ? logoFile.name : "Uploaded Business Logo"}
                  </div>
                  <div
                    style={{
                      color: "var(--color-text-secondary)",
                      fontSize: "var(--font-size-xs, 0.75rem)",
                      marginTop: "var(--space-1)",
                    }}
                  >
                    Staged for setup creation & quarantine
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={handleRemoveLogo}>
                  Remove
                </Button>
              </div>
            ) : (
              <div
                style={{
                  border: "2px dashed var(--color-border-subtle)",
                  borderRadius: "var(--radius-lg)",
                  padding: "var(--space-6)",
                  textAlign: "center",
                  background: "var(--color-surface)",
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  id="logo-file-input"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={handleLogoFileChange}
                  style={{ display: "none" }}
                  aria-label="Choose business logo file"
                />
                <label
                  htmlFor="logo-file-input"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: "44px",
                    padding: "var(--space-2) var(--space-4)",
                    borderRadius: "var(--radius-md)",
                    background: "var(--color-brand-primary)",
                    color: "#ffffff",
                    fontWeight: 600,
                    cursor: "pointer",
                    marginBottom: "var(--space-2)",
                  }}
                >
                  Choose Logo Image
                </label>
                <p
                  style={{
                    fontSize: "var(--font-size-sm)",
                    color: "var(--color-text-secondary)",
                    margin: "var(--space-1) 0 0 0",
                  }}
                >
                  Square PNG, JPEG, SVG or WebP, up to 5 MB
                </p>
              </div>
            )}
          </div>
        )}

        {uploadNotice && (
          <div
            style={{
              padding: "var(--space-2) var(--space-3)",
              background: "var(--color-surface-subtle)",
              borderRadius: "var(--radius-sm)",
              fontSize: "var(--font-size-sm)",
              color: "var(--color-text-secondary)",
            }}
          >
            {uploadNotice}
          </div>
        )}
      </div>

      {/* Showcase Photos Section */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-3)",
          background: "var(--color-surface)",
          padding: "var(--space-4)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--color-border-subtle)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3
            style={{
              fontSize: "var(--font-size-body-bold, 1rem)",
              margin: 0,
              color: "var(--color-text-primary)",
            }}
          >
            Storefront & Showcase Photos
          </h3>
          <Badge variant="default">Optional</Badge>
        </div>
        <p
          style={{
            fontSize: "var(--font-size-sm)",
            color: "var(--color-text-secondary)",
            margin: 0,
          }}
        >
          Photos of dining areas, shelves, salon chairs, or price boards will be used for draft
          catalogue extraction and gallery sections. Additional photos can be added anytime in the
          media library.
        </p>
      </div>

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
          &larr; Back to Facts
        </Button>
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <Button type="button" variant="outline" onClick={onNext} style={{ minHeight: "44px" }}>
            Skip for now
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={onNext}
            style={{ minHeight: "44px", minWidth: "160px" }}
          >
            Continue to Questions &rarr;
          </Button>
        </div>
      </div>
    </div>
  );
}
