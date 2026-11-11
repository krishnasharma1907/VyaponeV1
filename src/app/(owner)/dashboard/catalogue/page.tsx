import React from "react";
import type { Metadata } from "next";
import { Card, CardContent, Button, EmptyState } from "@/components/ui";

export const metadata: Metadata = {
  title: "Products & Catalogue — Business Owner | VyapOne",
  description:
    "Manage products, services, inventory levels, variants, and statutory GST tax rates.",
};

export default function OwnerCataloguePage() {
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
            Products &amp; Services
          </h1>
          <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--font-size-body)" }}>
            Configure item prices, stock thresholds, variants, and HSN/SAC statutory tax slabs.
          </p>
        </div>
        <Button variant="primary">Add Product</Button>
      </header>

      <Card variant="default">
        <CardContent style={{ padding: "var(--space-6)" }}>
          <EmptyState
            title="Catalogue Directory"
            description="Products, barcode SKU assignments, and service package tables will be managed here."
            action={<Button size="sm">Create First Item</Button>}
          />
        </CardContent>
      </Card>
    </div>
  );
}
