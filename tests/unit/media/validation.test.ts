import { describe, expect, it } from "vitest";
import {
  detectMimeType,
  extractImageDimensions,
  generateTenantObjectKey,
  MediaValidationError,
  sanitizeFilename,
  sanitizeSvgContent,
  validateUploadDeclaration,
  validateUploadedBytes,
} from "@/lib/media/validation";

describe("VO-032 Media Validation Engine", () => {
  describe("detectMimeType & extractImageDimensions", () => {
    it("detects PNG signature and extracts valid dimensions", () => {
      // 8-byte PNG signature + IHDR chunk header (4-byte length + 4-byte 'IHDR') + 4-byte width + 4-byte height
      const bytes = new Uint8Array(32);
      // Signature: 89 50 4E 47 0D 0A 1A 0A
      bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
      // Chunk length: 13
      bytes.set([0x00, 0x00, 0x00, 0x0d], 8);
      // Chunk type: 'IHDR'
      bytes.set([0x49, 0x48, 0x44, 0x52], 12);
      // Width: 800 (0x00000320)
      bytes.set([0x00, 0x00, 0x03, 0x20], 16);
      // Height: 600 (0x00000258)
      bytes.set([0x00, 0x00, 0x02, 0x58], 20);

      expect(detectMimeType(bytes)).toBe("image/png");
      const dims = extractImageDimensions(bytes, "image/png");
      expect(dims).toEqual({ width: 800, height: 600 });
    });

    it("detects JPEG signature and extracts dimensions from SOF marker", () => {
      // JPEG: FF D8 FF E0 (APP0 marker) ... FF C0 (SOF0 marker)
      const bytes = new Uint8Array(35);
      bytes.set([0xff, 0xd8, 0xff, 0xe0], 0); // SOI + APP0
      bytes.set([0x00, 0x10], 4); // APP0 length (16 bytes)
      // Fill dummy APP0 data up to index 22
      bytes.set([0xff, 0xc0], 22); // SOF0 marker
      bytes.set([0x00, 0x0b], 24); // SOF length (11 bytes)
      bytes[26] = 8; // precision (8 bits)
      // Height: 1080 (0x0438)
      bytes.set([0x04, 0x38], 27);
      // Width: 1920 (0x0780)
      bytes.set([0x07, 0x80], 29);

      expect(detectMimeType(bytes)).toBe("image/jpeg");
      const dims = extractImageDimensions(bytes, "image/jpeg");
      expect(dims).toEqual({ width: 1920, height: 1080 });
    });

    it("detects WebP signature and extracts dimensions for VP8X extended header", () => {
      // WebP VP8X format
      const bytes = new Uint8Array(32);
      // 'RIFF'
      bytes.set([0x52, 0x49, 0x46, 0x46], 0);
      // File size (dummy)
      bytes.set([0x20, 0x00, 0x00, 0x00], 4);
      // 'WEBP'
      bytes.set([0x57, 0x45, 0x42, 0x50], 8);
      // 'VP8X'
      bytes.set([0x56, 0x50, 0x38, 0x58], 12);
      // Chunk size (10)
      bytes.set([0x0a, 0x00, 0x00, 0x00], 16);
      // Flags (dummy)
      bytes.set([0x00, 0x00, 0x00, 0x00], 20);
      // Canvas width - 1 (1200 - 1 = 1199 = 0x0004AF)
      bytes.set([0xaf, 0x04, 0x00], 24);
      // Canvas height - 1 (800 - 1 = 799 = 0x00031F)
      bytes.set([0x1f, 0x03, 0x00], 27);

      expect(detectMimeType(bytes)).toBe("image/webp");
      const dims = extractImageDimensions(bytes, "image/webp");
      expect(dims).toEqual({ width: 1200, height: 800 });
    });

    it("detects GIF signature and extracts dimensions", () => {
      const bytes = new Uint8Array(12);
      // 'GIF89a'
      bytes.set([0x47, 0x49, 0x46, 0x38, 0x39, 0x61], 0);
      // Width: 400 (0x0190) in little endian
      bytes.set([0x90, 0x01], 6);
      // Height: 300 (0x012C) in little endian
      bytes.set([0x2c, 0x01], 8);

      expect(detectMimeType(bytes)).toBe("image/gif");
      const dims = extractImageDimensions(bytes, "image/gif");
      expect(dims).toEqual({ width: 400, height: 300 });
    });

    it("detects PDF signature", () => {
      const bytes = new TextEncoder().encode("%PDF-1.7\n%some-pdf-content");
      expect(detectMimeType(bytes)).toBe("application/pdf");
    });

    it("detects SVG signature from text", () => {
      const bytes = new TextEncoder().encode(
        "<svg xmlns='http://www.w3.org/2000/svg'><circle/></svg>",
      );
      expect(detectMimeType(bytes)).toBe("image/svg+xml");
    });
  });

  describe("sanitizeSvgContent (SVG anti-XSS)", () => {
    it("allows clean and safe SVGs", () => {
      const safeSvg = new TextEncoder().encode(
        "<svg viewBox='0 0 100 100'><rect width='50' height='50' fill='blue'/></svg>",
      );
      expect(() => sanitizeSvgContent(safeSvg)).not.toThrow();
    });

    it("rejects SVG containing <script> tags", () => {
      const maliciousSvg = new TextEncoder().encode(
        "<svg><script>alert('xss')</script><circle/></svg>",
      );
      expect(() => sanitizeSvgContent(maliciousSvg)).toThrow(MediaValidationError);
      expect(() => sanitizeSvgContent(maliciousSvg)).toThrow(/forbidden executable <script>/);
    });

    it("rejects SVG containing inline event handlers", () => {
      const maliciousSvg = new TextEncoder().encode("<svg onload=\"alert('xss')\"><rect/></svg>");
      expect(() => sanitizeSvgContent(maliciousSvg)).toThrow(MediaValidationError);
      expect(() => sanitizeSvgContent(maliciousSvg)).toThrow(/forbidden active event handlers/);
    });

    it("rejects SVG containing javascript: protocol", () => {
      const maliciousSvg = new TextEncoder().encode(
        "<svg><a href=\"javascript:alert('pwn')\"><text>Click</text></a></svg>",
      );
      expect(() => sanitizeSvgContent(maliciousSvg)).toThrow(MediaValidationError);
      expect(() => sanitizeSvgContent(maliciousSvg)).toThrow(/forbidden 'javascript:' URLs/);
    });

    it("rejects SVG containing dangerous foreignObject or iframe tags", () => {
      const maliciousSvg = new TextEncoder().encode(
        "<svg><foreignObject><iframe src='https://evil.com'></iframe></foreignObject></svg>",
      );
      expect(() => sanitizeSvgContent(maliciousSvg)).toThrow(MediaValidationError);
      expect(() => sanitizeSvgContent(maliciousSvg)).toThrow(
        /forbidden embedded or foreign object/,
      );
    });
  });

  describe("sanitizeFilename", () => {
    it("strips path traversal sequences", () => {
      expect(sanitizeFilename("../../etc/passwd")).toBe("etcpasswd");
      expect(sanitizeFilename("..\\..\\windows\\system32.dll")).toBe("windowssystem32.dll");
    });

    it("strips illegal characters and control bytes", () => {
      expect(sanitizeFilename("logo*?<name>.png")).toBe("logoname.png");
    });

    it("provides fallback for empty or dots-only names", () => {
      expect(sanitizeFilename("...")).toBe("media-upload");
      expect(sanitizeFilename("")).toBe("media-upload");
    });

    it("limits filename length while preserving extension", () => {
      const longName = "a".repeat(120) + ".png";
      const sanitized = sanitizeFilename(longName);
      expect(sanitized.length).toBeLessThanOrEqual(100);
      expect(sanitized.endsWith(".png")).toBe(true);
    });
  });

  describe("generateTenantObjectKey", () => {
    it("generates predictable tenant-isolated object keys", () => {
      const key = generateTenantObjectKey("biz-12345", "business_logo", "media-uuid-999", "png");
      expect(key).toBe("tenants/biz-12345/business_logo/media-uuid-999.png");
    });
  });

  describe("validateUploadDeclaration", () => {
    it("accepts valid upload declarations within category bounds", () => {
      expect(() =>
        validateUploadDeclaration({
          category: "business_logo",
          filename: "logo.png",
          fileSizeBytes: 1024 * 500, // 500 KB
          contentType: "image/png",
        }),
      ).not.toThrow();
    });

    it("rejects uploads exceeding category size limit", () => {
      expect(() =>
        validateUploadDeclaration({
          category: "business_logo",
          filename: "huge-logo.png",
          fileSizeBytes: 3 * 1024 * 1024, // 3 MB (limit is 2 MB)
          contentType: "image/png",
        }),
      ).toThrow(MediaValidationError);
    });

    it("rejects disallowed MIME types for category", () => {
      expect(() =>
        validateUploadDeclaration({
          category: "catalogue_image",
          filename: "contract.pdf",
          fileSizeBytes: 1024 * 100,
          contentType: "application/pdf", // Catalogue image requires PNG, JPEG or WebP
        }),
      ).toThrow(MediaValidationError);
    });
  });

  describe("validateUploadedBytes", () => {
    it("detects content spoofing where declared type does not match magic bytes", () => {
      // Content is actually JPEG but declared as image/png
      const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      expect(() =>
        validateUploadedBytes({
          category: "business_logo",
          bytes: jpegBytes,
          declaredContentType: "image/png",
        }),
      ).toThrow(MediaValidationError);
      expect(() =>
        validateUploadedBytes({
          category: "business_logo",
          bytes: jpegBytes,
          declaredContentType: "image/png",
        }),
      ).toThrow(/spoofing detected/);
    });

    it("rejects images exceeding category maximum dimensions", () => {
      // PNG with 3000x3000px (business_logo allows max 2048x2048)
      const bytes = new Uint8Array(32);
      bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
      bytes.set([0x00, 0x00, 0x00, 0x0d], 8);
      bytes.set([0x49, 0x48, 0x44, 0x52], 12);
      bytes.set([0x00, 0x00, 0x0b, 0xb8], 16); // 3000
      bytes.set([0x00, 0x00, 0x0b, 0xb8], 20); // 3000

      expect(() =>
        validateUploadedBytes({
          category: "business_logo",
          bytes,
          declaredContentType: "image/png",
        }),
      ).toThrow(MediaValidationError);
      expect(() =>
        validateUploadedBytes({
          category: "business_logo",
          bytes,
          declaredContentType: "image/png",
        }),
      ).toThrow(/dimensions \(3000x3000 px\) exceed maximum permitted/);
    });
  });
});
