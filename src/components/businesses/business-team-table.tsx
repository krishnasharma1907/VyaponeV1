"use client";

import React, { useState, useTransition } from "react";
import type {
  BusinessInvitationWithInviter,
  BusinessMemberWithProfile,
  BusinessRole,
} from "@/lib/businesses/types";
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
import { canManageBusinessRole, hasBusinessPermission } from "@/lib/businesses/permissions";
import {
  updateBusinessMemberRoleAction,
  removeBusinessMemberAction,
  revokeBusinessInvitationAction,
} from "@/lib/businesses/actions";

interface BusinessTeamTableProps {
  businessId: string;
  members: BusinessMemberWithProfile[];
  invitations?: BusinessInvitationWithInviter[];
  currentUserRole?: BusinessRole;
  isSovereignOwner?: boolean;
  currentUserId: string;
  onRefresh?: () => void;
}

export function BusinessTeamTable({
  businessId,
  members,
  invitations = [],
  currentUserRole = "staff",
  isSovereignOwner = false,
  currentUserId,
  onRefresh,
}: BusinessTeamTableProps) {
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const effectiveRole: BusinessRole = isSovereignOwner ? "owner" : currentUserRole;
  const canManageMembers = hasBusinessPermission(effectiveRole, "business:manage_members");

  const pendingInvitations = invitations.filter((inv) => inv.status === "pending");

  const getRoleBadgeVariant = (role: BusinessRole) => {
    if (role === "owner") return "success";
    if (role === "manager") return "info";
    if (role === "cashier") return "warning";
    return "default";
  };

  const handleRoleChange = (targetUserId: string, newRole: BusinessRole) => {
    setError(null);
    setSuccessMessage(null);

    startTransition(async () => {
      const result = await updateBusinessMemberRoleAction(businessId, targetUserId, {
        role: newRole,
      });

      if (!result.success) {
        setError(result.error ?? "Failed to update member role");
      } else {
        setSuccessMessage("Member role updated successfully");
        onRefresh?.();
      }
    });
  };

  const handleRemoveMember = (targetUserId: string, targetRole: BusinessRole) => {
    if (targetRole === "owner") {
      const activeOwners = members.filter((m) => m.role === "owner" && m.status === "active");
      if (activeOwners.length <= 1) {
        setError("Cannot remove the sole owner of the business.");
        return;
      }
    }

    if (!window.confirm("Are you sure you want to remove this member from the business?")) {
      return;
    }

    setError(null);
    setSuccessMessage(null);

    startTransition(async () => {
      const result = await removeBusinessMemberAction(businessId, targetUserId);

      if (!result.success) {
        setError(result.error ?? "Failed to remove member");
      } else {
        setSuccessMessage("Member removed successfully");
        onRefresh?.();
      }
    });
  };

  const handleRevokeInvitation = (invitationId: string) => {
    if (!window.confirm("Are you sure you want to revoke this invitation?")) {
      return;
    }

    setError(null);
    setSuccessMessage(null);

    startTransition(async () => {
      const result = await revokeBusinessInvitationAction({
        business_id: businessId,
        invitationId,
      });

      if (!result.success) {
        setError(result.error ?? "Failed to revoke invitation");
      } else {
        setSuccessMessage("Invitation revoked successfully");
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
            const canManageTarget =
              canManageMembers &&
              canManageBusinessRole(effectiveRole, member.role) &&
              !isCurrentUser;

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
                    style={{
                      display: "inline-flex",
                      gap: "var(--space-2)",
                      alignItems: "center",
                      justifyContent: "flex-end",
                    }}
                  >
                    {canManageTarget && (
                      <select
                        aria-label={`Change role for ${member.user.display_name}`}
                        disabled={isPending}
                        value={member.role}
                        onChange={(e) =>
                          handleRoleChange(member.user_id, e.target.value as BusinessRole)
                        }
                        style={{
                          padding: "var(--space-1) var(--space-2)",
                          fontSize: "var(--font-size-caption)",
                          borderRadius: "var(--radius-sm)",
                          border: "1px solid var(--color-border-subtle)",
                          backgroundColor: "var(--color-surface-elevated)",
                        }}
                      >
                        {effectiveRole === "owner" && <option value="manager">manager</option>}
                        <option value="cashier">cashier</option>
                        <option value="staff">staff</option>
                      </select>
                    )}

                    {(canManageTarget || isCurrentUser) && (
                      <Button
                        size="sm"
                        variant={isCurrentUser ? "outline" : "destructive"}
                        disabled={isPending}
                        onClick={() => handleRemoveMember(member.user_id, member.role)}
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

      {canManageMembers && pendingInvitations.length > 0 && (
        <div
          style={{
            marginTop: "var(--space-6)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-3)",
          }}
        >
          <h3
            style={{
              fontSize: "var(--font-size-h3)",
              color: "var(--color-text-primary)",
              margin: 0,
            }}
          >
            Pending Invitations ({pendingInvitations.length})
          </h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Recipient Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead style={{ textAlign: "right" }}>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingInvitations.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell style={{ fontWeight: 500 }}>{inv.email}</TableCell>
                  <TableCell>
                    <Badge variant={getRoleBadgeVariant(inv.role)}>{inv.role}</Badge>
                  </TableCell>
                  <TableCell
                    style={{
                      fontSize: "var(--font-size-caption)",
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    {new Date(inv.expires_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell style={{ textAlign: "right" }}>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={isPending}
                      onClick={() => handleRevokeInvitation(inv.id)}
                    >
                      Revoke
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
