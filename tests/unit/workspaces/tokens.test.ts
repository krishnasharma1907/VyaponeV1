import { describe, expect, it } from "vitest";
import {
  generateInvitationToken,
  hashInvitationToken,
  isInvitationExpired,
} from "@/lib/workspaces/tokens";

describe("Workspace Invitation Tokens & Cryptographic Hashing [VO-022]", () => {
  it("generates 64-character hexadecimal random token with high entropy", () => {
    const token1 = generateInvitationToken();
    const token2 = generateInvitationToken();

    expect(token1).toHaveLength(64);
    expect(token2).toHaveLength(64);
    expect(token1).toMatch(/^[a-f0-9]{64}$/);
    expect(token1).not.toBe(token2);
  });

  it("produces deterministic SHA-256 hash for identical tokens", () => {
    const rawToken = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    const hash1 = hashInvitationToken(rawToken);
    const hash2 = hashInvitationToken(rawToken);

    expect(hash1).toHaveLength(64);
    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(rawToken);
  });

  it("produces different hashes for distinct tokens", () => {
    const hash1 = hashInvitationToken("token_alpha_12345678901234567890");
    const hash2 = hashInvitationToken("token_bravo_12345678901234567890");

    expect(hash1).not.toBe(hash2);
  });

  it("accurately detects expired and valid token timestamps", () => {
    const pastTimestamp = new Date(Date.now() - 3600 * 1000).toISOString();
    const futureTimestamp = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

    expect(isInvitationExpired(pastTimestamp)).toBe(true);
    expect(isInvitationExpired(futureTimestamp)).toBe(false);
  });
});
