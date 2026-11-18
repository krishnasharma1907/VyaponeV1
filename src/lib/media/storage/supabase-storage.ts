/**
 * VyapOne — Supabase Storage Provider [VO-032]
 *
 * Implements IStorageProvider using Supabase Storage API backed by administrative service-role credentials.
 * Guarded by Next.js `import "server-only"`.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
import type {
  CopyObjectParams,
  CreateSignedReadUrlParams,
  CreateSignedUploadUrlParams,
  IStorageProvider,
  ObjectMetadata,
  SignedUploadUrlResult,
} from "./types";

export class SupabaseStorageProvider implements IStorageProvider {
  private readonly client: SupabaseClient<Database>;

  constructor(customClient?: SupabaseClient<Database>) {
    this.client = customClient ?? createAdminSupabaseClient();
  }

  async createSignedUploadUrl(params: CreateSignedUploadUrlParams): Promise<SignedUploadUrlResult> {
    const expiresAt = new Date(Date.now() + params.expiresInSeconds * 1000).toISOString();

    const { data, error } = await this.client.storage
      .from(params.bucket)
      .createSignedUploadUrl(params.key);

    if (error || !data) {
      throw new Error(
        `Failed to generate signed upload URL from Supabase: ${error?.message ?? "unknown error"}`,
      );
    }

    return {
      uploadUrl: data.signedUrl,
      token: data.token,
      headers: {
        "content-type": params.contentType,
      },
      expiresAt,
    };
  }

  async createSignedReadUrl(params: CreateSignedReadUrlParams): Promise<string> {
    const { data, error } = await this.client.storage
      .from(params.bucket)
      .createSignedUrl(params.key, params.expiresInSeconds);

    if (error || !data?.signedUrl) {
      throw new Error(
        `Failed to generate signed read URL from Supabase: ${error?.message ?? "unknown error"}`,
      );
    }

    return data.signedUrl;
  }

  getPublicUrl(params: { bucket: string; key: string }): string {
    const { data } = this.client.storage.from(params.bucket).getPublicUrl(params.key);
    return data.publicUrl;
  }

  async getObjectMetadata(params: { bucket: string; key: string }): Promise<ObjectMetadata | null> {
    // Supabase storage allows querying object info via download or list
    const folder = params.key.includes("/")
      ? params.key.substring(0, params.key.lastIndexOf("/"))
      : "";
    const filename = params.key.includes("/")
      ? params.key.substring(params.key.lastIndexOf("/") + 1)
      : params.key;

    const { data, error } = await this.client.storage.from(params.bucket).list(folder, {
      search: filename,
      limit: 10,
    });

    if (error || !data) {
      return null;
    }

    const item = data.find((f) => f.name === filename);
    if (!item) {
      return null;
    }

    return {
      size: item.metadata?.size ?? 0,
      contentType: item.metadata?.mimetype ?? undefined,
      etag: item.metadata?.eTag ?? undefined,
      lastModified: item.updated_at ?? item.created_at ?? undefined,
    };
  }

  async getObjectBytes(params: {
    bucket: string;
    key: string;
    maxBytes?: number;
  }): Promise<Uint8Array | null> {
    const { data, error } = await this.client.storage.from(params.bucket).download(params.key);

    if (error || !data) {
      return null;
    }

    const arrayBuffer = await data.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    if (params.maxBytes !== undefined && params.maxBytes < bytes.length) {
      return bytes.slice(0, params.maxBytes);
    }

    return bytes;
  }

  async uploadObject(params: {
    bucket: string;
    key: string;
    data: Uint8Array | ArrayBuffer | Buffer;
    contentType: string;
  }): Promise<void> {
    let payload: Blob | Uint8Array;
    if (Buffer.isBuffer(params.data)) {
      payload = new Uint8Array(params.data);
    } else if (params.data instanceof ArrayBuffer) {
      payload = new Uint8Array(params.data);
    } else {
      payload = params.data;
    }

    const { error } = await this.client.storage.from(params.bucket).upload(params.key, payload, {
      contentType: params.contentType,
      upsert: true,
    });

    if (error) {
      throw new Error(`Failed to upload object to Supabase storage: ${error.message}`);
    }
  }

  async copyObject(params: CopyObjectParams): Promise<void> {
    // Attempt native copy
    const { error: nativeError } = await this.client.storage
      .from(params.fromBucket)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .copy(params.fromKey, params.toKey, { destinationBucket: params.toBucket } as any);

    if (nativeError) {
      // Fallback: Read source object bytes and upload to destination bucket
      const bytes = await this.getObjectBytes({
        bucket: params.fromBucket,
        key: params.fromKey,
      });

      if (!bytes) {
        throw new Error(
          `Failed to copy object: source object ${params.fromBucket}/${params.fromKey} not found in Supabase storage.`,
        );
      }

      const meta = await this.getObjectMetadata({
        bucket: params.fromBucket,
        key: params.fromKey,
      });

      await this.uploadObject({
        bucket: params.toBucket,
        key: params.toKey,
        data: bytes,
        contentType: params.contentType ?? meta?.contentType ?? "application/octet-stream",
      });
    }
  }

  async deleteObject(params: { bucket: string; key: string }): Promise<boolean> {
    const { data, error } = await this.client.storage.from(params.bucket).remove([params.key]);

    if (error) {
      throw new Error(`Failed to delete object from Supabase storage: ${error.message}`);
    }

    return Array.isArray(data) && data.length > 0;
  }
}
