/**
 * VyapOne — Custom Domain Adapter Implementation [VO-049]
 *
 * Provides a mock implementation of CustomDomainProviderAdapter for local development
 * and testing without live Cloudflare/DNS infrastructure.
 */

import { randomUUID } from "node:crypto";
import type {
  CustomDomainProviderAdapter,
  DnsChallengeResult,
  DomainVerificationResult,
} from "./types";

export class MockCustomDomainAdapter implements CustomDomainProviderAdapter {
  readonly providerName = "mock_provider";

  private shouldFailVerification = false;
  private shouldFailRemoval = false;

  constructor(options?: { shouldFailVerification?: boolean; shouldFailRemoval?: boolean }) {
    if (options) {
      this.shouldFailVerification = !!options.shouldFailVerification;
      this.shouldFailRemoval = !!options.shouldFailRemoval;
    }
  }

  setFailVerification(fail: boolean): void {
    this.shouldFailVerification = fail;
  }

  setFailRemoval(fail: boolean): void {
    this.shouldFailRemoval = fail;
  }

  async createDnsChallenge(domain: string): Promise<DnsChallengeResult> {
    const token = `vyapone-verify-${randomUUID().replace(/-/g, "").slice(0, 24)}`;
    return {
      method: "dns_txt",
      host: `_vyapone-challenge.${domain}`,
      value: token,
      token,
    };
  }

  async verifyDomain(domain: string, expectedToken: string): Promise<DomainVerificationResult> {
    if (this.shouldFailVerification || domain.includes("fail-verify")) {
      return {
        verified: false,
        sslStatus: "failed",
        reason: "DNS TXT record not found or does not match challenge token",
      };
    }

    if (!expectedToken || !expectedToken.startsWith("vyapone-verify-")) {
      return {
        verified: false,
        sslStatus: "failed",
        reason: "Invalid challenge token",
      };
    }

    return {
      verified: true,
      sslStatus: "active",
    };
  }

  async removeDomain(domain: string): Promise<{ success: boolean; reason?: string }> {
    if (this.shouldFailRemoval || domain.includes("fail-remove")) {
      return {
        success: false,
        reason: "Provider failed to release domain hostname",
      };
    }

    return {
      success: true,
    };
  }
}

let activeAdapter: CustomDomainProviderAdapter = new MockCustomDomainAdapter();

export function getCustomDomainAdapter(): CustomDomainProviderAdapter {
  return activeAdapter;
}

export function setCustomDomainAdapter(adapter: CustomDomainProviderAdapter): void {
  activeAdapter = adapter;
}
