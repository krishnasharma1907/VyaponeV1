import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock server-only for Vitest jsdom environment
vi.mock("server-only", () => ({}));

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { MediaService } from "@/lib/media/service";
import { MemoryStorageProvider } from "@/lib/media/storage/memory-storage";
import { MediaValidationError } from "@/lib/media/validation";
import { TenantAccessError } from "@/lib/auth/tenant-access";
import * as tenantAccess from "@/lib/auth/tenant-access";

const mockAssertBusinessAccess = vi.fn();

vi.mock("@/lib/auth/tenant-access", async () => {
  const actual = await vi.importActual<typeof tenantAccess>("@/lib/auth/tenant-access");
  return {
    ...actual,
    assertBusinessAccess: (...args: unknown[]) => mockAssertBusinessAccess(...args),
  };
});

const mockRecordAuditEvent = vi.fn();
vi.mock("@/lib/audit/service", () => ({
  recordAuditEvent: (...args: unknown[]) => mockRecordAuditEvent(...args),
}));

describe("VO-032 MediaService Lifecycle, Validation & Tenant Isolation", () => {
  const businessId1 = "11111111-1111-4111-a111-111111111111";
  const businessId2 = "22222222-2222-4222-a222-222222222222";
  const userId1 = "33333333-3333-4333-a333-333333333333";
  const workspaceId1 = "44444444-4444-4444-a444-444444444444";

  let memoryStore: Map<string, Record<string, unknown>>;
  let mockSupabase: SupabaseClient<Database>;
  let storageProvider: MemoryStorageProvider;
  let service: MediaService;

  beforeEach(() => {
    vi.clearAllMocks();
    memoryStore = new Map<string, Record<string, unknown>>();
    storageProvider = new MemoryStorageProvider();

    mockAssertBusinessAccess.mockImplementation(async (_client: unknown, bId: string) => {
      if (bId === businessId1) {
        return {
          business: { id: businessId1, workspace_id: workspaceId1, sovereign_owner_id: userId1 },
          callerUserId: userId1,
          isSovereignOwner: true,
          effectiveRole: "owner",
          member: null,
          locationId: null,
        };
      }
      throw new TenantAccessError("Business not found", "NOT_FOUND", 404);
    });

    mockRecordAuditEvent.mockResolvedValue({ id: "audit-1" });

    // In-memory mock for Supabase media_items table
    mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === "media_items") {
          return {
            insert: vi.fn((payload: Record<string, unknown> & { id: string }) => {
              memoryStore.set(payload.id, { ...payload });
              return Promise.resolve({ data: payload, error: null });
            }),
            select: vi.fn(() => ({
              eq: vi.fn((col1: string, val1: unknown) => ({
                eq: vi.fn((col2: string, val2: unknown) => ({
                  maybeSingle: vi.fn(async () => {
                    for (const item of memoryStore.values()) {
                      if (item[col1] === val1 && item[col2] === val2) {
                        return { data: { ...item }, error: null };
                      }
                    }
                    return { data: null, error: null };
                  }),
                })),
              })),
            })),
            update: vi.fn((updates: Record<string, unknown>) => ({
              eq: vi.fn((_col: string, val: string) => {
                const existing = memoryStore.get(val);
                const updated = existing ? { ...existing, ...updates } : null;
                if (existing && updated) {
                  memoryStore.set(val, updated);
                }
                const result = { data: updated, error: updated ? null : new Error("Not found") };
                return {
                  select: vi.fn(() => ({
                    single: vi.fn(async () => result),
                  })),
                  then: (
                    resolve: (value: {
                      data: Record<string, unknown> | null;
                      error: Error | null;
                    }) => void,
                  ) => resolve(result),
                };
              }),
            })),
          };
        }
        return {};
      }),
    } as unknown as SupabaseClient<Database>;

    service = new MediaService(mockSupabase, storageProvider);
  });

  describe("Complete Upload Lifecycle (Happy Path)", () => {
    it("authorizes upload, stores bytes, finalizes with dimension extraction, and deletes cleanly", async () => {
      // 1. Request upload authorization for business logo
      const authResult = await service.requestUploadAuthorization({
        businessId: businessId1,
        category: "business_logo",
        filename: "my-logo.png",
        fileSizeBytes: 1024 * 50, // 50 KB
        contentType: "image/png",
      });

      expect(authResult.mediaId).toBeDefined();
      expect(authResult.businessId).toBe(businessId1);
      expect(authResult.category).toBe("business_logo");
      expect(authResult.bucket).toBe("vyapone-public-media");
      expect(authResult.objectKey).toBe(
        `tenants/${businessId1}/business_logo/${authResult.mediaId}.png`,
      );
      expect(authResult.uploadUrl).toContain(encodeURIComponent(authResult.objectKey));

      // Verify audit log
      expect(mockRecordAuditEvent).toHaveBeenCalledWith(
        mockSupabase,
        expect.objectContaining({
          action: "media.upload_requested",
          businessId: businessId1,
        }),
      );

      // 2. Client uploads valid PNG bytes directly to storage
      // Construct 800x600 PNG header
      const pngBytes = new Uint8Array(32);
      pngBytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
      pngBytes.set([0x00, 0x00, 0x00, 0x0d], 8);
      pngBytes.set([0x49, 0x48, 0x44, 0x52], 12);
      pngBytes.set([0x00, 0x00, 0x03, 0x20], 16); // 800
      pngBytes.set([0x00, 0x00, 0x02, 0x58], 20); // 600

      await storageProvider.uploadObject({
        bucket: authResult.bucket,
        key: authResult.objectKey,
        data: pngBytes,
        contentType: "image/png",
      });

      // 3. Finalize upload
      const finalized = await service.finalizeMediaUpload({
        businessId: businessId1,
        mediaId: authResult.mediaId,
      });

      expect(finalized.status).toBe("ready");
      expect(finalized.detectedContentType).toBe("image/png");
      expect(finalized.width).toBe(800);
      expect(finalized.height).toBe(600);
      expect(finalized.isPublic).toBe(true);
      expect(finalized.url).toContain("https://cdn.vyapone.com/");

      expect(mockRecordAuditEvent).toHaveBeenCalledWith(
        mockSupabase,
        expect.objectContaining({
          action: "media.upload_finalized",
          businessId: businessId1,
        }),
      );

      // 4. Resolve URL
      const url = await service.getMediaUrl({
        businessId: businessId1,
        mediaId: authResult.mediaId,
      });
      expect(url).toBe(`https://cdn.vyapone.com/vyapone-public-media/${authResult.objectKey}`);

      // 5. Delete media item
      const deleted = await service.deleteMediaItem({
        businessId: businessId1,
        mediaId: authResult.mediaId,
      });
      expect(deleted).toBe(true);

      // Storage object removed
      const meta = await storageProvider.getObjectMetadata({
        bucket: authResult.bucket,
        key: authResult.objectKey,
      });
      expect(meta).toBeNull();

      // Database status updated to archived
      const dbRecord = memoryStore.get(authResult.mediaId);
      expect(dbRecord).toBeDefined();
      expect(dbRecord?.status).toBe("archived");

      expect(mockRecordAuditEvent).toHaveBeenCalledWith(
        mockSupabase,
        expect.objectContaining({
          action: "media.deleted",
          businessId: businessId1,
        }),
      );
    });
  });

  describe("Private Media Handling (document_attachment)", () => {
    it("stores in private bucket and generates short-lived signed read URL", async () => {
      const authResult = await service.requestUploadAuthorization({
        businessId: businessId1,
        category: "document_attachment",
        filename: "monthly-report.pdf",
        fileSizeBytes: 1024 * 200,
        contentType: "application/pdf",
      });

      expect(authResult.bucket).toBe("vyapone-private-media");

      // Upload valid PDF bytes
      const pdfBytes = new TextEncoder().encode("%PDF-1.4\n%mock content");
      await storageProvider.uploadObject({
        bucket: authResult.bucket,
        key: authResult.objectKey,
        data: pdfBytes,
        contentType: "application/pdf",
      });

      const finalized = await service.finalizeMediaUpload({
        businessId: businessId1,
        mediaId: authResult.mediaId,
      });

      expect(finalized.status).toBe("ready");
      expect(finalized.isPublic).toBe(false);
      expect(finalized.detectedContentType).toBe("application/pdf");

      // Resolves short-lived signed read URL
      const readUrl = await service.getMediaUrl({
        businessId: businessId1,
        mediaId: authResult.mediaId,
      });
      expect(readUrl).toContain("https://storage.vyapone.local/read/vyapone-private-media/");
      expect(readUrl).toContain("token=");
    });
  });

  describe("Content Spoofing & Dimension Validation Errors", () => {
    it("detects magic byte spoofing and marks upload failed", async () => {
      const authResult = await service.requestUploadAuthorization({
        businessId: businessId1,
        category: "catalogue_image",
        filename: "dish.jpg",
        fileSizeBytes: 1024 * 100,
        contentType: "image/jpeg",
      });

      // Upload PNG bytes instead of declared JPEG
      const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      await storageProvider.uploadObject({
        bucket: authResult.bucket,
        key: authResult.objectKey,
        data: pngBytes,
        contentType: "image/png",
      });

      await expect(
        service.finalizeMediaUpload({
          businessId: businessId1,
          mediaId: authResult.mediaId,
        }),
      ).rejects.toThrow(MediaValidationError);

      const dbRecord = memoryStore.get(authResult.mediaId);
      expect(dbRecord).toBeDefined();
      expect(dbRecord?.status).toBe("failed");

      expect(mockRecordAuditEvent).toHaveBeenCalledWith(
        mockSupabase,
        expect.objectContaining({
          action: "media.upload_failed",
          businessId: businessId1,
        }),
      );
    });

    it("rejects malicious SVG containing embedded script tags", async () => {
      const authResult = await service.requestUploadAuthorization({
        businessId: businessId1,
        category: "business_logo",
        filename: "vector-logo.svg",
        fileSizeBytes: 1024 * 10,
        contentType: "image/svg+xml",
      });

      const maliciousSvg = new TextEncoder().encode(
        "<svg xmlns='http://www.w3.org/2000/svg'><script>alert('pwn')</script><circle r='10'/></svg>",
      );
      await storageProvider.uploadObject({
        bucket: authResult.bucket,
        key: authResult.objectKey,
        data: maliciousSvg,
        contentType: "image/svg+xml",
      });

      await expect(
        service.finalizeMediaUpload({
          businessId: businessId1,
          mediaId: authResult.mediaId,
        }),
      ).rejects.toThrow(/forbidden executable <script>/);

      const dbRecord = memoryStore.get(authResult.mediaId);
      expect(dbRecord).toBeDefined();
      expect(dbRecord?.status).toBe("failed");
    });
  });

  describe("Cross-Tenant Isolation & Anti-Enumeration", () => {
    it("prevents foreign business caller from requesting upload for another tenant", async () => {
      await expect(
        service.requestUploadAuthorization({
          businessId: businessId2, // Foreign business
          category: "business_logo",
          filename: "logo.png",
          fileSizeBytes: 1024 * 10,
          contentType: "image/png",
        }),
      ).rejects.toThrow(TenantAccessError);
    });

    it("prevents foreign business caller from finalizing or accessing another business's media", async () => {
      // First create valid media under businessId1
      const authResult = await service.requestUploadAuthorization({
        businessId: businessId1,
        category: "business_logo",
        filename: "logo.png",
        fileSizeBytes: 1024 * 10,
        contentType: "image/png",
      });

      // Try to finalize using foreign businessId2
      await expect(
        service.finalizeMediaUpload({
          businessId: businessId2,
          mediaId: authResult.mediaId,
        }),
      ).rejects.toThrow(TenantAccessError);

      // Try to delete using foreign businessId2
      await expect(
        service.deleteMediaItem({
          businessId: businessId2,
          mediaId: authResult.mediaId,
        }),
      ).rejects.toThrow(TenantAccessError);
    });
  });
});
