import React from "react";
import type { Metadata } from "next";
import { Card, CardContent, Button, EmptyState, Badge } from "@/components/ui";

export const metadata: Metadata = {
  title: "Website Builder & Publishing — Business Owner | VyapOne",
  description: "Customize your store website using constrained visual blocks and brand tokens.",
};

export default function OwnerWebsitePage() {
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
              Storefront Website Builder
            </h1>
            <Badge variant="success">Published (Live)</Badge>
          </div>
          <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--font-size-body)" }}>
            Customize your storefront using approved JSON blocks, brand themes, and AI draft
            generation.
          </p>
        </div>
        <Button variant="primary">Launch Visual Editor</Button>
      </header>

      <Card variant="default">
        <CardContent style={{ padding: "var(--space-6)" }}>
          <EmptyState
            title="Website Pages &amp; Puck Blocks"
            description="Visual block editor workspace with live preview, mobile breakpoint controls, and publishing revisions will appear here."
            action={<Button size="sm">Edit Storefront Blocks</Button>}
          />
        </CardContent>
      </Card>
    </div>
  );
}
