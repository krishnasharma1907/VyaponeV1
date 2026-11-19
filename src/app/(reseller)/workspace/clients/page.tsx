import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, Button, EmptyState } from "@/components/ui";

export const metadata: Metadata = {
  title: "Client Businesses — Reseller Workspace | VyapOne",
  description: "Directory of merchant businesses managed by your agency.",
};

export default function ResellerClientsPage() {
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
            Client Businesses
          </h1>
          <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--font-size-body)" }}>
            Manage merchant stores, access delegated administration, and configure plans.
          </p>
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
          <Link href="/workspace/clients/import" style={{ textDecoration: "none" }}>
            <Button variant="secondary">Import Business</Button>
          </Link>
          <Link href="/workspace/clients/new" style={{ textDecoration: "none" }}>
            <Button variant="primary">Add New Client</Button>
          </Link>
        </div>
      </header>

      <Card variant="default">
        <CardContent style={{ padding: "var(--space-6)" }}>
          <EmptyState
            title="Managed Client Directory"
            description="Client business roster with delegated access switches and status indicators will be listed here."
            action={
              <Link href="/workspace/clients/new" style={{ textDecoration: "none" }}>
                <Button size="sm">Provision Client Business</Button>
              </Link>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
