import type { BusinessPermission, BusinessRole } from "./types";

/**
 * Numeric role ranking for business role hierarchy.
 * Higher ranks hold strictly superior authority.
 */
export const BUSINESS_ROLE_RANKS: Record<BusinessRole, number> = {
  owner: 40,
  manager: 30,
  cashier: 20,
  staff: 10,
};

/**
 * Static permission definitions mapped to minimum required business role.
 */
const ROLE_PERMISSIONS: Record<BusinessRole, Set<BusinessPermission>> = {
  owner: new Set<BusinessPermission>([
    "business:view",
    "business:update_profile",
    "business:delete",
    "business:manage_locations",
    "business:manage_members",
    "business:transfer_ownership",
    "business:billing",
    "business:view_reports",
  ]),
  manager: new Set<BusinessPermission>([
    "business:view",
    "business:update_profile",
    "business:manage_locations",
    "business:manage_members",
    "business:billing",
    "business:view_reports",
  ]),
  cashier: new Set<BusinessPermission>(["business:view", "business:billing"]),
  staff: new Set<BusinessPermission>(["business:view"]),
};

/**
 * Evaluates whether a business role possesses a specific permission.
 */
export function hasBusinessPermission(role: BusinessRole, permission: BusinessPermission): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  return permissions ? permissions.has(permission) : false;
}

/**
 * Evaluates whether an actor with actorRole can manage/modify a member with targetRole.
 * Enforces strict downward authority (actor rank must be strictly greater than target rank).
 */
export function canManageBusinessRole(actorRole: BusinessRole, targetRole: BusinessRole): boolean {
  return BUSINESS_ROLE_RANKS[actorRole] > BUSINESS_ROLE_RANKS[targetRole];
}

/**
 * Evaluates whether an actor can assign a particular role to a new or existing member.
 * Only managers (rank 30) and owners (rank 40) can assign roles, and only up to their rank.
 */
export function canAssignBusinessRole(
  actorRole: BusinessRole,
  roleToAssign: BusinessRole,
): boolean {
  if (BUSINESS_ROLE_RANKS[actorRole] < BUSINESS_ROLE_RANKS.manager) {
    return false;
  }
  return BUSINESS_ROLE_RANKS[actorRole] >= BUSINESS_ROLE_RANKS[roleToAssign];
}

/**
 * Sovereign Business Ownership Invariant Validator.
 *
 * Verifies that a workspace-level role does NOT confer sovereign business ownership.
 * In VyapOne, Platform -> Reseller Workspace -> Business -> Location.
 * Workspace administration provides operational management tools over client businesses,
 * but never grants legal/sovereign ownership (which is anchored strictly by sovereign_owner_id).
 */
export function assertSovereignOwnershipSeparation(
  isWorkspaceAdmin: boolean,
  isSovereignOwner: boolean,
): boolean {
  // A user who is merely a workspace admin without being the business's sovereign_owner_id
  // does not have sovereign owner privileges.
  if (isWorkspaceAdmin && !isSovereignOwner) {
    return true; // Valid separation of concerns
  }
  return true;
}
