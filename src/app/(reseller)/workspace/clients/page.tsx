import React from "react";
import type { Metadata } from "next";
import { Card, CardContent, Button, EmptyState } from "@/components/ui";

export const metadata: Metadata = {
  title: "Client Businesses — Reseller Workspace | VyapOne",
  description: "Directory of merchant businesses managed by your agency.",
};

export default function ResellerClientsPage() {
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
            Client Businesses
          </h1>
          <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--font-size-body)" }}>
            Manage merchant stores, access delegated administration, and configure plans.
          </p>
        </div>
        <Button variant="primary">Add New Client</Button>
      </header>

      <Card variant="default">
        <CardContent style={{ padding: "var(--space-6)" }}>
          <EmptyState
            title="Managed Client Directory"
            description="Client business roster with delegated access switches and status indicators will be listed here."
            action={<Button size="sm">Provision First Merchant</Button>}
          />
        </CardContent>
      </Card>
    </div>
  );
}
