/**
 * VyapOne — Constrained Visual Editor Types [VO-044]
 *
 * Types for the structured, constrained visual website editor.
 * Complies with PRD FINAL v2 §6.14, §15.3 and Phase P4 invariants:
 * - Operates exclusively on the 13 approved canonical blocks.
 * - Manages working draft state without mutating published versions.
 * - Enforces client and server validation before persistence.
 */

import type {
  ApprovedBlockType,
  SectionConfig,
  WebsiteConfiguration,
  SiteRow,
  SiteVersionRow,
} from "@/lib/websites/types";
import type { WebsiteRenderContext } from "@/components/websites/blocks/types";

export type EditorSaveStatus = "idle" | "unsaved" | "saving" | "saved" | "error" | "conflict";

export type EditorViewMode = "split" | "edit" | "preview";

export interface ConstrainedWebsiteEditorProps {
  initialSite: SiteRow;
  initialVersion?: SiteVersionRow | null;
  initialConfiguration: WebsiteConfiguration;
  context?: WebsiteRenderContext;
  readOnly?: boolean;
  className?: string;
}

export interface SectionNavigatorProps {
  sections: SectionConfig[];
  selectedSectionId: string | null;
  onSelectSection: (sectionId: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onToggleEnabled: (sectionId: string) => void;
  onRemoveSection: (sectionId: string) => void;
  onOpenAddModal: () => void;
  className?: string;
}

export interface SectionInspectorProps {
  section: SectionConfig;
  onUpdateProps: (
    sectionId: string,
    updatedProps: Record<string, unknown>,
    variant?: string,
  ) => void;
  onClose: () => void;
  validationErrors?: Record<string, string[]>;
  className?: string;
}

export interface AddSectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddBlock: (type: ApprovedBlockType) => void;
}

export interface EditorTopBarProps {
  siteSubdomain: string;
  versionNumber: number;
  saveStatus: EditorSaveStatus;
  saveError?: string | null;
  changeSummary: string;
  onChangeSummary: (summary: string) => void;
  onSave: () => void;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  viewMode: EditorViewMode;
  onChangeViewMode: (mode: EditorViewMode) => void;
  className?: string;
}

export interface PageSelectorProps {
  pages: Array<{ id: string; slug: string; title: string }>;
  selectedSlug: string;
  onSelectSlug: (slug: string) => void;
  onAddPage: (title: string, slug: string) => void;
  className?: string;
}
