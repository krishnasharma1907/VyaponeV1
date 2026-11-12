import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type {
  CreateInvitationResult,
  WorkspaceMemberRow,
  WorkspaceMemberWithProfile,
  WorkspaceRole,
  WorkspaceRow,
  WorkspaceSummary,
} from "./types";
import {
  canAssignRole,
  canManageTargetRole,
  hasWorkspacePermission,
  normalizeWorkspaceRole,
} from "./permissions";
import { generateInvitationToken, hashInvitationToken, isInvitationExpired } from "./tokens";

export class WorkspaceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number = 400,
  ) {
    super(message);
    this.name = "WorkspaceError";
  }
}

/**
 * Creates a slug from a workspace name if not provided.
 */
function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "workspace";
}

/**
 * Creates a new workspace and sets the creator as workspace_owner.
 */
export async function createWorkspace(
  supabase: SupabaseClient<Database>,
  input: {
    name: string;
    slug?: string;
    plan?: "starter" | "pro" | "agency";
    ownerUserId: string;
  },
): Promise<WorkspaceRow> {
  const slug = input.slug
    ? slugify(input.slug)
    : `${slugify(input.name)}-${Math.random().toString(36).substring(2, 6)}`;
  const plan = input.plan ?? "starter";

  // 1. Insert Workspace
  const { data: workspace, error: wsError } = await supabase
    .from("workspaces")
    .insert({
      name: input.name,
      slug,
      owner_user_id: input.ownerUserId,
      plan,
      status: "active",
    })
    .select("*")
    .single();

  if (wsError || !workspace) {
    if (wsError?.code === "23505") {
      throw new WorkspaceError("A workspace with this slug already exists", "SLUG_CONFLICT", 409);
    }
    throw new WorkspaceError(
      wsError?.message ?? "Failed to create workspace",
      "WORKSPACE_CREATE_FAILED",
      500,
    );
  }

  // 2. Insert creator as workspace_owner
  const { error: memberError } = await supabase.from("workspace_members").insert({
    workspace_id: workspace.id,
    user_id: input.ownerUserId,
    role: "workspace_owner",
    status: "active",
  });

  if (memberError) {
    throw new WorkspaceError(memberError.message, "WORKSPACE_MEMBER_INIT_FAILED", 500);
  }

  // 3. Immutable audit log record
  await supabase.from("audit_logs").insert({
    workspace_id: workspace.id,
    user_id: input.ownerUserId,
    action: "workspace.created",
    resource: "workspaces",
    metadata_json: {
      name: workspace.name,
      slug: workspace.slug,
      plan: workspace.plan,
    },
  });

  return workspace;
}

/**
 * Fetches all workspaces where the user has active membership.
 */
