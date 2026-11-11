import React from "react";
import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Badge,
} from "@/components/ui";

export default function ResellerOverviewPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <header>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            marginBottom: "var(--space-2)",
          }}
        >
          <h1
            style={{
              fontSize: "var(--font-size-h1)",
              color: "var(--color-text-primary)",
            }}
          >
            Agency Workspace Overview
          </h1>
          <Badge variant="info">Reseller Shell</Badge>
        </div>
        <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--font-size-body)" }}>
          Manage onboarded merchants, provision new websites, and review recurring commission
          settlements.
        </p>
      </header>

      {/* Metrics Row Placeholder */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "var(--space-4)",
        }}
      >
        <Card variant="elevated">
          <CardHeader>
            <CardDescription>Managed Businesses</CardDescription>
            <CardTitle as="h2">-- Active Stores</CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/workspace/clients" style={{ textDecoration: "none" }}>
              <Button size="sm" variant="outline">
                View Clients
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card variant="elevated">
          <CardHeader>
            <CardDescription>Wholesale Commission</CardDescription>
            <CardTitle as="h2">-- / mo</CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/workspace/billing" style={{ textDecoration: "none" }}>
              <Button size="sm" variant="outline">
                View Payouts
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card variant="elevated">
          <CardHeader>
            <CardDescription>Agency Domain</CardDescription>
            <CardTitle as="h2">-- (Offline)</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="default">CNAME Not Configured</Badge>
          </CardContent>
        </Card>
      </div>

      <Card variant="default">
        <CardHeader>
          <CardTitle as="h3">Quick Actions</CardTitle>
          <CardDescription>
            Agency onboarding and staffing actions connect in Phase P11
          </CardDescription>
        </CardHeader>
        <CardContent style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
          <Button variant="primary" disabled>
            Provision Client Business (VO-110)
          </Button>
          <Button variant="secondary" disabled>
            Invite Agency Staff (VO-110)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
