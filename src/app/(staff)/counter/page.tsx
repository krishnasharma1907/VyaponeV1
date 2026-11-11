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

export default function StaffCounterHomePage() {
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
            Counter POS Station
          </h1>
          <Badge variant="info">Counter Station Shell</Badge>
        </div>
        <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--font-size-body)" }}>
          Shift sessions, clerk PIN authentication, and terminal lock connect in Phase P11 (VO-110).
        </p>
      </header>

      {/* POS Punch CTA */}
      <Card variant="elevated" style={{ borderLeft: "6px solid var(--color-brand-primary)" }}>
        <CardHeader>
          <CardTitle as="h2">Ready to Punch Bill</CardTitle>
          <CardDescription>
            Instant itemized invoice generation with thermal print support
          </CardDescription>
        </CardHeader>
        <CardContent style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
          <Link href="/counter/pos" style={{ textDecoration: "none" }}>
            <Button size="lg" variant="primary">
              Launch Fast POS Screen &rarr;
            </Button>
          </Link>
          <Link href="/counter/unlock" style={{ textDecoration: "none" }}>
            <Button size="lg" variant="secondary">
              Lock Station
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
