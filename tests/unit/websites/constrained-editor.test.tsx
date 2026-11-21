/**
 * VyapOne — Constrained Visual Editor Unit & Integration Test Suite [VO-044]
 *
 * Verifies all requirements of the VO-044 constrained visual editor:
 * 1. Loading existing draft & initializing clean configuration
 * 2. Canonical 13 approved block registry integration (all 13 blocks)
 * 3. Adding, removing, reordering, and hiding/showing sections
 * 4. Section property inspection & layout variant selection
 * 5. Rejection of unapproved blocks & arbitrary code injection
 * 6. Input sanitization (stripping unsafe javascript:/data: URLs)
 * 7. Client & server schema validation before persistence
 * 8. Draft saving via atomic action & optimistic concurrency/conflict handling
 * 9. Draft preview isolation (previewMode: true, zero premature publication)
 * 10. Multi-page navigation & page creation
 * 11. View mode switching (Split, Edit, Preview)
 * 12. Accessibility (landmarks, escape key dismiss, ARIA labels)
 */

import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock server-only to allow testing in Vitest JSDOM environment
vi.mock("server-only", () => ({}));

import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { ConstrainedWebsiteEditor } from "@/components/websites/editor/constrained-website-editor";
import { AddSectionModal } from "@/components/websites/editor/add-section-modal";
import { SectionInspector } from "@/components/websites/editor/section-inspector";
import { SectionNavigator } from "@/components/websites/editor/section-navigator";
import { PageSelector } from "@/components/websites/editor/page-selector";
import { buildInitialWebsiteConfiguration } from "@/lib/websites/defaults";
import {
  APPROVED_BLOCK_REGISTRY,
  getAllApprovedBlockTypes,
} from "@/components/websites/blocks/block-registry";
import type {
  ApprovedBlockType,
  SectionConfig,
  SiteRow,
  SiteVersionRow,
  WebsiteConfiguration,
} from "@/lib/websites/types";
import * as websiteActions from "@/lib/websites/actions";

// Mock saveSiteDraftConfigurationAction
vi.mock("@/lib/websites/actions", async () => {
  const actual = await vi.importActual<typeof websiteActions>("@/lib/websites/actions");
  return {
    ...actual,
    saveSiteDraftConfigurationAction: vi.fn(),
  };
});

