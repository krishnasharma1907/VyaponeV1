"use client";

/**
 * VyapOne — Constrained Visual Website Editor [VO-044, VO-045, VO-046, VO-047]
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
 * 5. Bounded Undo/Redo & Debounced Autosave [VO-047]: Preserves working edits without unbounded
 *    memory growth or silent network data loss.
 * 6. Local Transient Recovery [VO-047]: Recovers from accidental reloads or navigation with
 *    strict tenant isolation, expiration (24h), and zero private credential storage.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ApprovedBlockType,
  PageConfig,
  SectionConfig,
  SiteVersionSummary,
  WebsiteConfiguration,
} from "@/lib/websites/types";
import { websiteConfigurationSchema } from "@/lib/websites/schemas";
import {
  getSiteVersionByIdAction,
  restoreVersionToDraftAction,
  rollbackPublishedVersionAction,
  saveSiteDraftConfigurationAction,
} from "@/lib/websites/actions";
import {
  clearDraftRecovery,
  isDraftRecoveryStale,
  loadDraftRecovery,
  saveDraftRecovery,
  type WebsiteDraftRecoveryItem,
} from "@/lib/websites/draft-recovery";
import { APPROVED_BLOCK_REGISTRY } from "@/components/websites/blocks/block-registry";
import { PublicWebsiteRenderer } from "@/components/websites/public-renderer/public-website-renderer";
import type { WebsiteRenderContext } from "@/components/websites/blocks/types";
import { Button } from "@/components/ui";
import { normalizePageSlug } from "@/lib/websites/seo";
import { useEditorHistory } from "./use-editor-history";
import { EditorTopBar } from "./editor-top-bar";
import { PageSelector } from "./page-selector";
import { SectionNavigator } from "./section-navigator";
import { SectionInspector } from "./section-inspector";
import { AddSectionModal } from "./add-section-modal";
import { VersionHistoryModal } from "./version-history-modal";
import type {
  ConstrainedWebsiteEditorProps,
  EditorDeviceMode,
  EditorSaveStatus,
  EditorViewMode,
} from "./types";

export const AUTOSAVE_DEFAULT_DEBOUNCE_MS = 2500;

export function ConstrainedWebsiteEditor({
  initialSite,
  initialVersion,
  initialConfiguration,
  context,
  availableMedia = [],
  availableModules = {},
  readOnly = false,
  initialDeviceMode = "desktop",
  autosaveDebounceMs = AUTOSAVE_DEFAULT_DEBOUNCE_MS,
  disableAutosave = false,
  className = "",
}: ConstrainedWebsiteEditorProps) {
  // Undo/Redo history stack management [VO-047]
  const { configuration, canUndo, canRedo, undo, redo, setConfiguration, resetHistory } =
    useEditorHistory(initialConfiguration);

  const [selectedSlug, setSelectedSlug] = useState<string>("/");
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);

  // Persistence, concurrency & autosave state [VO-044, VO-047]
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<EditorSaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isAutosaving, setIsAutosaving] = useState<boolean>(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [changeSummary, setChangeSummary] = useState<string>("");
  const [currentVersionNumber, setCurrentVersionNumber] = useState<number | null>(
    initialSite.current_draft_version_id && initialVersion?.version_number
      ? initialVersion.version_number
      : null,
  );

  // Version history & rollback state [VO-048]
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);
  const [inspectedVersion, setInspectedVersion] = useState<{
    summary: SiteVersionSummary;
    configuration: WebsiteConfiguration;
  } | null>(null);
  const [isRestoringVersion, setIsRestoringVersion] = useState<boolean>(false);
  const [isRollingBackVersion, setIsRollingBackVersion] = useState<boolean>(false);
  const [currentPublishedVersionId, setCurrentPublishedVersionId] = useState<string | null>(
    initialSite.published_version_id,
  );

  // Local transient draft recovery prompt state [VO-047]
  const [recoveryPrompt, setRecoveryPrompt] = useState<{
    item: WebsiteDraftRecoveryItem;
    isStale: boolean;
  } | null>(null);

  // UI view controls
  const [viewMode, setViewMode] = useState<EditorViewMode>("split");
  const [deviceMode, setDeviceMode] = useState<EditorDeviceMode>(initialDeviceMode);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string[]>>({});

  // Synchronized refs to avoid stale closures in debounced callbacks & async saves
  const configRef = useRef<WebsiteConfiguration>(configuration);
  configRef.current = configuration;

  const changeSummaryRef = useRef<string>(changeSummary);
  changeSummaryRef.current = changeSummary;

  const currentVersionNumberRef = useRef<number | null>(currentVersionNumber);
  currentVersionNumberRef.current = currentVersionNumber;

  const lastPersistedConfigJsonRef = useRef<string>(JSON.stringify(initialConfiguration));
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef<boolean>(false);
  const pendingSaveRef = useRef<boolean>(false);
  const lastEditTimeRef = useRef<number>(0);
  const lastEditedSectionIdRef = useRef<string | null>(null);

  // 1. Initial Local Recovery Check on Mount [VO-047]
  useEffect(() => {
    const recovery = loadDraftRecovery(initialSite.business_id, initialSite.id);
    if (recovery) {
      const isDifferent =
        JSON.stringify(recovery.configuration) !== JSON.stringify(initialConfiguration);
      if (isDifferent) {
        const isStale = isDraftRecoveryStale(recovery, currentVersionNumber);
        setRecoveryPrompt({ item: recovery, isStale });
      } else {
        clearDraftRecovery(initialSite.business_id, initialSite.id);
      }
    }
  }, [initialSite.business_id, initialSite.id, initialConfiguration, currentVersionNumber]);

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

  // Combine media URLs from context and available business media for draft preview
  const previewMediaUrls = useMemo(() => {
    const map = { ...(context?.mediaUrls || {}) };
    for (const m of availableMedia) {
      if (m.url && !map[m.id]) {
        map[m.id] = m.url;
      }
    }
    return map;
  }, [context?.mediaUrls, availableMedia]);

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
      mediaUrls: previewMediaUrls,
      modules: availableModules || context?.modules,
      previewMode: true,
    };
  }, [
    context,
    initialSite.business_id,
    configuration.metadata.title,
    previewMediaUrls,
    availableModules,
  ]);

  // 2. Navigation Protection (beforeunload) when unsaved changes exist [VO-047]
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  // 3. Draft Persistence Executor (Atomic save via Server Action + optimistic lock) [VO-040, VO-044, VO-047]
  const executeSave = useCallback(
    async (isAuto: boolean = false) => {
      if (readOnly || inspectedVersion !== null) return;

      // Prevent overlapping concurrent saves
      if (isSavingRef.current) {
        pendingSaveRef.current = true;
        return;
      }

      // Clear any pending debounce timer
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }

      const currentConfig = configRef.current;
      const currentSummary = changeSummaryRef.current;
      const currentVersion = currentVersionNumberRef.current;

      // Client-Side Validation against Zod schema
      const parseResult = websiteConfigurationSchema.safeParse(currentConfig);
      if (!parseResult.success) {
        if (!isAuto) {
          const errors: Record<string, string[]> = {};
          for (const issue of parseResult.error.issues) {
            const path = issue.path.join(".");
            if (!errors[path]) errors[path] = [];
            errors[path].push(issue.message);
          }
          setValidationErrors(errors);
          setSaveStatus("error");
          setSaveError("Configuration validation failed. Please check field errors.");
        }
        return;
      }

      setValidationErrors({});
      setIsSaving(true);
      isSavingRef.current = true;
      setIsAutosaving(isAuto);
      setSaveStatus("saving");
      setSaveError(null);

      try {
        const response = await saveSiteDraftConfigurationAction({
          siteId: initialSite.id,
          configuration: currentConfig,
          changeSummary: currentSummary.trim() || undefined,
          expectedBaseVersionNumber: currentVersion,
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

        // Success: update draft version, clean dirty state and clear transient local recovery
        const newVersionNumber = response.data.version.version_number;
        setCurrentVersionNumber(newVersionNumber);
        currentVersionNumberRef.current = newVersionNumber;
        lastPersistedConfigJsonRef.current = JSON.stringify(response.data.configuration);
        setHasUnsavedChanges(false);
        setSaveStatus("saved");
        setLastSavedAt(new Date());
        setSaveError(null);
        clearDraftRecovery(initialSite.business_id, initialSite.id);
      } catch (err) {
        setSaveStatus("error");
        setSaveError(
          err instanceof Error ? err.message : "An unexpected error occurred while saving.",
        );
      } finally {
        setIsSaving(false);
        isSavingRef.current = false;
        setIsAutosaving(false);

        // If another save was queued during in-flight request and config is still dirty
        if (pendingSaveRef.current) {
          pendingSaveRef.current = false;
          if (JSON.stringify(configRef.current) !== lastPersistedConfigJsonRef.current) {
            void executeSave(true);
          }
        }
      }
    },
    [readOnly, inspectedVersion, initialSite.id, initialSite.business_id],
  );

  // 4. Meaningful Change Detection, Transient Recovery Persistence, and Debounced Autosave [VO-047]
  useEffect(() => {
    // If inspecting historical version, completely suspend change detection & autosave
    if (inspectedVersion !== null) {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
      return;
    }

    const currentJson = JSON.stringify(configuration);
    const isDirty = currentJson !== lastPersistedConfigJsonRef.current;

    if (!isDirty) {
      setHasUnsavedChanges(false);
      if (saveStatus === "unsaved") {
        setSaveStatus(lastSavedAt ? "saved" : "idle");
      }
      clearDraftRecovery(initialSite.business_id, initialSite.id);
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
      return;
    }

    // Configuration differs from persisted server state: mark unsaved and persist recovery
    setHasUnsavedChanges(true);
    if (saveStatus !== "saving" && saveStatus !== "conflict") {
      setSaveStatus("unsaved");
    }

    saveDraftRecovery(
      initialSite.business_id,
      initialSite.id,
      currentVersionNumberRef.current,
      configuration,
      changeSummaryRef.current,
    );

    // Schedule debounced autosave
    if (!disableAutosave && !readOnly && saveStatus !== "conflict") {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
      autosaveTimerRef.current = setTimeout(() => {
        void executeSave(true);
      }, autosaveDebounceMs);
    }

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [
    configuration,
    disableAutosave,
    readOnly,
    saveStatus,
    autosaveDebounceMs,
    executeSave,
    lastSavedAt,
    inspectedVersion,
    initialSite.business_id,
    initialSite.id,
  ]);

  // 5. Undo and Redo Actions with keyboard bindings [VO-047]
  const handleUndo = useCallback(() => {
    if (readOnly || !canUndo) return;
    undo();
  }, [readOnly, canUndo, undo]);

  const handleRedo = useCallback(() => {
    if (readOnly || !canRedo) return;
    redo();
  }, [readOnly, canRedo, redo]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (readOnly) return;

      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

      // Ctrl+Z or Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        if (e.shiftKey) {
          if (canRedo) {
            e.preventDefault();
            handleRedo();
          }
        } else {
          if (!isInput && canUndo) {
            e.preventDefault();
            handleUndo();
          }
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        // Ctrl+Y or Cmd+Y
        if (!isInput && canRedo) {
          e.preventDefault();
          handleRedo();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [readOnly, canUndo, canRedo, handleUndo, handleRedo]);

  // Handler: Select Page
  const handleSelectPage = (slug: string) => {
    setSelectedSlug(slug);
    setSelectedSectionId(null);
  };

  // Handler: Add New Page
  const handleAddPage = (title: string, slug: string) => {
    if (readOnly) return;
    lastEditTimeRef.current = 0;
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
  };

  // Handler: Add Approved Block Section
  const handleAddBlock = (type: ApprovedBlockType) => {
    if (readOnly || !activePage) return;
    const metadata = APPROVED_BLOCK_REGISTRY[type]?.metadata;
    if (!metadata) return;

    lastEditTimeRef.current = 0;
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
  };

  // Handler: Remove Section
  const handleRemoveSection = (sectionId: string) => {
    if (readOnly || !activePage) return;
    lastEditTimeRef.current = 0;
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
  };

  // Handler: Toggle Section Visibility (Hide/Show)
  const handleToggleSectionEnabled = (sectionId: string) => {
    if (readOnly || !activePage) return;
    lastEditTimeRef.current = 0;
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
  };

  // Handler: Reorder Sections (Move Up / Down)
  const handleMoveSection = (index: number, direction: "up" | "down") => {
    if (readOnly || !activePage) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= activePage.sections.length) return;

    lastEditTimeRef.current = 0;
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
  };

  // Handler: Update Section Properties (Coalesced continuous edits) [VO-047]
  const handleUpdateSectionProps = (
    sectionId: string,
    updatedProps: Record<string, unknown>,
    variant?: string,
  ) => {
    if (readOnly || !activePage) return;

    const now = Date.now();
    const shouldRecordHistory =
      sectionId !== lastEditedSectionIdRef.current || now - lastEditTimeRef.current > 1200;

    lastEditTimeRef.current = now;
    lastEditedSectionIdRef.current = sectionId;

    setConfiguration(
      (prev) => ({
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
      }),
      shouldRecordHistory,
    );
  };

  // 6. Version History & Rollback Handlers [VO-048]
  const handleInspectVersion = useCallback(
    async (versionSummary: SiteVersionSummary) => {
      try {
        const res = await getSiteVersionByIdAction(initialSite.id, versionSummary.id);
        if (res.success) {
          setInspectedVersion({
            summary: versionSummary,
            configuration: res.data.configuration,
          });
          const hasSlug = res.data.configuration.pages.some(
            (p) => normalizePageSlug(p.slug) === normalizePageSlug(selectedSlug),
          );
          if (!hasSlug && res.data.configuration.pages.length > 0) {
            setSelectedSlug(res.data.configuration.pages[0].slug);
          }
        } else {
          setSaveError(`Failed to load version ${versionSummary.versionNumber}: ${res.error}`);
        }
      } catch {
        setSaveError("Failed to load historical version.");
      }
    },
    [initialSite.id, selectedSlug],
  );

  const handleRestoreToDraft = useCallback(
    async (versionSummary: SiteVersionSummary) => {
      setIsRestoringVersion(true);
      setSaveError(null);
      try {
        const res = await restoreVersionToDraftAction({
          siteId: initialSite.id,
          targetVersionId: versionSummary.id,
          expectedBaseVersionNumber: currentVersionNumberRef.current,
        });

        if (!res.success) {
          throw new Error(res.error || "Failed to restore version to draft");
        }

        resetHistory(res.data.configuration);
        setCurrentVersionNumber(res.data.version.version_number);
        currentVersionNumberRef.current = res.data.version.version_number;
        lastPersistedConfigJsonRef.current = JSON.stringify(res.data.configuration);
        setHasUnsavedChanges(false);
        setSaveStatus("saved");
        setLastSavedAt(new Date());
        setInspectedVersion(null);
        clearDraftRecovery(initialSite.business_id, initialSite.id);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Restore failed";
        setSaveError(msg);
        throw err;
      } finally {
        setIsRestoringVersion(false);
      }
    },
    [initialSite.id, initialSite.business_id, resetHistory],
  );

  const handleRollbackLiveSite = useCallback(
    async (versionSummary: SiteVersionSummary) => {
      setIsRollingBackVersion(true);
      setSaveError(null);
      try {
        const res = await rollbackPublishedVersionAction({
          siteId: initialSite.id,
          targetVersionId: versionSummary.id,
          expectedCurrentPublishedVersionId: currentPublishedVersionId,
        });

        if (!res.success) {
          throw new Error(res.error || "Failed to roll back live website");
        }

        setCurrentPublishedVersionId(res.data.site.published_version_id);
        setInspectedVersion(null);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Rollback failed";
        setSaveError(msg);
        throw err;
      } finally {
        setIsRollingBackVersion(false);
      }
    },
    [initialSite.id, currentPublishedVersionId],
  );

  return (
    <div
      data-testid="constrained-website-editor"
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
        onSave={() => void executeSave(false)}
        isSaving={isSaving}
        isAutosaving={isAutosaving}
        hasUnsavedChanges={hasUnsavedChanges}
        viewMode={viewMode}
        onChangeViewMode={setViewMode}
        deviceMode={deviceMode}
        onChangeDeviceMode={setDeviceMode}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        lastSavedAt={lastSavedAt}
        onRetrySave={() => void executeSave(false)}
        onOpenHistory={() => setIsHistoryModalOpen(true)}
        isInspectingHistory={inspectedVersion !== null}
        inspectedVersionNumber={inspectedVersion?.summary.versionNumber ?? null}
        onExitInspection={() => setInspectedVersion(null)}
      />

      {/* Local Transient Draft Recovery Banner [VO-047] */}
      {recoveryPrompt && (
        <div
          role="region"
          aria-label="Draft Recovery Notification"
          className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-900"
        >
          <div className="flex items-center gap-2">
            <svg
              className="w-4 h-4 text-amber-700 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
              <path d="M3.6 15h16.8L12 3z" />
            </svg>
            <span>
              {recoveryPrompt.isStale ? (
                <>
                  <strong>Stale Local Recovery:</strong> Unsaved local edits from{" "}
                  {new Date(recoveryPrompt.item.savedAt).toLocaleTimeString()} were found, but the
                  server draft has advanced to v{currentVersionNumber}. Restoring may cause
                  conflicts.
                </>
              ) : (
                <>
                  <strong>Unsaved Local Draft Found:</strong> You have unsaved changes from a
                  previous session ({new Date(recoveryPrompt.item.savedAt).toLocaleTimeString()}).
                  Would you like to restore them?
                </>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                resetHistory(recoveryPrompt.item.configuration);
                if (recoveryPrompt.item.changeSummary) {
                  setChangeSummary(recoveryPrompt.item.changeSummary);
                }
                setHasUnsavedChanges(true);
                setSaveStatus("unsaved");
                setRecoveryPrompt(null);
              }}
              aria-label="Restore local draft"
            >
              Restore Draft
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                clearDraftRecovery(initialSite.business_id, initialSite.id);
                setRecoveryPrompt(null);
              }}
              aria-label="Discard local draft"
            >
              Discard
            </Button>
          </div>
        </div>
      )}

      {/* Page Tabs */}
      <PageSelector
        pages={inspectedVersion ? inspectedVersion.configuration.pages : configuration.pages}
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
            {inspectedVersion ? (
              <div
                data-testid="historical-inspection-pane"
                className="p-6 flex flex-col items-center justify-center text-center h-full space-y-4"
              >
                <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center">
                  <svg
                    className="w-6 h-6"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-slate-900 text-base">
                    Historical Snapshot v{inspectedVersion.summary.versionNumber}
                  </h3>
                  <p className="text-xs text-slate-500 max-w-xs">
                    You are inspecting a past snapshot in read-only mode. Changes cannot be made
                    directly to historical records.
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Created {new Date(inspectedVersion.summary.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-col gap-2 w-full max-w-xs pt-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleRestoreToDraft(inspectedVersion.summary)}
                    disabled={isRestoringVersion}
                  >
                    {isRestoringVersion ? "Restoring..." : "Restore as Working Draft"}
                  </Button>
                  {inspectedVersion.summary.publishedAt &&
                    inspectedVersion.summary.id !== currentPublishedVersionId && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRollbackLiveSite(inspectedVersion.summary)}
                        disabled={isRollingBackVersion}
                      >
                        {isRollingBackVersion ? "Rolling back..." : "Rollback Live Website"}
                      </Button>
                    )}
                  <Button variant="secondary" size="sm" onClick={() => setInspectedVersion(null)}>
                    Exit Preview & Return to Draft
                  </Button>
                </div>
              </div>
            ) : selectedSection ? (
              <SectionInspector
                section={selectedSection}
                availableMedia={availableMedia}
                availableModules={availableModules || context?.modules}
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
            {/* Draft Preview Header Banner or Historical Inspection Banner */}
            {inspectedVersion ? (
              <div
                role="region"
                aria-label="Historical Version Inspection Banner"
                className="bg-amber-100 border-b border-amber-300 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-950 font-medium"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="w-2 h-2 rounded-full bg-amber-600" />
                  <span className="font-bold font-mono">
                    Historical Snapshot v{inspectedVersion.summary.versionNumber} (Read-Only)
                  </span>
                  <span className="text-amber-800 text-[11px] hidden sm:inline">
                    — Your active draft is safely preserved.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleRestoreToDraft(inspectedVersion.summary)}
                    disabled={isRestoringVersion}
                    aria-label={`Restore v${inspectedVersion.summary.versionNumber} to working draft`}
                    className="px-2.5 py-1 text-xs font-semibold text-emerald-900 bg-emerald-200/80 hover:bg-emerald-200 border border-emerald-400 rounded-md transition-colors cursor-pointer"
                  >
                    {isRestoringVersion ? "Restoring..." : "Restore as Draft"}
                  </button>
                  {inspectedVersion.summary.publishedAt &&
                    inspectedVersion.summary.id !== currentPublishedVersionId && (
                      <button
                        type="button"
                        onClick={() => handleRollbackLiveSite(inspectedVersion.summary)}
                        disabled={isRollingBackVersion}
                        aria-label={`Roll back live website to v${inspectedVersion.summary.versionNumber}`}
                        className="px-2.5 py-1 text-xs font-semibold text-rose-900 bg-rose-200/80 hover:bg-rose-200 border border-rose-400 rounded-md transition-colors cursor-pointer"
                      >
                        {isRollingBackVersion ? "Rolling back..." : "Rollback Live"}
                      </button>
                    )}
                  <button
                    type="button"
                    onClick={() => setInspectedVersion(null)}
                    aria-label="Exit historical inspection preview"
                    className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-md transition-colors cursor-pointer"
                  >
                    Exit Preview
                  </button>
                </div>
              </div>
            ) : (
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
            )}

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
                  configuration={inspectedVersion ? inspectedVersion.configuration : configuration}
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

      {/* Version History & Rollback Modal [VO-048] */}
      <VersionHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        siteId={initialSite.id}
        siteSubdomain={initialSite.subdomain}
        currentDraftVersionId={initialSite.current_draft_version_id}
        currentPublishedVersionId={currentPublishedVersionId}
        currentVersionNumber={currentVersionNumber}
        onInspectVersion={handleInspectVersion}
        onRestoreToDraft={handleRestoreToDraft}
        onRollbackLiveSite={handleRollbackLiveSite}
        isRestoring={isRestoringVersion}
        isRollingBack={isRollingBackVersion}
      />
    </div>
  );
}
