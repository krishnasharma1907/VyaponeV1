import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import {
  confirmAllHighConfidenceFields,
  createImportProposal,
  executeConfirmedBusinessImport,
  updateProposalField,
} from "@/lib/businesses/import/service";
import type { ImportReviewField } from "@/lib/businesses/import/types";
import * as businessService from "@/lib/businesses/service";
import * as tenantAccess from "@/lib/auth/tenant-access";
import * as entitlementService from "@/lib/plans/service";
import * as auditService from "@/lib/audit/service";

describe("VO-034 Business Import Service Tests", () => {
  const workspaceId = "11111111-1111-4111-8111-111111111111";
  const callerUserId = "22222222-2222-4222-8222-222222222222";

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. Proposal Staging and Field Updates", () => {
    it("creates an unconfirmed proposal from valid JSON", async () => {
      const content = JSON.stringify({
        trade_name: "Artisan Bakery",
        primary_phone: "+919876543210",
        address_line1: "12 Baker Street",
        city: "Indore",
        state: "Madhya Pradesh",
        postal_code: "452001",
        items: [{ title: "Croissant", price: 60 }],
      });

      const proposal = await createImportProposal({
        workspaceId,
        content,
        format: "json",
        sourceFileName: "bakery.json",
      });

      expect(proposal.workspaceId).toBe(workspaceId);
      expect(proposal.isReadyForProvisioning).toBe(false);
      expect(proposal.stats.unconfirmedCount).toBeGreaterThan(0);
      expect(proposal.stats.confirmedCount).toBe(0);
    });

    it("updates field status on explicit human action (confirm, reject, edit)", async () => {
      const content = JSON.stringify({
        trade_name: "Artisan Bakery",
        address_line1: "12 Baker Street",
      });
      let proposal = await createImportProposal({ workspaceId, content, format: "json" });

      // Confirm trade_name
      proposal = updateProposalField(proposal, {
        fieldId: "field:trade_name",
        status: "confirmed",
      });
      const tradeField = proposal.fields.find((f) => f.id === "field:trade_name");
      expect(tradeField?.status).toBe("confirmed");
      expect(tradeField?.confirmedAt).toBeDefined();

      // Edit address_line1
      proposal = updateProposalField(proposal, {
        fieldId: "field:address_line1",
        status: "edited",
        editedValue: "14 Updated Street",
      });
      const addrField = proposal.fields.find((f) => f.id === "field:address_line1");
      expect(addrField?.status).toBe("edited");
      expect(addrField?.editedValue).toBe("14 Updated Street");
    });

    it("bulk confirms high confidence fields on user initiation", async () => {
      const content = JSON.stringify({
        trade_name: "Artisan Bakery",
        address_line1: "12 Baker Street",
        city: "Indore",
        state: "Madhya Pradesh",
        postal_code: "452001",
        primary_phone: "+919876543210",
      });
      const proposal = await createImportProposal({ workspaceId, content, format: "json" });
      expect(proposal.stats.confirmedCount).toBe(0);

      const bulkConfirmed = confirmAllHighConfidenceFields(proposal);
      expect(bulkConfirmed.stats.confirmedCount).toBeGreaterThan(0);
      expect(bulkConfirmed.stats.unconfirmedCount).toBeLessThan(proposal.stats.unconfirmedCount);
    });
  });

  describe("2. Confirmed Import Execution & Invariant Enforcement", () => {
    const buildConfirmedFields = (): ImportReviewField[] => [
      {
        id: "field:trade_name",
        category: "identity",
        fieldName: "trade_name",
        label: "Trade Name",
        rawValue: "Verified Bakery",
        extractedValue: "Verified Bakery",
        sourceEvidence: "json",
        confidence: "high",
        confidenceScore: 0.95,
        status: "confirmed",
        isMaterial: true,
        isRequired: true,
      },
      {
        id: "field:address_line1",
        category: "location",
        fieldName: "address_line1",
        label: "Street Address",
        rawValue: "100 MG Road",
        extractedValue: "100 MG Road",
        sourceEvidence: "json",
        confidence: "high",
        confidenceScore: 0.95,
        status: "confirmed",
        isMaterial: true,
        isRequired: true,
      },
      {
        id: "field:primary_phone",
        category: "contact",
        fieldName: "primary_phone",
        label: "Primary Phone",
        rawValue: "+919876543210",
        extractedValue: "+919876543210",
        sourceEvidence: "json",
        confidence: "high",
        confidenceScore: 0.95,
        status: "confirmed",
        isMaterial: true,
        isRequired: true,
      },
      {
        id: "field:postal_code",
        category: "location",
        fieldName: "postal_code",
        label: "PIN Code",
        rawValue: "452001",
        extractedValue: "452001",
        sourceEvidence: "json",
        confidence: "high",
        confidenceScore: 0.95,
        status: "confirmed",
        isMaterial: true,
        isRequired: true,
      },
      {
        id: "item:0",
        category: "catalogue",
        fieldName: "catalogue_item",
        label: "Croissant",
        rawValue: "Croissant - 50",
        extractedValue: { title: "Croissant", priceMinor: 5000, currencyCode: "INR" },
        sourceEvidence: "json",
        confidence: "high",
        confidenceScore: 0.95,
        status: "confirmed",
        isMaterial: true,
        isRequired: false,
      },
    ];

    it("rejects execution if unconfirmed material facts remain", async () => {
      vi.spyOn(tenantAccess, "assertWorkspaceAccess").mockResolvedValue({
        workspace: {
          id: workspaceId,
          name: "Agency",
          slug: "agency",
        } as unknown as Database["public"]["Tables"]["workspaces"]["Row"],
        callerUserId,
        membership: {
          id: "mem-1",
          workspace_id: workspaceId,
          user_id: callerUserId,
          role: "workspace_owner",
        } as unknown as Database["public"]["Tables"]["workspace_members"]["Row"],
        role: "workspace_owner",
      });
      vi.spyOn(entitlementService, "assertCapacityAvailable").mockResolvedValue({
        metric: "draft_websites",
        current: 0,
        baseLimit: 10,
        overrideCapacity: 0,
        effectiveLimit: 10,
        remaining: 10,
        isUnlimited: false,
        isExceeded: false,
      });

      const mockSupabase = {} as unknown as SupabaseClient<Database>;
      const unconfirmedFields = buildConfirmedFields();
      unconfirmedFields[4].status = "unconfirmed"; // Item price is unconfirmed

      await expect(
        executeConfirmedBusinessImport(mockSupabase, callerUserId, {
          workspaceId,
          proposalId: "prop-123",
          sourceFormat: "json",
          fields: unconfirmedFields,
        }),
      ).rejects.toThrow(/Cannot provision store.*material fact/);
    });

    it("enforces workspace admin/owner role authorization", async () => {
      const mockSupabase = {} as unknown as SupabaseClient<Database>;
      vi.spyOn(tenantAccess, "assertWorkspaceAccess").mockResolvedValue({
        workspace: {
          id: workspaceId,
          name: "Agency",
          slug: "agency",
        } as unknown as Database["public"]["Tables"]["workspaces"]["Row"],
        callerUserId,
        membership: {
          id: "mem-1",
          workspace_id: workspaceId,
          user_id: callerUserId,
          role: "client_user",
        } as unknown as Database["public"]["Tables"]["workspace_members"]["Row"],
        role: "client_user" as unknown as "workspace_owner",
      });

      await expect(
        executeConfirmedBusinessImport(mockSupabase, callerUserId, {
          workspaceId,
          proposalId: "prop-123",
          sourceFormat: "json",
          fields: buildConfirmedFields(),
        }),
      ).rejects.toThrow(/administrative permissions/);
    });

    it("successfully provisions store, inserts catalogue items, and records audit log", async () => {
      // Mock workspace access
      vi.spyOn(tenantAccess, "assertWorkspaceAccess").mockResolvedValue({
        workspace: {
          id: workspaceId,
          name: "Agency",
          slug: "agency",
        } as unknown as Database["public"]["Tables"]["workspaces"]["Row"],
        callerUserId,
        membership: {
          id: "mem-1",
          workspace_id: workspaceId,
          user_id: callerUserId,
          role: "workspace_owner",
        } as unknown as Database["public"]["Tables"]["workspace_members"]["Row"],
        role: "workspace_owner",
      });

      // Mock capacity check
      const capacitySpy = vi
        .spyOn(entitlementService, "assertCapacityAvailable")
        .mockResolvedValue({
          metric: "draft_websites",
          current: 0,
          baseLimit: 10,
          overrideCapacity: 0,
          effectiveLimit: 10,
          remaining: 10,
          isUnlimited: false,
          isExceeded: false,
        });

      // Mock createBusinessWithSetup
      const mockBusiness = {
        id: "biz-1111",
        trade_name: "Verified Bakery",
        slug: "verified-bakery",
        workspace_id: workspaceId,
      };
      const mockLocation = {
        id: "loc-1111",
        business_id: "biz-1111",
        name: "Main Store",
        city: "Indore",
      };
      const createSetupSpy = vi
        .spyOn(businessService, "createBusinessWithSetup")
        .mockResolvedValue({
          business: mockBusiness as unknown as Database["public"]["Tables"]["businesses"]["Row"],
          primaryLocation:
            mockLocation as unknown as Database["public"]["Tables"]["locations"]["Row"],
          nicheSlug: "other_business",
          isComplete: true,
          missingFields: [],
        });

      // Mock audit log
      const auditSpy = vi.spyOn(auditService, "recordAuditEvent").mockResolvedValue({
        id: "audit-1",
        businessId: "biz-1111",
        workspaceId,
        userId: callerUserId,
        action: "business.import_confirmed",
        resource: "businesses",
        metadata: {},
        ipAddress: null,
        createdAt: new Date().toISOString(),
      });

      // Mock Supabase from("catalogue_items").insert(...)
      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });
      const mockSupabase = {
        from: mockFrom,
      } as unknown as SupabaseClient<Database>;

      const result = await executeConfirmedBusinessImport(mockSupabase, callerUserId, {
        workspaceId,
        proposalId: "prop-123",
        sourceFormat: "json",
        fields: buildConfirmedFields(),
      });

      expect(capacitySpy).toHaveBeenCalledWith(expect.anything(), workspaceId, "draft_websites", 1);
      expect(createSetupSpy).toHaveBeenCalled();
      expect(mockInsert).toHaveBeenCalled();
      expect(auditSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: "business.import_confirmed",
          businessId: "biz-1111",
        }),
      );
      expect(result.business.id).toBe("biz-1111");
      expect(result.catalogueItemsCreated).toBe(1);
    });
  });
});
