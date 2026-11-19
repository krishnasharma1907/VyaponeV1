/**
 * VyapOne — Business Import Security Sanitizer [VO-034]
 *
 * Implements defenses against:
 * 1. CSV / Spreadsheet Formula Injection (CWE-1236)
 * 2. Cross-Site Scripting (XSS) / dangerous markup injection in imported text
 * 3. Null bytes, BOM prefixes, and invisible control/formatting characters
 */

/**
 * Characters that trigger formula execution in spreadsheet software (Excel, Sheets, LibreOffice).
 */
const FORMULA_INJECTION_PREFIXES = ["=", "+", "-", "@", "\t", "\r", "|"];

/**
 * Configuration options for field-aware sanitization.
 */
export interface SanitizeOptions {
  fieldCategory?: "phone" | "numeric" | "currency" | "text";
}

/**
 * Removes null bytes, carriage return bombs, BOM markers, zero-width spaces,
 * and dangerous unprintable control characters.
 */
export function sanitizeControlChars(value: string): string {
  if (!value || typeof value !== "string") return "";

  return (
    value
      // Strip null bytes and unprintable ASCII control characters (except newline \n, tab \t)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
      // Strip Unicode Byte Order Mark (BOM)
      .replace(/\uFEFF/g, "")
      // Strip zero-width & invisible formatting characters
      .replace(/[\u200B-\u200D\u2060]/g, "")
      // Strip Unicode BiDi overrides
      .replace(/[\u202A-\u202E\u2066-\u2069]/g, "")
      .trim()
  );
}

/**
 * Strips HTML tags, script elements, and dangerous javascript:, vbscript:, or data: URIs.
 */
export function sanitizeHtmlTags(value: string): string {
  if (!value || typeof value !== "string") return "";

  // Strip script, style, and iframe tags along with their inner contents
  let clean = value.replace(/<(script|style|iframe)[^>]*>[\s\S]*?<\/\1>/gi, "");

  // Strip remaining HTML tags
  clean = clean.replace(/<[^>]+>/g, "");

  // Neutralize javascript: or vbscript: or data: protocols
  clean = clean.replace(/(javascript|vbscript|data):/gi, "");

  return clean.trim();
}

/**
 * Neutralizes potential formula injection in string values extracted from CSV/TSV or untrusted inputs.
 * If a value begins with a formula trigger character, it is safely escaped with a leading single quote (')
 * or sanitized so it cannot be interpreted as an executable formula.
 *
 * Legitimate phone numbers (+91...) and numeric quantities are preserved only when the field type
 * permits or when the string strictly satisfies pure numeric / phone regexes without command triggers.
 */
export function sanitizeFormulaInjection(value: string, options?: SanitizeOptions): string {
  if (!value || typeof value !== "string") return "";

  // Strip invisible control chars & BOM first so hidden prefixes cannot bypass detection
  const clean = sanitizeControlChars(value);
  const trimmed = clean.trim();
  if (trimmed.length === 0) return "";

  // Check if the trimmed value starts with any formula injection trigger
  const startsWithFormulaChar = FORMULA_INJECTION_PREFIXES.some((prefix) =>
    trimmed.startsWith(prefix),
  );

  if (startsWithFormulaChar) {
    const isPurePhone = /^\+\d{10,15}$/.test(trimmed);
    const isPureNumber = /^[+-]?\d+(\.\d+)?$/.test(trimmed);

    if (options?.fieldCategory === "phone") {
      if (isPurePhone || /^\+?[0-9\s-]{10,18}$/.test(trimmed)) {
        return trimmed;
      }
    } else if (options?.fieldCategory === "numeric" || options?.fieldCategory === "currency") {
      if (isPureNumber) {
        return trimmed;
      }
    } else if (options?.fieldCategory === "text") {
      // In a generic text field (e.g. title, notes), any leading formula trigger is escaped
      return `'${trimmed}`;
    } else {
      // Default / untyped: allow strict pure numbers or strict phone numbers
      if (isPureNumber || isPurePhone) {
        return trimmed;
      }
    }

    // Dangerous formula (e.g. "=SUM(...)", "=CMD|...", "@SUM(...)"): escape with leading single quote
    return `'${trimmed}`;
  }

  return trimmed;
}

/**
 * Comprehensive multi-layered sanitization for any imported text field.
 */
export function sanitizeImportText(value: string, options?: SanitizeOptions): string {
  if (!value || typeof value !== "string") return "";

  let sanitized = sanitizeControlChars(value);
  sanitized = sanitizeHtmlTags(sanitized);
  sanitized = sanitizeFormulaInjection(sanitized, options);

  return sanitized;
}

/**
 * Sanitizes any cell value intended for spreadsheet or CSV export,
 * defending against formula injection at data-export boundaries.
 */
export function sanitizeSpreadsheetCell(value: string, options?: SanitizeOptions): string {
  return sanitizeFormulaInjection(value, options);
}
