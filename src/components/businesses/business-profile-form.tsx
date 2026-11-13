"use client";

import React, { useState, useTransition } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  Input,
} from "@/components/ui";
import { updateBusinessProfileAction } from "@/lib/businesses/actions";
import type { BusinessRole, BusinessRow, BusinessStatus } from "@/lib/businesses/types";
import { hasBusinessPermission } from "@/lib/businesses/permissions";

interface BusinessProfileFormProps {
  business: BusinessRow;
  currentUserRole: BusinessRole;
  isSovereignOwner: boolean;
  onSuccess?: (updated: BusinessRow) => void;
}

export function BusinessProfileForm({
  business,
  currentUserRole,
  isSovereignOwner,
  onSuccess,
}: BusinessProfileFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const canEdit =
    isSovereignOwner || hasBusinessPermission(currentUserRole, "business:update_profile");

  const [formData, setFormData] = useState({
    trade_name: business.trade_name,
    legal_name: business.legal_name,
    gst_number: business.gst_number ?? "",
    pan_number: business.pan_number ?? "",
    status: business.status as BusinessStatus,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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
    if (!canEdit) return;

    setError(null);
    setSuccessMessage(null);
    setFieldErrors({});

    startTransition(async () => {
      const result = await updateBusinessProfileAction(business.id, {
        trade_name: formData.trade_name,
        legal_name: formData.legal_name,
        gst_number: formData.gst_number ? formData.gst_number : null,
        pan_number: formData.pan_number ? formData.pan_number : null,
        status: formData.status,
      });

      if (!result.success) {
        setError(result.error);
        if (result.validationErrors) {
          setFieldErrors(result.validationErrors);
        }
        return;
      }

      setSuccessMessage("Business details updated successfully");
      if (onSuccess) {
        onSuccess(result.data);
      }
    });
  };

  return (
    <Card variant="default">
      <CardHeader>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <CardTitle as="h2">Store Identity &amp; Statutory Details</CardTitle>
            <CardDescription>
              Legal trade identity, sovereign merchant facts, and GST details.
            </CardDescription>
          </div>
          <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
            <Badge variant={business.status === "active" ? "success" : "default"}>
              {business.status.toUpperCase()}
            </Badge>
            {isSovereignOwner && <Badge variant="primary">SOVEREIGN OWNER</Badge>}
          </div>
        </div>
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

          {successMessage && (
            <div
              role="status"
              style={{
                padding: "var(--space-3)",
                borderRadius: "var(--radius-md)",
                backgroundColor: "rgba(11, 110, 79, 0.1)",
                color: "var(--color-primary)",
                fontSize: "var(--font-size-body-sm)",
                border: "1px solid var(--color-primary)",
              }}
            >
              {successMessage}
            </div>
          )}

          <Field
            id="edit_trade_name"
            label="Trade Name"
            required
            errorMessage={fieldErrors["trade_name"]?.[0]}
          >
            <Input
              id="edit_trade_name"
              name="trade_name"
              value={formData.trade_name}
              onChange={handleChange}
              disabled={!canEdit || isPending}
              required
            />
          </Field>

          <Field
            id="edit_legal_name"
            label="Legal Name"
            required
            errorMessage={fieldErrors["legal_name"]?.[0]}
          >
            <Input
              id="edit_legal_name"
              name="legal_name"
              value={formData.legal_name}
              onChange={handleChange}
              disabled={!canEdit || isPending}
              required
            />
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
            <Field
              id="edit_gst_number"
              label="GSTIN"
              errorMessage={fieldErrors["gst_number"]?.[0]}
              helperText="15-character statutory tax ID"
            >
              <Input
                id="edit_gst_number"
                name="gst_number"
                value={formData.gst_number}
                onChange={handleChange}
                maxLength={15}
                disabled={!canEdit || isPending}
              />
            </Field>

            <Field
              id="edit_pan_number"
              label="PAN"
              errorMessage={fieldErrors["pan_number"]?.[0]}
              helperText="10-character PAN"
            >
              <Input
                id="edit_pan_number"
                name="pan_number"
                value={formData.pan_number}
                onChange={handleChange}
                maxLength={10}
                disabled={!canEdit || isPending}
              />
            </Field>
          </div>

          <Field id="edit_status" label="Business Status" helperText="Lifecycle state of the store">
            <select
              id="edit_status"
              name="status"
              value={formData.status}
              onChange={handleChange}
              disabled={!canEdit || isPending}
              style={{
                width: "100%",
                padding: "var(--space-2) var(--space-3)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--color-border)",
                backgroundColor: "var(--color-surface)",
                color: "var(--color-text-primary)",
                fontSize: "var(--font-size-body)",
              }}
            >
              <option value="active">Active</option>
              <option value="onboarding">Onboarding</option>
              <option value="suspended">Suspended</option>
              <option value="archived">Archived</option>
            </select>
          </Field>

          {canEdit && (
            <div
              style={{ display: "flex", justifyContent: "flex-end", marginTop: "var(--space-2)" }}
            >
              <Button type="submit" variant="primary" isLoading={isPending}>
                Save Changes
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
