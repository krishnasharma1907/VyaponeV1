"use client";

import React, { useState, useTransition } from "react";
import type { WorkspaceMemberWithProfile, WorkspaceRole } from "@/lib/workspaces/types";
import {
  Badge,
  Button,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui";
import {
  canManageTargetRole,
  hasWorkspacePermission,
  normalizeWorkspaceRole,
} from "@/lib/workspaces/permissions";
import {
  updateWorkspaceMemberRoleAction,
  removeWorkspaceMemberAction,
} from "@/lib/workspaces/actions";

interface WorkspaceTeamTableProps {
  workspaceId: string;
  members: WorkspaceMemberWithProfile[];
  currentUserRole: WorkspaceRole;
  currentUserId: string;
  onRefresh?: () => void;
}

export function WorkspaceTeamTable({
  workspaceId,
  members,
  currentUserRole,
  currentUserId,
  onRefresh,
}: WorkspaceTeamTableProps) {
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canChangeRoles = hasWorkspacePermission(currentUserRole, "workspace:change_role");
  const canRemove = hasWorkspacePermission(currentUserRole, "workspace:remove_member");

  const getRoleBadgeVariant = (role: WorkspaceRole) => {
    const normalized = normalizeWorkspaceRole(role);
    if (normalized === "workspace_owner") return "success";
    if (normalized === "workspace_admin") return "info";
    return "default";
  };

  const handleRoleChange = (targetUserId: string, newRole: WorkspaceRole) => {
    setError(null);
    setSuccessMessage(null);

    startTransition(async () => {
      const result = await updateWorkspaceMemberRoleAction(null, {
        workspaceId,
        targetUserId,
        newRole: newRole as
          "workspace_admin" | "workspace_member" | "reseller_admin" | "reseller_staff",
      });

      if (!result.success) {
        setError(result.error ?? "Failed to update role");
      } else {
        setSuccessMessage("Member role updated successfully");
        onRefresh?.();
      }
    });
  };

  const handleRemoveMember = (targetUserId: string) => {
    if (!window.confirm("Are you sure you want to remove this member from the workspace?")) {
      return;
    }

    setError(null);
    setSuccessMessage(null);

    startTransition(async () => {
      const result = await removeWorkspaceMemberAction(null, {
        workspaceId,
        targetUserId,
      });

      if (!result.success) {
        setError(result.error ?? "Failed to remove member");
      } else {
        setSuccessMessage("Member removed successfully");
        onRefresh?.();
      }
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      {error && (
        <div
          role="alert"
          style={{
            padding: "var(--space-3)",
            backgroundColor: "var(--color-danger-subtle)",
            color: "var(--color-danger-fg)",
            borderRadius: "var(--radius-sm)",
            fontSize: "var(--font-size-body)",
          }}
        >
          {error}
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          style={{
            padding: "var(--space-3)",
            backgroundColor: "var(--color-success-subtle)",
            color: "var(--color-success-fg)",
            borderRadius: "var(--radius-sm)",
            fontSize: "var(--font-size-body)",
          }}
        >
          {successMessage}
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Member</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead style={{ textAlign: "right" }}>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((member) => {
            const isCurrentUser = member.user_id === currentUserId;
            const canManage = canManageTargetRole(currentUserRole, member.role) && !isCurrentUser;

            return (
              <TableRow key={member.id}>
                <TableCell style={{ fontWeight: 600 }}>
                  {member.user.display_name}
                  {isCurrentUser && (
                    <span
                      style={{
                        marginLeft: "var(--space-2)",
                        fontSize: "var(--font-size-caption)",
                        color: "var(--color-text-secondary)",
                      }}
                    >
                      (You)
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <span
                    style={{
                      fontSize: "var(--font-size-body)",
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    {member.user.email || member.user.phone_number || "—"}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant={getRoleBadgeVariant(member.role)}>{member.role}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={member.status === "active" ? "success" : "warning"}>
                    {member.status}
                  </Badge>
                </TableCell>
                <TableCell style={{ textAlign: "right" }}>
                  <div
                    style={{ display: "inline-flex", gap: "var(--space-2)", alignItems: "center" }}
                  >
                    {canChangeRoles && canManage && (
                      <select
                        aria-label={`Change role for ${member.user.display_name}`}
                        disabled={isPending}
                        value={member.role}
                        onChange={(e) =>
                          handleRoleChange(member.user_id, e.target.value as WorkspaceRole)
                        }
                        style={{
                          padding: "var(--space-1) var(--space-2)",
                          fontSize: "var(--font-size-caption)",
                          borderRadius: "var(--radius-sm)",
                          border: "1px solid var(--color-border-subtle)",
                          backgroundColor: "var(--color-surface-elevated)",
                        }}
                      >
                        <option value="workspace_admin">workspace_admin</option>
                        <option value="workspace_member">workspace_member</option>
                      </select>
                    )}

                    {(canRemove || isCurrentUser) && (
                      <Button
                        size="sm"
                        variant={isCurrentUser ? "outline" : "destructive"}
                        disabled={isPending}
                        onClick={() => handleRemoveMember(member.user_id)}
                      >
                        {isCurrentUser ? "Leave" : "Remove"}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
