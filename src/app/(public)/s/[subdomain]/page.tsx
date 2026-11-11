import React from "react";
import type { Metadata } from "next";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Button,
} from "@/components/ui";

interface StorefrontPageProps {
  params: Promise<{ subdomain: string }>;
}

export async function generateMetadata({ params }: StorefrontPageProps): Promise<Metadata> {
  const { subdomain } = await params;
  return {
    title: `${subdomain} — Storefront | VyapOne`,
    description: `Browse products and services from ${subdomain} on VyapOne.`,
  };
}

export default async function SubdomainStorefrontPage({ params }: StorefrontPageProps) {
  const { subdomain } = await params;
  const storeName = subdomain.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      {/* Store Banner */}
      <Card variant="elevated">
        <CardHeader>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "var(--space-2)",
            }}
          >
            <div>
              <CardTitle as="h1">{storeName} Store</CardTitle>
              <CardDescription>
                Official merchant storefront &bull; Powered by VyapOne
              </CardDescription>
            </div>
            <Badge variant="success">Open Now</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p
            style={{
              fontSize: "var(--font-size-body-sm)",
              color: "var(--color-text-secondary)",
              marginBottom: "var(--space-4)",
            }}
          >
            Storefront subdomain: <code>{subdomain}.vyapone.in</code>
          </p>
          <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
            <Button variant="primary">Browse Catalogue</Button>
            <Button variant="secondary">Contact Merchant</Button>
          </div>
        </CardContent>
      </Card>

      {/* Catalogue Placeholder */}
      <section aria-labelledby="featured-items-heading">
        <h2
          id="featured-items-heading"
          style={{
            fontSize: "var(--font-size-h3)",
            color: "var(--color-text-primary)",
            marginBottom: "var(--space-3)",
          }}
        >
          Featured Offerings
        </h2>
        <Card variant="default">
          <CardContent style={{ padding: "var(--space-6)", textAlign: "center" }}>
            <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--font-size-body)" }}>
              Catalogue items and Puck published layout blocks will be rendered here upon merchant
              publishing.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
