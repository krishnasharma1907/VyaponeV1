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
        <h1
          style={{
            fontSize: "var(--font-size-h1)",
            color: "var(--color-text-primary)",
            marginBottom: "var(--space-2)",
          }}
        >
          Agency Workspace Overview
        </h1>
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
            <CardTitle as="h2">12 Active Stores</CardTitle>
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
            <CardTitle as="h2">₹24,500 / mo</CardTitle>
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
            <CardTitle as="h2">agency.vyapone.in</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="success">Custom Domain Connected</Badge>
          </CardContent>
        </Card>
      </div>

      <Card variant="default">
        <CardHeader>
          <CardTitle as="h3">Quick Actions</CardTitle>
          <CardDescription>Fast onboarding shortcuts for agency field staff</CardDescription>
        </CardHeader>
        <CardContent style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
          <Button variant="primary">Provision New Client Business</Button>
          <Button variant="secondary">Invite Agency Staff</Button>
        </CardContent>
      </Card>
    </div>
  );
}
