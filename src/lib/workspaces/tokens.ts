import crypto from "node:crypto";

/**
 * Generates a cryptographically secure random invitation token.
 * 32 bytes of randomness encoded as a 64-character hexadecimal string.
 */
export function generateInvitationToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Produces a SHA-256 hash of the plaintext invitation token.
 * Raw tokens must never be persisted to the database.
 */
export function hashInvitationToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Checks whether an expiration timestamp has elapsed.
 */
export function isInvitationExpired(expiresAt: string | Date): boolean {
  const expiryTime = new Date(expiresAt).getTime();
  return Date.now() > expiryTime;
}