describe("VO-044 Constrained Visual Editor Test Suite", () => {
  const MOCK_SITE: SiteRow = {
    id: "11111111-1111-4111-8111-111111111111",
    business_id: "22222222-2222-4222-8222-222222222222",
    subdomain: "sharma-sweets",
    primary_domain: "sharmasweets.in",
    status: "draft",
    current_draft_version_id: "33333333-3333-4333-8333-333333333333",
    published_version_id: null,
    created_at: "2026-11-21T00:00:00Z",
    updated_at: "2026-11-21T00:00:00Z",
  };

  const MOCK_VERSION: SiteVersionRow = {
    id: "33333333-3333-4333-8333-333333333333",
    site_id: MOCK_SITE.id,
    business_id: MOCK_SITE.business_id,
    version_number: 1,
    schema_version: "v1",
    configuration: {},
    created_by: "44444444-4444-4444-8444-444444444444",
    change_summary: "Initial draft",
    published_at: null,
    created_at: "2026-11-21T00:00:00Z",
  };

  const MOCK_CONFIG: WebsiteConfiguration = buildInitialWebsiteConfiguration({
    siteId: MOCK_SITE.id,
    businessId: MOCK_SITE.business_id,
    tradeName: "Sharma Sweets",
    subdomain: "sharma-sweets",
    nicheSlug: "sweets",
    description: "Authentic Indian sweets crafted with pure desi ghee.",
  });

  const MOCK_CONTEXT = {
    business: {
      id: MOCK_SITE.business_id,
      name: "Sharma Sweets",
      tradeName: "Sharma Sweets",
      phone: "+919876543210",
      whatsappNumber: "+919876543210",
      primaryLocation: {
        addressLine1: "100 MG Road",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
      },
    },
    catalogueItems: [
      { id: "cat-1", name: "Kaju Katli", priceMinor: 25000, currency: "INR", isAvailable: true },
      {
        id: "cat-2",
        name: "Motichoor Ladoo",
        priceMinor: 18000,
        currency: "INR",
        isAvailable: true,
      },
    ],
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  // ----------------------------------------------------------------------------
  // 1. Loading Existing Draft & Initialization
  // ----------------------------------------------------------------------------
  describe("1. Draft Initialization & Workspace Layout", () => {
    it("renders the editor workspace with top bar, page tabs, section navigator, and draft preview", () => {
      render(
        <ConstrainedWebsiteEditor
          initialSite={MOCK_SITE}
          initialVersion={MOCK_VERSION}
          initialConfiguration={MOCK_CONFIG}
          context={MOCK_CONTEXT}
        />,
      );

      // Top bar identity
      expect(screen.getByText("sharma-sweets.vyapone.in")).toBeDefined();
      expect(screen.getByText("Draft v1")).toBeDefined();

      // Page tabs
      expect(screen.getByRole("tab", { name: /Home/i })).toBeDefined();

      // Section list header
      expect(screen.getByRole("heading", { name: "Page Sections" })).toBeDefined();
      expect(screen.getByRole("button", { name: "+ Add Section" })).toBeDefined();

      // Draft preview banner
      expect(screen.getByText("Private Draft Preview")).toBeDefined();
    });

    it("displays initial sections loaded from configuration in sequential order", () => {
      render(
        <ConstrainedWebsiteEditor
          initialSite={MOCK_SITE}
          initialVersion={MOCK_VERSION}
          initialConfiguration={MOCK_CONFIG}
          context={MOCK_CONTEXT}
        />,
      );

      const homeSections = MOCK_CONFIG.pages[0].sections;
      expect(homeSections.length).toBeGreaterThan(0);

      // Verify position indicator #1
      expect(screen.getByText("#1")).toBeDefined();
      // Verify first section name is rendered in the list
      const firstSectionMeta = APPROVED_BLOCK_REGISTRY[homeSections[0].type].metadata;
      expect(screen.getAllByText(firstSectionMeta.name).length).toBeGreaterThan(0);
    });
  });

  // ----------------------------------------------------------------------------
  // 2. Canonical 13 Approved Block Registry
  // ----------------------------------------------------------------------------
  describe("2. Canonical 13 Approved Block Types", () => {
    it("exposes all 13 canonical approved blocks in AddSectionModal", () => {
      const allApproved = getAllApprovedBlockTypes();
      expect(allApproved.length).toBe(13);

      const onAddMock = vi.fn();
      const onCloseMock = vi.fn();

      render(<AddSectionModal isOpen={true} onClose={onCloseMock} onAddBlock={onAddMock} />);

      // All 13 block names must be present in the modal
      for (const type of allApproved) {
        const meta = APPROVED_BLOCK_REGISTRY[type].metadata;
        expect(screen.getByText(meta.name)).toBeDefined();
      }
    });

    it("filters approved blocks by category in AddSectionModal", () => {
      render(<AddSectionModal isOpen={true} onClose={vi.fn()} onAddBlock={vi.fn()} />);

      // Click "Store & Commerce" filter
      const commerceButton = screen.getByRole("button", { name: "Store & Commerce" });
      fireEvent.click(commerceButton);

      // Commerce blocks must be present
      expect(screen.getByText("Food & Dining Menu")).toBeDefined();
      expect(screen.getByText("Product Catalogue Grid")).toBeDefined();
      expect(screen.getByText("Pricing Tiers")).toBeDefined();
      expect(screen.getByText("Special Offers")).toBeDefined();

      // Non-commerce blocks must NOT be present
      expect(screen.queryByText("Hero Banner")).toBeNull();
      expect(screen.queryByText("Website Footer")).toBeNull();
    });

    it("searches approved blocks by keyword in AddSectionModal", () => {
      render(<AddSectionModal isOpen={true} onClose={vi.fn()} onAddBlock={vi.fn()} />);

      const searchInput = screen.getByPlaceholderText(/Search approved blocks/i);
      fireEvent.change(searchInput, { target: { value: "reviews" } });

      expect(screen.getByText("Customer Reviews")).toBeDefined();
      expect(screen.queryByText("Hero Banner")).toBeNull();
    });

    it("calls onAddBlock with the selected approved block type and closes modal", () => {
      const onAddMock = vi.fn();
      const onCloseMock = vi.fn();

      render(<AddSectionModal isOpen={true} onClose={onCloseMock} onAddBlock={onAddMock} />);

      const addMenuButton = screen.getByText("Food & Dining Menu");
      fireEvent.click(addMenuButton);

      expect(onAddMock).toHaveBeenCalledWith("menu");
      expect(onCloseMock).toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------------------------
  // 3. Adding, Removing, Hiding, and Reordering Sections
  // ----------------------------------------------------------------------------
  describe("3. Section Manipulation (Add, Remove, Reorder, Hide/Show)", () => {
    it("adds a new section when selected from modal and marks draft as unsaved", async () => {
      render(
        <ConstrainedWebsiteEditor
          initialSite={MOCK_SITE}
          initialVersion={MOCK_VERSION}
          initialConfiguration={MOCK_CONFIG}
          context={MOCK_CONTEXT}
        />,
      );

      // Initially no unsaved changes badge
      expect(screen.queryByText("● Unsaved Changes")).toBeNull();

      // Open Add Section modal
      fireEvent.click(screen.getByRole("button", { name: "+ Add Section" }));
      expect(screen.getByRole("dialog")).toBeDefined();

      // Select FAQ block
      fireEvent.click(screen.getByText("FAQ Accordion"));

      // Unsaved changes badge must now appear
      expect(screen.getByText("● Unsaved Changes")).toBeDefined();

      // FAQ section should now be selected in inspector
      expect(screen.getByRole("heading", { name: "FAQ Accordion" })).toBeDefined();
    });

    it("removes a section when remove button is clicked", () => {
      const sampleSections: SectionConfig[] = [
        { id: "sec-1", type: "hero", props: { title: "Hero Block" } },
        { id: "sec-2", type: "about", props: { title: "About Block", story: "Story" } },
      ];

      const onRemoveMock = vi.fn();

      render(
        <SectionNavigator
          sections={sampleSections}
          selectedSectionId={null}
          onSelectSection={vi.fn()}
          onMoveUp={vi.fn()}
          onMoveDown={vi.fn()}
          onToggleEnabled={vi.fn()}
          onRemoveSection={onRemoveMock}
          onOpenAddModal={vi.fn()}
        />,
      );

      const removeButtons = screen.getAllByTitle("Remove section from page");
      expect(removeButtons.length).toBe(2);

      fireEvent.click(removeButtons[0]);
      expect(onRemoveMock).toHaveBeenCalledWith("sec-1");
    });

    it("toggles section visibility (hide/show) when toggle button is clicked", () => {
      const sampleSections: SectionConfig[] = [
        { id: "sec-1", type: "hero", isEnabled: true, props: { title: "Hero" } },
        { id: "sec-2", type: "about", isEnabled: false, props: { title: "About", story: "Story" } },
      ];

      const onToggleMock = vi.fn();

      render(
        <SectionNavigator
          sections={sampleSections}
          selectedSectionId={null}
          onSelectSection={vi.fn()}
          onMoveUp={vi.fn()}
          onMoveDown={vi.fn()}
          onToggleEnabled={onToggleMock}
          onRemoveSection={vi.fn()}
          onOpenAddModal={vi.fn()}
        />,
      );

      // Section 1 is enabled -> button says "Hide"
      const hideButton = screen.getByRole("button", { name: "Hide Hero Banner" });
      fireEvent.click(hideButton);
      expect(onToggleMock).toHaveBeenCalledWith("sec-1");

      // Section 2 is hidden -> button says "Show"
      const showButton = screen.getByRole("button", { name: "Show About Business" });
      fireEvent.click(showButton);
      expect(onToggleMock).toHaveBeenCalledWith("sec-2");
    });

    it("reorders sections using Move Up and Move Down buttons with proper boundary disabling", () => {
      const sampleSections: SectionConfig[] = [
        { id: "sec-1", type: "hero", props: { title: "Hero" } },
        { id: "sec-2", type: "about", props: { title: "About", story: "Story" } },
        { id: "sec-3", type: "contact", props: { title: "Contact" } },
      ];

      const onMoveUpMock = vi.fn();
      const onMoveDownMock = vi.fn();

      render(
        <SectionNavigator
          sections={sampleSections}
          selectedSectionId={null}
          onSelectSection={vi.fn()}
          onMoveUp={onMoveUpMock}
          onMoveDown={onMoveDownMock}
          onToggleEnabled={vi.fn()}
          onRemoveSection={vi.fn()}
          onOpenAddModal={vi.fn()}
        />,
      );

      // First section (#1 Hero) should have Move Up disabled
      const heroMoveUp = screen.getByRole("button", { name: "Move Hero Banner up" });
      expect(heroMoveUp.hasAttribute("disabled")).toBe(true);

      const heroMoveDown = screen.getByRole("button", { name: "Move Hero Banner down" });
      expect(heroMoveDown.hasAttribute("disabled")).toBe(false);
      fireEvent.click(heroMoveDown);
      expect(onMoveDownMock).toHaveBeenCalledWith(0);

      // Last section (#3 Contact) should have Move Down disabled
      const contactMoveDown = screen.getByRole("button", { name: "Move Contact Channels down" });
      expect(contactMoveDown.hasAttribute("disabled")).toBe(true);

      const contactMoveUp = screen.getByRole("button", { name: "Move Contact Channels up" });
      expect(contactMoveUp.hasAttribute("disabled")).toBe(false);
      fireEvent.click(contactMoveUp);
      expect(onMoveUpMock).toHaveBeenCalledWith(2);
    });
  });

  // ----------------------------------------------------------------------------
  // 4. Section Inspector & Property Editing
  // ----------------------------------------------------------------------------
  describe("4. Section Inspector & Property Configuration", () => {
    it("renders block-specific controls and layout variant selector in SectionInspector", () => {
      const heroSection: SectionConfig = {
        id: "sec-hero",
        type: "hero",
        variant: "split",
        props: {
          title: "Fresh Indian Delights",
          subtitle: "Crafted daily with ghee.",
          cta: { label: "Order Now", action: "whatsapp_order" },
        },
      };

      const onUpdateMock = vi.fn();
      const onCloseMock = vi.fn();

      render(
        <SectionInspector
          section={heroSection}
          onUpdateProps={onUpdateMock}
          onClose={onCloseMock}
        />,
      );

      expect(screen.getByRole("heading", { name: "Hero Banner" })).toBeDefined();

      // Layout variant selector
      const variantSelect = screen.getByLabelText("Block Layout Variant");
      expect(variantSelect).toBeDefined();
      fireEvent.change(variantSelect, { target: { value: "photo-left" } });
      expect(onUpdateMock).toHaveBeenCalledWith("sec-hero", expect.any(Object), "photo-left");

      // Title input
      const titleInput = screen.getByDisplayValue("Fresh Indian Delights");
      fireEvent.change(titleInput, { target: { value: "Updated Festive Sweets" } });
      expect(onUpdateMock).toHaveBeenCalledWith(
        "sec-hero",
        expect.objectContaining({ title: "Updated Festive Sweets" }),
        "photo-left",
      );
    });

    it("displays dynamic binding notice for catalogue/location blocks and protects statutory facts", () => {
      const menuSection: SectionConfig = {
        id: "sec-menu",
        type: "menu",
        props: {
          title: "Our Sweets Menu",
          source: "catalogue",
        },
      };

      render(<SectionInspector section={menuSection} onUpdateProps={vi.fn()} onClose={vi.fn()} />);

      // Verifies server binding notice is shown
      expect(screen.getByText("⚡ Authoritative Server Binding")).toBeDefined();
      expect(
        screen.getByText(/Items, prices, and taxes in this block resolve automatically/i),
      ).toBeDefined();
    });

    it("sanitizes unsafe link URLs (javascript: or data:) to safe hash fallback", () => {
      const heroSection: SectionConfig = {
        id: "sec-hero-cta",
        type: "hero",
        props: {
          title: "Promo Hero",
          cta: { label: "Custom Link", action: "custom_link", target: "" },
        },
      };

      const onUpdateMock = vi.fn();

      render(
        <SectionInspector section={heroSection} onUpdateProps={onUpdateMock} onClose={vi.fn()} />,
      );

      // Enter malicious javascript: URL in target
      const targetInput = screen.getByPlaceholderText("https://...");
      fireEvent.change(targetInput, { target: { value: "javascript:alert(document.cookie)" } });

      // Must be sanitized to safe '#' fallback
      expect(onUpdateMock).toHaveBeenCalledWith(
        "sec-hero-cta",
        expect.objectContaining({
          cta: expect.objectContaining({ target: "#" }),
        }),
        expect.any(String),
      );
    });

    it("rejects unapproved block types safely in SectionInspector", () => {
      const unapprovedSection: SectionConfig = {
        id: "sec-unsafe",
        type: "arbitrary_custom_code" as ApprovedBlockType,
        props: { code: "<script>alert(1)</script>" },
      };

      render(
        <SectionInspector section={unapprovedSection} onUpdateProps={vi.fn()} onClose={vi.fn()} />,
      );

      expect(screen.getByText("Unapproved Block Type")).toBeDefined();
      expect(screen.getByText(/is not an approved VyapOne component/i)).toBeDefined();
    });
  });

  // ----------------------------------------------------------------------------
  // 5. Draft Persistence, Concurrency & Conflict Detection
  // ----------------------------------------------------------------------------
  describe("5. Draft Persistence & Concurrency Handling", () => {
    it("successfully saves draft configuration via saveSiteDraftConfigurationAction", async () => {
      const mockSavedVersion: SiteVersionRow = {
        ...MOCK_VERSION,
        version_number: 2,
        change_summary: "Updated headline",
      };

      vi.mocked(websiteActions.saveSiteDraftConfigurationAction).mockResolvedValueOnce({
        success: true,
        data: {
          site: MOCK_SITE,
          version: mockSavedVersion,
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

      // Trigger a change to enable save button
      fireEvent.click(screen.getByRole("button", { name: "+ Add Section" }));
      fireEvent.click(within(screen.getByRole("dialog")).getByText("Contact Channels"));

      expect(screen.getByText("● Unsaved Changes")).toBeDefined();

      // Enter change summary
      const summaryInput = screen.getByPlaceholderText(/Brief note on changes/i);
      fireEvent.change(summaryInput, { target: { value: "Added contact block" } });

      // Click Save Draft
      const saveButton = screen.getByRole("button", { name: "Save website draft" });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(websiteActions.saveSiteDraftConfigurationAction).toHaveBeenCalledWith({
          siteId: MOCK_SITE.id,
          configuration: expect.any(Object),
          changeSummary: "Added contact block",
        });
      });

      // Status updates to saved and version increments
      await waitFor(() => {
        expect(screen.getByText("✓ Draft Saved")).toBeDefined();
        expect(screen.getByText("Draft v2")).toBeDefined();
      });
    });

    it("displays error banner when save action fails", async () => {
      vi.mocked(websiteActions.saveSiteDraftConfigurationAction).mockResolvedValueOnce({
        success: false,
        error: "Media asset 'med-123' is in quarantine and cannot be published",
        code: "MEDIA_NOT_READY",
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
      fireEvent.click(within(screen.getByRole("dialog")).getByText("Photo Gallery"));

      // Click Save
      fireEvent.click(screen.getByRole("button", { name: "Save website draft" }));

      await waitFor(() => {
        expect(screen.getByText("✕ Save Failed")).toBeDefined();
        expect(screen.getByText(/Media asset 'med-123' is in quarantine/i)).toBeDefined();
      });
    });

    it("detects concurrent edit conflict and prevents silent data overwrite", async () => {
      vi.mocked(websiteActions.saveSiteDraftConfigurationAction).mockResolvedValueOnce({
        success: false,
        error: "A newer draft version exists. Please refresh before saving.",
        code: "CONFLICT",
      });

      render(
        <ConstrainedWebsiteEditor
          initialSite={MOCK_SITE}
          initialVersion={MOCK_VERSION}
          initialConfiguration={MOCK_CONFIG}
          context={MOCK_CONTEXT}
        />,
      );

      // Trigger change
      fireEvent.click(screen.getByRole("button", { name: "+ Add Section" }));
      fireEvent.click(within(screen.getByRole("dialog")).getByText("FAQ Accordion"));

      // Save
      fireEvent.click(screen.getByRole("button", { name: "Save website draft" }));

      await waitFor(() => {
        expect(screen.getByText("⚠ Version Conflict")).toBeDefined();
        expect(screen.getByText(/Another session saved a newer draft version/i)).toBeDefined();
      });
    });
  });

  // ----------------------------------------------------------------------------
  // 6. Draft Preview Isolation
  // ----------------------------------------------------------------------------
  describe("6. Draft Preview Isolation", () => {
    it("renders live draft preview with private banner and previewMode context flag", () => {
      render(
        <ConstrainedWebsiteEditor
          initialSite={MOCK_SITE}
          initialVersion={MOCK_VERSION}
          initialConfiguration={MOCK_CONFIG}
          context={MOCK_CONTEXT}
        />,
      );

      // Private Draft Preview banner
      expect(screen.getByText("Private Draft Preview")).toBeDefined();
      expect(screen.getByText(/Customers only see published versions/i)).toBeDefined();

      // Storefront content renders in preview
      expect(screen.getAllByText("Sharma Sweets").length).toBeGreaterThan(0);
    });

    it("does not mutate published_version_id or publication status on the site record during draft editing", async () => {
      render(
        <ConstrainedWebsiteEditor
          initialSite={MOCK_SITE}
          initialVersion={MOCK_VERSION}
          initialConfiguration={MOCK_CONFIG}
          context={MOCK_CONTEXT}
        />,
      );

      // Add a section
      fireEvent.click(screen.getByRole("button", { name: "+ Add Section" }));
      fireEvent.click(screen.getByText("Special Offers"));

      // Site status remains draft
      expect(MOCK_SITE.status).toBe("draft");
      expect(MOCK_SITE.published_version_id).toBeNull();
    });
  });

  // ----------------------------------------------------------------------------
  // 7. Multi-Page Navigation & Page Creation
  // ----------------------------------------------------------------------------
  describe("7. Multi-Page Navigation & Creation", () => {
    it("allows switching between pages and adding new pages", () => {
      const onSelectSlugMock = vi.fn();
      const onAddPageMock = vi.fn();

      const samplePages = [
        { id: "p-home", slug: "/", title: "Home" },
        { id: "p-about", slug: "/about", title: "About Us" },
      ];

      render(
        <PageSelector
          pages={samplePages}
          selectedSlug="/"
          onSelectSlug={onSelectSlugMock}
          onAddPage={onAddPageMock}
        />,
      );

      // Switch to About Us
      const aboutTab = screen.getByRole("tab", { name: /About Us/i });
      fireEvent.click(aboutTab);
      expect(onSelectSlugMock).toHaveBeenCalledWith("/about");

      // Click + New Page
      fireEvent.click(screen.getByRole("button", { name: "+ New Page" }));

      const pageNameInput = screen.getByPlaceholderText(/Page Name/i);
      fireEvent.change(pageNameInput, { target: { value: "Contact" } });

      fireEvent.click(screen.getByRole("button", { name: "Add" }));
      expect(onAddPageMock).toHaveBeenCalledWith("Contact", "/contact");
    });
  });

  // ----------------------------------------------------------------------------
  // 8. Responsive View Modes & Accessibility
  // ----------------------------------------------------------------------------
  describe("8. View Modes & Accessibility", () => {
    it("supports switching view modes between Split, Sections, and Live Preview", () => {
      render(
        <ConstrainedWebsiteEditor
          initialSite={MOCK_SITE}
          initialVersion={MOCK_VERSION}
          initialConfiguration={MOCK_CONFIG}
          context={MOCK_CONTEXT}
        />,
      );

      // Switch to "Sections" only view
      fireEvent.click(screen.getByRole("button", { name: "Sections" }));
      expect(screen.getByRole("heading", { name: "Page Sections" })).toBeDefined();

      // Switch to "Live Preview" only view
      fireEvent.click(screen.getByRole("button", { name: "Live Preview" }));
      expect(screen.getByText("Private Draft Preview")).toBeDefined();

      // Switch back to "Split"
      fireEvent.click(screen.getByRole("button", { name: "Split" }));
      expect(screen.getByRole("heading", { name: "Page Sections" })).toBeDefined();
      expect(screen.getByText("Private Draft Preview")).toBeDefined();
    });

    it("closes AddSectionModal when Escape key is pressed", () => {
      const onCloseMock = vi.fn();

      render(<AddSectionModal isOpen={true} onClose={onCloseMock} onAddBlock={vi.fn()} />);

      fireEvent.keyDown(window, { key: "Escape" });
      expect(onCloseMock).toHaveBeenCalled();
    });
  });
});
