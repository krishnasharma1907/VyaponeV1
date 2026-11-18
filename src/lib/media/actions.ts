"use server";

import { ZodError } from "zod";
import { sanitizeTenantError, TenantAccessError } from "@/lib/auth/tenant-access";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { MediaService } from "./service";
import type {
  DeleteMediaInput,
  FinalizeUploadInput,
  GetMediaUrlInput,
  MediaItem,
  PublishMediaInput,
  ReconcileExpiredUploadsInput,
  ReconcileExpiredUploadsResult,
  RequestUploadAuthInput,
  RequestUploadAuthResult,
  UnpublishMediaInput,
} from "./types";
import { MediaValidationError } from "./validation";

export interface MediaActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  statusCode?: number;
}

function handleMediaActionError(err: unknown): MediaActionResult<never> {
  if (err instanceof TenantAccessError) {
    const sanitized = sanitizeTenantError(err);
    return {
      success: false,
      error: sanitized.error,
      code: sanitized.code,
      statusCode: sanitized.status,
    };
  }

  if (err instanceof MediaValidationError) {
    return {
      success: false,
      error: err.message,
      code: err.code,
      statusCode: 400,
    };
  }

  if (err instanceof ZodError) {
    const firstIssue = err.issues[0];
    return {
      success: false,
      error: firstIssue
        ? `${firstIssue.path.join(".")}: ${firstIssue.message}`
        : "Invalid input parameters",
      code: "VALIDATION_ERROR",
      statusCode: 400,
    };
  }

  const message = err instanceof Error ? err.message : "An unexpected error occurred";
  return {
    success: false,
    error: message,
    code: "MEDIA_ACTION_FAILED",
    statusCode: 500,
  };
}

/**
 * Server Action: Authorizes a direct upload to cloud storage.
 */
export async function requestUploadAuthorizationAction(
  input: RequestUploadAuthInput,
): Promise<MediaActionResult<RequestUploadAuthResult>> {
  try {
    const supabase = await createServerSupabaseClient();
    const service = new MediaService(supabase);
    const result = await service.requestUploadAuthorization(input);
    return {
      success: true,
      data: result,
    };
  } catch (err) {
    return handleMediaActionError(err);
  }
}

/**
 * Server Action: Finalizes upload after client pushes bytes to storage.
 */
export async function finalizeMediaUploadAction(
  input: FinalizeUploadInput,
): Promise<MediaActionResult<MediaItem>> {
  try {
    const supabase = await createServerSupabaseClient();
    const service = new MediaService(supabase);
    const result = await service.finalizeMediaUpload(input);
    return {
      success: true,
      data: result,
    };
  } catch (err) {
    return handleMediaActionError(err);
  }
}

/**
 * Server Action: Resolves public CDN or short-lived signed read URL for media item.
 */
export async function getMediaUrlAction(
  input: GetMediaUrlInput,
): Promise<MediaActionResult<string>> {
  try {
    const supabase = await createServerSupabaseClient();
    const service = new MediaService(supabase);
    const result = await service.getMediaUrl(input);
    return {
      success: true,
      data: result,
    };
  } catch (err) {
    return handleMediaActionError(err);
  }
}

/**
 * Server Action: Deletes a media item from storage and marks archived in database.
 */
export async function deleteMediaItemAction(
  input: DeleteMediaInput,
): Promise<MediaActionResult<boolean>> {
  try {
    const supabase = await createServerSupabaseClient();
    const service = new MediaService(supabase);
    const result = await service.deleteMediaItem(input);
    return {
      success: true,
      data: result,
    };
  } catch (err) {
    return handleMediaActionError(err);
  }
}

/**
 * Server Action: Retries deletion for media items stuck in deletion_pending status.
 */
export async function retryPendingDeletionAction(input: {
  businessId: string;
  mediaId: string;
}): Promise<MediaActionResult<boolean>> {
  try {
    const supabase = await createServerSupabaseClient();
    const service = new MediaService(supabase);
    const result = await service.retryPendingDeletion(input);
    return {
      success: true,
      data: result,
    };
  } catch (err) {
    return handleMediaActionError(err);
  }
}

/**
 * Server Action: Publishes a verified media item to public storage.
 */
export async function publishMediaItemAction(
  input: PublishMediaInput,
): Promise<MediaActionResult<MediaItem>> {
  try {
    const supabase = await createServerSupabaseClient();
    const service = new MediaService(supabase);
    const result = await service.publishMediaItem(input);
    return {
      success: true,
      data: result,
    };
  } catch (err) {
    return handleMediaActionError(err);
  }
}

/**
 * Server Action: Unpublishes a public media asset, returning it to private storage.
 */
export async function unpublishMediaItemAction(
  input: UnpublishMediaInput,
): Promise<MediaActionResult<MediaItem>> {
  try {
    const supabase = await createServerSupabaseClient();
    const service = new MediaService(supabase);
    const result = await service.unpublishMediaItem(input);
    return {
      success: true,
      data: result,
    };
  } catch (err) {
    return handleMediaActionError(err);
  }
}

/**
 * Server Action: Reconciles expired pending uploads.
 */
export async function reconcileExpiredUploadsAction(
  input?: ReconcileExpiredUploadsInput,
): Promise<MediaActionResult<ReconcileExpiredUploadsResult>> {
  try {
    const supabase = await createServerSupabaseClient();
    const service = new MediaService(supabase);
    const result = await service.reconcileExpiredUploads(input);
    return {
      success: true,
      data: result,
    };
  } catch (err) {
    return handleMediaActionError(err);
  }
}
