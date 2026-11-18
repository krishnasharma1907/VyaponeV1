"use client";

import React, { useState } from "react";
import { Button, Field, Input } from "@/components/ui";
import type { WizardFormData } from "./types";

interface StepFactsProps {
  formData: WizardFormData;
  onChange: (updates: Partial<WizardFormData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepFacts({
  formData,
  onChange,
  onNext,
  onBack,
}: StepFactsProps): React.JSX.Element {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showStatutory, setShowStatutory] = useState<boolean>(
    Boolean(formData.gst_number || formData.pan_number || formData.tax_scheme !== "unregistered"),
  );

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!formData.trade_name.trim() || formData.trade_name.trim().length < 2) {
      errs.trade_name = "Trade name must be at least 2 characters";
    }

    if (!formData.address_line1.trim() || formData.address_line1.trim().length < 3) {
      errs.address_line1 = "Address line 1 is required (at least 3 characters)";
    }

    if (!formData.city.trim() || formData.city.trim().length < 2) {
      errs.city = "City is required";
    }

    if (!formData.state.trim() || formData.state.trim().length < 2) {
      errs.state = "State is required";
    }

    if (!formData.postal_code.trim() || !/^\d{6}$/.test(formData.postal_code.trim())) {
      errs.postal_code = "PIN code must be a valid 6-digit Indian postal code";
    }

    if (
      formData.primary_phone &&
      !/^(\+?[0-9]{10,15})$/.test(formData.primary_phone.trim().replace(/\s+/g, ""))
    ) {
      errs.primary_phone = "Phone number must be 10 to 15 digits";
    }

    if (
      formData.whatsapp_number &&
      !/^(\+?[0-9]{10,15})$/.test(formData.whatsapp_number.trim().replace(/\s+/g, ""))
    ) {
      errs.whatsapp_number = "WhatsApp number must be 10 to 15 digits";
    }

