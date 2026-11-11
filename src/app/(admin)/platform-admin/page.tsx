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

export default function PlatformAdminOverviewPage() {
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
          <h1 style={{ fontSize: "var(--font-size-h1)", color: "var(--color-text-primary)" }}>
            Global System Governance
          </h1>
          <Badge variant="success">All Systems Operational</Badge>
        </div>
        <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--font-size-body)" }}>
          Platform infrastructure health, active multi-tenant metrics, and compliance oversight.
        </p>
      </header>

      {/* Global Metrics */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "var(--space-4)",
        }}
      >
        <Card variant="elevated">
          <CardHeader>
            <CardDescription>Total Provisioned Tenants</CardDescription>
            <CardTitle as="h2">1,420 Businesses</CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/platform-admin/tenants" style={{ textDecoration: "none" }}>
              <Button size="sm" variant="outline">
                Inspect Tenants
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card variant="elevated">
          <CardHeader>
            <CardDescription>Reseller Workspaces</CardDescription>
            <CardTitle as="h2">84 Agencies</CardTitle>
          </CardHeader>
          <CardContent>
            <span
              style={{ fontSize: "var(--font-size-caption)", color: "var(--color-text-secondary)" }}
            >
              Across 18 Indian states
            </span>
          </CardContent>
        </Card>

        <Card variant="elevated">
          <CardHeader>
            <CardDescription>Statutory GST Sequences</CardDescription>
            <CardTitle as="h2">Zero Gaps Verified</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="success">Audited (100% Sequence Integrity)</Badge>
          </CardContent>
        </Card>
      </div>

      <Card variant="default">
        <CardHeader>
          <CardTitle as="h3">Governance Controls</CardTitle>
          <CardDescription>Master statutory rules and tenant security tools</CardDescription>
        </CardHeader>
        <CardContent style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
          <Link href="/platform-admin/taxes" style={{ textDecoration: "none" }}>
            <Button variant="secondary">Review GST Tax Slabs</Button>
          </Link>
          <Link href="/platform-admin/audit-logs" style={{ textDecoration: "none" }}>
            <Button variant="outline">View Global Audit Logs</Button>
          </Link>
          <Link href="/platform-admin/abuse" style={{ textDecoration: "none" }}>
            <Button variant="destructive">Inspect Flagged Activity</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
