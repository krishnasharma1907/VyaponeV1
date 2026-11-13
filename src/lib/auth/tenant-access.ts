/**
 * VyapOne — Centralized Tenant Isolation & Authorization Helpers [VO-024]
 *
 * Implements server-side authorization enforcement across the VyapOne tenancy hierarchy:
 *   Platform → Reseller Workspace → Business → Location → Operational Records
 *
 * Invariants:
 * 1. Server-side authoritative: Never trusts user_id, workspace_id, business_id, or role
 *    supplied by client payloads or URL parameters.
 * 2. Fail-Closed & Anti-Enumeration: Missing records or unauthorized requests return
 *    NOT_FOUND (404) or FORBIDDEN (403) without leaking whether foreign tenant records exist.
 * 3. Sovereign Separation: Reseller workspace membership NEVER confers sovereign ownership
 *    over client businesses (which is anchored strictly to businesses.sovereign_owner_id).
 * 4. Location Scoping: Staff assigned to a specific location cannot access or mutate
 *    records belonging to another location.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type {
  WorkspaceMemberRow,
  WorkspacePermission,
  WorkspaceRole,
  WorkspaceRow,
} from "@/lib/workspaces/types";
import { hasWorkspacePermission } from "@/lib/workspaces/permissions";
import type {
  BusinessMemberRow,
  BusinessPermission,
  BusinessRole,
  BusinessRow,
  LocationRow,
} from "@/lib/businesses/types";
import { hasBusinessPermission } from "@/lib/businesses/permissions";

export type TenantErrorCode =
  | "UNAUTHENTICATED"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "TENANT_MISMATCH"
  | "CROSS_TENANT_VIOLATION"
  | "LOCATION_RESTRICTED"
  | "SOVEREIGN_VIOLATION";

export class TenantAccessError extends Error {
  constructor(
    message: string,
    public readonly code: TenantErrorCode,
    public readonly status: number = 403,
  ) {
    super(message);
    this.name = "TenantAccessError";
  }
}

export interface BusinessAccessContext {
  business: BusinessRow;
  callerUserId: string;
  isSovereignOwner: boolean;
  effectiveRole: BusinessRole | null;
  member: BusinessMemberRow | null;
  locationId: string | null;
}

export interface WorkspaceAccessContext {
  workspace: WorkspaceRow;
  callerUserId: string;
  membership: WorkspaceMemberRow;
  role: WorkspaceRole;
}

/**
 * Sanitizes errors for safe transmission to client without leaking internal database details.
 */
export function sanitizeTenantError(error: unknown): {
  error: string;
  code: string;
  status: number;
} {
  if (error instanceof TenantAccessError) {
    return {
      error: error.message,
      code: error.code,
      status: error.status,
    };
  }
  if (error instanceof Error) {
    return {
      error: "An unexpected error occurred",
      code: "INTERNAL_ERROR",
      status: 500,
    };
  }
  return {
    error: "An unexpected error occurred",
    code: "UNKNOWN_ERROR",
    status: 500,
  };
}

/**
 * Derives authenticated user identity strictly from the active server Supabase session.
 * Rejects unauthenticated callers immediately.
 */
export async function assertAuthenticatedUser(
  supabase: SupabaseClient<Database>,
): Promise<{ id: string; email?: string }> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new TenantAccessError("Authentication required", "UNAUTHENTICATED", 401);
  }

  return { id: user.id, email: user.email };
}

/**
 * Validates that the authenticated caller has active membership in the specified workspace
 * and possesses the required role or permission.
 *
 * Uses 404 (NOT_FOUND) when workspace does not exist or caller is not a member,
 * preventing workspace enumeration attacks.
 */
export async function assertWorkspaceAccess(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  options?: {
    requiredRole?: WorkspaceRole;
    requiredPermission?: WorkspacePermission;
  },
): Promise<WorkspaceAccessContext> {
  const caller = await assertAuthenticatedUser(supabase);

  // 1. Fetch workspace record
  const { data: workspace, error: wsError } = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", workspaceId)
    .maybeSingle();

  if (wsError || !workspace) {
    throw new TenantAccessError("Workspace not found", "NOT_FOUND", 404);
  }

  // 2. Fetch caller's membership in the workspace
  const { data: member, error: memberError } = await supabase
    .from("workspace_members")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("user_id", caller.id)
    .eq("status", "active")
    .maybeSingle();

  if (memberError || !member) {
    // If workspace owner record matches caller, synthesize or verify membership
    if (workspace.owner_user_id === caller.id) {
      const syntheticMember: WorkspaceMemberRow = {
        id: "owner-synthetic",
        workspace_id: workspace.id,
        user_id: caller.id,
        role: "workspace_owner",
        status: "active",
        created_at: workspace.created_at,
      };
      return {
        workspace,
        callerUserId: caller.id,
        membership: syntheticMember,
        role: "workspace_owner",
      };
    }
    throw new TenantAccessError("Workspace not found", "NOT_FOUND", 404);
  }

  const role = member.role as WorkspaceRole;

  // 3. Permission checks if requested
  if (options?.requiredPermission && !hasWorkspacePermission(role, options.requiredPermission)) {
    throw new TenantAccessError(
      `Insufficient workspace permissions: requires ${options.requiredPermission}`,
      "FORBIDDEN",
      403,
    );
  }

  return {
    workspace,
    callerUserId: caller.id,
    membership: member,
    role,
  };
}

