import React from "react";
import type { Metadata } from "next";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  EmptyState,
  Badge,
} from "@/components/ui";

export const metadata: Metadata = {
  title: "Wholesale Billing — Reseller Workspace | VyapOne",
  description: "Wholesale invoices, revenue share, and payout schedules.",
};

export default function ResellerBillingPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <header>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            marginBottom: "var(--space-1)",
          }}
        >
          <h1
            style={{
              fontSize: "var(--font-size-h1)",
              color: "var(--color-text-primary)",
            }}
          >
            Wholesale Billing &amp; Payouts
          </h1>
          <Badge variant="info">Billing Shell</Badge>
        </div>
        <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--font-size-body)" }}>
          Review monthly wholesale platform invoices and split settlement credits.
        </p>
      </header>

      <Card variant="default">
        <CardHeader>
          <CardTitle as="h2">Settlement Statements</CardTitle>
          <CardDescription>Automated monthly split payouts and wholesale invoices</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="No Statements Available"
            description="Monthly wholesale subscription invoices and split settlement reports will appear here once active client businesses are onboarded."
            action={
              <Button size="sm" variant="outline" disabled>
                Statements Offline (Phase P8 / VO-085)
              </Button>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
