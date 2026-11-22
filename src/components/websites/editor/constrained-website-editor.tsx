"use client";

/**
 * VyapOne — Constrained Visual Website Editor [VO-044]
 *
 * Implements the visual editor for VyapOne storefronts strictly constrained to
 * the 13 approved canonical blocks (PRD FINAL v2 §6.14, §15.3, §16, §17).
 *
 * Architectural & Safety Invariants:
 * 1. Zero Arbitrary Code: Only blocks from APPROVED_BLOCK_REGISTRY can be added/edited.
 * 2. Immutable Version Persistence: Draft saves execute through saveSiteDraftConfigurationAction
 *    invoking the atomic PostgreSQL RPC save_site_draft_configuration_atomic.
 * 3. Draft Isolation: Draft configurations are never published automatically, never update
 *    published_version_id, and are never served on public anonymous routes.
 * 4. Optimistic Concurrency & Conflict Detection: Tracks base version numbers to prevent
 *    silent overwrites when concurrent sessions exist.
 * 5. Dynamic Data Binding: Prices, taxes, and locations remain bound to authoritative runtime facts.
 */

import React, { useMemo, useState } from "react";
import type {
  ApprovedBlockType,
  PageConfig,
  SectionConfig,
  WebsiteConfiguration,
} from "@/lib/websites/types";
import { websiteConfigurationSchema } from "@/lib/websites/schemas";
import { saveSiteDraftConfigurationAction } from "@/lib/websites/actions";
import { APPROVED_BLOCK_REGISTRY } from "@/components/websites/blocks/block-registry";
import { PublicWebsiteRenderer } from "@/components/websites/public-renderer/public-website-renderer";
import type { WebsiteRenderContext } from "@/components/websites/blocks/types";
import { normalizePageSlug } from "@/lib/websites/seo";
import { EditorTopBar } from "./editor-top-bar";
import { PageSelector } from "./page-selector";
import { SectionNavigator } from "./section-navigator";
import { SectionInspector } from "./section-inspector";
import { AddSectionModal } from "./add-section-modal";
import type {
  ConstrainedWebsiteEditorProps,
  EditorDeviceMode,
  EditorSaveStatus,
  EditorViewMode,
} from "./types";

