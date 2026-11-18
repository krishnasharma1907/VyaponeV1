/**
 * VyapOne — In-Memory Storage Provider [VO-032]
 *
 * Provides a fully self-contained in-memory implementation of IStorageProvider.
 * Used for automated unit tests, offline development, and runtime test environments.
 */

import type {
  CreateSignedReadUrlParams,
  CreateSignedUploadUrlParams,
  IStorageProvider,
  ObjectMetadata,
  SignedUploadUrlResult,
} from "./types";

interface StoredObject {
  data: Uint8Array;
  contentType: string;
  etag: string;
  lastModified: string;
}

export class MemoryStorageProvider implements IStorageProvider {
  private readonly storage = new Map<string, StoredObject>();

  private getCompositeKey(bucket: string, key: string): string {
    return `${bucket}::${key}`;
  }

  async createSignedUploadUrl(params: CreateSignedUploadUrlParams): Promise<SignedUploadUrlResult> {
    const expiresAt = new Date(Date.now() + params.expiresInSeconds * 1000).toISOString();
    const token = `mem_upload_token_${Buffer.from(`${params.bucket}:${params.key}:${Date.now()}`).toString("base64url")}`;
    const uploadUrl = `https://storage.vyapone.local/upload/${params.bucket}/${encodeURIComponent(params.key)}?token=${token}`;

    return {
      uploadUrl,
      token,
      headers: {
        "content-type": params.contentType,
      },
      expiresAt,
    };
  }

  async createSignedReadUrl(params: CreateSignedReadUrlParams): Promise<string> {
    const token = `mem_read_token_${Buffer.from(`${params.bucket}:${params.key}:${Date.now()}`).toString("base64url")}`;
    return `https://storage.vyapone.local/read/${params.bucket}/${encodeURIComponent(params.key)}?token=${token}&expires=${params.expiresInSeconds}`;
  }

  getPublicUrl(params: { bucket: string; key: string }): string {
    return `https://cdn.vyapone.com/${params.bucket}/${params.key}`;
  }

  async getObjectMetadata(params: { bucket: string; key: string }): Promise<ObjectMetadata | null> {
    const compositeKey = this.getCompositeKey(params.bucket, params.key);
    const item = this.storage.get(compositeKey);
    if (!item) {
      return null;
    }
    return {
      size: item.data.length,
      contentType: item.contentType,
      etag: item.etag,
      lastModified: item.lastModified,
    };
  }

  async getObjectBytes(params: {
    bucket: string;
    key: string;
    maxBytes?: number;
  }): Promise<Uint8Array | null> {
    const compositeKey = this.getCompositeKey(params.bucket, params.key);
    const item = this.storage.get(compositeKey);
    if (!item) {
      return null;
    }
    if (params.maxBytes !== undefined && params.maxBytes < item.data.length) {
      return item.data.slice(0, params.maxBytes);
    }
    return new Uint8Array(item.data);
  }

  async uploadObject(params: {
    bucket: string;
    key: string;
    data: Uint8Array | ArrayBuffer | Buffer;
    contentType: string;
  }): Promise<void> {
    let bytes: Uint8Array;
    if (Buffer.isBuffer(params.data)) {
      bytes = new Uint8Array(params.data);
    } else if (params.data instanceof ArrayBuffer) {
      bytes = new Uint8Array(params.data);
    } else {
      bytes = params.data;
    }

    const compositeKey = this.getCompositeKey(params.bucket, params.key);
    this.storage.set(compositeKey, {
      data: bytes,
      contentType: params.contentType,
      etag: `"${Math.random().toString(36).substring(2)}"`,
      lastModified: new Date().toISOString(),
    });
  }

  async deleteObject(params: { bucket: string; key: string }): Promise<boolean> {
    const compositeKey = this.getCompositeKey(params.bucket, params.key);
    return this.storage.delete(compositeKey);
  }

  /**
   * Clears all objects in the memory storage (useful in test teardown).
   */
  clear(): void {
    this.storage.clear();
  }
}
