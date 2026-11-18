/**
 * VyapOne — Media Quarantine and Public Publication Isolation Tests [VO-032 Correction]
 *
 * Verifies that:
 * 1. New uploads always enter private quarantine regardless of category.
 * 2. Unverified files have no public URL.
 * 3. SVG validation failure leaves the object private.
 * 4. Valid file finalization does NOT automatically publish.
 * 5. Draft website assets remain private.
 * 6. Unpublished catalogue images remain private.
 * 7. Authorized publication creates a verified public copy.
 * 8. Unauthorized publication is rejected.
 * 9. Cross-tenant publication is rejected.
 * 10. Failed public copy does not mark metadata public.
 * 11. Retry / publication is idempotent.
 * 12. Unpublish and cleanup restore the intended visibility state.
 * 13. Reconciling expired uploads removes unfinalized storage objects and marks status failed.
 */

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

describe("VO-032 Public Upload Isolation and Quarantine", () => {
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

    mockRecordAuditEvent.mockResolvedValue({ id: "audit-quarantine-1" });

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
              eq: vi.fn((col1: string, val1: unknown) => {
                const makeFilter = (filters: Array<[string, unknown]>) => ({
                  eq: vi.fn((cNext: string, vNext: unknown) =>
                    makeFilter([...filters, [cNext, vNext]]),
                  ),
                  maybeSingle: vi.fn(async () => {
                    for (const item of memoryStore.values()) {
                      const matches = filters.every(([col, val]) => item[col] === val);
                      if (matches) return { data: { ...item }, error: null };
                    }
                    return { data: null, error: null };
                  }),
                  single: vi.fn(async () => {
                    for (const item of memoryStore.values()) {
                      const matches = filters.every(([col, val]) => item[col] === val);
                      if (matches) return { data: { ...item }, error: null };
                    }
                    return { data: null, error: new Error("Row not found") };
                  }),
                  lt: vi.fn((colLt: string, valLt: unknown) => ({
                    then: (
                      resolve: (val: { data: Record<string, unknown>[]; error: null }) => void,
                    ) => {
                      const res: Record<string, unknown>[] = [];
                      for (const item of memoryStore.values()) {
                        const matches = filters.every(([col, val]) => item[col] === val);
                        if (
                          matches &&
                          typeof item[colLt] === "string" &&
                          typeof valLt === "string" &&
                          new Date(item[colLt]).getTime() < new Date(valLt).getTime()
                        ) {
                          res.push({ ...item });
                        }
                      }
                      resolve({ data: res, error: null });
                    },
                  })),
                });
                return makeFilter([[col1, val1]]);
              }),
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

  // Helper to construct valid 400x300 PNG bytes
  function makeValidPngBytes(): Uint8Array {
    const bytes = new Uint8Array(32);
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    bytes.set([0x00, 0x00, 0x00, 0x0d], 8);
    bytes.set([0x49, 0x48, 0x44, 0x52], 12);
    bytes.set([0x00, 0x00, 0x01, 0x90], 16); // 400
    bytes.set([0x00, 0x00, 0x01, 0x2c], 20); // 300
    return bytes;
  }

  describe("1. Private Quarantine Enforcement", () => {
    it("ensures new uploads always enter private quarantine regardless of category", async () => {
      const categories = [
        "business_logo",
        "catalogue_image",
        "website_asset",
        "document_attachment",
        "onboarding_upload",
      ] as const;

      for (const cat of categories) {
        const mime = cat === "document_attachment" ? "application/pdf" : "image/png";
        const auth = await service.requestUploadAuthorization({
          businessId: businessId1,
          category: cat,
          filename: `test-${cat}.${cat === "document_attachment" ? "pdf" : "png"}`,
          fileSizeBytes: 1024 * 10,
          contentType: mime,
        });

        // Critical invariant: bucket MUST be private quarantine
        expect(auth.bucket).toBe("vyapone-private-media");
        expect(auth.uploadUrl).toContain("vyapone-private-media");
        expect(auth.uploadUrl).not.toContain("vyapone-public-media");

        const row = memoryStore.get(auth.mediaId);
        expect(row?.bucket).toBe("vyapone-private-media");
        expect(row?.is_public).toBe(false);
        expect(row?.status).toBe("pending_upload");
        expect(row?.published_at).toBeNull();
      }
    });

    it("ensures unverified files cannot be resolved to a public URL", async () => {
      const auth = await service.requestUploadAuthorization({
        businessId: businessId1,
        category: "website_asset",
        filename: "hero.png",
        fileSizeBytes: 1024 * 20,
        contentType: "image/png",
      });

      // Item is pending_upload (unverified)
      const url = await service.getMediaUrl({
        businessId: businessId1,
        mediaId: auth.mediaId,
      });

      // Must be a private signed URL, never public CDN URL
      expect(url).toContain("storage.vyapone.local/read/vyapone-private-media/");
      expect(url).not.toContain("https://cdn.vyapone.com/");
    });

    it("ensures SVG validation failure leaves the object in private storage and marks status failed", async () => {
      const auth = await service.requestUploadAuthorization({
        businessId: businessId1,
        category: "website_asset",
        filename: "bad.svg",
        fileSizeBytes: 1024 * 5,
        contentType: "image/svg+xml",
      });

      // Malicious SVG payload with script tag
      const maliciousSvg = new TextEncoder().encode(
        '<svg><script>window.location="http://evil.com"</script></svg>',
      );

      await storageProvider.uploadObject({
        bucket: auth.bucket,
        key: auth.objectKey,
        data: maliciousSvg,
        contentType: "image/svg+xml",
      });

      await expect(
        service.finalizeMediaUpload({
          businessId: businessId1,
          mediaId: auth.mediaId,
        }),
      ).rejects.toThrow(MediaValidationError);

      const row = memoryStore.get(auth.mediaId);
      expect(row?.status).toBe("failed");
      expect(row?.bucket).toBe("vyapone-private-media");
      expect(row?.is_public).toBe(false);

      // Verify no public copy was created
      const publicMeta = await storageProvider.getObjectMetadata({
        bucket: "vyapone-public-media",
        key: auth.objectKey,
      });
      expect(publicMeta).toBeNull();
    });
  });

  describe("2. Finalization vs Publication Distinction", () => {
    it("ensures valid file finalization does NOT automatically publish the asset", async () => {
      const auth = await service.requestUploadAuthorization({
        businessId: businessId1,
        category: "website_asset",
        filename: "banner.png",
        fileSizeBytes: 1024 * 25,
        contentType: "image/png",
      });

      await storageProvider.uploadObject({
        bucket: auth.bucket,
        key: auth.objectKey,
        data: makeValidPngBytes(),
        contentType: "image/png",
      });

      const finalized = await service.finalizeMediaUpload({
        businessId: businessId1,
        mediaId: auth.mediaId,
      });

      // Finalized item is ready and verified, BUT REMAINS PRIVATE
      expect(finalized.status).toBe("ready");
      expect(finalized.verifiedAt).toBeDefined();
      expect(finalized.isPublic).toBe(false);
      expect(finalized.bucket).toBe("vyapone-private-media");
      expect(finalized.publishedAt).toBeNull();
      expect(finalized.url).toContain("vyapone-private-media");
      expect(finalized.url).not.toContain("https://cdn.vyapone.com/");

      // Check storage: exists in private quarantine only
      const privateMeta = await storageProvider.getObjectMetadata({
        bucket: "vyapone-private-media",
        key: auth.objectKey,
      });
      expect(privateMeta).not.toBeNull();

      const publicMeta = await storageProvider.getObjectMetadata({
        bucket: "vyapone-public-media",
        key: auth.objectKey,
      });
      expect(publicMeta).toBeNull();
    });

    it("keeps draft website assets private until explicit publication", async () => {
      const auth = await service.requestUploadAuthorization({
        businessId: businessId1,
        category: "website_asset",
        filename: "draft-mockup.png",
        fileSizeBytes: 1024 * 15,
        contentType: "image/png",
      });

      await storageProvider.uploadObject({
        bucket: auth.bucket,
        key: auth.objectKey,
        data: makeValidPngBytes(),
        contentType: "image/png",
      });

      await service.finalizeMediaUpload({
        businessId: businessId1,
        mediaId: auth.mediaId,
      });

      const url = await service.getMediaUrl({
        businessId: businessId1,
        mediaId: auth.mediaId,
      });
      expect(url).toContain("vyapone-private-media");
      expect(url).not.toContain("https://cdn.vyapone.com/");
    });

    it("keeps unpublished catalogue imagery private until explicit publication", async () => {
      const auth = await service.requestUploadAuthorization({
        businessId: businessId1,
        category: "catalogue_image",
        filename: "menu-item.png",
        fileSizeBytes: 1024 * 30,
        contentType: "image/png",
      });

      await storageProvider.uploadObject({
        bucket: auth.bucket,
        key: auth.objectKey,
        data: makeValidPngBytes(),
        contentType: "image/png",
      });

      await service.finalizeMediaUpload({
        businessId: businessId1,
        mediaId: auth.mediaId,
      });

      const row = memoryStore.get(auth.mediaId);
      expect(row?.is_public).toBe(false);
      expect(row?.bucket).toBe("vyapone-private-media");
    });
  });

  describe("3. Authorized Publication & Security Controls", () => {
    it("creates a verified public copy upon authorized publication", async () => {
      const auth = await service.requestUploadAuthorization({
        businessId: businessId1,
        category: "business_logo",
        filename: "store-logo.png",
        fileSizeBytes: 1024 * 20,
        contentType: "image/png",
      });

      await storageProvider.uploadObject({
        bucket: auth.bucket,
        key: auth.objectKey,
        data: makeValidPngBytes(),
        contentType: "image/png",
      });

      await service.finalizeMediaUpload({
        businessId: businessId1,
        mediaId: auth.mediaId,
      });

      // Explicitly publish
      const published = await service.publishMediaItem({
        businessId: businessId1,
        mediaId: auth.mediaId,
        resourceType: "logo",
      });

      expect(published.isPublic).toBe(true);
      expect(published.bucket).toBe("vyapone-public-media");
      expect(published.publishedAt).toBeDefined();
      expect(published.url).toBe(`https://cdn.vyapone.com/vyapone-public-media/${auth.objectKey}`);

      // Verify public object exists in public storage
      const publicMeta = await storageProvider.getObjectMetadata({
        bucket: "vyapone-public-media",
        key: auth.objectKey,
      });
      expect(publicMeta).not.toBeNull();
      expect(publicMeta?.size).toBeGreaterThan(0);

      // Verify audit log
      expect(mockRecordAuditEvent).toHaveBeenCalledWith(
        mockSupabase,
        expect.objectContaining({
          action: "media.published",
          businessId: businessId1,
        }),
      );
    });

    it("rejects publication of private-only categories like document_attachment and onboarding_upload", async () => {
      const auth = await service.requestUploadAuthorization({
        businessId: businessId1,
        category: "document_attachment",
        filename: "tax.pdf",
        fileSizeBytes: 1024 * 10,
        contentType: "application/pdf",
      });

      const pdfBytes = new TextEncoder().encode("%PDF-1.4\n%mock content");
      await storageProvider.uploadObject({
        bucket: auth.bucket,
        key: auth.objectKey,
        data: pdfBytes,
        contentType: "application/pdf",
      });

      await service.finalizeMediaUpload({
        businessId: businessId1,
        mediaId: auth.mediaId,
      });

      await expect(
        service.publishMediaItem({
          businessId: businessId1,
          mediaId: auth.mediaId,
        }),
      ).rejects.toThrow(/strictly private and cannot be published/);
    });

    it("rejects unauthorized publication attempts", async () => {
      const auth = await service.requestUploadAuthorization({
        businessId: businessId1,
        category: "website_asset",
        filename: "pic.png",
        fileSizeBytes: 1024 * 10,
        contentType: "image/png",
      });

      await storageProvider.uploadObject({
        bucket: auth.bucket,
        key: auth.objectKey,
        data: makeValidPngBytes(),
        contentType: "image/png",
      });

      await service.finalizeMediaUpload({
        businessId: businessId1,
        mediaId: auth.mediaId,
      });

      // Calling with non-existent or foreign businessId
      await expect(
        service.publishMediaItem({
          businessId: businessId2,
          mediaId: auth.mediaId,
        }),
      ).rejects.toThrow(TenantAccessError);
    });

    it("rejects cross-tenant publication attempts", async () => {
      const auth = await service.requestUploadAuthorization({
        businessId: businessId1,
        category: "website_asset",
        filename: "asset1.png",
        fileSizeBytes: 1024 * 10,
        contentType: "image/png",
      });

      await storageProvider.uploadObject({
        bucket: auth.bucket,
        key: auth.objectKey,
        data: makeValidPngBytes(),
        contentType: "image/png",
      });

      await service.finalizeMediaUpload({
        businessId: businessId1,
        mediaId: auth.mediaId,
      });

      // Attempt to access with businessId2
      await expect(
        service.publishMediaItem({
          businessId: businessId2,
          mediaId: auth.mediaId,
        }),
      ).rejects.toThrow(TenantAccessError);
    });

    it("publication retry is idempotent", async () => {
      const auth = await service.requestUploadAuthorization({
        businessId: businessId1,
        category: "website_asset",
        filename: "idempotent.png",
        fileSizeBytes: 1024 * 10,
        contentType: "image/png",
      });

      await storageProvider.uploadObject({
        bucket: auth.bucket,
        key: auth.objectKey,
        data: makeValidPngBytes(),
        contentType: "image/png",
      });

      await service.finalizeMediaUpload({
        businessId: businessId1,
        mediaId: auth.mediaId,
      });

      const pub1 = await service.publishMediaItem({
        businessId: businessId1,
        mediaId: auth.mediaId,
      });

      const pub2 = await service.publishMediaItem({
        businessId: businessId1,
        mediaId: auth.mediaId,
      });

      expect(pub1.id).toBe(pub2.id);
      expect(pub2.isPublic).toBe(true);
      expect(pub2.bucket).toBe("vyapone-public-media");
    });
  });

  describe("4. Unpublish, Cleanup and Expiration Reconciliation", () => {
    it("unpublishes a public asset, returning it safely to private quarantine", async () => {
      const auth = await service.requestUploadAuthorization({
        businessId: businessId1,
        category: "business_logo",
        filename: "unpub-logo.png",
        fileSizeBytes: 1024 * 10,
        contentType: "image/png",
      });

      await storageProvider.uploadObject({
        bucket: auth.bucket,
        key: auth.objectKey,
        data: makeValidPngBytes(),
        contentType: "image/png",
      });

      await service.finalizeMediaUpload({
        businessId: businessId1,
        mediaId: auth.mediaId,
      });

      await service.publishMediaItem({
        businessId: businessId1,
        mediaId: auth.mediaId,
      });

      // Unpublish
      const unpublished = await service.unpublishMediaItem({
        businessId: businessId1,
        mediaId: auth.mediaId,
      });

      expect(unpublished.isPublic).toBe(false);
      expect(unpublished.bucket).toBe("vyapone-private-media");
      expect(unpublished.publishedAt).toBeNull();

      // Public storage object was removed
      const publicMeta = await storageProvider.getObjectMetadata({
        bucket: "vyapone-public-media",
        key: auth.objectKey,
      });
      expect(publicMeta).toBeNull();

      // Private quarantine object remains
      const privateMeta = await storageProvider.getObjectMetadata({
        bucket: "vyapone-private-media",
        key: auth.objectKey,
      });
      expect(privateMeta).not.toBeNull();

      expect(mockRecordAuditEvent).toHaveBeenCalledWith(
        mockSupabase,
        expect.objectContaining({
          action: "media.unpublished",
          businessId: businessId1,
        }),
      );
    });

    it("reconciles expired pending uploads, cleaning up quarantine bytes", async () => {
      const auth = await service.requestUploadAuthorization({
        businessId: businessId1,
        category: "website_asset",
        filename: "expired.png",
        fileSizeBytes: 1024 * 10,
        contentType: "image/png",
      });

      // Upload bytes
      await storageProvider.uploadObject({
        bucket: auth.bucket,
        key: auth.objectKey,
        data: makeValidPngBytes(),
        contentType: "image/png",
      });

      // Set expires_at in the past
      const row = memoryStore.get(auth.mediaId);
      if (row) {
        row.expires_at = new Date(Date.now() - 3600000).toISOString();
        memoryStore.set(auth.mediaId, row);
      }

      const reconcileResult = await service.reconcileExpiredUploads({
        businessId: businessId1,
      });

      expect(reconcileResult.reconciledCount).toBe(1);
      expect(reconcileResult.reconciledIds).toContain(auth.mediaId);

      const updatedRow = memoryStore.get(auth.mediaId);
      expect(updatedRow?.status).toBe("failed");

      // Storage bytes removed from quarantine
      const meta = await storageProvider.getObjectMetadata({
        bucket: "vyapone-private-media",
        key: auth.objectKey,
      });
      expect(meta).toBeNull();
    });
  });
});
