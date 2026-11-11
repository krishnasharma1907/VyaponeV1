import React from "react";
import type { Metadata } from "next";
import { Card, CardContent, Button, EmptyState } from "@/components/ui";

export const metadata: Metadata = {
  title: "Audit Trail — Platform Administration | VyapOne",
  description: "Tamper-evident global audit trail recording actor, action, tenant, and timestamp.",
};

export default function AdminAuditLogsPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <header>
        <h1
          style={{
            fontSize: "var(--font-size-h1)",
            color: "var(--color-text-primary)",
            marginBottom: "var(--space-1)",
          }}
        >
          Tamper-Evident Global Audit Trail
        </h1>
        <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--font-size-body)" }}>
          Append-only event log capturing privileged operations, plan modifications, and statutory
          sequence initializations.
        </p>
      </header>

      <Card variant="default">
        <CardContent style={{ padding: "var(--space-6)" }}>
          <EmptyState
            title="Global Security Audit Stream"
            description="Immutable audit events with actor ID, IP origin, tenant boundary, and before/after state hashes will be displayed here."
            action={
              <Button size="sm" variant="outline">
                Filter Security Events
              </Button>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
