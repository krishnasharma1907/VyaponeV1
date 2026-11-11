import React from "react";
import type { Metadata } from "next";
import { Card, CardContent, Button, EmptyState, Badge } from "@/components/ui";

export const metadata: Metadata = {
  title: "GST Billing & Invoices — Business Owner | VyapOne",
  description:
    "Sequential gap-free GST tax invoice generation, sequence counters, and e-way bill export.",
};

export default function OwnerBillingPage() {
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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
              marginBottom: "var(--space-1)",
            }}
          >
            <h1 style={{ fontSize: "var(--font-size-h1)", color: "var(--color-text-primary)" }}>
              GST Invoices &amp; Bills
            </h1>
            <Badge variant="info">Billing Shell</Badge>
          </div>
          <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--font-size-body)" }}>
            Generate gap-free sequential invoices per Indian statutory rules with verified payment
            status.
          </p>
        </div>
        <Button variant="accent" disabled>
          Generate Invoice (VO-081)
        </Button>
      </header>

      <Card variant="default">
        <CardContent style={{ padding: "var(--space-6)" }}>
          <EmptyState
            title="Invoice History &amp; Sequences"
            description="Sequential tax invoices, credit notes, and GSTR-1 monthly sales summaries will be managed here."
            action={
              <Button size="sm" disabled>
                Invoice Sequencing Offline (VO-081)
              </Button>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
