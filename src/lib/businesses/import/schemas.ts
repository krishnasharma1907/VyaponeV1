/**
 * VyapOne — Business Import Schemas [VO-034]
 *
 * Provides Zod validation schemas for:
 * 1. Initial import parsing requests
 * 2. Field-level human confirmation / rejection / editing
 * 3. Final confirmed import provisioning
 */

import { z } from "zod";

export const importSourceFormatSchema = z.enum(["json", "csv", "text"]);

export const importFieldStatusSchema = z.enum(["unconfirmed", "confirmed", "rejected", "edited"]);

export const importFieldCategorySchema = z.enum([
  "identity",
  "contact",
  "location",
  "tax",
  "timings",
  "catalogue",
]);

export const importConfidenceLevelSchema = z.enum(["high", "medium", "low"]);

/**
 * Schema for initial parse request.
 */
export const parseBusinessImportSchema = z.object({
  workspaceId: z.string().uuid("Invalid workspace ID"),
  format: importSourceFormatSchema,
  content: z
    .string()
    .trim()
    .min(5, "Import content must be at least 5 characters")
    .max(2 * 1024 * 1024, "Import content cannot exceed 2 MB"),
  sourceFileName: z.string().trim().max(255).optional(),
});

export type ParseBusinessImportInput = z.infer<typeof parseBusinessImportSchema>;

/**
 * Schema for updating a single field's review status.
 */
export const updateProposalFieldStatusSchema = z.object({
  fieldId: z.string().min(1, "Field ID is required"),
  status: importFieldStatusSchema,
  editedValue: z.unknown().optional(),
});

export type UpdateProposalFieldStatusInput = z.infer<typeof updateProposalFieldStatusSchema>;

/**
 * Schema for a single review field inside a confirmed proposal.
 */
export const importReviewFieldSchema = z.object({
  id: z.string(),
  category: importFieldCategorySchema,
  fieldName: z.string(),
  label: z.string(),
  rawValue: z.string(),
  extractedValue: z.unknown(),
  editedValue: z.unknown().optional(),
  sourceEvidence: z.string(),
  confidence: importConfidenceLevelSchema,
  confidenceScore: z.number().min(0).max(1),
  status: importFieldStatusSchema,
  confirmedAt: z.string().optional(),
  validationError: z.string().optional(),
  isMaterial: z.boolean(),
  isRequired: z.boolean(),
});

/**
 * Schema for confirming an entire import proposal and provisioning the store.
 */
export const confirmBusinessImportSchema = z.object({
  workspaceId: z.string().uuid("Invalid workspace ID"),
  proposalId: z.string().min(1),
  sourceFormat: importSourceFormatSchema,
  sourceFileName: z.string().optional(),
  fields: z.array(importReviewFieldSchema).min(1, "Proposal must contain at least one field"),
});

export type ConfirmBusinessImportInput = z.infer<typeof confirmBusinessImportSchema>;
