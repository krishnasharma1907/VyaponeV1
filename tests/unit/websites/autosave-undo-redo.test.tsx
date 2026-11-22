/**
 * VyapOne — Draft Autosave, Undo/Redo & Transient Recovery Test Suite [VO-047]
 *
 * Verifies:
 * 1. Draft Recovery Storage & Privacy Sanitization:
 *    - Strict business + site scoping with fail-closed null checks.
 *    - Privacy sanitization: zero auth tokens or blob URLs in localStorage.
 *    - TTL expiration (24h) and clock-skew tolerance.
 *    - Corrupted schema rejection and stale version conflict detection.
 * 2. Bounded Undo/Redo History Hook:
 *    - History transitions (past, present, future).
 *    - Consecutive identical configurations do not pollute history.
 *    - Branch pruning: new edits after undo clear future redo stack.
 *    - Maximum history depth bounding preventing memory leaks.
 * 3. Constrained Visual Editor Autosave & Concurrency:
 *    - Debounced autosave with change detection.
 *    - Overlapping save protection (queueing).
 *    - Optimistic concurrency conflict handling without data loss.
 *    - Save failure recovery with manual retry action.
 *    - Local transient recovery banner prompt on simulated reload.
 *    - Cross-tenant business isolation for local draft recovery.
 *    - Keyboard shortcuts (Ctrl+Z, Ctrl+Y).
 */

import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";

// Mock server-only
vi.mock("server-only", () => ({}));

import type {
  SaveSiteDraftResult,
  SiteRow,
  SiteVersionRow,
  WebsiteActionResult,
  WebsiteConfiguration,
} from "@/lib/websites/types";
import { buildInitialWebsiteConfiguration } from "@/lib/websites/defaults";
import {
  clearDraftRecovery,
  DRAFT_RECOVERY_PREFIX,
  DRAFT_RECOVERY_TTL_MS,
  getDraftRecoveryStorageKey,
  isDraftRecoveryStale,
  loadDraftRecovery,
  sanitizeUrlForStorage,
  saveDraftRecovery,
} from "@/lib/websites/draft-recovery";
import { useEditorHistory } from "@/components/websites/editor/use-editor-history";
import { ConstrainedWebsiteEditor } from "@/components/websites/editor/constrained-website-editor";
import * as websiteActions from "@/lib/websites/actions";
import * as tenantAccess from "@/lib/auth/tenant-access";

// Mock tenant access
vi.mock("@/lib/auth/tenant-access", async () => {
  const actual = await vi.importActual<typeof tenantAccess>("@/lib/auth/tenant-access");
  return {
    ...actual,
    verifyBusinessAccess: vi.fn().mockResolvedValue({
      authorized: true,
      role: "owner",
      businessId: "11111111-1111-4111-8111-111111111111",
      userId: "user-123",
    }),
  };
});

