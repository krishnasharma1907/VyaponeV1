import { describe, expect, it } from "vitest";
import {
  acceptInvitationSchema,
  createWorkspaceSchema,
  inviteWorkspaceMemberSchema,
  removeMemberSchema,
  updateMemberRoleSchema,
  updateWorkspaceProfileSchema,
} from "@/lib/workspaces/schemas";

describe("Workspace Input Validation Schemas [VO-022]", () => {
  describe("createWorkspaceSchema", () => {
    it("accepts valid workspace payload with default plan", () => {
      const result = createWorkspaceSchema.safeParse({
        name: "Apex Digital Solutions",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Apex Digital Solutions");
        expect(result.data.plan).toBe("starter");
      }
    });

    it("accepts explicit valid slug and plan", () => {
      const result = createWorkspaceSchema.safeParse({
        name: "Apex Digital",
        slug: "apex-digital",
        plan: "agency",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.slug).toBe("apex-digital");
        expect(result.data.plan).toBe("agency");
      }
    });

    it("rejects empty or overly short workspace name", () => {
      const result = createWorkspaceSchema.safeParse({ name: " " });
      expect(result.success).toBe(false);
    });

    it("rejects invalid slug format with spaces or uppercase characters", () => {
      const result = createWorkspaceSchema.safeParse({
        name: "Apex Digital",
        slug: "Apex Digital Slug",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("updateWorkspaceProfileSchema", () => {
    it("accepts valid workspace ID with updated name and slug", () => {
      const result = updateWorkspaceProfileSchema.safeParse({
        workspaceId: "a0000000-0000-4000-8000-000000000001",
        name: "Apex Global Agency",
        slug: "apex-global",
      });
      expect(result.success).toBe(true);
    });

    it("rejects non-UUID workspace ID", () => {
      const result = updateWorkspaceProfileSchema.safeParse({
        workspaceId: "not-a-uuid",
        name: "Apex Global",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("inviteWorkspaceMemberSchema", () => {
    it("accepts valid email and assignable role", () => {
      const result = inviteWorkspaceMemberSchema.safeParse({
        workspaceId: "a0000000-0000-4000-8000-000000000001",
        email: "staff@example.in",
        role: "workspace_member",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invitation with workspace_owner role", () => {
      const result = inviteWorkspaceMemberSchema.safeParse({
        workspaceId: "a0000000-0000-4000-8000-000000000001",
        email: "boss@example.in",
        role: "workspace_owner",
      });
      expect(result.success).toBe(false);
    });

    it("rejects malformed email address", () => {
      const result = inviteWorkspaceMemberSchema.safeParse({
        workspaceId: "a0000000-0000-4000-8000-000000000001",
        email: "not-an-email",
        role: "workspace_member",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("acceptInvitationSchema", () => {
    it("accepts valid 64-character token", () => {
      const result = acceptInvitationSchema.safeParse({
        token: "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
      });
      expect(result.success).toBe(true);
    });

    it("rejects token that is too short", () => {
      const result = acceptInvitationSchema.safeParse({
        token: "short",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("updateMemberRoleSchema & removeMemberSchema", () => {
    it("accepts valid update role payload", () => {
      const result = updateMemberRoleSchema.safeParse({
        workspaceId: "a0000000-0000-4000-8000-000000000001",
        targetUserId: "b0000000-0000-4000-8000-000000000002",
        newRole: "workspace_admin",
      });
      expect(result.success).toBe(true);
    });

    it("accepts valid remove member payload", () => {
      const result = removeMemberSchema.safeParse({
        workspaceId: "a0000000-0000-4000-8000-000000000001",
        targetUserId: "b0000000-0000-4000-8000-000000000002",
      });
      expect(result.success).toBe(true);
    });
  });
});
