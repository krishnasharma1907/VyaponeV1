/**
 * VyapOne — Storage Provider Abstraction Types [VO-032]
 *
 * Pluggable storage provider interface conforming to ADR-003.
 * Decouples domain logic from specific cloud object stores (Supabase Storage, Cloudflare R2, AWS S3).
 */

export interface CreateSignedUploadUrlParams {
  bucket: string;
  key: string;
  expiresInSeconds: number;
  contentType: string;
  maxSizeBytes?: number;
}

export interface SignedUploadUrlResult {
  uploadUrl: string;
  token?: string;
  headers?: Record<string, string>;
  expiresAt: string;
}

export interface CreateSignedReadUrlParams {
  bucket: string;
  key: string;
  expiresInSeconds: number;
}

export interface ObjectMetadata {
  size: number;
  contentType?: string;
  etag?: string;
  lastModified?: string;
}

export interface IStorageProvider {
  /**
   * Generates a short-lived presigned upload URL allowing the client to directly PUT or POST the asset.
   */
  createSignedUploadUrl(params: CreateSignedUploadUrlParams): Promise<SignedUploadUrlResult>;

  /**
   * Generates a short-lived presigned read URL for private objects.
   */
  createSignedReadUrl(params: CreateSignedReadUrlParams): Promise<string>;

  /**
   * Returns the permanent public CDN / bucket URL for public assets.
   */
  getPublicUrl(params: { bucket: string; key: string }): string;

  /**
   * Retrieves object metadata (size, content type, etag) without downloading the entire body.
   */
  getObjectMetadata(params: { bucket: string; key: string }): Promise<ObjectMetadata | null>;

  /**
   * Fetches object byte content (optionally up to maxBytes for header/magic byte inspection).
   */
  getObjectBytes(params: {
    bucket: string;
    key: string;
    maxBytes?: number;
  }): Promise<Uint8Array | null>;

  /**
   * Direct upload method used by server-side processes or test fixtures.
   */
  uploadObject(params: {
    bucket: string;
    key: string;
    data: Uint8Array | ArrayBuffer | Buffer;
    contentType: string;
  }): Promise<void>;

  /**
   * Deletes an object from storage. Returns true if deleted or not found.
   */
  deleteObject(params: { bucket: string; key: string }): Promise<boolean>;
}
