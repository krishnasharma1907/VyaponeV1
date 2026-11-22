/**
 * VyapOne — Website Configuration Types [VO-040]
 *
 * Defines the core types and interfaces for structured, versioned website configurations.
 * Aligns with PRD FINAL v2 §6.14, §15.3, §16.
 */

import type { Database } from "@/lib/supabase/types";

export type SiteRow = Database["public"]["Tables"]["sites"]["Row"];
export type SiteInsert = Database["public"]["Tables"]["sites"]["Insert"];
export type SiteUpdate = Database["public"]["Tables"]["sites"]["Update"];

export type SiteVersionRow = Database["public"]["Tables"]["site_versions"]["Row"];
export type SiteVersionInsert = Database["public"]["Tables"]["site_versions"]["Insert"];
export type SiteVersionUpdate = Database["public"]["Tables"]["site_versions"]["Update"];

/**
 * Supported schema versions for website configuration.
 */
export type SchemaVersion = "v1";

/**
 * Canonical approved component library block types (PRD FINAL v2 §15.3).
 * AI assembles only from approved blocks; arbitrary or unapproved blocks are rejected.
 */
export type ApprovedBlockType =
  | "hero"
  | "about"
  | "menu"
  | "catalogue_grid"
  | "gallery"
  | "booking_form"
  | "pricing"
  | "reviews"
  | "offers"
  | "location_map"
  | "contact"
  | "faq"
  | "footer";

/**
 * Color palette tokens for website theme.
 */
export interface ThemeColors {
  primary: string;
  accent: string;
  secondary?: string;
  background: string;
  surface: string;
  text: string;
  muted: string;
}

/**
 * Font family tokens for typography.
 */
export interface ThemeFonts {
  heading: string;
  body: string;
}

/**
 * Corner radius tokens for buttons and containers.
 */
export interface ThemeRadii {
  button: "none" | "sm" | "md" | "lg" | "full";
  card: "none" | "sm" | "md" | "lg";
}

/**
 * Complete theme design token configuration.
 */
export interface ThemeConfig {
  themeId: string;
  colorMode: "light" | "dark" | "auto";
  colors: ThemeColors;
  fonts: ThemeFonts;
  radii: ThemeRadii;
}

/**
 * Action triggered by a call-to-action button.
 */
export type CtaAction =
  "whatsapp_order" | "enquiry" | "booking" | "catalogue" | "phone_call" | "custom_link";

export interface ButtonCta {
  label: string;
  action: CtaAction | string;
  target?: string;
}

/**
 * Props for Hero block.
 */
export interface HeroBlockProps {
  title: string;
  subtitle?: string;
  imageMediaId?: string;
  cta?: ButtonCta;
  secondaryCta?: ButtonCta;
}

/**
 * Props for About block.
 */
export interface AboutBlockProps {
  title: string;
  story: string;
  imageMediaId?: string;
  highlights?: string[];
}

/**
 * Props for Menu block (dynamic data source binding; prices are never hardcoded).
 */
export interface MenuBlockProps {
  title?: string;
  subtitle?: string;
  source: "catalogue";
  categoryIds?: string[];
}

/**
 * Props for Catalogue Grid block (dynamic data source binding).
 */
export interface CatalogueGridBlockProps {
  title?: string;
  source: "catalogue";
  columns?: 2 | 3 | 4;
  featuredOnly?: boolean;
}

/**
 * Props for Gallery block.
 */
export interface GalleryBlockProps {
  title?: string;
  images: Array<{
    mediaId: string;
    caption?: string;
    altText?: string;
  }>;
  columns?: 2 | 3 | 4;
}

/**
 * Props for Booking Form block.
 */
export interface BookingFormBlockProps {
  title?: string;
  serviceIds?: string[];
  requirePhone?: boolean;
  notice?: string;
}

/**
 * Props for Pricing block (dynamic data source binding).
 */
export interface PricingBlockProps {
  title?: string;
  source: "catalogue";
  highlightCategory?: string;
}

/**
 * Props for Reviews block.
 */
