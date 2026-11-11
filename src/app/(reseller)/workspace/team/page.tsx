import React from "react";
import type { Metadata } from "next";
import { Card, CardContent, Button, EmptyState } from "@/components/ui";

export const metadata: Metadata = {
  title: "Agency Team — Reseller Workspace | VyapOne",
  description: "Manage agency staff members and their delegated client permissions.",
};

export default function ResellerTeamPage() {
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
            Agency Team Members
          </h1>
          <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--font-size-body)" }}>
            Invite designers, sales reps, and account managers with role-based access.
          </p>
        </div>
        <Button variant="primary" disabled>
          Invite Team Member (VO-110)
        </Button>
      </header>

      <Card variant="default">
        <CardContent style={{ padding: "var(--space-6)" }}>
          <EmptyState
            title="Agency Team Directory"
            description="Team members with their assigned client scopes and permissions will appear here."
            action={
              <Button size="sm" disabled>
                Invitations Offline (VO-110)
              </Button>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
