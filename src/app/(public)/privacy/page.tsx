import React from "react";
import type { Metadata } from "next";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui";

export const metadata: Metadata = {
  title: "Privacy Policy & Grievance Redressal — VyapOne",
  description:
    "VyapOne customer data protection, DPDP Act 2023 compliance, and Grievance Officer details.",
};

export default function PrivacyPolicyPage() {
  return (
    <div
      style={{
        maxWidth: "800px",
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-6)",
      }}
    >
      <header>
        <h1
          style={{
            fontSize: "var(--font-size-h1)",
            color: "var(--color-text-primary)",
            marginBottom: "var(--space-2)",
          }}
        >
          Privacy Policy &amp; Grievance Redressal
        </h1>
        <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--font-size-body)" }}>
          Digital Personal Data Protection (DPDP) Act 2023 compliance and tenant privacy notice.
        </p>
      </header>

      <Card variant="default">
        <CardHeader>
          <CardTitle as="h2">Sovereign Data Ownership</CardTitle>
        </CardHeader>
        <CardContent
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-3)",
            fontSize: "var(--font-size-body-sm)",
            color: "var(--color-text-secondary)",
          }}
        >
          <p>
            VyapOne operates as a technical data fiduciary and processor for independent Indian
            merchants. Merchant customer data, transaction records, and GST billing sequences belong
            strictly to the owning business tenant.
          </p>
          <p>
            Customer phone numbers, purchase histories, and WhatsApp messaging consent logs are
            protected by PostgreSQL Row-Level Security (RLS) and never sold, cross-shared between
            competing merchants, or used to train public AI models.
          </p>
        </CardContent>
      </Card>

      <Card variant="default">
        <CardHeader>
          <CardTitle as="h2">Grievance Redressal Officer</CardTitle>
        </CardHeader>
        <CardContent
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-2)",
            fontSize: "var(--font-size-body-sm)",
            color: "var(--color-text-secondary)",
          }}
        >
          <p>
            In compliance with the Information Technology Act 2000 and the DPDP Act 2023, data
            principals may direct redressal enquiries to:
          </p>
          <p>
            <strong>Grievance Redressal Desk:</strong> <code>grievance@vyapone.in</code>
          </p>
          <p>Response window: Within 72 statutory working hours.</p>
        </CardContent>
      </Card>
    </div>
  );
}
