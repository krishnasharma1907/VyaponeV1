/**
 * VyapOne — Niche & Module Registry Constants [VO-030]
 *
 * Source Authority:
 * - PRD FINAL v2 §7: Supported Business Niches (9 niche groups, availability labels)
 * - PRD FINAL v2 §8: Reusable Product Modules (Platform core, operations, growth)
 * - PRD FINAL v2 §9.1/§9.2: Plan Entitlements & Capacity
 */

import type { ModuleCategory, ModuleStatus, NicheManifest } from "./types";
import type { FeatureKey } from "@/lib/plans/types";

export interface CanonicalNicheGroupDef {
  slug: string;
  name: string;
  description: string;
  displayOrder: number;
}

export const CANONICAL_NICHE_GROUPS: CanonicalNicheGroupDef[] = [
  {
    slug: "food_hospitality",
    name: "Food & Hospitality",
    description: "Cafés, restaurants, bakeries, cloud kitchens, and catering",
    displayOrder: 10,
  },
  {
    slug: "beauty_wellness_fitness",
    name: "Beauty, Wellness & Fitness",
    description: "Salons, spas, barbers, gyms, and fitness studios",
    displayOrder: 20,
  },
  {
    slug: "retail_commerce",
    name: "Retail & Local Commerce",
    description: "Kirana, boutiques, electronics, supermarkets, and local shops",
    displayOrder: 30,
  },
  {
    slug: "professional_home_services",
    name: "Professional & Home Services",
    description: "Repair, cleaning, consulting, freelancers, and planners",
    displayOrder: 40,
  },
  {
    slug: "automotive_repair",
    name: "Automotive & Repair",
    description: "Garages, washes, detailing studios, tyre, and repair shops",
    displayOrder: 50,
  },
  {
    slug: "education",
    name: "Education & Coaching",
    description: "Coaching centres, tutors, training institutes, and classes",
    displayOrder: 60,
  },
  {
    slug: "real_estate",
    name: "Real Estate",
    description: "Brokers, developers, rental managers, and property consultants",
    displayOrder: 70,
  },
  {
    slug: "operational_rentals",
    name: "Operational Services & Rentals",
    description: "Laundry, tailors, printing, and equipment rentals",
    displayOrder: 80,
  },
  {
    slug: "other_business",
    name: "Other Business",
    description: "Custom business models, unique offerings, and niche ventures",
    displayOrder: 90,
  },
];

export interface CanonicalModuleDef {
  key: string;
  name: string;
  description: string;
  category: ModuleCategory;
  entitlementFeatureKey?: FeatureKey | null;
  status: ModuleStatus;
  displayOrder: number;
}