/**
 * Validates that the authenticated caller has authorized access to the specified business.
 *
 * Evaluates:
 * 1. Sovereign business ownership (businesses.sovereign_owner_id === caller.id).
 * 2. Direct business membership (business_members table with status = 'active').
 * 3. Delegated reseller workspace management (if business is linked to caller's workspace).
 * 4. Location-scoping (ensures staff cannot access locations outside their assignment).
 */
export async function assertBusinessAccess(
  supabase: SupabaseClient<Database>,
  businessId: string,
  options?: {
    requiredRole?: BusinessRole;
    requiredPermission?: BusinessPermission;
    requiredLocationId?: string;
    requireSovereignOwner?: boolean;
  },
): Promise<BusinessAccessContext> {
  const caller = await assertAuthenticatedUser(supabase);

  // 1. Fetch business record
  const { data: business, error: bizError } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", businessId)
    .maybeSingle();

  if (bizError || !business) {
    throw new TenantAccessError("Business not found", "NOT_FOUND", 404);
  }

  const isSovereignOwner = business.sovereign_owner_id === caller.id;

  // 2. Sovereign owner has authoritative, sovereign ownership across all locations & permissions
  if (isSovereignOwner) {
    return {
      business,
      callerUserId: caller.id,
      isSovereignOwner: true,
      effectiveRole: "owner",
      member: null,
      locationId: null,
    };
  }

  // 3. Strict sovereign owner enforcement if requested
  if (options?.requireSovereignOwner) {
    throw new TenantAccessError(
      "Sovereign business owner access required for this operation",
      "SOVEREIGN_VIOLATION",
      403,
    );
  }

  // 4. Fetch direct business membership
  const { data: member } = await supabase
    .from("business_members")
    .select("*")
    .eq("business_id", businessId)
    .eq("user_id", caller.id)
    .eq("status", "active")
    .maybeSingle();

  let effectiveRole: BusinessRole | null = (member?.role as BusinessRole) ?? null;
  const assignedLocationId: string | null = member?.location_id ?? null;

  if (isSovereignOwner) {
    effectiveRole = "owner";
  }

  // 4. If not direct member or sovereign owner, check reseller workspace delegation
  if (!effectiveRole && business.workspace_id) {
    const { data: wsMember } = await supabase
      .from("workspace_members")
      .select("role, status")
      .eq("workspace_id", business.workspace_id)
      .eq("user_id", caller.id)
      .eq("status", "active")
      .maybeSingle();

    if (
      wsMember &&
      ["workspace_owner", "workspace_admin", "reseller_admin"].includes(wsMember.role)
    ) {
      // Reseller management granted for operational tasks, but NOT sovereign ownership
      effectiveRole = "manager";
    }
  }

  // 5. If caller has no role through any path, return 404 to avoid tenant enumeration
  if (!effectiveRole) {
    throw new TenantAccessError("Business not found", "NOT_FOUND", 404);
  }

  // 6. Permission evaluation if requested
  if (
    options?.requiredPermission &&
    !hasBusinessPermission(effectiveRole, options.requiredPermission)
  ) {
    throw new TenantAccessError(
      `Insufficient business permissions: requires ${options.requiredPermission}`,
      "FORBIDDEN",
      403,
    );
  }

  // 7. Location scoping enforcement
  if (options?.requiredLocationId) {
    // Sovereign owners and managers have full multi-location authority
    const hasMultiLocationAuthority =
      isSovereignOwner || ["owner", "manager"].includes(effectiveRole);

    if (!hasMultiLocationAuthority) {
      // Operational staff / cashiers must match assigned location
      if (assignedLocationId && assignedLocationId !== options.requiredLocationId) {
        throw new TenantAccessError(
          "Access denied: restricted to assigned location",
          "LOCATION_RESTRICTED",
          403,
        );
      }
    }
  }

  return {
    business,
    callerUserId: caller.id,
    isSovereignOwner,
    effectiveRole,
    member: member ?? null,
    locationId: assignedLocationId,
  };
}

/**
 * Asserts that the authenticated caller is strictly the sovereign owner of the business.
 * Reseller admins and operational managers are rejected.
 */
export async function assertSovereignOwner(
  supabase: SupabaseClient<Database>,
  businessId: string,
): Promise<{ business: BusinessRow; callerUserId: string }> {
  const context = await assertBusinessAccess(supabase, businessId, {
    requireSovereignOwner: true,
  });
  return { business: context.business, callerUserId: context.callerUserId };
}

/**
 * Enforces cross-tenant entity containment.
 * Prohibits moving records across tenants or referencing foreign business entities.
 */
export function assertRecordBelongsToBusiness(
  entityBusinessId: string,
  expectedBusinessId: string,
  entityName: string = "Record",
): void {
  if (entityBusinessId !== expectedBusinessId) {
    throw new TenantAccessError(
      `Tenant boundary violation: ${entityName} belongs to a different business tenant`,
      "CROSS_TENANT_VIOLATION",
      403,
    );
  }
}

/**
 * Verifies that a specific location belongs to the target business tenant.
 */
export async function assertLocationBelongsToBusiness(
  supabase: SupabaseClient<Database>,
  businessId: string,
  locationId: string,
): Promise<LocationRow> {
  const { data: location, error } = await supabase
    .from("locations")
    .select("*")
    .eq("id", locationId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (error || !location) {
    throw new TenantAccessError("Location not found for the specified business", "NOT_FOUND", 404);
  }

  return location;
}