export function ConstrainedWebsiteEditor({
  initialSite,
  initialVersion,
  initialConfiguration,
  context,
  readOnly = false,
  initialDeviceMode = "desktop",
  className = "",
}: ConstrainedWebsiteEditorProps) {
  // Working draft configuration state
  const [configuration, setConfiguration] = useState<WebsiteConfiguration>(initialConfiguration);
  const [selectedSlug, setSelectedSlug] = useState<string>("/");
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);

  // Persistence & feedback state
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<EditorSaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [changeSummary, setChangeSummary] = useState<string>("");
  const [currentVersionNumber, setCurrentVersionNumber] = useState<number | null>(
    initialSite.current_draft_version_id && initialVersion?.version_number
      ? initialVersion.version_number
      : null,
  );

  // UI view controls
  const [viewMode, setViewMode] = useState<EditorViewMode>("split");
  const [deviceMode, setDeviceMode] = useState<EditorDeviceMode>(initialDeviceMode);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string[]>>({});

  // Ensure current active page exists in working draft
  const normalizedSlug = normalizePageSlug(selectedSlug);
  const activePage = useMemo(() => {
    const matched = configuration.pages.find((p) => normalizePageSlug(p.slug) === normalizedSlug);
    return matched || configuration.pages[0] || null;
  }, [configuration.pages, normalizedSlug]);

  // Selected section for inspection
  const selectedSection = useMemo(() => {
    if (!selectedSectionId || !activePage) return null;
    return activePage.sections.find((s) => s.id === selectedSectionId) || null;
  }, [activePage, selectedSectionId]);

  // Memoized preview context marked with previewMode: true
  const previewContext: WebsiteRenderContext = useMemo(() => {
    return {
      ...(context || {
        business: {
          id: initialSite.business_id,
          name: configuration.metadata.title,
          tradeName: configuration.metadata.title,
        },
      }),
      previewMode: true,
    };
  }, [context, initialSite.business_id, configuration.metadata.title]);

  // Handler: Select Page
  const handleSelectPage = (slug: string) => {
    setSelectedSlug(slug);
    setSelectedSectionId(null);
  };

  // Handler: Add New Page
  const handleAddPage = (title: string, slug: string) => {
    if (readOnly) return;
    const newPageId = `page_${Date.now()}`;
    const newPage: PageConfig = {
      id: newPageId,
      slug,
      title,
      isPublished: true,
      sections: [],
    };
    setConfiguration((prev) => ({
      ...prev,
      pages: [...prev.pages, newPage],
    }));
    setSelectedSlug(slug);
    setSelectedSectionId(null);
    setHasUnsavedChanges(true);
    setSaveStatus("unsaved");
  };

  // Handler: Add Approved Block Section
  const handleAddBlock = (type: ApprovedBlockType) => {
    if (readOnly || !activePage) return;
    const metadata = APPROVED_BLOCK_REGISTRY[type]?.metadata;
    if (!metadata) return;

    const newSectionId = `sec_${type}_${Date.now()}`;
    const newSection: SectionConfig = {
      id: newSectionId,
      type,
      variant: metadata.allowedVariants?.[0] || "default",
      isEnabled: true,
      props: { ...(metadata.defaultProps || {}) },
    };

    setConfiguration((prev) => ({
      ...prev,
      pages: prev.pages.map((p) => {
        if (p.id !== activePage.id) return p;
        return {
          ...p,
          sections: [...p.sections, newSection],
        };
      }),
    }));

    setSelectedSectionId(newSectionId);
    setHasUnsavedChanges(true);
    setSaveStatus("unsaved");
  };

  // Handler: Remove Section
  const handleRemoveSection = (sectionId: string) => {
    if (readOnly || !activePage) return;
    setConfiguration((prev) => ({
      ...prev,
      pages: prev.pages.map((p) => {
        if (p.id !== activePage.id) return p;
        return {
          ...p,
          sections: p.sections.filter((s) => s.id !== sectionId),
        };
      }),
    }));

    if (selectedSectionId === sectionId) {
      setSelectedSectionId(null);
    }
    setHasUnsavedChanges(true);
    setSaveStatus("unsaved");
  };

  // Handler: Toggle Section Visibility (Hide/Show)
  const handleToggleSectionEnabled = (sectionId: string) => {
    if (readOnly || !activePage) return;
    setConfiguration((prev) => ({
      ...prev,
      pages: prev.pages.map((p) => {
        if (p.id !== activePage.id) return p;
        return {
          ...p,
          sections: p.sections.map((s) => {
            if (s.id !== sectionId) return s;
            return {
              ...s,
              isEnabled: s.isEnabled === false,
            };
          }),
        };
      }),
    }));

    setHasUnsavedChanges(true);
    setSaveStatus("unsaved");
  };

  // Handler: Reorder Sections (Move Up / Down)
  const handleMoveSection = (index: number, direction: "up" | "down") => {
    if (readOnly || !activePage) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= activePage.sections.length) return;

    const updatedSections = [...activePage.sections];
    const temp = updatedSections[index];
    updatedSections[index] = updatedSections[targetIndex];
    updatedSections[targetIndex] = temp;

    setConfiguration((prev) => ({
      ...prev,
      pages: prev.pages.map((p) => {
        if (p.id !== activePage.id) return p;
        return {
          ...p,
          sections: updatedSections,
        };
      }),
    }));

    setHasUnsavedChanges(true);
    setSaveStatus("unsaved");
  };

  // Handler: Update Section Properties
  const handleUpdateSectionProps = (
    sectionId: string,
    updatedProps: Record<string, unknown>,
    variant?: string,
  ) => {
    if (readOnly || !activePage) return;

    setConfiguration((prev) => ({
      ...prev,
      pages: prev.pages.map((p) => {
        if (p.id !== activePage.id) return p;
        return {
          ...p,
          sections: p.sections.map((s) => {
            if (s.id !== sectionId) return s;
            return {
              ...s,
              variant: variant !== undefined ? variant : s.variant,
              props: updatedProps,
            };
          }),
        };
      }),
    }));

    setHasUnsavedChanges(true);
    setSaveStatus("unsaved");
  };

  // Handler: Save Draft Configuration
  const handleSaveDraft = async () => {
    if (readOnly || isSaving) return;

    // 1. Client-Side Validation against Zod schema
    const parseResult = websiteConfigurationSchema.safeParse(configuration);
    if (!parseResult.success) {
      const errors: Record<string, string[]> = {};
      for (const issue of parseResult.error.issues) {
        const path = issue.path.join(".");
        if (!errors[path]) errors[path] = [];
        errors[path].push(issue.message);
      }
      setValidationErrors(errors);
      setSaveStatus("error");
      setSaveError("Configuration validation failed. Please check field errors.");
      return;
    }

    setValidationErrors({});
    setIsSaving(true);
    setSaveStatus("saving");
    setSaveError(null);

    try {
      const response = await saveSiteDraftConfigurationAction({
        siteId: initialSite.id,
        configuration,
        changeSummary: changeSummary.trim() || undefined,
        expectedBaseVersionNumber: currentVersionNumber,
      });

      if (!response.success) {
        if (response.code === "CONFLICT" || response.error.toLowerCase().includes("conflict")) {
          setSaveStatus("conflict");
          setSaveError(
            "Another session saved a newer draft version. Please refresh before saving.",
          );
        } else {
          setSaveStatus("error");
          setSaveError(response.error || "Failed to save draft configuration.");
        }
        return;
      }

      // Success: update draft state
      setCurrentVersionNumber(response.data.version.version_number);
      setConfiguration(response.data.configuration);
      setHasUnsavedChanges(false);
      setSaveStatus("saved");
      setChangeSummary("");
      setSaveError(null);
    } catch (err) {
      setSaveStatus("error");
      setSaveError(
        err instanceof Error ? err.message : "An unexpected error occurred while saving.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className={`flex flex-col h-[calc(100vh-140px)] min-h-[640px] bg-slate-100 rounded-2xl overflow-hidden border border-slate-300 shadow-md pb-[env(safe-area-inset-bottom,0px)] ${className}`.trim()}
    >
      {/* Top Bar Controls */}
      <EditorTopBar
        siteSubdomain={initialSite.subdomain}
        versionNumber={currentVersionNumber}
        saveStatus={saveStatus}
        saveError={saveError}
        changeSummary={changeSummary}
        onChangeSummary={setChangeSummary}
        onSave={handleSaveDraft}
        isSaving={isSaving}
        hasUnsavedChanges={hasUnsavedChanges}
        viewMode={viewMode}
        onChangeViewMode={setViewMode}
        deviceMode={deviceMode}
        onChangeDeviceMode={setDeviceMode}
      />

      {/* Page Tabs */}
      <PageSelector
        pages={configuration.pages}
        selectedSlug={selectedSlug}
        onSelectSlug={handleSelectPage}
        onAddPage={handleAddPage}
      />

      {/* Main Split Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Pane: Editor Controls (Sections & Inspector) */}
        {(viewMode === "split" || viewMode === "edit") && (
          <div
            className={`flex flex-col h-full bg-white transition-all shrink-0 ${
              viewMode === "split"
                ? "w-full md:w-[380px] lg:w-[420px] xl:w-[460px] border-r border-slate-200"
                : "w-full"
            }`}
          >
            {selectedSection ? (
              <SectionInspector
                section={selectedSection}
                onUpdateProps={handleUpdateSectionProps}
                onClose={() => setSelectedSectionId(null)}
                validationErrors={validationErrors}
                className="flex-1"
              />
            ) : (
              <SectionNavigator
                sections={activePage?.sections || []}
                selectedSectionId={selectedSectionId}
                onSelectSection={setSelectedSectionId}
                onMoveUp={(idx) => handleMoveSection(idx, "up")}
                onMoveDown={(idx) => handleMoveSection(idx, "down")}
                onToggleEnabled={handleToggleSectionEnabled}
                onRemoveSection={handleRemoveSection}
                onOpenAddModal={() => setIsAddModalOpen(true)}
                className="flex-1"
              />
            )}
          </div>
        )}

        {/* Right Pane: Live Draft Preview */}
        {(viewMode === "split" || viewMode === "preview") && (
          <div className="flex-1 flex flex-col h-full bg-slate-200/80 overflow-hidden">
            {/* Draft Preview Header Banner */}
            <div className="bg-amber-100/90 border-b border-amber-200 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-950 font-medium">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <span>Private Draft Preview</span>
                </div>
                <span
                  data-testid="preview-device-badge"
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono font-medium bg-amber-200/70 text-amber-900 border border-amber-300"
                >
                  {deviceMode === "mobile"
                    ? "Mobile Viewport (390px)"
                    : deviceMode === "tablet"
                      ? "Tablet Viewport (768px)"
                      : "Desktop Viewport (Responsive)"}
                </span>
                <span className="text-amber-700/80 font-normal hidden lg:inline">
                  — Customers only see published versions.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-amber-800 font-mono bg-amber-200/50 px-2 py-0.5 rounded-xs">
                  {selectedSlug}
                </span>
              </div>
            </div>

            {/* Scrollable Storefront Frame Area */}
            <div
              data-testid="preview-viewport-wrapper"
              className="flex-1 overflow-y-auto overflow-x-auto p-2 sm:p-4 md:p-6 flex justify-center items-start"
            >
              <div
                data-testid="preview-canvas"
                data-device-mode={deviceMode}
                className={`bg-white transition-all duration-300 ease-in-out shrink-0 overflow-hidden ${
                  deviceMode === "mobile"
                    ? "w-[390px] max-w-full rounded-[32px] border-[6px] border-slate-800 shadow-2xl min-h-[720px]"
                    : deviceMode === "tablet"
                      ? "w-[768px] max-w-full rounded-2xl border-4 border-slate-700/80 shadow-xl min-h-[640px]"
                      : "w-full max-w-[1200px] rounded-xl border border-slate-300 shadow-lg min-h-[500px]"
                }`}
              >
                {/* Mobile Camera Notch / Bezel Simulator */}
                {deviceMode === "mobile" && (
                  <div
                    data-testid="mobile-notch"
                    className="w-full bg-slate-800 h-5 flex items-center justify-center rounded-t-[24px] select-none pointer-events-none"
                    aria-hidden="true"
                  >
                    <div className="w-16 h-3 bg-slate-900 rounded-full flex items-center justify-end px-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                    </div>
                  </div>
                )}

                <PublicWebsiteRenderer
                  configuration={configuration}
                  context={previewContext}
                  currentPath={selectedSlug}
                  subdomain={initialSite.subdomain}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Approved Block Modal */}
      <AddSectionModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddBlock={handleAddBlock}
      />
    </div>
  );
}
