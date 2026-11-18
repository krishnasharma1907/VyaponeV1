/**
 * VyapOne — Create Business Setup Draft Storage [VO-033]
 *
 * Implements client-side draft save/resume using resilient browser localStorage
 * with workspace tenant scoping and schema versioning.
 */

import type { WizardDraft, WizardFormData, WizardStep } from "./types";

const DRAFT_PREFIX = "vyapone_client_draft_";

export function getDraftStorageKey(workspaceId?: string | null): string {
  return `${DRAFT_PREFIX}${workspaceId || "default"}`;
}

export function saveWizardDraft(
  workspaceId: string | null,
  data: WizardFormData,
  step: WizardStep,
): boolean {
  if (typeof window === "undefined") return false;

  try {
    const key = getDraftStorageKey(workspaceId);
    const draft: WizardDraft = {
      version: "1.0",
      step,
      data,
      savedAt: new Date().toISOString(),
      workspaceId,
    };
    window.localStorage.setItem(key, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function loadWizardDraft(workspaceId: string | null): WizardDraft | null {
  if (typeof window === "undefined") return null;

  try {
    const key = getDraftStorageKey(workspaceId);
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as WizardDraft;
    if (parsed && parsed.version === "1.0" && parsed.data) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function clearWizardDraft(workspaceId: string | null): void {
  if (typeof window === "undefined") return;

  try {
    const key = getDraftStorageKey(workspaceId);
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage clear failures
  }
}
