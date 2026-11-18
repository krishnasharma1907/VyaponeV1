/**
 * VyapOne — Media Content & Magic Byte Validation Engine [VO-032]
 *
 * Implements pure-TypeScript magic byte verification, dimension extraction,
 * SVG anti-XSS scanning, and category-level upload constraint enforcement.
 *
 * PRD Authority:
 * - PRD FINAL v2 §15.6 Media (Direct uploads, validation, tenant scoping)
 * - PRD FINAL v2 §17.1 Security (Upload and abuse protections)
 */

export type MediaCategory =
  | "business_logo"
  | "catalogue_image"
  | "website_asset"
  | "document_attachment"
  | "onboarding_upload";

export interface CategoryConstraints {
  category: MediaCategory;
  bucket: "vyapone-public-media" | "vyapone-private-media";
  isPublic: boolean;
  maxSizeBytes: number;
  allowedMimeTypes: readonly string[];
  maxDimensions?: {
    maxWidth: number;
    maxHeight: number;
  };
  description: string;
}

export const CATEGORY_CONSTRAINTS: Record<MediaCategory, CategoryConstraints> = {
  business_logo: {
    category: "business_logo",
    bucket: "vyapone-public-media",
    isPublic: true,
    maxSizeBytes: 2 * 1024 * 1024, // 2 MB
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"],
    maxDimensions: { maxWidth: 2048, maxHeight: 2048 },
    description: "Business brand logo",
  },
  catalogue_image: {
    category: "catalogue_image",
    bucket: "vyapone-public-media",
    isPublic: true,
    maxSizeBytes: 5 * 1024 * 1024, // 5 MB
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
    maxDimensions: { maxWidth: 4096, maxHeight: 4096 },
    description: "Product and catalogue photos",
  },
  website_asset: {
    category: "website_asset",
    bucket: "vyapone-public-media",
    isPublic: true,
    maxSizeBytes: 5 * 1024 * 1024, // 5 MB
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"],
    maxDimensions: { maxWidth: 4096, maxHeight: 4096 },
    description: "Website banner and illustrative media",
  },
  document_attachment: {
    category: "document_attachment",
    bucket: "vyapone-private-media",
    isPublic: false,
    maxSizeBytes: 10 * 1024 * 1024, // 10 MB
    allowedMimeTypes: [
      "application/pdf",
      "text/csv",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
    description: "Business documents, invoices and receipts",
  },
  onboarding_upload: {
    category: "onboarding_upload",
    bucket: "vyapone-private-media",
    isPublic: false,
    maxSizeBytes: 10 * 1024 * 1024, // 10 MB
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "application/pdf"],
    maxDimensions: { maxWidth: 4096, maxHeight: 4096 },
    description: "Onboarding photos of menus, boards and business cards",
  },
};

export const MIME_TO_EXTENSION: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "application/pdf": "pdf",
  "text/csv": "csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};

export class MediaValidationError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "FILE_TOO_LARGE"
      | "UNSUPPORTED_TYPE"
      | "TYPE_MISMATCH"
      | "DIMENSIONS_EXCEEDED"
      | "MALICIOUS_CONTENT"
      | "INVALID_FILENAME"
      | "CORRUPT_FILE"
      | "EXPIRED_AUTHORIZATION",
  ) {
    super(message);
    this.name = "MediaValidationError";
  }
}

/**
 * Detects MIME type by inspecting leading magic bytes.
 */
export function detectMimeType(bytes: Uint8Array): string | null {
  if (bytes.length < 4) {
    return null;
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  // WebP: RIFF ... WEBP
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }

  // GIF: GIF87a or GIF89a
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return "image/gif";
  }

  // PDF: %PDF-
  if (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  ) {
    return "application/pdf";
  }

  // SVG: Inspect text content for <svg
  const headerSlice = bytes.slice(0, Math.min(bytes.length, 1024));
  const headerText = new TextDecoder("utf-8", { fatal: false }).decode(headerSlice).trim();
  if (
    headerText.startsWith("<svg") ||
    (headerText.startsWith("<?xml") && headerText.includes("<svg"))
  ) {
    return "image/svg+xml";
  }

  return null;
}

/**
 * Extracts dimensions from image bytes in pure TypeScript without external C++ or native binaries.
 * Validates header integrity and rejects corrupt or truncated chunks.
 */
