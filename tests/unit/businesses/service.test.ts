import { describe, expect, it, vi } from "vitest";
import {
  createBusiness,
  getBusiness,
  updateBusinessProfile,
  createLocation,
  addBusinessMember,
  updateBusinessMemberRole,
  removeBusinessMember,
} from "@/lib/businesses/service";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

describe("Business & Location Service Layer [VO-023]", () => {
  const mockOwnerId = "usr-owner-00000000-0001";
  const mockStaffId = "usr-stf-00000000-0003";
  const mockWorkspaceId = "ws-reseller-00000001";
  const mockBusinessId = "biz-kirana-00000001";
  const mockLocationId = "loc-main-00000001";

  describe("1. createBusiness()", () => {
    it("creates a DIY business with caller as sovereign_owner_id, primary location, and owner member", async () => {
      const insertedBusinesses: unknown[] = [];
      const insertedLocations: unknown[] = [];
      const insertedMembers: unknown[] = [];
      const insertedAuditLogs: unknown[] = [];

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "businesses") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({ data: null })),
                })),
              })),
              insert: vi.fn((data: unknown) => {
                insertedBusinesses.push(data);
                return {
                  select: vi.fn(() => ({
                    single: vi.fn(async () => ({
                      data: { id: mockBusinessId, ...(data as object) },
                      error: null,
                    })),
                  })),
                };
              }),
            };
          }
          if (table === "locations") {
            return {
              insert: vi.fn((data: unknown) => {
                insertedLocations.push(data);
                return {
                  select: vi.fn(() => ({
                    single: vi.fn(async () => ({
                      data: { id: mockLocationId, ...(data as object) },
                      error: null,
                    })),
                  })),
                };
              }),
            };
          }
          if (table === "business_members") {
            return {
              insert: vi.fn(async (data: unknown) => {
                insertedMembers.push(data);
                return { error: null };
              }),
            };
          }
          if (table === "audit_logs") {
            return {
              insert: vi.fn(async (data: unknown) => {
                insertedAuditLogs.push(data);
                return { error: null };
              }),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient<Database>;

      const result = await createBusiness(mockSupabase, mockOwnerId, {
        trade_name: "Sharma General Store",
        legal_name: "Sharma Enterprises Pvt Ltd",
        slug: "sharma-general-store",
        location_name: "Main Branch",
        address_line1: "100 MG Road",
        city: "Bengaluru",
        state: "Karnataka",
        postal_code: "560001",
      });

      expect(result.business.id).toBe(mockBusinessId);
      expect(result.business.sovereign_owner_id).toBe(mockOwnerId);
      expect(result.business.workspace_id).toBeNull();
      expect(result.primaryLocation?.id).toBe(mockLocationId);
      expect(result.primaryLocation?.is_primary).toBe(true);
      expect(result.currentUserRole).toBe("owner");
      expect(result.isSovereignOwner).toBe(true);

      // Verify DB inserts
      expect(insertedBusinesses.length).toBe(1);
      expect(insertedLocations.length).toBe(1);
      expect(insertedMembers.length).toBe(1);
      expect(insertedAuditLogs.length).toBe(1);
    });

    it("creates a reseller-managed business when caller has workspace management rights", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "workspace_members") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    eq: vi.fn(() => ({
                      maybeSingle: vi.fn(async () => ({
                        data: { role: "reseller_admin", status: "active" },
                        error: null,
                      })),
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
                  maybeSingle: vi.fn(async () => ({ data: null })),
                })),
              })),
              insert: vi.fn((data: unknown) => ({
                select: vi.fn(() => ({
                  single: vi.fn(async () => ({
                    data: { id: mockBusinessId, ...(data as object) },
                    error: null,
                  })),
                })),
              })),
            };
          }
          if (table === "locations") {
            return {
              insert: vi.fn((data: unknown) => ({
                select: vi.fn(() => ({
                  single: vi.fn(async () => ({
                    data: { id: mockLocationId, ...(data as object) },
                    error: null,
                  })),
                })),
              })),
            };
          }
          if (table === "business_members" || table === "audit_logs") {
            return {
              insert: vi.fn(async () => ({ error: null })),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient<Database>;

      const result = await createBusiness(mockSupabase, mockOwnerId, {
        trade_name: "Client Boutique",
        legal_name: "Boutique Retail LLP",
        workspace_id: mockWorkspaceId,
        location_name: "Flagship",
        address_line1: "42 Brigade Road",
        city: "Bengaluru",
        state: "Karnataka",
        postal_code: "560025",
      });

      expect(result.business.workspace_id).toBe(mockWorkspaceId);
    });

    it("rejects business creation if caller lacks workspace management permissions", async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({ data: null })),
                })),
              })),
            })),
          })),
        })),
      } as unknown as SupabaseClient<Database>;

      await expect(
        createBusiness(mockSupabase, mockOwnerId, {
          trade_name: "Denied Store",
          legal_name: "Denied Legal",
          workspace_id: mockWorkspaceId,
          location_name: "Main",
          address_line1: "Road 1",
          city: "Bengaluru",
          state: "Karnataka",
          postal_code: "560001",
        }),
      ).rejects.toThrow("You do not have management permissions in the specified workspace");
    });

    it("rejects duplicate slug with SLUG_CONFLICT (409)", async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: { id: "existing-id" } })),
            })),
          })),
        })),
      } as unknown as SupabaseClient<Database>;

      await expect(
        createBusiness(mockSupabase, mockOwnerId, {
          trade_name: "Existing Store",
          legal_name: "Existing Store Pvt Ltd",
          slug: "existing-slug",
          location_name: "Main",
          address_line1: "Road 1",
          city: "Bengaluru",
          state: "Karnataka",
          postal_code: "560001",
        }),
      ).rejects.toThrow("A business with this slug already exists");
    });
  });

  describe("2. getBusiness()", () => {
    it("returns business and locations for sovereign owner", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "businesses") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: {
                      id: mockBusinessId,
                      sovereign_owner_id: mockOwnerId,
                      workspace_id: null,
                    },
                  })),
                  single: vi.fn(async () => ({
                    data: {
                      id: mockBusinessId,
                      trade_name: "Sharma General Store",
                      legal_name: "Sharma Enterprises",
                      slug: "sharma-general-store",
                      sovereign_owner_id: mockOwnerId,
                      workspace_id: null,
                      status: "active",
                    },
                    error: null,
                  })),
                })),
              })),
            };
          }
          if (table === "business_members") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    eq: vi.fn(() => ({
                      maybeSingle: vi.fn(async () => ({
                        data: { role: "owner", status: "active" },
                      })),
                    })),
                  })),
                })),
              })),
            };
          }
          if (table === "locations") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  order: vi.fn(() => ({
                    order: vi.fn(async () => ({
                      data: [
                        {
                          id: mockLocationId,
                          name: "Main Branch",
                          is_primary: true,
                          city: "Bengaluru",
                        },
                      ],
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

      const result = await getBusiness(mockSupabase, mockBusinessId, mockOwnerId);
      expect(result.business.id).toBe(mockBusinessId);
      expect(result.isSovereignOwner).toBe(true);
      expect(result.primaryLocation?.name).toBe("Main Branch");
    });

    it("throws FORBIDDEN (403) for unauthorized user", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "businesses") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: {
                      id: mockBusinessId,
                      sovereign_owner_id: "other-user",
                      workspace_id: null,
                    },
                  })),
                })),
              })),
            };
          }
          if (table === "business_members") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    eq: vi.fn(() => ({
                      maybeSingle: vi.fn(async () => ({ data: null })),
                    })),
                  })),
                })),
              })),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient<Database>;

      await expect(getBusiness(mockSupabase, mockBusinessId, "intruder-id")).rejects.toThrow(
        "You do not have access to this business",
      );
    });
  });

  describe("3. updateBusinessProfile()", () => {
    it("allows sovereign owner to update trade name and statutory fields", async () => {
      const updatedFields: unknown[] = [];
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "businesses") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: {
                      id: mockBusinessId,
                      sovereign_owner_id: mockOwnerId,
                      workspace_id: null,
                    },
                  })),
                })),
              })),
              update: vi.fn((data: unknown) => {
                updatedFields.push(data);
                return {
                  eq: vi.fn(() => ({
                    select: vi.fn(() => ({
                      single: vi.fn(async () => ({
                        data: { id: mockBusinessId, ...(data as object) },
                        error: null,
                      })),
                    })),
                  })),
                };
              }),
            };
          }
          if (table === "business_members") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    eq: vi.fn(() => ({
                      maybeSingle: vi.fn(async () => ({
                        data: { role: "owner", status: "active" },
                      })),
                    })),
                  })),
                })),
              })),
            };
          }
          if (table === "audit_logs") {
            return {
              insert: vi.fn(async () => ({ error: null })),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient<Database>;

      const updated = await updateBusinessProfile(mockSupabase, mockBusinessId, mockOwnerId, {
        trade_name: "Sharma Superstore",
        gst_number: "29AAAAA0000A1Z5",
      });

      expect(updated.trade_name).toBe("Sharma Superstore");
      expect(updatedFields.length).toBe(1);
    });

    it("rejects profile updates from staff without permission", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "businesses") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: {
                      id: mockBusinessId,
                      sovereign_owner_id: mockOwnerId,
                      workspace_id: null,
                    },
                  })),
                })),
              })),
            };
          }
          if (table === "business_members") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    eq: vi.fn(() => ({
                      maybeSingle: vi.fn(async () => ({
                        data: { role: "staff", status: "active" },
                      })),
                    })),
                  })),
                })),
              })),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient<Database>;

      await expect(
        updateBusinessProfile(mockSupabase, mockBusinessId, mockStaffId, {
          trade_name: "Hacked Store",
        }),
      ).rejects.toThrow("You do not have permission to update this business profile");
    });
  });

  describe("4. Location Management & Primary Invariant", () => {
    it("unsets previous primary location when creating new primary location", async () => {
      const unsetCalls: unknown[] = [];
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "businesses") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: {
                      id: mockBusinessId,
                      sovereign_owner_id: mockOwnerId,
                      workspace_id: null,
                    },
                  })),
                })),
              })),
            };
          }
          if (table === "business_members") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    eq: vi.fn(() => ({
                      maybeSingle: vi.fn(async () => ({
                        data: { role: "owner", status: "active" },
                      })),
                    })),
                  })),
                })),
              })),
            };
          }
          if (table === "locations") {
            return {
              update: vi.fn((data: unknown) => {
                unsetCalls.push(data);
                return {
                  eq: vi.fn(() => ({
                    eq: vi.fn(async () => ({ error: null })),
                  })),
                };
              }),
              insert: vi.fn((data: unknown) => ({
                select: vi.fn(() => ({
                  single: vi.fn(async () => ({
                    data: { id: "loc-new-002", ...(data as object) },
                    error: null,
                  })),
                })),
              })),
            };
          }
          if (table === "audit_logs") {
            return {
              insert: vi.fn(async () => ({ error: null })),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient<Database>;

      const newLoc = await createLocation(mockSupabase, mockBusinessId, mockOwnerId, {
        business_id: mockBusinessId,
        name: "Branch 2",
        address_line1: "50 Commercial St",
        city: "Bengaluru",
        state: "Karnataka",
        postal_code: "560001",
        is_primary: true,
      });

      expect(newLoc.name).toBe("Branch 2");
      expect(newLoc.is_primary).toBe(true);
      expect(unsetCalls.length).toBe(1);
      expect(unsetCalls[0]).toEqual({ is_primary: false });
    });
  });

  describe("5. Member Management & Last-Owner Protection", () => {
    const createMockBuilder = (
      resultData: unknown,
      countVal?: number | null,
      errorVal: unknown = null,
    ) => {
      const builder: Record<string, unknown> = {
        then: vi.fn((resolve) => resolve({ data: resultData, error: errorVal, count: countVal })),
      };
      builder.eq = vi.fn(() => builder);
      builder.order = vi.fn(() => builder);
      builder.single = vi.fn(async () => ({ data: resultData, error: errorVal }));
      builder.maybeSingle = vi.fn(async () => ({ data: resultData, error: errorVal }));
      return builder;
    };

    it("prohibits demoting the sole owner of a business", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "businesses") {
            return {
              select: vi.fn(() =>
                createMockBuilder({
                  id: mockBusinessId,
                  sovereign_owner_id: mockOwnerId,
                  workspace_id: null,
                }),
              ),
            };
          }
          if (table === "business_members") {
            return {
              select: vi.fn((_cols: unknown, options?: { count?: string }) => {
                if (options?.count === "exact") {
                  return createMockBuilder(null, 1);
                }
                return createMockBuilder({
                  id: "bm-001",
                  role: "owner",
                  status: "active",
                });
              }),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient<Database>;

      await expect(
        updateBusinessMemberRole(mockSupabase, mockBusinessId, mockOwnerId, mockOwnerId, {
          role: "manager",
        }),
      ).rejects.toThrow("Cannot demote or deactivate the sole owner of the business");
    });

    it("prohibits removing the sole owner of a business", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "businesses") {
            return {
              select: vi.fn(() =>
                createMockBuilder({
                  id: mockBusinessId,
                  sovereign_owner_id: mockOwnerId,
                  workspace_id: null,
                }),
              ),
            };
          }
          if (table === "business_members") {
            return {
              select: vi.fn((_cols: unknown, options?: { count?: string }) => {
                if (options?.count === "exact") {
                  return createMockBuilder(null, 1);
                }
                return createMockBuilder({
                  id: "bm-001",
                  role: "owner",
                  status: "active",
                });
              }),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient<Database>;

      await expect(
        removeBusinessMember(mockSupabase, mockBusinessId, mockOwnerId, mockOwnerId),
      ).rejects.toThrow("Cannot remove the sole owner of the business");
    });

    it("successfully removes a member when downward authority is held", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "businesses") {
            return {
              select: vi.fn(() =>
                createMockBuilder({
                  id: mockBusinessId,
                  sovereign_owner_id: mockOwnerId,
                  workspace_id: null,
                }),
              ),
            };
          }
          if (table === "business_members") {
            return {
              select: vi.fn(() =>
                createMockBuilder({
                  id: "bm-002",
                  role: "staff",
                  status: "active",
                }),
              ),
              delete: vi.fn(() => createMockBuilder(null)),
            };
          }
          if (table === "audit_logs") {
            return {
              insert: vi.fn(() => createMockBuilder(null)),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient<Database>;

      const res = await removeBusinessMember(
        mockSupabase,
        mockBusinessId,
        "u0000000-0000-0000-0000-000000000002",
        mockOwnerId,
      );
      expect(res.success).toBe(true);
    });

    it("throws when target member is not found", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "businesses") {
            return {
              select: vi.fn(() =>
                createMockBuilder({
                  id: mockBusinessId,
                  sovereign_owner_id: mockOwnerId,
                  workspace_id: null,
                }),
              ),
            };
          }
          if (table === "business_members") {
            return {
              select: vi.fn(() => createMockBuilder(null, null, new Error("Not found"))),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient<Database>;

      await expect(
        removeBusinessMember(mockSupabase, mockBusinessId, "u-unknown", mockOwnerId),
      ).rejects.toThrow("Target member not found");
    });

    it("throws when caller does not have downward authority to remove target member", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "businesses") {
            return {
              select: vi.fn(() =>
                createMockBuilder({
                  id: mockBusinessId,
                  sovereign_owner_id: "usr-other-owner",
                  workspace_id: null,
                }),
              ),
            };
          }
          if (table === "business_members") {
            return {
              select: vi.fn((_cols: unknown) => {
                // Return caller role or target member role
                const builder = createMockBuilder({
                  id: "bm-target",
                  role: "manager",
                  status: "active",
                });
                return builder;
              }),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient<Database>;

      // Manager trying to remove another manager (rank 30 vs 30) -> rank must be strictly greater
      await expect(
        removeBusinessMember(mockSupabase, mockBusinessId, "usr-target-mgr", "usr-caller-mgr"),
      ).rejects.toThrow(/cannot remove a member with role manager/);
    });

    it("prohibits staff from adding new members", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "businesses") {
            return {
              select: vi.fn(() =>
                createMockBuilder({
                  id: mockBusinessId,
                  sovereign_owner_id: "usr-other-owner",
                  workspace_id: null,
                }),
              ),
            };
          }
          if (table === "business_members") {
            return {
              select: vi.fn(() =>
                createMockBuilder({
                  id: "bm-staff",
                  role: "staff",
                  status: "active",
                }),
              ),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient<Database>;

      await expect(
        addBusinessMember(mockSupabase, "usr-staff", {
          business_id: mockBusinessId,
          user_id: "usr-new",
          role: "cashier",
        }),
      ).rejects.toThrow("You do not have permission to add members to this business");
    });

    it("prohibits staff from removing members", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "businesses") {
            return {
              select: vi.fn(() =>
                createMockBuilder({
                  id: mockBusinessId,
                  sovereign_owner_id: "usr-other-owner",
                  workspace_id: null,
                }),
              ),
            };
          }
          if (table === "business_members") {
            return {
              select: vi.fn(() =>
                createMockBuilder({
                  id: "bm-staff",
                  role: "staff",
                  status: "active",
                }),
              ),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient<Database>;

      await expect(
        removeBusinessMember(mockSupabase, mockBusinessId, "usr-target", "usr-staff"),
      ).rejects.toThrow("You do not have permission to remove members from this business");
    });

    it("throws when database delete returns error in removeBusinessMember", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "businesses") {
            return {
              select: vi.fn(() =>
                createMockBuilder({
                  id: mockBusinessId,
                  sovereign_owner_id: mockOwnerId,
                  workspace_id: null,
                }),
              ),
            };
          }
          if (table === "business_members") {
            return {
              select: vi.fn(() =>
                createMockBuilder({
                  id: "bm-staff",
                  role: "staff",
                  status: "active",
                }),
              ),
              delete: vi.fn(() => ({
                eq: vi.fn(async () => ({ error: { message: "DB connection dropped" } })),
              })),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient<Database>;

      await expect(
        removeBusinessMember(mockSupabase, mockBusinessId, "usr-staff", mockOwnerId),
      ).rejects.toThrow("DB connection dropped");
    });
  });
});
