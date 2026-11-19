/**
 * VyapOne — Business Import & Confirmation Review Types [VO-034]
 *
 * Models the staging, parsing, confidence scoring, evidence tracking,
 * and explicit human confirmation workflow for external business imports.
 *
 * Core Invariant:
 * Every extracted price, timing, address, tax identifier, and material fact
 * remains "unconfirmed" (To Confirm) until a human user explicitly accepts it.
 * No business records are created or mutated without confirmed approval.
 */

export type ImportSourceFormat = "json" | "csv" | "text";

export type ImportConfidenceLevel = "high" | "medium" | "low";

export type ImportFieldStatus = "unconfirmed" | "confirmed" | "rejected" | "edited";

export type ImportFieldCategory =
  "identity" | "contact" | "location" | "tax" | "timings" | "catalogue";

/**
 * A single extracted piece of business information under review.
 */
export interface ImportReviewField<T = unknown> {
  /** Unique deterministic identifier for this field inside the proposal */
  id: string;
  /** Broad operational category */
  category: ImportFieldCategory;
  /** Internal schema attribute name (e.g. 'trade_name', 'postal_code', 'price_minor') */
  fieldName: string;
  /** Human-readable label displayed to the reviewer */
  label: string;
  /** Raw textual value as found in the source snippet */
  rawValue: string;
  /** Parsed, typed value (e.g. number for price, structured timing object) */
  extractedValue: T;
  /** Edited value if the user modified the field */
  editedValue?: T;
  /** Exact snippet or line citation from the source input */
  sourceEvidence: string;
  /** Confidence categorization */
  confidence: ImportConfidenceLevel;
  /** Normalized confidence score between 0.0 and 1.0 */
  confidenceScore: number;
  /** Review status: defaults strictly to 'unconfirmed' */
  status: ImportFieldStatus;
  /** Human confirmation timestamp (ISO 8601) */
  confirmedAt?: string;
  /** Validation error message if the extracted value does not satisfy platform schemas */
  validationError?: string;
  /** Whether this fact has material business or financial consequence (prices, tax, timings, phone) */
  isMaterial: boolean;
  /** Whether this field is mandatory for business provisioning */
  isRequired: boolean;
}

/**
 * Extracted catalogue item under review.
 */
export interface ExtractedCatalogueItem {
  title: string;
  priceMinor: number;
  currencyCode: string;
  description?: string;
  category?: string;
  sku?: string;
}

/**
 * Aggregated statistics for the import review session.
 */
export interface ImportProposalStats {
  totalFields: number;
  confirmedCount: number;
  unconfirmedCount: number;
  rejectedCount: number;
  editedCount: number;
  materialTotalCount: number;
  materialUnconfirmedCount: number;
  requiredTotalCount: number;
  requiredUnconfirmedCount: number;
  hasErrors: boolean;
  completionPercentage: number;
}

/**
 * Staged import proposal awaiting human confirmation.
 */
export interface BusinessImportProposal {
  id: string;
  workspaceId: string;
  sourceFormat: ImportSourceFormat;
  sourceFileName?: string;
  createdAt: string;
  fields: ImportReviewField[];
  stats: ImportProposalStats;
  isReadyForProvisioning: boolean;
  blockingReasons: string[];
}

/**
 * Confirmed data payload ready for atomic business creation.
 */
export interface ConfirmedBusinessImportPayload {
  workspaceId: string;
  tradeName: string;
  legalName?: string;
  slug?: string;
  nicheSlug: string;
  nicheGroupSlug?: string;
  description?: string;
  primaryLocation: {
    name: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    postalCode: string;
  };
  contact: {
    primaryPhone: string;
    secondaryPhone?: string;
    whatsappNumber?: string;
    email?: string;
  };
  taxScheme: "registered" | "composition" | "unregistered" | "exempt";
  gstNumber?: string;
  panNumber?: string;
  timings?: Record<string, { open?: string; close?: string; closed?: boolean }>;
  catalogueItems?: ExtractedCatalogueItem[];
  sourceFormat: ImportSourceFormat;
  reviewedFieldsCount: number;
}

/**
 * Result returned upon successful execution of confirmed import.
 */
export interface ConfirmedImportResult {
  business: {
    id: string;
    trade_name: string;
    legal_name: string | null;
    slug: string;
    status: string;
    workspace_id: string | null;
    created_at: string;
  };
  primaryLocation: {
    id: string;
    business_id: string;
    name: string;
    slug: string;
    is_primary: boolean;
    city: string;
    state: string;
    postal_code: string;
  };
  catalogueItemsCreated: number;
  auditLogAction: string;
}
