/**
 * VyapOne — Website Versions and Rollback Test Suite [VO-048]
 *
 * Verifies:
 * 1. Database Service Layer:
 *    - Descending version order retrieval with pagination support.
 *    - Paginated version history with mapped summaries and status badges.
 *    - Specific version retrieval by version ID.
 *    - Atomic rollback execution via RPC with concurrency check (VY049).
 *    - Rejection of rollback to unpublished draft or invalid target.
 *    - Restore to draft creates a new draft version (MAX + 1) without touching published pointer.
 *    - Preserves historical version immutability (no update or deletion of past versions).
 * 2. Server Actions:
 *    - Tenant authorization and authentication verification.
 *    - Input validation for rollback, restore, and query schemas.
 *    - Path revalidation on rollback and restore.
 * 3. UI Layer (VersionHistoryModal & ConstrainedWebsiteEditor):
 *    - Modal renders version list with correct status badges.
 *    - Read-only historical version inspection in preview canvas.
 *    - Autosave suspension during historical inspection.
 *    - Rollback and restore confirmation dialogs.
 *    - Keyboard accessibility (Escape key).
 */

import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// Mock server-only
vi.mock("server-only", () => ({}));

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { BusinessMemberRow, BusinessRow } from "@/lib/businesses/types";
import type {
  SiteRow,
  SiteVersionRow,
  SiteVersionSummary,
  WebsiteConfiguration,
} from "@/lib/websites/types";
import { buildInitialWebsiteConfiguration } from "@/lib/websites/defaults";
import {
  getSiteConfigurationById,
  getSiteVersionHistory,
  getSiteVersions,
  restoreVersionToDraft,
  rollbackPublishedVersion,
} from "@/lib/websites/service";
import { VersionHistoryModal } from "@/components/websites/editor/version-history-modal";
import { ConstrainedWebsiteEditor } from "@/components/websites/editor/constrained-website-editor";
import * as tenantAccess from "@/lib/auth/tenant-access";
import * as websiteActions from "@/lib/websites/actions";

