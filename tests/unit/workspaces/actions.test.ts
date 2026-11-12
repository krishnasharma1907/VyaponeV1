import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock server-only to allow Server Action testing inside Vitest JSDOM environment
vi.mock("server-only", () => ({}));

import * as serverSupabase from "@/lib/supabase/server";
import * as workspaceService from "@/lib/workspaces/service";
import {
  acceptWorkspaceInvitationAction,
  createWorkspaceAction,
  getUserWorkspacesAction,
  getWorkspaceAction,
  getWorkspaceMembersAction,
  inviteWorkspaceMemberAction,
  removeWorkspaceMemberAction,
  updateWorkspaceMemberRoleAction,
  updateWorkspaceProfileAction,
} from "@/lib/workspaces/actions";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type {
  WorkspaceMemberRow,
  WorkspaceMemberWithProfile,
  WorkspaceRow,
} from "@/lib/workspaces/types";

describe("Workspace Server Actions [VO-022]", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockUser = {
    id: "a0000000-0000-4000-8000-000000000001",
    email: "owner@apexdigital.in",
  };

  const setupMockServerSupabase = (authenticated = true) => {
    const mockAuth = {
      getUser: vi.fn(async () => ({
        data: { user: authenticated ? mockUser : null },
        error: authenticated ? null : { message: "Auth session missing" },
      })),
    };

    const mockClient = {
      auth: mockAuth,
    } as unknown as SupabaseClient<Database>;

    vi.spyOn(serverSupabase, "createServerSupabaseClient").mockResolvedValue(mockClient);
    return { mockClient, mockAuth };
  };

  describe("createWorkspaceAction()", () => {
    it("rejects unauthenticated requests", async () => {
      setupMockServerSupabase(false);

      const result = await createWorkspaceAction(null, {
        name: "Apex Agency",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Authentication required");
    });

    it("rejects invalid input schema", async () => {
      setupMockServerSupabase(true);

      const result = await createWorkspaceAction(null, {
        name: " ",
      });

      expect(result.success).toBe(false);
      expect(result.fieldErrors).toBeDefined();
    });

    it("creates workspace and returns created record for authenticated user", async () => {
      setupMockServerSupabase(true);

      const mockWorkspace: WorkspaceRow = {
        id: "b0000000-0000-4000-8000-000000000002",
        name: "Apex Agency",
        slug: "apex-agency",
        owner_user_id: mockUser.id,
        plan: "starter",
        status: "active",
        created_at: "2026-11-12T00:00:00Z",
        updated_at: "2026-11-12T00:00:00Z",
      };

      vi.spyOn(workspaceService, "createWorkspace").mockResolvedValue(mockWorkspace);

      const result = await createWorkspaceAction(null, {
        name: "Apex Agency",
        slug: "apex-agency",
      });

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe(mockWorkspace.id);
      expect(result.data?.name).toBe("Apex Agency");
    });
  });

  describe("getUserWorkspacesAction()", () => {
    it("returns list of user workspaces", async () => {
      setupMockServerSupabase(true);

      const mockWorkspaces = [
        {
          workspace: {
            id: "b0000000-0000-4000-8000-000000000002",
            name: "Apex Agency",
            slug: "apex-agency",
            owner_user_id: mockUser.id,
            plan: "agency" as const,
            status: "active" as const,
            created_at: "2026-11-12T00:00:00Z",
            updated_at: "2026-11-12T00:00:00Z",
          },
          memberCount: 3,
          currentUserRole: "workspace_owner" as const,
        },
      ];

      vi.spyOn(workspaceService, "getUserWorkspaces").mockResolvedValue(mockWorkspaces);

      const result = await getUserWorkspacesAction();
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0].currentUserRole).toBe("workspace_owner");
    });
  });

  describe("getWorkspaceAction() & getWorkspaceMembersAction()", () => {
    it("retrieves workspace details", async () => {
      setupMockServerSupabase(true);

      const mockResult = {
        workspace: {
          id: "b0000000-0000-4000-8000-000000000002",
          name: "Apex Agency",
          slug: "apex-agency",
          owner_user_id: mockUser.id,
          plan: "agency" as const,
          status: "active" as const,
          created_at: "2026-11-12T00:00:00Z",
          updated_at: "2026-11-12T00:00:00Z",
        },
        userRole: "workspace_owner" as const,
      };

      vi.spyOn(workspaceService, "getWorkspaceById").mockResolvedValue(mockResult);

      const result = await getWorkspaceAction("b0000000-0000-4000-8000-000000000002");
      expect(result.success).toBe(true);
      expect(result.data?.workspace.name).toBe("Apex Agency");
    });

    it("retrieves members of workspace", async () => {
      setupMockServerSupabase(true);

      const mockMembers: WorkspaceMemberWithProfile[] = [
        {
          id: "m1",
          workspace_id: "b0000000-0000-4000-8000-000000000002",
          user_id: mockUser.id,
          role: "workspace_owner",
          status: "active",
          created_at: "2026-11-12T00:00:00Z",
          user: {
            id: mockUser.id,
            display_name: "Owner User",
            email: mockUser.email,
            phone_number: null,
          },
        },
      ];

      vi.spyOn(workspaceService, "getWorkspaceMembers").mockResolvedValue(mockMembers);

      const result = await getWorkspaceMembersAction("b0000000-0000-4000-8000-000000000002");
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });
  });

  describe("updateWorkspaceProfileAction()", () => {
    it("updates workspace profile for authorized user", async () => {
      setupMockServerSupabase(true);

      const mockUpdated: WorkspaceRow = {
        id: "b0000000-0000-4000-8000-000000000002",
        name: "Apex Global Renamed",
        slug: "apex-global-renamed",
        owner_user_id: mockUser.id,
        plan: "starter",
        status: "active",
        created_at: "2026-11-12T00:00:00Z",
        updated_at: "2026-11-12T01:00:00Z",
      };

      vi.spyOn(workspaceService, "updateWorkspaceProfile").mockResolvedValue(mockUpdated);

      const result = await updateWorkspaceProfileAction(null, {
        workspaceId: "b0000000-0000-4000-8000-000000000002",
        name: "Apex Global Renamed",
        slug: "apex-global-renamed",
      });

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe("Apex Global Renamed");
    });

    it("rejects invalid input schema for profile update", async () => {
      setupMockServerSupabase(true);

      const result = await updateWorkspaceProfileAction(null, {
        workspaceId: "not-a-uuid",
      });

      expect(result.success).toBe(false);
      expect(result.fieldErrors).toBeDefined();
    });
  });

  describe("inviteWorkspaceMemberAction()", () => {
    it("generates invitation and returns token", async () => {
      setupMockServerSupabase(true);

      vi.spyOn(workspaceService, "inviteWorkspaceMember").mockResolvedValue({
        invitation: {
          id: "inv_123",
          workspace_id: "b0000000-0000-4000-8000-000000000002",
          email: "designer@apex.in",
          role: "workspace_member",
          token_hash: "mock_hash",
          invited_by: mockUser.id,
          status: "pending",
          expires_at: "2026-11-19T00:00:00Z",
          created_at: "2026-11-12T00:00:00Z",
        },
        rawToken: "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
      });

      const result = await inviteWorkspaceMemberAction(null, {
        workspaceId: "b0000000-0000-4000-8000-000000000002",
        email: "designer@apex.in",
        role: "workspace_member",
      });

      expect(result.success).toBe(true);
      expect(result.data?.invitationId).toBe("inv_123");
      expect(result.data?.rawToken).toHaveLength(64);
    });

    it("rejects invalid email for invitation", async () => {
      setupMockServerSupabase(true);

      const result = await inviteWorkspaceMemberAction(null, {
        workspaceId: "b0000000-0000-4000-8000-000000000002",
        email: "invalid-email",
        role: "workspace_member",
      });

      expect(result.success).toBe(false);
      expect(result.fieldErrors).toBeDefined();
    });
  });

  describe("acceptWorkspaceInvitationAction()", () => {
    it("accepts valid invitation token", async () => {
      setupMockServerSupabase(true);

      vi.spyOn(workspaceService, "acceptWorkspaceInvitation").mockResolvedValue({
        workspaceId: "b0000000-0000-4000-8000-000000000002",
        role: "workspace_member",
      });

      const result = await acceptWorkspaceInvitationAction(null, {
        token: "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
      });

      expect(result.success).toBe(true);
      expect(result.data?.workspaceId).toBe("b0000000-0000-4000-8000-000000000002");
    });

    it("rejects invalid token length", async () => {
      setupMockServerSupabase(true);

      const result = await acceptWorkspaceInvitationAction(null, {
        token: "short",
      });

      expect(result.success).toBe(false);
    });
  });

  describe("updateWorkspaceMemberRoleAction() & removeWorkspaceMemberAction()", () => {
    it("updates member role", async () => {
      setupMockServerSupabase(true);

      const mockMember: WorkspaceMemberRow = {
        id: "c0000000-0000-4000-8000-000000000003",
        workspace_id: "b0000000-0000-4000-8000-000000000002",
        user_id: "d0000000-0000-4000-8000-000000000004",
        role: "workspace_admin",
        status: "active",
        created_at: "2026-11-12T00:00:00Z",
      };

      vi.spyOn(workspaceService, "updateWorkspaceMemberRole").mockResolvedValue(mockMember);

      const result = await updateWorkspaceMemberRoleAction(null, {
        workspaceId: "b0000000-0000-4000-8000-000000000002",
        targetUserId: "d0000000-0000-4000-8000-000000000004",
        newRole: "workspace_admin",
      });

      expect(result.success).toBe(true);
      expect(result.data?.role).toBe("workspace_admin");
    });

    it("rejects invalid role update parameters", async () => {
      setupMockServerSupabase(true);

      const result = await updateWorkspaceMemberRoleAction(null, {
        workspaceId: "not-a-uuid",
        targetUserId: "also-not",
        newRole: "workspace_admin",
      });

      expect(result.success).toBe(false);
      expect(result.fieldErrors).toBeDefined();
    });

    it("removes member", async () => {
      setupMockServerSupabase(true);

      vi.spyOn(workspaceService, "removeWorkspaceMember").mockResolvedValue({ success: true });

      const result = await removeWorkspaceMemberAction(null, {
        workspaceId: "b0000000-0000-4000-8000-000000000002",
        targetUserId: "d0000000-0000-4000-8000-000000000004",
      });

      expect(result.success).toBe(true);
      expect(result.data?.success).toBe(true);
    });

    it("rejects invalid member removal parameters", async () => {
      setupMockServerSupabase(true);

      const result = await removeWorkspaceMemberAction(null, {
        workspaceId: "not-a-uuid",
        targetUserId: "also-not",
      });

      expect(result.success).toBe(false);
      expect(result.fieldErrors).toBeDefined();
    });
  });
});
