import type { Database } from "@/lib/supabase/types";

export type WorkspaceRow = Database["public"]["Tables"]["workspaces"]["Row"];
export type WorkspaceInsert = Database["public"]["Tables"]["workspaces"]["Insert"];
export type WorkspaceUpdate = Database["public"]["Tables"]["workspaces"]["Update"];

export type WorkspaceMemberRow = Database["public"]["Tables"]["workspace_members"]["Row"];
export type WorkspaceMemberInsert = Database["public"]["Tables"]["workspace_members"]["Insert"];
export type WorkspaceMemberUpdate = Database["public"]["Tables"]["workspace_members"]["Update"];

export type WorkspaceInvitationRow = Database["public"]["Tables"]["workspace_invitations"]["Row"];
export type WorkspaceInvitationInsert =
  Database["public"]["Tables"]["workspace_invitations"]["Insert"];

/**
 * Workspace membership roles.
 * Canonical roles: 'workspace_owner' | 'workspace_admin' | 'workspace_member'
 * Backwards-compatible legacy synonyms: 'reseller_admin' | 'reseller_staff'
 */
export type WorkspaceRole =
  "workspace_owner" | "workspace_admin" | "workspace_member" | "reseller_admin" | "reseller_staff";

/**
 * Normalized workspace roles for internal permission evaluation.
 */
export type NormalizedWorkspaceRole = "workspace_owner" | "workspace_admin" | "workspace_member";

/**
 * Workspace granular permissions.
 */
export type WorkspacePermission =
  | "workspace:view"
  | "workspace:update_profile"
  | "workspace:invite_member"
  | "workspace:change_role"
  | "workspace:remove_member"
  | "workspace:manage_businesses"
  | "workspace:manage_billing"
  | "workspace:delete";

/**
 * Workspace member with linked user profile.
 */
export interface WorkspaceMemberWithProfile {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  status: "active" | "invited" | "deactivated";
  created_at: string;
  user: {
    id: string;
    display_name: string;
    email: string | null;
    phone_number: string | null;
  };
}

/**
 * Workspace summary including active membership count.
 */
export interface WorkspaceSummary {
  workspace: WorkspaceRow;
  memberCount: number;
  currentUserRole: WorkspaceRole;
}

/**
 * Result of creating a member invitation.
 */
export interface CreateInvitationResult {
  invitation: WorkspaceInvitationRow;
  rawToken: string;
}
