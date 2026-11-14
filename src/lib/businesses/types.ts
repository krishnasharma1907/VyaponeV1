import type { Database } from "@/lib/supabase/types";

export type BusinessRow = Database["public"]["Tables"]["businesses"]["Row"];
export type BusinessInsert = Database["public"]["Tables"]["businesses"]["Insert"];
export type BusinessUpdate = Database["public"]["Tables"]["businesses"]["Update"];

export type LocationRow = Database["public"]["Tables"]["locations"]["Row"];
export type LocationInsert = Database["public"]["Tables"]["locations"]["Insert"];
export type LocationUpdate = Database["public"]["Tables"]["locations"]["Update"];

export type BusinessMemberRow = Database["public"]["Tables"]["business_members"]["Row"];
export type BusinessMemberInsert = Database["public"]["Tables"]["business_members"]["Insert"];
export type BusinessMemberUpdate = Database["public"]["Tables"]["business_members"]["Update"];

/**
 * Business operational roles in public.business_members.
 */
export type BusinessRole = "owner" | "manager" | "cashier" | "staff";

/**
 * Business lifecycle status.
 */
export type BusinessStatus = "active" | "onboarding" | "suspended" | "archived";

/**
 * Statutory GST tax scheme.
 */
export type BusinessTaxScheme = "registered" | "composition" | "unregistered" | "exempt";

/**
 * Business contact channels configuration.
 */
export interface ContactConfiguration {
  primary_phone?: string | null;
  secondary_phone?: string | null;
  whatsapp_number?: string | null;
  email?: string | null;
  website?: string | null;
}

/**
 * Registered business address configuration.
 */
export interface AddressConfiguration {
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
}

/**
 * Operating timings for a single day.
 */
export interface DayTimings {
  open?: string;
  close?: string;
  closed?: boolean;
}

/**
 * 7-day business operating schedule and holiday notes.
 */
export interface TimingsConfiguration {
  monday?: DayTimings;
  tuesday?: DayTimings;
  wednesday?: DayTimings;
  thursday?: DayTimings;
  friday?: DayTimings;
  saturday?: DayTimings;
  sunday?: DayTimings;
  holiday_notes?: string;
}

/**
 * Provenance tracking for sensitive business facts.
 */
export interface FactProvenance {
  confirmed: boolean;
  source:
    "user_input" | "user_confirmed" | "ai_extracted" | "gst_portal" | "imported" | "unverified";
  confirmed_at?: string;
  confirmed_by?: string;
}

export type FactsProvenanceMap = Record<string, FactProvenance>;

/**
 * Granular permissions within a business context.
 */
export type BusinessPermission =
  | "business:view"
  | "business:update_profile"
  | "business:delete"
  | "business:manage_locations"
  | "business:manage_members"
  | "business:transfer_ownership"
  | "business:billing"
  | "business:view_reports";

/**
 * Business member with associated user profile.
 */
export interface BusinessMemberWithProfile {
  id: string;
  business_id: string;
  user_id: string;
  role: BusinessRole;
  location_id: string | null;
  permissions: Record<string, boolean>;
  status: "active" | "invited" | "deactivated";
  created_at: string;
  user: {
    id: string;
    display_name: string;
    email: string | null;
    phone_number: string | null;
  };
}

/**
 * Full business representation with primary location and all registered locations.
 */
export interface BusinessWithLocations {
  business: BusinessRow;
  primaryLocation: LocationRow | null;
  locations: LocationRow[];
  currentUserRole: BusinessRole;
  isSovereignOwner: boolean;
}

/**
 * Lightweight business summary for selection switchers and list views.
 */
export interface BusinessSummary {
  id: string;
  trade_name: string;
  legal_name: string;
  slug: string;
  status: BusinessStatus;
  workspace_id: string | null;
  sovereign_owner_id: string;
  isPrimaryLocationConfigured: boolean;
  currentUserRole: BusinessRole;
}

/**
 * Generic result format for business Server Actions.
 */
export type BusinessActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string; code: string; validationErrors?: Record<string, string[]> };
