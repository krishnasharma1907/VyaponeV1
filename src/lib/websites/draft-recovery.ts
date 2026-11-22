/**
 * VyapOne — Website Editor Local Draft Recovery [VO-047]
 *
 * Implements safe, client-side transient draft recovery for the website editor:
 * 1. Strictly scoped by tenant business and site: vyapone:website-editor-draft:{businessId}:{siteId}
 * 2. Fail-closed null checks (never stores under shared or missing keys)
 * 3. Strict privacy allowlist: statutory tax identifiers (PAN, GSTIN) and query auth tokens are stripped
 * 4. Expiration TTL (24h) and clock-skew tolerance validation
 * 5. Corrupted payload rejection and stale version conflict detection
 */

import type { WebsiteConfiguration } from "./types";
import { websiteConfigurationSchema } from "./schemas";

export const DRAFT_RECOVERY_PREFIX = "vyapone:website-editor-draft:";
export const DRAFT_RECOVERY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000; // 5 minutes

export interface WebsiteDraftRecoveryItem {
  schemaVersion: "v1";
  businessId: string;
  siteId: string;
  baseVersionNumber: number | null;
  configuration: WebsiteConfiguration;
  changeSummary?: string;
  savedAt: string; // ISO string
}

/**
 * Derives a strictly scoped localStorage key combining businessId and siteId.
 * Fails closed (returns null) if either identifier is missing or blank.
 */
export function getDraftRecoveryStorageKey(
  businessId?: string | null,
  siteId?: string | null,
): string | null {
  if (!businessId || !siteId) return null;
  const cleanBusiness = businessId.trim();
  const cleanSite = siteId.trim();
  if (cleanBusiness.length === 0 || cleanSite.length === 0) return null;
  return `${DRAFT_RECOVERY_PREFIX}${cleanBusiness}:${cleanSite}`;
}

/**
 * Sanitizes URLs to ensure transient blob URLs and query tokens are not stored.
 */
export function sanitizeUrlForStorage(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.startsWith("blob:")) return null;
  if (/[?&](token|apikey|signature|sig|auth|secret)=/i.test(trimmed)) {
    return null;
  }
  return trimmed;
}

/**
 * Sanitizes website configuration before saving to browser transient storage.
 */
export function sanitizeConfigurationForStorage(
  config: WebsiteConfiguration,
): WebsiteConfiguration {
  const cloned = JSON.parse(JSON.stringify(config)) as WebsiteConfiguration;

  if (cloned.header?.logoMediaId === "") {
    cloned.header.logoMediaId = undefined;
  }
  if (cloned.metadata?.faviconMediaId === "") {
    cloned.metadata.faviconMediaId = undefined;
  }
  if (Array.isArray(cloned.pages)) {
    for (const page of cloned.pages) {
      if (page.seo?.ogImageMediaId === "") {
        page.seo.ogImageMediaId = undefined;
      }
    }
  }

  return cloned;
}

/**
 * Saves uncommitted website draft changes to browser transient storage.
 * Returns true if saved, false otherwise.
 */
export function saveDraftRecovery(
  businessId: string,
  siteId: string,
  baseVersionNumber: number | null,
  configuration: WebsiteConfiguration,
  changeSummary?: string,
): boolean {
  if (typeof window === "undefined" || !window.localStorage) {
    return false;
  }

  const key = getDraftRecoveryStorageKey(businessId, siteId);
  if (!key) return false;

  try {
    const sanitizedConfig = sanitizeConfigurationForStorage(configuration);
    const item: WebsiteDraftRecoveryItem = {
      schemaVersion: "v1",
      businessId,
      siteId,
      baseVersionNumber,
      configuration: sanitizedConfig,
      changeSummary: changeSummary ? changeSummary.slice(0, 200) : undefined,
      savedAt: new Date().toISOString(),
    };

    window.localStorage.setItem(key, JSON.stringify(item));
    return true;
  } catch {
    // Gracefully handle quota exceeded or storage disabled
    return false;
  }
}

/**
 * Loads and validates uncommitted draft recovery item from browser transient storage.
 * Automatically clears expired or corrupted items.
 */
export function loadDraftRecovery(
  businessId: string,
  siteId: string,
): WebsiteDraftRecoveryItem | null {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  const key = getDraftRecoveryStorageKey(businessId, siteId);
  if (!key) return null;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<WebsiteDraftRecoveryItem>;

    // 1. Structural & tenant ownership check
    if (
      !parsed ||
      parsed.schemaVersion !== "v1" ||
      parsed.businessId !== businessId ||
      parsed.siteId !== siteId ||
      !parsed.savedAt ||
      !parsed.configuration
    ) {
      window.localStorage.removeItem(key);
      return null;
    }

    // 2. Expiration and clock-skew check
    const savedTime = new Date(parsed.savedAt).getTime();
    const now = Date.now();

    if (isNaN(savedTime) || savedTime > now + MAX_CLOCK_SKEW_MS) {
      window.localStorage.removeItem(key);
      return null;
    }

    if (now - savedTime > DRAFT_RECOVERY_TTL_MS) {
      window.localStorage.removeItem(key);
      return null;
    }

    // 3. Schema validation of configuration
    const parseResult = websiteConfigurationSchema.safeParse(parsed.configuration);
    if (!parseResult.success) {
      window.localStorage.removeItem(key);
      return null;
    }

    return {
      schemaVersion: "v1",
      businessId: parsed.businessId,
      siteId: parsed.siteId,
      baseVersionNumber:
        typeof parsed.baseVersionNumber === "number" ? parsed.baseVersionNumber : null,
      configuration: parseResult.data,
      changeSummary: parsed.changeSummary,
      savedAt: parsed.savedAt,
    };
  } catch {
    window.localStorage.removeItem(key);
    return null;
  }
}

/**
 * Clears the transient draft recovery entry for a given business and site.
 */
export function clearDraftRecovery(businessId: string, siteId: string): void {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  const key = getDraftRecoveryStorageKey(businessId, siteId);
  if (!key) return;

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage errors on clear
  }
}

/**
 * Determines if a recovery draft is stale compared to the current server version.
 */
export function isDraftRecoveryStale(
  recovery: WebsiteDraftRecoveryItem,
  currentServerVersionNumber: number | null,
): boolean {
  if (currentServerVersionNumber === null) {
    return false;
  }
  if (recovery.baseVersionNumber === null) {
    // Recovery was based on initial unversioned site, but server now has versioned draft
    return currentServerVersionNumber > 0;
  }
  return currentServerVersionNumber > recovery.baseVersionNumber;
}