export const CANONICAL_MODULES: CanonicalModuleDef[] = [
  {
    key: "website_engine",
    name: "Website Engine",
    description:
      "Structured responsive website pages, approved blocks, theme tokens, and publishing",
    category: "core",
    entitlementFeatureKey: "website_engine",
    status: "active",
    displayOrder: 10,
  },
  {
    key: "catalogue_services",
    name: "Catalogue & Services",
    description: "Product and service catalogue, categories, variants, and pricing",
    category: "commerce",
    entitlementFeatureKey: "catalogue_services",
    status: "active",
    displayOrder: 20,
  },
  {
    key: "enquiries_leads",
    name: "Enquiries & Lead Management",
    description: "Configurable enquiry forms, contact capture, lead status pipeline, and notes",
    category: "operations",
    entitlementFeatureKey: "enquiries_leads",
    status: "active",
    displayOrder: 30,
  },
  {
    key: "orders",
    name: "Order Management",
    description: "Server-validated orders, cart, pickup/delivery/table context, and status updates",
    category: "commerce",
    entitlementFeatureKey: "orders",
    status: "active",
    displayOrder: 40,
  },
  {
    key: "appointments",
    name: "Appointments & Scheduling",
    description: "Service durations, staff assignment, schedules, and double-booking prevention",
    category: "operations",
    entitlementFeatureKey: "appointments",
    status: "active",
    displayOrder: 50,
  },
  {
    key: "inventory",
    name: "Inventory Tracking",
    description:
      "Stock levels, low-stock alerts, order-linked inventory adjustments, and audit trail",
    category: "operations",
    entitlementFeatureKey: "inventory",
    status: "active",
    displayOrder: 60,
  },
  {
    key: "property_listings",
    name: "Property Listings",
    description:
      "Sale and rent listings, property attributes, floor plans, filters, and site visits",
    category: "operations",
    entitlementFeatureKey: null,
    status: "active",
    displayOrder: 70,
  },
  {
    key: "qr_management",
    name: "QR Management",
    description: "Permanent dynamic QR codes for storefront, tables, products, and campaign links",
    category: "growth",
    entitlementFeatureKey: "qr_management",
    status: "active",
    displayOrder: 80,
  },
  {
    key: "feedback_reviews",
    name: "Feedback & Reviews",
    description: "Private feedback collection and direct Google Review links for honest feedback",
    category: "growth",
    entitlementFeatureKey: "feedback_reviews",
    status: "active",
    displayOrder: 90,
  },
  {
    key: "offers_loyalty",
    name: "Offers & Loyalty",
    description: "Coupons, validity windows, festival discounts, and customer loyalty rewards",
    category: "growth",
    entitlementFeatureKey: null,
    status: "active",
    displayOrder: 100,
  },
  {
    key: "analytics",
    name: "Business Analytics",
    description: "Traffic, enquiries, orders, appointment conversion, and source attribution",
    category: "growth",
    entitlementFeatureKey: "analytics",
    status: "active",
    displayOrder: 110,
  },
  {
    key: "whatsapp_layer",
    name: "WhatsApp Communication",
    description: "Click-to-chat links, order-to-WhatsApp, bill sharing, and automated alerts",
    category: "growth",
    entitlementFeatureKey: null,
    status: "active",
    displayOrder: 120,
  },
  {
    key: "udhaar_balances",
    name: "Udhaar & Balances",
    description: "Pay-later ledger, customer balance statements, and WhatsApp payment reminders",
    category: "compliance",
    entitlementFeatureKey: null,
    status: "active",
    displayOrder: 130,
  },
  {
    key: "gst_billing",
    name: "GST Invoicing & Bills",
    description:
      "Gap-free sequential billing, tax calculations, thermal/A4 formats, and credit notes",
    category: "compliance",
    entitlementFeatureKey: "gst_e_invoicing",
    status: "active",
    displayOrder: 140,
  },
  {
    key: "customer_broadcasts",
    name: "Customer Directory & Broadcasts",
    description: "Customer profile directory, consent logging, segmenting, and WhatsApp broadcasts",
    category: "growth",
    entitlementFeatureKey: "whatsapp_broadcasts",
    status: "active",
    displayOrder: 150,
  },
  {
    key: "automation_engine",
    name: "Automation Engine",
    description: "Automated reminders, review requests, low-stock alerts, and schedule nudges",
    category: "growth",
    entitlementFeatureKey: "smart_ai_bot",
    status: "active",
    displayOrder: 160,
  },
  {
    key: "google_business_sync",
    name: "Google Business Sync",
    description: "Synchronize operating hours, address, and reviews with Google Business Profile",
    category: "growth",
    entitlementFeatureKey: null,
    status: "active",
    displayOrder: 170,
  },
  {
    key: "auto_social_posts",
    name: "Auto Social Creatives",
    description: "Brand-templated Instagram posts, WhatsApp statuses, and festival creatives",
    category: "growth",
    entitlementFeatureKey: null,
    status: "active",
    displayOrder: 180,
  },
  {
    key: "delivery_integration",
    name: "Delivery Partner Dispatch",
    description: "Hyperlocal delivery dispatch through Porter, Borzo, and logistics partners",
    category: "operations",
    entitlementFeatureKey: null,
    status: "active",
    displayOrder: 190,
  },
  {
    key: "staff_roles",
    name: "Staff Counter Mode",
    description: "Shared counter terminal mode with PIN switch, attendance, and POS billing",
    category: "operations",
    entitlementFeatureKey: null,
    status: "active",
    displayOrder: 200,
  },
  {
    key: "campaign_pages",
    name: "Campaign & Landing Pages",
    description: "Single-page landing pages with dedicated QR codes and promotional share links",
    category: "growth",
    entitlementFeatureKey: null,
    status: "active",
    displayOrder: 210,
  },
];

/**
 * Fallback static manifests for when database is offline or during testing
 */
