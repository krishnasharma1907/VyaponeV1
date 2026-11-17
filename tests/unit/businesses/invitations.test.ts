import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import {
  createBusinessInvitation,
  listBusinessInvitations,
  revokeBusinessInvitation,
  acceptBusinessInvitation,
  removeBusinessMember,
} from "@/lib/businesses/service";
import {
  inviteBusinessMemberAction,
  listBusinessInvitationsAction,
  revokeBusinessInvitationAction,
  acceptBusinessInvitationAction,
} from "@/lib/businesses/actions";
import * as serverSupabase from "@/lib/supabase/server";

// Mock server-only to allow Server Action testing inside Vitest environment
vi.mock("server-only", () => ({}));

describe("Business Operational Invitations & Membership Lifecycle [VO-027]", () => {
  const mockBusinessId = "b1000000-0000-4000-8000-000000000001";
  const mockOwnerId = "a0000000-0000-4000-8000-000000000001";
  const mockManagerId = "a0000000-0000-4000-8000-000000000002";
  const mockCashierId = "a0000000-0000-4000-8000-000000000003";
  const mockAcceptingUserId = "a0000000-0000-4000-8000-000000000004";
  const mockInvitationId = "c1000000-0000-4000-8000-000000000001";

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("createBusinessInvitation", () => {
    it("rejects unauthorized member (cashier or staff) attempting to invite", async () => {
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
                        data: { role: "cashier", status: "active" },
                        error: null,
                      })),
                    })),
                  })),
                })),
              })),
            };
          }
          throw new Error(`Unexpected table ${table}`);
        }),
      } as unknown as SupabaseClient<Database>;

      await expect(
        createBusinessInvitation(mockSupabase, mockCashierId, {
          business_id: mockBusinessId,
          email: "newcashier@store.in",
          role: "cashier",
        }),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        status: 403,
      });
    });

    it("enforces hierarchy authority: business manager cannot invite an owner", async () => {
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
                        data: { role: "manager", status: "active" },
                        error: null,
                      })),
                    })),
                  })),
                })),
              })),
            };
          }
          throw new Error(`Unexpected table ${table}`);
        }),
      } as unknown as SupabaseClient<Database>;

      await expect(
        createBusinessInvitation(mockSupabase, mockManagerId, {
          business_id: mockBusinessId,
          email: "anotherowner@store.in",
          role: "owner",
        }),
      ).rejects.toMatchObject({
        code: "INSUFFICIENT_ROLE_AUTHORITY",
        status: 403,
      });
    });

    it("rejects duplicate pending invitation for the same email and business", async () => {
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
                        error: null,
                      })),
                    })),
                  })),
                })),
              })),
            };
          }
          if (table === "users") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({ data: null, error: null })),
                })),
              })),
            };
          }
          if (table === "business_invitations") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    eq: vi.fn(() => ({
                      gt: vi.fn(() => ({
                        maybeSingle: vi.fn(async () => ({
                          data: { id: mockInvitationId, status: "pending" },
                          error: null,
                        })),
                      })),
                    })),
                  })),
                })),
              })),
            };
          }
          throw new Error(`Unexpected table ${table}`);
        }),
      } as unknown as SupabaseClient<Database>;

      await expect(
        createBusinessInvitation(mockSupabase, mockOwnerId, {
          business_id: mockBusinessId,
          email: "pending@store.in",
          role: "staff",
        }),
      ).rejects.toMatchObject({
        code: "DUPLICATE_INVITATION",
        status: 409,
      });
    });

    it("successfully creates business invitation and returns raw 64-char token", async () => {
      let insertedInvitation: Record<string, unknown> | null = null;
      let insertedAudit: Record<string, unknown> | null = null;

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
                        error: null,
                      })),
                    })),
                  })),
                })),
              })),
            };
          }
          if (table === "users") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({ data: null, error: null })),
                })),
              })),
            };
          }
          if (table === "business_invitations") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    eq: vi.fn(() => ({
                      gt: vi.fn(() => ({
                        maybeSingle: vi.fn(async () => ({ data: null, error: null })),
                      })),
                    })),
                  })),
                })),
              })),
              insert: vi.fn((payload: Record<string, unknown>) => ({
                select: vi.fn(() => ({
                  single: vi.fn(async () => {
                    insertedInvitation = payload;
                    return {
                      data: {
                        id: mockInvitationId,
                        business_id: mockBusinessId,
                        email: payload.email as string,
                        role: payload.role as string,
                        token_hash: payload.token_hash as string,
                        invited_by: mockOwnerId,
                        status: "pending",
                        expires_at: payload.expires_at as string,
                        created_at: new Date().toISOString(),
                      },
                      error: null,
                    };
                  }),
                })),
              })),
            };
          }
          if (table === "audit_logs") {
            return {
              insert: vi.fn((payload: Record<string, unknown>) => {
                insertedAudit = payload;
                return {
                  select: vi.fn(() => ({
                    single: vi.fn(async () => ({
                      data: {
                        id: "audit-1",
                        business_id: payload.business_id,
                        workspace_id: payload.workspace_id,
                        user_id: payload.user_id,
                        action: payload.action,
                        resource: payload.resource,
                        metadata_json: payload.metadata_json,
                        ip_address: null,
                        created_at: new Date().toISOString(),
                      },
                      error: null,
                    })),
                  })),
                  error: null,
                };
              }),
            };
          }
          throw new Error(`Unexpected table ${table}`);
        }),
      } as unknown as SupabaseClient<Database>;

      const result = await createBusinessInvitation(mockSupabase, mockOwnerId, {
        business_id: mockBusinessId,
        email: "newstaff@store.in",
        role: "staff",
      });

      expect(result.invitation.id).toBe(mockInvitationId);
      expect(result.invitation.email).toBe("newstaff@store.in");
      expect(result.rawToken).toHaveLength(64);
      expect(result.rawToken).toMatch(/^[a-f0-9]{64}$/);
      expect(insertedInvitation).toBeDefined();
      const invData = insertedInvitation as unknown as Record<string, unknown>;
      expect(invData.token_hash).toHaveLength(64);
      expect(invData.token_hash).not.toBe(result.rawToken);
      expect(insertedAudit).toBeDefined();
      const auditData = insertedAudit as unknown as Record<string, unknown>;
      expect(auditData.action).toBe("business.member_invited");
    });
  });

  describe("listBusinessInvitations", () => {
    it("returns pending business invitations with inviter profile", async () => {
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
                        error: null,
                      })),
                    })),
                  })),
                })),
              })),
            };
          }
          if (table === "business_invitations") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  order: vi.fn(async () => ({
                    data: [
                      {
                        id: mockInvitationId,
                        business_id: mockBusinessId,
                        email: "pending@store.in",
                        role: "cashier",
                        token_hash: "hashxyz",
                        invited_by: mockOwnerId,
                        status: "pending",
                        expires_at: new Date(Date.now() + 86400 * 1000).toISOString(),
                        accepted_at: null,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                        users: {
                          id: mockOwnerId,
                          display_name: "Store Owner",
                          email: "owner@store.in",
                        },
                      },
                    ],
                    error: null,
                  })),
                })),
              })),
            };
          }
          throw new Error(`Unexpected table ${table}`);
        }),
      } as unknown as SupabaseClient<Database>;

      const result = await listBusinessInvitations(mockSupabase, mockBusinessId, mockOwnerId);

      expect(result).toHaveLength(1);
      expect(result[0].email).toBe("pending@store.in");
      expect(result[0].role).toBe("cashier");
      expect(result[0].inviter?.display_name).toBe("Store Owner");
    });
  });

  describe("revokeBusinessInvitation", () => {
    it("enforces hierarchy authority: manager cannot revoke invitation for owner", async () => {
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
                        data: { role: "manager", status: "active" },
                        error: null,
                      })),
                    })),
                  })),
                })),
              })),
            };
          }
          if (table === "business_invitations") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    single: vi.fn(async () => ({
                      data: {
                        id: mockInvitationId,
                        business_id: mockBusinessId,
                        email: "futureowner@store.in",
                        role: "owner",
                        status: "pending",
                      },
                      error: null,
                    })),
                    maybeSingle: vi.fn(async () => ({
                      data: {
                        id: mockInvitationId,
                        business_id: mockBusinessId,
                        email: "futureowner@store.in",
                        role: "owner",
                        status: "pending",
                      },
                      error: null,
                    })),
                  })),
                })),
              })),
            };
          }
          throw new Error(`Unexpected table ${table}`);
        }),
      } as unknown as SupabaseClient<Database>;

      await expect(
        revokeBusinessInvitation(mockSupabase, mockBusinessId, mockInvitationId, mockManagerId),
      ).rejects.toMatchObject({
        code: "HIERARCHY_VIOLATION",
        status: 403,
      });
    });

    it("allows owner to revoke invitation and logs audit event", async () => {
      let updatedStatus: string | null = null;
      let auditLogged: Record<string, unknown> | null = null;

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
                        error: null,
                      })),
                    })),
                  })),
                })),
              })),
            };
          }
          if (table === "business_invitations") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    single: vi.fn(async () => ({
                      data: {
                        id: mockInvitationId,
                        business_id: mockBusinessId,
                        email: "revoke@store.in",
                        role: "staff",
                        status: "pending",
                      },
                      error: null,
                    })),
                    maybeSingle: vi.fn(async () => ({
                      data: {
                        id: mockInvitationId,
                        business_id: mockBusinessId,
                        email: "revoke@store.in",
                        role: "staff",
                        status: "pending",
                      },
                      error: null,
                    })),
                  })),
                })),
              })),
              update: vi.fn((payload: Record<string, unknown>) => ({
                eq: vi.fn(async () => {
                  updatedStatus = payload.status as string;
                  return { error: null };
                }),
              })),
            };
          }
          if (table === "audit_logs") {
            return {
              insert: vi.fn((payload: Record<string, unknown>) => {
                auditLogged = payload;
                return {
                  select: vi.fn(() => ({
                    single: vi.fn(async () => ({
                      data: {
                        id: "audit-2",
                        business_id: payload.business_id,
                        workspace_id: payload.workspace_id,
                        user_id: payload.user_id,
                        action: payload.action,
                        resource: payload.resource,
                        metadata_json: payload.metadata_json,
                        ip_address: null,
                        created_at: new Date().toISOString(),
                      },
                      error: null,
                    })),
                  })),
                  error: null,
                };
              }),
            };
          }
          throw new Error(`Unexpected table ${table}`);
        }),
      } as unknown as SupabaseClient<Database>;

      const result = await revokeBusinessInvitation(
        mockSupabase,
        mockBusinessId,
        mockInvitationId,
        mockOwnerId,
      );

      expect(result.success).toBe(true);
      expect(updatedStatus).toBe("revoked");
      expect(auditLogged).toBeDefined();
      const auditData = auditLogged as unknown as Record<string, unknown>;
      expect(auditData.action).toBe("business.invitation_revoked");
    });
  });

  describe("acceptBusinessInvitation with Atomic RPC & Fallback", () => {
    it("handles PostgreSQL RPC success and maps returned row", async () => {
      const mockSupabase = {
        rpc: vi.fn(async (fnName: string) => {
          if (fnName === "accept_business_invitation_atomic") {
            return {
              data: [
                {
                  business_id: mockBusinessId,
                  role: "manager",
                  status: "active",
                },
              ],
              error: null,
            };
          }
          throw new Error(`Unexpected RPC ${fnName}`);
        }),
      } as unknown as SupabaseClient<Database>;

      const result = await acceptBusinessInvitation(mockSupabase, {
        token: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        acceptingUser: {
          id: mockAcceptingUserId,
          email: "accepted@store.in",
        },
      });

      expect(result.businessId).toBe(mockBusinessId);
      expect(result.role).toBe("manager");
    });

    it("translates PostgreSQL SQLSTATE VY010 to INVALID_TOKEN", async () => {
      const mockSupabase = {
        rpc: vi.fn(async () => ({
          data: null,
          error: { code: "VY010", message: "Invalid or nonexistent invitation token" },
        })),
      } as unknown as SupabaseClient<Database>;

      await expect(
        acceptBusinessInvitation(mockSupabase, {
          token: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
          acceptingUser: { id: mockAcceptingUserId, email: "accepted@store.in" },
        }),
      ).rejects.toMatchObject({
        code: "INVALID_TOKEN",
        status: 404,
      });
    });

    it("translates PostgreSQL SQLSTATE VY012 to INVITATION_EXPIRED", async () => {
      const mockSupabase = {
        rpc: vi.fn(async () => ({
          data: null,
          error: { code: "VY012", message: "Invitation has expired" },
        })),
      } as unknown as SupabaseClient<Database>;

      await expect(
        acceptBusinessInvitation(mockSupabase, {
          token: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
          acceptingUser: { id: mockAcceptingUserId, email: "accepted@store.in" },
        }),
      ).rejects.toMatchObject({
        code: "INVITATION_EXPIRED",
        status: 410,
      });
    });

    it("translates PostgreSQL SQLSTATE VY013 to EMAIL_MISMATCH", async () => {
      const mockSupabase = {
        rpc: vi.fn(async () => ({
          data: null,
          error: {
            code: "VY013",
            message: "Authenticated user email does not match invitation recipient",
          },
        })),
      } as unknown as SupabaseClient<Database>;

      await expect(
        acceptBusinessInvitation(mockSupabase, {
          token: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
          acceptingUser: { id: mockAcceptingUserId, email: "different@store.in" },
        }),
      ).rejects.toMatchObject({
        code: "EMAIL_MISMATCH",
        status: 403,
      });
    });
  });

  describe("Last-Owner Protection in Business Membership Lifecycle", () => {
    it("refuses to remove the sole owner of a business", async () => {
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
                    error: null,
                  })),
                })),
              })),
            };
          }
          if (table === "business_members") {
            return {
              select: vi.fn((_cols: string, opts?: { count?: string; head?: boolean }) => {
                if (opts?.head) {
                  // Only 1 owner
                  return {
                    eq: vi.fn(() => ({
                      eq: vi.fn(() => ({
                        eq: vi.fn(async () => ({ count: 1, error: null })),
                      })),
                    })),
                  };
                }
                return {
                  eq: vi.fn(() => ({
                    eq: vi.fn(() => ({
                      eq: vi.fn(() => ({
                        maybeSingle: vi.fn(async () => ({
                          data: { id: "member-owner-1", role: "owner", status: "active" },
                          error: null,
                        })),
                        single: vi.fn(async () => ({
                          data: { id: "member-owner-1", role: "owner", status: "active" },
                          error: null,
                        })),
                      })),
                      single: vi.fn(async () => ({
                        data: { id: "member-owner-1", role: "owner", status: "active" },
                        error: null,
                      })),
                      maybeSingle: vi.fn(async () => ({
                        data: { id: "member-owner-1", role: "owner", status: "active" },
                        error: null,
                      })),
                    })),
                  })),
                };
              }),
            };
          }
          throw new Error(`Unexpected table ${table}`);
        }),
      } as unknown as SupabaseClient<Database>;

      await expect(
        removeBusinessMember(mockSupabase, mockBusinessId, mockOwnerId, mockOwnerId),
      ).rejects.toMatchObject({
        code: "LAST_OWNER_PROTECTION",
        status: 400,
      });
    });
  });

  describe("Business Invitation Server Actions", () => {
    const setupAuth = (user: { id: string; email: string } | null) => {
      const mockClient = {
        auth: {
          getUser: vi.fn(async () => ({
            data: { user },
            error: user ? null : { message: "Unauthorized" },
          })),
        },
      } as unknown as SupabaseClient<Database>;

      vi.spyOn(serverSupabase, "createServerSupabaseClient").mockResolvedValue(mockClient);
      return mockClient;
    };

    it("inviteBusinessMemberAction returns unauthorized if session missing", async () => {
      setupAuth(null);

      const res = await inviteBusinessMemberAction({
        business_id: mockBusinessId,
        email: "staff@store.in",
        role: "staff",
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toMatch(/Authentication required/i);
      }
    });

    it("listBusinessInvitationsAction validates uuid and returns error on invalid id", async () => {
      setupAuth({ id: mockOwnerId, email: "owner@store.in" });

      const res = await listBusinessInvitationsAction("invalid-uuid");
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBeDefined();
      }
    });

    it("revokeBusinessInvitationAction returns unauthorized if session missing", async () => {
      setupAuth(null);

      const res = await revokeBusinessInvitationAction({
        business_id: mockBusinessId,
        invitationId: mockInvitationId,
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toMatch(/Authentication required/i);
      }
    });

    it("acceptBusinessInvitationAction validates token input and handles errors cleanly", async () => {
      setupAuth({ id: mockAcceptingUserId, email: "accepted@store.in" });

      const res = await acceptBusinessInvitationAction({
        token: "", // Invalid token
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBeDefined();
      }
    });
  });
});
