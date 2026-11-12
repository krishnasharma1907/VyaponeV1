/**
 * VyapOne Authentication & Security Utilities
 *
 * Implements open-redirect protection, Indian mobile number (E.164) normalization,
 * and user-safe error sanitization to prevent account enumeration and credential leakage.
 */

/**
 * Normalizes phone numbers to standard E.164 format with India (+91) primary support.
 *
 * Examples:
 * - "9876543210" -> "+919876543210"
 * - "09876543210" -> "+919876543210"
 * - "919876543210" -> "+919876543210"
 * - "+91 98765-43210" -> "+919876543210"
 * - "+1 (555) 123-4567" -> "+15551234567"
 */
export function normalizePhoneNumber(raw: string): string {
  if (!raw || typeof raw !== "string") {
    return "";
  }

  // Remove spaces, dashes, dots, parentheses
  const cleaned = raw.replace(/[\s\-().]/g, "").trim();

  // If already starts with '+', keep '+' and retain following digits
  if (cleaned.startsWith("+")) {
    const digits = cleaned.slice(1).replace(/\D/g, "");
    return `+${digits}`;
  }

  // If 11 digits starting with '0', strip leading '0' and assume India (+91)
  if (/^0[6-9]\d{9}$/.test(cleaned)) {
    return `+91${cleaned.slice(1)}`;
  }

  // If 12 digits starting with '91', prepend '+'
  if (/^91[6-9]\d{9}$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  // If standard 10-digit Indian mobile number (starts with 6, 7, 8, 9)
  if (/^[6-9]\d{9}$/.test(cleaned)) {
    return `+91${cleaned}`;
  }

  // If raw digits only, retain as-is or fallback
  return cleaned;
}

/**
 * Checks if a normalized phone number matches Indian mobile format (+91 followed by 10 digits starting with 6-9).
 */
export function isValidIndianMobile(phone: string): boolean {
  return /^\+91[6-9]\d{9}$/.test(phone);
}

/**
 * Validates internal redirect paths to prevent Open Redirect vulnerabilities.
 *
 * Strict Rules:
 * 1. Must be a non-empty string starting with a single '/'
 * 2. Must NOT start with '//' (scheme-relative redirect)
 * 3. Must NOT contain backslashes '\' (Windows path evasion)
 * 4. Must NOT contain ASCII control characters or newlines
 * 5. Must resolve to the exact same origin when parsed with a dummy origin
 */
export function isValidInternalRedirect(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") {
    return false;
  }

  const trimmed = url.trim();

  // Must start with '/' and not '//' or '/\'
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.startsWith("/\\")) {
    return false;
  }

  // Must not contain backslashes
  if (trimmed.includes("\\")) {
    return false;
  }

  // Must not contain control characters or newlines
  if (/[\x00-\x1F\x7F]/.test(trimmed)) {
    return false;
  }

  // Parse against a dummy base to verify origin integrity
  try {
    const dummyBase = "http://localhost:3000";
    const parsed = new URL(trimmed, dummyBase);

    // Origin must remain exactly the dummy base
    if (parsed.origin !== dummyBase) {
      return false;
    }

    // Must not contain username/password in URL
    if (parsed.username || parsed.password) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Maps Supabase Auth or generic authentication errors into user-friendly strings.
 * Guarantees that internal database exceptions, stack traces, and account enumeration
 * cues are NEVER leaked to the client.
 */
export function mapAuthError(error: unknown): string {
  if (!error) {
    return "An unknown error occurred. Please try again.";
  }

  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message: unknown }).message)
        : String(error);

  const lower = message.toLowerCase();

  // Invalid credentials
  if (
    lower.includes("invalid login credentials") ||
    lower.includes("invalid credentials") ||
    lower.includes("invalid password") ||
    lower.includes("user not found")
  ) {
    return "Invalid email, mobile number, or password. Please verify your details.";
  }

  // Unconfirmed email
  if (lower.includes("email not confirmed")) {
    return "Please confirm your email address. Check your inbox for the confirmation link.";
  }

  // Existing user / duplicate
  if (
    lower.includes("user already registered") ||
    lower.includes("already registered") ||
    lower.includes("identity already exists")
  ) {
    return "An account with these details already exists. Please sign in instead.";
  }

  // Invalid or expired OTP token
  if (
    lower.includes("token has expired") ||
    lower.includes("token is invalid") ||
    lower.includes("invalid token") ||
    lower.includes("otp expired") ||
    lower.includes("token expired")
  ) {
    return "The verification code is invalid or has expired. Please request a new code.";
  }

  // Rate limiting
  if (
    lower.includes("rate limit") ||
    lower.includes("too many requests") ||
    lower.includes("over_email_send_rate_limit") ||
    lower.includes("over_sms_send_rate_limit")
  ) {
    return "Too many requests. Please wait a few moments before trying again.";
  }

  // SMS / WhatsApp provider issues
  if (lower.includes("sms") || lower.includes("provider error") || lower.includes("dlt")) {
    return "Unable to send SMS verification code at this moment. Please try again later or use email.";
  }

  // Default sanitized fallback
  return "An error occurred during authentication. Please try again.";
}
