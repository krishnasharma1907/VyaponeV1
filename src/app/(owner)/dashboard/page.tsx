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

export default function BusinessOwnerOverviewPage() {
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
          <h1 style={{ fontSize: "var(--font-size-h1)", color: "var(--color-text-primary)" }}>
            Daily Business Pulse
          </h1>
          <Badge variant="info">Owner Shell</Badge>
        </div>
        <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--font-size-body)" }}>
          Real-time sales, active counter orders, and Vya daily intelligence summary placeholders.
        </p>
      </header>

      {/* Vya Morning Briefing Banner Placeholder */}
      <section
        className="glass-surface"
        style={{
          padding: "var(--space-4)",
          borderRadius: "var(--radius-lg)",
          borderLeft: "4px solid var(--color-brand-primary)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "var(--space-2)",
          }}
        >
          <strong
            style={{ fontSize: "var(--font-size-body)", color: "var(--color-brand-emerald)" }}
          >
            ✨ Vya Morning Briefing
          </strong>
          <Badge variant="primary">AI Assistant (VO-100)</Badge>
        </div>
        <p
          style={{
            fontSize: "var(--font-size-body-sm)",
            color: "var(--color-text-secondary)",
            margin: 0,
          }}
        >
          Vya daily morning intelligence briefing connects in Phase P10 (VO-100). Aggregated
          insights will highlight pending dispatches, low stock items, and morning action items.
        </p>
      </section>

      {/* Metric Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "var(--space-4)",
        }}
      >
        <Card variant="elevated">
          <CardHeader>
            <CardDescription>Today&apos;s Sales</CardDescription>
            <CardTitle as="h2">--</CardTitle>
          </CardHeader>
          <CardContent>
            <span
              style={{ fontSize: "var(--font-size-caption)", color: "var(--color-text-secondary)" }}
            >
              Sales metrics connect in Phase P6 (VO-068)
            </span>
          </CardContent>
        </Card>

        <Card variant="elevated">
          <CardHeader>
            <CardDescription>Online Store Orders</CardDescription>
            <CardTitle as="h2">-- Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/orders" style={{ textDecoration: "none" }}>
              <Button size="sm" variant="outline">
                View Orders
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card variant="elevated">
          <CardHeader>
            <CardDescription>Udhaar Outstanding</CardDescription>
            <CardTitle as="h2">-- Khata</CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/customers" style={{ textDecoration: "none" }}>
              <Button size="sm" variant="outline">
                View Khata
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Fast Action Row */}
      <Card variant="default">
        <CardHeader>
          <CardTitle as="h3">Counter &amp; Operations Shortcuts</CardTitle>
          <CardDescription>Direct jump to billing and counter modes</CardDescription>
        </CardHeader>
        <CardContent style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
          <Link href="/dashboard/billing" style={{ textDecoration: "none" }}>
            <Button variant="accent">New GST Bill (Accent)</Button>
          </Link>
          <Link href="/counter" style={{ textDecoration: "none" }}>
            <Button variant="secondary">Open Staff Counter Mode</Button>
          </Link>
          <Link href="/dashboard/catalogue" style={{ textDecoration: "none" }}>
            <Button variant="outline">Add New Product</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
