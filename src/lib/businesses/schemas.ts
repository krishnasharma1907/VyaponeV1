import { z } from "zod";

/**
 * Business slug format: lowercase alphanumeric words separated by hyphens (3–60 chars).
 */
export const businessSlugSchema = z
  .string()
  .trim()
  .min(3, "Slug must be at least 3 characters")
  .max(60, "Slug cannot exceed 60 characters")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug may only contain lowercase letters, numbers, and single hyphens",
  );

/**
 * Location slug format: lowercase alphanumeric words separated by hyphens (2–60 chars).
 */
export const locationSlugSchema = z
  .string()
  .trim()
  .min(2, "Location slug must be at least 2 characters")
  .max(60, "Location slug cannot exceed 60 characters")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug may only contain lowercase letters, numbers, and single hyphens",
  );

/**
 * 6-digit Indian PIN code format.
 */
export const postalCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Postal code must be a valid 6-digit Indian PIN code");

/**
 * Standard Indian Goods and Services Tax Identification Number (GSTIN).
 * 15 characters: 2-digit state code, 10-char PAN, 1-char entity number, 'Z', 1 checksum.
 */
export const gstinSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
    "GSTIN must be a valid 15-character statutory tax identifier",
  );

/**
 * Standard 10-character Indian Permanent Account Number (PAN).
 */
export const panSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "PAN must be a valid 10-character identifier");

/**
 * Business operational roles.
 */
export const businessRoleSchema = z.enum(["owner", "manager", "cashier", "staff"]);

/**
 * Business lifecycle status.
 */
export const businessStatusSchema = z.enum(["active", "onboarding", "suspended", "archived"]);

/**
 * Schema for creating a business with its required primary location.
 */
export const createBusinessSchema = z.object({
  trade_name: z
    .string()
    .trim()
    .min(2, "Trade name must be at least 2 characters")
    .max(100, "Trade name cannot exceed 100 characters"),
  legal_name: z
    .string()
    .trim()
    .min(2, "Legal name must be at least 2 characters")
    .max(100, "Legal name cannot exceed 100 characters"),
  slug: businessSlugSchema.optional(),
  workspace_id: z.string().uuid("Invalid workspace ID").nullable().optional(),
  gst_number: gstinSchema.nullable().optional(),
  pan_number: panSchema.nullable().optional(),
  // Primary location fields
  location_name: z
    .string()
    .trim()
    .min(2, "Location name must be at least 2 characters")
    .max(100, "Location name cannot exceed 100 characters")
    .default("Main Store"),
  address_line1: z
    .string()
    .trim()
    .min(3, "Address line 1 must be at least 3 characters")
    .max(150, "Address line 1 cannot exceed 150 characters"),
  address_line2: z
    .string()
    .trim()
    .max(150, "Address line 2 cannot exceed 150 characters")
    .nullable()
    .optional(),
  city: z
    .string()
    .trim()
    .min(2, "City must be at least 2 characters")
    .max(60, "City cannot exceed 60 characters"),
  state: z
    .string()
    .trim()
    .min(2, "State must be at least 2 characters")
    .max(60, "State cannot exceed 60 characters"),
  postal_code: postalCodeSchema,
});

export type CreateBusinessInput = z.input<typeof createBusinessSchema>;
export type CreateBusinessOutput = z.infer<typeof createBusinessSchema>;

/**
 * Schema for updating a business's core statutory & profile details.
 */
export const updateBusinessProfileSchema = z.object({
  trade_name: z
    .string()
    .trim()
    .min(2, "Trade name must be at least 2 characters")
    .max(100, "Trade name cannot exceed 100 characters")
    .optional(),
  legal_name: z
    .string()
    .trim()
    .min(2, "Legal name must be at least 2 characters")
    .max(100, "Legal name cannot exceed 100 characters")
    .optional(),
  gst_number: gstinSchema.nullable().optional(),
  pan_number: panSchema.nullable().optional(),
  status: businessStatusSchema.optional(),
});

export type UpdateBusinessProfileInput = z.input<typeof updateBusinessProfileSchema>;

/**
 * Schema for creating a location under a business.
 */
export const createLocationSchema = z.object({
  business_id: z.string().uuid("Invalid business ID"),
  name: z
    .string()
    .trim()
    .min(2, "Location name must be at least 2 characters")
    .max(100, "Location name cannot exceed 100 characters"),
  slug: locationSlugSchema.optional(),
  address_line1: z
    .string()
    .trim()
    .min(3, "Address line 1 must be at least 3 characters")
    .max(150, "Address line 1 cannot exceed 150 characters"),
  address_line2: z
    .string()
    .trim()
    .max(150, "Address line 2 cannot exceed 150 characters")
    .nullable()
    .optional(),
  city: z
    .string()
    .trim()
    .min(2, "City must be at least 2 characters")
    .max(60, "City cannot exceed 60 characters"),
  state: z
    .string()
    .trim()
    .min(2, "State must be at least 2 characters")
    .max(60, "State cannot exceed 60 characters"),
  postal_code: postalCodeSchema,
  is_primary: z.boolean().default(false),
});

export type CreateLocationInput = z.input<typeof createLocationSchema>;

/**
 * Schema for updating an existing location.
 */
export const updateLocationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Location name must be at least 2 characters")
    .max(100, "Location name cannot exceed 100 characters")
    .optional(),
  slug: locationSlugSchema.optional(),
  address_line1: z
    .string()
    .trim()
    .min(3, "Address line 1 must be at least 3 characters")
    .max(150, "Address line 1 cannot exceed 150 characters")
    .optional(),
  address_line2: z
    .string()
    .trim()
    .max(150, "Address line 2 cannot exceed 150 characters")
    .nullable()
    .optional(),
  city: z
    .string()
    .trim()
    .min(2, "City must be at least 2 characters")
    .max(60, "City cannot exceed 60 characters")
    .optional(),
  state: z
    .string()
    .trim()
    .min(2, "State must be at least 2 characters")
    .max(60, "State cannot exceed 60 characters")
    .optional(),
  postal_code: postalCodeSchema.optional(),
  is_primary: z.boolean().optional(),
});

export type UpdateLocationInput = z.input<typeof updateLocationSchema>;

/**
 * Schema for adding an operational team member to a business.
 */
export const addBusinessMemberSchema = z.object({
  business_id: z.string().uuid("Invalid business ID"),
  user_id: z.string().uuid("Invalid user ID"),
  role: businessRoleSchema,
  location_id: z.string().uuid("Invalid location ID").nullable().optional(),
  permissions: z.record(z.string(), z.boolean()).default({}),
});

export type AddBusinessMemberInput = z.input<typeof addBusinessMemberSchema>;

/**
 * Schema for modifying an operational team member's role or status.
 */
export const updateBusinessMemberRoleSchema = z.object({
  role: businessRoleSchema.optional(),
  location_id: z.string().uuid("Invalid location ID").nullable().optional(),
  permissions: z.record(z.string(), z.boolean()).optional(),
  status: z.enum(["active", "invited", "deactivated"]).optional(),
});

export type UpdateBusinessMemberRoleInput = z.input<typeof updateBusinessMemberRoleSchema>;
