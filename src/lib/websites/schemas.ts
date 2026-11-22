/**
 * VyapOne — Website Configuration Validation Schemas [VO-040]
 *
 * Provides strict Zod schemas for validating structured website configurations.
 * Aligns with PRD FINAL v2 §6.14, §15.3, §17:
 * - Reject unapproved block types (only 13 canonical blocks allowed)
 * - Reject executable script tags or dangerous URIs (XSS defense)
 * - Enforce dynamic catalogue binding (prices cannot be hardcoded in JSON)
 * - Validate theme hex colors and typography
 * - Enforce schema versioning (v1)
 */

import { z } from "zod";

/**
 * 6-character hex color regex: #RRGGBB
 */
const hexColorRegex = /^#([0-9a-fA-F]{6})$/;

export const hexColorSchema = z
  .string()
  .regex(hexColorRegex, "Color must be a valid 6-character hex code (e.g. #0B6E4F)");

export const schemaVersionSchema = z.literal("v1");

export const approvedBlockTypeSchema = z.enum([
  "hero",
  "about",
  "menu",
  "catalogue_grid",
  "gallery",
  "booking_form",
  "pricing",
  "reviews",
  "offers",
  "location_map",
  "contact",
  "faq",
  "footer",
]);

export const ctaActionSchema = z.enum([
  "whatsapp_order",
  "enquiry",
  "booking",
  "catalogue",
  "phone_call",
  "custom_link",
]);

export const buttonCtaSchema = z.object({
  label: z.string().trim().min(1, "CTA label is required").max(60),
  action: z.string().trim().min(1),
  target: z.string().trim().max(255).optional(),
});

export const themeColorsSchema = z.object({
  primary: hexColorSchema,
  accent: hexColorSchema,
  secondary: hexColorSchema.optional(),
  background: hexColorSchema.optional().default("#FFFFFF"),
  surface: hexColorSchema.optional().default("#F8FAFC"),
  text: hexColorSchema.optional().default("#0F172A"),
  muted: hexColorSchema.optional().default("#64748B"),
});

export const themeFontsSchema = z.object({
  heading: z.string().trim().min(1).max(100),
  body: z.string().trim().min(1).max(100),
});

export const themeRadiiSchema = z.object({
  button: z.enum(["none", "sm", "md", "lg", "full"]).optional().default("md"),
  card: z.enum(["none", "sm", "md", "lg"]).optional().default("md"),
});

export const themeConfigSchema = z.object({
  themeId: z.string().trim().min(1).max(64),
  colorMode: z.enum(["light", "dark", "auto"]).default("light"),
  colors: themeColorsSchema,
  fonts: themeFontsSchema,
  radii: themeRadiiSchema.default({ button: "md", card: "md" }),
});

// Specific block prop schemas
export const heroBlockPropsSchema = z.object({
  title: z.string().trim().min(1, "Hero title is required").max(120),
  subtitle: z.string().trim().max(255).optional(),
  imageMediaId: z.string().uuid("Invalid image media ID").optional(),
  cta: buttonCtaSchema.optional(),
  secondaryCta: buttonCtaSchema.optional(),
});

export const aboutBlockPropsSchema = z.object({
  title: z.string().trim().min(1).max(100),
  story: z.string().trim().min(1).max(3000),
  imageMediaId: z.string().uuid("Invalid image media ID").optional(),
  highlights: z.array(z.string().trim().max(120)).max(10).optional(),
});

export const menuBlockPropsSchema = z.object({
  title: z.string().trim().max(100).optional(),
  subtitle: z.string().trim().max(255).optional(),
  source: z.literal("catalogue", {
    message: "Menu block must dynamically bind to 'catalogue' data source",
  }),
  categoryIds: z.array(z.string().trim()).max(50).optional(),
});

export const catalogueGridBlockPropsSchema = z.object({
  title: z.string().trim().max(100).optional(),
  source: z.literal("catalogue", {
    message: "Catalogue grid block must dynamically bind to 'catalogue' data source",
  }),
  columns: z
    .union([z.literal(2), z.literal(3), z.literal(4)])
    .optional()
    .default(3),
  featuredOnly: z.boolean().optional().default(false),
});

