import { describe, expect, it, vi } from "vitest";
import {
  acceptWorkspaceInvitation,
  createWorkspace,
  getUserWorkspaces,
  getWorkspaceById,
  inviteWorkspaceMember,
  removeWorkspaceMember,
  updateWorkspaceMemberRole,
  updateWorkspaceProfile,
  WorkspaceError,
} from "@/lib/workspaces/service";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { hashInvitationToken } from "@/lib/workspaces/tokens";

describe("Workspace Service Layer [VO-022]", () => {
  const mockOwnerId = "usr_owner_001";
  const mockAdminId = "usr_admin_002";
  const mockMemberId = "usr_member_003";
  const mockWorkspaceId = "ws_apex_001";

  describe("1. createWorkspace()", () => {
    it("creates workspace, registers owner membership, and emits audit log", async () => {
      const insertedWorkspaces: unknown[] = [];
      const insertedMembers: unknown[] = [];
      const insertedAuditLogs: unknown[] = [];

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "workspaces") {
            return {
              insert: vi.fn((data: unknown) => {
                insertedWorkspaces.push(data);
                return {
                  select: vi.fn(() => ({
                    single: vi.fn(async () => ({
                      data: { id: mockWorkspaceId, ...(data as object) },
                      error: null,
                    })),
                  })),
                };
              }),
            };
          }
          if (table === "workspace_members") {
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
          throw new Error(`Unexpected table ${table}`);
        }),
      } as unknown as SupabaseClient<Database>;

      const result = await createWorkspace(mockSupabase, {
        name: "Apex Agency",
        slug: "apex-agency",
        ownerUserId: mockOwnerId,
        plan: "agency",
      });

      expect(result.id).toBe(mockWorkspaceId);
      expect(result.name).toBe("Apex Agency");

      // Verify creator gets workspace_owner
      expect(insertedMembers).toHaveLength(1);
      expect(insertedMembers[0]).toMatchObject({
        workspace_id: mockWorkspaceId,
        user_id: mockOwnerId,
        role: "workspace_owner",
        status: "active",
      });

      // Verify audit log
      expect(insertedAuditLogs).toHaveLength(1);
      expect(insertedAuditLogs[0]).toMatchObject({
        workspace_id: mockWorkspaceId,
        user_id: mockOwnerId,
        action: "workspace.created",
        resource: "workspaces",
      });
    });

    it("throws conflict error when workspace slug is already taken", async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: null,
                error: { code: "23505", message: "duplicate key value violates unique constraint" },
              })),
            })),
          })),
        })),
      } as unknown as SupabaseClient<Database>;

      await expect(
        createWorkspace(mockSupabase, {
          name: "Apex Agency",
          slug: "existing-slug",
          ownerUserId: mockOwnerId,
        }),
      ).rejects.toThrow(WorkspaceError);
    });
  });

  describe("2. getUserWorkspaces()", () => {
    it("returns workspaces with active roles and membership count", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "workspace_members") {
            return {
              select: vi.fn((_columns: string, options?: { head?: boolean }) => {
                if (options?.head) {
                  return {
                    eq: vi.fn(() => ({
                      eq: vi.fn(async () => ({ count: 3, error: null })),
                    })),
                  };
                }
                return {
                  eq: vi.fn(() => ({
                    eq: vi.fn(async () => ({
                      data: [
                        {
                          role: "workspace_owner",
                          workspace_id: mockWorkspaceId,
                          workspaces: {
                            id: mockWorkspaceId,
                            name: "Apex Agency",
                            slug: "apex-agency",
                            status: "active",
                          },
                        },
                      ],
                      error: null,
                    })),
                  })),
                };
              }),
            };
          }
          throw new Error(`Unexpected table ${table}`);
        }),
      } as unknown as SupabaseClient<Database>;

      const workspaces = await getUserWorkspaces(mockSupabase, mockOwnerId);
      expect(workspaces).toHaveLength(1);
      expect(workspaces[0].workspace.id).toBe(mockWorkspaceId);
      expect(workspaces[0].currentUserRole).toBe("workspace_owner");
      expect(workspaces[0].memberCount).toBe(3);
    });
  });

  describe("3. getWorkspaceById()", () => {
    it("denies access to users who are not active workspace members", async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn(async () => ({ data: null, error: { message: "Not found" } })),
                })),
              })),
            })),
          })),
        })),
      } as unknown as SupabaseClient<Database>;

      await expect(getWorkspaceById(mockSupabase, mockWorkspaceId, "usr_stranger")).rejects.toThrow(
        "Access denied: Not an active member of this workspace",
      );
    });

    it("fetches workspace members with user profiles when authorized", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "workspace_members") {
            return {
              select: vi.fn((cols: string) => {
                if (cols === "role, status") {
                  return {
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
                  };
                }
                return {
                  eq: vi.fn(() => ({
                    order: vi.fn(async () => ({
                      data: [
                        {
                          id: "mem_1",
                          workspace_id: mockWorkspaceId,
                          user_id: mockOwnerId,
                          role: "workspace_owner",
                          status: "active",
                          created_at: "2026-11-12T00:00:00Z",
                          users: {
                            id: mockOwnerId,
                            display_name: "Owner User",
                            email: "owner@apex.in",
                            phone_number: null,
                          },
                        },
                      ],
                      error: null,
                    })),
                  })),
                };
              }),
            };
          }
          if (table === "workspaces") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn(async () => ({
                    data: { id: mockWorkspaceId, name: "Apex Agency", slug: "apex-agency" },
                    error: null,
                  })),
                })),
              })),
            };
          }
          throw new Error(`Unexpected table ${table}`);
        }),
      } as unknown as SupabaseClient<Database>;

      const { getWorkspaceMembers } = await import("@/lib/workspaces/service");
      const members = await getWorkspaceMembers(mockSupabase, mockWorkspaceId, mockOwnerId);
      expect(members).toHaveLength(1);
      expect(members[0].user.display_name).toBe("Owner User");
    });
  });

  describe("4. updateWorkspaceProfile()", () => {
    it("allows workspace_owner to update name and slug and writes audit log", async () => {
      const auditLogs: unknown[] = [];

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
          if (table === "workspaces") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn(async () => ({
                    data: { id: mockWorkspaceId, name: "Apex Agency", slug: "apex-agency" },
                    error: null,
                  })),
                })),
              })),
              update: vi.fn((updates: unknown) => ({
                eq: vi.fn(() => ({
                  select: vi.fn(() => ({
                    single: vi.fn(async () => ({
                      data: { id: mockWorkspaceId, ...(updates as object) },
                      error: null,
                    })),
                  })),
                })),
              })),
            };
          }
          if (table === "audit_logs") {
            return {
              insert: vi.fn(async (entry: unknown) => {
                auditLogs.push(entry);
                return { error: null };
              }),
            };
          }
          throw new Error(`Unexpected table ${table}`);
        }),
      } as unknown as SupabaseClient<Database>;

      const updated = await updateWorkspaceProfile(mockSupabase, {
        workspaceId: mockWorkspaceId,
        actorUserId: mockOwnerId,
        name: "Apex Global HQ",
        slug: "apex-global-hq",
      });

      expect(updated.name).toBe("Apex Global HQ");
      expect(updated.slug).toBe("apex-global-hq");
      expect(auditLogs).toHaveLength(1);
    });

    it("rejects non-owner attempts to update workspace profile", async () => {
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
          if (table === "workspaces") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn(async () => ({
                    data: { id: mockWorkspaceId, name: "Apex Agency", slug: "apex-agency" },
                    error: null,
                  })),
                })),
              })),
            };
          }
          throw new Error(`Unexpected table ${table}`);
        }),
      } as unknown as SupabaseClient<Database>;

      await expect(
        updateWorkspaceProfile(mockSupabase, {
          workspaceId: mockWorkspaceId,
          actorUserId: mockAdminId,
          name: "Hijacked Name",
        }),
      ).rejects.toThrow("Insufficient permissions to update workspace settings");
    });
  });

  describe("5. inviteWorkspaceMember() & Security Protections", () => {
    it("allows owner to invite member, stores SHA-256 hash, and strictly redacts raw token from audit log", async () => {
      const insertedInvitations: unknown[] = [];
      const auditLogs: Array<Record<string, unknown>> = [];

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
          if (table === "workspaces") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn(async () => ({
                    data: { id: mockWorkspaceId },
                    error: null,
                  })),
                })),
              })),
            };
          }
          if (table === "users") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn(async () => ({ data: null, error: null })),
                })),
              })),
            };
          }
          if (table === "workspace_invitations") {
            return {
              insert: vi.fn((inv: unknown) => {
                insertedInvitations.push(inv);
                return {
                  select: vi.fn(() => ({
                    single: vi.fn(async () => ({
                      data: { id: "inv_123", ...(inv as object) },
                      error: null,
                    })),
                  })),
                };
              }),
            };
          }
          if (table === "audit_logs") {
            return {
              insert: vi.fn(async (entry: unknown) => {
                auditLogs.push(entry as Record<string, unknown>);
                return { error: null };
              }),
            };
          }
          throw new Error(`Unexpected table ${table}`);
        }),
      } as unknown as SupabaseClient<Database>;

      const { invitation, rawToken } = await inviteWorkspaceMember(mockSupabase, {
        workspaceId: mockWorkspaceId,
        actorUserId: mockOwnerId,
        email: "designer@apex.in",
        role: "workspace_member",
      });

      expect(invitation.email).toBe("designer@apex.in");
      expect(rawToken).toHaveLength(64);

      // Verify SHA-256 hash was stored in table
      const stored = insertedInvitations[0] as { token_hash: string };
      expect(stored.token_hash).toBe(hashInvitationToken(rawToken));
      expect(stored.token_hash).not.toBe(rawToken);

      // Verify raw token is strictly absent from audit log
      expect(auditLogs).toHaveLength(1);
      const auditMeta = auditLogs[0].metadata_json as Record<string, unknown>;
      expect(auditMeta.recipient_email).toBe("designer@apex.in");
      expect(JSON.stringify(auditLogs)).not.toContain(rawToken);
    });

    it("prevents workspace_admin from inviting another workspace_admin or workspace_owner (role escalation)", async () => {
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
          if (table === "workspaces") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn(async () => ({
                    data: { id: mockWorkspaceId },
                    error: null,
                  })),
                })),
              })),
            };
          }
          throw new Error(`Unexpected table ${table}`);
        }),
      } as unknown as SupabaseClient<Database>;

      await expect(
        inviteWorkspaceMember(mockSupabase, {
          workspaceId: mockWorkspaceId,
          actorUserId: mockAdminId,
          email: "escalation@apex.in",
          role: "workspace_admin",
        }),
      ).rejects.toThrow("insufficient actor authority");
    });
  });

  describe("6. acceptWorkspaceInvitation()", () => {
    it("accepts valid invitation when recipient email matches authenticated user", async () => {
      const rawToken = "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210";

      let invitationStatus = "pending";
      const upsertedMembers: unknown[] = [];

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "workspace_invitations") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn(async () => ({
                    data: {
                      id: "inv_valid",
                      workspace_id: mockWorkspaceId,
                      email: "colleague@apex.in",
                      role: "workspace_member",
                      status: invitationStatus,
                      expires_at: new Date(Date.now() + 86400 * 1000).toISOString(),
                    },
                    error: null,
                  })),
                })),
              })),
              update: vi.fn((updates: { status: string }) => {
                invitationStatus = updates.status;
                return {
                  eq: vi.fn(async () => ({ error: null })),
                };
              }),
            };
          }
          if (table === "workspace_members") {
            return {
              upsert: vi.fn(async (record: unknown) => {
                upsertedMembers.push(record);
                return { error: null };
              }),
            };
          }
          if (table === "audit_logs") {
            return {
              insert: vi.fn(async () => ({ error: null })),
            };
          }
          throw new Error(`Unexpected table ${table}`);
        }),
      } as unknown as SupabaseClient<Database>;

      const result = await acceptWorkspaceInvitation(mockSupabase, {
        token: rawToken,
        acceptingUser: {
          id: mockMemberId,
          email: "colleague@apex.in",
        },
      });

      expect(result.workspaceId).toBe(mockWorkspaceId);
      expect(result.role).toBe("workspace_member");
      expect(invitationStatus).toBe("accepted");
      expect(upsertedMembers[0]).toMatchObject({
        workspace_id: mockWorkspaceId,
        user_id: mockMemberId,
        role: "workspace_member",
        status: "active",
      });
    });

    it("rejects invitation acceptance when authenticated email does not match invitation recipient", async () => {
      const rawToken = "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210";

      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: {
                  id: "inv_valid",
                  workspace_id: mockWorkspaceId,
                  email: "intended-recipient@apex.in",
                  role: "workspace_member",
                  status: "pending",
                  expires_at: new Date(Date.now() + 86400 * 1000).toISOString(),
                },
                error: null,
              })),
            })),
          })),
        })),
      } as unknown as SupabaseClient<Database>;

      await expect(
        acceptWorkspaceInvitation(mockSupabase, {
          token: rawToken,
          acceptingUser: {
            id: "usr_attacker",
            email: "unauthorized-intruder@other.in",
          },
        }),
      ).rejects.toThrow("Authenticated user email does not match invitation recipient");
    });

    it("rejects acceptance of an expired invitation", async () => {
      const rawToken = "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210";

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "workspace_invitations") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn(async () => ({
                    data: {
                      id: "inv_expired",
                      workspace_id: mockWorkspaceId,
                      email: "colleague@apex.in",
                      role: "workspace_member",
                      status: "pending",
                      expires_at: new Date(Date.now() - 86400 * 1000).toISOString(), // Expired yesterday
                    },
                    error: null,
                  })),
                })),
              })),
              update: vi.fn(() => ({
                eq: vi.fn(async () => ({ error: null })),
              })),
            };
          }
          throw new Error(`Unexpected table ${table}`);
        }),
      } as unknown as SupabaseClient<Database>;

      await expect(
        acceptWorkspaceInvitation(mockSupabase, {
          token: rawToken,
          acceptingUser: {
            id: mockMemberId,
            email: "colleague@apex.in",
          },
        }),
      ).rejects.toThrow("Invitation has expired");
    });
  });

  describe("7. updateWorkspaceMemberRole() & Last-Owner Protection", () => {
    it("enforces last-owner protection by prohibiting demotion of the sole owner", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "workspace_members") {
            return {
              select: vi.fn((_columns?: string, options?: { head?: boolean; count?: string }) => {
                if (options?.head) {
                  return {
                    eq: vi.fn(() => ({
                      eq: vi.fn(() => ({
                        eq: vi.fn(async () => ({ count: 1, error: null })), // Only 1 owner
                      })),
                    })),
                  };
                }
                return {
                  eq: vi.fn((_field: string, val: string) => ({
                    eq: vi.fn(() => ({
                      eq: vi.fn(() => ({
                        single: vi.fn(async () => ({
                          data: {
                            id: "mem_owner",
                            workspace_id: mockWorkspaceId,
                            user_id: val,
                            role: "workspace_owner",
                            status: "active",
                          },
                          error: null,
                        })),
                      })),
                    })),
                  })),
                };
              }),
            };
          }
          if (table === "workspaces") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn(async () => ({
                    data: { id: mockWorkspaceId },
                    error: null,
                  })),
                })),
              })),
            };
          }
          throw new Error(`Unexpected table ${table}`);
        }),
      } as unknown as SupabaseClient<Database>;

      await expect(
        updateWorkspaceMemberRole(mockSupabase, {
          workspaceId: mockWorkspaceId,
          actorUserId: mockOwnerId,
          targetUserId: mockOwnerId,
          newRole: "workspace_admin",
        }),
      ).rejects.toThrow("Cannot demote the sole workspace owner");
    });

    it("prohibits workspace_admin from modifying role of equal or higher ranked members", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "workspace_members") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn((_f1: string, _val1: string) => ({
                  eq: vi.fn((_f2: string, val2: string) => ({
                    eq: vi.fn(() => ({
                      single: vi.fn(async () => {
                        const isActor = val2 === mockAdminId;
                        return {
                          data: {
                            id: isActor ? "mem_admin" : "mem_target_admin",
                            workspace_id: mockWorkspaceId,
                            user_id: val2,
                            role: "workspace_admin",
                            status: "active",
                          },
                          error: null,
                        };
                      }),
                    })),
                  })),
                })),
              })),
            };
          }
          if (table === "workspaces") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn(async () => ({
                    data: { id: mockWorkspaceId },
                    error: null,
                  })),
                })),
              })),
            };
          }
          throw new Error(`Unexpected table ${table}`);
        }),
      } as unknown as SupabaseClient<Database>;

      await expect(
        updateWorkspaceMemberRole(mockSupabase, {
          workspaceId: mockWorkspaceId,
          actorUserId: mockAdminId,
          targetUserId: "usr_peer_admin",
          newRole: "workspace_member",
        }),
      ).rejects.toThrow("Insufficient permissions to change member roles");
    });
  });

  describe("8. removeWorkspaceMember() & Last-Owner Protection", () => {
    it("prohibits removing the sole workspace owner", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "workspace_members") {
            return {
              select: vi.fn((_columns?: string, options?: { head?: boolean }) => {
                if (options?.head) {
                  return {
                    eq: vi.fn(() => ({
                      eq: vi.fn(() => ({
                        eq: vi.fn(async () => ({ count: 1, error: null })), // Only 1 owner
                      })),
                    })),
                  };
                }
                return {
                  eq: vi.fn(() => ({
                    eq: vi.fn(() => ({
                      eq: vi.fn(() => ({
                        single: vi.fn(async () => ({
                          data: {
                            id: "mem_owner",
                            workspace_id: mockWorkspaceId,
                            user_id: mockOwnerId,
                            role: "workspace_owner",
                            status: "active",
                          },
                          error: null,
                        })),
                      })),
                    })),
                  })),
                };
              }),
            };
          }
          if (table === "workspaces") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn(async () => ({
                    data: { id: mockWorkspaceId },
                    error: null,
                  })),
                })),
              })),
            };
          }
          throw new Error(`Unexpected table ${table}`);
        }),
      } as unknown as SupabaseClient<Database>;

      await expect(
        removeWorkspaceMember(mockSupabase, {
          workspaceId: mockWorkspaceId,
          actorUserId: mockOwnerId,
          targetUserId: mockOwnerId,
        }),
      ).rejects.toThrow("Cannot remove the sole workspace owner");
    });

    it("allows a member to leave the workspace themselves", async () => {
      const auditLogs: unknown[] = [];
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "workspace_members") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    eq: vi.fn(() => ({
                      single: vi.fn(async () => ({
                        data: {
                          id: "mem_member",
                          workspace_id: mockWorkspaceId,
                          user_id: mockMemberId,
                          role: "workspace_member",
                          status: "active",
                        },
                        error: null,
                      })),
                    })),
                  })),
                })),
              })),
              update: vi.fn(() => ({
                eq: vi.fn(async () => ({ error: null })),
              })),
            };
          }
          if (table === "workspaces") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn(async () => ({
                    data: { id: mockWorkspaceId },
                    error: null,
                  })),
                })),
              })),
            };
          }
          if (table === "audit_logs") {
            return {
              insert: vi.fn(async (entry: unknown) => {
                auditLogs.push(entry);
                return { error: null };
              }),
            };
          }
          throw new Error(`Unexpected table ${table}`);
        }),
      } as unknown as SupabaseClient<Database>;

      const result = await removeWorkspaceMember(mockSupabase, {
        workspaceId: mockWorkspaceId,
        actorUserId: mockMemberId,
        targetUserId: mockMemberId,
      });

      expect(result.success).toBe(true);
      expect(auditLogs).toHaveLength(1);
    });
  });
});
