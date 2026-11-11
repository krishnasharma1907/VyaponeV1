import React from "react";
import type { Metadata } from "next";
import { Card, CardContent, Button, EmptyState } from "@/components/ui";

export const metadata: Metadata = {
  title: "Plan Tiers & Quotas — Platform Administration | VyapOne",
  description:
    "Configure master plan entitlements, published website limits, and staff seat quotas.",
};

export default function AdminPlansPage() {
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
            Master Plan Tiers &amp; Quotas
          </h1>
          <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--font-size-body)" }}>
            Configure feature entitlements, website-slot counts, and storage quotas enforced
            server-side.
          </p>
        </div>
        <Button variant="primary">Create Plan Tier</Button>
      </header>

      <Card variant="default">
        <CardContent style={{ padding: "var(--space-6)" }}>
          <EmptyState
            title="Subscription Tiers &amp; Entitlements"
            description="Master plan configurations (Free Starter, Standard Retail, Pro Multi-Location, Enterprise Agency) will be managed here."
            action={<Button size="sm">Configure Plan Matrix</Button>}
          />
        </CardContent>
      </Card>
    </div>
  );
}
