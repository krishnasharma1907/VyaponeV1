import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock server-only module for Client Component tests in Vitest jsdom
vi.mock("server-only", () => ({}));

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CreateBusinessWizard } from "@/components/businesses/create-business-wizard";
import type { NicheGroupSummary, NicheSummary } from "@/lib/niches/types";
import * as businessActions from "@/lib/businesses/actions";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

vi.mock("@/lib/businesses/actions", () => ({
  createBusinessWithSetupAction: vi.fn(),
  getBusinessSetupDraftAction: vi.fn(),
}));

const mockNicheGroups: NicheGroupSummary[] = [
  {
    id: "grp-1",
    slug: "food_hospitality",
    name: "Food & Hospitality",
    description: "Restaurants and cafes",
    displayOrder: 10,
    status: "active",
  },
  {
    id: "grp-2",
    slug: "beauty_wellness_fitness",
    name: "Beauty & Wellness",
    description: "Salons and spas",
    displayOrder: 20,
    status: "active",
  },
];

const mockNiches: NicheSummary[] = [
  {
    id: "niche-1",
    nicheGroupId: "grp-1",
    nicheGroupSlug: "food_hospitality",
    slug: "restaurant",
    name: "Restaurant & Dine-in",
    description: "Fine dining and casual restaurants",
    availabilityLabel: "live_operational",
    manifestVersion: "v1",
    displayOrder: 10,
    status: "active",
  },
  {
    id: "niche-2",
    nicheGroupId: "grp-1",
    nicheGroupSlug: "food_hospitality",
    slug: "cafe",
    name: "Café & Bakery",
    description: "Coffee shops and bakeries",
    availabilityLabel: "live_operational",
    manifestVersion: "v1",
    displayOrder: 20,
    status: "active",
  },
  {
    id: "niche-3",
    nicheGroupId: "grp-2",
    nicheGroupSlug: "beauty_wellness_fitness",
    slug: "salon",
    name: "Salon & Spa",
    description: "Hair and beauty salons",
    availabilityLabel: "live_operational",
    manifestVersion: "v1",
    displayOrder: 30,
    status: "active",
  },
];

