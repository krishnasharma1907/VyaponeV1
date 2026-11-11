import React from "react";
import type { Metadata } from "next";
import { Card, CardContent, Button, EmptyState } from "@/components/ui";

export const metadata: Metadata = {
  title: "Orders & Fulfillment — Business Owner | VyapOne",
  description: "Track online store orders, delivery dispatches, and in-store pickups.",
};

export default function OwnerOrdersPage() {
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
            Orders &amp; Fulfillment
          </h1>
          <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--font-size-body)" }}>
            Process customer orders received from your storefront and WhatsApp checkout.
          </p>
        </div>
      </header>

      <Card variant="default">
        <CardContent style={{ padding: "var(--space-6)" }}>
          <EmptyState
            title="Order Fulfillment Kanban"
            description="Live orders with statuses (Claimed, Received, Verified Paid, Dispatched) will appear here."
            action={
              <Button size="sm" variant="secondary" disabled>
                Orders Pipeline Offline (VO-062)
              </Button>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
