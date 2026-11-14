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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui";
import { updateBusinessProfileAction, confirmBusinessFactAction } from "@/lib/businesses/actions";
import type {
  BusinessRole,
  BusinessRow,
  BusinessStatus,
  BusinessTaxScheme,
  ContactConfiguration,
  AddressConfiguration,
  TimingsConfiguration,
  FactsProvenanceMap,
} from "@/lib/businesses/types";
import { hasBusinessPermission } from "@/lib/businesses/permissions";

interface BusinessProfileFormProps {
  business: BusinessRow;
  currentUserRole: BusinessRole;
  isSovereignOwner: boolean;
  onSuccess?: (updated: BusinessRow) => void;
}

const DAYS_OF_WEEK = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

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
  const [activeTab, setActiveTab] = useState<string>("identity");

  const canEdit =
    isSovereignOwner || hasBusinessPermission(currentUserRole, "business:update_profile");

  const initialContacts = (business.contact_configuration ?? {}) as unknown as ContactConfiguration;
  const initialAddress = (business.address_configuration ?? {}) as unknown as AddressConfiguration;
  const initialTimings = (business.timings_configuration ?? {}) as unknown as TimingsConfiguration;
  const [provenance, setProvenance] = useState<FactsProvenanceMap>(
    (business.facts_provenance ?? {}) as unknown as FactsProvenanceMap,
  );

  const [formData, setFormData] = useState({
    trade_name: business.trade_name,
    legal_name: business.legal_name,
    category: business.category ?? "retail",
    description: business.description ?? "",
    gst_number: business.gst_number ?? "",
    pan_number: business.pan_number ?? "",
    tax_scheme: (business.tax_scheme ?? "unregistered") as BusinessTaxScheme,
    status: business.status as BusinessStatus,
    currency_code: business.currency_code ?? "INR",
    preferred_language: business.preferred_language ?? "en",
    timezone: business.timezone ?? "Asia/Kolkata",
    // Contacts
    primary_phone: initialContacts.primary_phone ?? "",
    secondary_phone: initialContacts.secondary_phone ?? "",
    whatsapp_number: initialContacts.whatsapp_number ?? "",
    email: initialContacts.email ?? "",
    website: initialContacts.website ?? "",
    // Address
    address_line1: initialAddress.address_line1 ?? "",
    address_line2: initialAddress.address_line2 ?? "",
    city: initialAddress.city ?? "",
    state: initialAddress.state ?? "",
    postal_code: initialAddress.postal_code ?? "",
    country: initialAddress.country ?? "India",
    // Timings
    timings: initialTimings,
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
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

  const handleTimingChange = (
    day: (typeof DAYS_OF_WEEK)[number],
    field: "open" | "close" | "closed",
    value: string | boolean,
  ) => {
    setFormData((prev) => ({
      ...prev,
      timings: {
        ...prev.timings,
        [day]: {
          ...prev.timings[day],
          [field]: value,
        },
      },
    }));
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
        category: formData.category || null,
        description: formData.description || null,
        gst_number: formData.gst_number ? formData.gst_number : null,
        pan_number: formData.pan_number ? formData.pan_number : null,
        tax_scheme: formData.tax_scheme,
        status: formData.status,
        currency_code: formData.currency_code,
        preferred_language: formData.preferred_language,
        timezone: formData.timezone,
        contact_configuration: {
          primary_phone: formData.primary_phone || null,
          secondary_phone: formData.secondary_phone || null,
          whatsapp_number: formData.whatsapp_number || null,
          email: formData.email || null,
          website: formData.website || null,
        },
        address_configuration: {
          address_line1: formData.address_line1 || null,
          address_line2: formData.address_line2 || null,
          city: formData.city || null,
          state: formData.state || null,
          postal_code: formData.postal_code || null,
          country: formData.country || "India",
        },
        timings_configuration: formData.timings,
      });

      if (!result.success) {
        setError(result.error);
        if (result.validationErrors) {
          setFieldErrors(result.validationErrors);
        }
        return;
      }

      setSuccessMessage("Business details updated successfully");
      if (result.data.facts_provenance) {
        setProvenance(result.data.facts_provenance as unknown as FactsProvenanceMap);
      }
      if (onSuccess) {
        onSuccess(result.data);
      }
    });
  };

  const handleToggleFactConfirmation = (fieldKey: string, currentStatus: boolean) => {
    if (!canEdit) return;
    setError(null);
    setSuccessMessage(null);

    startTransition(async () => {
      const result = await confirmBusinessFactAction(business.id, {
        field: fieldKey,
        confirmed: !currentStatus,
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      const updatedMap = (result.data.facts_provenance ?? {}) as unknown as FactsProvenanceMap;
      setProvenance(updatedMap);
      setSuccessMessage(
        !currentStatus
          ? `Fact '${fieldKey}' successfully confirmed with audit trail.`
          : `Fact '${fieldKey}' marked as unverified.`,
      );
      if (onSuccess) {
        onSuccess(result.data);
      }
    });
  };

  const sensitiveFacts = [
    {
      key: "trade_name",
      label: "Trade Name",
      value: formData.trade_name,
    },
    {
      key: "gst_number",
      label: "GSTIN Tax Identity",
      value: formData.gst_number || "Not registered",
    },
    {
      key: "pan_number",
      label: "PAN Tax Identity",
      value: formData.pan_number || "Not provided",
    },
    {
      key: "registered_address",
      label: "Official Address",
      value: formData.address_line1
        ? `${formData.address_line1}, ${formData.city}, ${formData.state} — ${formData.postal_code}`
        : "Not configured",
    },
    {
      key: "primary_contact",
      label: "Primary Phone & WhatsApp",
      value: formData.primary_phone || formData.whatsapp_number || "Not configured",
    },
    {
      key: "operating_timings",
      label: "Store Operating Schedule",
      value: "Standard 7-Day Schedule",
    },
  ];

  return (
    <Card variant="default">
      <CardHeader>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "var(--space-2)",
          }}
        >
          <div>
            <CardTitle as="h2">Store Identity &amp; Statutory Details</CardTitle>
            <CardDescription>
              Manage trade identity, statutory GST registration, timings, address, and confirmed
              facts.
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
        {error && (
          <div
            role="alert"
            style={{
              padding: "var(--space-3)",
              marginBottom: "var(--space-4)",
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
              marginBottom: "var(--space-4)",
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

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList style={{ marginBottom: "var(--space-4)", flexWrap: "wrap" }}>
            <TabsTrigger value="identity">Store Identity</TabsTrigger>
            <TabsTrigger value="statutory">Tax &amp; Legal</TabsTrigger>
            <TabsTrigger value="address">Address &amp; Contacts</TabsTrigger>
            <TabsTrigger value="timings">Timings &amp; Locale</TabsTrigger>
            <TabsTrigger value="provenance">Verified Facts</TabsTrigger>
          </TabsList>

          <form onSubmit={handleSubmit} noValidate>
            {/* TAB 1: STORE IDENTITY */}
            <TabsContent value="identity">
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                <Field
                  id="edit_trade_name"
                  label="Trade Name"
                  required
                  errorMessage={fieldErrors["trade_name"]?.[0]}
                  helperText="Public brand name visible to customers"
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
                  label="Legal Entity Name"
                  required
                  errorMessage={fieldErrors["legal_name"]?.[0]}
                  helperText="Official registered legal entity name"
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

                <div
                  style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}
                >
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

                <div
                  style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}
                >
                  <Field
                    id="edit_category"
                    label="Business Category / Niche"
                    errorMessage={fieldErrors["category"]?.[0]}
                  >
                    <select
                      id="edit_category"
                      name="category"
                      value={formData.category}
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
                      <option value="retail">Retail Store</option>
                      <option value="grocery">Kirana &amp; Grocery</option>
                      <option value="restaurant">Restaurant / Cafe</option>
                      <option value="salon">Salon &amp; Spa</option>
                      <option value="services">Professional Services</option>
                      <option value="healthcare">Healthcare &amp; Clinic</option>
                      <option value="education">Coaching &amp; Tuition</option>
                      <option value="other">Other Business</option>
                    </select>
                  </Field>

                  <Field id="edit_status" label="Business Lifecycle Status">
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
                </div>

                <Field
                  id="edit_description"
                  label="Business Description"
                  errorMessage={fieldErrors["description"]?.[0]}
                  helperText="Brief summary used by Vya and storefront copy"
                >
                  <textarea
                    id="edit_description"
                    name="description"
                    rows={3}
                    value={formData.description}
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
                      fontFamily: "inherit",
                    }}
                  />
                </Field>
              </div>
            </TabsContent>

            {/* TAB 2: STATUTORY & TAX IDENTITY */}
            <TabsContent value="statutory">
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                <Field
                  id="edit_tax_scheme"
                  label="GST Tax Scheme"
                  helperText="Statutory taxation regime applicable to this store"
                >
                  <select
                    id="edit_tax_scheme"
                    name="tax_scheme"
                    value={formData.tax_scheme}
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
                    <option value="unregistered">Unregistered (Below GST threshold)</option>
                    <option value="registered">Regular GST Registered</option>
                    <option value="composition">GST Composition Scheme</option>
                    <option value="exempt">Exempt Supplies Only</option>
                  </select>
                </Field>

                <div
                  style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}
                >
                  <Field
                    id="edit_gst_number"
                    label="GSTIN (15 characters)"
                    errorMessage={fieldErrors["gst_number"]?.[0]}
                    helperText="e.g., 29AAAAA0000A1Z5"
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
                    label="Permanent Account Number (PAN)"
                    errorMessage={fieldErrors["pan_number"]?.[0]}
                    helperText="e.g., AAAAA0000A"
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
              </div>
            </TabsContent>

            {/* TAB 3: ADDRESS & CONTACTS */}
            <TabsContent value="address">
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                <h3 style={{ fontSize: "var(--font-size-h3)", color: "var(--color-text-primary)" }}>
                  Registered Store Address
                </h3>
                <Field
                  id="edit_address_line1"
                  label="Address Line 1"
                  errorMessage={fieldErrors["address_configuration.address_line1"]?.[0]}
                >
                  <Input
                    id="edit_address_line1"
                    name="address_line1"
                    value={formData.address_line1}
                    onChange={handleChange}
                    disabled={!canEdit || isPending}
                  />
                </Field>

                <Field
                  id="edit_address_line2"
                  label="Address Line 2 (Optional)"
                  errorMessage={fieldErrors["address_configuration.address_line2"]?.[0]}
                >
                  <Input
                    id="edit_address_line2"
                    name="address_line2"
                    value={formData.address_line2}
                    onChange={handleChange}
                    disabled={!canEdit || isPending}
                  />
                </Field>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    gap: "var(--space-3)",
                  }}
                >
                  <Field
                    id="edit_city"
                    label="City"
                    errorMessage={fieldErrors["address_configuration.city"]?.[0]}
                  >
                    <Input
                      id="edit_city"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      disabled={!canEdit || isPending}
                    />
                  </Field>
                  <Field
                    id="edit_state"
                    label="State"
                    errorMessage={fieldErrors["address_configuration.state"]?.[0]}
                  >
                    <Input
                      id="edit_state"
                      name="state"
                      value={formData.state}
                      onChange={handleChange}
                      disabled={!canEdit || isPending}
                    />
                  </Field>
                  <Field
                    id="edit_postal_code"
                    label="PIN Code (6 digits)"
                    errorMessage={fieldErrors["address_configuration.postal_code"]?.[0]}
                  >
                    <Input
                      id="edit_postal_code"
                      name="postal_code"
                      value={formData.postal_code}
                      onChange={handleChange}
                      maxLength={6}
                      disabled={!canEdit || isPending}
                    />
                  </Field>
                </div>

                <h3
                  style={{
                    fontSize: "var(--font-size-h3)",
                    color: "var(--color-text-primary)",
                    marginTop: "var(--space-2)",
                  }}
                >
                  Contact Channels
                </h3>

                <div
                  style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}
                >
                  <Field
                    id="edit_primary_phone"
                    label="Primary Phone"
                    errorMessage={fieldErrors["contact_configuration.primary_phone"]?.[0]}
                  >
                    <Input
                      id="edit_primary_phone"
                      name="primary_phone"
                      value={formData.primary_phone}
                      onChange={handleChange}
                      disabled={!canEdit || isPending}
                    />
                  </Field>
                  <Field
                    id="edit_whatsapp_number"
                    label="WhatsApp Business Number"
                    errorMessage={fieldErrors["contact_configuration.whatsapp_number"]?.[0]}
                  >
                    <Input
                      id="edit_whatsapp_number"
                      name="whatsapp_number"
                      value={formData.whatsapp_number}
                      onChange={handleChange}
                      disabled={!canEdit || isPending}
                    />
                  </Field>
                </div>

                <div
                  style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}
                >
                  <Field
                    id="edit_email"
                    label="Official Email"
                    errorMessage={fieldErrors["contact_configuration.email"]?.[0]}
                  >
                    <Input
                      id="edit_email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleChange}
                      disabled={!canEdit || isPending}
                    />
                  </Field>
                  <Field
                    id="edit_website"
                    label="Existing Website (Optional)"
                    errorMessage={fieldErrors["contact_configuration.website"]?.[0]}
                  >
                    <Input
                      id="edit_website"
                      name="website"
                      value={formData.website}
                      onChange={handleChange}
                      disabled={!canEdit || isPending}
                    />
                  </Field>
                </div>
              </div>
            </TabsContent>

            {/* TAB 4: TIMINGS & LOCALE */}
            <TabsContent value="timings">
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    gap: "var(--space-3)",
                  }}
                >
                  <Field id="edit_language" label="Primary Language">
                    <select
                      id="edit_language"
                      name="preferred_language"
                      value={formData.preferred_language}
                      onChange={handleChange}
                      disabled={!canEdit || isPending}
                      style={{
                        width: "100%",
                        padding: "var(--space-2) var(--space-3)",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--color-border)",
                        backgroundColor: "var(--color-surface)",
                        color: "var(--color-text-primary)",
                      }}
                    >
                      <option value="en">English (en)</option>
                      <option value="hi">Hindi (हिन्दी)</option>
                      <option value="ta">Tamil (தமிழ்)</option>
                      <option value="te">Telugu (తెలుగు)</option>
                      <option value="mr">Marathi (मराठी)</option>
                      <option value="gu">Gujarati (ગુજરાતી)</option>
                      <option value="kn">Kannada (ಕನ್ನಡ)</option>
                      <option value="bn">Bengali (বাংলা)</option>
                    </select>
                  </Field>

                  <Field id="edit_timezone" label="Timezone">
                    <select
                      id="edit_timezone"
                      name="timezone"
                      value={formData.timezone}
                      onChange={handleChange}
                      disabled={!canEdit || isPending}
                      style={{
                        width: "100%",
                        padding: "var(--space-2) var(--space-3)",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--color-border)",
                        backgroundColor: "var(--color-surface)",
                        color: "var(--color-text-primary)",
                      }}
                    >
                      <option value="Asia/Kolkata">Asia/Kolkata (IST +5:30)</option>
                      <option value="UTC">UTC (+0:00)</option>
                    </select>
                  </Field>

                  <Field id="edit_currency" label="Currency">
                    <Input
                      id="edit_currency"
                      name="currency_code"
                      value={formData.currency_code}
                      disabled
                    />
                  </Field>
                </div>

                <h3
                  style={{
                    fontSize: "var(--font-size-h3)",
                    color: "var(--color-text-primary)",
                    marginTop: "var(--space-2)",
                  }}
                >
                  Weekly Operating Timings
                </h3>

                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                  {DAYS_OF_WEEK.map((day) => {
                    const dayData = formData.timings[day] ?? {
                      open: "09:00",
                      close: "21:00",
                      closed: false,
                    };
                    return (
                      <div
                        key={day}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "120px 1fr 1fr 100px",
                          gap: "var(--space-3)",
                          alignItems: "center",
                          padding: "var(--space-2)",
                          borderRadius: "var(--radius-sm)",
                          backgroundColor: "var(--color-surface-subtle)",
                        }}
                      >
                        <span style={{ fontWeight: 600, textTransform: "capitalize" }}>{day}</span>
                        <Input
                          type="time"
                          value={dayData.open ?? "09:00"}
                          disabled={!canEdit || isPending || dayData.closed}
                          onChange={(e) => handleTimingChange(day, "open", e.target.value)}
                        />
                        <Input
                          type="time"
                          value={dayData.close ?? "21:00"}
                          disabled={!canEdit || isPending || dayData.closed}
                          onChange={(e) => handleTimingChange(day, "close", e.target.value)}
                        />
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "var(--space-1)",
                            fontSize: "var(--font-size-body-sm)",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={!!dayData.closed}
                            disabled={!canEdit || isPending}
                            onChange={(e) => handleTimingChange(day, "closed", e.target.checked)}
                          />
                          Closed
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            </TabsContent>

            {/* TAB 5: SENSITIVE FACTS PROVENANCE */}
            <TabsContent value="provenance">
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                <p
                  style={{
                    color: "var(--color-text-secondary)",
                    fontSize: "var(--font-size-body-sm)",
                    marginBottom: "var(--space-2)",
                  }}
                >
                  Sensitive statutory business facts are tracked with cryptographic provenance. Once
                  verified by the merchant owner, facts are locked into Vya assistant workflows and
                  GST invoicing.
                </p>

                {sensitiveFacts.map((fact) => {
                  const factInfo = provenance[fact.key];
                  const isConfirmed = !!factInfo?.confirmed;
                  return (
                    <div
                      key={fact.key}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "var(--space-3)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "var(--radius-md)",
                        backgroundColor: "var(--color-surface)",
                        flexWrap: "wrap",
                        gap: "var(--space-2)",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: "200px" }}>
                        <div
                          style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}
                        >
                          <span style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>
                            {fact.label}
                          </span>
                          <Badge variant={isConfirmed ? "success" : "default"}>
                            {isConfirmed ? "VERIFIED FACT" : "PROPOSED / UNCONFIRMED"}
                          </Badge>
                        </div>
                        <p
                          style={{
                            margin: "var(--space-1) 0 0",
                            color: "var(--color-text-secondary)",
                            fontSize: "var(--font-size-body-sm)",
                          }}
                        >
                          {fact.value}
                        </p>
                        {factInfo?.confirmed_at && (
                          <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
                            Confirmed on {new Date(factInfo.confirmed_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>

                      {canEdit && (
                        <Button
                          type="button"
                          variant={isConfirmed ? "outline" : "primary"}
                          onClick={() => handleToggleFactConfirmation(fact.key, isConfirmed)}
                          disabled={isPending}
                        >
                          {isConfirmed ? "Mark Unverified" : "Confirm Fact"}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </TabsContent>

            {/* FORM FOOTER ACTIONS */}
            {canEdit && activeTab !== "provenance" && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  marginTop: "var(--space-4)",
                  paddingTop: "var(--space-3)",
                  borderTop: "1px solid var(--color-border)",
                }}
              >
                <Button type="submit" variant="primary" isLoading={isPending}>
                  Save Changes
                </Button>
              </div>
            )}
          </form>
        </Tabs>
      </CardContent>
    </Card>
  );
}
