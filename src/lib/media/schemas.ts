/**
 * VyapOne — Media Input Validation Schemas [VO-032]
 */

import { z } from "zod";

export const mediaCategorySchema = z.enum([
  "business_logo",
  "catalogue_image",
  "website_asset",
  "document_attachment",
  "onboarding_upload",
]);

export const requestUploadAuthSchema = z.object({
  businessId: z.string().uuid("Invalid business UUID"),
  category: mediaCategorySchema,
  filename: z.string().min(1, "Filename cannot be empty").max(255, "Filename too long"),
  fileSizeBytes: z.number().int().positive("File size must be positive"),
  contentType: z.string().min(1, "Content type required"),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const finalizeUploadSchema = z.object({
  businessId: z.string().uuid("Invalid business UUID"),
  mediaId: z.string().uuid("Invalid media UUID"),
});

export const publishMediaSchema = z.object({
  businessId: z.string().uuid("Invalid business UUID"),
  mediaId: z.string().uuid("Invalid media UUID"),
  resourceType: z
    .enum(["website", "catalogue", "logo", "standalone"])
    .optional()
    .default("standalone"),
  resourceId: z.string().max(128).optional(),
});

export const unpublishMediaSchema = z.object({
  businessId: z.string().uuid("Invalid business UUID"),
  mediaId: z.string().uuid("Invalid media UUID"),
});

export const reconcileExpiredUploadsSchema = z.object({
  businessId: z.string().uuid("Invalid business UUID").optional(),
});

export const deleteMediaSchema = z.object({
  businessId: z.string().uuid("Invalid business UUID"),
  mediaId: z.string().uuid("Invalid media UUID"),
});

export const getMediaUrlSchema = z.object({
  businessId: z.string().uuid("Invalid business UUID"),
  mediaId: z.string().uuid("Invalid media UUID"),
  expiresInSeconds: z.number().int().min(60).max(86400).optional().default(3600),
});
