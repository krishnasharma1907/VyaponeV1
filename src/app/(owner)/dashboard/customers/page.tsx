import React from "react";
import type { Metadata } from "next";
import { Card, CardContent, Button, EmptyState } from "@/components/ui";

export const metadata: Metadata = {
  title: "Customers & Khata — Business Owner | VyapOne",
  description:
    "Customer directory, Udhaar balances, credit limits, and DPDP marketing consent records.",
};

export default function OwnerCustomersPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "var(--space-4)",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "var(--font-size-h1)",
              color: "var(--color-text-primary)",
              marginBottom: "var(--space-1)",
            }}
          >
            Customers &amp; Khata
          </h1>
          <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--font-size-body)" }}>
            Maintain customer relationships, track credit ledger (udhaar), and record opt-in
            consent.
          </p>
        </div>
        <Button variant="primary">Add Customer</Button>
      </header>

      <Card variant="default">
        <CardContent style={{ padding: "var(--space-6)" }}>
          <EmptyState
            title="Customer Directory"
            description="Customers with verified mobile numbers, Udhaar ledgers, and WhatsApp consent flags will be displayed here."
            action={<Button size="sm">Add Customer Profile</Button>}
          />
        </CardContent>
      </Card>
    </div>
  );
}