export function extractImageDimensions(
  bytes: Uint8Array,
  mimeType: string,
): { width: number; height: number } | null {
  try {
    switch (mimeType) {
      case "image/png": {
        if (bytes.length < 24) return null;
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

        // Verify IHDR chunk length (must be 13 bytes)
        const chunkLength = view.getUint32(8, false);
        if (chunkLength !== 13) return null;

        // Verify chunk type is 'IHDR' (0x49 0x48 0x44 0x52)
        if (bytes[12] !== 0x49 || bytes[13] !== 0x48 || bytes[14] !== 0x44 || bytes[15] !== 0x52) {
          return null;
        }

        const width = view.getUint32(16, false); // Big endian
        const height = view.getUint32(20, false);
        if (width === 0 || height === 0) return null;

        return { width, height };
      }

      case "image/gif": {
        if (bytes.length < 10) return null;
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const width = view.getUint16(6, true); // Little endian
        const height = view.getUint16(8, true);
        if (width === 0 || height === 0) return null;

        return { width, height };
      }

      case "image/webp": {
        if (bytes.length < 30) return null;
        const chunkType = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);

        if (chunkType === "VP8 ") {
          // Lossy format: start code at offset 23
          if (bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
            const width = (bytes[26] | (bytes[27] << 8)) & 0x3fff;
            const height = (bytes[28] | (bytes[29] << 8)) & 0x3fff;
            if (width === 0 || height === 0) return null;
            return { width, height };
          }
        } else if (chunkType === "VP8L") {
          // Lossless format: 14 bits for width-1 and height-1 starting at byte 21
          if (bytes[20] === 0x2f) {
            const b0 = bytes[21];
            const b1 = bytes[22];
            const b2 = bytes[23];
            const b3 = bytes[24];
            const width = 1 + ((b0 | (b1 << 8)) & 0x3fff);
            const height = 1 + (((b1 >> 6) | (b2 << 2) | ((b3 & 0x0f) << 10)) & 0x3fff);
            if (width === 0 || height === 0) return null;
            return { width, height };
          }
        } else if (chunkType === "VP8X") {
          // Extended format: 24-bit canvas width and height
          const width = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
          const height = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
          if (width === 0 || height === 0) return null;
          return { width, height };
        }
        return null;
      }

      case "image/jpeg": {
        let offset = 2;
        const length = bytes.length;
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

        while (offset < length - 8) {
          if (bytes[offset] !== 0xff) {
            offset++;
            continue;
          }

          const marker = bytes[offset + 1];

          // Standalone markers without length
          if (
            marker === 0xd8 || // SOI
            marker === 0xd9 || // EOI
            marker === 0x00 ||
            marker === 0x01 ||
            (marker >= 0xd0 && marker <= 0xd7) // RST
          ) {
            offset += 2;
            continue;
          }

          if (offset + 3 >= length) return null;
          const segmentLength = view.getUint16(offset + 2, false);
          if (segmentLength < 2) return null;

          // SOF markers (Start of Frame)
          if (
            marker === 0xc0 ||
            marker === 0xc1 ||
            marker === 0xc2 ||
            marker === 0xc3 ||
            marker === 0xc5 ||
            marker === 0xc6 ||
            marker === 0xc7 ||
            marker === 0xc9 ||
            marker === 0xca ||
            marker === 0xcb ||
            marker === 0xcd ||
            marker === 0xce ||
            marker === 0xcf
          ) {
            if (offset + 8 >= length) return null;
            const height = view.getUint16(offset + 5, false);
            const width = view.getUint16(offset + 7, false);
            if (width === 0 || height === 0) return null;
            return { width, height };
          }

          offset += 2 + segmentLength;
        }
        return null;
      }

      default:
        return null;
    }
  } catch {
    return null;
  }
}

export const ALLOWED_SVG_ELEMENTS = new Set([
  "svg",
  "g",
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "text",
  "tspan",
  "defs",
  "lineargradient",
  "radialgradient",
  "stop",
  "use",
  "symbol",
  "title",
  "desc",
  "clippath",
  "mask",
  "pattern",
]);

/**
 * Validates SVG content against script injection, active event handlers,
 * XML entity injection (XXE), and unapproved foreign elements.
 */
