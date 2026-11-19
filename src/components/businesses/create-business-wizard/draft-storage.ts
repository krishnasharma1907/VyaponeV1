/**
 * VyapOne — Create Business Setup Secure Draft Storage [VO-033 Correction]
 *
 * Implements client-side draft save/resume using browser localStorage with:
 * 1. Strict user-and-workspace scoping (vyapone:create-business-draft:{userId}:{workspaceId})
 * 2. Fail-closed null checks (no shared "default" keys)
 * 3. Strict privacy allowlist: statutory tax identifiers (PAN, GSTIN) are NEVER persisted
 * 4. Deep sanitization of custom/dynamic onboarding answers
 * 5. Draft expiration (TTL: 24h) and clock-skew tolerance validation
 *
 * Technical Decision (Provisional):
 * Draft TTL is set to 24 hours (86,400,000 ms) with 5 minutes clock-skew tolerance.
 */

import type { SafeDraftFormData, WizardDraft, WizardFormData, WizardStep } from "./types";

export const DRAFT_PREFIX = "vyapone:create-business-draft:";
export const DRAFT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Derives a strictly scoped localStorage key combining authenticated userId and workspaceId.
 * Fails closed (returns null) if either identifier is missing or blank.
 */
export function getDraftStorageKey(
  userId?: string | null,
  workspaceId?: string | null,
): string | null {
  if (!userId || !workspaceId) return null;
  const cleanUser = userId.trim();
  const cleanWs = workspaceId.trim();
  if (cleanUser.length === 0 || cleanWs.length === 0) return null;
  return `${DRAFT_PREFIX}${cleanUser}:${cleanWs}`;
}

/**
 * Patterns matching sensitive fields that must NEVER be persisted in browser storage.
 */
const SENSITIVE_KEY_PATTERN = /(pan|gst|tax_id|ssn|aadhaar|aadhar|password|secret|token)/i;

/**
 * Sanitizes arbitrary dynamic answer objects, recursively stripping any sensitive properties.
 */
