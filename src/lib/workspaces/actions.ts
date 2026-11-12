"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  createWorkspaceSchema,
  updateWorkspaceProfileSchema,
  inviteWorkspaceMemberSchema,
  acceptInvitationSchema,
  updateMemberRoleSchema,
  removeMemberSchema,
  type CreateWorkspaceInput,
  type UpdateWorkspaceProfileInput,
  type InviteWorkspaceMemberInput,
  type AcceptInvitationInput,
  type UpdateMemberRoleInput,
  type RemoveMemberInput,
} from "./schemas";
import {
  createWorkspace,
  getUserWorkspaces,
  getWorkspaceById,
  getWorkspaceMembers,
  updateWorkspaceProfile,
  inviteWorkspaceMember,
  acceptWorkspaceInvitation,
  updateWorkspaceMemberRole,
  removeWorkspaceMember,
  WorkspaceError,
} from "./service";
import type {
  WorkspaceRow,
  WorkspaceSummary,
  WorkspaceMemberWithProfile,
  WorkspaceMemberRow,
  WorkspaceRole,
} from "./types";

export interface WorkspaceActionResult<T = void> {
  success: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  data?: T;
}

function extractFormData(formData: FormData): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  formData.forEach((value, key) => {
    data[key] = value;
  });
  return data;
}

/**
 * Creates a new reseller workspace and establishes the creator as workspace_owner.
 */
export async function createWorkspaceAction(
  _prevState: unknown,
  input: FormData | CreateWorkspaceInput,
): Promise<WorkspaceActionResult<WorkspaceRow>> {
  try {
    const rawData = input instanceof FormData ? extractFormData(input) : input;
    const parsed = createWorkspaceSchema.safeParse(rawData);

    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      const firstErrorMessage =
        Object.values(fieldErrors)[0]?.[0] || "Invalid workspace details provided";
      return { success: false, error: firstErrorMessage, fieldErrors };
    }

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Authentication required to create a workspace" };
    }

    const workspace = await createWorkspace(supabase, {
      name: parsed.data.name,
      slug: parsed.data.slug,
      plan: parsed.data.plan,
      ownerUserId: user.id,
    });

    return {
      success: true,
      message: "Workspace created successfully",
      data: workspace,
    };
  } catch (err) {
    if (err instanceof WorkspaceError) {
      return { success: false, error: err.message };
    }
    const message = err instanceof Error ? err.message : "Failed to create workspace";
    return { success: false, error: message };
  }
}

/**
 * Retrieves all workspaces the authenticated user belongs to.
 */
export async function getUserWorkspacesAction(): Promise<
  WorkspaceActionResult<WorkspaceSummary[]>
> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Authentication required" };
    }

    const workspaces = await getUserWorkspaces(supabase, user.id);
    return { success: true, data: workspaces };
  } catch (err) {
    if (err instanceof WorkspaceError) {
      return { success: false, error: err.message };
    }
    const message = err instanceof Error ? err.message : "Failed to retrieve workspaces";
    return { success: false, error: message };
  }
}

/**
 * Retrieves details for a specific workspace.
 */
export async function getWorkspaceAction(
  workspaceId: string,
): Promise<WorkspaceActionResult<{ workspace: WorkspaceRow; userRole: WorkspaceRole }>> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Authentication required" };
    }

    const result = await getWorkspaceById(supabase, workspaceId, user.id);
    return { success: true, data: result };
  } catch (err) {
    if (err instanceof WorkspaceError) {
      return { success: false, error: err.message };
    }
    const message = err instanceof Error ? err.message : "Failed to retrieve workspace";
    return { success: false, error: message };
  }
}

/**
 * Retrieves members of a specific workspace.
 */
export async function getWorkspaceMembersAction(
  workspaceId: string,
): Promise<WorkspaceActionResult<WorkspaceMemberWithProfile[]>> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Authentication required" };
    }

    const members = await getWorkspaceMembers(supabase, workspaceId, user.id);
    return { success: true, data: members };
  } catch (err) {
    if (err instanceof WorkspaceError) {
      return { success: false, error: err.message };
    }
    const message = err instanceof Error ? err.message : "Failed to retrieve workspace members";
    return { success: false, error: message };
  }
}

/**
 * Updates workspace profile / branding details.
 */
export async function updateWorkspaceProfileAction(
  _prevState: unknown,
  input: FormData | UpdateWorkspaceProfileInput,
): Promise<WorkspaceActionResult<WorkspaceRow>> {
  try {
    const rawData = input instanceof FormData ? extractFormData(input) : input;
    const parsed = updateWorkspaceProfileSchema.safeParse(rawData);

    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      const firstErrorMessage =
        Object.values(fieldErrors)[0]?.[0] || "Invalid workspace profile details";
      return { success: false, error: firstErrorMessage, fieldErrors };
    }

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Authentication required" };
    }

    const updated = await updateWorkspaceProfile(supabase, {
      workspaceId: parsed.data.workspaceId,
      actorUserId: user.id,
      name: parsed.data.name,
      slug: parsed.data.slug,
    });

    return {
      success: true,
      message: "Workspace profile updated successfully",
      data: updated,
    };
  } catch (err) {
    if (err instanceof WorkspaceError) {
      return { success: false, error: err.message };
    }
    const message = err instanceof Error ? err.message : "Failed to update workspace profile";
    return { success: false, error: message };
  }
}