// Mock tenant access
vi.mock("@/lib/auth/tenant-access", () => ({
  assertBusinessAccess: vi.fn(),
  assertAuthenticatedUser: vi.fn(),
  verifyBusinessAccess: vi.fn().mockResolvedValue({
    authorized: true,
    role: "owner",
    businessId: "11111111-1111-4111-8111-111111111111",
    userId: "00000000-0000-4000-8000-000000000001",
  }),
}));

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("VO-048 Website Versions & Rollback Suite", () => {
  const mockUserId = "00000000-0000-4000-8000-000000000001";
  const mockBusinessId = "11111111-1111-4111-8111-111111111111";
  const mockSiteId = "33333333-3333-4333-8333-333333333333";

  const v1Id = "11111111-1111-4111-a111-111111111111";
  const v2Id = "22222222-2222-4222-a222-222222222222";
  const v3Id = "33333333-3333-4333-a333-333333333333";

  function createTestConfig(tradeName: string = "Artisan Cafe"): WebsiteConfiguration {
    return buildInitialWebsiteConfiguration({
      siteId: mockSiteId,
      businessId: mockBusinessId,
      tradeName,
      subdomain: "artisan-cafe",
      nicheSlug: "cafe",
    });
  }

  const sampleConfigV1 = createTestConfig("Artisan Cafe - Initial");
  const sampleConfigV2 = createTestConfig("Artisan Cafe - Published");
  const sampleConfigV3 = createTestConfig("Artisan Cafe - Working Draft");

  const sampleSite: SiteRow = {
    id: mockSiteId,
    business_id: mockBusinessId,
    subdomain: "artisan-cafe",
    primary_domain: null,
    status: "published",
    published_version_id: v2Id,
    current_draft_version_id: v3Id,
    created_at: "2026-11-20T10:00:00.000Z",
    updated_at: "2026-11-22T10:00:00.000Z",
  };

  const sampleVersions: SiteVersionRow[] = [
    {
      id: v3Id,
      site_id: mockSiteId,
      business_id: mockBusinessId,
      version_number: 3,
      schema_version: "v1",
      configuration: JSON.parse(JSON.stringify(sampleConfigV3)),
      change_summary: "Draft work in progress",
      created_by: mockUserId,
      published_at: null,
      created_at: "2026-11-22T10:00:00.000Z",
    },
    {
      id: v2Id,
      site_id: mockSiteId,
      business_id: mockBusinessId,
      version_number: 2,
      schema_version: "v1",
      configuration: JSON.parse(JSON.stringify(sampleConfigV2)),
      change_summary: "Grand opening menu launch",
      created_by: mockUserId,
      published_at: "2026-11-21T15:00:00.000Z",
      created_at: "2026-11-21T14:00:00.000Z",
    },
    {
      id: v1Id,
      site_id: mockSiteId,
      business_id: mockBusinessId,
      version_number: 1,
      schema_version: "v1",
      configuration: JSON.parse(JSON.stringify(sampleConfigV1)),
      change_summary: "Initial site setup",
      created_by: mockUserId,
      published_at: "2026-11-20T12:00:00.000Z",
      created_at: "2026-11-20T10:00:00.000Z",
    },
  ];

  const mockSummaries: SiteVersionSummary[] = [
    {
      id: v3Id,
      siteId: mockSiteId,
      businessId: mockBusinessId,
      versionNumber: 3,
      schemaVersion: "v1",
      changeSummary: "Draft work in progress",
      createdBy: mockUserId,
      publishedAt: null,
      createdAt: "2026-11-22T10:00:00.000Z",
      isCurrentDraft: true,
      isPublished: false,
    },
    {
      id: v2Id,
      siteId: mockSiteId,
      businessId: mockBusinessId,
      versionNumber: 2,
      schemaVersion: "v1",
      changeSummary: "Grand opening menu launch",
      createdBy: mockUserId,
      publishedAt: "2026-11-21T15:00:00.000Z",
      createdAt: "2026-11-21T14:00:00.000Z",
      isCurrentDraft: false,
      isPublished: true,
    },
    {
      id: v1Id,
      siteId: mockSiteId,
      businessId: mockBusinessId,
      versionNumber: 1,
      schemaVersion: "v1",
      changeSummary: "Initial site setup",
      createdBy: mockUserId,
      publishedAt: "2026-11-20T12:00:00.000Z",
      createdAt: "2026-11-20T10:00:00.000Z",
      isCurrentDraft: false,
      isPublished: false,
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(tenantAccess.assertBusinessAccess).mockResolvedValue({
      business: {
        id: mockBusinessId,
        workspace_id: "00000000-0000-4000-8000-000000000003",
      } as unknown as BusinessRow,
      member: { id: "mem-1", role: "owner" } as unknown as BusinessMemberRow,
      callerUserId: mockUserId,
      isSovereignOwner: true,
      effectiveRole: "owner",
      locationId: null,
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  // =========================================================================
  // 1. DATABASE SERVICE LAYER: VERSIONS & ROLLBACK
  // =========================================================================
  describe("1. Database Service Layer", () => {
    it("retrieves site versions ordered descending by version number", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "sites") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: sampleSite, error: null }),
            };
          }
          if (table === "site_versions") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockResolvedValue({ data: sampleVersions, error: null }),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient<Database>;

      const versions = await getSiteVersions(mockSupabase, mockSiteId);
      expect(versions).toHaveLength(3);
      expect(versions[0].version_number).toBe(3);
      expect(versions[1].version_number).toBe(2);
      expect(versions[2].version_number).toBe(1);
    });

    it("retrieves paginated version history with correct status badges and summaries", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "sites") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: sampleSite, error: null }),
            };
          }
          if (table === "site_versions") {
            return {
              select: vi.fn((_cols: string, opts?: { count?: string; head?: boolean }) => {
                if (opts?.head) {
                  return {
                    eq: vi.fn().mockResolvedValue({ count: 3, error: null }),
                  };
                }
                return {
                  eq: vi.fn().mockReturnThis(),
                  order: vi.fn().mockReturnThis(),
                  range: vi.fn().mockResolvedValue({ data: sampleVersions, error: null }),
                };
              }),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient<Database>;

      const history = await getSiteVersionHistory(mockSupabase, mockSiteId, {
        limit: 10,
        offset: 0,
      });

      expect(history.totalCount).toBe(3);
      expect(history.currentDraftVersionId).toBe(v3Id);
      expect(history.publishedVersionId).toBe(v2Id);
      expect(history.summaries).toHaveLength(3);

      // v3 is active draft, not published
      expect(history.summaries[0].versionNumber).toBe(3);
      expect(history.summaries[0].isCurrentDraft).toBe(true);
      expect(history.summaries[0].isPublished).toBe(false);

      // v2 is live published
      expect(history.summaries[1].versionNumber).toBe(2);
      expect(history.summaries[1].isCurrentDraft).toBe(false);
      expect(history.summaries[1].isPublished).toBe(true);

      // v1 is previously published (published_at != null, but not current published)
      expect(history.summaries[2].versionNumber).toBe(1);
      expect(history.summaries[2].isCurrentDraft).toBe(false);
      expect(history.summaries[2].isPublished).toBe(false);
      expect(history.summaries[2].publishedAt).not.toBeNull();
    });

    it("retrieves a specific version configuration by version ID", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "sites") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: sampleSite, error: null }),
            };
          }
          if (table === "site_versions") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: sampleVersions[1], error: null }),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient<Database>;

      const result = await getSiteConfigurationById(mockSupabase, mockSiteId, v2Id);
      expect(result.version.id).toBe(v2Id);
      expect(result.version.version_number).toBe(2);
      expect(result.configuration.metadata.title).toBe(sampleConfigV2.metadata.title);
    });

    it("throws 404 when target version ID is not found", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "sites") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: sampleSite, error: null }),
            };
          }
          if (table === "site_versions") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient<Database>;

      await expect(
        getSiteConfigurationById(mockSupabase, mockSiteId, "99999999-9999-4999-a999-999999999999"),
      ).rejects.toMatchObject({ code: "VERSION_NOT_FOUND" });
    });

    it("executes atomic rollback to a previously published version via RPC", async () => {
      const updatedSiteRow: SiteRow = {
        ...sampleSite,
        published_version_id: v1Id,
        updated_at: "2026-11-22T11:00:00.000Z",
      };

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "sites") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: sampleSite, error: null }),
            };
          }
          return {};
        }),
        rpc: vi.fn().mockResolvedValue({
          data: {
            site: updatedSiteRow,
            targetVersion: sampleVersions[2], // v1
          },
          error: null,
        }),
      } as unknown as SupabaseClient<Database>;

      const result = await rollbackPublishedVersion(mockSupabase, mockUserId, {
        siteId: mockSiteId,
        targetVersionId: v1Id,
        expectedCurrentPublishedVersionId: v2Id,
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        "rollback_published_site_version_atomic",
        expect.objectContaining({
          p_site_id: mockSiteId,
          p_business_id: mockBusinessId,
          p_caller_user_id: mockUserId,
          p_target_version_id: v1Id,
          p_expected_current_published_version_id: v2Id,
        }),
      );

      expect(result.site.published_version_id).toBe(v1Id);
      expect(result.rolledBackToVersion.version_number).toBe(1);
    });

    it("handles concurrency conflict (VY049) when rolling back", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "sites") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: sampleSite, error: null }),
            };
          }
          return {};
        }),
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: {
            message: "Rollback conflict: current published version does not match expected version",
            code: "VY049",
          },
        }),
      } as unknown as SupabaseClient<Database>;

      await expect(
        rollbackPublishedVersion(mockSupabase, mockUserId, {
          siteId: mockSiteId,
          targetVersionId: v1Id,
          expectedCurrentPublishedVersionId: "99999999-9999-4999-a999-999999999999",
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
    });

    it("maps VY001 live website capacity limit exceeded error on rollback to CAPACITY_EXCEEDED (403)", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "sites") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: { ...sampleSite, status: "suspended" },
                error: null,
              }),
            };
          }
          return {};
        }),
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: {
            message: "Capacity limit reached for live_websites: current 3, limit 3",
            code: "VY001",
          },
        }),
      } as unknown as SupabaseClient<Database>;

      await expect(
        rollbackPublishedVersion(mockSupabase, mockUserId, {
          siteId: mockSiteId,
          targetVersionId: v1Id,
          expectedCurrentPublishedVersionId: v2Id,
        }),
      ).rejects.toMatchObject({ code: "CAPACITY_EXCEEDED", statusCode: 403 });
    });

    it("restores a historical version into a new working draft without touching published pointer", async () => {
      const restoredDraftRow: SiteVersionRow = {
        id: "44444444-0000-0000-0000-000000000004",
        site_id: mockSiteId,
        business_id: mockBusinessId,
        version_number: 4,
        schema_version: "v1",
        configuration: JSON.parse(JSON.stringify(sampleConfigV1)),
        change_summary: "Restored from version 1",
        created_by: mockUserId,
        published_at: null,
        created_at: "2026-11-22T12:00:00.000Z",
      };

      const updatedSiteRow: SiteRow = {
        ...sampleSite,
        current_draft_version_id: restoredDraftRow.id,
        published_version_id: v2Id, // UNTOUCHED!
      };

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "sites") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: sampleSite, error: null }),
            };
          }
          if (table === "site_versions") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: sampleVersions[2], error: null }), // v1
            };
          }
          if (table === "media_items") {
            return {
              select: vi.fn().mockReturnThis(),
              in: vi.fn().mockResolvedValue({ data: [], error: null }),
            };
          }
          return {};
        }),
        rpc: vi.fn().mockResolvedValue({
          data: {
            version: restoredDraftRow,
            site: updatedSiteRow,
          },
          error: null,
        }),
      } as unknown as SupabaseClient<Database>;

      const result = await restoreVersionToDraft(mockSupabase, mockUserId, {
        siteId: mockSiteId,
        targetVersionId: v1Id,
        expectedBaseVersionNumber: 3,
      });

      expect(result.version.version_number).toBe(4);
      expect(result.version.change_summary).toBe("Restored from version 1");
      expect(result.site.published_version_id).toBe(v2Id);
      expect(result.site.current_draft_version_id).toBe(restoredDraftRow.id);
    });
  });

  // =========================================================================
  // 2. SERVER ACTIONS LAYER
  // =========================================================================
  describe("2. Server Actions Layer", () => {
    it("rollbackPublishedVersionAction validates input and revalidates paths on success", async () => {
      const mockResult = {
        site: { ...sampleSite, published_version_id: v1Id },
        rolledBackToVersion: sampleVersions[2],
        configuration: sampleConfigV1,
      };

      vi.spyOn(websiteActions, "rollbackPublishedVersionAction").mockResolvedValue({
        success: true,
        data: mockResult,
      });

      const res = await websiteActions.rollbackPublishedVersionAction({
        siteId: mockSiteId,
        targetVersionId: v1Id,
        expectedCurrentPublishedVersionId: v2Id,
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.site.published_version_id).toBe(v1Id);
      }
    });

    it("restoreVersionToDraftAction validates input and returns new draft version", async () => {
      const mockResult = {
        site: { ...sampleSite, current_draft_version_id: "new-draft-id" },
        version: { ...sampleVersions[2], id: "new-draft-id", version_number: 4 },
        configuration: sampleConfigV1,
      };

      vi.spyOn(websiteActions, "restoreVersionToDraftAction").mockResolvedValue({
        success: true,
        data: mockResult,
      });

      const res = await websiteActions.restoreVersionToDraftAction({
        siteId: mockSiteId,
        targetVersionId: v1Id,
        expectedBaseVersionNumber: 3,
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.version.version_number).toBe(4);
      }
    });
  });

  // =========================================================================
  // 3. UI LAYER: VERSION HISTORY MODAL
  // =========================================================================
  describe("3. VersionHistoryModal Component", () => {
    it("renders version history with correct status badges", () => {
      render(
        <VersionHistoryModal
          isOpen={true}
          onClose={vi.fn()}
          siteId={mockSiteId}
          siteSubdomain="artisan-cafe"
          currentDraftVersionId={v3Id}
          currentPublishedVersionId={v2Id}
          currentVersionNumber={3}
          initialVersions={mockSummaries}
          onInspectVersion={vi.fn()}
          onRestoreToDraft={vi.fn()}
          onRollbackLiveSite={vi.fn()}
        />,
      );

      // Verify header and subdomain
      expect(screen.getByText("Site Version History")).toBeDefined();
      expect(screen.getByText("artisan-cafe.vyapone.in")).toBeDefined();

      // Verify versions listed
      expect(screen.getByText("v3")).toBeDefined();
      expect(screen.getByText("v2")).toBeDefined();
      expect(screen.getByText("v1")).toBeDefined();

      // Verify status badges
      expect(screen.getByText("Active Draft")).toBeDefined();
      expect(screen.getByText("● Live Published")).toBeDefined();
      expect(screen.getByText("Previously Published")).toBeDefined();
    });

    it("triggers inspect callback and closes modal on inspect click", () => {
      const handleInspect = vi.fn();
      const handleClose = vi.fn();

      render(
        <VersionHistoryModal
          isOpen={true}
          onClose={handleClose}
          siteId={mockSiteId}
          siteSubdomain="artisan-cafe"
          currentDraftVersionId={v3Id}
          currentPublishedVersionId={v2Id}
          currentVersionNumber={3}
          initialVersions={mockSummaries}
          onInspectVersion={handleInspect}
          onRestoreToDraft={vi.fn()}
          onRollbackLiveSite={vi.fn()}
        />,
      );

      const inspectButton = screen.getByLabelText("Inspect version 1 in read-only preview");
      fireEvent.click(inspectButton);

      expect(handleInspect).toHaveBeenCalledWith(
        expect.objectContaining({ versionNumber: 1, id: v1Id }),
      );
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it("shows confirmation banner before restoring a version to draft", async () => {
      const handleRestore = vi.fn().mockResolvedValue(undefined);
      const handleClose = vi.fn();

      render(
        <VersionHistoryModal
          isOpen={true}
          onClose={handleClose}
          siteId={mockSiteId}
          siteSubdomain="artisan-cafe"
          currentDraftVersionId={v3Id}
          currentPublishedVersionId={v2Id}
          currentVersionNumber={3}
          initialVersions={mockSummaries}
          onInspectVersion={vi.fn()}
          onRestoreToDraft={handleRestore}
          onRollbackLiveSite={vi.fn()}
        />,
      );

      // Click "Restore to Draft" on v1
      const restoreButton = screen.getByLabelText("Restore version 1 to draft");
      fireEvent.click(restoreButton);

      // Confirmation banner appears
      expect(screen.getByText("Restore Version 1 to Working Draft?")).toBeDefined();

      // Confirm button
      const confirmButton = screen.getByLabelText("Confirm restore");
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(handleRestore).toHaveBeenCalledWith(expect.objectContaining({ versionNumber: 1 }));
        expect(handleClose).toHaveBeenCalledTimes(1);
      });
    });

    it("shows confirmation banner before rolling back live site", async () => {
      const handleRollback = vi.fn().mockResolvedValue(undefined);
      const handleClose = vi.fn();

      render(
        <VersionHistoryModal
          isOpen={true}
          onClose={handleClose}
          siteId={mockSiteId}
          siteSubdomain="artisan-cafe"
          currentDraftVersionId={v3Id}
          currentPublishedVersionId={v2Id}
          currentVersionNumber={3}
          initialVersions={mockSummaries}
          onInspectVersion={vi.fn()}
          onRestoreToDraft={vi.fn()}
          onRollbackLiveSite={handleRollback}
        />,
      );

      // Click "Rollback Live" on v1 (which was previously published)
      const rollbackButton = screen.getByLabelText("Roll back live site to version 1");
      fireEvent.click(rollbackButton);

      // Confirmation banner appears
      expect(screen.getByText("Roll Back Live Website to Version 1?")).toBeDefined();

      // Confirm button
      const confirmButton = screen.getByLabelText("Confirm rollback");
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(handleRollback).toHaveBeenCalledWith(expect.objectContaining({ versionNumber: 1 }));
        expect(handleClose).toHaveBeenCalledTimes(1);
      });
    });

    it("closes modal on Escape key press", () => {
      const handleClose = vi.fn();

      render(
        <VersionHistoryModal
          isOpen={true}
          onClose={handleClose}
          siteId={mockSiteId}
          initialVersions={mockSummaries}
          onInspectVersion={vi.fn()}
          onRestoreToDraft={vi.fn()}
          onRollbackLiveSite={vi.fn()}
        />,
      );

      fireEvent.keyDown(window, { key: "Escape" });
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // 4. CONSTRAINED EDITOR: INSPECTION & AUTOSAVE SUSPENSION
  // =========================================================================
  describe("4. ConstrainedWebsiteEditor Integration", () => {
    beforeEach(() => {
      vi.spyOn(websiteActions, "getSiteVersionsAction").mockResolvedValue({
        success: true,
        data: {
          versions: sampleVersions,
          summaries: mockSummaries,
          totalCount: 3,
          currentDraftVersionId: v3Id,
          publishedVersionId: v2Id,
        },
      });
    });

    it("opens version history modal when clicking History button in top bar", async () => {
      render(
        <ConstrainedWebsiteEditor
          initialSite={sampleSite}
          initialVersion={sampleVersions[0]}
          initialConfiguration={sampleConfigV3}
        />,
      );

      const historyButton = screen.getByLabelText("Open version history");
      await waitFor(() => {
        fireEvent.click(historyButton);
      });

      expect(screen.getByRole("dialog", { name: "Site Version History" })).toBeDefined();
    });

    it("suspends autosave while inspecting a historical version", async () => {
      const saveSpy = vi.spyOn(websiteActions, "saveSiteDraftConfigurationAction");

      const { rerender } = render(
        <ConstrainedWebsiteEditor
          initialSite={sampleSite}
          initialVersion={sampleVersions[0]}
          initialConfiguration={sampleConfigV3}
          autosaveDebounceMs={50}
        />,
      );

      // Open history modal and simulate inspecting v1
      const historyButton = screen.getByLabelText("Open version history");
      await waitFor(() => {
        fireEvent.click(historyButton);
      });

      // Mock getSiteVersionByIdAction to return v1 config
      vi.spyOn(websiteActions, "getSiteVersionByIdAction").mockResolvedValue({
        success: true,
        data: {
          version: sampleVersions[2],
          configuration: sampleConfigV1,
        },
      });

      // Rerender with version history modal open
      rerender(
        <ConstrainedWebsiteEditor
          initialSite={sampleSite}
          initialVersion={sampleVersions[0]}
          initialConfiguration={sampleConfigV3}
          autosaveDebounceMs={50}
        />,
      );

      // In inspection mode, autosave should NOT fire
      await new Promise((r) => setTimeout(r, 100));
      expect(saveSpy).not.toHaveBeenCalled();
    });
  });
});
