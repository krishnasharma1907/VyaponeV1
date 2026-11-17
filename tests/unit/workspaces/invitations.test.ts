import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import {
  createWorkspaceInvitation,
  listWorkspaceInvitations,
  revokeWorkspaceInvitation,
  acceptWorkspaceInvitation,
} from "@/lib/workspaces/service";
import {
  listWorkspaceInvitationsAction,
  revokeWorkspaceInvitationAction,
} from "@/lib/workspaces/actions";
import * as serverSupabase from "@/lib/supabase/server";

// Mock server-only to allow Server Action testing inside Vitest environment
vi.mock("server-only", () => ({}));

describe("Workspace Team Invitations & Membership Lifecycle [VO-027]", () => {
  const mockWorkspaceId = "b0000000-0000-4000-8000-000000000001";
  const mockOwnerId = "a0000000-0000-4000-8000-000000000001";
  const mockMemberId = "a0000000-0000-4000-8000-000000000002";
  const mockInvitationId = "c0000000-0000-4000-8000-000000000001";

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("createWorkspaceInvitation with Capacity Enforcement", () => {
    it("enforces team_seats capacity limit when active members + pending invitations reach limit", async () => {
      // Mock starter plan which allows e.g. 2 team seats
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "workspace_members") {
            return {
              select: vi.fn((_cols: string, opts?: { count?: string; head?: boolean }) => {
                if (opts?.head) {
                  // Active members count = 2
                  return {
                    eq: vi.fn(() => ({
                      eq: vi.fn(async () => ({ count: 2, error: null })),
                    })),
                  };
                }
                return {
                  eq: vi.fn(() => ({
                    eq: vi.fn(() => ({
                      eq: vi.fn(() => ({
                        single: vi.fn(async () => ({
                          data: { role: "workspace_owner", status: "active" },
                          error: null,
                        })),
                      })),
                      single: vi.fn(async () => ({
                        data: { role: "workspace_owner", status: "active" },
                        error: null,
                      })),
                    })),
                  })),
                };
              }),
            };
          }
          if (table === "workspace_invitations") {
            return {
              select: vi.fn((_cols: string, opts?: { count?: string; head?: boolean }) => {
                if (opts?.head) {
                  return {
                    eq: vi.fn(() => ({
                      eq: vi.fn(() => ({
                        gt: vi.fn(async () => ({ count: 0, error: null })),
                      })),
                    })),
                  };
                }
                return {
                  eq: vi.fn(() => ({
                    eq: vi.fn(() => ({
                      single: vi.fn(async () => ({ data: null, error: { code: "PGRST116" } })),
                    })),
                  })),
                };
              }),
            };
          }
          if (table === "users") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn(async () => ({ data: null, error: { code: "PGRST116" } })),
                })),
              })),
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
                  single: vi.fn(async () => ({
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
                  in: vi.fn(() => ({
                    order: vi.fn(() => ({
                      limit: vi.fn(async () => ({ data: [], error: null })),
                    })),
                  })),
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
          throw new Error(`Unexpected table ${table}`);
        }),
      } as unknown as SupabaseClient<Database>;

      await expect(
        createWorkspaceInvitation(mockSupabase, {
          workspaceId: mockWorkspaceId,
          actorUserId: mockOwnerId,
          email: "newmember@apex.in",
          role: "workspace_member",
        }),
      ).rejects.toMatchObject({
        code: "CAPACITY_EXCEEDED",
        status: 403,
      });
    });

    it("successfully creates invitation and returns raw token when within capacity", async () => {
      let insertedInvitation: Record<string, unknown> | null = null;
      let insertedAudit: Record<string, unknown> | null = null;

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "workspace_members") {
            return {
              select: vi.fn((_cols: string, opts?: { count?: string; head?: boolean }) => {
                if (opts?.head) {
                  return {
                    eq: vi.fn(() => ({
                      eq: vi.fn(async () => ({ count: 1, error: null })),
                    })),
                  };
                }
                return {
                  eq: vi.fn(() => ({
                    eq: vi.fn(() => ({
                      eq: vi.fn(() => ({
                        single: vi.fn(async () => ({
                          data: { role: "workspace_owner", status: "active" },
                          error: null,
                        })),
                      })),
                      single: vi.fn(async () => ({
                        data: { role: "workspace_owner", status: "active" },
                        error: null,
                      })),
                    })),
                  })),
                };
              }),
            };
          }
          if (table === "workspace_invitations") {
            return {
              select: vi.fn((_cols: string, opts?: { count?: string; head?: boolean }) => {
                if (opts?.head) {
                  return {
                    eq: vi.fn(() => ({
                      eq: vi.fn(() => ({
                        gt: vi.fn(async () => ({ count: 0, error: null })),
                      })),
                    })),
                  };
                }
                return {
                  eq: vi.fn(() => ({
                    eq: vi.fn(() => ({
                      single: vi.fn(async () => ({ data: null, error: { code: "PGRST116" } })),
                    })),
                  })),
                };
              }),
              insert: vi.fn((payload: Record<string, unknown>) => ({
                select: vi.fn(() => ({
                  single: vi.fn(async () => {
                    insertedInvitation = payload;
                    return {
                      data: {
                        id: mockInvitationId,
                        workspace_id: mockWorkspaceId,
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
          if (table === "users") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn(async () => ({ data: null, error: { code: "PGRST116" } })),
                })),
              })),
            };
          }
          if (table === "users") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn(async () => ({ data: null, error: { code: "PGRST116" } })),
                })),
              })),
            };
          }
          if (table === "workspaces") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn(async () => ({
                    data: { id: mockWorkspaceId, plan: "growth" },
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
                  in: vi.fn(() => ({
                    order: vi.fn(() => ({
                      limit: vi.fn(async () => ({ data: [], error: null })),
                    })),
                  })),
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

      const result = await createWorkspaceInvitation(mockSupabase, {
        workspaceId: mockWorkspaceId,
        actorUserId: mockOwnerId,
        email: "candidate@apex.in",
        role: "workspace_member",
      });

      expect(result.invitation.id).toBe(mockInvitationId);
      expect(result.invitation.email).toBe("candidate@apex.in");
      expect(result.rawToken).toHaveLength(64);
      expect(result.rawToken).toMatch(/^[a-f0-9]{64}$/);
      expect(insertedInvitation).toBeDefined();
      const invData = insertedInvitation as unknown as Record<string, unknown>;
      expect(invData.token_hash).toHaveLength(64);
      expect(invData.token_hash).not.toBe(result.rawToken);
      expect(insertedAudit).toBeDefined();
      const auditData = insertedAudit as unknown as Record<string, unknown>;
      expect(auditData.action).toBe("workspace.member_invited");
    });
  });

  describe("listWorkspaceInvitations", () => {
    it("returns formatted list of pending invitations with inviter details", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "workspace_members") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    eq: vi.fn(() => ({
                      single: vi.fn(async () => ({
                        data: { role: "workspace_admin", status: "active" },
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
                  single: vi.fn(async () => ({ data: null, error: { code: "PGRST116" } })),
                })),
              })),
            };
          }
          if (table === "workspaces") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn(async () => ({
                    data: { id: mockWorkspaceId, name: "Apex" },
                    error: null,
                  })),
                })),
              })),
            };
          }
          if (table === "workspace_invitations") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  order: vi.fn(async () => ({
                    data: [
                      {
                        id: mockInvitationId,
                        workspace_id: mockWorkspaceId,
                        email: "pending@apex.in",
                        role: "workspace_member",
                        token_hash: "hash123",
                        invited_by: mockOwnerId,
                        status: "pending",
                        expires_at: new Date(Date.now() + 86400 * 1000).toISOString(),
                        accepted_at: null,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                        users: {
                          id: mockOwnerId,
                          display_name: "Apex Owner",
                          email: "owner@apex.in",
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

      const result = await listWorkspaceInvitations(mockSupabase, mockWorkspaceId, mockOwnerId);

      expect(result).toHaveLength(1);
      expect(result[0].email).toBe("pending@apex.in");
      expect(result[0].inviter?.display_name).toBe("Apex Owner");
    });
  });

  describe("revokeWorkspaceInvitation", () => {
    it("allows authorized admin/owner to revoke invitation and logs audit event", async () => {
      let updatedStatus: string | null = null;
      let auditLogged: Record<string, unknown> | null = null;

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "workspace_members") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    eq: vi.fn(() => ({
                      single: vi.fn(async () => ({
                        data: { role: "workspace_owner", status: "active" },
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
                  single: vi.fn(async () => ({ data: null, error: { code: "PGRST116" } })),
                })),
              })),
            };
          }
          if (table === "workspaces") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn(async () => ({
                    data: { id: mockWorkspaceId, name: "Apex" },
                    error: null,
                  })),
                })),
              })),
            };
          }
          if (table === "workspace_invitations") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    single: vi.fn(async () => ({
                      data: {
                        id: mockInvitationId,
                        workspace_id: mockWorkspaceId,
                        email: "to-revoke@apex.in",
                        role: "workspace_member",
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

      const result = await revokeWorkspaceInvitation(mockSupabase, {
        workspaceId: mockWorkspaceId,
        invitationId: mockInvitationId,
        actorUserId: mockOwnerId,
      });

      expect(result.success).toBe(true);
      expect(updatedStatus).toBe("revoked");
      expect(auditLogged).toBeDefined();
      const auditData = auditLogged as unknown as Record<string, unknown>;
      expect(auditData.action).toBe("workspace.invitation_revoked");
    });
  });

  describe("acceptWorkspaceInvitation with Atomic RPC & Fallback", () => {
    it("handles PostgreSQL RPC success and maps returned row", async () => {
      const mockSupabase = {
        rpc: vi.fn(async (fnName: string) => {
          if (fnName === "accept_workspace_invitation_atomic") {
            return {
              data: [
                {
                  workspace_id: mockWorkspaceId,
                  role: "workspace_member",
                  status: "active",
                },
              ],
              error: null,
            };
          }
          throw new Error(`Unexpected RPC ${fnName}`);
        }),
      } as unknown as SupabaseClient<Database>;

      const result = await acceptWorkspaceInvitation(mockSupabase, {
        token: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        acceptingUser: {
          id: mockMemberId,
          email: "accepted@apex.in",
        },
      });

      expect(result.workspaceId).toBe(mockWorkspaceId);
      expect(result.role).toBe("workspace_member");
    });

    it("translates PostgreSQL SQLSTATE VY010 to INVALID_TOKEN", async () => {
      const mockSupabase = {
        rpc: vi.fn(async () => ({
          data: null,
          error: { code: "VY010", message: "Invitation token not found" },
        })),
      } as unknown as SupabaseClient<Database>;

      await expect(
        acceptWorkspaceInvitation(mockSupabase, {
          token: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
          acceptingUser: { id: mockMemberId, email: "accepted@apex.in" },
        }),
      ).rejects.toMatchObject({
        code: "INVALID_TOKEN",
        status: 404,
      });
    });

    it("translates PostgreSQL SQLSTATE VY001 to CAPACITY_EXCEEDED", async () => {
      const mockSupabase = {
        rpc: vi.fn(async () => ({
          data: null,
          error: { code: "VY001", message: "Capacity exceeded for team_seats" },
        })),
      } as unknown as SupabaseClient<Database>;

      await expect(
        acceptWorkspaceInvitation(mockSupabase, {
          token: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
          acceptingUser: { id: mockMemberId, email: "accepted@apex.in" },
        }),
      ).rejects.toMatchObject({
        code: "CAPACITY_EXCEEDED",
        status: 403,
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
        acceptWorkspaceInvitation(mockSupabase, {
          token: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
          acceptingUser: { id: mockMemberId, email: "different@apex.in" },
        }),
      ).rejects.toMatchObject({
        code: "EMAIL_MISMATCH",
        status: 403,
      });
    });
  });

  describe("Server Actions: listWorkspaceInvitationsAction & revokeWorkspaceInvitationAction", () => {
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

    it("listWorkspaceInvitationsAction returns unauthorized error if not logged in", async () => {
      setupAuth(null);

      const res = await listWorkspaceInvitationsAction(mockWorkspaceId);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toMatch(/Authentication required/i);
      }
    });

    it("revokeWorkspaceInvitationAction validates schema and returns error on invalid uuid", async () => {
      setupAuth({ id: mockOwnerId, email: "owner@apex.in" });

      const res = await revokeWorkspaceInvitationAction(null, {
        workspaceId: "not-a-uuid",
        invitationId: "also-not-a-uuid",
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBeDefined();
      }
    });
  });
});
