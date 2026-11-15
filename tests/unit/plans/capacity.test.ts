import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import {
  getCapacityUsage,
  assertCapacityAvailable,
  checkSiteTransitionCapacity,
} from "@/lib/plans/service";
import { CapacityExceededError } from "@/lib/plans/types";

describe("VO-026 Capacity Service & Counting Rules (§9.2)", () => {
  const mockWorkspaceId = "11111111-1111-1111-1111-111111111111";
  const mockSiteId = "33333333-3333-3333-3333-333333333333";

  describe("1. Live Website Slots (PRD §9.2)", () => {
    it("counts only published sites belonging to active businesses", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "workspaces") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: { id: mockWorkspaceId, plan: "starter", status: "active" },
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
          if (table === "capacity_overrides") {
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
          if (table === "businesses") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  neq: vi.fn(async () => ({
                    data: [{ id: "biz-1" }, { id: "biz-2" }],
                    error: null,
                  })),
                })),
              })),
            };
          }
          if (table === "sites") {
            return {
              select: vi.fn(() => ({
                in: vi.fn(() => ({
                  eq: vi.fn(async () => ({
                    count: 2,
                    data: null,
                    error: null,
                  })),
                })),
              })),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient<Database>;

      const usage = await getCapacityUsage(mockSupabase, mockWorkspaceId, "live_websites");

      // Starter plan limit: 3 live websites
      expect(usage.current).toBe(2);
      expect(usage.baseLimit).toBe(3);
      expect(usage.remaining).toBe(1);
      expect(usage.isExceeded).toBe(false);
    });

    it("rejects operation when live website capacity is exhausted", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "workspaces") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: { id: mockWorkspaceId, plan: "starter", status: "active" },
                    error: null,
                  })),
                })),
              })),
            };
          }
          if (table === "subscriptions" || table === "capacity_overrides") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({ data: null, error: null })),
                  eq: vi.fn(() => ({
                    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
                  })),
                })),
              })),
            };
          }
          if (table === "businesses") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  neq: vi.fn(async () => ({
                    data: [{ id: "biz-1" }, { id: "biz-2" }, { id: "biz-3" }],
                    error: null,
                  })),
                })),
              })),
            };
          }
          if (table === "sites") {
            return {
              select: vi.fn(() => ({
                in: vi.fn(() => ({
                  eq: vi.fn(async () => ({
                    count: 3,
                    data: null,
                    error: null,
                  })),
                })),
              })),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient<Database>;

      await expect(
        assertCapacityAvailable(mockSupabase, mockWorkspaceId, "live_websites", 1),
      ).rejects.toThrow(CapacityExceededError);
    });

    it("expands capacity when active capacity override is present", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "workspaces") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: { id: mockWorkspaceId, plan: "starter", status: "active" },
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
          if (table === "capacity_overrides") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    maybeSingle: vi.fn(async () => ({
                      data: {
                        additional_capacity: 5,
                        expires_at: null,
                      },
                      error: null,
                    })),
                  })),
                })),
              })),
            };
          }
          if (table === "businesses") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  neq: vi.fn(async () => ({
                    data: [{ id: "biz-1" }, { id: "biz-2" }, { id: "biz-3" }],
                    error: null,
                  })),
                })),
              })),
            };
          }
          if (table === "sites") {
            return {
              select: vi.fn(() => ({
                in: vi.fn(() => ({
                  eq: vi.fn(async () => ({
                    count: 3,
                    data: null,
                    error: null,
                  })),
                })),
              })),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient<Database>;

      const usage = await getCapacityUsage(mockSupabase, mockWorkspaceId, "live_websites");

      // Starter 3 + override 5 = 8 effective limit
      expect(usage.baseLimit).toBe(3);
      expect(usage.overrideCapacity).toBe(5);
      expect(usage.effectiveLimit).toBe(8);
      expect(usage.remaining).toBe(5);
      expect(usage.isExceeded).toBe(false);
    });
  });

  describe("2. Site Transition Rules (§9.2)", () => {
    it("always permits archiving or suspending a site to free capacity", async () => {
      const mockSupabase = {} as unknown as SupabaseClient<Database>;

      const archiveResult = await checkSiteTransitionCapacity(
        mockSupabase,
        mockWorkspaceId,
        mockSiteId,
        "archived",
      );
      expect(archiveResult.allowed).toBe(true);

      const suspendResult = await checkSiteTransitionCapacity(
        mockSupabase,
        mockWorkspaceId,
        mockSiteId,
        "suspended",
      );
      expect(suspendResult.allowed).toBe(true);
    });

    it("does not consume extra capacity when updating an already published site", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "sites") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: { id: mockSiteId, status: "published" },
                    error: null,
                  })),
                })),
              })),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient<Database>;

      // Target status is already published
      const result = await checkSiteTransitionCapacity(
        mockSupabase,
        mockWorkspaceId,
        mockSiteId,
        "published",
      );
      expect(result.allowed).toBe(true);
    });

    it("blocks transition from draft to published when live limit is reached", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "sites") {
            return {
              select: vi.fn((cols: string) => {
                if (cols === "id, status") {
                  return {
                    eq: vi.fn(() => ({
                      maybeSingle: vi.fn(async () => ({
                        data: { id: mockSiteId, status: "draft" },
                        error: null,
                      })),
                    })),
                  };
                }
                return {
                  in: vi.fn(() => ({
                    eq: vi.fn(async () => ({ count: 3, error: null })),
                  })),
                };
              }),
            };
          }
          if (table === "workspaces") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: { id: mockWorkspaceId, plan: "starter", status: "active" },
                    error: null,
                  })),
                })),
              })),
            };
          }
          if (table === "subscriptions" || table === "capacity_overrides") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({ data: null, error: null })),
                  eq: vi.fn(() => ({
                    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
                  })),
                })),
              })),
            };
          }
          if (table === "businesses") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  neq: vi.fn(async () => ({
                    data: [{ id: "biz-1" }, { id: "biz-2" }, { id: "biz-3" }],
                    error: null,
                  })),
                })),
              })),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient<Database>;

      const result = await checkSiteTransitionCapacity(
        mockSupabase,
        mockWorkspaceId,
        mockSiteId,
        "published",
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Live website limit reached");
    });

    it("blocks transition from archived to draft when draft allowance is reached", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "sites") {
            return {
              select: vi.fn((cols: string) => {
                if (cols === "id, status") {
                  return {
                    eq: vi.fn(() => ({
                      maybeSingle: vi.fn(async () => ({
                        data: { id: mockSiteId, status: "archived" },
                        error: null,
                      })),
                    })),
                  };
                }
                return {
                  in: vi.fn(() => ({
                    eq: vi.fn(async () => ({ count: 10, error: null })),
                  })),
                };
              }),
            };
          }
          if (table === "workspaces") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: { id: mockWorkspaceId, plan: "starter", status: "active" },
                    error: null,
                  })),
                })),
              })),
            };
          }
          if (table === "subscriptions" || table === "capacity_overrides") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({ data: null, error: null })),
                  eq: vi.fn(() => ({
                    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
                  })),
                })),
              })),
            };
          }
          if (table === "businesses") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  neq: vi.fn(async () => ({
                    data: [{ id: "biz-1" }],
                    error: null,
                  })),
                })),
              })),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient<Database>;

      const result = await checkSiteTransitionCapacity(
        mockSupabase,
        mockWorkspaceId,
        mockSiteId,
        "draft",
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Draft website allowance reached");
    });
  });

  describe("3. Team Seats & Resource Capacities", () => {
    it("measures team seats and locations correctly", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "workspaces") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: { id: mockWorkspaceId, plan: "starter", status: "active" },
                    error: null,
                  })),
                })),
              })),
            };
          }
          if (table === "subscriptions" || table === "capacity_overrides") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({ data: null, error: null })),
                  eq: vi.fn(() => ({
                    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
                  })),
                })),
              })),
            };
          }
          if (table === "workspace_members") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(async () => ({ count: 2, error: null })),
                })),
              })),
            };
          }
          if (table === "businesses") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  neq: vi.fn(async () => ({
                    data: [{ id: "biz-1" }],
                    error: null,
                  })),
                })),
              })),
            };
          }
          if (table === "locations") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(async () => ({ count: 1, error: null })),
              })),
            };
          }
          if (table === "catalogue_items") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(async () => ({ count: 25, error: null })),
              })),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient<Database>;

      const seatsUsage = await getCapacityUsage(mockSupabase, mockWorkspaceId, "team_seats");
      expect(seatsUsage.current).toBe(2);
      expect(seatsUsage.baseLimit).toBe(2);
      expect(seatsUsage.isExceeded).toBe(true);

      const locUsage = await getCapacityUsage(
        mockSupabase,
        mockWorkspaceId,
        "locations_per_business",
      );
      expect(locUsage.current).toBe(1);

      const catUsage = await getCapacityUsage(
        mockSupabase,
        mockWorkspaceId,
        "catalogue_items_per_business",
      );
      expect(catUsage.current).toBe(25);
    });
  });
});
