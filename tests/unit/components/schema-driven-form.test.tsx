import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { SchemaDrivenForm } from "@/components/niches/schema-driven-form";
import type { NicheManifest } from "@/lib/niches/types";

describe("VO-031 SchemaDrivenForm Component", () => {
  const testManifest: NicheManifest = {
    version: "v1",
    nicheGroupSlug: "food_hospitality",
    nicheSlug: "test_cafe",
    name: "Cozy Corner Café",
    availabilityLabel: "live_operational",
    modules: {
      defaultEnabled: ["website_engine"],
      recommended: [],
    },
    dashboardNavigation: [],
    onboarding: {
      requiredQuestions: [
        {
          key: "cafe_name",
          label: "Café Name",
          type: "text",
          required: true,
          placeholder: "Enter café name",
          group: "profile",
          displayOrder: 10,
        },
        {
          key: "offers_delivery",
          label: "Offer Delivery?",
          type: "boolean",
          required: true,
          defaultValue: false,
          group: "operations",
          displayOrder: 20,
        },
        {
          key: "delivery_radius",
          label: "Delivery Radius (km)",
          type: "number",
          required: true,
          condition: { dependsOn: "offers_delivery", operator: "equals", value: true },
          validation: { min: 1, max: 30 },
          group: "operations",
          displayOrder: 30,
        },
      ],
    },
  };

  it("renders the manifest name and initial questions", () => {
    render(<SchemaDrivenForm manifest={testManifest} />);

    expect(screen.getByText("Cozy Corner Café")).toBeDefined();
    expect(screen.getByLabelText(/Café Name/i)).toBeDefined();
    expect(screen.getByLabelText(/Offer Delivery\?/i)).toBeDefined();

    // Delivery radius should be hidden initially because offers_delivery is false
    expect(screen.queryByLabelText(/Delivery Radius/i)).toBeNull();
  });

  it("dynamically shows dependent question when condition is fulfilled", () => {
    render(<SchemaDrivenForm manifest={testManifest} />);

    // Initially hidden
    expect(screen.queryByLabelText(/Delivery Radius/i)).toBeNull();

    // Toggle the "Offer Delivery?" checkbox
    const deliveryCheckbox = screen.getByLabelText(/Offer Delivery\?/i);
    fireEvent.click(deliveryCheckbox);

    // Now Delivery Radius should appear
    expect(screen.getByLabelText(/Delivery Radius/i)).toBeDefined();
  });

  it("dynamically hides dependent question when condition is toggled off", () => {
    render(
      <SchemaDrivenForm
        manifest={testManifest}
        initialAnswers={{
          cafe_name: "Morning Brew",
          offers_delivery: true,
          delivery_radius: 5,
        }}
      />,
    );

    // Initially visible
    expect(screen.getByLabelText(/Delivery Radius/i)).toBeDefined();

    // Toggle off
    const deliveryCheckbox = screen.getByLabelText(/Offer Delivery\?/i);
    fireEvent.click(deliveryCheckbox);

    // Delivery radius should now be hidden
    expect(screen.queryByLabelText(/Delivery Radius/i)).toBeNull();
  });

  it("displays validation error when submitting with an invalid value", async () => {
    render(
      <SchemaDrivenForm
        manifest={testManifest}
        initialAnswers={{
          cafe_name: "Morning Brew",
          offers_delivery: true,
          delivery_radius: 100, // Out of range! Max is 30
        }}
      />,
    );

    const submitBtn = screen.getByRole("button", { name: /Save Onboarding Progress/i });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(screen.getByText(/cannot exceed 30/i)).toBeDefined();
  });

  it("calls onSave with sanitized answers when valid form is submitted", async () => {
    const handleSave = vi.fn();

    render(
      <SchemaDrivenForm
        manifest={testManifest}
        initialAnswers={{
          cafe_name: "Morning Brew",
          offers_delivery: false,
          delivery_radius: 15, // Stale data that should be stripped!
        }}
        onSave={handleSave}
      />,
    );

    const submitBtn = screen.getByRole("button", { name: /Save Onboarding Progress/i });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(handleSave).toHaveBeenCalledWith(
      expect.objectContaining({
        cafe_name: "Morning Brew",
        offers_delivery: false,
      }),
      expect.objectContaining({
        isComplete: true,
      }),
    );

    // Stale delivery_radius must NOT be in sanitizedAnswers
    const submittedAnswers = handleSave.mock.calls[0]?.[0];
    expect(submittedAnswers?.delivery_radius).toBeUndefined();
  });
});
