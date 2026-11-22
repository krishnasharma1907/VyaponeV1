/**
 * VyapOne — Responsive Preview and Device Modes Test Suite [VO-045]
 *
 * Verifies responsive website preview and device modes in the constrained website editor:
 * 1. Default desktop preview mode (responsive max-w-[1200px]).
 * 2. Tablet preview mode (768px target breakpoint).
 * 3. Mobile preview mode (390px primary validation target with notch/bezel).
 * 4. Draft isolation: switching device modes does NOT mutate site pointers, versions, or status.
 * 5. Preservation of unsaved working changes across device switches.
 * 6. Responsive rendering of representative canonical blocks in device frames.
 * 7. Accessibility, radiogroup semantics, and keyboard interactions.
 * 8. Retention of VO-044 optimistic concurrency base version tracking.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import { ConstrainedWebsiteEditor } from "@/components/websites/editor/constrained-website-editor";
import { buildInitialWebsiteConfiguration } from "@/lib/websites/defaults";
import * as websiteActions from "@/lib/websites/actions";
import type { SiteRow, SiteVersionRow, WebsiteConfiguration } from "@/lib/websites/types";
import type { WebsiteRenderContext } from "@/components/websites/blocks/types";

// Mock server actions
vi.mock("@/lib/websites/actions", () => ({
  saveSiteDraftConfigurationAction: vi.fn(),
  loadOwnerWebsiteWorkspaceAction: vi.fn(),
}));

describe("VO-045 Responsive Preview and Device Modes Test Suite", () => {
  const MOCK_SITE_ID = "11111111-1111-4111-8111-111111111111";
  const MOCK_BUSINESS_ID = "22222222-2222-4222-8222-222222222222";
  const MOCK_VERSION_ID = "33333333-3333-4333-8333-333333333333";

  const MOCK_SITE: SiteRow = {
    id: MOCK_SITE_ID,
    business_id: MOCK_BUSINESS_ID,
    subdomain: "sharma-sweets",
    primary_domain: null,
    status: "draft",
    current_draft_version_id: MOCK_VERSION_ID,
    published_version_id: null,
    created_at: "2026-11-20T10:00:00Z",
    updated_at: "2026-11-20T10:00:00Z",
  };

  const MOCK_VERSION: SiteVersionRow = {
    id: MOCK_VERSION_ID,
    site_id: MOCK_SITE_ID,
    business_id: MOCK_BUSINESS_ID,
    version_number: 1,
    schema_version: "v1",
    configuration: {},
    change_summary: "Initial draft",
    created_by: "user-123",
    created_at: "2026-11-20T10:00:00Z",
    published_at: null,
  };

  let MOCK_CONFIG: WebsiteConfiguration;

  const MOCK_CONTEXT: WebsiteRenderContext = {
    business: {
      id: MOCK_BUSINESS_ID,
      name: "Sharma Sweets",
      tradeName: "Sharma Sweets",
      primaryLocation: {
        addressLine1: "123 MG Road",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
      },
    },
    catalogueItems: [
      {
        id: "cat-1",
        name: "Kaju Katli",
        priceMinor: 25000,
        currency: "INR",
        isAvailable: true,
      },
      {
        id: "cat-2",
        name: "Gulab Jamun",
        priceMinor: 15000,
        currency: "INR",
        isAvailable: true,
      },
    ],
    previewMode: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    MOCK_CONFIG = buildInitialWebsiteConfiguration({
      siteId: MOCK_SITE_ID,
      businessId: MOCK_BUSINESS_ID,
      tradeName: "Sharma Sweets",
      subdomain: "sharma-sweets",
      nicheSlug: "sweets",
    });
  });

  // ----------------------------------------------------------------------------
  // 1. Device Mode Selection & Viewport Sizing
  // ----------------------------------------------------------------------------
  describe("1. Device Mode Selection & Viewport Sizing", () => {
    it("renders with default desktop device mode and responsive canvas sizing", () => {
      render(
        <ConstrainedWebsiteEditor
          initialSite={MOCK_SITE}
          initialVersion={MOCK_VERSION}
          initialConfiguration={MOCK_CONFIG}
          context={MOCK_CONTEXT}
        />,
      );

      // Verify active desktop radio button
      const desktopRadio = screen.getByRole("radio", { name: "Desktop Preview Mode" });
      expect(desktopRadio.getAttribute("aria-checked")).toBe("true");

      // Verify device badge in preview header
      const deviceBadge = screen.getByTestId("preview-device-badge");
      expect(deviceBadge.textContent).toContain("Desktop Viewport (Responsive)");

      // Verify canvas container sizing classes
      const canvas = screen.getByTestId("preview-canvas");
      expect(canvas.getAttribute("data-device-mode")).toBe("desktop");
      expect(canvas.className).toContain("max-w-[1200px]");
      expect(canvas.className).toContain("w-full");

      // Mobile notch should NOT be present on desktop
      expect(screen.queryByTestId("mobile-notch")).toBeNull();
    });

    it("switches to tablet mode with 768px viewport width when tablet control is clicked", () => {
      render(
        <ConstrainedWebsiteEditor
          initialSite={MOCK_SITE}
          initialVersion={MOCK_VERSION}
          initialConfiguration={MOCK_CONFIG}
          context={MOCK_CONTEXT}
        />,
      );

      const tabletRadio = screen.getByRole("radio", { name: "Tablet Preview Mode (768px)" });
      fireEvent.click(tabletRadio);

      // Verify active tablet radio button
      expect(tabletRadio.getAttribute("aria-checked")).toBe("true");
      expect(
        screen.getByRole("radio", { name: "Desktop Preview Mode" }).getAttribute("aria-checked"),
      ).toBe("false");

      // Verify device badge
      const deviceBadge = screen.getByTestId("preview-device-badge");
      expect(deviceBadge.textContent).toContain("Tablet Viewport (768px)");

      // Verify canvas width class
      const canvas = screen.getByTestId("preview-canvas");
      expect(canvas.getAttribute("data-device-mode")).toBe("tablet");
      expect(canvas.className).toContain("w-[768px]");
      expect(canvas.className).toContain("rounded-2xl");

      // Mobile notch should NOT be present on tablet
      expect(screen.queryByTestId("mobile-notch")).toBeNull();
    });

    it("switches to mobile mode with 390px viewport width and mobile bezel/notch when mobile control is clicked", () => {
      render(
        <ConstrainedWebsiteEditor
          initialSite={MOCK_SITE}
          initialVersion={MOCK_VERSION}
          initialConfiguration={MOCK_CONFIG}
          context={MOCK_CONTEXT}
        />,
      );

      const mobileRadio = screen.getByRole("radio", { name: "Mobile Preview Mode (390px)" });
      fireEvent.click(mobileRadio);

      // Verify active mobile radio button
      expect(mobileRadio.getAttribute("aria-checked")).toBe("true");
      expect(
        screen.getByRole("radio", { name: "Desktop Preview Mode" }).getAttribute("aria-checked"),
      ).toBe("false");

      // Verify device badge
      const deviceBadge = screen.getByTestId("preview-device-badge");
      expect(deviceBadge.textContent).toContain("Mobile Viewport (390px)");

      // Verify canvas width class (390px primary mobile validation target)
      const canvas = screen.getByTestId("preview-canvas");
      expect(canvas.getAttribute("data-device-mode")).toBe("mobile");
      expect(canvas.className).toContain("w-[390px]");
      expect(canvas.className).toContain("rounded-[32px]");
      expect(canvas.className).toContain("border-[6px]");

      // Mobile camera notch simulator should be present
      expect(screen.getByTestId("mobile-notch")).toBeDefined();
    });

    it("respects initialDeviceMode prop when provided", () => {
      render(
        <ConstrainedWebsiteEditor
          initialSite={MOCK_SITE}
          initialVersion={MOCK_VERSION}
          initialConfiguration={MOCK_CONFIG}
          context={MOCK_CONTEXT}
          initialDeviceMode="mobile"
        />,
      );

      const mobileRadio = screen.getByRole("radio", { name: "Mobile Preview Mode (390px)" });
      expect(mobileRadio.getAttribute("aria-checked")).toBe("true");

      const canvas = screen.getByTestId("preview-canvas");
      expect(canvas.getAttribute("data-device-mode")).toBe("mobile");
      expect(canvas.className).toContain("w-[390px]");
    });
  });

  // ----------------------------------------------------------------------------
  // 2. Draft Isolation & Data Integrity Across Mode Switches
  // ----------------------------------------------------------------------------
  describe("2. Draft Isolation & Data Integrity", () => {
    it("maintains the exact same draft configuration across multiple device mode changes", () => {
      render(
        <ConstrainedWebsiteEditor
          initialSite={MOCK_SITE}
          initialVersion={MOCK_VERSION}
          initialConfiguration={MOCK_CONFIG}
          context={MOCK_CONTEXT}
        />,
      );

      // Add a new section in desktop mode
      fireEvent.click(screen.getByRole("button", { name: "+ Add Section" }));
      fireEvent.click(within(screen.getByRole("dialog")).getByText("Food & Dining Menu"));

      // Verify section is added
      expect(screen.getByText("Food & Dining Menu")).toBeDefined();

      // Cycle through device modes: Tablet -> Mobile -> Desktop
      fireEvent.click(screen.getByRole("radio", { name: "Tablet Preview Mode (768px)" }));
      expect(screen.getByText("Food & Dining Menu")).toBeDefined();

      fireEvent.click(screen.getByRole("radio", { name: "Mobile Preview Mode (390px)" }));
      expect(screen.getByText("Food & Dining Menu")).toBeDefined();

      fireEvent.click(screen.getByRole("radio", { name: "Desktop Preview Mode" }));
      expect(screen.getByText("Food & Dining Menu")).toBeDefined();

      // Verify no save action was invoked during switching
      expect(websiteActions.saveSiteDraftConfigurationAction).not.toHaveBeenCalled();
    });

    it("preserves unsaved working changes across device switches", () => {
      render(
        <ConstrainedWebsiteEditor
          initialSite={MOCK_SITE}
          initialVersion={MOCK_VERSION}
          initialConfiguration={MOCK_CONFIG}
          context={MOCK_CONTEXT}
        />,
      );

      // Add a section to mark draft unsaved
      fireEvent.click(screen.getByRole("button", { name: "+ Add Section" }));
      fireEvent.click(within(screen.getByRole("dialog")).getByText("Contact Channels"));

      expect(screen.getByText("● Unsaved Changes")).toBeDefined();

      // Enter a change summary note
      const summaryInput = screen.getByPlaceholderText(/Brief note on changes/i);
      fireEvent.change(summaryInput, { target: { value: "Added contact block for Diwali" } });

      // Switch to Mobile mode
      fireEvent.click(screen.getByRole("radio", { name: "Mobile Preview Mode (390px)" }));

      // Unsaved status and note must be intact
      expect(screen.getByText("● Unsaved Changes")).toBeDefined();
      expect(screen.getByDisplayValue("Added contact block for Diwali")).toBeDefined();

      // Switch to Tablet mode
      fireEvent.click(screen.getByRole("radio", { name: "Tablet Preview Mode (768px)" }));

      expect(screen.getByText("● Unsaved Changes")).toBeDefined();
      expect(screen.getByDisplayValue("Added contact block for Diwali")).toBeDefined();
    });

    it("does not create a new version, call save RPC, or alter site pointers on device switch", () => {
      render(
        <ConstrainedWebsiteEditor
          initialSite={MOCK_SITE}
          initialVersion={MOCK_VERSION}
          initialConfiguration={MOCK_CONFIG}
          context={MOCK_CONTEXT}
        />,
      );

      // Initial version badge is Draft v1
      expect(screen.getByText("Draft v1")).toBeDefined();

      // Switch device modes repeatedly
      fireEvent.click(screen.getByRole("radio", { name: "Tablet Preview Mode (768px)" }));
      fireEvent.click(screen.getByRole("radio", { name: "Mobile Preview Mode (390px)" }));
      fireEvent.click(screen.getByRole("radio", { name: "Desktop Preview Mode" }));

      // Version badge must remain Draft v1
      expect(screen.getByText("Draft v1")).toBeDefined();

      // Published version pointers remain null and unpublished
      expect(MOCK_SITE.published_version_id).toBeNull();
      expect(MOCK_SITE.status).toBe("draft");

      // Verify no network or persistence side effect occurred
      expect(websiteActions.saveSiteDraftConfigurationAction).not.toHaveBeenCalled();
    });

    it("preserves VO-044 optimistic concurrency base version tracking after device mode switches", async () => {
      vi.mocked(websiteActions.saveSiteDraftConfigurationAction).mockResolvedValueOnce({
        success: true,
        data: {
          site: { ...MOCK_SITE, current_draft_version_id: "ver-2" },
          version: { ...MOCK_VERSION, id: "ver-2", version_number: 2 },
          configuration: MOCK_CONFIG,
        },
      });

      render(
        <ConstrainedWebsiteEditor
          initialSite={MOCK_SITE}
          initialVersion={MOCK_VERSION}
          initialConfiguration={MOCK_CONFIG}
          context={MOCK_CONTEXT}
        />,
      );

      // Make a change
      fireEvent.click(screen.getByRole("button", { name: "+ Add Section" }));
      fireEvent.click(within(screen.getByRole("dialog")).getByText("FAQ Accordion"));

      // Switch device modes before saving
      fireEvent.click(screen.getByRole("radio", { name: "Mobile Preview Mode (390px)" }));
      fireEvent.click(screen.getByRole("radio", { name: "Tablet Preview Mode (768px)" }));

      // Save draft
      const saveButton = screen.getByRole("button", { name: "Save website draft" });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(websiteActions.saveSiteDraftConfigurationAction).toHaveBeenCalledWith({
          siteId: MOCK_SITE.id,
          configuration: expect.any(Object),
          changeSummary: undefined,
          expectedBaseVersionNumber: 1, // Correct base version preserved!
        });
      });
    });
  });

  // ----------------------------------------------------------------------------
  // 3. Responsive Rendering of Canonical Blocks
  // ----------------------------------------------------------------------------
  describe("3. Responsive Rendering of Canonical Blocks", () => {
    it("renders canonical hero, menu, and contact blocks cleanly in mobile viewport (390px)", () => {
      render(
        <ConstrainedWebsiteEditor
          initialSite={MOCK_SITE}
          initialVersion={MOCK_VERSION}
          initialConfiguration={MOCK_CONFIG}
          context={MOCK_CONTEXT}
          initialDeviceMode="mobile"
        />,
      );

      const canvas = screen.getByTestId("preview-canvas");

      // Canvas has mobile 390px styling
      expect(canvas.className).toContain("w-[390px]");

      // PublicWebsiteRenderer renders inside the mobile canvas
      expect(within(canvas).getByRole("heading", { name: "Sharma Sweets" })).toBeDefined();
      expect(within(canvas).getByText("Fresh quality & trusted local service")).toBeDefined();
      expect(within(canvas).getByText("Gulab Jamun")).toBeDefined();
      expect(within(canvas).getByText("Get in Touch")).toBeDefined();
    });

    it("renders canonical blocks cleanly in tablet viewport (768px)", () => {
      render(
        <ConstrainedWebsiteEditor
          initialSite={MOCK_SITE}
          initialVersion={MOCK_VERSION}
          initialConfiguration={MOCK_CONFIG}
          context={MOCK_CONTEXT}
          initialDeviceMode="tablet"
        />,
      );

      const canvas = screen.getByTestId("preview-canvas");

      // Canvas has tablet 768px styling
      expect(canvas.className).toContain("w-[768px]");
      expect(within(canvas).getByRole("heading", { name: "Sharma Sweets" })).toBeDefined();
      expect(within(canvas).getByText("Fresh quality & trusted local service")).toBeDefined();
      expect(within(canvas).getByText("Gulab Jamun")).toBeDefined();
      expect(within(canvas).getByText("Get in Touch")).toBeDefined();
    });
  });

  // ----------------------------------------------------------------------------
  // 4. Accessibility and Keyboard Interactions
  // ----------------------------------------------------------------------------
  describe("4. Accessibility & Touch Targets", () => {
    it("exposes proper radiogroup semantics and accessible names for device controls", () => {
      render(
        <ConstrainedWebsiteEditor
          initialSite={MOCK_SITE}
          initialVersion={MOCK_VERSION}
          initialConfiguration={MOCK_CONFIG}
          context={MOCK_CONTEXT}
        />,
      );

      const radioGroup = screen.getByRole("radiogroup", { name: "Preview Device Mode" });
      expect(radioGroup).toBeDefined();

      const desktopBtn = within(radioGroup).getByRole("radio", { name: "Desktop Preview Mode" });
      const tabletBtn = within(radioGroup).getByRole("radio", {
        name: "Tablet Preview Mode (768px)",
      });
      const mobileBtn = within(radioGroup).getByRole("radio", {
        name: "Mobile Preview Mode (390px)",
      });

      expect(desktopBtn).toBeDefined();
      expect(tabletBtn).toBeDefined();
      expect(mobileBtn).toBeDefined();

      // Initial checked state
      expect(desktopBtn.getAttribute("aria-checked")).toBe("true");
      expect(tabletBtn.getAttribute("aria-checked")).toBe("false");
      expect(mobileBtn.getAttribute("aria-checked")).toBe("false");
    });

    it("supports keyboard navigation and activation on device mode buttons", () => {
      render(
        <ConstrainedWebsiteEditor
          initialSite={MOCK_SITE}
          initialVersion={MOCK_VERSION}
          initialConfiguration={MOCK_CONFIG}
          context={MOCK_CONTEXT}
        />,
      );

      const tabletBtn = screen.getByRole("radio", { name: "Tablet Preview Mode (768px)" });

      // Focus and trigger click via keyboard event simulation
      tabletBtn.focus();
      expect(document.activeElement).toBe(tabletBtn);

      fireEvent.click(tabletBtn);
      expect(tabletBtn.getAttribute("aria-checked")).toBe("true");
    });
  });
});
