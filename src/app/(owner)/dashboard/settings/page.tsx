import React from "react";
import type { Metadata } from "next";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Field,
  Input,
  Button,
} from "@/components/ui";

export const metadata: Metadata = {
  title: "Business Settings — Business Owner | VyapOne",
  description: "Business profile, GSTIN, UPI VPAs, store locations, and staff access PINs.",
};

export default function OwnerSettingsPage() {
  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", maxWidth: "800px" }}
    >
      <header>
        <h1
          style={{
            fontSize: "var(--font-size-h1)",
            color: "var(--color-text-primary)",
            marginBottom: "var(--space-1)",
          }}
        >
          Business &amp; Statutory Settings
        </h1>
        <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--font-size-body)" }}>
          Manage sovereign merchant facts, verified GST identity, and bank account VPAs.
        </p>
      </header>

      <Card variant="default">
        <CardHeader>
          <CardTitle as="h2">Store Identity</CardTitle>
          <CardDescription>Legal trade name and tax registration</CardDescription>
        </CardHeader>
        <CardContent>
          <form style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <Field id="biz-name" label="Trade Name" required>
              <Input placeholder="e.g., Sharma Kirana & Sweets" disabled />
            </Field>
            <Field
              id="biz-gstin"
              label="GSTIN (15-character statutory tax ID)"
              helperText="Server verified against GST portal (Phase P2 / VO-023)"
            >
              <Input placeholder="e.g., 27AAAAA0000A1Z5" disabled />
            </Field>
            <Field
              id="biz-upi"
              label="UPI VPA (Direct Merchant Bank Settlement)"
              helperText="Payments settle directly to your verified bank account (Phase P8 / VO-083)"
            >
              <Input placeholder="e.g., merchant@bank" disabled />
            </Field>
            <div>
              <Button type="button" variant="primary" disabled>
                Save Configuration
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card variant="default">
        <CardHeader>
          <CardTitle as="h2">Primary Store Location</CardTitle>
          <CardDescription>
            Physical address, pin code, and fulfillment coordinates for this store.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <Field id="loc-name-display" label="Location Name">
              <Input value="Main Store" disabled />
            </Field>
            <Field id="loc-addr-display" label="Address">
              <Input value="100 MG Road, Bengaluru, Karnataka — 560001" disabled />
            </Field>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
