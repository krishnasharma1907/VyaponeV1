"use client";

import React, { useEffect, useState } from "react";
import { WorkspaceTeamView } from "@/components/workspaces";
import {
  getUserWorkspacesAction,
  getWorkspaceMembersAction,
  listWorkspaceInvitationsAction,
} from "@/lib/workspaces/actions";
import type {
  WorkspaceMemberWithProfile,
  WorkspaceInvitationWithInviter,
  WorkspaceRole,
} from "@/lib/workspaces/types";

export default function ResellerTeamPage() {
  const [workspaceId, setWorkspaceId] = useState<string>("");
  const [currentUserRole, setCurrentUserRole] = useState<WorkspaceRole>("workspace_owner");
  const [members, setMembers] = useState<WorkspaceMemberWithProfile[]>([]);
  const [invitations, setInvitations] = useState<WorkspaceInvitationWithInviter[]>([]);

  useEffect(() => {
    async function loadWorkspaceData() {
      const wsRes = await getUserWorkspacesAction();
      if (wsRes.success && wsRes.data && wsRes.data.length > 0) {
        const primary = wsRes.data[0];
        const wsId = primary.workspace.id;
        setWorkspaceId(wsId);
        setCurrentUserRole(primary.currentUserRole);

        const [membersRes, invRes] = await Promise.all([
          getWorkspaceMembersAction(wsId),
          listWorkspaceInvitationsAction(wsId),
        ]);

        if (membersRes.success && membersRes.data) {
          setMembers(membersRes.data);
        }
        if (invRes.success && invRes.data) {
          setInvitations(invRes.data);
        }
      }
    }

    loadWorkspaceData();
  }, []);

  return (
    <WorkspaceTeamView
      workspaceId={workspaceId}
      members={members}
      invitations={invitations}
      currentUserRole={currentUserRole}
    />
  );
}
