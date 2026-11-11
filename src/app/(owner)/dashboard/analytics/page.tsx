import React from "react";
import type { Metadata } from "next";
import { Card, CardContent, Button, EmptyState } from "@/components/ui";

export const metadata: Metadata = {
  title: "Analytics & Trends — Business Owner | VyapOne",
  description: "Privacy-preserving store performance, QR scan rates, and category sales trends.",
};

export default function OwnerAnalyticsPage() {
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
          Store Insights &amp; Analytics
        </h1>
        <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--font-size-body)" }}>
          Privacy-coarse aggregates, peak hours, top-selling items, and QR standee scan volumes.
        </p>
      </header>

      <Card variant="default">
        <CardContent style={{ padding: "var(--space-6)" }}>
          <EmptyState
            title="Performance Trends"
            description="Aggregated GMV charts, category breakdown, and repeat customer ratios will be rendered here."
            action={
              <Button size="sm" variant="outline">
                Export Monthly Report
              </Button>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
