import { describe, expect, it } from "vitest";
import {
  assertSovereignBusinessOwnershipSeparation,
  canAssignRole,
  canManageTargetRole,
  hasWorkspacePermission,
  normalizeWorkspaceRole,
  WORKSPACE_ROLE_RANKS,
} from "@/lib/workspaces/permissions";
import type { WorkspacePermission } from "@/lib/workspaces/types";

describe("Workspace Permissions & Role Hierarchy [VO-022]", () => {
  describe("1. Role Normalization", () => {
    it("normalizes canonical and legacy roles correctly", () => {
      expect(normalizeWorkspaceRole("workspace_owner")).toBe("workspace_owner");
      expect(normalizeWorkspaceRole("workspace_admin")).toBe("workspace_admin");
      expect(normalizeWorkspaceRole("reseller_admin")).toBe("workspace_admin");
      expect(normalizeWorkspaceRole("workspace_member")).toBe("workspace_member");
      expect(normalizeWorkspaceRole("reseller_staff")).toBe("workspace_member");
    });
  });

  describe("2. Role Hierarchy Ranks", () => {
    it("orders roles strictly by rank hierarchy: owner > admin > member", () => {
      expect(WORKSPACE_ROLE_RANKS.workspace_owner).toBeGreaterThan(
        WORKSPACE_ROLE_RANKS.workspace_admin,
      );
      expect(WORKSPACE_ROLE_RANKS.workspace_admin).toBeGreaterThan(
        WORKSPACE_ROLE_RANKS.workspace_member,
      );
    });
  });

  describe("3. Permission Matrix Checks", () => {
    const allPermissions: WorkspacePermission[] = [
      "workspace:view",
      "workspace:update_profile",
      "workspace:invite_member",
      "workspace:change_role",
      "workspace:remove_member",
      "workspace:manage_businesses",
      "workspace:manage_billing",
      "workspace:delete",
    ];

    it("workspace_owner possesses all permissions", () => {
      for (const permission of allPermissions) {
        expect(hasWorkspacePermission("workspace_owner", permission)).toBe(true);
      }
    });

    it("workspace_admin has operational permissions but cannot modify settings, billing, or delete", () => {
      expect(hasWorkspacePermission("workspace_admin", "workspace:view")).toBe(true);
      expect(hasWorkspacePermission("workspace_admin", "workspace:manage_businesses")).toBe(true);
      expect(hasWorkspacePermission("workspace_admin", "workspace:invite_member")).toBe(true);
      expect(hasWorkspacePermission("workspace_admin", "workspace:remove_member")).toBe(true);

      // Prohibited permissions for admin
      expect(hasWorkspacePermission("workspace_admin", "workspace:update_profile")).toBe(false);
      expect(hasWorkspacePermission("workspace_admin", "workspace:change_role")).toBe(false);
      expect(hasWorkspacePermission("workspace_admin", "workspace:manage_billing")).toBe(false);
      expect(hasWorkspacePermission("workspace_admin", "workspace:delete")).toBe(false);
    });

    it("reseller_admin legacy synonym behaves identically to workspace_admin", () => {
      expect(hasWorkspacePermission("reseller_admin", "workspace:view")).toBe(true);
      expect(hasWorkspacePermission("reseller_admin", "workspace:update_profile")).toBe(false);
      expect(hasWorkspacePermission("reseller_admin", "workspace:manage_billing")).toBe(false);
    });

    it("workspace_member possesses only basic viewing and client business management permissions", () => {
      expect(hasWorkspacePermission("workspace_member", "workspace:view")).toBe(true);
      expect(hasWorkspacePermission("workspace_member", "workspace:manage_businesses")).toBe(true);

      // Prohibited permissions for member
      expect(hasWorkspacePermission("workspace_member", "workspace:update_profile")).toBe(false);
      expect(hasWorkspacePermission("workspace_member", "workspace:invite_member")).toBe(false);
      expect(hasWorkspacePermission("workspace_member", "workspace:change_role")).toBe(false);
      expect(hasWorkspacePermission("workspace_member", "workspace:remove_member")).toBe(false);
      expect(hasWorkspacePermission("workspace_member", "workspace:manage_billing")).toBe(false);
      expect(hasWorkspacePermission("workspace_member", "workspace:delete")).toBe(false);
    });

    it("reseller_staff legacy synonym behaves identically to workspace_member", () => {
      expect(hasWorkspacePermission("reseller_staff", "workspace:view")).toBe(true);
      expect(hasWorkspacePermission("reseller_staff", "workspace:invite_member")).toBe(false);
    });
  });

  describe("4. Hierarchy Management & Target Role Authority", () => {
    it("workspace_owner can manage all target roles", () => {
      expect(canManageTargetRole("workspace_owner", "workspace_owner")).toBe(true);
      expect(canManageTargetRole("workspace_owner", "workspace_admin")).toBe(true);
      expect(canManageTargetRole("workspace_owner", "workspace_member")).toBe(true);
      expect(canManageTargetRole("workspace_owner", "reseller_staff")).toBe(true);
    });

    it("workspace_admin can manage only lower-ranked roles (member/staff)", () => {
      expect(canManageTargetRole("workspace_admin", "workspace_member")).toBe(true);
      expect(canManageTargetRole("workspace_admin", "reseller_staff")).toBe(true);

      // Cannot manage peers or superiors
      expect(canManageTargetRole("workspace_admin", "workspace_admin")).toBe(false);
      expect(canManageTargetRole("workspace_admin", "reseller_admin")).toBe(false);
      expect(canManageTargetRole("workspace_admin", "workspace_owner")).toBe(false);
    });

    it("workspace_member cannot manage any role", () => {
      expect(canManageTargetRole("workspace_member", "workspace_member")).toBe(false);
      expect(canManageTargetRole("workspace_member", "workspace_admin")).toBe(false);
      expect(canManageTargetRole("workspace_member", "workspace_owner")).toBe(false);
    });
  });

  describe("5. Role Assignment & Escalation Prevention", () => {
    it("workspace_owner can assign admin and member roles, but not owner via standard assignment", () => {
      expect(canAssignRole("workspace_owner", "workspace_admin")).toBe(true);
      expect(canAssignRole("workspace_owner", "workspace_member")).toBe(true);
      expect(canAssignRole("workspace_owner", "reseller_admin")).toBe(true);
      expect(canAssignRole("workspace_owner", "reseller_staff")).toBe(true);
      expect(canAssignRole("workspace_owner", "workspace_owner")).toBe(false);
    });

    it("workspace_admin cannot assign admin or owner roles (prevent self-escalation)", () => {
      expect(canAssignRole("workspace_admin", "workspace_member")).toBe(true);
      expect(canAssignRole("workspace_admin", "reseller_staff")).toBe(true);

      expect(canAssignRole("workspace_admin", "workspace_admin")).toBe(false);
      expect(canAssignRole("workspace_admin", "reseller_admin")).toBe(false);
      expect(canAssignRole("workspace_admin", "workspace_owner")).toBe(false);
    });

    it("workspace_member cannot assign any role", () => {
      expect(canAssignRole("workspace_member", "workspace_member")).toBe(false);
      expect(canAssignRole("workspace_member", "workspace_admin")).toBe(false);
    });
  });

  describe("6. Sovereign Business Ownership Separation Invariant", () => {
    it("enforces that workspace team membership does not confer sovereign business ownership", () => {
      // Valid separation: Workspace admin or member managing a client business without claiming sovereign ownership
      expect(assertSovereignBusinessOwnershipSeparation("workspace_owner", false)).toBe(true);
      expect(assertSovereignBusinessOwnershipSeparation("workspace_admin", false)).toBe(true);
      expect(assertSovereignBusinessOwnershipSeparation("workspace_member", false)).toBe(true);

      // Invalid claim: regular workspace member claiming to be the sovereign owner
      expect(assertSovereignBusinessOwnershipSeparation("workspace_member", true)).toBe(false);
    });
  });
});
