import React from "react";
import type { Metadata } from "next";
import { Card, CardContent, Button, EmptyState, Badge } from "@/components/ui";

export const metadata: Metadata = {
  title: "Abuse Defense & Compliance — Platform Administration | VyapOne",
  description: "WhatsApp quiet-hour enforcement, spam defense, and rate-limit breach monitoring.",
};

export default function AdminAbusePage() {
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
            Abuse Defense &amp; Compliance Monitor
          </h1>
          <Badge variant="warning">TRAI / Meta Rules Active</Badge>
        </div>
        <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--font-size-body)" }}>
          Automated monitoring of quiet-hour violations (9 PM - 9 AM), high-frequency broadcasts,
          and opt-out rate spikes.
        </p>
      </header>

      <Card variant="default">
        <CardContent style={{ padding: "var(--space-6)" }}>
          <EmptyState
            title="Flagged Broadcasts &amp; Rate-Limit Incidents"
            description="Broadcast campaigns paused due to high STOP opt-out frequency or quiet-hour restrictions will appear here for review."
            action={
              <Button size="sm" variant="destructive" disabled>
                Abuse Queue Offline (VO-093)
              </Button>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
