/**
 * VyapOne — Media Domain Types [VO-032]
 *
 * Domain models and request/response contracts for secure media pipeline.
 *
 * PRD Authority:
 * - PRD FINAL v2 §15.6: Media
 * - PRD FINAL v2 §16: Initial Data Model
 * - PRD FINAL v2 §17: Security & Tenant Isolation
 */

import type { MediaCategory } from "./validation";

export type { MediaCategory };

export type MediaStatus = "pending_upload" | "ready" | "failed" | "archived";

export interface MediaItem {
  id: string;
  businessId: string;
  workspaceId: string | null;
  uploadedBy: string;
  category: MediaCategory;
  bucket: "vyapone-public-media" | "vyapone-private-media";
  objectKey: string;
  originalFilename: string;
  declaredContentType: string;
  detectedContentType: string | null;
  fileSizeBytes: number;
  width: number | null;
  height: number | null;
  isPublic: boolean;
  status: MediaStatus;
  metadata: Record<string, unknown>;
  expiresAt: string | null;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  url?: string;
}

export interface RequestUploadAuthInput {
  businessId: string;
  category: MediaCategory;
  filename: string;
  fileSizeBytes: number;
  contentType: string;
  metadata?: Record<string, unknown>;
}

export interface RequestUploadAuthResult {
  mediaId: string;
  businessId: string;
  category: MediaCategory;
  objectKey: string;
  bucket: string;
  uploadUrl: string;
  token?: string;
  headers?: Record<string, string>;
  expiresAt: string;
}

export interface FinalizeUploadInput {
  businessId: string;
  mediaId: string;
}

export interface DeleteMediaInput {
  businessId: string;
  mediaId: string;
}

export interface GetMediaUrlInput {
  businessId: string;
  mediaId: string;
  expiresInSeconds?: number;
}