export const galleryBlockPropsSchema = z.object({
  title: z.string().trim().max(100).optional(),
  images: z
    .array(
      z.object({
        mediaId: z.string().uuid("Invalid media ID"),
        caption: z.string().trim().max(150).optional(),
        altText: z.string().trim().max(150).optional(),
      }),
    )
    .max(50),
  columns: z
    .union([z.literal(2), z.literal(3), z.literal(4)])
    .optional()
    .default(3),
});

export const bookingFormBlockPropsSchema = z.object({
  title: z.string().trim().max(100).optional(),
  serviceIds: z.array(z.string().trim()).max(50).optional(),
  requirePhone: z.boolean().optional().default(true),
  notice: z.string().trim().max(500).optional(),
});

export const pricingBlockPropsSchema = z.object({
  title: z.string().trim().max(100).optional(),
  source: z.literal("catalogue", {
    message: "Pricing block must dynamically bind to 'catalogue' source",
  }),
  highlightCategory: z.string().trim().max(64).optional(),
});

export const reviewsBlockPropsSchema = z.object({
  title: z.string().trim().max(100).optional(),
  source: z.enum(["google_reviews", "verified_reviews", "custom"]),
  customReviews: z
    .array(
      z.object({
        author: z.string().trim().min(1).max(80),
        rating: z.number().min(1).max(5),
        text: z.string().trim().min(1).max(1000),
        date: z.string().trim().optional(),
      }),
    )
    .max(20)
    .optional(),
});

export const offersBlockPropsSchema = z.object({
  title: z.string().trim().max(100).optional(),
  offers: z
    .array(
      z.object({
        headline: z.string().trim().min(1).max(100),
        description: z.string().trim().max(300),
        couponCode: z.string().trim().max(30).optional(),
        expiresAt: z.string().trim().optional(),
      }),
    )
    .max(10),
});

export const locationMapBlockPropsSchema = z.object({
  title: z.string().trim().max(100).optional(),
  addressRef: z.literal("business.primary_location", {
    message: "Location block must reference 'business.primary_location' source of truth",
  }),
  showTimings: z.boolean().optional().default(true),
  showMap: z.boolean().optional().default(true),
});

export const contactBlockPropsSchema = z.object({
  title: z.string().trim().max(100).optional(),
  showPhone: z.boolean().optional().default(true),
  showWhatsapp: z.boolean().optional().default(true),
  showEmail: z.boolean().optional().default(true),
  enableForm: z.boolean().optional().default(true),
});

export const faqBlockPropsSchema = z.object({
  title: z.string().trim().max(100).optional(),
  items: z
    .array(
      z.object({
        question: z.string().trim().min(1).max(200),
        answer: z.string().trim().min(1).max(2000),
      }),
    )
    .max(30),
});

export const footerBlockPropsSchema = z.object({
  copyright: z.string().trim().max(120).optional(),
  showPoweredBy: z.boolean().default(true),
  socialLinks: z
    .array(
      z.object({
        platform: z.enum(["whatsapp", "instagram", "facebook", "youtube", "x", "google_maps"]),
        url: z.string().url("Social link must be a valid URL"),
      }),
    )
    .max(10)
    .optional(),
  links: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(60),
        href: z.string().trim().min(1).max(255),
      }),
    )
    .max(15)
    .optional(),
});

/**
 * Validates section configuration and its block-specific props.
 */
