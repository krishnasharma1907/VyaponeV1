/**
 * VyapOne — Audit Log Data Redaction [VO-028]
 *
 * Implements automated, recursive redaction of sensitive credentials,
 * tokens, passwords, OTPs, and private keys from audit metadata before persistence.
 */

const SENSITIVE_KEY_PATTERN =
  /^(password|token|secret|otp|authorization|credit_card|card_number|pin|api_key|access_token|refresh_token|service_key|private_key|cvv|ssn|auth_code|credentials?|signed_url|presigned_url|upload_url|storage_token|storage_key|signature)$/i;

const SENSITIVE_SUBSTRING_PATTERN =
  /(password|secret|bearer\s+|private_key|refresh_token|access_token|signed_url|presigned_url)/i;

/**
 * Checks whether a property key matches sensitive credential naming conventions.
 * Preserves statutory tax and address metadata (pincode, pan_number) while strictly
 * redacting authentication secrets, payment card details, and private keys.
 */
export function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[-_]/g, "");

  // Preserved public/statutory business metadata
  if (
    normalized === "pincode" ||
    normalized === "postalpin" ||
    normalized === "pannumber" ||
    normalized === "taxpan" ||
    normalized === "gstnumber" ||
    normalized === "gstin"
  ) {
    return false;
  }

  if (SENSITIVE_KEY_PATTERN.test(key)) {
    return true;
  }

  return (
    normalized.includes("password") ||
    normalized.includes("secret") ||
    normalized.includes("token") ||
    normalized.includes("apikey") ||
    normalized.includes("privatekey") ||
    normalized.includes("otp") ||
    normalized.includes("authcode") ||
    normalized.includes("cvv") ||
    normalized.includes("creditcard") ||
    normalized.includes("debitcard") ||
    normalized.includes("cardnumber") ||
    normalized.includes("credential") ||
    normalized.includes("signedurl") ||
    normalized.includes("presignedurl") ||
    normalized.includes("uploadurl") ||
    normalized.includes("signature") ||
    (normalized.includes("pin") && !normalized.includes("pincode"))
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
    if (typeof data === "string") {
      // If a raw string looks like a bearer header or token, redact it
      if (data.toLowerCase().startsWith("bearer ") && SENSITIVE_SUBSTRING_PATTERN.test(data)) {
        return "[REDACTED]" as unknown as T;
      }
      // If a string contains signed token/signature query params in URLs, redact it
      if (
        /((\?|&)token=[a-zA-Z0-9_\-\.]+|x-amz-signature=[a-zA-Z0-9_\-]+|sig=[a-zA-Z0-9_\-]+)/i.test(
          data,
        )
      ) {
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
