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
import * as tenantAccess from "@/lib/auth/tenant-access";
import * as entitlementService from "@/lib/plans/service";

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

    it("successfully calls confirm_business_import_atomic RPC and provisions atomically", async () => {
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

      const mockBusiness = {
        id: "biz-1111",
        trade_name: "Verified Bakery",
        slug: "verified-bakery",
        workspace_id: workspaceId,
        status: "onboarding",
        created_at: new Date().toISOString(),
      };
      const mockLocation = {
        id: "loc-1111",
        business_id: "biz-1111",
        name: "Main Store",
        slug: "main",
        city: "Indore",
        state: "Madhya Pradesh",
        postal_code: "452001",
        is_primary: true,
      };

      const mockRpc = vi.fn().mockResolvedValue({
        data: {
          business: mockBusiness,
          primary_location: mockLocation,
          business_id: "biz-1111",
          location_id: "loc-1111",
          catalogue_items_created: 1,
          audit_log_action: "business.import_confirmed",
        },
        error: null,
      });

      const mockSupabase = {
        rpc: mockRpc,
      } as unknown as SupabaseClient<Database>;

      const result = await executeConfirmedBusinessImport(mockSupabase, callerUserId, {
        workspaceId,
        proposalId: "prop-123",
        sourceFormat: "json",
        sourceFileName: "bakery.json",
        fields: buildConfirmedFields(),
      });

      expect(capacitySpy).toHaveBeenCalledWith(expect.anything(), workspaceId, "draft_websites", 1);
      expect(mockRpc).toHaveBeenCalledWith("confirm_business_import_atomic", {
        p_workspace_id: workspaceId,
        p_caller_user_id: callerUserId,
        p_trade_name: "Verified Bakery",
        p_legal_name: "Verified Bakery",
        p_slug: "verified-bakery",
        p_niche_slug: "other_business",
        p_category: "other_business",
        p_description: null,
        p_gst_number: null,
        p_pan_number: null,
        p_tax_scheme: "unregistered",
        p_contact: {
          primary_phone: "+919876543210",
          whatsapp_number: "+919876543210",
          email: null,
        },
        p_location_name: "Main Store",
        p_address_line1: "100 MG Road",
        p_address_line2: null,
        p_city: "Indore",
        p_state: "Madhya Pradesh",
        p_postal_code: "452001",
        p_timings_answers: {},
        p_import_proposal_id: "prop-123",
        p_source_format: "json",
        p_source_file_name: "bakery.json",
        p_default_modules: ["website_engine"],
        p_catalogue_items: [
          {
            title: "Croissant",
            price_minor: 5000,
            currency_code: "INR",
            description: null,
            sku: null,
          },
        ],
        p_reviewed_fields_count: 5,
      });

      expect(result.business.id).toBe("biz-1111");
      expect(result.primaryLocation.id).toBe("loc-1111");
      expect(result.catalogueItemsCreated).toBe(1);
      expect(result.auditLogAction).toBe("business.import_confirmed");
    });

    it("maps VY001 capacity exceeded error from RPC", async () => {
      vi.spyOn(tenantAccess, "assertWorkspaceAccess").mockResolvedValue({
        workspace: {
          id: workspaceId,
        } as unknown as Database["public"]["Tables"]["workspaces"]["Row"],
        callerUserId,
        membership: {} as unknown as Database["public"]["Tables"]["workspace_members"]["Row"],
        role: "workspace_owner",
      });
      vi.spyOn(entitlementService, "assertCapacityAvailable").mockResolvedValue({} as never);

      const mockRpc = vi.fn().mockResolvedValue({
        data: null,
        error: { code: "VY001", message: "Workspace draft website limit reached (10/10)" },
      });
      const mockSupabase = { rpc: mockRpc } as unknown as SupabaseClient<Database>;

      await expect(
        executeConfirmedBusinessImport(mockSupabase, callerUserId, {
          workspaceId,
          proposalId: "prop-123",
          sourceFormat: "json",
          fields: buildConfirmedFields(),
        }),
      ).rejects.toThrow(/Workspace draft website limit reached/);
    });

    it("maps VY024 duplicate proposal error from RPC protecting idempotency", async () => {
      vi.spyOn(tenantAccess, "assertWorkspaceAccess").mockResolvedValue({
        workspace: {
          id: workspaceId,
        } as unknown as Database["public"]["Tables"]["workspaces"]["Row"],
        callerUserId,
        membership: {} as unknown as Database["public"]["Tables"]["workspace_members"]["Row"],
        role: "workspace_owner",
      });
      vi.spyOn(entitlementService, "assertCapacityAvailable").mockResolvedValue({} as never);

      const mockRpc = vi.fn().mockResolvedValue({
        data: null,
        error: { code: "VY024", message: "Import proposal prop-123 has already been confirmed" },
      });
      const mockSupabase = { rpc: mockRpc } as unknown as SupabaseClient<Database>;

      await expect(
        executeConfirmedBusinessImport(mockSupabase, callerUserId, {
          workspaceId,
          proposalId: "prop-123",
          sourceFormat: "json",
          fields: buildConfirmedFields(),
        }),
      ).rejects.toThrow(/already been confirmed/);
    });

    it("maps VY025 catalogue item error from RPC and ensures transaction rollback", async () => {
      vi.spyOn(tenantAccess, "assertWorkspaceAccess").mockResolvedValue({
        workspace: {
          id: workspaceId,
        } as unknown as Database["public"]["Tables"]["workspaces"]["Row"],
        callerUserId,
        membership: {} as unknown as Database["public"]["Tables"]["workspace_members"]["Row"],
        role: "workspace_owner",
      });
      vi.spyOn(entitlementService, "assertCapacityAvailable").mockResolvedValue({} as never);

      const mockRpc = vi.fn().mockResolvedValue({
        data: null,
        error: {
          code: "VY025",
          message: "Catalogue item price must be a non-negative integer minor unit",
        },
      });
      const mockSupabase = { rpc: mockRpc } as unknown as SupabaseClient<Database>;

      await expect(
        executeConfirmedBusinessImport(mockSupabase, callerUserId, {
          workspaceId,
          proposalId: "prop-123",
          sourceFormat: "json",
          fields: buildConfirmedFields(),
        }),
      ).rejects.toThrow(/Catalogue item price must be a non-negative integer/);
    });
  });
});