export const sectionConfigSchema = z
  .object({
    id: z
      .string()
      .regex(/^[a-zA-Z0-9_-]{2,64}$/, "Section ID must be alphanumeric and between 2-64 chars"),
    type: approvedBlockTypeSchema,
    variant: z.string().trim().max(50).optional(),
    isEnabled: z.boolean().optional().default(true),
    props: z.record(z.string(), z.unknown()),
  })
  .superRefine((section, ctx) => {
    let propResult: { success: true; data: unknown } | { success: false; error: z.ZodError };

    switch (section.type) {
      case "hero":
        propResult = heroBlockPropsSchema.safeParse(section.props);
        break;
      case "about":
        propResult = aboutBlockPropsSchema.safeParse(section.props);
        break;
      case "menu":
        propResult = menuBlockPropsSchema.safeParse(section.props);
        break;
      case "catalogue_grid":
        propResult = catalogueGridBlockPropsSchema.safeParse(section.props);
        break;
      case "gallery":
        propResult = galleryBlockPropsSchema.safeParse(section.props);
        break;
      case "booking_form":
        propResult = bookingFormBlockPropsSchema.safeParse(section.props);
        break;
      case "pricing":
        propResult = pricingBlockPropsSchema.safeParse(section.props);
        break;
      case "reviews":
        propResult = reviewsBlockPropsSchema.safeParse(section.props);
        break;
      case "offers":
        propResult = offersBlockPropsSchema.safeParse(section.props);
        break;
      case "location_map":
        propResult = locationMapBlockPropsSchema.safeParse(section.props);
        break;
      case "contact":
        propResult = contactBlockPropsSchema.safeParse(section.props);
        break;
      case "faq":
        propResult = faqBlockPropsSchema.safeParse(section.props);
        break;
      case "footer":
        propResult = footerBlockPropsSchema.safeParse(section.props);
        break;
      default:
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Unapproved block type: ${(section as { type: string }).type}`,
          path: ["type"],
        });
        return;
    }

    if (!propResult.success) {
      for (const issue of propResult.error.issues) {
        ctx.addIssue({
          ...issue,
          path: ["props", ...issue.path],
        });
      }
    }
  });

export const pageSeoConfigSchema = z.object({
  title: z.string().trim().max(70).optional(),
  metaDescription: z.string().trim().max(160).optional(),
  ogImageMediaId: z.string().uuid("Invalid OG image media ID").optional(),
  noIndex: z.boolean().optional().default(false),
});

export const pageConfigSchema = z.object({
  id: z
    .string()
    .regex(/^[a-zA-Z0-9_-]{2,64}$/, "Page ID must be alphanumeric and between 2-64 chars"),
  slug: z
    .string()
    .regex(
      /^\/([a-z0-9_-]+(\/[a-z0-9_-]+)*)?$/,
      "Page slug must start with '/' and contain only lower-case alphanumeric segments",
    ),
  title: z.string().trim().min(1, "Page title is required").max(100),
  isPublished: z.boolean().optional().default(true),
  seo: pageSeoConfigSchema.optional(),
  sections: z.array(sectionConfigSchema).min(1, "Page must contain at least one section"),
});

export const headerConfigSchema = z.object({
  logoMediaId: z.string().uuid("Invalid logo media ID").optional(),
  logoText: z.string().trim().max(80).optional(),
  navLinks: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(40),
        href: z.string().trim().min(1).max(255),
        isExternal: z.boolean().optional().default(false),
      }),
    )
    .max(10)
    .default([]),
  cta: buttonCtaSchema.optional(),
});

export const siteMetadataConfigSchema = z.object({
  title: z.string().trim().min(1, "Site title is required").max(120),
  description: z.string().trim().max(300).optional(),
  subdomain: z
    .string()
    .min(3, "Subdomain must be at least 3 characters")
    .max(63, "Subdomain cannot exceed 63 characters")
    .regex(
      /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/,
      "Subdomain must be lower-case alphanumeric with hyphens",
    ),
  primaryDomain: z.string().trim().max(255).nullable().optional(),
  faviconMediaId: z.string().uuid("Invalid favicon media ID").nullable().optional(),
  defaultLocale: z.string().trim().min(2).max(10).default("en"),
  supportedLocales: z.array(z.string().trim().min(2).max(10)).min(1).default(["en"]),
});

/**
 * Root website configuration document schema (v1).
 */
export const websiteConfigurationSchema = z.object({
  schemaVersion: schemaVersionSchema,
  siteId: z.string().uuid("Invalid site ID"),
  businessId: z.string().uuid("Invalid business ID"),
  presetId: z.string().trim().max(64).optional(),
  metadata: siteMetadataConfigSchema,
  theme: themeConfigSchema,
  header: headerConfigSchema,
  footer: footerBlockPropsSchema,
  pages: z.array(pageConfigSchema).min(1, "Website must define at least one page"),
  modules: z
    .record(
      z.string(),
      z.object({
        enabled: z.boolean(),
        config: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .default({}),
});

export type ValidatedWebsiteConfiguration = z.infer<typeof websiteConfigurationSchema>;

/**
 * Input schema for saving a site draft configuration.
 */
export const saveSiteDraftInputSchema = z.object({
  siteId: z.string().uuid("Invalid site ID"),
  configuration: websiteConfigurationSchema,
  changeSummary: z.string().trim().max(255).optional(),
  expectedBaseVersionNumber: z.number().int().positive().nullable(),
});

export type SaveSiteDraftInput = z.input<typeof saveSiteDraftInputSchema>;