    if (formData.gst_number) {
      const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstinRegex.test(formData.gst_number.trim().toUpperCase())) {
        errs.gst_number = "Invalid 15-character GSTIN format";
      }
    }

    if (formData.pan_number) {
      const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
      if (!panRegex.test(formData.pan_number.trim().toUpperCase())) {
        errs.pan_number = "Invalid 10-character PAN format";
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
        <h2
          style={{
            fontSize: "var(--font-size-h2)",
            color: "var(--color-text-primary)",
            margin: "0 0 var(--space-1) 0",
          }}
        >
          Basic Business Facts & Location
        </h2>
        <p
          style={{
            fontSize: "var(--font-size-body)",
            color: "var(--color-text-secondary)",
            margin: 0,
          }}
        >
          Configure the public business identity, contact details, and primary physical storefront.
        </p>
      </div>

      {/* Identity Group */}
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
        <h3
          style={{
            fontSize: "var(--font-size-body-bold, 1rem)",
            margin: 0,
            color: "var(--color-text-primary)",
          }}
        >
          Business Name & Branding
        </h3>

        <Field
          id="trade_name"
          label="Trade Name / Store Name"
          required
          helperText="The name customers recognize on signs, WhatsApp, and invoices"
          errorMessage={errors.trade_name}
        >
          <Input
            id="trade_name"
            name="trade_name"
            value={formData.trade_name}
            onChange={(e) => {
              const val = e.target.value;
              onChange({
                trade_name: val,
                legal_name: formData.legal_name ? formData.legal_name : val,
              });
              if (errors.trade_name) {
                setErrors((prev) => {
                  const n = { ...prev };
                  delete n.trade_name;
                  return n;
                });
              }
            }}
            placeholder="e.g. Royal Chai & Bakery"
            aria-required="true"
            aria-invalid={Boolean(errors.trade_name)}
            style={{ minHeight: "44px" }}
          />
        </Field>

        <Field
          id="legal_name"
          label="Legal Business Name (Optional)"
          helperText="Defaults to Trade Name if registered under the same name"
          errorMessage={errors.legal_name}
        >
          <Input
            id="legal_name"
            name="legal_name"
            value={formData.legal_name}
            onChange={(e) => onChange({ legal_name: e.target.value })}
            placeholder="e.g. Royal Foods Private Limited"
            style={{ minHeight: "44px" }}
          />
        </Field>

        <Field
          id="description"
          label="Short Business Description"
          helperText="1-2 sentences summarizing what makes your business special"
        >
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder="e.g. Authentic artisanal bakery and espresso café serving fresh sourdough and tea."
            rows={2}
            style={{
              width: "100%",
              padding: "var(--space-2) var(--space-3)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-border-subtle)",
              fontFamily: "inherit",
              fontSize: "var(--font-size-body)",
              color: "var(--color-text-primary)",
              boxSizing: "border-box",
            }}
          />
        </Field>
      </div>

      {/* Primary Location Group */}
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
        <h3
          style={{
            fontSize: "var(--font-size-body-bold, 1rem)",
            margin: 0,
            color: "var(--color-text-primary)",
          }}
        >
          Primary Physical Location
        </h3>

        <Field
          id="location_name"
          label="Location Name"
          helperText="Identifier for this store (e.g. Main Branch, Indiranagar Outlet)"
        >
          <Input
            id="location_name"
            name="location_name"
            value={formData.location_name}
            onChange={(e) => onChange({ location_name: e.target.value })}
            placeholder="Main Store"
            style={{ minHeight: "44px" }}
          />
        </Field>

        <Field
          id="address_line1"
          label="Address Line 1"
          required
          helperText="Shop number, building, floor, or street name"
          errorMessage={errors.address_line1}
        >
          <Input
            id="address_line1"
            name="address_line1"
            value={formData.address_line1}
            onChange={(e) => {
              onChange({ address_line1: e.target.value });
              if (errors.address_line1) {
                setErrors((prev) => {
                  const n = { ...prev };
                  delete n.address_line1;
                  return n;
                });
              }
            }}
            placeholder="e.g. Shop 4B, 100 Feet Road"
            aria-required="true"
            aria-invalid={Boolean(errors.address_line1)}
            style={{ minHeight: "44px" }}
          />
        </Field>

        <Field
          id="address_line2"
          label="Address Line 2 (Optional)"
          helperText="Landmark, area, or sector"
        >
          <Input
            id="address_line2"
            name="address_line2"
            value={formData.address_line2}
            onChange={(e) => onChange({ address_line2: e.target.value })}
            placeholder="e.g. Near Metro Pillar 140"
            style={{ minHeight: "44px" }}
          />
        </Field>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "var(--space-3)",
          }}
        >
          <Field id="city" label="City" required errorMessage={errors.city}>
            <Input
              id="city"
              name="city"
              value={formData.city}
              onChange={(e) => {
                onChange({ city: e.target.value });
                if (errors.city) {
                  setErrors((prev) => {
                    const n = { ...prev };
                    delete n.city;
                    return n;
                  });
                }
              }}
              placeholder="e.g. Bengaluru"
              aria-required="true"
              aria-invalid={Boolean(errors.city)}
              style={{ minHeight: "44px" }}
            />
          </Field>

          <Field id="state" label="State" required errorMessage={errors.state}>
            <Input
              id="state"
              name="state"
              value={formData.state}
              onChange={(e) => {
                onChange({ state: e.target.value });
                if (errors.state) {
                  setErrors((prev) => {
                    const n = { ...prev };
                    delete n.state;
                    return n;
                  });
                }
              }}
              placeholder="e.g. Karnataka"
              aria-required="true"
              aria-invalid={Boolean(errors.state)}
              style={{ minHeight: "44px" }}
            />
          </Field>

          <Field id="postal_code" label="PIN Code" required errorMessage={errors.postal_code}>
            <Input
              id="postal_code"
              name="postal_code"
              maxLength={6}
              value={formData.postal_code}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "");
                onChange({ postal_code: val });
                if (errors.postal_code) {
                  setErrors((prev) => {
                    const n = { ...prev };
                    delete n.postal_code;
                    return n;
                  });
                }
              }}
              placeholder="e.g. 560038"
              aria-required="true"
              aria-invalid={Boolean(errors.postal_code)}
              style={{ minHeight: "44px" }}
            />
          </Field>
        </div>
      </div>

      {/* Contact Details Group */}
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
        <h3
          style={{
            fontSize: "var(--font-size-body-bold, 1rem)",
            margin: 0,
            color: "var(--color-text-primary)",
          }}
        >
          Customer Contact Channels
        </h3>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "var(--space-3)",
          }}
        >
          <Field
            id="primary_phone"
            label="Primary Phone"
            helperText="For direct customer calls"
            errorMessage={errors.primary_phone}
          >
            <Input
              id="primary_phone"
              name="primary_phone"
              type="tel"
              value={formData.primary_phone}
              onChange={(e) => onChange({ primary_phone: e.target.value })}
              placeholder="+91 98765 43210"
              style={{ minHeight: "44px" }}
            />
          </Field>

          <Field
            id="whatsapp_number"
            label="WhatsApp Number"
            helperText="Used for customer orders, chat, and invoice sharing"
            errorMessage={errors.whatsapp_number}
          >
            <Input
              id="whatsapp_number"
              name="whatsapp_number"
              type="tel"
              value={formData.whatsapp_number}
              onChange={(e) => onChange({ whatsapp_number: e.target.value })}
              placeholder="+91 98765 43210"
              style={{ minHeight: "44px" }}
            />
          </Field>
        </div>
      </div>

      {/* Statutory & Tax Details (Progressive Disclosure) */}
      <div
        style={{
          background: "var(--color-surface)",
          padding: "var(--space-4)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--color-border-subtle)",
        }}
      >
        <button
          type="button"
          onClick={() => setShowStatutory(!showStatutory)}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            textAlign: "left",
            minHeight: "44px",
          }}
        >
          <div>
            <h3
              style={{
                fontSize: "var(--font-size-body-bold, 1rem)",
                margin: 0,
                color: "var(--color-text-primary)",
              }}
            >
              Tax & Statutory Details (Optional)
            </h3>
            <p
              style={{
                fontSize: "var(--font-size-sm)",
                color: "var(--color-text-secondary)",
                margin: "var(--space-1) 0 0 0",
              }}
            >
              Configure GSTIN and PAN if statutory tax invoicing is required.
            </p>
          </div>
          <span style={{ fontSize: "1.2rem", color: "var(--color-text-secondary)" }}>
            {showStatutory ? "▲" : "▼"}
          </span>
        </button>

        {showStatutory && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-4)",
              marginTop: "var(--space-4)",
              paddingTop: "var(--space-4)",
              borderTop: "1px solid var(--color-border-subtle)",
            }}
          >
            <Field id="tax_scheme" label="GST Tax Scheme">
              <select
                id="tax_scheme"
                name="tax_scheme"
                value={formData.tax_scheme}
                onChange={(e) =>
                  onChange({
                    tax_scheme: e.target.value as
                      "registered" | "composition" | "unregistered" | "exempt",
                  })
                }
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
                <option value="unregistered">Unregistered Merchant</option>
                <option value="registered">Regular GST Registered</option>
                <option value="composition">Composition Scheme</option>
                <option value="exempt">Exempt / Non-GST</option>
              </select>
            </Field>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "var(--space-3)",
              }}
            >
              <Field
                id="gst_number"
                label="GSTIN Number"
                helperText="15-character statutory tax identifier"
                errorMessage={errors.gst_number}
              >
                <Input
                  id="gst_number"
                  name="gst_number"
                  maxLength={15}
                  value={formData.gst_number}
                  onChange={(e) => onChange({ gst_number: e.target.value.toUpperCase() })}
                  placeholder="e.g. 29ABCDE1234F1Z5"
                  style={{ minHeight: "44px", textTransform: "uppercase" }}
                />
              </Field>

              <Field
                id="pan_number"
                label="PAN Number"
                helperText="10-character Permanent Account Number"
                errorMessage={errors.pan_number}
              >
                <Input
                  id="pan_number"
                  name="pan_number"
                  maxLength={10}
                  value={formData.pan_number}
                  onChange={(e) => onChange({ pan_number: e.target.value.toUpperCase() })}
                  placeholder="e.g. ABCDE1234F"
                  style={{ minHeight: "44px", textTransform: "uppercase" }}
                />
              </Field>
            </div>
          </div>
        )}
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
          &larr; Back to Niche
        </Button>
        <Button type="submit" variant="primary" style={{ minHeight: "44px", minWidth: "160px" }}>
          Continue to Media &rarr;
        </Button>
      </div>
    </form>
  );
}
