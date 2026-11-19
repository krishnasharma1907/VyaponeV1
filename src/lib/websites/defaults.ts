/**
 * VyapOne — Website Configuration Defaults [VO-040]
 *
 * Provides factory functions to generate clean, valid v1 website configurations
 * from confirmed business and location facts.
 */

import type { ThemeConfig, WebsiteConfiguration } from "./types";

export const CANONICAL_THEMES: Record<string, ThemeConfig> = {
  "emerald-marigold": {
    themeId: "emerald-marigold",
    colorMode: "light",
    colors: {
      primary: "#0B6E4F",
      accent: "#F5A524",
      secondary: "#1B4965",
      background: "#FFFFFF",
      surface: "#F8FAFC",
      text: "#0F172A",
      muted: "#64748B",
    },
    fonts: {
      heading: "Inter",
      body: "Inter",
    },
    radii: {
      button: "md",
      card: "md",
    },
  },
  "warm-terracotta": {
    themeId: "warm-terracotta",
    colorMode: "light",
    colors: {
      primary: "#C84B31",
      accent: "#E9B824",
      secondary: "#2D4263",
      background: "#FFFFFF",
      surface: "#FAF8F5",
      text: "#191919",
      muted: "#686D76",
    },
    fonts: {
      heading: "Plus Jakarta Sans",
      body: "Plus Jakarta Sans",
    },
    radii: {
      button: "sm",
      card: "sm",
    },
  },
};

export interface BuildInitialWebsiteConfigParams {
  siteId: string;
  businessId: string;
  tradeName: string;
  subdomain: string;
  nicheSlug?: string;
  description?: string;
  primaryPhone?: string;
  logoMediaId?: string;
}

/**
 * Builds a valid initial WebsiteConfiguration (v1) from confirmed business facts.
 */
export function buildInitialWebsiteConfiguration(
  params: BuildInitialWebsiteConfigParams,
): WebsiteConfiguration {
  const isFoodNiche =
    params.nicheSlug?.includes("cafe") ||
    params.nicheSlug?.includes("restaurant") ||
    params.nicheSlug?.includes("bakery") ||
    params.nicheSlug?.includes("food");

  return {
    schemaVersion: "v1",
    siteId: params.siteId,
    businessId: params.businessId,
    presetId: params.nicheSlug ? `${params.nicheSlug}.v1` : "general.store.v1",
    metadata: {
      title: params.tradeName,
      description: params.description || `Welcome to ${params.tradeName}`,
      subdomain: params.subdomain.toLowerCase(),
      primaryDomain: null,
      faviconMediaId: null,
      defaultLocale: "en",
      supportedLocales: ["en", "hi"],
    },
    theme: CANONICAL_THEMES["emerald-marigold"],
    header: {
      logoMediaId: params.logoMediaId,
      logoText: params.tradeName,
      navLinks: [
        { label: "Home", href: "/" },
        { label: isFoodNiche ? "Menu" : "Catalogue", href: "/#items" },
        { label: "About", href: "/#about" },
        { label: "Contact", href: "/#contact" },
      ],
      cta: {
        label: "Order on WhatsApp",
        action: "whatsapp_order",
      },
    },
    footer: {
      copyright: `© ${new Date().getFullYear()} ${params.tradeName}. All rights reserved.`,
      showPoweredBy: true,
      socialLinks: params.primaryPhone
        ? [
            {
              platform: "whatsapp",
              url: `https://wa.me/${params.primaryPhone.replace(/[^0-9]/g, "")}`,
            },
          ]
        : [],
    },
    pages: [
      {
        id: "page_home",
        slug: "/",
        title: "Home",
        isPublished: true,
        seo: {
          title: params.tradeName,
          metaDescription: `Discover ${params.tradeName}. Browse items, order directly, and contact us.`,
        },
        sections: [
          {
            id: "sec_hero",
            type: "hero",
            variant: "photo-left",
            isEnabled: true,
            props: {
              title: params.tradeName,
              subtitle: params.description || "Fresh quality & trusted local service",
              cta: {
                label: "Order on WhatsApp",
                action: "whatsapp_order",
              },
            },
          },
          {
            id: "sec_items",
            type: isFoodNiche ? "menu" : "catalogue_grid",
            isEnabled: true,
            props: {
              title: isFoodNiche ? "Our Menu" : "Our Products",
              source: "catalogue",
            },
          },
          {
            id: "sec_about",
            type: "about",
            isEnabled: true,
            props: {
              title: `About ${params.tradeName}`,
              story:
                params.description ||
                `${params.tradeName} is committed to providing excellent service and quality products to our local community.`,
            },
          },
          {
            id: "sec_location",
            type: "location_map",
            isEnabled: true,
            props: {
              title: "Visit Our Store",
              addressRef: "business.primary_location",
              showTimings: true,
              showMap: true,
            },
          },
          {
            id: "sec_contact",
            type: "contact",
            isEnabled: true,
            props: {
              title: "Get in Touch",
              showPhone: true,
              showWhatsapp: true,
              showEmail: true,
              enableForm: true,
            },
          },
        ],
      },
    ],
    modules: {
      website_engine: { enabled: true },
      catalogue: { enabled: true },
    },
  };
}
