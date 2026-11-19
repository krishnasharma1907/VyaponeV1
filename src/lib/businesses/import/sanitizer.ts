/**
 * VyapOne — Business Import Security Sanitizer [VO-034]
 *
 * Implements defenses against:
 * 1. CSV / Spreadsheet Formula Injection (CWE-1236)
 * 2. Cross-Site Scripting (XSS) / dangerous markup injection in imported text
 * 3. Null byte and control character attacks
 */

/**
 * Characters that trigger formula execution in spreadsheet software (Excel, Sheets, LibreOffice).
 */
const FORMULA_INJECTION_PREFIXES = ["=", "+", "-", "@", "\t", "\r", "|"];

/**
 * Neutralizes potential formula injection in string values extracted from CSV/TSV or untrusted inputs.
 * If a value begins with a formula trigger character, it is safely escaped with a leading single quote (')
 * or sanitized so it cannot be interpreted as an executable formula.
 */
export function sanitizeFormulaInjection(value: string): string {
  if (!value || typeof value !== "string") return "";

  const trimmed = value.trim();
  if (trimmed.length === 0) return "";

  // Check if the trimmed value starts with any formula injection trigger
  const startsWithFormulaChar = FORMULA_INJECTION_PREFIXES.some((prefix) =>
    trimmed.startsWith(prefix),
  );

  if (startsWithFormulaChar) {
    // If it's a numeric value like "-50" or "+91", check if it's purely a signed number or phone
    const isPureNumberOrPhone = /^[+-]?\d+(\.\d+)?$/.test(trimmed) || /^\+\d{10,15}$/.test(trimmed);
    if (isPureNumberOrPhone) {
      return trimmed;
    }

    // Dangerous formula (e.g. "=SUM(...)", "=CMD|...", "@SUM(...)"): escape with leading single quote
    return `'${trimmed}`;
  }

  return trimmed;
}

/**
 * Strips HTML tags, script elements, and dangerous javascript: or data: URIs from imported strings.
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
 * Removes null bytes, carriage return bombs, and dangerous unprintable control characters.
 */
export function sanitizeControlChars(value: string): string {
  if (!value || typeof value !== "string") return "";

  // Remove null bytes and unprintable ASCII control characters (except newline, tab)
  return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim();
}

/**
 * Comprehensive multi-layered sanitization for any imported text field.
 */
export function sanitizeImportText(value: string): string {
  if (!value || typeof value !== "string") return "";

  let sanitized = sanitizeControlChars(value);
  sanitized = sanitizeHtmlTags(sanitized);
  sanitized = sanitizeFormulaInjection(sanitized);

  return sanitized;
}