export function sanitizeAnswersForStorage(
  answers: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(answers)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      continue; // Exclude sensitive key
    }

    if (value && typeof value === "object" && !Array.isArray(value)) {
      result[key] = sanitizeAnswersForStorage(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Strips statutory identifiers (PAN, GSTIN) and sensitive nested keys from the form state.
 * Only safe, approved properties are retained in browser storage.
 */
export function sanitizeDraftForStorage(data: WizardFormData): SafeDraftFormData {
  const sanitizedAnswers = sanitizeAnswersForStorage(data.onboarding_answers || {});

  const safe: SafeDraftFormData = {
    // Step 1: Niche
    niche_slug: data.niche_slug || "",
    niche_group_slug: data.niche_group_slug || "",
    niche_name: data.niche_name || "",

    // Step 2: Basic Facts (PAN and GSTIN are explicitly excluded)
    trade_name: data.trade_name || "",
    legal_name: data.legal_name || "",
    slug: data.slug || "",
    description: data.description || "",
    location_name: data.location_name || "",
    address_line1: data.address_line1 || "",
    address_line2: data.address_line2 || "",
    city: data.city || "",
    state: data.state || "",
    postal_code: data.postal_code || "",
    primary_phone: data.primary_phone || "",
    whatsapp_number: data.whatsapp_number || "",
    email: data.email || "",
    tax_scheme: data.tax_scheme || "unregistered",

    // Step 3: Media
    logo_media_id: data.logo_media_id || null,
    logo_preview_url: data.logo_preview_url || null,
    showcase_media_ids: data.showcase_media_ids || [],
    showcase_preview_urls: data.showcase_preview_urls || [],

    // Step 4: Questions (sanitized)
    onboarding_answers: sanitizedAnswers,

    // Draft metadata
    businessId: data.businessId || null,
  };

  return safe;
}

/**
 * Reconstructs a complete WizardFormData object from safe draft data,
 * guaranteeing that pan_number and gst_number are restored as empty strings.
 */
export function restoreDraftFormData(safeData: Partial<SafeDraftFormData>): WizardFormData {
  return {
    niche_slug: safeData.niche_slug || "",
    niche_group_slug: safeData.niche_group_slug || "",
    niche_name: safeData.niche_name || "",

    trade_name: safeData.trade_name || "",
    legal_name: safeData.legal_name || "",
    slug: safeData.slug || "",
    description: safeData.description || "",
    location_name: safeData.location_name || "",
    address_line1: safeData.address_line1 || "",
    address_line2: safeData.address_line2 || "",
    city: safeData.city || "",
    state: safeData.state || "",
    postal_code: safeData.postal_code || "",
    primary_phone: safeData.primary_phone || "",
    whatsapp_number: safeData.whatsapp_number || "",
    email: safeData.email || "",

    // Statutory identifiers are always empty when resuming a persisted draft
    gst_number: "",
    pan_number: "",
    tax_scheme: safeData.tax_scheme || "unregistered",

    logo_media_id: safeData.logo_media_id || null,
    logo_preview_url: safeData.logo_preview_url || null,
    showcase_media_ids: safeData.showcase_media_ids || [],
    showcase_preview_urls: safeData.showcase_preview_urls || [],

    onboarding_answers: safeData.onboarding_answers || {},
    businessId: safeData.businessId || null,
  };
}

/**
 * Persists a wizard draft safely in localStorage.
 * Fails closed (returns false) if userId or workspaceId is missing.
 */
export function saveWizardDraft(
  userId: string | null | undefined,
  workspaceId: string | null | undefined,
  data: WizardFormData,
  step: WizardStep,
): boolean {
  if (typeof window === "undefined") return false;

  const key = getDraftStorageKey(userId, workspaceId);
  if (!key || !userId || !workspaceId) return false;

  try {
    const safeData = sanitizeDraftForStorage(data);
    const draft: WizardDraft = {
      version: "1.0",
      step,
      data: safeData,
      savedAt: new Date().toISOString(),
      userId: userId.trim(),
      workspaceId: workspaceId.trim(),
    };
    window.localStorage.setItem(key, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

/**
 * Loads and validates a wizard draft from localStorage.
 * Validates storage key scoping, version, timestamp validity, clock-skew, and expiration.
 * Stale or invalid drafts are automatically removed and null is returned.
 */
export function loadWizardDraft(
  userId: string | null | undefined,
  workspaceId: string | null | undefined,
): { step: WizardStep; data: WizardFormData; savedAt: string } | null {
  if (typeof window === "undefined") return null;

  const key = getDraftStorageKey(userId, workspaceId);
  if (!key || !userId || !workspaceId) return null;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as WizardDraft;
    if (!parsed || parsed.version !== "1.0" || !parsed.data) {
      window.localStorage.removeItem(key);
      return null;
    }

    // Verify user and workspace identity match
    if (parsed.userId !== userId.trim() || parsed.workspaceId !== workspaceId.trim()) {
      window.localStorage.removeItem(key);
      return null;
    }

    // Validate timestamp
    if (!parsed.savedAt) {
      window.localStorage.removeItem(key);
      return null;
    }

    const savedTime = Date.parse(parsed.savedAt);
    if (Number.isNaN(savedTime)) {
      window.localStorage.removeItem(key);
      return null;
    }

    const now = Date.now();

    // Reject future timestamps outside clock-skew tolerance
    if (savedTime > now + MAX_CLOCK_SKEW_MS) {
      window.localStorage.removeItem(key);
      return null;
    }

    // Reject and remove expired drafts
    if (now - savedTime > DRAFT_TTL_MS) {
      window.localStorage.removeItem(key);
      return null;
    }

    // Restore safe form data (with empty statutory fields)
    const restoredData = restoreDraftFormData(parsed.data);

    return {
      step: parsed.step,
      data: restoredData,
      savedAt: parsed.savedAt,
    };
  } catch {
    return null;
  }
}

/**
 * Explicitly removes the draft for the given user and workspace.
 */
export function clearWizardDraft(
  userId: string | null | undefined,
  workspaceId: string | null | undefined,
): void {
  if (typeof window === "undefined") return;

  const key = getDraftStorageKey(userId, workspaceId);
  if (!key) return;

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage clear failures
  }
}
