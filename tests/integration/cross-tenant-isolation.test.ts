import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import {
  assertBusinessAccess,
  assertRecordBelongsToBusiness,
  assertSovereignOwner,
  assertWorkspaceAccess,
  TenantAccessError,
} from "@/lib/auth/tenant-access";
import {
  addBusinessMember,
  BusinessError,
  getBusiness,
  updateBusinessMemberRole,
  updateLocation,
} from "@/lib/businesses/service";
import {
  createTestBusiness,
  createTestLocation,
  createTestUser,
  createTestWorkspace,
} from "../factories";

function createMockQueryBuilder(data: unknown = null, error: unknown = null) {
  return {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  };
}

describe("Cross-Tenant Attack Verification Suite [VO-024]", () => {
  // Scenario 1: User A cannot read User B's private business
  it("Scenario 1: User A cannot read User B's private business", async () => {
    const userA = createTestUser({ id: "usr_alice", email: "alice@example.com" });
    const userB = createTestUser({ id: "usr_bob", email: "bob@example.com" });
    const businessB = createTestBusiness({
      id: "biz_bob_store",
      sovereign_owner_id: userB.id,
      workspace_id: null,
    });

    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: userA.id, email: userA.email } },
          error: null,
        }),
      },
      from: vi.fn((table: string) => {
        if (table === "businesses") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: businessB,
              error: null,
            }),
            single: vi.fn().mockResolvedValue({
              data: businessB,
              error: null,
            }),
          };
        }
        if (table === "business_members") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        return {};
      }),
    } as unknown as SupabaseClient<Database>;

    // Attempting to read business B as User A must fail with NOT_FOUND (anti-enumeration)
    await expect(assertBusinessAccess(mockClient, businessB.id)).rejects.toMatchObject({
      name: "TenantAccessError",
      code: "NOT_FOUND",
      status: 404,
    });

    await expect(getBusiness(mockClient, businessB.id, userA.id)).rejects.toThrow();
  });

  // Scenario 2: Workspace A member cannot access Workspace B records
  it("Scenario 2: Workspace A member cannot access Workspace B records", async () => {
    const userA = createTestUser({ id: "usr_agency_a_staff" });
    const workspaceB = createTestWorkspace({
      id: "ws_agency_b",
      owner_user_id: "usr_agency_b_owner",
    });

    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: userA.id } },
          error: null,
        }),
      },
      from: vi.fn((table: string) => {
        if (table === "workspaces") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: workspaceB,
              error: null,
            }),
          };
        }
        if (table === "workspace_members") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        return {};
      }),
    } as unknown as SupabaseClient<Database>;

    // Caller is not a member of Workspace B -> must fail closed with NOT_FOUND
    await expect(assertWorkspaceAccess(mockClient, workspaceB.id)).rejects.toMatchObject({
      name: "TenantAccessError",
      code: "NOT_FOUND",
      status: 404,
    });
  });

  // Scenario 3: Workspace admin cannot access a business they do not own or have authorized membership in
  it("Scenario 3: Workspace admin cannot access a business assigned to another workspace or DIY", async () => {
    const resellerAdmin = createTestUser({ id: "usr_reseller_admin" });
    const foreignBusiness = createTestBusiness({
      id: "biz_other_reseller",
      workspace_id: "ws_other_reseller",
      sovereign_owner_id: "usr_merchant_foreign",
    });

    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: resellerAdmin.id } },
          error: null,
        }),
      },
      from: vi.fn((table: string) => {
        if (table === "businesses") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: foreignBusiness,
              error: null,
            }),
          };
        }
        if (table === "business_members") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        if (table === "workspace_members") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        return {};
      }),
    } as unknown as SupabaseClient<Database>;

    await expect(assertBusinessAccess(mockClient, foreignBusiness.id)).rejects.toMatchObject({
      name: "TenantAccessError",
      code: "NOT_FOUND",
      status: 404,
    });
  });

  // Scenario 4: Reseller membership alone does not confer sovereign business ownership
  it("Scenario 4: Reseller membership alone does not confer sovereign business ownership", async () => {
    const resellerAdmin = createTestUser({ id: "usr_reseller_admin" });
    const sovereignMerchant = createTestUser({ id: "usr_sovereign_merchant" });
    const business = createTestBusiness({
      id: "biz_client_store",
      workspace_id: "ws_reseller_agency",
      sovereign_owner_id: sovereignMerchant.id,
    });

    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: resellerAdmin.id } },
          error: null,
        }),
      },
      from: vi.fn((table: string) => {
        if (table === "businesses") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: business,
              error: null,
            }),
          };
        }
        if (table === "business_members") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        if (table === "workspace_members") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                workspace_id: "ws_reseller_agency",
                user_id: resellerAdmin.id,
                role: "reseller_admin",
                status: "active",
              },
              error: null,
            }),
          };
        }
        return {};
      }),
    } as unknown as SupabaseClient<Database>;

    // Operational business access is permitted as workspace manager
    const access = await assertBusinessAccess(mockClient, business.id);
    expect(access.effectiveRole).toBe("manager");
    expect(access.isSovereignOwner).toBe(false);

    // Sovereign owner check must strictly reject the reseller admin
    await expect(assertSovereignOwner(mockClient, business.id)).rejects.toMatchObject({
      name: "TenantAccessError",
      code: "SOVEREIGN_VIOLATION",
      status: 403,
    });
  });

  // Scenario 5: Business A member cannot access Business B records
  it("Scenario 5: Business A member cannot access Business B records", async () => {
    const memberA = createTestUser({ id: "usr_staff_biz_a" });
    const businessB = createTestBusiness({
      id: "biz_target_b",
      sovereign_owner_id: "usr_owner_b",
      workspace_id: null,
    });

    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: memberA.id } },
          error: null,
        }),
      },
      from: vi.fn((table: string) => {
        if (table === "businesses") {
          return createMockQueryBuilder(businessB);
        }
        return createMockQueryBuilder(null);
      }),
    } as unknown as SupabaseClient<Database>;

    await expect(assertBusinessAccess(mockClient, businessB.id)).rejects.toMatchObject({
      name: "TenantAccessError",
      code: "NOT_FOUND",
      status: 404,
    });
  });

  // Scenario 6: Location A user cannot access restricted Location B records
  it("Scenario 6: Location A user cannot access restricted Location B records", async () => {
    const staffUser = createTestUser({ id: "usr_staff_loc_a" });
    const business = createTestBusiness({ id: "biz_multi_loc" });
    const locA = createTestLocation({ id: "loc_north", business_id: business.id });
    const locB = createTestLocation({ id: "loc_south", business_id: business.id });

    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: staffUser.id } },
          error: null,
        }),
      },
      from: vi.fn((table: string) => {
        if (table === "businesses") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: business, error: null }),
          };
        }
        if (table === "business_members") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                business_id: business.id,
                user_id: staffUser.id,
                role: "staff",
                location_id: locA.id,
                status: "active",
              },
              error: null,
            }),
          };
        }
        return {};
      }),
    } as unknown as SupabaseClient<Database>;

    // Access to assigned Location A is valid
    const accessLocA = await assertBusinessAccess(mockClient, business.id, {
      requiredLocationId: locA.id,
    });
    expect(accessLocA.locationId).toBe(locA.id);

    // Access to restricted Location B is rejected with LOCATION_RESTRICTED (403)
    await expect(
      assertBusinessAccess(mockClient, business.id, {
        requiredLocationId: locB.id,
      }),
    ).rejects.toMatchObject({
      name: "TenantAccessError",
      code: "LOCATION_RESTRICTED",
      status: 403,
    });
  });

  // Scenario 7: User cannot change business_id or workspace_id to move a record into another tenant
  it("Scenario 7: User cannot change business_id or workspace_id to move a record into another tenant", async () => {
    // Assert boundary enforcement utility
    expect(() => {
      assertRecordBelongsToBusiness("biz_victim", "biz_attacker", "LocationRecord");
    }).toThrowError(TenantAccessError);

    // Cross-tenant location linkage rejection in business service
    const mockClient = {
      from: vi.fn((table: string) => {
        if (table === "businesses") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: "biz_target", sovereign_owner_id: "usr_owner" },
              error: null,
            }),
          };
        }
        if (table === "business_members") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { role: "owner", status: "active" },
              error: null,
            }),
          };
        }
        if (table === "locations") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              // Location actually belongs to foreign business!
              data: { id: "loc_foreign", business_id: "biz_other" },
              error: null,
            }),
          };
        }
        return {};
      }),
    } as unknown as SupabaseClient<Database>;

    await expect(
      addBusinessMember(mockClient, "usr_owner", {
        business_id: "biz_target",
        user_id: "usr_new_employee",
        role: "staff",
        location_id: "loc_foreign",
      }),
    ).rejects.toThrow("Location does not belong to this business");
  });

  // Scenario 8: User cannot update or delete another tenant's records by guessing UUIDs
  it("Scenario 8: User cannot update or delete another tenant's records by guessing UUIDs", async () => {
    const victimLocation = createTestLocation({
      id: "loc_victim_uuid",
      business_id: "biz_victim_tenant",
    });

    const mockClient = {
      from: vi.fn((table: string) => {
        if (table === "locations") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: victimLocation, error: null }),
            maybeSingle: vi.fn().mockResolvedValue({ data: victimLocation, error: null }),
          };
        }
        if (table === "businesses") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: "biz_victim_tenant",
                sovereign_owner_id: "usr_victim_owner",
                workspace_id: null,
              },
              error: null,
            }),
          };
        }
        if (table === "business_members") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        return {};
      }),
    } as unknown as SupabaseClient<Database>;

    // Attacker caller has no access to victim business
    await expect(
      updateLocation(mockClient, "loc_victim_uuid", "usr_attacker", {
        name: "Hijacked Location Name",
      }),
    ).rejects.toThrow(BusinessError);
  });

  // Scenario 9: Unauthenticated requests cannot access protected tenant records
  it("Scenario 9: Unauthenticated requests cannot access protected tenant records", async () => {
    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: new Error("No active session token"),
        }),
      },
    } as unknown as SupabaseClient<Database>;

    await expect(assertBusinessAccess(mockClient, "biz_any")).rejects.toMatchObject({
      name: "TenantAccessError",
      code: "UNAUTHENTICATED",
      status: 401,
    });

    await expect(assertWorkspaceAccess(mockClient, "ws_any")).rejects.toMatchObject({
      name: "TenantAccessError",
      code: "UNAUTHENTICATED",
      status: 401,
    });
  });

  // Scenario 10: Expired, revoked or unaccepted invitations cannot grant membership
  it("Scenario 10: Expired, revoked or unaccepted invitations cannot grant membership", async () => {
    const user = createTestUser({ id: "usr_invitee" });

    // Workspace member lookup strictly checks status = 'active'
    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: user.id } },
          error: null,
        }),
      },
      from: vi.fn((table: string) => {
        if (table === "workspaces") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: "ws_target", owner_user_id: "usr_other" },
              error: null,
            }),
          };
        }
        if (table === "workspace_members") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            // Only 'invited' status exists, not 'active'
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        return {};
      }),
    } as unknown as SupabaseClient<Database>;

    await expect(assertWorkspaceAccess(mockClient, "ws_target")).rejects.toMatchObject({
      name: "TenantAccessError",
      code: "NOT_FOUND",
      status: 404,
    });
  });

  // Scenario 11: A removed member loses access on subsequent requests
  it("Scenario 11: A removed member loses access on subsequent requests", async () => {
    const formerStaff = createTestUser({ id: "usr_fired_staff" });
    const business = createTestBusiness({ id: "biz_store", workspace_id: null });

    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: formerStaff.id } },
          error: null,
        }),
      },
      from: vi.fn((table: string) => {
        if (table === "businesses") {
          return createMockQueryBuilder(business);
        }
        return createMockQueryBuilder(null);
      }),
    } as unknown as SupabaseClient<Database>;

    await expect(assertBusinessAccess(mockClient, business.id)).rejects.toMatchObject({
      name: "TenantAccessError",
      code: "NOT_FOUND",
      status: 404,
    });
  });

  // Scenario 12: A user cannot escalate privileges by submitting a higher role in a request payload
  it("Scenario 12: A user cannot escalate privileges by submitting a higher role in a request payload", async () => {
    const manager = createTestUser({ id: "usr_manager" });
    const targetUser = createTestUser({ id: "usr_staff_target" });
    const business = createTestBusiness({
      id: "biz_store",
      sovereign_owner_id: "usr_sovereign_owner",
      workspace_id: null,
    });

    const mockClient = {
      from: vi.fn((table: string) => {
        if (table === "businesses") {
          return createMockQueryBuilder(business);
        }
        if (table === "business_members") {
          const builder = createMockQueryBuilder();
          builder.maybeSingle = vi.fn().mockImplementation(() => {
            return Promise.resolve({
              data: { role: "manager", status: "active" },
              error: null,
            });
          });
          builder.single = vi.fn().mockImplementation(() => {
            return Promise.resolve({
              data: {
                id: "bm_target",
                business_id: business.id,
                user_id: targetUser.id,
                role: "staff",
                status: "active",
              },
              error: null,
            });
          });
          return builder;
        }
        return createMockQueryBuilder(null);
      }),
    } as unknown as SupabaseClient<Database>;

    // Manager attempts to promote someone to "owner" (rank 40)
    await expect(
      updateBusinessMemberRole(mockClient, business.id, targetUser.id, manager.id, {
        role: "owner",
      }),
    ).rejects.toThrow("Your role (manager) cannot assign role owner");
  });
});
