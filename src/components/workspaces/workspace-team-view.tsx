"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, Badge } from "@/components/ui";
import { WorkspaceTeamTable } from "./workspace-team-table";
import { WorkspaceInviteModal } from "./workspace-invite-modal";
import type {
  WorkspaceMemberWithProfile,
  WorkspaceInvitationWithInviter,
  WorkspaceRole,
} from "@/lib/workspaces/types";
import { hasWorkspacePermission } from "@/lib/workspaces/permissions";

export interface WorkspaceTeamViewProps {
  workspaceId?: string;
  members?: WorkspaceMemberWithProfile[];
  invitations?: WorkspaceInvitationWithInviter[];
  currentUserRole?: WorkspaceRole;
  currentUserId?: string;
  capacity?: {
    usedSeats: number;
    totalSeats: number;
  };
}

export function WorkspaceTeamView({
  workspaceId = "",
  members = [],
  invitations = [],
  currentUserRole = "workspace_owner",
  currentUserId = "",
  capacity,
}: WorkspaceTeamViewProps) {
  const router = useRouter();
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const canInvite = hasWorkspacePermission(currentUserRole, "workspace:invite_member");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "var(--space-4)",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <h1
              style={{
                fontSize: "var(--font-size-h1)",
                color: "var(--color-text-primary)",
                margin: 0,
              }}
            >
              Agency Team Members
            </h1>
            {capacity && (
              <Badge variant="default">
                Seats: {capacity.usedSeats} / {capacity.totalSeats}
              </Badge>
            )}
          </div>
          <p
            style={{
              color: "var(--color-text-secondary)",
              fontSize: "var(--font-size-body)",
              marginTop: "var(--space-1)",
              marginBottom: 0,
            }}
          >
            Invite teammates, editors, and managers with role-based access.
          </p>
        </div>
        {canInvite && (
          <Button variant="primary" onClick={() => setIsInviteOpen(true)}>
            Invite Team Member
          </Button>
        )}
      </header>

      <Card variant="default">
        <CardContent style={{ padding: "var(--space-6)" }}>
          <WorkspaceTeamTable
            workspaceId={workspaceId}
            members={members}
            invitations={invitations}
            currentUserRole={currentUserRole}
            currentUserId={currentUserId}
            onRefresh={() => router.refresh()}
          />
        </CardContent>
      </Card>

      <WorkspaceInviteModal
        workspaceId={workspaceId}
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        onSuccess={() => {
          router.refresh();
        }}
      />
    </div>
  );
}