export const DEFAULT_NICHE_MANIFESTS: Record<string, NicheManifest> = {
  restaurant: {
    version: "v1",
    nicheGroupSlug: "food_hospitality",
    nicheSlug: "restaurant",
    name: "Restaurant & Dine-in",
    availabilityLabel: "live_operational",
    modules: {
      defaultEnabled: [
        "website_engine",
        "catalogue_services",
        "orders",
        "qr_management",
        "whatsapp_layer",
        "feedback_reviews",
        "gst_billing",
      ],
      recommended: [
        "website_engine",
        "catalogue_services",
        "orders",
        "inventory",
        "qr_management",
        "feedback_reviews",
        "offers_loyalty",
        "analytics",
        "whatsapp_layer",
        "gst_billing",
        "staff_roles",
      ],
    },
    onboarding: {
      requiredQuestions: [
        {
          key: "cuisine_types",
          label: "Cuisine Types",
          type: "multiselect",
          required: true,
          options: [
            "North Indian",
            "South Indian",
            "Chinese",
            "Mughlai",
            "Continental",
            "Street Food",
            "Beverages",
          ],
        },
        {
          key: "dine_in_tables",
          label: "Number of Dining Tables",
          type: "number",
          required: false,
        },
        {
          key: "offers_takeaway",
          label: "Do you offer Takeaway / Delivery?",
          type: "boolean",
          required: true,
        },
        { key: "has_fssai", label: "FSSAI License Number", type: "text", required: false },
      ],
    },
    dashboardNavigation: [
      { id: "daily_pulse", label: "Daily Pulse", href: "/dashboard" },
      {
        id: "menu",
        label: "Menu & Catalogue",
        href: "/dashboard/catalogue",
        requiredModule: "catalogue_services",
      },
      {
        id: "orders",
        label: "Dine-in & Orders",
        href: "/dashboard/orders",
        requiredModule: "orders",
      },
      {
        id: "gst_billing",
        label: "GST Billing",
        href: "/dashboard/billing",
        requiredModule: "gst_billing",
      },
      {
        id: "qr_codes",
        label: "Table QR Codes",
        href: "/dashboard/qr",
        requiredModule: "qr_management",
      },
      {
        id: "whatsapp",
        label: "WhatsApp Desk",
        href: "/dashboard/whatsapp",
        requiredModule: "whatsapp_layer",
      },
      {
        id: "website",
        label: "Storefront",
        href: "/dashboard/website",
        requiredModule: "website_engine",
      },
      { id: "settings", label: "Settings", href: "/dashboard/settings" },
    ],
    presets: {
      websiteBlocks: [
        "hero_restaurant",
        "menu_highlights",
        "table_booking_card",
        "location_hours",
        "customer_reviews",
      ],
      suggestedTags: ["Pure Veg", "AC Dining", "Family Friendly", "Home Delivery"],
      sampleOfferings: ["Special Thali", "Chef Signature Starter", "Beverage Cooler"],
    },
  },
  cafe: {
    version: "v1",
    nicheGroupSlug: "food_hospitality",
    nicheSlug: "cafe",
    name: "Café & Coffee Shop",
    availabilityLabel: "live_operational",
    modules: {
      defaultEnabled: [
        "website_engine",
        "catalogue_services",
        "orders",
        "qr_management",
        "whatsapp_layer",
        "feedback_reviews",
      ],
      recommended: [
        "website_engine",
        "catalogue_services",
        "orders",
        "qr_management",
        "offers_loyalty",
        "whatsapp_layer",
        "feedback_reviews",
        "analytics",
      ],
    },
    onboarding: {
      requiredQuestions: [
        {
          key: "beverage_specialties",
          label: "Beverage Specialties",
          type: "text",
          required: true,
          placeholder: "Artisan coffee, bubble tea, matcha",
        },
        { key: "has_wifi", label: "Customer Wi-Fi Available?", type: "boolean", required: false },
        { key: "has_fssai", label: "FSSAI License Number", type: "text", required: false },
      ],
    },
    dashboardNavigation: [
      { id: "daily_pulse", label: "Daily Pulse", href: "/dashboard" },
      {
        id: "menu",
        label: "Café Menu",
        href: "/dashboard/catalogue",
        requiredModule: "catalogue_services",
      },
      {
        id: "orders",
        label: "Counter Orders",
        href: "/dashboard/orders",
        requiredModule: "orders",
      },
      {
        id: "qr_codes",
        label: "QR Standees",
        href: "/dashboard/qr",
        requiredModule: "qr_management",
      },
      {
        id: "whatsapp",
        label: "WhatsApp",
        href: "/dashboard/whatsapp",
        requiredModule: "whatsapp_layer",
      },
      {
        id: "website",
        label: "Website",
        href: "/dashboard/website",
        requiredModule: "website_engine",
      },
      { id: "settings", label: "Settings", href: "/dashboard/settings" },
    ],
  },
  salon: {
    version: "v1",
    nicheGroupSlug: "beauty_wellness_fitness",
    nicheSlug: "salon",
    name: "Salon & Hair Studio",
    availabilityLabel: "live_operational",
    modules: {
      defaultEnabled: [
        "website_engine",
        "catalogue_services",
        "appointments",
        "whatsapp_layer",
        "feedback_reviews",
      ],
      recommended: [
        "website_engine",
        "catalogue_services",
        "appointments",
        "whatsapp_layer",
        "feedback_reviews",
        "offers_loyalty",
        "staff_roles",
        "gst_billing",
      ],
    },
    onboarding: {
      requiredQuestions: [
        {
          key: "client_gender",
          label: "Services Offered For",
          type: "select",
          required: true,
          options: ["Unisex", "Women Only", "Men Only"],
        },
        {
          key: "staff_count",
          label: "Number of Stylists / Staff",
          type: "number",
          required: false,
        },
        {
          key: "appointment_advance_hours",
          label: "Minimum Advance Booking Notice (Hours)",
          type: "number",
          required: false,
        },
      ],
    },
    dashboardNavigation: [
      { id: "daily_pulse", label: "Daily Pulse", href: "/dashboard" },
      {
        id: "services",
        label: "Service Menu",
        href: "/dashboard/catalogue",
        requiredModule: "catalogue_services",
      },
      {
        id: "appointments",
        label: "Appointments",
        href: "/dashboard/appointments",
        requiredModule: "appointments",
      },
      {
        id: "whatsapp",
        label: "WhatsApp Reminders",
        href: "/dashboard/whatsapp",
        requiredModule: "whatsapp_layer",
      },
      {
        id: "website",
        label: "Website",
        href: "/dashboard/website",
        requiredModule: "website_engine",
      },
      { id: "settings", label: "Settings", href: "/dashboard/settings" },
    ],
  },
  kirana: {
    version: "v1",
    nicheGroupSlug: "retail_commerce",
    nicheSlug: "kirana",
    name: "Kirana & Grocery Store",
    availabilityLabel: "live_operational",
    modules: {
      defaultEnabled: [
        "website_engine",
        "catalogue_services",
        "orders",
        "inventory",
        "whatsapp_layer",
        "udhaar_balances",
        "gst_billing",
      ],
      recommended: [
        "website_engine",
        "catalogue_services",
        "orders",
        "inventory",
        "whatsapp_layer",
        "udhaar_balances",
        "gst_billing",
        "qr_management",
        "staff_roles",
      ],
    },
    onboarding: {
      requiredQuestions: [
        {
          key: "home_delivery",
          label: "Do you provide Local Home Delivery?",
          type: "boolean",
          required: true,
        },
        {
          key: "min_delivery_order",
          label: "Minimum Order Amount for Free Delivery (INR)",
          type: "number",
          required: false,
        },
        { key: "has_gstin", label: "GSTIN (If Registered)", type: "text", required: false },
      ],
    },
    dashboardNavigation: [
      { id: "daily_pulse", label: "Daily Pulse", href: "/dashboard" },
      {
        id: "catalogue",
        label: "Products & Stock",
        href: "/dashboard/catalogue",
        requiredModule: "catalogue_services",
      },
      {
        id: "orders",
        label: "Grocery Orders",
        href: "/dashboard/orders",
        requiredModule: "orders",
      },
      {
        id: "billing",
        label: "Fast Counter Bill",
        href: "/dashboard/billing",
        requiredModule: "gst_billing",
      },
      {
        id: "udhaar",
        label: "Udhaar Book",
        href: "/dashboard/udhaar",
        requiredModule: "udhaar_balances",
      },
      {
        id: "whatsapp",
        label: "WhatsApp Alerts",
        href: "/dashboard/whatsapp",
        requiredModule: "whatsapp_layer",
      },
      {
        id: "website",
        label: "Storefront",
        href: "/dashboard/website",
        requiredModule: "website_engine",
      },
      { id: "settings", label: "Settings", href: "/dashboard/settings" },
    ],
  },
  property_broker: {
    version: "v1",
    nicheGroupSlug: "real_estate",
    nicheSlug: "property_broker",
    name: "Real Estate Agent & Broker",
    availabilityLabel: "informational_with_enquiry",
    modules: {
      defaultEnabled: [
        "website_engine",
        "property_listings",
        "enquiries_leads",
        "qr_management",
        "whatsapp_layer",
      ],
      recommended: [
        "website_engine",
        "property_listings",
        "enquiries_leads",
        "qr_management",
        "whatsapp_layer",
        "analytics",
        "campaign_pages",
      ],
    },
    onboarding: {
      requiredQuestions: [
        { key: "rera_id", label: "RERA Registration Number", type: "text", required: false },
        {
          key: "primary_locations",
          label: "Primary Operational Localities / Cities",
          type: "text",
          required: true,
          placeholder: "e.g. Bandra, Andheri, Powai",
        },
        {
          key: "property_types",
          label: "Property Specialization",
          type: "multiselect",
          required: true,
          options: [
            "Residential Apartments",
            "Villas & Plots",
            "Commercial Offices",
            "Retail Shops",
            "Warehouse",
          ],
        },
      ],
    },
    dashboardNavigation: [
      { id: "daily_pulse", label: "Daily Pulse", href: "/dashboard" },
      {
        id: "properties",
        label: "Property Listings",
        href: "/dashboard/properties",
        requiredModule: "property_listings",
      },
      {
        id: "leads",
        label: "Buyer Leads",
        href: "/dashboard/enquiries",
        requiredModule: "enquiries_leads",
      },
      {
        id: "whatsapp",
        label: "WhatsApp Desk",
        href: "/dashboard/whatsapp",
        requiredModule: "whatsapp_layer",
      },
      {
        id: "website",
        label: "Portal",
        href: "/dashboard/website",
        requiredModule: "website_engine",
      },
      { id: "settings", label: "Settings", href: "/dashboard/settings" },
    ],
  },
  other_business: {
    version: "v1",
    nicheGroupSlug: "other_business",
    nicheSlug: "other_business",
    name: "Other Business",
    availabilityLabel: "informational_with_enquiry",
    modules: {
      defaultEnabled: ["website_engine", "catalogue_services", "enquiries_leads", "whatsapp_layer"],
      recommended: [
        "website_engine",
        "catalogue_services",
        "enquiries_leads",
        "qr_management",
        "whatsapp_layer",
        "feedback_reviews",
      ],
    },
    onboarding: {
      requiredQuestions: [
        {
          key: "business_summary",
          label: "Describe your business offerings",
          type: "text",
          required: true,
          placeholder: "What products or services do you provide?",
        },
        {
          key: "target_customer_action",
          label: "Primary action you want customers to take",
          type: "select",
          required: true,
          options: [
            "Send an Enquiry",
            "Call / WhatsApp",
            "Browse Catalogue",
            "Visit Store / Office",
          ],
        },
      ],
    },
    dashboardNavigation: [
      { id: "daily_pulse", label: "Daily Pulse", href: "/dashboard" },
      {
        id: "offerings",
        label: "Offerings & Pricing",
        href: "/dashboard/catalogue",
        requiredModule: "catalogue_services",
      },
      {
        id: "enquiries",
        label: "Enquiries & Leads",
        href: "/dashboard/enquiries",
        requiredModule: "enquiries_leads",
      },
      {
        id: "whatsapp",
        label: "WhatsApp Desk",
        href: "/dashboard/whatsapp",
        requiredModule: "whatsapp_layer",
      },
      {
        id: "website",
        label: "Website",
        href: "/dashboard/website",
        requiredModule: "website_engine",
      },
      { id: "settings", label: "Settings", href: "/dashboard/settings" },
    ],
  },
};
