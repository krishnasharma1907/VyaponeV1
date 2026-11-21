/**
 * VyapOne — Approved Block Library Registry [VO-041]
 *
 * Central registry for all 13 canonical approved website blocks (PRD FINAL v2 §15.3).
 * Maps block type identifiers to their validated React components and metadata.
 */

import React from "react";
import type { ApprovedBlockType, BlockMetadata, BlockComponentProps } from "./types";
import { HeroBlock } from "./hero-block";
import { AboutBlock } from "./about-block";
import { MenuBlock } from "./menu-block";
import { CatalogueGridBlock } from "./catalogue-grid-block";
import { GalleryBlock } from "./gallery-block";
import { BookingFormBlock } from "./booking-form-block";
import { PricingBlock } from "./pricing-block";
import { ReviewsBlock } from "./reviews-block";
import { OffersBlock } from "./offers-block";
import { LocationMapBlock } from "./location-map-block";
import { ContactBlock } from "./contact-block";
import { FaqBlock } from "./faq-block";
import { FooterBlock } from "./footer-block";

export type AnyBlockComponent = React.ComponentType<BlockComponentProps<never>>;

interface RegistryEntry {
  component: AnyBlockComponent;
  metadata: BlockMetadata;
}

export const APPROVED_BLOCK_REGISTRY: Record<ApprovedBlockType, RegistryEntry> = {
  hero: {
    component: HeroBlock,
    metadata: {
      type: "hero",
      name: "Hero Banner",
      description: "Prominent visual headline, introductory copy, and primary action buttons.",
      category: "core",
      allowedVariants: ["split", "center", "photo-left", "minimal"],
      defaultProps: {
        title: "Welcome to Our Store",
        subtitle: "Fresh quality products and trusted local service.",
        cta: {
          label: "Order on WhatsApp",
          action: "whatsapp_order",
        },
      },
      supportsDynamicBinding: false,
    },
  },
  about: {
    component: AboutBlock,
    metadata: {
      type: "about",
      name: "About Business",
      description: "Story, heritage, values, and core highlights of the local business.",
      category: "content",
      allowedVariants: ["split", "centered", "minimal"],
      defaultProps: {
        title: "About Our Story",
        story: "Committed to delivering trusted quality and warm hospitality to our community.",
        highlights: ["Locally sourced", "Fast delivery", "GST compliant"],
      },
      supportsDynamicBinding: false,
    },
  },
  menu: {
    component: MenuBlock,
    metadata: {
      type: "menu",
      name: "Food & Dining Menu",
      description: "Structured catalogue listing with category filter chips and dietary badges.",
      category: "commerce",
      allowedVariants: ["default", "categorized"],
      defaultProps: {
        title: "Our Menu",
        source: "catalogue",
      },
      supportsDynamicBinding: true,
      bindingSource: "catalogue",
    },
  },
  catalogue_grid: {
    component: CatalogueGridBlock,
    metadata: {
      type: "catalogue_grid",
      name: "Product Catalogue Grid",
      description: "Responsive 2/3/4 column product grid with direct WhatsApp ordering.",
      category: "commerce",
      allowedVariants: ["grid-3", "grid-2", "grid-4"],
      defaultProps: {
        title: "Our Products",
        source: "catalogue",
        columns: 3,
        featuredOnly: false,
      },
      supportsDynamicBinding: true,
      bindingSource: "catalogue",
    },
  },
  gallery: {
    component: GalleryBlock,
    metadata: {
      type: "gallery",
      name: "Photo Gallery",
      description: "Responsive photo grid with accessible alt text and image enlargement.",
      category: "content",
      allowedVariants: ["grid-3", "grid-2", "grid-4"],
      defaultProps: {
        title: "Photo Gallery",
        images: [],
        columns: 3,
      },
      supportsDynamicBinding: false,
    },
  },
  booking_form: {
    component: BookingFormBlock,
    metadata: {
      type: "booking_form",
      name: "Appointment Booking",
      description: "Interactive service appointment request form with date/time selection.",
      category: "interaction",
      allowedVariants: ["default", "compact"],
      defaultProps: {
        title: "Book an Appointment",
        requirePhone: true,
        notice: "Please arrive 10 minutes prior to your scheduled slot.",
      },
      supportsDynamicBinding: true,
      bindingSource: "catalogue",
    },
  },
  pricing: {
    component: PricingBlock,
    metadata: {
      type: "pricing",
      name: "Pricing Tiers",
      description: "Comparative pricing tables and packages dynamically bound to catalogue rates.",
      category: "commerce",
      allowedVariants: ["tiers-3", "simple"],
      defaultProps: {
        title: "Transparent Rates",
        source: "catalogue",
      },
      supportsDynamicBinding: true,
      bindingSource: "catalogue",
    },
  },
  reviews: {
    component: ReviewsBlock,
    metadata: {
      type: "reviews",
      name: "Customer Reviews",
      description: "Social proof cards with star ratings and verified buyer badges.",
      category: "content",
      allowedVariants: ["cards", "carousel"],
      defaultProps: {
        title: "Customer Reviews",
        source: "verified_reviews",
        customReviews: [],
      },
      supportsDynamicBinding: true,
      bindingSource: "google_reviews",
    },
  },
  offers: {
    component: OffersBlock,
    metadata: {
      type: "offers",
      name: "Special Offers",
      description: "Promotional banners with discount coupons and one-click copy codes.",
      category: "commerce",
      allowedVariants: ["coupon-cards", "banner"],
      defaultProps: {
        title: "Limited Time Deals",
        offers: [],
      },
      supportsDynamicBinding: false,
    },
  },
  location_map: {
    component: LocationMapBlock,
    metadata: {
      type: "location_map",
      name: "Store Location & Timings",
      description: "Authoritative business address, weekly hours, and Google Maps directions.",
      category: "core",
      allowedVariants: ["split", "compact"],
      defaultProps: {
        title: "Visit Our Store",
        addressRef: "business.primary_location",
        showTimings: true,
        showMap: true,
      },
      supportsDynamicBinding: true,
      bindingSource: "business.primary_location",
    },
  },
  contact: {
    component: ContactBlock,
    metadata: {
      type: "contact",
      name: "Contact Channels",
      description: "Direct WhatsApp, phone, email buttons and quick enquiry intake form.",
      category: "interaction",
      allowedVariants: ["split", "buttons-only", "form-only"],
      defaultProps: {
        title: "Contact Us",
        showPhone: true,
        showWhatsapp: true,
        showEmail: true,
        enableForm: true,
      },
      supportsDynamicBinding: false,
    },
  },
  faq: {
    component: FaqBlock,
    metadata: {
      type: "faq",
      name: "FAQ Accordion",
      description: "Accessible collapsible questions and answers with keyboard navigation.",
      category: "content",
      allowedVariants: ["accordion", "cards"],
      defaultProps: {
        title: "Frequently Asked Questions",
        items: [],
      },
      supportsDynamicBinding: false,
    },
  },
  footer: {
    component: FooterBlock,
    metadata: {
      type: "footer",
      name: "Website Footer",
      description: "Copyright notice, navigation links, social icons, and powered-by badge.",
      category: "navigation",
      allowedVariants: ["default", "compact"],
      defaultProps: {
        showPoweredBy: true,
        links: [],
      },
      supportsDynamicBinding: false,
    },
  },
};