export interface ReviewsBlockProps {
  title?: string;
  source: "google_reviews" | "verified_reviews" | "custom";
  customReviews?: Array<{
    author: string;
    rating: number;
    text: string;
    date?: string;
  }>;
}

/**
 * Props for Offers block.
 */
export interface OffersBlockProps {
  title?: string;
  offers: Array<{
    headline: string;
    description: string;
    couponCode?: string;
    expiresAt?: string;
  }>;
}

/**
 * Props for Location Map block (references confirmed business location).
 */
export interface LocationMapBlockProps {
  title?: string;
  addressRef: "business.primary_location";
  showTimings?: boolean;
  showMap?: boolean;
}

/**
 * Props for Contact block.
 */
export interface ContactBlockProps {
  title?: string;
  showPhone?: boolean;
  showWhatsapp?: boolean;
  showEmail?: boolean;
  enableForm?: boolean;
}

/**
 * Props for FAQ block.
 */
export interface FaqBlockProps {
  title?: string;
  items: Array<{
    question: string;
    answer: string;
  }>;
}

/**
 * Props for Footer block.
 */
export interface FooterBlockProps {
  copyright?: string;
  showPoweredBy: boolean;
  socialLinks?: Array<{
    platform: "whatsapp" | "instagram" | "facebook" | "youtube" | "x" | "google_maps";
    url: string;
  }>;
  links?: Array<{
    label: string;
    href: string;
  }>;
}

/**
 * Ordered Section configuration inside a page.
 */
export interface SectionConfig {
  id: string;
  type: ApprovedBlockType;
  variant?: string;
  isEnabled?: boolean;
  props: Record<string, unknown>;
}

/**
 * SEO metadata for a page or website.
 */
export interface PageSeoConfig {
  title?: string;
  metaDescription?: string;
  ogImageMediaId?: string;
  noIndex?: boolean;
}

/**
 * Page configuration.
 */
export interface PageConfig {
  id: string;
  slug: string;
  title: string;
  isPublished?: boolean;
  seo?: PageSeoConfig;
  sections: SectionConfig[];
}

/**
 * Header and navigation configuration.
 */
export interface HeaderConfig {
  logoMediaId?: string;
  logoText?: string;
  navLinks: Array<{
    label: string;
    href: string;
    isExternal?: boolean;
  }>;
  cta?: ButtonCta;
}

/**
 * Site metadata configuration.
 */
export interface SiteMetadataConfig {
  title: string;
  description?: string;
  subdomain: string;
  primaryDomain?: string | null;
  faviconMediaId?: string | null;
  defaultLocale: string;
  supportedLocales: string[];
}

/**
 * Complete, structured, versioned website configuration document (v1).
 */
export interface WebsiteConfiguration {
  schemaVersion: SchemaVersion;
  siteId: string;
  businessId: string;
  presetId?: string;
  metadata: SiteMetadataConfig;
  theme: ThemeConfig;
  header: HeaderConfig;
  footer: FooterBlockProps;
  pages: PageConfig[];
  modules: Record<string, { enabled: boolean; config?: Record<string, unknown> }>;
}

/**
 * Result returned upon saving a site draft configuration.
 */
export interface SaveSiteDraftResult {
  site: SiteRow;
  version: SiteVersionRow;
  configuration: WebsiteConfiguration;
}

/**
 * Safe summary of an authorized media item for website editor selection.
 * Excludes private storage tokens and sensitive metadata.
 */
export interface MediaItemSummary {
  id: string;
  originalFilename: string;
  category: string;
  fileSizeBytes: number;
  width: number | null;
  height: number | null;
  isPublic: boolean;
  status: string;
  url?: string;
}

/**
 * Backing platform module operational status for website blocks.
 */
export type ModuleOperationalStatus = "operational" | "informational" | "coming_soon" | "disabled";

export interface ModuleRenderStatus {
  status: ModuleOperationalStatus;
  isEnabled: boolean;
  name?: string;
  category?: string;
  notice?: string;
}

/**
 * Server Action result wrapper.
 */
