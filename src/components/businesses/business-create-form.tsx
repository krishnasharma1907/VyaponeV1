"use client";

import React, { useState, useTransition } from "react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  Input,
} from "@/components/ui";
import { createBusinessAction } from "@/lib/businesses/actions";
import type { BusinessWithLocations } from "@/lib/businesses/types";

interface BusinessCreateFormProps {
  workspaceId?: string | null;
  onSuccess?: (business: BusinessWithLocations) => void;
  onCancel?: () => void;
}

export function BusinessCreateForm({ workspaceId, onSuccess, onCancel }: BusinessCreateFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const [formData, setFormData] = useState({
    trade_name: "",
    legal_name: "",
    slug: "",
    gst_number: "",
    pan_number: "",
    location_name: "Main Store",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    postal_code: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    startTransition(async () => {
      const result = await createBusinessAction({
        trade_name: formData.trade_name,
        legal_name: formData.legal_name,
        slug: formData.slug ? formData.slug : undefined,
        workspace_id: workspaceId ?? null,
        gst_number: formData.gst_number ? formData.gst_number : null,
        pan_number: formData.pan_number ? formData.pan_number : null,
        location_name: formData.location_name || "Main Store",
        address_line1: formData.address_line1,
        address_line2: formData.address_line2 ? formData.address_line2 : null,
        city: formData.city,
        state: formData.state,
        postal_code: formData.postal_code,
      });

      if (!result.success) {
        setError(result.error);
        if (result.validationErrors) {
          setFieldErrors(result.validationErrors);
        }
        return;
      }

      if (onSuccess) {
        onSuccess(result.data);
      }
    });
  };

  return (
    <Card variant="default">
      <CardHeader>
        <CardTitle as="h2">Create Business</CardTitle>
        <CardDescription>
          Establish a sovereign business identity and configure its primary storefront location.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit}
          noValidate
          style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}
        >
          {error && (
            <div
              role="alert"
              style={{
                padding: "var(--space-3)",
                borderRadius: "var(--radius-md)",
                backgroundColor: "rgba(181, 43, 72, 0.1)",
                color: "var(--color-error)",
                fontSize: "var(--font-size-body-sm)",
                border: "1px solid var(--color-error)",
              }}
            >
              {error}
            </div>
          )}

          <fieldset
            style={{
              border: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-3)",
            }}
          >
            <legend
              style={{
                fontWeight: 600,
                color: "var(--color-text-primary)",
                marginBottom: "var(--space-1)",
              }}
            >
              Business Profile
            </legend>

            <Field
              id="trade_name"
              label="Trade Name / Brand"
              required
              errorMessage={fieldErrors["trade_name"]?.[0]}
              helperText="The public customer-facing name of your business (e.g. Ramesh Kirana)"
            >
              <Input
                id="trade_name"
                name="trade_name"
                value={formData.trade_name}
                onChange={handleChange}
                placeholder="Ramesh Kirana"
                disabled={isPending}
                required
              />
            </Field>

            <Field
              id="legal_name"
              label="Legal Business Name"
              required
              errorMessage={fieldErrors["legal_name"]?.[0]}
              helperText="Registered business or proprietor name for GST and invoices"
            >
              <Input
                id="legal_name"
                name="legal_name"
                value={formData.legal_name}
                onChange={handleChange}
                placeholder="Ramesh Retail Enterprises Pvt Ltd"
                disabled={isPending}
                required
              />
            </Field>

            <Field
              id="slug"
              label="URL Slug (Optional)"
              errorMessage={fieldErrors["slug"]?.[0]}
              helperText="Unique subdomain or identifier (leave blank to auto-generate)"
            >
              <Input
                id="slug"
                name="slug"
                value={formData.slug}
                onChange={handleChange}
                placeholder="ramesh-kirana"
                disabled={isPending}
              />
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
              <Field
                id="gst_number"
                label="GSTIN (Optional)"
                errorMessage={fieldErrors["gst_number"]?.[0]}
                helperText="15-character statutory tax ID"
              >
                <Input
                  id="gst_number"
                  name="gst_number"
                  value={formData.gst_number}
                  onChange={handleChange}
                  placeholder="29AAAAA0000A1Z5"
                  maxLength={15}
                  disabled={isPending}
                />
              </Field>

              <Field
                id="pan_number"
                label="PAN (Optional)"
                errorMessage={fieldErrors["pan_number"]?.[0]}
                helperText="10-character tax ID"
              >
                <Input
                  id="pan_number"
                  name="pan_number"
                  value={formData.pan_number}
                  onChange={handleChange}
                  placeholder="AAAAA0000A"
                  maxLength={10}
                  disabled={isPending}
                />
              </Field>
            </div>
          </fieldset>

          <fieldset
            style={{
              border: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-3)",
            }}
          >
            <legend
              style={{
                fontWeight: 600,
                color: "var(--color-text-primary)",
                marginBottom: "var(--space-1)",
              }}
            >
              Primary Store Location
            </legend>

            <Field
              id="location_name"
              label="Location Name"
              required
              errorMessage={fieldErrors["location_name"]?.[0]}
              helperText="Identifier for this physical storefront or warehouse"
            >
              <Input
                id="location_name"
                name="location_name"
                value={formData.location_name}
                onChange={handleChange}
                placeholder="Main Store"
                disabled={isPending}
                required
              />
            </Field>

            <Field
              id="address_line1"
              label="Address Line 1"
              required
              errorMessage={fieldErrors["address_line1"]?.[0]}
              helperText="Street address, building name, shop number"
            >
              <Input
                id="address_line1"
                name="address_line1"
                value={formData.address_line1}
                onChange={handleChange}
                placeholder="Shop No. 4, Ground Floor, Gandhi Market"
                disabled={isPending}
                required
              />
            </Field>

            <Field
              id="address_line2"
              label="Address Line 2 (Optional)"
              errorMessage={fieldErrors["address_line2"]?.[0]}
            >
              <Input
                id="address_line2"
                name="address_line2"
                value={formData.address_line2}
                onChange={handleChange}
                placeholder="Near Clock Tower"
                disabled={isPending}
              />
            </Field>

            <div
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-3)" }}
            >
              <Field id="city" label="City" required errorMessage={fieldErrors["city"]?.[0]}>
                <Input
                  id="city"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="Bengaluru"
                  disabled={isPending}
                  required
                />
              </Field>

              <Field id="state" label="State" required errorMessage={fieldErrors["state"]?.[0]}>
                <Input
                  id="state"
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  placeholder="Karnataka"
                  disabled={isPending}
                  required
                />
              </Field>

              <Field
                id="postal_code"
                label="PIN Code"
                required
                errorMessage={fieldErrors["postal_code"]?.[0]}
              >
                <Input
                  id="postal_code"
                  name="postal_code"
                  value={formData.postal_code}
                  onChange={handleChange}
                  placeholder="560001"
                  maxLength={6}
                  disabled={isPending}
                  required
                />
              </Field>
            </div>
          </fieldset>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "var(--space-2)",
              marginTop: "var(--space-2)",
            }}
          >
            {onCancel && (
              <Button type="button" variant="secondary" onClick={onCancel} disabled={isPending}>
                Cancel
              </Button>
            )}
            <Button type="submit" variant="primary" isLoading={isPending}>
              Create Business
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
