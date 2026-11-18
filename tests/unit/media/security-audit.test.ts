import { afterEach, describe, expect, it, vi } from "vitest";
import { redactSensitiveData } from "@/lib/audit/redaction";
import { MediaService } from "@/lib/media/service";
import {
  getStorageProvider,
  MemoryStorageProvider,
  StorageConfigurationError,
  _setStorageProviderForTesting,
} from "@/lib/media/storage";
import {
  extractImageDimensions,
  getExtensionFromFilename,
  MediaValidationError,
  sanitizeSvgContent,
  validateUploadDeclaration,
  validateUploadedBytes,
} from "@/lib/media/validation";

vi.mock("server-only", () => ({}));

describe("VO-032 Media Pipeline Security & Reliability Audit", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    _setStorageProviderForTesting(null);
  });

  describe("1. Fail-Closed Storage Provider Selection in Production", () => {
    it("prohibits MemoryStorageProvider when NODE_ENV is production", () => {
      vi.stubEnv("NODE_ENV", "production");

      expect(() => {
        getStorageProvider({ provider: "memory" });
      }).toThrow(StorageConfigurationError);

      expect(() => {
        getStorageProvider({ provider: "memory" });
      }).toThrow(/MemoryStorageProvider is strictly prohibited in production/i);
    });

    it("allows MemoryStorageProvider in test environment", () => {
      vi.stubEnv("NODE_ENV", "test");
      const provider = getStorageProvider({ provider: "memory" });
      expect(provider).toBeInstanceOf(MemoryStorageProvider);
    });
  });

  describe("2. Corrupt and Malformed File Header Rejection", () => {
    it("rejects truncated PNG header missing full 24-byte IHDR chunk", () => {
      // 16 bytes: PNG signature (8) + chunk len (4) + partial type (4)
      const truncatedPng = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44,
        0x52,
      ]);

      const dims = extractImageDimensions(truncatedPng, "image/png");
      expect(dims).toBeNull();

      expect(() =>
        validateUploadedBytes({
          category: "business_logo",
          bytes: truncatedPng,
          declaredContentType: "image/png",
        }),
      ).toThrow(MediaValidationError);

      expect(() =>
        validateUploadedBytes({
          category: "business_logo",
          bytes: truncatedPng,
          declaredContentType: "image/png",
        }),
      ).toThrow(/Dimensions could not be extracted/);
    });

    it("rejects corrupt JPEG with truncated SOF chunk length", () => {
      // JPEG SOI + malformed SOF0 marker with invalid length marker
      const corruptJpeg = new Uint8Array([
        0xff,
        0xd8,
        0xff,
        0xc0,
        0x00,
        0x02, // SOF length 2 is impossibly small for SOF (needs precision + dims + components)
      ]);

      const dims = extractImageDimensions(corruptJpeg, "image/jpeg");
      expect(dims).toBeNull();

      expect(() =>
        validateUploadedBytes({
          category: "business_logo",
          bytes: corruptJpeg,
          declaredContentType: "image/jpeg",
        }),
      ).toThrow(MediaValidationError);
    });

    it("rejects image with zero width or height dimensions", () => {
      // Valid PNG signature and IHDR but width is 0
      const zeroWidthPng = new Uint8Array(32);
      zeroWidthPng.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
      zeroWidthPng.set([0x00, 0x00, 0x00, 0x0d], 8);
      zeroWidthPng.set([0x49, 0x48, 0x44, 0x52], 12);
      zeroWidthPng.set([0x00, 0x00, 0x00, 0x00], 16); // width = 0
      zeroWidthPng.set([0x00, 0x00, 0x01, 0x00], 20); // height = 256

      expect(() =>
        validateUploadedBytes({
          category: "business_logo",
          bytes: zeroWidthPng,
          declaredContentType: "image/png",
        }),
      ).toThrow(MediaValidationError);
    });
  });

  describe("3. SVG XML Security & Strict Allow-List Enforcement", () => {
    it("rejects XML external entity (XXE) and DTD entity declarations", () => {
      const xxeSvg = new TextEncoder().encode(
        '<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><svg>&xxe;</svg>',
      );
      expect(() => sanitizeSvgContent(xxeSvg)).toThrow(MediaValidationError);
      expect(() => sanitizeSvgContent(xxeSvg)).toThrow(/forbidden XML entity or DOCTYPE/i);
    });

    it("rejects CDATA script wrapper blocks in SVG", () => {
      const cdataSvg = new TextEncoder().encode("<svg><![CDATA[<script>alert(1)</script>]]></svg>");
      expect(() => sanitizeSvgContent(cdataSvg)).toThrow(MediaValidationError);
      expect(() => sanitizeSvgContent(cdataSvg)).toThrow(/forbidden CDATA blocks/i);
    });

    it("rejects unapproved element tags not in the strict SVG allowlist", () => {
      const unapprovedTagSvg = new TextEncoder().encode(
        "<svg><feComponentTransfer><feFuncR type='identity'/></feComponentTransfer></svg>",
      );
      expect(() => sanitizeSvgContent(unapprovedTagSvg)).toThrow(MediaValidationError);
    });

    it("rejects data: URIs in SVG link or source attributes", () => {
      const dataUriSvg = new TextEncoder().encode(
        '<svg><a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=="><text>Link</text></a></svg>',
      );
      expect(() => sanitizeSvgContent(dataUriSvg)).toThrow(MediaValidationError);
      expect(() => sanitizeSvgContent(dataUriSvg)).toThrow(/forbidden 'data:' URL references/i);
    });

    it("rejects external network resource references in SVG href", () => {
      const externalLinkSvg = new TextEncoder().encode(
        '<svg><image href="https://malicious.com/tracking.png"/></svg>',
      );
      expect(() => sanitizeSvgContent(externalLinkSvg)).toThrow(MediaValidationError);
      expect(() => sanitizeSvgContent(externalLinkSvg)).toThrow(
        /forbidden external network resource references/i,
      );
    });
  });

  describe("4. Filename Extension & MIME Consistency Spoofing Protection", () => {
    it("extracts clean file extension from filenames", () => {
      expect(getExtensionFromFilename("avatar.png")).toBe("png");
      expect(getExtensionFromFilename("photo.JPEG")).toBe("jpeg");
      expect(getExtensionFromFilename("document.pdf")).toBe("pdf");
      expect(getExtensionFromFilename("no-extension")).toBeNull();
    });

    it("rejects filename extension mismatch against declared MIME type", () => {
      expect(() =>
        validateUploadDeclaration({
          category: "business_logo",
          filename: "malicious.exe",
          fileSizeBytes: 1024 * 100,
          contentType: "image/png",
        }),
      ).toThrow(MediaValidationError);

      expect(() =>
        validateUploadDeclaration({
          category: "business_logo",
          filename: "malicious.exe",
          fileSizeBytes: 1024 * 100,
          contentType: "image/png",
        }),
      ).toThrow(/does not agree with declared MIME type/i);
    });

    it("accepts valid JPEG variants (.jpg and .jpeg)", () => {
      expect(() =>
        validateUploadDeclaration({
          category: "business_logo",
          filename: "store-front.jpg",
          fileSizeBytes: 1024 * 100,
          contentType: "image/jpeg",
        }),
      ).not.toThrow();

      expect(() =>
        validateUploadDeclaration({
          category: "business_logo",
          filename: "store-front.jpeg",
          fileSizeBytes: 1024 * 100,
          contentType: "image/jpeg",
        }),
      ).not.toThrow();
    });
  });

  describe("5. Upload Lifecycle & Expiration Protection", () => {
    const businessId = "11111111-1111-4111-a111-111111111111";
    const mediaId = "22222222-2222-4222-a222-222222222222";
    const callerUserId = "33333333-3333-4333-a333-333333333333";

    it("rejects finalization when upload authorization has expired", async () => {
      const pastExpiry = new Date(Date.now() - 3600 * 1000).toISOString(); // 1 hour ago

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: callerUserId } } }),
        },
        from: vi.fn((table: string) => {
          if (table === "businesses") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: {
                      id: businessId,
                      workspace_id: null,
                      sovereign_owner_id: callerUserId,
                    },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === "media_items") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({
                      data: {
                        id: mediaId,
                        business_id: businessId,
                        category: "business_logo",
                        bucket: "vyapone-public-media",
                        object_key: `tenants/${businessId}/business_logo/${mediaId}.png`,
                        original_filename: "logo.png",
                        declared_content_type: "image/png",
                        file_size_bytes: 1024,
                        is_public: true,
                        status: "pending_upload",
                        expires_at: pastExpiry,
                      },
                      error: null,
                    }),
                  }),
                }),
              }),
              update: vi.fn(() => ({
                eq: async () => ({ error: null }),
              })),
            };
          }
          return {};
        }),
      };

      const storage = new MemoryStorageProvider();
      const service = new MediaService(mockSupabase as never, storage);

      await expect(
        service.finalizeMediaUpload({
          businessId,
          mediaId,
        }),
      ).rejects.toThrow(MediaValidationError);

      await expect(
        service.finalizeMediaUpload({
          businessId,
          mediaId,
        }),
      ).rejects.toThrow(/Upload authorization has expired/i);
    });
  });

  describe("6. Safe Two-Phase Deletion & Reconciliation", () => {
    const businessId = "11111111-1111-4111-a111-111111111111";
    const mediaId = "22222222-2222-4222-a222-222222222222";
    const callerUserId = "33333333-3333-4333-a333-333333333333";

    it("marks deletion_pending and records audit event if storage removal fails", async () => {
      const updateMock = vi.fn(() => ({
        eq: async () => ({ error: null }),
      }));

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: callerUserId } } }),
        },
        from: vi.fn((table: string) => {
          if (table === "businesses") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: {
                      id: businessId,
                      workspace_id: null,
                      sovereign_owner_id: callerUserId,
                    },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === "media_items") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({
                      data: {
                        id: mediaId,
                        business_id: businessId,
                        category: "business_logo",
                        bucket: "vyapone-public-media",
                        object_key: `tenants/${businessId}/business_logo/${mediaId}.png`,
                        status: "ready",
                      },
                      error: null,
                    }),
                  }),
                }),
              }),
              update: updateMock,
            };
          }
          if (table === "audit_logs") {
            return {
              insert: () => ({
                select: () => ({
                  single: async () => ({ data: { id: "audit-1" }, error: null }),
                }),
              }),
            };
          }
          return {};
        }),
      };

      const failingStorage = new MemoryStorageProvider();
      vi.spyOn(failingStorage, "deleteObject").mockRejectedValue(
        new Error("S3 Network Timeout during delete"),
      );

      const service = new MediaService(mockSupabase as never, failingStorage);

      await expect(service.deleteMediaItem({ businessId, mediaId })).rejects.toThrow(
        /Failed to remove media object from storage/i,
      );

      // Verify update was called with deletion_pending
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "deletion_pending",
        }),
      );
    });

    it("reconciles stuck deletion_pending items via retryPendingDeletion", async () => {
      const updateMock = vi.fn(() => ({
        eq: async () => ({ error: null }),
      }));

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: callerUserId } } }),
        },
        from: vi.fn((table: string) => {
          if (table === "businesses") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: {
                      id: businessId,
                      workspace_id: null,
                      sovereign_owner_id: callerUserId,
                    },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === "media_items") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({
                      data: {
                        id: mediaId,
                        business_id: businessId,
                        category: "business_logo",
                        bucket: "vyapone-public-media",
                        object_key: `tenants/${businessId}/business_logo/${mediaId}.png`,
                        status: "deletion_pending",
                      },
                      error: null,
                    }),
                  }),
                }),
              }),
              update: updateMock,
            };
          }
          if (table === "audit_logs") {
            return {
              insert: () => ({
                select: () => ({
                  single: async () => ({ data: { id: "audit-1" }, error: null }),
                }),
              }),
            };
          }
          return {};
        }),
      };

      const storage = new MemoryStorageProvider();
      const service = new MediaService(mockSupabase as never, storage);

      const result = await service.retryPendingDeletion({ businessId, mediaId });
      expect(result).toBe(true);

      // Verify status was updated to archived
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "archived",
        }),
      );
    });
  });

  describe("7. Centralized Audit Log Redaction of Signed URLs and Storage Tokens", () => {
    it("redacts sensitive storage keys, signed URLs, and auth tokens from audit metadata", () => {
      const metadata = {
        mediaId: "media-uuid-1",
        signedUrl: "https://storage.supabase.co/object/sign/bucket/photo.png?token=secret123",
        uploadUrl: "https://storage.supabase.co/upload/v1?token=uploadSecret",
        storageToken: "raw-bearer-storage-token",
        signature: "amz-sig-9999",
        normalField: "public-branding-photo.png",
      };

      const redacted = redactSensitiveData(metadata) as typeof metadata;

      expect(redacted.mediaId).toBe("media-uuid-1");
      expect(redacted.normalField).toBe("public-branding-photo.png");
      expect(redacted.signedUrl).toBe("[REDACTED]");
      expect(redacted.uploadUrl).toBe("[REDACTED]");
      expect(redacted.storageToken).toBe("[REDACTED]");
      expect(redacted.signature).toBe("[REDACTED]");
    });

    it("redacts raw URL strings containing sensitive token query parameters", () => {
      const url = "https://example.com/asset.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secret";
      expect(redactSensitiveData(url)).toBe("[REDACTED]");
    });
  });
});
