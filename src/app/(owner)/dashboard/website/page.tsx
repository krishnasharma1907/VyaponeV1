import React from "react";
import type { Metadata } from "next";
import { Badge } from "@/components/ui";
import { OwnerWebsiteWorkspace } from "@/components/websites/editor";
import { buildInitialWebsiteConfiguration } from "@/lib/websites/defaults";
import type { SiteRow, SiteVersionRow } from "@/lib/websites/types";

export const metadata: Metadata = {
  title: "Website Builder & Publishing — Business Owner | VyapOne",
  description: "Customize your store website using constrained visual blocks and brand tokens.",
};

const defaultSite: SiteRow = {
  id: "00000000-0000-4000-8000-000000000003",
  business_id: "00000000-0000-4000-8000-000000000001",
  subdomain: "sharma-sweets",
  primary_domain: null,
  status: "draft",
  current_draft_version_id: "00000000-0000-4000-8000-000000000010",
  published_version_id: null,
  created_at: "2026-11-21T00:00:00Z",
  updated_at: "2026-11-21T00:00:00Z",
};

const defaultVersion: SiteVersionRow = {
  id: "00000000-0000-4000-8000-000000000010",
  site_id: defaultSite.id,
  business_id: defaultSite.business_id,
  version_number: 1,
  schema_version: "v1",
  configuration: {},
  created_by: "00000000-0000-4000-8000-000000000099",
  change_summary: "Initial draft configuration",
  published_at: null,
  created_at: "2026-11-21T00:00:00Z",
};

const defaultConfig = buildInitialWebsiteConfiguration({
  siteId: defaultSite.id,
  businessId: defaultSite.business_id,
  tradeName: "Sharma Kirana & Sweets",
  subdomain: "sharma-sweets",
  nicheSlug: "sweets",
  description: "Authentic Indian sweets and savory snacks crafted fresh daily in Bengaluru.",
});

export default function OwnerWebsitePage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
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
            <Badge variant="accent">Constrained Editor (VO-044)</Badge>
          </div>
          <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--font-size-body)" }}>
            Customize your storefront using approved JSON blocks, brand themes, and live draft
            preview.
          </p>
        </div>
      </header>

      <OwnerWebsiteWorkspace
        initialSite={defaultSite}
        initialVersion={defaultVersion}
        initialConfiguration={defaultConfig}
        initialContext={{
          business: {
            id: defaultSite.business_id,
            name: "Sharma Kirana & Sweets",
            tradeName: "Sharma Kirana & Sweets",
            phone: "+919876543210",
            whatsappNumber: "+919876543210",
            primaryLocation: {
              addressLine1: "100 MG Road",
              city: "Bengaluru",
              state: "Karnataka",
              postalCode: "560001",
            },
          },
          catalogueItems: [
            {
              id: "cat-1",
              name: "Kaju Katli (250g)",
              priceMinor: 25000,
              currency: "INR",
              isAvailable: true,
            },
            {
              id: "cat-2",
              name: "Motichoor Ladoo (500g)",
              priceMinor: 18000,
              currency: "INR",
              isAvailable: true,
            },
            {
              id: "cat-3",
              name: "Gulab Jamun (Box of 4)",
              priceMinor: 12000,
              currency: "INR",
              isAvailable: true,
            },
          ],
        }}
      />
    </div>
  );
}
