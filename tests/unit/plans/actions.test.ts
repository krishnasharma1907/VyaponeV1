import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock server-only for tests running in Node/Vitest
vi.mock("server-only", () => ({}));

import {
  getWorkspaceSubscriptionDetailsAction,
  checkFeatureEntitlementAction,
  assertCapacityAvailableAction,
  checkSiteTransitionCapacityAction,
} from "@/lib/plans/actions";

// Mock Supabase server client
const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockRpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: {
      getUser: mockGetUser,
    },
    from: mockFrom,
    rpc: mockRpc,
  })),
}));

// Mock tenant authorization helpers
const mockAssertAuthenticatedUser = vi.fn();
const mockAssertWorkspaceAccess = vi.fn();
vi.mock("@/lib/auth/tenant-access", () => ({
  assertAuthenticatedUser: (...args: unknown[]) => mockAssertAuthenticatedUser(...args),
  assertWorkspaceAccess: (...args: unknown[]) => mockAssertWorkspaceAccess(...args),
}));

describe("VO-026 Plan & Capacity Server Actions", () => {
  const mockUserId = "usr-001";
  const mockWorkspaceId = "11111111-1111-1111-1111-111111111111";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authentication & Authorization Enforcement", () => {
    it("rejects getWorkspaceSubscriptionDetailsAction when unauthenticated", async () => {
      mockAssertAuthenticatedUser.mockRejectedValueOnce(new Error("Authentication required"));

      const result = await getWorkspaceSubscriptionDetailsAction(mockWorkspaceId);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Authentication required");
      }
    });

    it("rejects action when user has no access to workspace", async () => {
      mockAssertAuthenticatedUser.mockResolvedValueOnce({ id: mockUserId });
      mockAssertWorkspaceAccess.mockRejectedValueOnce(
        new Error("You do not have access to this workspace"),
      );

      const result = await checkFeatureEntitlementAction(mockWorkspaceId, "custom_domain");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("You do not have access to this workspace");
      }
    });

    it("rejects invalid feature keys with validation error", async () => {
      mockAssertAuthenticatedUser.mockResolvedValueOnce({ id: mockUserId });
      mockAssertWorkspaceAccess.mockResolvedValueOnce({
        role: "workspace_admin",
        isOwner: false,
      });

      const result = await checkFeatureEntitlementAction(mockWorkspaceId, "invalid_feature_name");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("VALIDATION_ERROR");
        expect(result.statusCode).toBe(400);
      }
    });

    it("sanitizes unexpected database error strings", async () => {
      mockAssertAuthenticatedUser.mockResolvedValueOnce({ id: mockUserId });
      mockAssertWorkspaceAccess.mockResolvedValueOnce({
        role: "workspace_admin",
        isOwner: false,
      });

      mockFrom.mockImplementationOnce(() => {
        throw new Error("FATAL: connection to server at postgres failed");
      });

      const result = await assertCapacityAvailableAction(mockWorkspaceId, "team_seats", 1);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("DATABASE_ERROR");
        expect(result.error).not.toContain("postgres");
        expect(result.error).not.toContain("FATAL:");
      }
    });

    it("successfully checks site transition capacity via Server Action", async () => {
      mockAssertAuthenticatedUser.mockResolvedValueOnce({ id: mockUserId });
      mockAssertWorkspaceAccess.mockResolvedValueOnce({
        role: "workspace_admin",
        isOwner: false,
      });

      // Archiving is always permitted
      const result = await checkSiteTransitionCapacityAction(
        mockWorkspaceId,
        "site-001",
        "archived",
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.allowed).toBe(true);
      }
    });

    it("successfully checks feature entitlement via Server Action", async () => {
      mockAssertAuthenticatedUser.mockResolvedValueOnce({ id: mockUserId });
      mockAssertWorkspaceAccess.mockResolvedValueOnce({
        role: "workspace_admin",
        isOwner: false,
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === "entitlement_overrides") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({ data: null, error: null })),
                })),
              })),
            })),
          };
        }
        if (table === "workspaces") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: { id: mockWorkspaceId, plan: "growth", status: "active" },
                  error: null,
                })),
              })),
            })),
          };
        }
        if (table === "subscriptions") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({ data: null, error: null })),
              })),
            })),
          };
        }
        return {};
      });

      const result = await checkFeatureEntitlementAction(mockWorkspaceId, "custom_domain");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.enabled).toBe(true);
        expect(result.data.feature).toBe("custom_domain");
      }
    });
  });
});
