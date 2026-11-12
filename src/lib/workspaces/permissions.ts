import type { NormalizedWorkspaceRole, WorkspacePermission, WorkspaceRole } from "./types";

/**
 * Normalizes legacy/synonym roles to canonical workspace roles.
 */
export function normalizeWorkspaceRole(role: WorkspaceRole): NormalizedWorkspaceRole {
  switch (role) {
    case "workspace_owner":
      return "workspace_owner";
    case "workspace_admin":
    case "reseller_admin":
      return "workspace_admin";
    case "workspace_member":
    case "reseller_staff":
      return "workspace_member";
    default: {
      const _exhaustiveCheck: never = role;
      return _exhaustiveCheck;
    }
  }
}

/**
 * Role numeric hierarchy rank.
 * Higher rank represents higher authority in workspace management.
 */
export const WORKSPACE_ROLE_RANKS: Record<NormalizedWorkspaceRole, number> = {
  workspace_owner: 30,
  workspace_admin: 20,
  workspace_member: 10,
};

/**
 * Centralized Workspace Permission Matrix.
 */
const WORKSPACE_PERMISSION_MATRIX: Record<
  NormalizedWorkspaceRole,
  Record<WorkspacePermission, boolean>
> = {
  workspace_owner: {
    "workspace:view": true,
    "workspace:update_profile": true,
    "workspace:invite_member": true,
    "workspace:change_role": true,
    "workspace:remove_member": true,
    "workspace:manage_businesses": true,
    "workspace:manage_billing": true,
    "workspace:delete": true,
  },
  workspace_admin: {
    "workspace:view": true,
    "workspace:update_profile": false,
    "workspace:invite_member": true,
    "workspace:change_role": false,
    "workspace:remove_member": true,
    "workspace:manage_businesses": true,
    "workspace:manage_billing": false,
    "workspace:delete": false,
  },
  workspace_member: {
    "workspace:view": true,
    "workspace:update_profile": false,
    "workspace:invite_member": false,
    "workspace:change_role": false,
    "workspace:remove_member": false,
    "workspace:manage_businesses": true,
    "workspace:manage_billing": false,
    "workspace:delete": false,
  },
};

/**
 * Checks if a given workspace role has a specific permission.
 */
export function hasWorkspacePermission(
  role: WorkspaceRole,
  permission: WorkspacePermission,
): boolean {
  const normalized = normalizeWorkspaceRole(role);
  return WORKSPACE_PERMISSION_MATRIX[normalized]?.[permission] ?? false;
}

/**
 * Determines whether an actor role has sufficient authority to manage a target member's role.
 * Rules:
 * 1. workspace_owner can manage everyone (except cannot remove/demote sole owner).
 * 2. workspace_admin can only manage members with strictly lower rank (workspace_member).
 * 3. workspace_member cannot manage any members.
 */
export function canManageTargetRole(actorRole: WorkspaceRole, targetRole: WorkspaceRole): boolean {
  const normalizedActor = normalizeWorkspaceRole(actorRole);
  const normalizedTarget = normalizeWorkspaceRole(targetRole);

  const actorRank = WORKSPACE_ROLE_RANKS[normalizedActor];
  const targetRank = WORKSPACE_ROLE_RANKS[normalizedTarget];

  // Owner can manage anyone
  if (normalizedActor === "workspace_owner") {
    return true;
  }

  // Admins can only manage roles strictly below admin rank (i.e., members)
  return actorRank > targetRank;
}

/**
 * Determines whether an actor can invite or assign a desired role to a member.
 * Rules:
 * 1. workspace_owner can assign workspace_admin or workspace_member.
 * 2. workspace_admin can only assign workspace_member.
 * 3. No one can assign workspace_owner via invitation (ownership is established on creation or transfer).
 */
export function canAssignRole(actorRole: WorkspaceRole, desiredRole: WorkspaceRole): boolean {
  const normalizedActor = normalizeWorkspaceRole(actorRole);
  const normalizedDesired = normalizeWorkspaceRole(desiredRole);

  // workspace_owner cannot be granted via simple invite/assignment
  if (normalizedDesired === "workspace_owner") {
    return false;
  }

  if (normalizedActor === "workspace_owner") {
    return true;
  }

  if (normalizedActor === "workspace_admin") {
    return normalizedDesired === "workspace_member";
  }

  return false;
}

/**
 * Domain Boundary Assertion:
 * Enforces that Reseller Workspace administration is strictly partitioned from Sovereign Business Ownership.
 * Reseller Workspace roles grant administrative agency management, but sovereign business ownership
 * belongs strictly to the merchant entity (sovereign_owner_id).
 */
export function assertSovereignBusinessOwnershipSeparation(
  workspaceRole: WorkspaceRole,
  isBusinessOwner: boolean,
): boolean {
  // A workspace member is not automatically the sovereign owner of managed client businesses
  const normalized = normalizeWorkspaceRole(workspaceRole);
  if (normalized === "workspace_member" && isBusinessOwner) {
    // A regular workspace team member cannot claim sovereign business ownership purely through workspace membership
    return false;
  }
  return true;
}
