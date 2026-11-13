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
import { createLocationAction, updateLocationAction } from "@/lib/businesses/actions";
import type { LocationRow } from "@/lib/businesses/types";

interface LocationFormProps {
  businessId: string;
  initialLocation?: LocationRow | null;
  onSuccess?: (location: LocationRow) => void;
  onCancel?: () => void;
}

export function LocationForm({
  businessId,
  initialLocation,
  onSuccess,
  onCancel,
}: LocationFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const isEditing = Boolean(initialLocation);

  const [formData, setFormData] = useState({
    name: initialLocation?.name ?? "",
    slug: initialLocation?.slug ?? "",
    address_line1: initialLocation?.address_line1 ?? "",
    address_line2: initialLocation?.address_line2 ?? "",
    city: initialLocation?.city ?? "",
    state: initialLocation?.state ?? "",
    postal_code: initialLocation?.postal_code ?? "",
    is_primary: initialLocation?.is_primary ?? false,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
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
      if (isEditing && initialLocation) {
        const result = await updateLocationAction(initialLocation.id, {
          name: formData.name,
          slug: formData.slug || undefined,
          address_line1: formData.address_line1,
          address_line2: formData.address_line2 || null,
          city: formData.city,
          state: formData.state,
          postal_code: formData.postal_code,
          is_primary: formData.is_primary,
        });

        if (!result.success) {
          setError(result.error);
          if (result.validationErrors) setFieldErrors(result.validationErrors);
          return;
        }

        if (onSuccess) onSuccess(result.data);
      } else {
        const result = await createLocationAction({
          business_id: businessId,
          name: formData.name,
          slug: formData.slug || undefined,
          address_line1: formData.address_line1,
          address_line2: formData.address_line2 || null,
          city: formData.city,
          state: formData.state,
          postal_code: formData.postal_code,
          is_primary: formData.is_primary,
        });

        if (!result.success) {
          setError(result.error);
          if (result.validationErrors) setFieldErrors(result.validationErrors);
          return;
        }

        if (onSuccess) onSuccess(result.data);
      }
    });
  };

  return (
    <Card variant="default">
      <CardHeader>
        <CardTitle as="h2">{isEditing ? "Edit Location" : "Add Store Location"}</CardTitle>
        <CardDescription>
          {isEditing
            ? "Update physical storefront address and operational parameters."
            : "Register an additional storefront or fulfillment point."}
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

          <Field
            id="loc_name"
            label="Location Name"
            required
            errorMessage={fieldErrors["name"]?.[0]}
            helperText="e.g. Indiranagar Branch, Warehouse B"
          >
            <Input
              id="loc_name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              disabled={isPending}
              required
            />
          </Field>

          <Field
            id="loc_slug"
            label="Location Slug (Optional)"
            errorMessage={fieldErrors["slug"]?.[0]}
            helperText="Alphanumeric identifier for URL routing"
          >
            <Input
              id="loc_slug"
              name="slug"
              value={formData.slug}
              onChange={handleChange}
              disabled={isPending}
            />
          </Field>

          <Field
            id="loc_address1"
            label="Address Line 1"
            required
            errorMessage={fieldErrors["address_line1"]?.[0]}
          >
            <Input
              id="loc_address1"
              name="address_line1"
              value={formData.address_line1}
              onChange={handleChange}
              disabled={isPending}
              required
            />
          </Field>

          <Field
            id="loc_address2"
            label="Address Line 2 (Optional)"
            errorMessage={fieldErrors["address_line2"]?.[0]}
          >
            <Input
              id="loc_address2"
              name="address_line2"
              value={formData.address_line2}
              onChange={handleChange}
              disabled={isPending}
            />
          </Field>

          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-3)" }}
          >
            <Field id="loc_city" label="City" required errorMessage={fieldErrors["city"]?.[0]}>
              <Input
                id="loc_city"
                name="city"
                value={formData.city}
                onChange={handleChange}
                disabled={isPending}
                required
              />
            </Field>

            <Field id="loc_state" label="State" required errorMessage={fieldErrors["state"]?.[0]}>
              <Input
                id="loc_state"
                name="state"
                value={formData.state}
                onChange={handleChange}
                disabled={isPending}
                required
              />
            </Field>

            <Field
              id="loc_pin"
              label="PIN Code"
              required
              errorMessage={fieldErrors["postal_code"]?.[0]}
            >
              <Input
                id="loc_pin"
                name="postal_code"
                value={formData.postal_code}
                onChange={handleChange}
                maxLength={6}
                disabled={isPending}
                required
              />
            </Field>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
              marginTop: "var(--space-1)",
            }}
          >
            <input
              type="checkbox"
              id="is_primary"
              name="is_primary"
              checked={formData.is_primary}
              onChange={handleChange}
              disabled={isPending}
              style={{ width: "16px", height: "16px", accentColor: "var(--color-primary)" }}
            />
            <label
              htmlFor="is_primary"
              style={{
                fontSize: "var(--font-size-body)",
                color: "var(--color-text-primary)",
                cursor: "pointer",
              }}
            >
              Set as primary store location
            </label>
          </div>

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
              {isEditing ? "Save Location" : "Add Location"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