export async function getUserWorkspaces(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<WorkspaceSummary[]> {
  const { data: memberships, error } = await supabase
    .from("workspace_members")
    .select("role, workspace_id, workspaces (*)")
    .eq("user_id", userId)
    .eq("status", "active");

  if (error || !memberships) {
    throw new WorkspaceError(
      error?.message ?? "Failed to retrieve user workspaces",
      "FETCH_WORKSPACES_FAILED",
      500,
    );
  }

  const results: WorkspaceSummary[] = [];

  for (const m of memberships) {
    const ws = m.workspaces as unknown as WorkspaceRow;
    if (ws && ws.status === "active") {
      // Get member count for workspace
      const { count } = await supabase
        .from("workspace_members")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", ws.id)
        .eq("status", "active");

      results.push({
        workspace: ws,
        currentUserRole: m.role as WorkspaceRole,
        memberCount: count ?? 1,
      });
    }
  }

  return results;
}

/**
 * Fetches workspace details with verified membership for requesting user.
 */
export async function getWorkspaceById(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  requestingUserId: string,
): Promise<{ workspace: WorkspaceRow; userRole: WorkspaceRole }> {
  // Check membership
  const { data: member, error: memError } = await supabase
    .from("workspace_members")
    .select("role, status")
    .eq("workspace_id", workspaceId)
    .eq("user_id", requestingUserId)
    .eq("status", "active")
    .single();

  if (memError || !member) {
    throw new WorkspaceError(
      "Access denied: Not an active member of this workspace",
      "ACCESS_DENIED",
      403,
    );
  }

  const { data: ws, error: wsError } = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", workspaceId)
    .single();

  if (wsError || !ws) {
    throw new WorkspaceError("Workspace not found", "NOT_FOUND", 404);
  }

  return { workspace: ws, userRole: member.role as WorkspaceRole };
}

/**
 * Fetches members of a workspace with their user profile details.
 */
export async function getWorkspaceMembers(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  requestingUserId: string,
): Promise<WorkspaceMemberWithProfile[]> {
  // Ensure requesting user has view permission
  const { userRole } = await getWorkspaceById(supabase, workspaceId, requestingUserId);
  if (!hasWorkspacePermission(userRole, "workspace:view")) {
    throw new WorkspaceError("Access denied: Cannot view workspace members", "ACCESS_DENIED", 403);
  }

  const { data: members, error } = await supabase
    .from("workspace_members")
    .select(
      "id, workspace_id, user_id, role, status, created_at, users (id, display_name, email, phone_number)",
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  if (error || !members) {
    throw new WorkspaceError(
      error?.message ?? "Failed to fetch workspace members",
      "FETCH_MEMBERS_FAILED",
      500,
    );
  }

  return members.map((m) => ({
    id: m.id,
    workspace_id: m.workspace_id,
    user_id: m.user_id,
    role: m.role as WorkspaceRole,
    status: m.status as "active" | "invited" | "deactivated",
    created_at: m.created_at,
    user: (m.users as unknown as WorkspaceMemberWithProfile["user"]) || {
      id: m.user_id,
      display_name: "Unknown User",
      email: null,
      phone_number: null,
    },
  }));
}

/**
 * Updates workspace profile/settings.
 */
export async function updateWorkspaceProfile(
  supabase: SupabaseClient<Database>,
  input: {
    workspaceId: string;
    actorUserId: string;
    name?: string;
    slug?: string;
  },
): Promise<WorkspaceRow> {
  const { userRole } = await getWorkspaceById(supabase, input.workspaceId, input.actorUserId);

  if (!hasWorkspacePermission(userRole, "workspace:update_profile")) {
    throw new WorkspaceError(
      "Insufficient permissions to update workspace settings",
      "INSUFFICIENT_PERMISSIONS",
      403,
    );
  }

  const updates: Partial<WorkspaceRow> = {};
  if (input.name) updates.name = input.name;
  if (input.slug) updates.slug = slugify(input.slug);

  const { data: updated, error } = await supabase
    .from("workspaces")
    .update(updates)
    .eq("id", input.workspaceId)
    .select("*")
    .single();

  if (error || !updated) {
    if (error?.code === "23505") {
      throw new WorkspaceError("Slug is already taken by another workspace", "SLUG_CONFLICT", 409);
    }
    throw new WorkspaceError(error?.message ?? "Failed to update workspace", "UPDATE_FAILED", 500);
  }

  // Audit log with safe redacted metadata (no credentials)
  await supabase.from("audit_logs").insert({
    workspace_id: input.workspaceId,
    user_id: input.actorUserId,
    action: "workspace.profile_updated",
    resource: "workspaces",
    metadata_json: {
      updated_fields: Object.keys(updates),
      name: updated.name,
      slug: updated.slug,
    },
  });

  return updated;
}

/**
 * Invites a new member to the workspace with secure token generation and hashing.
 */
export async function inviteWorkspaceMember(
  supabase: SupabaseClient<Database>,
  input: {
    workspaceId: string;
    actorUserId: string;
    email: string;
    role: WorkspaceRole;
  },
): Promise<CreateInvitationResult> {
  const { userRole } = await getWorkspaceById(supabase, input.workspaceId, input.actorUserId);

  if (!hasWorkspacePermission(userRole, "workspace:invite_member")) {
    throw new WorkspaceError(
      "Insufficient permissions to invite members",
      "INSUFFICIENT_PERMISSIONS",
      403,
    );
  }

  if (!canAssignRole(userRole, input.role)) {
    throw new WorkspaceError(
      `Cannot invite a member with role '${input.role}' (insufficient actor authority)`,
      "ROLE_ESCALATION_DENIED",
      403,
    );
  }

  const normalizedEmail = input.email.trim().toLowerCase();

  // Check if active member already exists
  const { data: existingUser } = await supabase
    .from("users")
    .select("id")
    .eq("email", normalizedEmail)
    .single();

  if (existingUser) {
    const { data: existingMember } = await supabase
      .from("workspace_members")
      .select("id, status")
      .eq("workspace_id", input.workspaceId)
      .eq("user_id", existingUser.id)
      .eq("status", "active")
      .single();

    if (existingMember) {
      throw new WorkspaceError(
        "User is already an active member of this workspace",
        "ALREADY_MEMBER",
        409,
      );
    }
  }

  // Generate secure token and SHA-256 hash
  const rawToken = generateInvitationToken();
  const tokenHash = hashInvitationToken(rawToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

  const { data: invitation, error } = await supabase
    .from("workspace_invitations")
    .insert({
      workspace_id: input.workspaceId,
      email: normalizedEmail,
      role: input.role,
      token_hash: tokenHash,
      invited_by: input.actorUserId,
      status: "pending",
      expires_at: expiresAt,
    })
    .select("*")
    .single();

  if (error || !invitation) {
    throw new WorkspaceError(
      error?.message ?? "Failed to create invitation",
      "INVITATION_CREATE_FAILED",
      500,
    );
  }

  // Audit log strictly redacts raw token
  await supabase.from("audit_logs").insert({
    workspace_id: input.workspaceId,
    user_id: input.actorUserId,
    action: "workspace.member_invited",
    resource: "workspace_invitations",
    metadata_json: {
      recipient_email: normalizedEmail,
      role: input.role,
      expires_at: expiresAt,
      // RAW TOKEN IS NEVER STORED OR LOGGED
    },
  });

  return { invitation, rawToken };
}

/**
 * Accepts a workspace invitation using the raw token.
 */
export async function acceptWorkspaceInvitation(
  supabase: SupabaseClient<Database>,
  input: {
    token: string;
    acceptingUser: {
      id: string;
      email: string;
    };
  },
): Promise<{ workspaceId: string; role: WorkspaceRole }> {
  const tokenHash = hashInvitationToken(input.token.trim());

  // Find invitation
  const { data: invitation, error: fetchError } = await supabase
    .from("workspace_invitations")
    .select("*")
    .eq("token_hash", tokenHash)
    .single();

  if (fetchError || !invitation) {
    throw new WorkspaceError("Invalid or nonexistent invitation token", "INVALID_TOKEN", 404);
  }

  if (invitation.status !== "pending") {
    throw new WorkspaceError(
      `Invitation is no longer valid (status: ${invitation.status})`,
      "INVITATION_INACTIVE",
      410,
    );
  }

  if (isInvitationExpired(invitation.expires_at)) {
    // Mark as expired
    await supabase
      .from("workspace_invitations")
      .update({ status: "expired" })
      .eq("id", invitation.id);

    throw new WorkspaceError("Invitation has expired", "INVITATION_EXPIRED", 410);
  }

  // Verify accepting user email matches invitation email
  if (invitation.email.toLowerCase() !== input.acceptingUser.email.trim().toLowerCase()) {
    throw new WorkspaceError(
      "Authenticated user email does not match invitation recipient",
      "EMAIL_MISMATCH",
      403,
    );
  }

  // Insert or update member in workspace_members
  const { error: memberError } = await supabase.from("workspace_members").upsert(
    {
      workspace_id: invitation.workspace_id,
      user_id: input.acceptingUser.id,
      role: invitation.role,
      status: "active",
    },
    { onConflict: "workspace_id,user_id" },
  );

  if (memberError) {
    throw new WorkspaceError(memberError.message, "JOIN_WORKSPACE_FAILED", 500);
  }

  // Mark invitation as accepted
  await supabase
    .from("workspace_invitations")
    .update({ status: "accepted" })
    .eq("id", invitation.id);

  // Audit log
  await supabase.from("audit_logs").insert({
    workspace_id: invitation.workspace_id,
    user_id: input.acceptingUser.id,
    action: "workspace.invitation_accepted",
    resource: "workspace_members",
    metadata_json: {
      invitation_id: invitation.id,
      assigned_role: invitation.role,
    },
  });

  return { workspaceId: invitation.workspace_id, role: invitation.role as WorkspaceRole };
}

/**
 * Updates a workspace member's role with last-owner protection and hierarchy enforcement.
 */
export async function updateWorkspaceMemberRole(
  supabase: SupabaseClient<Database>,
  input: {
    workspaceId: string;
    actorUserId: string;
    targetUserId: string;
    newRole: WorkspaceRole;
  },
): Promise<WorkspaceMemberRow> {
  const { userRole: actorRole } = await getWorkspaceById(
    supabase,
    input.workspaceId,
    input.actorUserId,
  );

  if (!hasWorkspacePermission(actorRole, "workspace:change_role")) {
    throw new WorkspaceError(
      "Insufficient permissions to change member roles",
      "INSUFFICIENT_PERMISSIONS",
      403,
    );
  }

  // Fetch target member
  const { data: targetMember, error: targetError } = await supabase
    .from("workspace_members")
    .select("*")
    .eq("workspace_id", input.workspaceId)
    .eq("user_id", input.targetUserId)
    .eq("status", "active")
    .single();

  if (targetError || !targetMember) {
    throw new WorkspaceError("Target member not found in workspace", "MEMBER_NOT_FOUND", 404);
  }

  // Enforce hierarchy
  if (!canManageTargetRole(actorRole, targetMember.role as WorkspaceRole)) {
    throw new WorkspaceError(
      "Cannot modify role of a member with equal or higher rank",
      "HIERARCHY_VIOLATION",
      403,
    );
  }

  if (!canAssignRole(actorRole, input.newRole)) {
    throw new WorkspaceError(`Cannot assign role '${input.newRole}'`, "CANNOT_ASSIGN_ROLE", 403);
  }

  // Last-Owner Protection: Cannot demote sole owner
  if (
    normalizeWorkspaceRole(targetMember.role as WorkspaceRole) === "workspace_owner" &&
    normalizeWorkspaceRole(input.newRole) !== "workspace_owner"
  ) {
    const { count } = await supabase
      .from("workspace_members")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", input.workspaceId)
      .eq("role", "workspace_owner")
      .eq("status", "active");

    if ((count ?? 0) <= 1) {
      throw new WorkspaceError(
        "Cannot demote the sole workspace owner. A workspace must retain at least one active owner.",
        "LAST_OWNER_PROTECTION",
        400,
      );
    }
  }

  // Update role
  const { data: updated, error: updateError } = await supabase
    .from("workspace_members")
    .update({ role: input.newRole })
    .eq("id", targetMember.id)
    .select("*")
    .single();

  if (updateError || !updated) {
    throw new WorkspaceError(
      updateError?.message ?? "Failed to update member role",
      "UPDATE_ROLE_FAILED",
      500,
    );
  }

  // Audit log
  await supabase.from("audit_logs").insert({
    workspace_id: input.workspaceId,
    user_id: input.actorUserId,
    action: "workspace.member_role_changed",
    resource: "workspace_members",
    metadata_json: {
      target_user_id: input.targetUserId,
      old_role: targetMember.role,
      new_role: input.newRole,
    },
  });

  return updated;
}

/**
 * Removes or deactivates a member from a workspace with last-owner protection.
 */
export async function removeWorkspaceMember(
  supabase: SupabaseClient<Database>,
  input: {
    workspaceId: string;
    actorUserId: string;
    targetUserId: string;
  },
): Promise<{ success: boolean }> {
  const { userRole: actorRole } = await getWorkspaceById(
    supabase,
    input.workspaceId,
    input.actorUserId,
  );

  const isSelfLeaving = input.actorUserId === input.targetUserId;

  if (!isSelfLeaving && !hasWorkspacePermission(actorRole, "workspace:remove_member")) {
    throw new WorkspaceError(
      "Insufficient permissions to remove members",
      "INSUFFICIENT_PERMISSIONS",
      403,
    );
  }

  // Fetch target member
  const { data: targetMember, error: targetError } = await supabase
    .from("workspace_members")
    .select("*")
    .eq("workspace_id", input.workspaceId)
    .eq("user_id", input.targetUserId)
    .eq("status", "active")
    .single();

  if (targetError || !targetMember) {
    throw new WorkspaceError("Target member not found in workspace", "MEMBER_NOT_FOUND", 404);
  }

  // If not self-leaving, verify hierarchy
  if (!isSelfLeaving && !canManageTargetRole(actorRole, targetMember.role as WorkspaceRole)) {
    throw new WorkspaceError(
      "Cannot remove a member with equal or higher rank",
      "HIERARCHY_VIOLATION",
      403,
    );
  }

  // Last-Owner Protection: Cannot remove or leave as sole owner
  if (normalizeWorkspaceRole(targetMember.role as WorkspaceRole) === "workspace_owner") {
    const { count } = await supabase
      .from("workspace_members")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", input.workspaceId)
      .eq("role", "workspace_owner")
      .eq("status", "active");

    if ((count ?? 0) <= 1) {
      throw new WorkspaceError(
        "Cannot remove the sole workspace owner. A workspace must retain at least one active owner.",
        "LAST_OWNER_PROTECTION",
        400,
      );
    }
  }

  // Deactivate member
  const { error: removeError } = await supabase
    .from("workspace_members")
    .update({ status: "deactivated" })
    .eq("id", targetMember.id);

  if (removeError) {
    throw new WorkspaceError(removeError.message, "REMOVE_MEMBER_FAILED", 500);
  }

  // Audit log
  await supabase.from("audit_logs").insert({
    workspace_id: input.workspaceId,
    user_id: input.actorUserId,
    action: isSelfLeaving ? "workspace.member_left" : "workspace.member_removed",
    resource: "workspace_members",
    metadata_json: {
      target_user_id: input.targetUserId,
      target_role: targetMember.role,
    },
  });

  return { success: true };
}
