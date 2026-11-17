/**
 * VyapOne — Audit Log Data Redaction [VO-028]
 *
 * Implements automated, recursive redaction of sensitive credentials,
 * tokens, passwords, OTPs, and private keys from audit metadata before persistence.
 */

const SENSITIVE_KEY_PATTERN =
  /^(password|token|secret|otp|authorization|credit_card|card_number|pin|api_key|access_token|refresh_token|service_key|private_key|cvv|ssn|auth_code|credentials?)$/i;

const SENSITIVE_SUBSTRING_PATTERN =
  /(password|secret|bearer\s+|private_key|refresh_token|access_token)/i;

/**
 * Checks whether a property key matches sensitive credential naming conventions.
 */
export function isSensitiveKey(key: string): boolean {
  if (SENSITIVE_KEY_PATTERN.test(key)) {
    return true;
  }
  // Check for common suffixes or substrings like client_secret, auth_token, user_password
  const normalized = key.toLowerCase().replace(/[-_]/g, "");
  return (
    normalized.includes("password") ||
    normalized.includes("secret") ||
    normalized.includes("token") ||
    normalized.includes("apikey") ||
    normalized.includes("privatekey") ||
    normalized.includes("otp") ||
    normalized.includes("authcode")
  );
}

/**
 * Recursively redacts sensitive fields from any data structure.
 * Returns a deep copy with sensitive values replaced by "[REDACTED]".
 * Safe against circular references and non-plain objects.
 */
export function redactSensitiveData<T>(data: T, seen: WeakSet<object> = new WeakSet()): T {
  if (data === null || data === undefined) {
    return data;
  }

  // Primitive values
  if (typeof data !== "object") {
    if (typeof data === "string" && SENSITIVE_SUBSTRING_PATTERN.test(data)) {
      // If a raw string looks like a bearer header or token, redact it
      if (data.toLowerCase().startsWith("bearer ")) {
        return "[REDACTED]" as unknown as T;
      }
    }
    return data;
  }

  // Prevent infinite loops on circular references
  if (seen.has(data as object)) {
    return "[CIRCULAR]" as unknown as T;
  }
  seen.add(data as object);

  // Arrays
  if (Array.isArray(data)) {
    return data.map((item) => redactSensitiveData(item, seen)) as unknown as T;
  }

  // Dates or RegExp
  if (data instanceof Date || data instanceof RegExp) {
    return data;
  }

  // Plain objects
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (isSensitiveKey(key)) {
      sanitized[key] = "[REDACTED]";
    } else {
      sanitized[key] = redactSensitiveData(value, seen);
    }
  }

  return sanitized as T;
}
