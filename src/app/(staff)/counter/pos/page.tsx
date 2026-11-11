import React from "react";
import type { Metadata } from "next";
import { Card, CardContent, Button, EmptyState } from "@/components/ui";

export const metadata: Metadata = {
  title: "Fast POS Punch — Staff Counter | VyapOne",
  description: "Touch-friendly rapid item punching and instant UPI QR / cash billing.",
};

export default function StaffCounterPOSPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: "var(--font-size-h2)", color: "var(--color-text-primary)" }}>
          Fast Billing Terminal
        </h1>
        <Button variant="accent">Print Bill (F2)</Button>
      </header>

      <Card variant="default">
        <CardContent style={{ padding: "var(--space-6)" }}>
          <EmptyState
            title="Active Bill Cart &amp; SKU Scanner"
            description="Numeric keypad, barcode scanning listener, and dynamic dynamic UPI QR generation will be mounted here."
            action={<Button size="sm">Add Quick Item</Button>}
          />
        </CardContent>
      </Card>
    </div>
  );
}
