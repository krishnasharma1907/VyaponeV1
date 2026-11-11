import React from "react";
import type { Metadata } from "next";
import { Card, CardContent, Button, EmptyState, Badge } from "@/components/ui";

export const metadata: Metadata = {
  title: "WhatsApp Inbox & Messaging — Business Owner | VyapOne",
  description:
    "Meta Cloud WhatsApp inbox, approved templates, quiet-hours compliance, and broadcasts.",
};

export default function OwnerWhatsAppComponent() {
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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
              marginBottom: "var(--space-1)",
            }}
          >
            <h1 style={{ fontSize: "var(--font-size-h1)", color: "var(--color-text-primary)" }}>
              WhatsApp Customer Desk
            </h1>
            <Badge variant="info">Quiet Hours: 9 PM - 9 AM</Badge>
          </div>
          <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--font-size-body)" }}>
            Chat with customers, send bill notifications, and manage consent-verified campaigns.
          </p>
        </div>
        <Button variant="primary">New Broadcast</Button>
      </header>

      <Card variant="default">
        <CardContent style={{ padding: "var(--space-6)" }}>
          <EmptyState
            title="Unified Customer Inbox"
            description="Incoming WhatsApp messages, catalogue inquiries, and bill receipts will be managed here with strict opt-out handling."
            action={
              <Button size="sm" variant="outline">
                Connect WhatsApp Business Account
              </Button>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
