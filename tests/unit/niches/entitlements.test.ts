import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { canBusinessUseModule } from "@/lib/niches/service";

describe("VO-030 Entitlement Separation Invariant (5-Stage Evaluation)", () => {
  const mockBusinessId = "11111111-1111-1111-1111-111111111111";
  const mockWorkspaceId = "22222222-2222-2222-2222-222222222222";

  it("Stage 1: Rejects unregistered modules", async () => {
    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === "platform_modules") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({ data: null, error: null })),
              })),
            })),
          };
        }
        return {};
      }),
    } as unknown as SupabaseClient<Database>;

    const evalResult = await canBusinessUseModule(
      mockSupabase,
      mockBusinessId,
      "unregistered_crypto_miner",
    );

    expect(evalResult.allowed).toBe(false);
    expect(evalResult.reason).toContain("not registered");
  });

  it("Stage 2: Rejects registered but inactive/deprecated modules", async () => {
    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === "platform_modules") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: {
                    id: "mod-legacy",
                    key: "legacy_fax",
                    name: "Legacy Fax",
                    status: "deprecated",
                    category: "operations",
                    entitlement_feature_key: null,
                    display_order: 100,
                  },
                  error: null,
                })),
              })),
            })),
          };
        }
        return {};
      }),
    } as unknown as SupabaseClient<Database>;

    const evalResult = await canBusinessUseModule(mockSupabase, mockBusinessId, "legacy_fax");

    expect(evalResult.allowed).toBe(false);
    expect(evalResult.reason).toContain("deprecated");
  });

  it("Stage 3: Rejects registered active module if disabled for the business", async () => {
    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === "platform_modules") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: {
                    id: "mod-orders",
                    key: "orders",
                    name: "Order Management",
                    status: "active",
                    category: "commerce",
                    entitlement_feature_key: "orders",
                    display_order: 40,
                  },
                  error: null,
                })),
              })),
            })),
          };
        }
        if (table === "business_modules") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: { is_enabled: false },
                    error: null,
                  })),
                })),
              })),
            })),
          };
        }
        return {};
      }),
    } as unknown as SupabaseClient<Database>;

    const evalResult = await canBusinessUseModule(mockSupabase, mockBusinessId, "orders");

    expect(evalResult.allowed).toBe(false);
    expect(evalResult.isEnabled).toBe(false);
    expect(evalResult.reason).toContain("not enabled for this business");
  });

  it("Stage 4: Rejects module enabled by business if workspace plan does NOT entitle feature", async () => {
    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === "platform_modules") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: {
                    id: "mod-appointments",
                    key: "appointments",
                    name: "Appointments & Scheduling",
                    status: "active",
                    category: "operations",
                    entitlement_feature_key: "appointments",
                    display_order: 50,
                  },
                  error: null,
                })),
              })),
            })),
          };
        }
        if (table === "business_modules") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: { is_enabled: true },
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
                maybeSingle: vi.fn(async () => ({
                  data: { workspace_id: mockWorkspaceId },
                  error: null,
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
                  data: {
                    id: mockWorkspaceId,
                    plan: "starter", // Starter plan does NOT include appointments
                    status: "active",
                  },
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
                maybeSingle: vi.fn(async () => ({
                  data: null,
                  error: null,
                })),
              })),
            })),
          };
        }
        if (table === "entitlement_overrides") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: null,
                    error: null,
                  })),
                })),
              })),
            })),
          };
        }
        return {};
      }),
    } as unknown as SupabaseClient<Database>;

    const evalResult = await canBusinessUseModule(mockSupabase, mockBusinessId, "appointments");

    expect(evalResult.allowed).toBe(false);
    expect(evalResult.isEntitled).toBe(false);
    expect(evalResult.isEnabled).toBe(true);
    expect(evalResult.reason).toContain("appointments");
  });

  it("Stage 5: Grants access when module is active, enabled for business, and entitled by workspace plan", async () => {
    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === "platform_modules") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: {
                    id: "mod-appointments",
                    key: "appointments",
                    name: "Appointments & Scheduling",
                    status: "active",
                    category: "operations",
                    entitlement_feature_key: "appointments",
                    display_order: 50,
                  },
                  error: null,
                })),
              })),
            })),
          };
        }
        if (table === "business_modules") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: { is_enabled: true },
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
                maybeSingle: vi.fn(async () => ({
                  data: { workspace_id: mockWorkspaceId },
                  error: null,
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
                  data: {
                    id: mockWorkspaceId,
                    plan: "growth", // Growth plan entitles appointments
                    status: "active",
                  },
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
                maybeSingle: vi.fn(async () => ({
                  data: null,
                  error: null,
                })),
              })),
            })),
          };
        }
        if (table === "entitlement_overrides") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: null,
                    error: null,
                  })),
                })),
              })),
            })),
          };
        }
        return {};
      }),
    } as unknown as SupabaseClient<Database>;

    const evalResult = await canBusinessUseModule(mockSupabase, mockBusinessId, "appointments");

    expect(evalResult.allowed).toBe(true);
    expect(evalResult.isEntitled).toBe(true);
    expect(evalResult.isEnabled).toBe(true);
    expect(evalResult.reason).toBeUndefined();
  });

  it("Grants core modules like website_engine across all tiers without plan restrictions", async () => {
    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === "platform_modules") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: {
                    id: "mod-core",
                    key: "website_engine",
                    name: "Website Engine",
                    status: "active",
                    category: "core",
                    entitlement_feature_key: null,
                    display_order: 10,
                  },
                  error: null,
                })),
              })),
            })),
          };
        }
        if (table === "business_modules") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: { is_enabled: true },
                    error: null,
                  })),
                })),
              })),
            })),
          };
        }
        return {};
      }),
    } as unknown as SupabaseClient<Database>;

    const evalResult = await canBusinessUseModule(mockSupabase, mockBusinessId, "website_engine");

    expect(evalResult.allowed).toBe(true);
    expect(evalResult.isEntitled).toBe(true);
  });
});