/**
 * Invites a new team member to a workspace.
 */
export async function inviteWorkspaceMemberAction(
  _prevState: unknown,
  input: FormData | InviteWorkspaceMemberInput,
): Promise<WorkspaceActionResult<{ invitationId: string; rawToken: string }>> {
  try {
    const rawData = input instanceof FormData ? extractFormData(input) : input;
    const parsed = inviteWorkspaceMemberSchema.safeParse(rawData);

    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      const firstErrorMessage =
        Object.values(fieldErrors)[0]?.[0] || "Invalid invitation details provided";
      return { success: false, error: firstErrorMessage, fieldErrors };
    }

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Authentication required" };
    }

    const result = await inviteWorkspaceMember(supabase, {
      workspaceId: parsed.data.workspaceId,
      actorUserId: user.id,
      email: parsed.data.email,
      role: parsed.data.role,
    });

    return {
      success: true,
      message: "Invitation generated successfully",
      data: {
        invitationId: result.invitation.id,
        rawToken: result.rawToken,
      },
    };
  } catch (err) {
    if (err instanceof WorkspaceError) {
      return { success: false, error: err.message };
    }
    const message = err instanceof Error ? err.message : "Failed to invite member";
    return { success: false, error: message };
  }
}

/**
 * Accepts a workspace invitation.
 */
export async function acceptWorkspaceInvitationAction(
  _prevState: unknown,
  input: FormData | AcceptInvitationInput,
): Promise<WorkspaceActionResult<{ workspaceId: string; role: WorkspaceRole }>> {
  try {
    const rawData = input instanceof FormData ? extractFormData(input) : input;
    const parsed = acceptInvitationSchema.safeParse(rawData);

    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      const firstErrorMessage = Object.values(fieldErrors)[0]?.[0] || "Invalid invitation token";
      return { success: false, error: firstErrorMessage, fieldErrors };
    }

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user || !user.email) {
      return { success: false, error: "Authentication required to accept invitation" };
    }

    const result = await acceptWorkspaceInvitation(supabase, {
      token: parsed.data.token,
      acceptingUser: {
        id: user.id,
        email: user.email,
      },
    });

    return {
      success: true,
      message: "Successfully joined workspace",
      data: result,
    };
  } catch (err) {
    if (err instanceof WorkspaceError) {
      return { success: false, error: err.message };
    }
    const message = err instanceof Error ? err.message : "Failed to accept invitation";
    return { success: false, error: message };
  }
}

/**
 * Modifies an existing workspace member's role.
 */
export async function updateWorkspaceMemberRoleAction(
  _prevState: unknown,
  input: FormData | UpdateMemberRoleInput,
): Promise<WorkspaceActionResult<WorkspaceMemberRow>> {
  try {
    const rawData = input instanceof FormData ? extractFormData(input) : input;
    const parsed = updateMemberRoleSchema.safeParse(rawData);

    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      const firstErrorMessage =
        Object.values(fieldErrors)[0]?.[0] || "Invalid role update parameters";
      return { success: false, error: firstErrorMessage, fieldErrors };
    }

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Authentication required" };
    }

    const updated = await updateWorkspaceMemberRole(supabase, {
      workspaceId: parsed.data.workspaceId,
      actorUserId: user.id,
      targetUserId: parsed.data.targetUserId,
      newRole: parsed.data.newRole,
    });

    return {
      success: true,
      message: "Member role updated successfully",
      data: updated,
    };
  } catch (err) {
    if (err instanceof WorkspaceError) {
      return { success: false, error: err.message };
    }
    const message = err instanceof Error ? err.message : "Failed to update member role";
    return { success: false, error: message };
  }
}

/**
 * Removes or deactivates a workspace member.
 */
export async function removeWorkspaceMemberAction(
  _prevState: unknown,
  input: FormData | RemoveMemberInput,
): Promise<WorkspaceActionResult<{ success: boolean }>> {
  try {
    const rawData = input instanceof FormData ? extractFormData(input) : input;
    const parsed = removeMemberSchema.safeParse(rawData);

    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      const firstErrorMessage =
        Object.values(fieldErrors)[0]?.[0] || "Invalid member removal parameters";
      return { success: false, error: firstErrorMessage, fieldErrors };
    }

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Authentication required" };
    }

    const result = await removeWorkspaceMember(supabase, {
      workspaceId: parsed.data.workspaceId,
      actorUserId: user.id,
      targetUserId: parsed.data.targetUserId,
    });

    return {
      success: true,
      message: "Member removed from workspace",
      data: result,
    };
  } catch (err) {
    if (err instanceof WorkspaceError) {
      return { success: false, error: err.message };
    }
    const message = err instanceof Error ? err.message : "Failed to remove member";
    return { success: false, error: message };
  }
}
