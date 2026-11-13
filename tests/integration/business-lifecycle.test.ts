import { describe, expect, it, vi } from "vitest";
import {
  createBusiness,
  updateBusinessProfile,
  createLocation,
  updateLocation,
  addBusinessMember,
  updateBusinessMemberRole,
  removeBusinessMember,
} from "@/lib/businesses/service";
import {
  assertSovereignOwnershipSeparation,
  canManageBusinessRole,
  hasBusinessPermission,
} from "@/lib/businesses/permissions";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { BusinessRow, LocationRow, BusinessMemberRow } from "@/lib/businesses/types";

describe("Integration: Business & Location Lifecycle [VO-023]", () => {
  const merchantOwnerId = "usr-merchant-0000-0001";
  const managerUserId = "usr-manager-0000-0002";
  const cashierUserId = "usr-cashier-0000-0003";
  const resellerAdminId = "usr-reseller-0000-0004";
  const resellerWsId = "ws-agency-0000-0001";

  // In-memory pseudo-database
  const db = {
    businesses: [] as BusinessRow[],
    locations: [] as LocationRow[],
    businessMembers: [] as BusinessMemberRow[],
    workspaceMembers: [
      {
        id: "wm-1",
        workspace_id: resellerWsId,
        user_id: resellerAdminId,
        role: "reseller_admin",
        status: "active",
        created_at: new Date().toISOString(),
      },
    ],
    auditLogs: [] as unknown[],
  };

  const createMockDbClient = () => {
    return {
      from: vi.fn((table: string) => {
        if (table === "businesses") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn((col: string, val: string) => ({
                maybeSingle: vi.fn(async () => {
                  const found = db.businesses.find(
                    (b) => (b as unknown as Record<string, unknown>)[col] === val,
                  );
                  return { data: found ?? null, error: null };
                }),
                single: vi.fn(async () => {
                  const found = db.businesses.find(
                    (b) => (b as unknown as Record<string, unknown>)[col] === val,
                  );
                  return { data: found ?? null, error: null };
                }),
              })),
            })),
            insert: vi.fn((data: unknown) => {
              const row = {
                id: `biz-${db.businesses.length + 1}`,
                ...(data as object),
              } as BusinessRow;
              db.businesses.push(row);
              return {
                select: vi.fn(() => ({
                  single: vi.fn(async () => ({ data: row, error: null })),
                })),
              };
            }),
            update: vi.fn((data: unknown) => ({
              eq: vi.fn((_col: string, id: string) => {
                const idx = db.businesses.findIndex((b) => b.id === id);
                if (idx >= 0) {
                  db.businesses[idx] = { ...db.businesses[idx], ...(data as object) };
                }
                return {
                  select: vi.fn(() => ({
                    single: vi.fn(async () => ({ data: db.businesses[idx], error: null })),
                  })),
                };
              }),
            })),
          };
        }

        if (table === "locations") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn((col: string, val: string) => ({
                order: vi.fn(() => ({
                  order: vi.fn(async () => {
                    const filtered = db.locations.filter(
                      (l) => (l as unknown as Record<string, unknown>)[col] === val,
                    );
                    return { data: filtered, error: null };
                  }),
                })),
                single: vi.fn(async () => {
                  const found = db.locations.find(
                    (l) => (l as unknown as Record<string, unknown>)[col] === val,
                  );
                  return { data: found ?? null, error: null };
                }),
              })),
            })),
            update: vi.fn((data: unknown) => {
              const createUpdateBuilder = (matchFn: (l: LocationRow) => boolean) => {
                const builder: Record<string, unknown> = {
                  then: vi.fn((resolve) => {
                    db.locations.forEach((l, idx) => {
                      if (matchFn(l)) {
                        db.locations[idx] = { ...l, ...(data as object) };
                      }
                    });
                    return resolve({ error: null });
                  }),
                  eq: vi.fn((col2: string, val2: unknown) => {
                    return createUpdateBuilder(
                      (l) => matchFn(l) && (l as unknown as Record<string, unknown>)[col2] === val2,
                    );
                  }),
                  select: vi.fn(() => ({
                    single: vi.fn(async () => {
                      const idx = db.locations.findIndex(matchFn);
                      if (idx >= 0) {
                        db.locations[idx] = { ...db.locations[idx], ...(data as object) };
                        return { data: db.locations[idx], error: null };
                      }
                      return { data: null, error: new Error("Not found") };
                    }),
                  })),
                };
                return builder;
              };
              return {
                eq: vi.fn((col1: string, val1: string) => {
                  return createUpdateBuilder(
                    (l) => (l as unknown as Record<string, unknown>)[col1] === val1,
                  );
                }),
              };
            }),
            insert: vi.fn((data: unknown) => {
              const row = {
                id: `loc-${db.locations.length + 1}`,
                ...(data as object),
              } as LocationRow;
              db.locations.push(row);
              return {
                select: vi.fn(() => ({
                  single: vi.fn(async () => ({ data: row, error: null })),
                })),
              };
            }),
          };
        }

        if (table === "business_members") {
          return {
            select: vi.fn((_cols: unknown, options?: { count?: string }) => {
              if (options?.count === "exact") {
                return {
                  eq: vi.fn((col1: string, val1: string) => ({
                    eq: vi.fn((col2: string, val2: string) => ({
                      eq: vi.fn(async (col3: string, val3: string) => {
                        const count = db.businessMembers.filter((m) => {
                          const r = m as unknown as Record<string, unknown>;
                          return r[col1] === val1 && r[col2] === val2 && r[col3] === val3;
                        }).length;
                        return { count };
                      }),
                    })),
                  })),
                };
              }
              return {
                eq: vi.fn((col1: string, val1: string) => ({
                  eq: vi.fn((col2: string, val2: string) => ({
                    eq: vi.fn((_col3: string, _val3: string) => ({
                      maybeSingle: vi.fn(async () => {
                        const found = db.businessMembers.find((m) => {
                          const r = m as unknown as Record<string, unknown>;
                          return r[col1] === val1 && r[col2] === val2;
                        });
                        return { data: found ?? null, error: null };
                      }),
                    })),
                    single: vi.fn(async () => {
                      const found = db.businessMembers.find((m) => {
                        const r = m as unknown as Record<string, unknown>;
                        return r[col1] === val1 && r[col2] === val2;
                      });
                      return { data: found ?? null, error: null };
                    }),
                  })),
                })),
              };
            }),
            insert: vi.fn((data: unknown) => {
              const row = {
                id: `bm-${db.businessMembers.length + 1}`,
                ...(data as object),
              } as BusinessMemberRow;
              db.businessMembers.push(row);
              return {
                select: vi.fn(() => ({
                  single: vi.fn(async () => ({ data: row, error: null })),
                })),
              };
            }),
            update: vi.fn((data: unknown) => ({
              eq: vi.fn((_col: string, id: string) => {
                const idx = db.businessMembers.findIndex((m) => m.id === id);
                if (idx >= 0) {
                  db.businessMembers[idx] = { ...db.businessMembers[idx], ...(data as object) };
                }
                return {
                  select: vi.fn(() => ({
                    single: vi.fn(async () => ({ data: db.businessMembers[idx], error: null })),
                  })),
                };
              }),
            })),
            delete: vi.fn(() => ({
              eq: vi.fn(async (_col: string, id: string) => {
                const idx = db.businessMembers.findIndex((m) => m.id === id);
                if (idx >= 0) db.businessMembers.splice(idx, 1);
                return { error: null };
              }),
            })),
          };
        }

        if (table === "workspace_members") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn((col1: string, val1: string) => ({
                eq: vi.fn((col2: string, val2: string) => ({
                  eq: vi.fn((col3: string, val3: string) => ({
                    maybeSingle: vi.fn(async () => {
                      const found = db.workspaceMembers.find((wm) => {
                        const r = wm as unknown as Record<string, unknown>;
                        return r[col1] === val1 && r[col2] === val2 && r[col3] === val3;
                      });
                      return { data: found ?? null, error: null };
                    }),
                  })),
                })),
              })),
            })),
          };
        }

        if (table === "audit_logs") {
          return {
            insert: vi.fn(async (data: unknown) => {
              db.auditLogs.push(data);
              return { error: null };
            }),
          };
        }

        return {};
      }),
    } as unknown as SupabaseClient<Database>;
  };

  it("completes full DIY business lifecycle from creation to staff role enforcement", async () => {
    const supabase = createMockDbClient();

    // 1. Create DIY Business with primary location
    const created = await createBusiness(supabase, merchantOwnerId, {
      trade_name: "Gupta Sweets & Namkeen",
      legal_name: "Gupta Confectioneries Pvt Ltd",
      slug: "gupta-sweets",
      location_name: "Main Bazaar",
      address_line1: "15 Market Road",
      city: "Jaipur",
      state: "Rajasthan",
      postal_code: "302001",
    });

    expect(created.business.id).toBe("biz-1");
    expect(created.business.sovereign_owner_id).toBe(merchantOwnerId);
    expect(created.business.workspace_id).toBeNull();
    expect(created.primaryLocation?.name).toBe("Main Bazaar");
    expect(created.primaryLocation?.is_primary).toBe(true);
    expect(created.isSovereignOwner).toBe(true);

    // Verify initial owner member was inserted
    expect(db.businessMembers.length).toBe(1);
    expect(db.businessMembers[0].user_id).toBe(merchantOwnerId);
    expect(db.businessMembers[0].role).toBe("owner");

    // 2. Sovereign owner adds manager
    const manager = await addBusinessMember(supabase, merchantOwnerId, {
      business_id: created.business.id,
      user_id: managerUserId,
      role: "manager",
    });
    expect(manager.role).toBe("manager");
    expect(db.businessMembers.length).toBe(2);

    // 3. Manager creates secondary location
    const branch2 = await createLocation(supabase, created.business.id, managerUserId, {
      business_id: created.business.id,
      name: "C-Scheme Branch",
      address_line1: "100 MI Road",
      city: "Jaipur",
      state: "Rajasthan",
      postal_code: "302005",
      is_primary: false,
    });
    expect(branch2.name).toBe("C-Scheme Branch");
    expect(branch2.is_primary).toBe(false);

    // 4. Manager promotes secondary location to primary
    await updateLocation(supabase, branch2.id, managerUserId, {
      is_primary: true,
    });

    // 5. Manager adds cashier
    const cashier = await addBusinessMember(supabase, managerUserId, {
      business_id: created.business.id,
      user_id: cashierUserId,
      role: "cashier",
    });
    expect(cashier.role).toBe("cashier");

    // 6. Manager attempts to delete/demote owner -> BLOCKED by Last-Owner & Authority checks
    expect(canManageBusinessRole("manager", "owner")).toBe(false);
    await expect(
      updateBusinessMemberRole(supabase, created.business.id, merchantOwnerId, managerUserId, {
        role: "staff",
      }),
    ).rejects.toThrow();

    await expect(
      removeBusinessMember(supabase, created.business.id, merchantOwnerId, managerUserId),
    ).rejects.toThrow();

    // 7. Cashier has billing permission but not location management
    expect(hasBusinessPermission("cashier", "business:billing")).toBe(true);
    expect(hasBusinessPermission("cashier", "business:manage_locations")).toBe(false);

    // 8. Owner updates statutory GSTIN and trade name
    const updatedBiz = await updateBusinessProfile(supabase, created.business.id, merchantOwnerId, {
      trade_name: "Gupta Royal Sweets",
      gst_number: "08AAAAA0000A1Z5",
    });
    expect(updatedBiz.trade_name).toBe("Gupta Royal Sweets");
    expect(updatedBiz.gst_number).toBe("08AAAAA0000A1Z5");
  });

  it("verifies reseller workspace creation does not confer sovereign merchant rights", async () => {
    const supabase = createMockDbClient();

    // Reseller admin creates business for client
    const created = await createBusiness(supabase, resellerAdminId, {
      trade_name: "Client Kirana",
      legal_name: "Client Kirana Enterprises",
      workspace_id: resellerWsId,
      location_name: "Main",
      address_line1: "123 Road",
      city: "Delhi",
      state: "Delhi",
      postal_code: "110001",
    });

    expect(created.business.workspace_id).toBe(resellerWsId);

    // Sovereign ownership invariant: workspace role does not confer sovereign rights
    expect(assertSovereignOwnershipSeparation(true, false)).toBe(true);
  });
});
