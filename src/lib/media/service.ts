/**
 * VyapOne — Media Service Layer [VO-032]
 *
 * Implements authorized upload request generation, byte-level upload finalization,
 * tenant isolation, public/private URL resolution, safe deletion, and audit logging.
 *
 * PRD Authority:
 * - PRD FINAL v2 §15.6 Media (Direct uploads, validation, tenant scoping, safe deletion)
 * - PRD FINAL v2 §17.1 Security (Server authorization, tenant isolation)
 * - ADR-003 Storage Candidate & Facade Abstraction
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { assertBusinessAccess, TenantAccessError } from "@/lib/auth/tenant-access";
import { recordAuditEvent } from "@/lib/audit/service";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
import { getStorageProvider, type IStorageProvider } from "./storage";
import {
  deleteMediaSchema,
  finalizeUploadSchema,
  getMediaUrlSchema,
  requestUploadAuthSchema,
} from "./schemas";
import type {
  DeleteMediaInput,
  FinalizeUploadInput,
  GetMediaUrlInput,
  MediaItem,
  RequestUploadAuthInput,
  RequestUploadAuthResult,
} from "./types";
import {
  CATEGORY_CONSTRAINTS,
  generateTenantObjectKey,
  MediaValidationError,
  MIME_TO_EXTENSION,
  sanitizeFilename,
  validateUploadDeclaration,
  validateUploadedBytes,
} from "./validation";

function mapMediaRow(
  row: Database["public"]["Tables"]["media_items"]["Row"],
  url?: string,
): MediaItem {
  return {
    id: row.id,
    businessId: row.business_id,
    workspaceId: row.workspace_id,
    uploadedBy: row.uploaded_by,
    category: row.category,
    bucket: row.bucket,
    objectKey: row.object_key,
    originalFilename: row.original_filename,
    declaredContentType: row.declared_content_type,
    detectedContentType: row.detected_content_type,
    fileSizeBytes: Number(row.file_size_bytes),
    width: row.width,
    height: row.height,
    isPublic: row.is_public,
    status: row.status,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    expiresAt: row.expires_at,
    verifiedAt: row.verified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    url,
  };
}

export class MediaService {
  private readonly adminClient: SupabaseClient<Database>;

  constructor(
    private readonly supabase: SupabaseClient<Database>,
    private readonly storageProvider: IStorageProvider = getStorageProvider(),
    adminSupabase?: SupabaseClient<Database>,
  ) {
    if (adminSupabase) {
      this.adminClient = adminSupabase;
    } else if (process.env.NODE_ENV === "test") {
      this.adminClient = this.supabase;
    } else {
      this.adminClient = createAdminSupabaseClient();
    }
  }

  /**
   * Authorizes a direct upload to cloud storage.
   *
   * 1. Enforces caller authorization on target business.
   * 2. Validates declared file size and MIME type against category constraints.
   * 3. Allocates unpredictable UUID and deterministic tenant-scoped object key.
   * 4. Inserts pending record in database with short-lived expiration TTL.
   * 5. Generates presigned upload URL and records audit log.
   */
  async requestUploadAuthorization(
    input: RequestUploadAuthInput,
  ): Promise<RequestUploadAuthResult> {
    const validated = requestUploadAuthSchema.parse(input);
    const businessContext = await assertBusinessAccess(this.supabase, validated.businessId);

    // Validate category constraints
    validateUploadDeclaration({
      category: validated.category,
      filename: validated.filename,
      fileSizeBytes: validated.fileSizeBytes,
      contentType: validated.contentType,
    });

    const constraints = CATEGORY_CONSTRAINTS[validated.category];
    const mediaId = crypto.randomUUID();
    const sanitizedName = sanitizeFilename(validated.filename);

    // Resolve extension
    const mimeExt = MIME_TO_EXTENSION[validated.contentType.toLowerCase()];
    const nameExt = sanitizedName.includes(".")
      ? sanitizedName.substring(sanitizedName.lastIndexOf(".") + 1)
      : "";
    const effectiveExt = mimeExt ?? nameExt ?? "bin";

    const objectKey = generateTenantObjectKey(
      validated.businessId,
      validated.category,
      mediaId,
      effectiveExt,
    );

    const ttlSeconds = 900; // 15 minutes
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

    // 1. Insert pending record into database using administrative client
    const { error: insertErr } = await this.adminClient.from("media_items").insert({
      id: mediaId,
      business_id: validated.businessId,
      workspace_id: businessContext.business.workspace_id,
      uploaded_by: businessContext.callerUserId,
      category: validated.category,
      bucket: constraints.bucket,
      object_key: objectKey,
      original_filename: sanitizedName,
      declared_content_type: validated.contentType.toLowerCase(),
      file_size_bytes: validated.fileSizeBytes,
      is_public: constraints.isPublic,
      status: "pending_upload",
      metadata: (validated.metadata ?? {}) as import("@/lib/supabase/types").Json,
      expires_at: expiresAt,
    });

    if (insertErr) {
      throw new Error(`Failed to initialize media record: ${insertErr.message}`);
    }

    // 2. Generate signed upload URL from storage provider
    const signedUpload = await this.storageProvider.createSignedUploadUrl({
      bucket: constraints.bucket,
      key: objectKey,
      expiresInSeconds: ttlSeconds,
      contentType: validated.contentType,
      maxSizeBytes: constraints.maxSizeBytes,
    });

    // 3. Record audit event
    await recordAuditEvent(this.supabase, {
      businessId: validated.businessId,
      workspaceId: businessContext.business.workspace_id,
      actorUserId: businessContext.callerUserId,
      action: "media.upload_requested",
      resource: "media_items",
      metadata: {
        mediaId,
        category: validated.category,
        filename: sanitizedName,
        fileSizeBytes: validated.fileSizeBytes,
        contentType: validated.contentType,
      },
    });

    return {
      mediaId,
      businessId: validated.businessId,
      category: validated.category,
      objectKey,
      bucket: constraints.bucket,
      uploadUrl: signedUpload.uploadUrl,
      token: signedUpload.token,
      headers: signedUpload.headers,
      expiresAt,
    };
  }

  /**
   * Finalizes direct upload by reading and verifying stored bytes.
   *
   * 1. Asserts caller authorization on target business.
   * 2. Reads initial file header from storage.
   * 3. Verifies magic bytes, dimensions, SVG security, and MIME matching.
   * 4. Updates record status to 'ready' or 'failed'.
   * 5. Records audit log.
   */
  async finalizeMediaUpload(input: FinalizeUploadInput): Promise<MediaItem> {
    const validated = finalizeUploadSchema.parse(input);
    const businessContext = await assertBusinessAccess(this.supabase, validated.businessId);

    // Fetch existing pending media item
    const { data: row, error: fetchErr } = await this.supabase
      .from("media_items")
      .select("*")
      .eq("id", validated.mediaId)
      .eq("business_id", validated.businessId)
      .maybeSingle();

    if (fetchErr || !row) {
      throw new TenantAccessError("Media item not found", "NOT_FOUND", 404);
    }

    if (row.status === "ready") {
      const url = await this.resolveItemUrl(row);
      return mapMediaRow(row, url);
    }

    if (row.status === "archived" || row.status === "deletion_pending") {
      throw new MediaValidationError(
        "Cannot finalize an archived or deleting media item",
        "MALICIOUS_CONTENT",
      );
    }

    if (row.status === "failed") {
      throw new MediaValidationError("Media item verification previously failed.", "CORRUPT_FILE");
    }

    // Verify authorization expiration
    if (row.status === "pending_upload" && row.expires_at) {
      if (new Date(row.expires_at).getTime() < Date.now()) {
        await this.adminClient
          .from("media_items")
          .update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("id", row.id);

        throw new MediaValidationError(
          "Upload authorization has expired. Please initiate a new upload request.",
          "EXPIRED_AUTHORIZATION",
        );
      }
    }

    // Read stored bytes for verification (up to 64KB is sufficient for magic bytes, SOF/IHDR headers and SVGs)
    const storedBytes = await this.storageProvider.getObjectBytes({
      bucket: row.bucket,
      key: row.object_key,
      maxBytes: 65536,
    });

    if (!storedBytes || storedBytes.length === 0) {
      await this.adminClient
        .from("media_items")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", row.id);

      throw new MediaValidationError(
        "Uploaded file content not found in storage. Upload may have failed or timed out.",
        "UNSUPPORTED_TYPE",
      );
    }

    try {
      // Validate magic bytes, dimensions and SVG security
      const inspection = validateUploadedBytes({
        category: row.category as MediaItem["category"],
        bytes: storedBytes,
        declaredContentType: row.declared_content_type,
      });

      // Fetch actual metadata from storage if available
      const metadata = await this.storageProvider.getObjectMetadata({
        bucket: row.bucket,
        key: row.object_key,
      });

      const actualSize = metadata?.size ?? row.file_size_bytes;

      const now = new Date().toISOString();
      const { data: updatedRow, error: updateErr } = await this.adminClient
        .from("media_items")
        .update({
          status: "ready",
          detected_content_type: inspection.detectedContentType,
          file_size_bytes: actualSize,
          width: inspection.width ?? null,
          height: inspection.height ?? null,
          verified_at: now,
          updated_at: now,
        })
        .eq("id", row.id)
        .select()
        .single();

      if (updateErr || !updatedRow) {
        throw new Error(`Failed to update media status: ${updateErr?.message}`);
      }

      await recordAuditEvent(this.supabase, {
        businessId: validated.businessId,
        workspaceId: businessContext.business.workspace_id,
        actorUserId: businessContext.callerUserId,
        action: "media.upload_finalized",
        resource: "media_items",
        metadata: {
          mediaId: row.id,
          detectedContentType: inspection.detectedContentType,
          width: inspection.width,
          height: inspection.height,
          fileSizeBytes: actualSize,
        },
      });

      const url = await this.resolveItemUrl(updatedRow);
      return mapMediaRow(updatedRow, url);
    } catch (err) {
      // Mark as failed in DB using admin client
      await this.adminClient
        .from("media_items")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", row.id);

      await recordAuditEvent(this.supabase, {
        businessId: validated.businessId,
        workspaceId: businessContext.business.workspace_id,
        actorUserId: businessContext.callerUserId,
        action: "media.upload_failed",
        resource: "media_items",
        metadata: {
          mediaId: row.id,
          reason: err instanceof Error ? err.message : String(err),
        },
      });

      throw err;
    }
  }

  /**
   * Resolves a downloadable / viewable URL for a media item.
   * Public assets use permanent CDN URLs. Private assets use short-lived presigned URLs.
   */
  async getMediaUrl(input: GetMediaUrlInput): Promise<string> {
    const validated = getMediaUrlSchema.parse(input);

    const { data: row, error: fetchErr } = await this.supabase
      .from("media_items")
      .select("*")
      .eq("id", validated.mediaId)
      .eq("business_id", validated.businessId)
      .maybeSingle();

    if (fetchErr || !row) {
      throw new TenantAccessError("Media item not found", "NOT_FOUND", 404);
    }

    if (row.is_public && row.status === "ready") {
      return this.storageProvider.getPublicUrl({
        bucket: row.bucket,
        key: row.object_key,
      });
    }

    // Private asset requires business authorization check
    await assertBusinessAccess(this.supabase, validated.businessId);

    return this.storageProvider.createSignedReadUrl({
      bucket: row.bucket,
      key: row.object_key,
      expiresInSeconds: validated.expiresInSeconds ?? 3600,
    });
  }

  /**
   * Deletes a media item using a safe two-phase deletion lifecycle:
   * 1. Mark status as 'deletion_pending' in DB
   * 2. Remove object from storage
   * 3. Mark status as 'archived' in DB
   * If storage removal fails, the item remains in 'deletion_pending' for retry.
   */
  async deleteMediaItem(input: DeleteMediaInput): Promise<boolean> {
    const validated = deleteMediaSchema.parse(input);
    const businessContext = await assertBusinessAccess(this.supabase, validated.businessId);

    const { data: row, error: fetchErr } = await this.supabase
      .from("media_items")
      .select("*")
      .eq("id", validated.mediaId)
      .eq("business_id", validated.businessId)
      .maybeSingle();

    if (fetchErr || !row) {
      throw new TenantAccessError("Media item not found", "NOT_FOUND", 404);
    }

    if (row.status === "archived") {
      return true; // Already archived idempotency
    }

    const now = new Date().toISOString();

    // Phase 1: Mark as deletion_pending in database
    await this.adminClient
      .from("media_items")
      .update({
        status: "deletion_pending",
        updated_at: now,
      })
      .eq("id", row.id);

    // Phase 2: Delete object from storage provider
    try {
      await this.storageProvider.deleteObject({
        bucket: row.bucket,
        key: row.object_key,
      });
    } catch (storageErr) {
      // Storage deletion failed: Record failure and leave in deletion_pending for reconciliation retry
      await recordAuditEvent(this.supabase, {
        businessId: validated.businessId,
        workspaceId: businessContext.business.workspace_id,
        actorUserId: businessContext.callerUserId,
        action: "media.deletion_failed",
        resource: "media_items",
        metadata: {
          mediaId: row.id,
          error: storageErr instanceof Error ? storageErr.message : String(storageErr),
          status: "deletion_pending",
        },
      });

      throw new Error(
        `Failed to remove media object from storage: ${storageErr instanceof Error ? storageErr.message : "unknown storage error"}`,
      );
    }

    // Phase 3: Mark as archived in database
    await this.adminClient
      .from("media_items")
      .update({
        status: "archived",
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    // Record audit event
    await recordAuditEvent(this.supabase, {
      businessId: validated.businessId,
      workspaceId: businessContext.business.workspace_id,
      actorUserId: businessContext.callerUserId,
      action: "media.deleted",
      resource: "media_items",
      metadata: {
        mediaId: row.id,
        category: row.category,
        objectKey: row.object_key,
      },
    });

    return true;
  }

  /**
   * Reconciles or retries pending deletions that failed storage removal.
   */
  async retryPendingDeletion(input: { mediaId: string; businessId: string }): Promise<boolean> {
    const businessContext = await assertBusinessAccess(this.supabase, input.businessId);

    const { data: row, error: fetchErr } = await this.adminClient
      .from("media_items")
      .select("*")
      .eq("id", input.mediaId)
      .eq("business_id", input.businessId)
      .maybeSingle();

    if (fetchErr || !row) {
      throw new TenantAccessError("Media item not found", "NOT_FOUND", 404);
    }

    if (row.status === "archived") {
      return true;
    }

    if (row.status !== "deletion_pending") {
      throw new Error(`Media item is in status "${row.status}", not "deletion_pending".`);
    }

    await this.storageProvider.deleteObject({
      bucket: row.bucket,
      key: row.object_key,
    });

    await this.adminClient
      .from("media_items")
      .update({
        status: "archived",
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    await recordAuditEvent(this.supabase, {
      businessId: input.businessId,
      workspaceId: businessContext.business.workspace_id,
      actorUserId: businessContext.callerUserId,
      action: "media.deletion_reconciled",
      resource: "media_items",
      metadata: {
        mediaId: row.id,
        category: row.category,
        objectKey: row.object_key,
      },
    });

    return true;
  }

  private async resolveItemUrl(
    row: Database["public"]["Tables"]["media_items"]["Row"],
  ): Promise<string> {
    if (row.is_public && row.status === "ready") {
      return this.storageProvider.getPublicUrl({
        bucket: row.bucket,
        key: row.object_key,
      });
    }
    return this.storageProvider.createSignedReadUrl({
      bucket: row.bucket,
      key: row.object_key,
      expiresInSeconds: 3600,
    });
  }
}