describe("VO-033 CreateBusinessWizard Component (Mobile-First 390px, Steps, Draft Resume)", () => {
  const workspaceId = "22222222-2222-4222-8222-222222222222";

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    if (typeof window !== "undefined") {
      window.scrollTo = vi.fn();
    }
  });

  it("renders Step 1 (Niche Selection) with search, industry filter chips, and ready badges", () => {
    render(
      <CreateBusinessWizard
        workspaceId={workspaceId}
        nicheGroups={mockNicheGroups}
        niches={mockNiches}
      />,
    );

    // Header step indicator
    expect(screen.getByText("Step 1 of 5")).toBeDefined();
    expect(screen.getByRole("heading", { name: "Niche Selection" })).toBeDefined();

    // Industry tab chips
    expect(screen.getByRole("tab", { name: /all industries/i })).toBeDefined();
    expect(screen.getByRole("tab", { name: /food & hospitality/i })).toBeDefined();

    // Niches rendered
    expect(screen.getByText("Restaurant & Dine-in")).toBeDefined();
    expect(screen.getByText("Café & Bakery")).toBeDefined();
    expect(screen.getAllByText("Ready to Launch").length).toBeGreaterThan(0);
  });

  it("filters displayed niches when typing in the search box", () => {
    render(
      <CreateBusinessWizard
        workspaceId={workspaceId}
        nicheGroups={mockNicheGroups}
        niches={mockNiches}
      />,
    );

    const searchInput = screen.getByRole("searchbox", { name: /search business niches/i });
    fireEvent.change(searchInput, { target: { value: "bakery" } });

    expect(screen.getByText("Café & Bakery")).toBeDefined();
    expect(screen.queryByText("Salon & Spa")).toBeNull();
  });

  it("navigates through steps 1 -> 2 -> 3 -> 4 -> 5 with preserved inputs", async () => {
    render(
      <CreateBusinessWizard
        workspaceId={workspaceId}
        nicheGroups={mockNicheGroups}
        niches={mockNiches}
      />,
    );

    // Step 1: Select Café
    const cafeCard = screen.getByRole("radio", { name: /café & bakery/i });
    fireEvent.click(cafeCard);

    const continueBtn1 = screen.getByRole("button", { name: /continue to basic facts/i });
    expect(continueBtn1).toBeDefined();
    fireEvent.click(continueBtn1);

    // Step 2: Basic Facts
    await waitFor(() => {
      expect(screen.getByText("Step 2 of 5")).toBeDefined();
    });

    const tradeNameInput = screen.getByLabelText(/trade name \/ store name/i);
    fireEvent.change(tradeNameInput, { target: { value: "Blue Tokai Coffee" } });

    const addressInput = screen.getByLabelText(/address line 1/i);
    fireEvent.change(addressInput, { target: { value: "80 Feet Road, Koramangala" } });

    const cityInput = screen.getByLabelText(/city/i);
    fireEvent.change(cityInput, { target: { value: "Bengaluru" } });

    const stateInput = screen.getByLabelText(/state/i);
    fireEvent.change(stateInput, { target: { value: "Karnataka" } });

    const pinInput = screen.getByLabelText(/pin code/i);
    fireEvent.change(pinInput, { target: { value: "560034" } });

    const continueBtn2 = screen.getByRole("button", { name: /continue to media/i });
    fireEvent.click(continueBtn2);

    // Step 3: Media
    await waitFor(() => {
      expect(screen.getByText("Step 3 of 5")).toBeDefined();
      expect(screen.getByText(/media & storefront assets/i)).toBeDefined();
    });

    const continueBtn3 = screen.getByRole("button", { name: /continue to questions/i });
    fireEvent.click(continueBtn3);

    // Step 4: Questions
    await waitFor(() => {
      expect(screen.getByText("Step 4 of 5")).toBeDefined();
      expect(screen.getByText(/setup questions/i)).toBeDefined();
    });

    // Fill required question for cafe
    const specialtyInput = screen.getByLabelText(/beverage specialties/i);
    fireEvent.change(specialtyInput, { target: { value: "Espresso, cold brew, and matcha" } });

    const continueBtn4 = screen.getByRole("button", { name: /review & proposal/i });
    fireEvent.click(continueBtn4);

    // Step 5: Proposal Review
    await waitFor(() => {
      expect(screen.getByText("Step 5 of 5")).toBeDefined();
      expect(screen.getByRole("heading", { name: "Review Setup Proposal" })).toBeDefined();
      expect(screen.getByText("Blue Tokai Coffee")).toBeDefined();
      expect(screen.getByText(/80 Feet Road, Koramangala/)).toBeDefined();
    });

    // Check proposal CTA button
    const buildBtn = screen.getByRole("button", { name: /looks good, build it/i });
    expect(buildBtn).toBeDefined();
  });

  it("loads and resumes draft from localStorage when resume button is clicked", async () => {
    // Pre-populate draft in localStorage
    const savedDraft = {
      version: "1.0",
      step: 2,
      data: {
        niche_slug: "cafe",
        niche_group_slug: "food_hospitality",
        niche_name: "Café & Bakery",
        trade_name: "Third Wave Roasters",
        legal_name: "Third Wave Coffee LLP",
        slug: "third-wave-roasters",
        description: "Specialty coffee roastery",
        location_name: "Main Store",
        address_line1: "100 Feet Road",
        address_line2: "Opposite KFC",
        city: "Bengaluru",
        state: "Karnataka",
        postal_code: "560038",
        primary_phone: "+919876543210",
        whatsapp_number: "+919876543210",
        email: "contact@thirdwave.in",
        gst_number: "",
        pan_number: "",
        tax_scheme: "unregistered",
        logo_media_id: null,
        logo_preview_url: null,
        showcase_media_ids: [],
        showcase_preview_urls: [],
        onboarding_answers: {},
      },
      savedAt: new Date().toISOString(),
      workspaceId,
    };

    window.localStorage.setItem(`vyapone_client_draft_${workspaceId}`, JSON.stringify(savedDraft));

    render(
      <CreateBusinessWizard
        workspaceId={workspaceId}
        nicheGroups={mockNicheGroups}
        niches={mockNiches}
      />,
    );

    // Banner should prompt to resume
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeDefined();
      expect(screen.getByText(/unsaved setup draft available/i)).toBeDefined();
      expect(screen.getByText(/Third Wave Roasters/i)).toBeDefined();
    });

    const resumeBtn = screen.getByRole("button", { name: /resume draft/i });
    fireEvent.click(resumeBtn);

    // Step 2 should now be active with populated trade name
    await waitFor(() => {
      expect(screen.getByText("Step 2 of 5")).toBeDefined();
      const input = screen.getByLabelText(/trade name \/ store name/i) as HTMLInputElement;
      expect(input.value).toBe("Third Wave Roasters");
    });
  });

  it("submits the setup and calls onSuccess handler with generated business details", async () => {
    const onSuccess = vi.fn();
    vi.mocked(businessActions.createBusinessWithSetupAction).mockResolvedValueOnce({
      success: true,
      data: {
        business: {
          id: "biz-new-uuid",
          trade_name: "Artisan Coffee",
          slug: "artisan-coffee",
        } as never,
        primaryLocation: {
          id: "loc-new-uuid",
          name: "Main Store",
          is_primary: true,
        } as never,
        nicheSlug: "cafe",
        isComplete: true,
        missingFields: [],
      },
    });

    render(
      <CreateBusinessWizard
        workspaceId={workspaceId}
        nicheGroups={mockNicheGroups}
        niches={mockNiches}
        initialNicheSlug="cafe"
        onSuccess={onSuccess}
      />,
    );

    // Directly navigate through
    const continueBtn1 = screen.getByRole("button", { name: /continue to basic facts/i });
    fireEvent.click(continueBtn1);

    await waitFor(() => screen.getByLabelText(/trade name \/ store name/i));
    fireEvent.change(screen.getByLabelText(/trade name \/ store name/i), {
      target: { value: "Artisan Coffee" },
    });
    fireEvent.change(screen.getByLabelText(/address line 1/i), {
      target: { value: "12 MG Road" },
    });
    fireEvent.change(screen.getByLabelText(/city/i), { target: { value: "Bengaluru" } });
    fireEvent.change(screen.getByLabelText(/state/i), { target: { value: "Karnataka" } });
    fireEvent.change(screen.getByLabelText(/pin code/i), { target: { value: "560001" } });

    fireEvent.click(screen.getByRole("button", { name: /continue to media/i }));
    await waitFor(() => screen.getByRole("button", { name: /continue to questions/i }));
    fireEvent.click(screen.getByRole("button", { name: /continue to questions/i }));

    await waitFor(() => screen.getByRole("button", { name: /review & proposal/i }));
    fireEvent.change(screen.getByLabelText(/beverage specialties/i), {
      target: { value: "Artisan Pour-over" },
    });
    fireEvent.click(screen.getByRole("button", { name: /review & proposal/i }));

    await waitFor(() => screen.getByRole("button", { name: /looks good, build it/i }));
    const buildBtn = screen.getByRole("button", { name: /looks good, build it/i });
    fireEvent.click(buildBtn);

    await waitFor(() => {
      expect(businessActions.createBusinessWithSetupAction).toHaveBeenCalledTimes(1);
      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId: "biz-new-uuid",
          tradeName: "Artisan Coffee",
        }),
      );
    });
  });
});
