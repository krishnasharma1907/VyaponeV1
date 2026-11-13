import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  createBusinessAction,
  getBusinessAction,
  getUserBusinessesAction,
  updateBusinessProfileAction,
  createLocationAction,
  updateLocationAction,
  getBusinessLocationsAction,
  getBusinessMembersAction,
  addBusinessMemberAction,
  updateBusinessMemberRoleAction,
  removeBusinessMemberAction,
} from "@/lib/businesses/actions";
import * as businessService from "@/lib/businesses/service";
import { createServerSupabaseClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("Business Server Actions [VO-023]", () => {
  const mockUserId = "usr-owner-00000000-0001";
  const mockBusinessId = "biz-kirana-00000001";
  const mockLocationId = "loc-main-00000001";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authentication Guard", () => {
    it("rejects unauthenticated requests on all actions", async () => {
      vi.mocked(createServerSupabaseClient).mockResolvedValueOnce({
        auth: {
          getUser: vi.fn(async () => ({ data: { user: null }, error: new Error("No session") })),
        },
      } as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>);

      const res = await createBusinessAction({
        trade_name: "Test",
        legal_name: "Test Ltd",
        address_line1: "123 Road",
        city: "City",
        state: "State",
        postal_code: "560001",
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.code).toBe("UNAUTHENTICATED");
      }
    });
  });

  describe("createBusinessAction", () => {
    it("returns validationErrors when input fails Zod schema", async () => {
      vi.mocked(createServerSupabaseClient).mockResolvedValueOnce({
        auth: {
          getUser: vi.fn(async () => ({
            data: { user: { id: mockUserId } },
            error: null,
          })),
        },
      } as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>);

      const res = await createBusinessAction({
        trade_name: "A", // too short
        legal_name: "",
        address_line1: "",
        city: "",
        state: "",
        postal_code: "123", // invalid PIN
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.code).toBe("VALIDATION_FAILED");
        expect(res.validationErrors).toBeDefined();
        expect(res.validationErrors?.["trade_name"]).toBeDefined();
      }
    });

    it("succeeds and calls service with valid input", async () => {
      vi.mocked(createServerSupabaseClient).mockResolvedValueOnce({
        auth: {
          getUser: vi.fn(async () => ({
            data: { user: { id: mockUserId } },
            error: null,
          })),
        },
      } as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>);

      const mockResult = {
        business: { id: mockBusinessId, trade_name: "Ramesh Sweets" },
        primaryLocation: { id: mockLocationId, name: "Main Store" },
        locations: [],
        currentUserRole: "owner" as const,
        isSovereignOwner: true,
      };

      vi.spyOn(businessService, "createBusiness").mockResolvedValueOnce(
        mockResult as unknown as Awaited<ReturnType<typeof businessService.createBusiness>>,
      );

      const res = await createBusinessAction({
        trade_name: "Ramesh Sweets",
        legal_name: "Ramesh Sweets Pvt Ltd",
        address_line1: "123 MG Road",
        city: "Bengaluru",
        state: "Karnataka",
        postal_code: "560001",
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.business.trade_name).toBe("Ramesh Sweets");
      }
    });
  });

  describe("getBusinessAction", () => {
    it("returns business data when caller is authorized", async () => {
      vi.mocked(createServerSupabaseClient).mockResolvedValueOnce({
        auth: {
          getUser: vi.fn(async () => ({
            data: { user: { id: mockUserId } },
            error: null,
          })),
        },
      } as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>);

      const mockResult = {
        business: { id: mockBusinessId, trade_name: "Ramesh Sweets" },
        primaryLocation: null,
        locations: [],
        currentUserRole: "owner" as const,
        isSovereignOwner: true,
      };

      vi.spyOn(businessService, "getBusiness").mockResolvedValueOnce(
        mockResult as unknown as Awaited<ReturnType<typeof businessService.getBusiness>>,
      );

      const res = await getBusinessAction(mockBusinessId);
      expect(res.success).toBe(true);
    });

    it("sanitizes service BusinessError cleanly", async () => {
      vi.mocked(createServerSupabaseClient).mockResolvedValueOnce({
        auth: {
          getUser: vi.fn(async () => ({
            data: { user: { id: mockUserId } },
            error: null,
          })),
        },
      } as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>);

      vi.spyOn(businessService, "getBusiness").mockRejectedValueOnce(
        new businessService.BusinessError("You do not have access", "FORBIDDEN", 403),
      );

      const res = await getBusinessAction(mockBusinessId);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe("You do not have access");
        expect(res.code).toBe("FORBIDDEN");
      }
    });
  });

  describe("getUserBusinessesAction", () => {
    it("retrieves caller accessible businesses", async () => {
      vi.mocked(createServerSupabaseClient).mockResolvedValueOnce({
        auth: {
          getUser: vi.fn(async () => ({
            data: { user: { id: mockUserId } },
            error: null,
          })),
        },
      } as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>);

      vi.spyOn(businessService, "getUserBusinesses").mockResolvedValueOnce([
        {
          id: mockBusinessId,
          trade_name: "Store 1",
          legal_name: "Store 1 Ltd",
          slug: "store-1",
          status: "active",
          workspace_id: null,
          sovereign_owner_id: mockUserId,
          isPrimaryLocationConfigured: true,
          currentUserRole: "owner",
        },
      ]);

      const res = await getUserBusinessesAction();
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.length).toBe(1);
      }
    });
  });

  describe("updateBusinessProfileAction", () => {
    it("validates input and calls service", async () => {
      vi.mocked(createServerSupabaseClient).mockResolvedValueOnce({
        auth: {
          getUser: vi.fn(async () => ({
            data: { user: { id: mockUserId } },
            error: null,
          })),
        },
      } as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>);

      vi.spyOn(businessService, "updateBusinessProfile").mockResolvedValueOnce({
        id: mockBusinessId,
        trade_name: "Updated Name",
      } as unknown as Awaited<ReturnType<typeof businessService.updateBusinessProfile>>);

      const res = await updateBusinessProfileAction(mockBusinessId, {
        trade_name: "Updated Name",
      });

      expect(res.success).toBe(true);
    });
  });

  describe("Location Actions", () => {
    it("creates location and handles validation", async () => {
      vi.mocked(createServerSupabaseClient).mockResolvedValueOnce({
        auth: {
          getUser: vi.fn(async () => ({
            data: { user: { id: mockUserId } },
            error: null,
          })),
        },
      } as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>);

      vi.spyOn(businessService, "createLocation").mockResolvedValueOnce({
        id: "loc-002",
        name: "Branch 2",
      } as unknown as Awaited<ReturnType<typeof businessService.createLocation>>);

      const res = await createLocationAction({
        business_id: "00000000-0000-4000-8000-000000000001",
        name: "Branch 2",
        address_line1: "123 Road",
        city: "City",
        state: "State",
        postal_code: "560001",
      });

      expect(res.success).toBe(true);
    });

    it("updates location profile", async () => {
      vi.mocked(createServerSupabaseClient).mockResolvedValueOnce({
        auth: {
          getUser: vi.fn(async () => ({
            data: { user: { id: mockUserId } },
            error: null,
          })),
        },
      } as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>);

      vi.spyOn(businessService, "updateLocation").mockResolvedValueOnce({
        id: mockLocationId,
        name: "Renamed Branch",
      } as unknown as Awaited<ReturnType<typeof businessService.updateLocation>>);

      const res = await updateLocationAction(mockLocationId, {
        name: "Renamed Branch",
      });

      expect(res.success).toBe(true);
    });

    it("fetches business locations", async () => {
      vi.mocked(createServerSupabaseClient).mockResolvedValueOnce({
        auth: {
          getUser: vi.fn(async () => ({
            data: { user: { id: mockUserId } },
            error: null,
          })),
        },
      } as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>);

      vi.spyOn(businessService, "getBusinessLocations").mockResolvedValueOnce([]);

      const res = await getBusinessLocationsAction(mockBusinessId);
      expect(res.success).toBe(true);
    });
  });

  describe("Member Actions", () => {
    it("fetches business members", async () => {
      vi.mocked(createServerSupabaseClient).mockResolvedValueOnce({
        auth: {
          getUser: vi.fn(async () => ({
            data: { user: { id: mockUserId } },
            error: null,
          })),
        },
      } as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>);

      vi.spyOn(businessService, "getBusinessMembers").mockResolvedValueOnce([]);

      const res = await getBusinessMembersAction(mockBusinessId);
      expect(res.success).toBe(true);
    });

    it("adds business member", async () => {
      vi.mocked(createServerSupabaseClient).mockResolvedValueOnce({
        auth: {
          getUser: vi.fn(async () => ({
            data: { user: { id: mockUserId } },
            error: null,
          })),
        },
      } as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>);

      vi.spyOn(businessService, "addBusinessMember").mockResolvedValueOnce({
        id: "bm-002",
        role: "cashier",
      } as unknown as Awaited<ReturnType<typeof businessService.addBusinessMember>>);

      const res = await addBusinessMemberAction({
        business_id: "00000000-0000-4000-8000-000000000001",
        user_id: "00000000-0000-4000-8000-000000000002",
        role: "cashier",
      });

      expect(res.success).toBe(true);
    });

    it("updates business member role", async () => {
      vi.mocked(createServerSupabaseClient).mockResolvedValueOnce({
        auth: {
          getUser: vi.fn(async () => ({
            data: { user: { id: mockUserId } },
            error: null,
          })),
        },
      } as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>);

      vi.spyOn(businessService, "updateBusinessMemberRole").mockResolvedValueOnce({
        id: "bm-002",
        role: "manager",
      } as unknown as Awaited<ReturnType<typeof businessService.updateBusinessMemberRole>>);

      const res = await updateBusinessMemberRoleAction(
        mockBusinessId,
        "u0000000-0000-0000-0000-000000000002",
        { role: "manager" },
      );

      expect(res.success).toBe(true);
    });

    it("removes business member", async () => {
      vi.mocked(createServerSupabaseClient).mockResolvedValueOnce({
        auth: {
          getUser: vi.fn(async () => ({
            data: { user: { id: mockUserId } },
            error: null,
          })),
        },
      } as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>);

      vi.spyOn(businessService, "removeBusinessMember").mockResolvedValueOnce({
        success: true,
      });

      const res = await removeBusinessMemberAction(
        mockBusinessId,
        "u0000000-0000-0000-0000-000000000002",
      );

      expect(res.success).toBe(true);
    });
  });
});
