/**
 * VyapOne — Custom Domain Provider Adapter Types [VO-049]
 *
 * Defines the contract for external DNS/SSL domain providers (e.g., Cloudflare for SaaS,
 * Vercel Domains, AWS Route53/ACM) behind a provider-agnostic adapter.
 */

import type { DomainVerificationMethod } from "../types";

export interface DnsChallengeResult {
  method: DomainVerificationMethod;
  host: string;
  value: string;
  token: string;
}

export interface DomainVerificationResult {
  verified: boolean;
  sslStatus: "pending" | "active" | "failed";
  reason?: string;
}

/**
 * Adapter interface for interacting with third-party domain and SSL infrastructure.
 */
export interface CustomDomainProviderAdapter {
  readonly providerName: string;

  /**
   * Registers a domain with the DNS/edge provider and generates verification challenges.
   */
  createDnsChallenge(domain: string): Promise<DnsChallengeResult>;

  /**
   * Checks whether the DNS records have propagated and verifies ownership.
   */
  verifyDomain(domain: string, expectedToken: string): Promise<DomainVerificationResult>;

  /**
   * De-registers a domain from the provider.
   */
  removeDomain(domain: string): Promise<{ success: boolean; reason?: string }>;
}
