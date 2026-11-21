/**
 * VyapOne — Approved Block Library Types & Render Context [VO-041]
 *
 * Defines the props, interfaces, and render context for the 13 canonical
 * approved website blocks (PRD FINAL v2 §6.14, §15.3).
 */

import type {
  ApprovedBlockType,
  ButtonCta,
  CtaAction,
  HeroBlockProps,
  AboutBlockProps,
  MenuBlockProps,
  CatalogueGridBlockProps,
  GalleryBlockProps,
  BookingFormBlockProps,
  PricingBlockProps,
  ReviewsBlockProps,
  OffersBlockProps,
  LocationMapBlockProps,
  ContactBlockProps,
  FaqBlockProps,
  FooterBlockProps,
  SectionConfig,
  ThemeConfig,
} from "@/lib/websites/types";

export type {
  ApprovedBlockType,
  ButtonCta,
  CtaAction,
  HeroBlockProps,
  AboutBlockProps,
  MenuBlockProps,
  CatalogueGridBlockProps,
  GalleryBlockProps,
  BookingFormBlockProps,
  PricingBlockProps,
  ReviewsBlockProps,
  OffersBlockProps,
  LocationMapBlockProps,
  ContactBlockProps,
  FaqBlockProps,
  FooterBlockProps,
  SectionConfig,
  ThemeConfig,
};

/**
 * Authoritative business fact reference for website rendering.
 * Sourced strictly from verified business and location database records.
 */
export interface BusinessRenderFacts {
  id: string;
  name: string;
  tradeName?: string;
  phone?: string;
  whatsappNumber?: string;
  email?: string;
  logoUrl?: string;
  primaryLocation?: {
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    postalCode: string;
    operatingHours?: Record<string, string>;
  };
}

/**
 * Dynamic catalogue item fact for website rendering.
 * Sourced strictly from verified catalogue database records (never hardcoded in JSON).
 */
export interface CatalogueRenderItem {
  id: string;
  name: string;
  description?: string;
  priceMinor: number; // In minor units (e.g. 15000 = ₹150.00)
  currency: string; // ISO 4217, defaults to 'INR'
  category?: string;
  categoryId?: string;
  imageUrl?: string;
  isFeatured?: boolean;
  isAvailable?: boolean;
  dietaryPreference?: "veg" | "non_veg" | "vegan" | "egg";
}

/**
 * Shared context provided to block components when rendering a website.
 */
export interface WebsiteRenderContext {
  theme?: ThemeConfig;
  business?: BusinessRenderFacts;
  catalogueItems?: CatalogueRenderItem[];
  mediaUrls?: Record<string, string>; // Maps mediaId -> resolved verified public/CDN URL
  onAction?: (action: string, payload?: unknown) => void;
  previewMode?: boolean;
}

/**
 * Generic props passed to every block component.
 */
export interface BlockComponentProps<TProps = Record<string, unknown>> {
  id: string;
  props: TProps;
  variant?: string;
  context?: WebsiteRenderContext;
  className?: string;
}

/**
 * Block metadata definition in the central registry.
 */
export interface BlockMetadata<TProps = Record<string, unknown>> {
  type: ApprovedBlockType;
  name: string;
  description: string;
  category: "core" | "commerce" | "content" | "interaction" | "navigation";
  allowedVariants: string[];
  defaultProps: TProps;
  supportsDynamicBinding: boolean;
  bindingSource?: "catalogue" | "business.primary_location" | "google_reviews";
}
