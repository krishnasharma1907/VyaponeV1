import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ImportUploadStep } from "@/components/businesses/import-review/import-upload-step";
import { ImportStatsBanner } from "@/components/businesses/import-review/import-stats-banner";
import { ImportFieldRow } from "@/components/businesses/import-review/import-field-row";
import type { ImportProposalStats, ImportReviewField } from "@/lib/businesses/import/types";

describe("VO-034 Business Import Review UI Components", () => {
  describe("1. ImportUploadStep", () => {
    it("renders upload card with format selectors and sample load buttons", () => {
      const handleParse = vi.fn();
      render(<ImportUploadStep onParse={handleParse} isLoading={false} />);

      expect(screen.getByText("Import Business Data & Catalogue")).toBeDefined();
      expect(screen.getByText("JSON Export")).toBeDefined();
      expect(screen.getByText("CSV / Menu")).toBeDefined();
      expect(screen.getByText("Load Sample JSON")).toBeDefined();
      expect(screen.getByText("Load Sample Menu CSV")).toBeDefined();
    });

    it("populates textarea when Load Sample JSON is clicked", () => {
      const handleParse = vi.fn();
      render(<ImportUploadStep onParse={handleParse} isLoading={false} />);

      const sampleBtn = screen.getByText("Load Sample JSON");
      fireEvent.click(sampleBtn);

      const textarea = screen.getByLabelText(/Or Paste Content Directly/i) as HTMLTextAreaElement;
      expect(textarea.value).toContain("Chai & Chaska Café");
    });

    it("triggers onParse with content and format on submit", () => {
      const handleParse = vi.fn();
      render(<ImportUploadStep onParse={handleParse} isLoading={false} />);

      const sampleBtn = screen.getByText("Load Sample JSON");
      fireEvent.click(sampleBtn);

      const submitBtn = screen.getByText(/Extract & Review Facts/i);
      fireEvent.click(submitBtn);

      expect(handleParse).toHaveBeenCalledWith(
        expect.stringContaining("Chai & Chaska Café"),
        "json",
        "sample-chai-chaska.json",
      );
    });
  });

  describe("2. ImportStatsBanner", () => {
    const sampleStats: ImportProposalStats = {
      totalFields: 10,
      confirmedCount: 4,
      unconfirmedCount: 5,
      rejectedCount: 1,
      editedCount: 0,
      materialTotalCount: 3,
      materialUnconfirmedCount: 2,
      requiredTotalCount: 4,
      requiredUnconfirmedCount: 1,
      hasErrors: false,
      completionPercentage: 50,
    };

    it("displays numerical indicators for total, to-confirm, confirmed, and material unconfirmed", () => {
      render(
        <ImportStatsBanner
          stats={sampleStats}
          currentFilter="all"
          onFilterChange={vi.fn()}
          onConfirmAllHighConfidence={vi.fn()}
        />,
      );

      expect(screen.getByText("Review Extracted Facts")).toBeDefined();
      expect(screen.getByText("10")).toBeDefined(); // Total
      expect(screen.getByText("5")).toBeDefined(); // To Confirm
      expect(screen.getByText("4")).toBeDefined(); // Confirmed
      expect(screen.getByText("2")).toBeDefined(); // Material unconfirmed
      expect(screen.getByText("50% Complete")).toBeDefined();
    });

    it("calls onConfirmAllHighConfidence when action button is clicked", () => {
      const handleBulkConfirm = vi.fn();
      render(
        <ImportStatsBanner
          stats={sampleStats}
          currentFilter="all"
          onFilterChange={vi.fn()}
          onConfirmAllHighConfidence={handleBulkConfirm}
        />,
      );

      const bulkBtn = screen.getByText("✓ Accept All High-Confidence");
      fireEvent.click(bulkBtn);
      expect(handleBulkConfirm).toHaveBeenCalled();
    });
  });

  describe("3. ImportFieldRow", () => {
    const sampleField: ImportReviewField = {
      id: "item:0",
      category: "catalogue",
      fieldName: "catalogue_item",
      label: "Catalogue Item: Samosa",
      rawValue: "Samosa - 20",
      extractedValue: { title: "Samosa", priceMinor: 2000, currencyCode: "INR" },
      sourceEvidence: "Line 4: Samosa, 20.00",
      confidence: "high",
      confidenceScore: 0.95,
      status: "unconfirmed",
      isMaterial: true,
      isRequired: false,
    };

    it("renders field details, price display, material fact indicator, and evidence citation", () => {
      render(<ImportFieldRow field={sampleField} onStatusChange={vi.fn()} />);

      expect(screen.getByText("Catalogue Item: Samosa")).toBeDefined();
      expect(screen.getByText("Material Fact")).toBeDefined();
      expect(screen.getByText("To Confirm")).toBeDefined();
      expect(screen.getByText(/Evidence: Line 4: Samosa, 20.00/i)).toBeDefined();
    });

    it("emits onStatusChange with 'confirmed' when Confirm button is tapped", () => {
      const handleStatusChange = vi.fn();
      render(<ImportFieldRow field={sampleField} onStatusChange={handleStatusChange} />);

      const confirmBtn = screen.getByText("✓ Confirm");
      fireEvent.click(confirmBtn);

      expect(handleStatusChange).toHaveBeenCalledWith("item:0", "confirmed");
    });

    it("emits onStatusChange with 'rejected' when Reject button is tapped", () => {
      const handleStatusChange = vi.fn();
      render(<ImportFieldRow field={sampleField} onStatusChange={handleStatusChange} />);

      const rejectBtn = screen.getByText("Reject");
      fireEvent.click(rejectBtn);

      expect(handleStatusChange).toHaveBeenCalledWith("item:0", "rejected");
    });
  });
});
