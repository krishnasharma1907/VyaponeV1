import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock server-only module for Client Component tests
vi.mock("server-only", () => ({}));

// Mock Server Actions
vi.mock("@/lib/businesses/actions", () => ({
  createBusinessAction: vi.fn(),
  updateBusinessProfileAction: vi.fn(),
  createLocationAction: vi.fn(),
  updateLocationAction: vi.fn(),
}));

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  BusinessCreateForm,
  BusinessProfileForm,
  LocationCard,
  LocationForm,
  BusinessSwitcher,
} from "@/components/businesses";
import {
  createBusinessAction,
  updateBusinessProfileAction,
  createLocationAction,
} from "@/lib/businesses/actions";
import type { BusinessRow, LocationRow, BusinessSummary } from "@/lib/businesses/types";

describe("Business UI Components [VO-023]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("BusinessCreateForm", () => {
    it("renders all essential store and primary location fields", () => {
      render(<BusinessCreateForm />);

      expect(screen.getByRole("heading", { name: "Create Business", level: 2 })).toBeTruthy();
      expect(screen.getByLabelText(/Trade Name \/ Brand/)).toBeTruthy();
      expect(screen.getByLabelText(/Legal Business Name/)).toBeTruthy();
      expect(screen.getByLabelText(/URL Slug/)).toBeTruthy();
      expect(screen.getByLabelText(/Location Name/)).toBeTruthy();
      expect(screen.getByLabelText(/Address Line 1/)).toBeTruthy();
      expect(screen.getByLabelText(/City/)).toBeTruthy();
      expect(screen.getByLabelText(/State/)).toBeTruthy();
      expect(screen.getByLabelText(/PIN Code/)).toBeTruthy();
      expect(screen.getByRole("button", { name: "Create Business" })).toBeTruthy();
    });

    it("displays error alert when createBusinessAction fails", async () => {
      vi.mocked(createBusinessAction).mockResolvedValueOnce({
        success: false,
        error: "A business with this slug already exists",
        code: "SLUG_CONFLICT",
      });

      render(<BusinessCreateForm />);

      fireEvent.change(screen.getByLabelText(/Trade Name \/ Brand/), {
        target: { value: "Store A" },
      });
      fireEvent.change(screen.getByLabelText(/Legal Business Name/), {
        target: { value: "Store A Ltd" },
      });
      fireEvent.change(screen.getByLabelText(/Address Line 1/), { target: { value: "123 Road" } });
      fireEvent.change(screen.getByLabelText(/City/), { target: { value: "Bengaluru" } });
      fireEvent.change(screen.getByLabelText(/State/), { target: { value: "Karnataka" } });
      fireEvent.change(screen.getByLabelText(/PIN Code/), { target: { value: "560001" } });

      fireEvent.click(screen.getByRole("button", { name: "Create Business" }));

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeTruthy();
        expect(screen.getByText("A business with this slug already exists")).toBeTruthy();
      });
    });

    it("triggers onSuccess callback on successful submission", async () => {
      const onSuccess = vi.fn();
      vi.mocked(createBusinessAction).mockResolvedValueOnce({
        success: true,
        data: {
          business: { id: "biz-1", trade_name: "Store A" } as BusinessRow,
          primaryLocation: { id: "loc-1", name: "Main Store" } as LocationRow,
          locations: [],
          currentUserRole: "owner",
          isSovereignOwner: true,
        },
      });

      render(<BusinessCreateForm onSuccess={onSuccess} />);

      fireEvent.change(screen.getByLabelText(/Trade Name \/ Brand/), {
        target: { value: "Store A" },
      });
      fireEvent.change(screen.getByLabelText(/Legal Business Name/), {
        target: { value: "Store A Ltd" },
      });
      fireEvent.change(screen.getByLabelText(/Address Line 1/), { target: { value: "123 Road" } });
      fireEvent.change(screen.getByLabelText(/City/), { target: { value: "Bengaluru" } });
      fireEvent.change(screen.getByLabelText(/State/), { target: { value: "Karnataka" } });
      fireEvent.change(screen.getByLabelText(/PIN Code/), { target: { value: "560001" } });

      fireEvent.click(screen.getByRole("button", { name: "Create Business" }));

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledTimes(1);
      });
    });

    it("triggers onCancel when Cancel button is clicked", () => {
      const onCancel = vi.fn();
      render(<BusinessCreateForm onCancel={onCancel} />);

      const cancelBtn = screen.getByRole("button", { name: "Cancel" });
      fireEvent.click(cancelBtn);
      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe("BusinessProfileForm", () => {
    const mockBusiness: BusinessRow = {
      id: "biz-001",
      workspace_id: null,
      legal_name: "Sharma Enterprises Pvt Ltd",
      trade_name: "Sharma Kirana",
      slug: "sharma-kirana",
      gst_number: "29AAAAA0000A1Z5",
      pan_number: "AAAAA0000A",
      status: "active",
      currency_code: "INR",
      sovereign_owner_id: "usr-001",
      created_at: "2026-11-13T00:00:00.000Z",
      updated_at: "2026-11-13T00:00:00.000Z",
    };

    it("renders store details and sovereign owner badge", () => {
      render(
        <BusinessProfileForm
          business={mockBusiness}
          currentUserRole="owner"
          isSovereignOwner={true}
        />,
      );

      expect(
        screen.getByRole("heading", { name: "Store Identity & Statutory Details", level: 2 }),
      ).toBeTruthy();
      expect(screen.getByText("SOVEREIGN OWNER")).toBeTruthy();
      expect(screen.getByDisplayValue("Sharma Kirana")).toBeTruthy();
      expect(screen.getByDisplayValue("Sharma Enterprises Pvt Ltd")).toBeTruthy();
    });

    it("disables input fields for staff members without edit permissions", () => {
      render(
        <BusinessProfileForm
          business={mockBusiness}
          currentUserRole="staff"
          isSovereignOwner={false}
        />,
      );

      const tradeNameInput = screen.getByLabelText(/Trade Name/) as HTMLInputElement;
      expect(tradeNameInput.disabled).toBe(true);
      expect(screen.queryByRole("button", { name: "Save Changes" })).toBeNull();
    });

    it("submits changes and shows success notice when owner saves", async () => {
      vi.mocked(updateBusinessProfileAction).mockResolvedValueOnce({
        success: true,
        data: { ...mockBusiness, trade_name: "Sharma Superstore" },
      });

      render(
        <BusinessProfileForm
          business={mockBusiness}
          currentUserRole="owner"
          isSovereignOwner={true}
        />,
      );

      fireEvent.change(screen.getByLabelText(/Trade Name/), {
        target: { value: "Sharma Superstore" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

      await waitFor(() => {
        expect(screen.getByRole("status")).toBeTruthy();
        expect(screen.getByText("Business details updated successfully")).toBeTruthy();
      });
    });
  });

  describe("LocationCard", () => {
    const mockLocation: LocationRow = {
      id: "loc-001",
      business_id: "biz-001",
      name: "Main Branch",
      slug: "main",
      address_line1: "100 MG Road",
      address_line2: "Near Metro",
      city: "Bengaluru",
      state: "Karnataka",
      postal_code: "560001",
      is_primary: true,
      created_at: "2026-11-13T00:00:00.000Z",
      updated_at: "2026-11-13T00:00:00.000Z",
    };

    it("renders location title, primary badge, and address formatting", () => {
      render(<LocationCard location={mockLocation} />);

      expect(screen.getByRole("heading", { name: "Main Branch", level: 3 })).toBeTruthy();
      expect(screen.getByText("PRIMARY STORE")).toBeTruthy();
      expect(screen.getByText("100 MG Road")).toBeTruthy();
      expect(screen.getByText("Near Metro")).toBeTruthy();
      expect(screen.getByText("Bengaluru, Karnataka — 560001")).toBeTruthy();
    });

    it("renders edit trigger when canEdit is true", () => {
      const onEdit = vi.fn();
      render(<LocationCard location={mockLocation} canEdit={true} onEdit={onEdit} />);

      const editBtn = screen.getByRole("button", { name: "Edit" });
      fireEvent.click(editBtn);
      expect(onEdit).toHaveBeenCalledWith(mockLocation);
    });
  });

  describe("LocationForm", () => {
    it("renders location inputs and submits new location", async () => {
      const onSuccess = vi.fn();
      vi.mocked(createLocationAction).mockResolvedValueOnce({
        success: true,
        data: {
          id: "loc-new",
          business_id: "biz-001",
          name: "Indiranagar",
          slug: "indiranagar",
          address_line1: "50 100ft Road",
          address_line2: null,
          city: "Bengaluru",
          state: "Karnataka",
          postal_code: "560038",
          is_primary: false,
          created_at: "2026-11-13T00:00:00.000Z",
          updated_at: "2026-11-13T00:00:00.000Z",
        },
      });

      render(<LocationForm businessId="biz-001" onSuccess={onSuccess} />);

      expect(screen.getByRole("heading", { name: "Add Store Location", level: 2 })).toBeTruthy();

      fireEvent.change(screen.getByLabelText(/Location Name/), {
        target: { value: "Indiranagar" },
      });
      fireEvent.change(screen.getByLabelText(/Address Line 1/), {
        target: { value: "50 100ft Road" },
      });
      fireEvent.change(screen.getByLabelText(/City/), { target: { value: "Bengaluru" } });
      fireEvent.change(screen.getByLabelText(/State/), { target: { value: "Karnataka" } });
      fireEvent.change(screen.getByLabelText(/PIN Code/), { target: { value: "560038" } });

      fireEvent.click(screen.getByRole("button", { name: "Add Location" }));

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("BusinessSwitcher", () => {
    const mockBusinesses: BusinessSummary[] = [
      {
        id: "biz-1",
        trade_name: "Sharma Kirana",
        legal_name: "Sharma Enterprises",
        slug: "sharma-kirana",
        status: "active",
        workspace_id: null,
        sovereign_owner_id: "usr-1",
        isPrimaryLocationConfigured: true,
        currentUserRole: "owner",
      },
      {
        id: "biz-2",
        trade_name: "Apex Electronics",
        legal_name: "Apex Retail Pvt Ltd",
        slug: "apex-electronics",
        status: "active",
        workspace_id: "ws-1",
        sovereign_owner_id: "usr-2",
        isPrimaryLocationConfigured: true,
        currentUserRole: "manager",
      },
    ];

    it("renders active business name and expands options list on click", () => {
      const onSelect = vi.fn();
      render(
        <BusinessSwitcher
          businesses={mockBusinesses}
          activeBusinessId="biz-1"
          onSelectBusiness={onSelect}
        />,
      );

      const trigger = screen.getByRole("button", { name: "Select active business" });
      expect(screen.getByText("Sharma Kirana")).toBeTruthy();

      fireEvent.click(trigger);

      expect(screen.getByRole("listbox")).toBeTruthy();
      expect(screen.getByText("Apex Electronics")).toBeTruthy();

      fireEvent.click(screen.getByText("Apex Electronics"));
      expect(onSelect).toHaveBeenCalledWith(mockBusinesses[1]);
    });

    it("triggers onCreateNew when '+ New Business' is clicked", () => {
      const onCreateNew = vi.fn();
      render(
        <BusinessSwitcher
          businesses={mockBusinesses}
          onSelectBusiness={vi.fn()}
          onCreateNew={onCreateNew}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "Select active business" }));
      const newBtn = screen.getByRole("button", { name: "+ New Business" });
      fireEvent.click(newBtn);

      expect(onCreateNew).toHaveBeenCalledTimes(1);
    });
  });
});
