import { z } from "zod";

export const workspaceRoleSchema = z.enum([
  "workspace_owner",
  "workspace_admin",
  "workspace_member",
  "reseller_admin",
  "reseller_staff",
]);

export const assignableWorkspaceRoleSchema = z.enum([
  "workspace_admin",
  "workspace_member",
  "reseller_admin",
  "reseller_staff",
]);

export const createWorkspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Workspace name must be at least 2 characters")
    .max(100, "Workspace name must be under 100 characters"),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with hyphens")
    .min(2, "Slug must be at least 2 characters")
    .max(50, "Slug must be under 50 characters")
    .optional(),
  plan: z.enum(["starter", "pro", "agency"]).default("starter"),
});

export const updateWorkspaceProfileSchema = z.object({
  workspaceId: z.string().uuid("Invalid workspace ID"),
  name: z
    .string()
    .trim()
    .min(2, "Workspace name must be at least 2 characters")
    .max(100, "Workspace name must be under 100 characters")
    .optional(),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with hyphens")
    .min(2, "Slug must be at least 2 characters")
    .max(50, "Slug must be under 50 characters")
    .optional(),
});

export const inviteWorkspaceMemberSchema = z.object({
  workspaceId: z.string().uuid("Invalid workspace ID"),
  email: z.string().trim().toLowerCase().email("Invalid email address"),
  role: assignableWorkspaceRoleSchema.default("workspace_member"),
});

export const acceptInvitationSchema = z.object({
  token: z.string().trim().min(16, "Invalid invitation token").max(128, "Invalid invitation token"),
});

export const updateMemberRoleSchema = z.object({
  workspaceId: z.string().uuid("Invalid workspace ID"),
  targetUserId: z.string().uuid("Invalid member user ID"),
  newRole: assignableWorkspaceRoleSchema,
});

export const removeMemberSchema = z.object({
  workspaceId: z.string().uuid("Invalid workspace ID"),
  targetUserId: z.string().uuid("Invalid member user ID"),
});

export const switchWorkspaceSchema = z.object({
  workspaceId: z.string().uuid("Invalid workspace ID"),
});

export type CreateWorkspaceInput = z.input<typeof createWorkspaceSchema>;
export type UpdateWorkspaceProfileInput = z.input<typeof updateWorkspaceProfileSchema>;
export type InviteWorkspaceMemberInput = z.input<typeof inviteWorkspaceMemberSchema>;
export type AcceptInvitationInput = z.input<typeof acceptInvitationSchema>;
export type UpdateMemberRoleInput = z.input<typeof updateMemberRoleSchema>;
export type RemoveMemberInput = z.input<typeof removeMemberSchema>;
export type SwitchWorkspaceInput = z.input<typeof switchWorkspaceSchema>;
