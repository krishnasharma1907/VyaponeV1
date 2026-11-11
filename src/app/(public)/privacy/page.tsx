import React from "react";
import type { Metadata } from "next";
import { Card, CardHeader, CardTitle, CardContent, Badge } from "@/components/ui";

export const metadata: Metadata = {
  title: "Privacy Policy & Grievance Redressal (Draft) — VyapOne",
  description:
    "VyapOne customer data protection architecture, DPDP Act 2023 principles, and Grievance Officer placeholder.",
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            marginBottom: "var(--space-2)",
          }}
        >
          <h1
            style={{
              fontSize: "var(--font-size-h1)",
              color: "var(--color-text-primary)",
            }}
          >
            Privacy Policy &amp; Grievance Redressal
          </h1>
          <Badge variant="warning">Draft Template &bull; Pending Legal Review</Badge>
        </div>
        <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--font-size-body)" }}>
          Digital Personal Data Protection (DPDP) Act 2023 architectural principles and draft tenant
          privacy disclosure.
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
            VyapOne is engineered around data fiduciary and processor separation for independent
            Indian merchants. Merchant customer data, transaction records, and GST billing sequences
            belong strictly to the owning business tenant.
          </p>
          <p>
            Customer phone numbers, purchase histories, and WhatsApp messaging consent logs are
            architected for isolation via PostgreSQL Row-Level Security (RLS) and will never be
            sold, cross-shared between competing merchants, or used to train public AI models.
          </p>
        </CardContent>
      </Card>

      <Card variant="default">
        <CardHeader>
          <CardTitle as="h2">Grievance Redressal Desk (Placeholder)</CardTitle>
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
            In accordance with the Information Technology Act 2000 and the DPDP Act 2023, data
            principals will have access to a designated Grievance Redressal Officer upon corporate
            registration:
          </p>
          <p>
            <strong>Grievance Redressal Desk:</strong>{" "}
            <code>
              [Contact email pending official entity registration &mdash; e.g.
              grievance-desk-pending-registration@vyapone.in]
            </code>
          </p>
          <p>
            <em>Notice:</em> Official corporate legal entity details, physical registered office
            address, and formally appointed Data Protection Officer credentials are subject to
            formal legal review and incorporation. This page serves as a route shell and
            architectural placeholder.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
