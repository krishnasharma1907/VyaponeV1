import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import {
  assertAuthenticatedUser,
  assertBusinessAccess,
  assertLocationBelongsToBusiness,
  assertRecordBelongsToBusiness,
  assertSovereignOwner,
  assertWorkspaceAccess,
  sanitizeTenantError,
  TenantAccessError,
} from "@/lib/auth/tenant-access";

describe("Tenant Isolation & Authorization Helpers [VO-024]", () => {
  describe("sanitizeTenantError", () => {
    it("preserves safe TenantAccessError properties", () => {
      const err = new TenantAccessError("Business not found", "NOT_FOUND", 404);
      const sanitized = sanitizeTenantError(err);
      expect(sanitized).toEqual({
        error: "Business not found",
        code: "NOT_FOUND",
        status: 404,
      });
    });

    it("masks internal errors without leaking sensitive database details", () => {
      const dbError = new Error("relation public.businesses does not exist at postgres.c:124");
      const sanitized = sanitizeTenantError(dbError);
      expect(sanitized).toEqual({
        error: "An unexpected error occurred",
        code: "INTERNAL_ERROR",
        status: 500,
      });
    });

    it("handles non-error objects gracefully", () => {
      const sanitized = sanitizeTenantError("unexpected string");
      expect(sanitized).toEqual({
        error: "An unexpected error occurred",
        code: "UNKNOWN_ERROR",
        status: 500,
      });
    });
  });

  describe("assertAuthenticatedUser", () => {
    it("returns user id and email for authenticated session", async () => {
      const mockClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "usr_alice", email: "alice@example.com" } },
            error: null,
          }),
        },
      } as unknown as SupabaseClient<Database>;

      const user = await assertAuthenticatedUser(mockClient);
      expect(user.id).toBe("usr_alice");
      expect(user.email).toBe("alice@example.com");
    });

    it("throws TenantAccessError (UNAUTHENTICATED, 401) for unauthenticated caller", async () => {
      const mockClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: new Error("No active session"),
          }),
        },
      } as unknown as SupabaseClient<Database>;

      await expect(assertAuthenticatedUser(mockClient)).rejects.toMatchObject({
        name: "TenantAccessError",
        code: "UNAUTHENTICATED",
        status: 401,
      });
    });
  });

  describe("assertWorkspaceAccess", () => {
    it("resolves access for active workspace member", async () => {
      const mockClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "usr_member" } },
            error: null,
          }),
        },
        from: vi.fn((table: string) => {
          if (table === "workspaces") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: "ws_123", name: "Alpha Agency", owner_user_id: "usr_owner" },
                error: null,
              }),
            };
          }
          if (table === "workspace_members") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: "wm_1",
                  workspace_id: "ws_123",
                  user_id: "usr_member",
                  role: "workspace_admin",
                  status: "active",
                },
                error: null,
              }),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient<Database>;

      const context = await assertWorkspaceAccess(mockClient, "ws_123");
      expect(context.callerUserId).toBe("usr_member");
      expect(context.role).toBe("workspace_admin");
      expect(context.workspace.name).toBe("Alpha Agency");
    });

    it("synthesizes membership for workspace owner record", async () => {
      const mockClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "usr_owner" } },
            error: null,
          }),
        },
        from: vi.fn((table: string) => {
          if (table === "workspaces") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: "ws_123", name: "Alpha Agency", owner_user_id: "usr_owner" },
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

      const context = await assertWorkspaceAccess(mockClient, "ws_123");
      expect(context.callerUserId).toBe("usr_owner");
      expect(context.role).toBe("workspace_owner");
    });

    it("throws 404 NOT_FOUND when caller is not a member (anti-enumeration)", async () => {
      const mockClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "usr_stranger" } },
            error: null,
          }),
        },
        from: vi.fn((table: string) => {
          if (table === "workspaces") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: "ws_secret", name: "Confidential", owner_user_id: "usr_owner" },
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

      await expect(assertWorkspaceAccess(mockClient, "ws_secret")).rejects.toMatchObject({
        name: "TenantAccessError",
        code: "NOT_FOUND",
        status: 404,
      });
    });

    it("enforces required permission boundaries", async () => {
      const mockClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "usr_staff" } },
            error: null,
          }),
        },
        from: vi.fn((table: string) => {
          if (table === "workspaces") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: "ws_123", name: "Alpha Agency", owner_user_id: "usr_owner" },
                error: null,
              }),
            };
          }
          if (table === "workspace_members") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: "wm_2",
                  workspace_id: "ws_123",
                  user_id: "usr_staff",
                  role: "reseller_staff",
                  status: "active",
                },
                error: null,
              }),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient<Database>;

      // reseller_staff lacks workspace:delete permission
      await expect(
        assertWorkspaceAccess(mockClient, "ws_123", {
          requiredPermission: "workspace:delete",
        }),
      ).rejects.toMatchObject({
        name: "TenantAccessError",
        code: "FORBIDDEN",
        status: 403,
      });
    });
  });

  describe("assertBusinessAccess", () => {
    it("grants full access to sovereign business owner", async () => {
      const mockClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "usr_sovereign_owner" } },
            error: null,
          }),
        },
        from: vi.fn((table: string) => {
          if (table === "businesses") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: "biz_100",
                  legal_name: "Sovereign Kirana",
                  sovereign_owner_id: "usr_sovereign_owner",
                  workspace_id: null,
                },
                error: null,
              }),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient<Database>;

      const context = await assertBusinessAccess(mockClient, "biz_100");
      expect(context.isSovereignOwner).toBe(true);
      expect(context.effectiveRole).toBe("owner");
      expect(context.callerUserId).toBe("usr_sovereign_owner");
    });

    it("rejects non-sovereign user when requireSovereignOwner is set", async () => {
      const mockClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "usr_reseller_admin" } },
            error: null,
          }),
        },
        from: vi.fn((table: string) => {
          if (table === "businesses") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: "biz_100",
                  legal_name: "Sovereign Kirana",
                  sovereign_owner_id: "usr_real_owner",
                  workspace_id: "ws_reseller",
                },
                error: null,
              }),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient<Database>;

      await expect(
        assertBusinessAccess(mockClient, "biz_100", { requireSovereignOwner: true }),
      ).rejects.toMatchObject({
        name: "TenantAccessError",
        code: "SOVEREIGN_VIOLATION",
        status: 403,
      });
    });

    it("enforces location scoping: rejects staff accessing unauthorized location", async () => {
      const mockClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "usr_cashier" } },
            error: null,
          }),
        },
        from: vi.fn((table: string) => {
          if (table === "businesses") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: "biz_100",
                  sovereign_owner_id: "usr_real_owner",
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
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: "bm_cashier",
                  business_id: "biz_100",
                  user_id: "usr_cashier",
                  role: "cashier",
                  location_id: "loc_branch_a",
                  status: "active",
                },
                error: null,
              }),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient<Database>;

      // Attempting to access loc_branch_b while assigned to loc_branch_a
      await expect(
        assertBusinessAccess(mockClient, "biz_100", {
          requiredLocationId: "loc_branch_b",
        }),
      ).rejects.toMatchObject({
        name: "TenantAccessError",
        code: "LOCATION_RESTRICTED",
        status: 403,
      });
    });

    it("enforces required business permissions: rejects staff lacking update_profile", async () => {
      const mockClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "usr_staff_user" } },
            error: null,
          }),
        },
        from: vi.fn((table: string) => {
          if (table === "businesses") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: "biz_100", sovereign_owner_id: "usr_real_owner", workspace_id: null },
                error: null,
              }),
            };
          }
          if (table === "business_members") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: "bm_staff",
                  business_id: "biz_100",
                  user_id: "usr_staff_user",
                  role: "staff",
                  status: "active",
                },
                error: null,
              }),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient<Database>;

      await expect(
        assertBusinessAccess(mockClient, "biz_100", {
          requiredPermission: "business:update_profile",
        }),
      ).rejects.toMatchObject({
        name: "TenantAccessError",
        code: "FORBIDDEN",
        status: 403,
      });
    });

    it("allows staff with unassigned location (null) to access requested location", async () => {
      const mockClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "usr_float_staff" } },
            error: null,
          }),
        },
        from: vi.fn((table: string) => {
          if (table === "businesses") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: "biz_100", sovereign_owner_id: "usr_real_owner", workspace_id: null },
                error: null,
              }),
            };
          }
          if (table === "business_members") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: "bm_float",
                  business_id: "biz_100",
                  user_id: "usr_float_staff",
                  role: "staff",
                  location_id: null,
                  status: "active",
                },
                error: null,
              }),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient<Database>;

      const context = await assertBusinessAccess(mockClient, "biz_100", {
        requiredLocationId: "loc_any_branch",
      });
      expect(context.effectiveRole).toBe("staff");
      expect(context.locationId).toBeNull();
    });

    it("allows managers to access any location across the business", async () => {
      const mockClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "usr_manager" } },
            error: null,
          }),
        },
        from: vi.fn((table: string) => {
          if (table === "businesses") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: "biz_100",
                  sovereign_owner_id: "usr_real_owner",
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
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: "bm_manager",
                  business_id: "biz_100",
                  user_id: "usr_manager",
                  role: "manager",
                  location_id: "loc_branch_a",
                  status: "active",
                },
                error: null,
              }),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient<Database>;

      // Manager can access any location despite specific assignment
      const context = await assertBusinessAccess(mockClient, "biz_100", {
        requiredLocationId: "loc_branch_b",
      });
      expect(context.effectiveRole).toBe("manager");
    });
  });

  describe("assertSovereignOwner helper", () => {
    it("returns business and caller user id when caller is sovereign owner", async () => {
      const mockClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "usr_sovereign" } },
            error: null,
          }),
        },
        from: vi.fn((table: string) => {
          if (table === "businesses") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: "biz_555",
                  sovereign_owner_id: "usr_sovereign",
                },
                error: null,
              }),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient<Database>;

      const res = await assertSovereignOwner(mockClient, "biz_555");
      expect(res.callerUserId).toBe("usr_sovereign");
      expect(res.business.id).toBe("biz_555");
    });
  });

  describe("assertRecordBelongsToBusiness", () => {
    it("succeeds when business IDs match", () => {
      expect(() => {
        assertRecordBelongsToBusiness("biz_123", "biz_123", "OrderItem");
      }).not.toThrow();
    });

    it("throws TenantAccessError (CROSS_TENANT_VIOLATION, 403) on tenant mismatch", () => {
      expect(() => {
        assertRecordBelongsToBusiness("biz_attacker", "biz_victim", "Invoice");
      }).toThrowError(TenantAccessError);

      try {
        assertRecordBelongsToBusiness("biz_attacker", "biz_victim", "Invoice");
      } catch (e) {
        const err = e as TenantAccessError;
        expect(err.code).toBe("CROSS_TENANT_VIOLATION");
        expect(err.status).toBe(403);
      }
    });
  });

  describe("assertLocationBelongsToBusiness", () => {
    it("resolves location when it belongs to target business", async () => {
      const mockClient = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: "loc_01", business_id: "biz_01", name: "Main Store" },
            error: null,
          }),
        }),
      } as unknown as SupabaseClient<Database>;

      const location = await assertLocationBelongsToBusiness(mockClient, "biz_01", "loc_01");
      expect(location.id).toBe("loc_01");
      expect(location.business_id).toBe("biz_01");
    });

    it("throws NOT_FOUND (404) when location belongs to a different business", async () => {
      const mockClient = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        }),
      } as unknown as SupabaseClient<Database>;

      await expect(
        assertLocationBelongsToBusiness(mockClient, "biz_01", "loc_foreign"),
      ).rejects.toMatchObject({
        name: "TenantAccessError",
        code: "NOT_FOUND",
        status: 404,
      });
    });
  });
});
