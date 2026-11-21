import React from "react";
import type { Metadata } from "next";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { resolvePublishedStorefrontBySubdomain } from "@/lib/websites/public-service";
import { buildStorefrontMetadata } from "@/lib/websites/seo";
import { PublicWebsiteRenderer, StorefrontNotFound } from "@/components/websites/public-renderer";
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
  searchParams?: Promise<{ p?: string; page?: string }>;
}

/**
 * Safely resolves published storefront data using administrative or server Supabase client.
 */
async function fetchPublishedStorefront(subdomain: string) {
  try {
    const supabase = createAdminSupabaseClient();
    return await resolvePublishedStorefrontBySubdomain(supabase, subdomain);
  } catch {
    try {
      const supabase = await createServerSupabaseClient();
      return await resolvePublishedStorefrontBySubdomain(supabase, subdomain);
    } catch {
      return null;
    }
  }
}

export async function generateMetadata({
  params,
  searchParams,
}: StorefrontPageProps): Promise<Metadata> {
  const { subdomain } = await params;
  const sParams = searchParams ? await searchParams : {};
  const requestedSlug = sParams.p || sParams.page || "/";
  const storefront = await fetchPublishedStorefront(subdomain);

  if (storefront) {
    return buildStorefrontMetadata({
      storefront,
      slug: requestedSlug,
    });
  }

  return {
    title: `${subdomain} — Storefront | VyapOne`,
    description: `Official storefront on VyapOne.`,
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function SubdomainStorefrontPage({
  params,
  searchParams,
}: StorefrontPageProps) {
  const { subdomain } = await params;
  const sParams = searchParams ? await searchParams : {};
  const requestedSlug = sParams.p || sParams.page || "/";
  const storefront = await fetchPublishedStorefront(subdomain);

  // 1. If verified published website is found, render through the approved block runtime
  if (storefront) {
    return (
      <PublicWebsiteRenderer
        configuration={storefront.configuration}
        context={storefront.context}
        currentPath={requestedSlug}
        subdomain={subdomain}
      />
    );
  }

  // 2. Compatibility Shell: For specific scaffold/test subdomains without mock DB (VO-014)
  if (subdomain === "chai-junction" || subdomain === "demo-store") {
    const storeName = subdomain.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
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
              <Badge variant="info">Storefront Shell</Badge>
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
              <Button variant="primary" disabled>
                Browse Catalogue
              </Button>
              <Button variant="secondary" disabled>
                Contact Merchant
              </Button>
            </div>
          </CardContent>
        </Card>

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
              <p
                style={{
                  color: "var(--color-text-secondary)",
                  fontSize: "var(--font-size-body)",
                }}
              >
                Catalogue items and published layout blocks will be rendered here upon merchant
                publishing.
              </p>
            </CardContent>
          </Card>
        </section>
      </div>
    );
  }

  // 3. Fail-closed fallback: Storefront Not Found / Unavailable
  return <StorefrontNotFound subdomain={subdomain} />;
}