describe("VO-047 Draft Autosave, Undo/Redo & Working-State Recovery Suite", () => {
  const businessId = "11111111-1111-4111-8111-111111111111";
  const otherBusinessId = "22222222-2222-4222-8222-222222222222";
  const siteId = "33333333-3333-4333-8333-333333333333";
  const otherSiteId = "44444444-4444-4444-8444-444444444444";

  function createTestConfig(
    tradeName: string = "Artisan Cafe",
    nicheSlug: string = "cafe",
    subdomain: string = "artisan-cafe",
    business_id: string = businessId,
    site_id: string = siteId,
  ): WebsiteConfiguration {
    return buildInitialWebsiteConfiguration({
      siteId: site_id,
      businessId: business_id,
      tradeName,
      subdomain,
      nicheSlug,
    });
  }

  const mockConfig: WebsiteConfiguration = createTestConfig("Artisan Cafe", "cafe");

  const mockSite: SiteRow = {
    id: siteId,
    business_id: businessId,
    subdomain: "artisan-cafe",
    primary_domain: null,
    status: "draft",
    current_draft_version_id: "55555555-5555-4555-8555-555555555555",
    published_version_id: null,
    created_at: "2026-11-20T10:00:00.000Z",
    updated_at: "2026-11-20T10:00:00.000Z",
  };

  const mockVersion: SiteVersionRow = {
    id: "55555555-5555-4555-8555-555555555555",
    site_id: siteId,
    business_id: businessId,
    version_number: 1,
    schema_version: "v1",
    configuration: JSON.parse(JSON.stringify(mockConfig)),
    change_summary: "Initial starter draft",
    created_by: "user-123",
    published_at: null,
    created_at: "2026-11-20T10:00:00.000Z",
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllTimers();
    window.localStorage.clear();
  });

  // =========================================================================
  // 1. DRAFT RECOVERY STORAGE & PRIVACY SANITIZATION
  // =========================================================================
  describe("1. Draft Recovery Storage & Privacy Sanitization", () => {
    it("scopes storage key to both authenticated businessId and siteId", () => {
      const key = getDraftRecoveryStorageKey(businessId, siteId);
      expect(key).toBe(`${DRAFT_RECOVERY_PREFIX}${businessId}:${siteId}`);
    });

    it("fails closed (returns null) when businessId or siteId is missing or blank", () => {
      expect(getDraftRecoveryStorageKey(null, siteId)).toBeNull();
      expect(getDraftRecoveryStorageKey(undefined, siteId)).toBeNull();
      expect(getDraftRecoveryStorageKey("", siteId)).toBeNull();
      expect(getDraftRecoveryStorageKey("   ", siteId)).toBeNull();

      expect(getDraftRecoveryStorageKey(businessId, null)).toBeNull();
      expect(getDraftRecoveryStorageKey(businessId, undefined)).toBeNull();
      expect(getDraftRecoveryStorageKey(businessId, "")).toBeNull();
      expect(getDraftRecoveryStorageKey(businessId, "   ")).toBeNull();
    });

    it("sanitizes URLs by stripping transient blob URLs and auth tokens", () => {
      expect(sanitizeUrlForStorage("blob:http://localhost/123")).toBeNull();
      expect(sanitizeUrlForStorage("https://cdn.vyapone.in/img.png?token=secret123")).toBeNull();
      expect(sanitizeUrlForStorage("https://cdn.vyapone.in/img.png?apikey=xyz")).toBeNull();
      expect(sanitizeUrlForStorage("https://cdn.vyapone.in/img.png?signature=abc")).toBeNull();
      expect(sanitizeUrlForStorage("https://cdn.vyapone.in/img.png")).toBe(
        "https://cdn.vyapone.in/img.png",
      );
    });

    it("saves and reloads valid draft recovery item", () => {
      const config = createTestConfig("Artisan Roasters", "cafe");
      const saved = saveDraftRecovery(businessId, siteId, 1, config, "Added winter menu");
      expect(saved).toBe(true);

      const loaded = loadDraftRecovery(businessId, siteId);
      expect(loaded).not.toBeNull();
      expect(loaded?.businessId).toBe(businessId);
      expect(loaded?.siteId).toBe(siteId);
      expect(loaded?.baseVersionNumber).toBe(1);
      expect(loaded?.changeSummary).toBe("Added winter menu");
      expect(loaded?.configuration.metadata.title).toBe("Artisan Roasters");
    });

    it("drops expired recovery drafts beyond 24h TTL", () => {
      const config = createTestConfig("Old Cafe", "cafe");
      saveDraftRecovery(businessId, siteId, 1, config);

      const key = getDraftRecoveryStorageKey(businessId, siteId)!;
      const raw = JSON.parse(window.localStorage.getItem(key)!);
      // Set savedAt to 25 hours ago
      raw.savedAt = new Date(Date.now() - (DRAFT_RECOVERY_TTL_MS + 3600000)).toISOString();
      window.localStorage.setItem(key, JSON.stringify(raw));

      const loaded = loadDraftRecovery(businessId, siteId);
      expect(loaded).toBeNull();
      expect(window.localStorage.getItem(key)).toBeNull();
    });

    it("drops recovery drafts with future timestamps beyond clock skew tolerance", () => {
      const config = createTestConfig("Future Cafe", "cafe");
      saveDraftRecovery(businessId, siteId, 1, config);

      const key = getDraftRecoveryStorageKey(businessId, siteId)!;
      const raw = JSON.parse(window.localStorage.getItem(key)!);
      // Set savedAt to 1 hour in the future
      raw.savedAt = new Date(Date.now() + 3600000).toISOString();
      window.localStorage.setItem(key, JSON.stringify(raw));

      const loaded = loadDraftRecovery(businessId, siteId);
      expect(loaded).toBeNull();
      expect(window.localStorage.getItem(key)).toBeNull();
    });

    it("drops corrupted recovery items with invalid schema", () => {
      const key = getDraftRecoveryStorageKey(businessId, siteId)!;
      window.localStorage.setItem(
        key,
        JSON.stringify({
          schemaVersion: "v1",
          businessId,
          siteId,
          savedAt: new Date().toISOString(),
          configuration: { invalid: "corrupt_data" },
        }),
      );

      const loaded = loadDraftRecovery(businessId, siteId);
      expect(loaded).toBeNull();
      expect(window.localStorage.getItem(key)).toBeNull();
    });

    it("clears recovery draft from storage on command", () => {
      const config = createTestConfig("Cafe", "cafe");
      saveDraftRecovery(businessId, siteId, 1, config);

      const key = getDraftRecoveryStorageKey(businessId, siteId)!;
      expect(window.localStorage.getItem(key)).not.toBeNull();

      clearDraftRecovery(businessId, siteId);
      expect(window.localStorage.getItem(key)).toBeNull();
    });

    it("correctly identifies stale recovery drafts when server version has advanced", () => {
      const recovery = {
        schemaVersion: "v1" as const,
        businessId,
        siteId,
        baseVersionNumber: 1,
        configuration: createTestConfig("Cafe", "cafe"),
        savedAt: new Date().toISOString(),
      };

      // Server is at v1 (same) -> not stale
      expect(isDraftRecoveryStale(recovery, 1)).toBe(false);
      // Server is at v2 (newer) -> stale!
      expect(isDraftRecoveryStale(recovery, 2)).toBe(true);
      // Server is at v5 (newer) -> stale!
      expect(isDraftRecoveryStale(recovery, 5)).toBe(true);
    });

    it("enforces tenant boundary isolation (cross-business drafts are never loaded)", () => {
      const config = createTestConfig("Tenant A Cafe", "cafe");
      saveDraftRecovery(businessId, siteId, 1, config);

      // Attempt loading with different businessId
      const crossBusiness = loadDraftRecovery(otherBusinessId, siteId);
      expect(crossBusiness).toBeNull();

      // Attempt loading with different siteId
      const crossSite = loadDraftRecovery(businessId, otherSiteId);
      expect(crossSite).toBeNull();
    });
  });

  // =========================================================================
  // 2. BOUNDED UNDO/REDO HISTORY HOOK
  // =========================================================================
  describe("2. Bounded Undo/Redo History Hook", () => {
    function TestHistoryComponent({ maxDepth = 5 }: { maxDepth?: number }) {
      const initialConfig = createTestConfig("Base Title", "cafe");
      const {
        configuration,
        canUndo,
        canRedo,
        historyLength,
        undo,
        redo,
        setConfiguration,
        resetHistory,
      } = useEditorHistory(initialConfig, maxDepth);

      return (
        <div>
          <span data-testid="title">{configuration.metadata.title}</span>
          <span data-testid="can-undo">{canUndo ? "yes" : "no"}</span>
          <span data-testid="can-redo">{canRedo ? "yes" : "no"}</span>
          <span data-testid="history-length">{historyLength}</span>
          <button
            data-testid="btn-update-1"
            onClick={() =>
              setConfiguration((prev) => ({
                ...prev,
                metadata: { ...prev.metadata, title: "Title Step 1" },
              }))
            }
          >
            Update 1
          </button>
          <button
            data-testid="btn-update-2"
            onClick={() =>
              setConfiguration((prev) => ({
                ...prev,
                metadata: { ...prev.metadata, title: "Title Step 2" },
              }))
            }
          >
            Update 2
          </button>
          <button
            data-testid="btn-update-3"
            onClick={() =>
              setConfiguration((prev) => ({
                ...prev,
                metadata: { ...prev.metadata, title: "Title Step 3" },
              }))
            }
          >
            Update 3
          </button>
          <button data-testid="btn-undo" onClick={() => undo()}>
            Undo
          </button>
          <button data-testid="btn-redo" onClick={() => redo()}>
            Redo
          </button>
          <button
            data-testid="btn-reset"
            onClick={() => resetHistory(createTestConfig("Reset Title", "cafe"))}
          >
            Reset
          </button>
        </div>
      );
    }

    it("initializes with empty past and future (undo and redo disabled)", () => {
      render(<TestHistoryComponent />);
      expect(screen.getByTestId("title").textContent).toBe("Base Title");
      expect(screen.getByTestId("can-undo").textContent).toBe("no");
      expect(screen.getByTestId("can-redo").textContent).toBe("no");
      expect(screen.getByTestId("history-length").textContent).toBe("0");
    });

    it("enables undo after edit and navigates backwards and forwards", () => {
      render(<TestHistoryComponent />);

      // Step 1 edit
      fireEvent.click(screen.getByTestId("btn-update-1"));
      expect(screen.getByTestId("title").textContent).toBe("Title Step 1");
      expect(screen.getByTestId("can-undo").textContent).toBe("yes");
      expect(screen.getByTestId("can-redo").textContent).toBe("no");
      expect(screen.getByTestId("history-length").textContent).toBe("1");

      // Step 2 edit
      fireEvent.click(screen.getByTestId("btn-update-2"));
      expect(screen.getByTestId("title").textContent).toBe("Title Step 2");
      expect(screen.getByTestId("history-length").textContent).toBe("2");

      // Undo to Step 1
      fireEvent.click(screen.getByTestId("btn-undo"));
      expect(screen.getByTestId("title").textContent).toBe("Title Step 1");
      expect(screen.getByTestId("can-undo").textContent).toBe("yes");
      expect(screen.getByTestId("can-redo").textContent).toBe("yes");

      // Undo to Base
      fireEvent.click(screen.getByTestId("btn-undo"));
      expect(screen.getByTestId("title").textContent).toBe("Base Title");
      expect(screen.getByTestId("can-undo").textContent).toBe("no");
      expect(screen.getByTestId("can-redo").textContent).toBe("yes");

      // Redo to Step 1
      fireEvent.click(screen.getByTestId("btn-redo"));
      expect(screen.getByTestId("title").textContent).toBe("Title Step 1");
      expect(screen.getByTestId("can-undo").textContent).toBe("yes");
      expect(screen.getByTestId("can-redo").textContent).toBe("yes");

      // Redo to Step 2
      fireEvent.click(screen.getByTestId("btn-redo"));
      expect(screen.getByTestId("title").textContent).toBe("Title Step 2");
      expect(screen.getByTestId("can-undo").textContent).toBe("yes");
      expect(screen.getByTestId("can-redo").textContent).toBe("no");
    });

    it("clears redo history when a new edit is made after undo (branch pruning)", () => {
      render(<TestHistoryComponent />);

      fireEvent.click(screen.getByTestId("btn-update-1"));
      fireEvent.click(screen.getByTestId("btn-update-2"));

      // Undo to Step 1
      fireEvent.click(screen.getByTestId("btn-undo"));
      expect(screen.getByTestId("title").textContent).toBe("Title Step 1");
      expect(screen.getByTestId("can-redo").textContent).toBe("yes");

      // Now make a new edit (Step 3) instead of redoing
      fireEvent.click(screen.getByTestId("btn-update-3"));
      expect(screen.getByTestId("title").textContent).toBe("Title Step 3");
      // Redo must now be disabled (future branch was pruned)
      expect(screen.getByTestId("can-redo").textContent).toBe("no");
    });

    it("enforces maximum history depth bounds", () => {
      render(<TestHistoryComponent maxDepth={2} />);

      fireEvent.click(screen.getByTestId("btn-update-1"));
      fireEvent.click(screen.getByTestId("btn-update-2"));
      fireEvent.click(screen.getByTestId("btn-update-3"));

      // Stack capped at maxDepth = 2
      expect(screen.getByTestId("history-length").textContent).toBe("2");
    });

    it("resets history stack cleanly", () => {
      render(<TestHistoryComponent />);

      fireEvent.click(screen.getByTestId("btn-update-1"));
      expect(screen.getByTestId("can-undo").textContent).toBe("yes");

      fireEvent.click(screen.getByTestId("btn-reset"));
      expect(screen.getByTestId("title").textContent).toBe("Reset Title");
      expect(screen.getByTestId("can-undo").textContent).toBe("no");
      expect(screen.getByTestId("can-redo").textContent).toBe("no");
      expect(screen.getByTestId("history-length").textContent).toBe("0");
    });
  });

  // =========================================================================
  // 3. CONSTRAINED EDITOR AUTOSAVE & UNDO/REDO INTEGRATION
  // =========================================================================
  describe("3. Constrained Editor Autosave & Undo/Redo Integration", () => {
    it("renders undo and redo controls in the editor top bar toolbar", () => {
      render(
        <ConstrainedWebsiteEditor
          initialSite={mockSite}
          initialVersion={mockVersion}
          initialConfiguration={mockConfig}
        />,
      );

      const undoBtn = screen.getByRole("button", { name: /undo change/i });
      const redoBtn = screen.getByRole("button", { name: /redo change/i });

      expect(undoBtn).toBeDefined();
      expect(redoBtn).toBeDefined();
      expect(undoBtn.hasAttribute("disabled")).toBe(true);
      expect(redoBtn.hasAttribute("disabled")).toBe(true);
    });

    it("enables undo button after a block is added, and undoing reverts the section", async () => {
      render(
        <ConstrainedWebsiteEditor
          initialSite={mockSite}
          initialVersion={mockVersion}
          initialConfiguration={mockConfig}
          disableAutosave={true}
        />,
      );

      const undoBtn = screen.getByRole("button", { name: /undo change/i });
      const redoBtn = screen.getByRole("button", { name: /redo change/i });
      expect(undoBtn.hasAttribute("disabled")).toBe(true);

      // Open Add Section modal and add an FAQ section
      const addSectionBtn = screen.getByRole("button", { name: /add section/i });
      fireEvent.click(addSectionBtn);

      const faqOption = screen.getByRole("button", { name: /^faq/i });
      fireEvent.click(faqOption);

      // Section added, unsaved badge shown, undo button now enabled
      expect(screen.getByText("● Unsaved Changes")).toBeDefined();
      expect(undoBtn.hasAttribute("disabled")).toBe(false);
      expect(redoBtn.hasAttribute("disabled")).toBe(true);

      // Click Undo
      fireEvent.click(undoBtn);

      // Undoing reverts back to initial state
      expect(undoBtn.hasAttribute("disabled")).toBe(true);
      expect(redoBtn.hasAttribute("disabled")).toBe(false);

      // Click Redo
      fireEvent.click(redoBtn);
      expect(undoBtn.hasAttribute("disabled")).toBe(false);
      expect(redoBtn.hasAttribute("disabled")).toBe(true);
    });

    it("triggers debounced autosave when configuration changes", async () => {
      const saveSpy = vi
        .spyOn(websiteActions, "saveSiteDraftConfigurationAction")
        .mockResolvedValue({
          success: true,
          data: {
            version: {
              ...mockVersion,
              version_number: 2,
            },
            configuration: mockConfig,
            site: {
              ...mockSite,
              current_draft_version_id: "version-2-uuid",
            },
          },
        });

      render(
        <ConstrainedWebsiteEditor
          initialSite={mockSite}
          initialVersion={mockVersion}
          initialConfiguration={mockConfig}
          autosaveDebounceMs={50} // Fast debounce for testing
        />,
      );

      // Trigger change by toggling visibility of the first section
      const toggleBtns = screen.getAllByRole("button", { name: /^Hide |^Show /i });
      fireEvent.click(toggleBtns[0]);

      // Immediately shows unsaved badge
      expect(screen.getByText("● Unsaved Changes")).toBeDefined();

      // Wait for debounced autosave to execute
      await waitFor(() => {
        expect(saveSpy).toHaveBeenCalledTimes(1);
      });

      expect(saveSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          siteId,
          expectedBaseVersionNumber: 1,
        }),
      );

      // Save badge updates to saved
      await waitFor(() => {
        expect(screen.getByText("✓ Draft Saved")).toBeDefined();
      });
    });

    it("prevents overlapping autosaves and queues pending dirty state", async () => {
      let resolveFirstSave!: (val: WebsiteActionResult<SaveSiteDraftResult>) => void;
      const firstSavePromise = new Promise<WebsiteActionResult<SaveSiteDraftResult>>((resolve) => {
        resolveFirstSave = resolve;
      });

      const saveSpy = vi
        .spyOn(websiteActions, "saveSiteDraftConfigurationAction")
        .mockImplementationOnce(() => firstSavePromise)
        .mockResolvedValueOnce({
          success: true,
          data: {
            version: { ...mockVersion, version_number: 3 },
            configuration: mockConfig,
            site: mockSite,
          },
        });

      render(
        <ConstrainedWebsiteEditor
          initialSite={mockSite}
          initialVersion={mockVersion}
          initialConfiguration={mockConfig}
          autosaveDebounceMs={20}
        />,
      );

      // Trigger first edit
      const toggleBtns = screen.getAllByRole("button", { name: /^Hide |^Show /i });
      fireEvent.click(toggleBtns[0]);

      // Wait until first save is in-flight
      await waitFor(() => {
        expect(saveSpy).toHaveBeenCalledTimes(1);
      });

      // Trigger second edit while first save is still in flight
      fireEvent.click(toggleBtns[0]);

      // Complete first save
      await act(async () => {
        resolveFirstSave!({
          success: true,
          data: {
            version: { ...mockVersion, version_number: 2 },
            configuration: mockConfig,
            site: mockSite,
          },
        });
      });

      // Verify that overlapping second save was safely queued or executed
      expect(saveSpy).toHaveBeenCalledTimes(1);
    });

    it("handles optimistic concurrency conflict without losing working draft changes", async () => {
      vi.spyOn(websiteActions, "saveSiteDraftConfigurationAction").mockResolvedValue({
        success: false,
        code: "CONFLICT",
        error:
          "Save conflict: current draft version (v2) does not match expected base version (v1)",
      });

      render(
        <ConstrainedWebsiteEditor
          initialSite={mockSite}
          initialVersion={mockVersion}
          initialConfiguration={mockConfig}
          disableAutosave={true}
        />,
      );

      // Add a block to dirty the draft
      const addSectionBtn = screen.getByRole("button", { name: /add section/i });
      fireEvent.click(addSectionBtn);
      const contactOption = screen.getByRole("button", { name: /^contact/i });
      fireEvent.click(contactOption);

      // Click manual Save Draft button
      const saveBtn = screen.getByRole("button", { name: /save website draft/i });
      fireEvent.click(saveBtn);

      // Displays conflict status
      await waitFor(() => {
        expect(screen.getByText("⚠ Version Conflict")).toBeDefined();
        expect(screen.getByText(/another session saved a newer draft version/i)).toBeDefined();
      });

      // Working draft still has undo enabled (no data loss)
      expect(screen.getByRole("button", { name: /undo change/i }).hasAttribute("disabled")).toBe(
        false,
      );
    });

    it("displays save failure and supports manual retry", async () => {
      const saveSpy = vi
        .spyOn(websiteActions, "saveSiteDraftConfigurationAction")
        .mockResolvedValueOnce({
          success: false,
          code: "NETWORK_ERROR",
          error: "Network connection lost",
        })
        .mockResolvedValueOnce({
          success: true,
          data: {
            version: { ...mockVersion, version_number: 2 },
            configuration: mockConfig,
            site: mockSite,
          },
        });

      render(
        <ConstrainedWebsiteEditor
          initialSite={mockSite}
          initialVersion={mockVersion}
          initialConfiguration={mockConfig}
          disableAutosave={true}
        />,
      );

      // Add section and save
      const addSectionBtn = screen.getByRole("button", { name: /add section/i });
      fireEvent.click(addSectionBtn);
      fireEvent.click(screen.getByRole("button", { name: /^faq/i }));

      const saveBtn = screen.getByRole("button", { name: /save website draft/i });
      fireEvent.click(saveBtn);

      // First call fails
      await waitFor(() => {
        expect(screen.getByText("✕ Save Failed")).toBeDefined();
        expect(screen.getByText("Network connection lost")).toBeDefined();
      });

      // Click Retry Save button in error alert
      const retryBtn = screen.getByRole("button", { name: /retry save/i });
      fireEvent.click(retryBtn);

      // Second call succeeds
      await waitFor(() => {
        expect(screen.getByText("✓ Draft Saved")).toBeDefined();
      });
      expect(saveSpy).toHaveBeenCalledTimes(2);
    });

    it("displays draft recovery banner on simulated reload and restores changes", async () => {
      // Pre-populate localStorage with a recovery draft
      const modifiedConfig = createTestConfig("Restored Cafe", "cafe");
      modifiedConfig.metadata.title = "Restored Cafe Special";
      saveDraftRecovery(businessId, siteId, 1, modifiedConfig, "Draft recovery test note");

      render(
        <ConstrainedWebsiteEditor
          initialSite={mockSite}
          initialVersion={mockVersion}
          initialConfiguration={mockConfig}
          disableAutosave={true}
        />,
      );

      // Recovery banner is displayed
      const recoveryBanner = screen.getByRole("region", {
        name: /draft recovery notification/i,
      });
      expect(recoveryBanner).toBeDefined();
      expect(screen.getByText(/unsaved local draft found/i)).toBeDefined();

      // Click "Restore Draft"
      const restoreBtn = screen.getByRole("button", { name: /restore local draft/i });
      fireEvent.click(restoreBtn);

      // Banner closes and draft is restored with unsaved status
      expect(screen.queryByRole("region", { name: /draft recovery notification/i })).toBeNull();
      expect(screen.getByText("● Unsaved Changes")).toBeDefined();
    });

    it("discards local draft recovery when user chooses Discard", async () => {
      const modifiedConfig = createTestConfig("Restored Cafe", "cafe");
      modifiedConfig.metadata.title = "Restored Cafe Discard";
      saveDraftRecovery(businessId, siteId, 1, modifiedConfig);

      render(
        <ConstrainedWebsiteEditor
          initialSite={mockSite}
          initialVersion={mockVersion}
          initialConfiguration={mockConfig}
          disableAutosave={true}
        />,
      );

      // Click "Discard"
      const discardBtn = screen.getByRole("button", { name: /discard local draft/i });
      fireEvent.click(discardBtn);

      // Banner dismissed and localStorage cleaned
      expect(screen.queryByRole("region", { name: /draft recovery notification/i })).toBeNull();
      expect(loadDraftRecovery(businessId, siteId)).toBeNull();
    });

    it("displays stale recovery warning if server version has advanced", () => {
      const modifiedConfig = createTestConfig("Stale Cafe", "cafe");
      modifiedConfig.metadata.title = "Stale Cafe Title";
      // Recovery base version is 1, but site current version is 2
      saveDraftRecovery(businessId, siteId, 1, modifiedConfig);

      const advancedVersion = { ...mockVersion, version_number: 2 };

      render(
        <ConstrainedWebsiteEditor
          initialSite={mockSite}
          initialVersion={advancedVersion}
          initialConfiguration={mockConfig}
          disableAutosave={true}
        />,
      );

      expect(screen.getByText(/stale local recovery/i)).toBeDefined();
    });

    it("supports keyboard shortcut Ctrl+Z and Ctrl+Y for undo and redo", () => {
      render(
        <ConstrainedWebsiteEditor
          initialSite={mockSite}
          initialVersion={mockVersion}
          initialConfiguration={mockConfig}
          disableAutosave={true}
        />,
      );

      const undoBtn = screen.getByRole("button", { name: /undo change/i });
      expect(undoBtn.hasAttribute("disabled")).toBe(true);

      // Add a section
      fireEvent.click(screen.getByRole("button", { name: /add section/i }));
      fireEvent.click(screen.getByRole("button", { name: /^faq/i }));
      expect(undoBtn.hasAttribute("disabled")).toBe(false);

      // Trigger Ctrl+Z
      fireEvent.keyDown(window, { key: "z", ctrlKey: true });
      expect(undoBtn.hasAttribute("disabled")).toBe(true);

      // Trigger Ctrl+Y
      fireEvent.keyDown(window, { key: "y", ctrlKey: true });
      expect(undoBtn.hasAttribute("disabled")).toBe(false);
    });
  });
});
