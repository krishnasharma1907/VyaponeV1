import React from "react";
import type { Metadata } from "next";
import { Card, CardContent, Button, EmptyState } from "@/components/ui";

export const metadata: Metadata = {
  title: "Tenant Inspector — Platform Administration | VyapOne",
  description: "Global registry of business tenants, reseller hierarchy, and isolation audits.",
};

export default function AdminTenantsPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <header>
        <h1
          style={{
            fontSize: "var(--font-size-h1)",
            color: "var(--color-text-primary)",
            marginBottom: "var(--space-1)",
          }}
        >
          Global Tenant Inspector
        </h1>
        <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--font-size-body)" }}>
          Audit tenant hierarchies (Platform &rarr; Reseller Workspace &rarr; Business &rarr;
          Location) and storage quotas.
        </p>
      </header>

      <Card variant="default">
        <CardContent style={{ padding: "var(--space-6)" }}>
          <EmptyState
            title="Multi-Tenant Registry"
            description="Tenant lookup by sovereign business ID, GSTIN, or owning reseller workspace will be rendered here."
            action={<Button size="sm">Search Tenants</Button>}
          />
        </CardContent>
      </Card>
    </div>
  );
}
