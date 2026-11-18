/**
 * VyapOne — Mobile-First Create Business Wizard Types [VO-033]
 *
 * Source Authority: PRD FINAL v2 §5.2, §5.3, §14.1 (FR-02), §14.2 (FR-03).
 */

import type { NicheGroupSummary, NicheSummary } from "@/lib/niches/types";

export type WizardStep = 1 | 2 | 3 | 4 | 5;

export interface WizardFormData {
  // Step 1: Niche
  niche_slug: string;
  niche_group_slug: string;
  niche_name: string;

  // Step 2: Basic Facts
  trade_name: string;
  legal_name: string;
  slug: string;
  description: string;
  location_name: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  primary_phone: string;
  whatsapp_number: string;
  email: string;
  gst_number: string;
  pan_number: string;
  tax_scheme: "registered" | "composition" | "unregistered" | "exempt";

  // Step 3: Media
  logo_media_id: string | null;
  logo_preview_url: string | null;
  showcase_media_ids: string[];
  showcase_preview_urls: string[];

  // Step 4: Questions
  onboarding_answers: Record<string, unknown>;

  // Draft metadata
  businessId?: string | null;
}

export interface WizardDraft {
  version: "1.0";
  step: WizardStep;
  data: WizardFormData;
  savedAt: string;
  workspaceId: string | null;
}

export interface CreateBusinessWizardProps {
  workspaceId: string;
  nicheGroups: NicheGroupSummary[];
  niches: NicheSummary[];
  initialNicheSlug?: string;
  onSuccess?: (result: {
    businessId: string;
    slug: string;
    tradeName: string;
    isComplete: boolean;
  }) => void;
  onCancel?: () => void;
}