/**
 * Checks whether a given string is one of the 13 canonical approved block types.
 */
export function isApprovedBlockType(type: string): type is ApprovedBlockType {
  return Object.prototype.hasOwnProperty.call(APPROVED_BLOCK_REGISTRY, type);
}

/**
 * Retrieves the React component for an approved block type.
 */
export function getApprovedBlockComponent(type: ApprovedBlockType): AnyBlockComponent {
  const entry = APPROVED_BLOCK_REGISTRY[type];
  if (!entry) {
    throw new Error(`Unapproved or unknown block type: "${type}"`);
  }
  return entry.component;
}

/**
 * Retrieves metadata for an approved block type.
 */
export function getApprovedBlockMetadata(type: ApprovedBlockType): BlockMetadata {
  const entry = APPROVED_BLOCK_REGISTRY[type];
  if (!entry) {
    throw new Error(`Unapproved or unknown block type: "${type}"`);
  }
  return entry.metadata;
}

/**
 * Returns a list of all 13 canonical approved block type identifiers.
 */
export function getAllApprovedBlockTypes(): ApprovedBlockType[] {
  return Object.keys(APPROVED_BLOCK_REGISTRY) as ApprovedBlockType[];
}

/**
 * Returns block metadata filtered by category.
 */
export function getApprovedBlocksByCategory(category: BlockMetadata["category"]): BlockMetadata[] {
  return getAllApprovedBlockTypes()
    .map((type) => APPROVED_BLOCK_REGISTRY[type].metadata)
    .filter((meta) => meta.category === category);
}