export type WebsiteActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string; validationErrors?: Record<string, string[]> };

export type SiteDomainRow = Database["public"]["Tables"]["site_domains"]["Row"];
export type SiteDomainInsert = Database["public"]["Tables"]["site_domains"]["Insert"];
export type SiteDomainUpdate = Database["public"]["Tables"]["site_domains"]["Update"];

export type QrCodeRow = Database["public"]["Tables"]["qr_codes"]["Row"];
export type QrCodeInsert = Database["public"]["Tables"]["qr_codes"]["Insert"];
export type QrCodeUpdate = Database["public"]["Tables"]["qr_codes"]["Update"];

/**
 * Pre-publish check severity level [VO-049].
 */
export type PrePublishCheckSeverity = "error" | "warning";

/**
 * Pre-publish check category [VO-049].
 */
export type PrePublishCheckCategory =
  | "business_facts"
  | "site_metadata"
  | "navigation"
  | "media"
  | "blocks"
  | "modules"
  | "plan_capacity";

/**
 * Individual pre-publish validation check result [VO-049].
 */
export interface PrePublishCheckItem {
  id: string;
  category: PrePublishCheckCategory;
  severity: PrePublishCheckSeverity;
  title: string;
  message: string;
  navigationPath?: string;
  details?: Record<string, unknown>;
}

/**
 * Complete pre-publish validation result [VO-049].
 */
export interface PrePublishValidationResult {
  isValid: boolean;
  canPublish: boolean;
  errorCount: number;
  warningCount: number;
  checks: PrePublishCheckItem[];
  validatedAt: string;
  siteId: string;
  draftVersionId?: string;
  planCapacity?: {
    currentPublishedSites: number;
    maxPublishedSites: number;
    allowed: boolean;
    reason?: string;
  };
}

/**
 * Result of publishing a site draft [VO-049].
 */
export interface PublishSiteResult {
  site: SiteRow;
  publishedVersion: SiteVersionRow;
  mainQrCode?: QrCodeRow;
  platformUrl: string;
  customDomainUrl?: string;
  qrSvg?: string;
}

/**
 * Custom domain verification and status types [VO-049].
 */
export type DomainVerificationMethod = "dns_txt" | "dns_cname";
export type DomainStatus = "pending_verification" | "verified" | "active" | "failed" | "suspended";

export interface DomainDnsInstructions {
  domain: string;
  recordType: "TXT" | "CNAME";
  host: string;
  value: string;
  status: DomainStatus;
}

/**
 * QR Code dynamic destination configuration [VO-049].
 */
export type QrCodeType = "main_storefront" | "page" | "custom_destination";
export type QrCodeStatus = "active" | "inactive" | "archived";

export interface QrDestinationConfig {
  type: "storefront" | "page" | "internal_path";
  path?: string;
  pageSlug?: string;
  utmParams?: {
    source?: string;
    medium?: string;
    campaign?: string;
  };
}

/**
 * Lightweight summary of a site version for listing history [VO-048].
 */
export interface SiteVersionSummary {
  id: string;
  siteId: string;
  businessId: string;
  versionNumber: number;
  schemaVersion: string;
  changeSummary: string | null;
  createdBy: string | null;
  publishedAt: string | null;
  createdAt: string;
  isCurrentDraft: boolean;
  isPublished: boolean;
}

/**
 * Result of querying site version history.
 */
export interface GetSiteVersionsResult {
  versions: SiteVersionRow[];
  summaries: SiteVersionSummary[];
  totalCount: number;
  currentDraftVersionId: string | null;
  publishedVersionId: string | null;
}

/**
 * Result of rolling back a published site version [VO-048].
 */
export interface RollbackPublishedVersionResult {
  site: SiteRow;
  rolledBackToVersion: SiteVersionRow;
  configuration: WebsiteConfiguration;
}

/**
 * Result of restoring a historical version into a new draft [VO-048].
 */
export interface RestoreVersionToDraftResult {
  site: SiteRow;
  version: SiteVersionRow;
  configuration: WebsiteConfiguration;
}
