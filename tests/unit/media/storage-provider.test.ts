import { describe, expect, it } from "vitest";
import { MemoryStorageProvider } from "@/lib/media/storage/memory-storage";

describe("VO-032 MemoryStorageProvider", () => {
  it("creates valid signed upload URL and tokens", async () => {
    const provider = new MemoryStorageProvider();
    const result = await provider.createSignedUploadUrl({
      bucket: "vyapone-public-media",
      key: "tenants/biz-1/logos/logo.png",
      expiresInSeconds: 900,
      contentType: "image/png",
    });

    expect(result.uploadUrl).toContain(
      "https://storage.vyapone.local/upload/vyapone-public-media/",
    );
    expect(result.uploadUrl).toContain("logo.png");
    expect(result.token).toBeDefined();
    expect(result.headers?.["content-type"]).toBe("image/png");
    expect(new Date(result.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("creates valid signed read URL", async () => {
    const provider = new MemoryStorageProvider();
    const url = await provider.createSignedReadUrl({
      bucket: "vyapone-private-media",
      key: "tenants/biz-1/docs/invoice.pdf",
      expiresInSeconds: 300,
    });

    expect(url).toContain("https://storage.vyapone.local/read/vyapone-private-media/");
    expect(url).toContain("token=");
  });

  it("returns public CDN URL for public assets", () => {
    const provider = new MemoryStorageProvider();
    const publicUrl = provider.getPublicUrl({
      bucket: "vyapone-public-media",
      key: "tenants/biz-1/assets/banner.webp",
    });

    expect(publicUrl).toBe(
      "https://cdn.vyapone.com/vyapone-public-media/tenants/biz-1/assets/banner.webp",
    );
  });

  it("uploads object, reads byte slice and metadata", async () => {
    const provider = new MemoryStorageProvider();
    const testBytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    await provider.uploadObject({
      bucket: "vyapone-public-media",
      key: "test.bin",
      data: testBytes,
      contentType: "application/octet-stream",
    });

    const metadata = await provider.getObjectMetadata({
      bucket: "vyapone-public-media",
      key: "test.bin",
    });
    expect(metadata).not.toBeNull();
    expect(metadata?.size).toBe(10);
    expect(metadata?.contentType).toBe("application/octet-stream");

    // Partial read (first 4 bytes)
    const slice = await provider.getObjectBytes({
      bucket: "vyapone-public-media",
      key: "test.bin",
      maxBytes: 4,
    });
    expect(slice).toEqual(new Uint8Array([1, 2, 3, 4]));

    // Full read
    const full = await provider.getObjectBytes({
      bucket: "vyapone-public-media",
      key: "test.bin",
    });
    expect(full).toEqual(testBytes);
  });

  it("safely deletes object and returns true", async () => {
    const provider = new MemoryStorageProvider();
    await provider.uploadObject({
      bucket: "vyapone-public-media",
      key: "to-delete.png",
      data: new Uint8Array([1, 2, 3]),
      contentType: "image/png",
    });

    const deleted = await provider.deleteObject({
      bucket: "vyapone-public-media",
      key: "to-delete.png",
    });
    expect(deleted).toBe(true);

    const check = await provider.getObjectMetadata({
      bucket: "vyapone-public-media",
      key: "to-delete.png",
    });
    expect(check).toBeNull();
  });
});