export function sanitizeSvgContent(bytes: Uint8Array): void {
  const content = new TextDecoder("utf-8", { fatal: false }).decode(bytes);

  // 1. XXE & DTD entities mitigation (Billion Laughs / file inclusion)
  if (/<!(ENTITY|DOCTYPE)\b/i.test(content) || /\b(SYSTEM|PUBLIC)\b/i.test(content)) {
    throw new MediaValidationError(
      "SVG file contains forbidden XML entity or DOCTYPE declarations (XXE mitigation).",
      "MALICIOUS_CONTENT",
    );
  }

  // 2. CDATA sections mitigation
  if (/<!\[CDATA\[/i.test(content)) {
    throw new MediaValidationError(
      "SVG file contains forbidden CDATA blocks.",
      "MALICIOUS_CONTENT",
    );
  }

  // 3. Executable <script> elements
  if (/<script\b/i.test(content)) {
    throw new MediaValidationError(
      "SVG file contains forbidden executable <script> elements.",
      "MALICIOUS_CONTENT",
    );
  }

  // 4. Inline active event handlers (e.g. onload, onerror, onclick)
  if (/\bon[a-z]+\s*=/i.test(content)) {
    throw new MediaValidationError(
      "SVG file contains forbidden active event handlers.",
      "MALICIOUS_CONTENT",
    );
  }

  // 5. Forbidden embedded/foreign/active elements
  if (
    /<(foreignObject|iframe|embed|object|base|link|meta|form|input|button|audio|video|source|track|applet|frame|frameset|feComponentTransfer|handler|listener|animate|set)\b/i.test(
      content,
    )
  ) {
    throw new MediaValidationError(
      "SVG file contains forbidden embedded or foreign object elements.",
      "MALICIOUS_CONTENT",
    );
  }

  // 6. Dangerous URLs / pseudoprotocols
  if (/(javascript|vbscript)\s*:/i.test(content)) {
    throw new MediaValidationError(
      "SVG file contains forbidden 'javascript:' URLs.",
      "MALICIOUS_CONTENT",
    );
  }
  if (/(href|src|xlink:href)\s*=\s*['"]\s*data:/i.test(content)) {
    throw new MediaValidationError(
      "SVG file contains forbidden 'data:' URL references.",
      "MALICIOUS_CONTENT",
    );
  }
  if (/(href|src|xlink:href)\s*=\s*['"]\s*(https?:|\/\/)/i.test(content)) {
    throw new MediaValidationError(
      "SVG file contains forbidden external network resource references.",
      "MALICIOUS_CONTENT",
    );
  }

  // 7. Embedded CSS expressions or imports
  if (/<style\b[^>]*>[\s\S]*?(url\(|@import|-moz-binding|expression\()/i.test(content)) {
    throw new MediaValidationError(
      "SVG style block contains forbidden external imports or expressions.",
      "MALICIOUS_CONTENT",
    );
  }

  // 8. Element allow-list validation: every element tag must be approved
  const tagMatches = content.matchAll(/<\s*([a-zA-Z0-9:-]+)/g);
  for (const match of tagMatches) {
    const rawTag = match[1];
    if (rawTag.startsWith("?") || rawTag.startsWith("!--")) {
      continue; // XML processing instruction or comment
    }
    const tag = rawTag.toLowerCase().replace(/^svg:/, "");
    if (!ALLOWED_SVG_ELEMENTS.has(tag)) {
      throw new MediaValidationError(
        `SVG element <${rawTag}> is not in the approved safe element allowlist.`,
        "MALICIOUS_CONTENT",
      );
    }
  }
}

/**
 * Extracts normalized file extension from a filename.
 */
export function getExtensionFromFilename(filename: string): string | null {
  const clean = sanitizeFilename(filename);
  const lastDot = clean.lastIndexOf(".");
  if (lastDot < 0 || lastDot === clean.length - 1) {
    return null;
  }
  return clean.substring(lastDot + 1).toLowerCase();
}

/**
 * Sanitizes a client-supplied filename to prevent directory traversal and invalid characters.
 */
export function sanitizeFilename(rawFilename: string): string {
  // Strip path traversal sequences first
  let clean = rawFilename.replace(/\.\.+[\/\\]*/g, "");
  // Strip any remaining path separators
  clean = clean.replace(/[\/\\]+/g, "");
  // Strip control chars and non-printable characters
  clean = clean.replace(/[\x00-\x1F\x7F<>:"|?*]/g, "").trim();
  // Strip leading dots to prevent hidden files or traversal artifacts
  clean = clean.replace(/^\.+/, "");

  if (!clean) {
    clean = "media-upload";
  }

  // Limit filename length to 100 characters while preserving extension
  if (clean.length > 100) {
    const extIndex = clean.lastIndexOf(".");
    if (extIndex > 0) {
      const ext = clean.substring(extIndex);
      clean = clean.substring(0, 100 - ext.length) + ext;
    } else {
      clean = clean.substring(0, 100);
    }
  }

  return clean;
}

/**
 * Generates an unpredictable, business-scoped object storage key.
 * Pattern: `tenants/{business_id}/{category}/{media_id}.{extension}`
 */
export function generateTenantObjectKey(
  businessId: string,
  category: MediaCategory,
  mediaId: string,
  extension: string,
): string {
  const cleanExt = extension.replace(/^\./, "").toLowerCase();
  return `tenants/${businessId}/${category}/${mediaId}.${cleanExt}`;
}

/**
 * Validates pre-upload declaration against category constraints.
 */
export function validateUploadDeclaration(params: {
  category: MediaCategory;
  filename: string;
  fileSizeBytes: number;
  contentType: string;
}): void {
  const constraints = CATEGORY_CONSTRAINTS[params.category];
  if (!constraints) {
    throw new MediaValidationError(
      `Unknown media category: ${params.category}`,
      "UNSUPPORTED_TYPE",
    );
  }

  // File size validation
  if (params.fileSizeBytes <= 0) {
    throw new MediaValidationError("File cannot be empty.", "FILE_TOO_LARGE");
  }

  if (params.fileSizeBytes > constraints.maxSizeBytes) {
    const limitMb = Math.round(constraints.maxSizeBytes / (1024 * 1024));
    throw new MediaValidationError(
      `File size (${(params.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB) exceeds the maximum allowed ${limitMb} MB for ${constraints.description}.`,
      "FILE_TOO_LARGE",
    );
  }

  // Declared Content-Type validation
  const normalizedMime = params.contentType.toLowerCase().trim();
  if (!constraints.allowedMimeTypes.includes(normalizedMime)) {
    throw new MediaValidationError(
      `MIME type "${params.contentType}" is not permitted for category "${params.category}". Allowed: ${constraints.allowedMimeTypes.join(", ")}.`,
      "UNSUPPORTED_TYPE",
    );
  }

  // Filename extension consistency verification
  const ext = getExtensionFromFilename(params.filename);
  if (ext) {
    const expectedExt = MIME_TO_EXTENSION[normalizedMime];
    const isJpegVariant = normalizedMime === "image/jpeg" && (ext === "jpg" || ext === "jpeg");
    if (ext !== expectedExt && !isJpegVariant) {
      throw new MediaValidationError(
        `File extension ".${ext}" does not agree with declared MIME type "${params.contentType}".`,
        "TYPE_MISMATCH",
      );
    }
  }
}

/**
 * Validates uploaded bytes (magic byte signature, dimensions, SVG security).
 */
export function validateUploadedBytes(params: {
  category: MediaCategory;
  bytes: Uint8Array;
  declaredContentType: string;
}): {
  detectedContentType: string;
  width?: number;
  height?: number;
} {
  const constraints = CATEGORY_CONSTRAINTS[params.category];

  // 1. Detect actual MIME type
  const detected = detectMimeType(params.bytes);

  // For CSV and XLSX, magic byte detection is text/zip; if declared matches allowed, verify
  let effectiveMime = detected;
  if (!detected && params.declaredContentType === "text/csv") {
    // Basic CSV heuristic: check valid UTF-8
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(params.bytes.slice(0, 1024));
      effectiveMime = "text/csv";
    } catch {
      effectiveMime = null;
    }
  }

  if (!effectiveMime) {
    throw new MediaValidationError(
      "Unable to verify file signature. File does not match any recognized secure format.",
      "UNSUPPORTED_TYPE",
    );
  }

  // 2. Type mismatch with declared type
  if (effectiveMime !== params.declaredContentType.toLowerCase()) {
    throw new MediaValidationError(
      `File content spoofing detected. Content matches "${effectiveMime}" but was declared as "${params.declaredContentType}".`,
      "TYPE_MISMATCH",
    );
  }

  // 3. Category constraint check
  if (!constraints.allowedMimeTypes.includes(effectiveMime)) {
    throw new MediaValidationError(
      `Detected file format "${effectiveMime}" is not permitted for ${constraints.description}.`,
      "UNSUPPORTED_TYPE",
    );
  }

  // 4. SVG Anti-XSS check
  if (effectiveMime === "image/svg+xml") {
    sanitizeSvgContent(params.bytes);
  }

  // 5. Dimension extraction and bounds check
  let width: number | undefined;
  let height: number | undefined;

  if (effectiveMime.startsWith("image/") && effectiveMime !== "image/svg+xml") {
    const dimensions = extractImageDimensions(params.bytes, effectiveMime);
    if (!dimensions || dimensions.width <= 0 || dimensions.height <= 0) {
      throw new MediaValidationError(
        `Corrupt or malformed ${effectiveMime} header. Dimensions could not be extracted.`,
        "CORRUPT_FILE",
      );
    }
    width = dimensions.width;
    height = dimensions.height;

    if (constraints.maxDimensions) {
      if (
        width > constraints.maxDimensions.maxWidth ||
        height > constraints.maxDimensions.maxHeight
      ) {
        throw new MediaValidationError(
          `Image dimensions (${width}x${height} px) exceed maximum permitted (${constraints.maxDimensions.maxWidth}x${constraints.maxDimensions.maxHeight} px) for ${params.category}.`,
          "DIMENSIONS_EXCEEDED",
        );
      }
    }
  }

  return {
    detectedContentType: effectiveMime,
    width,
    height,
  };
}
