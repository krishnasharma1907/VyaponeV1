import { describe, expect, it, vi } from "vitest";

// Mock server-only to allow Server Action imports within Client Components in Vitest JSDOM
vi.mock("server-only", () => ({}));

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { WorkspaceSwitcher } from "@/components/workspaces/workspace-switcher";
import { WorkspaceTeamTable } from "@/components/workspaces/workspace-team-table";
import { WorkspaceSettingsForm } from "@/components/workspaces/workspace-settings-form";
import { WorkspaceInviteModal } from "@/components/workspaces/workspace-invite-modal";
import type {
  WorkspaceMemberWithProfile,
  WorkspaceRow,
  WorkspaceSummary,
} from "@/lib/workspaces/types";
import * as workspaceActions from "@/lib/workspaces/actions";

describe("Workspace UI Components [VO-022]", () => {
  describe("WorkspaceSwitcher", () => {
    const mockWorkspaces: WorkspaceSummary[] = [
      {
        workspace: {
          id: "ws_01",
          name: "Apex Agency",
          slug: "apex-agency",
          owner_user_id: "usr_01",
          plan: "agency",
          status: "active",
          created_at: "2026-11-12T00:00:00Z",
          updated_at: "2026-11-12T00:00:00Z",
        },
        memberCount: 5,
        currentUserRole: "workspace_owner",
      },
      {
        workspace: {
          id: "ws_02",
          name: "Second Agency",
          slug: "second-agency",
          owner_user_id: "usr_02",
          plan: "starter",
          status: "active",
          created_at: "2026-11-12T00:00:00Z",
          updated_at: "2026-11-12T00:00:00Z",
        },
        memberCount: 2,
        currentUserRole: "workspace_member",
      },
    ];

    it("renders empty state when workspaces array is empty", () => {
      render(<WorkspaceSwitcher workspaces={[]} />);
      expect(screen.getByText("No active workspaces")).toBeTruthy();
    });

    it("renders workspace selector and handles switching", () => {
      const onSelect = vi.fn();
      render(
        <WorkspaceSwitcher
          workspaces={mockWorkspaces}
          activeWorkspaceId="ws_01"
          onSelectWorkspace={onSelect}
        />,
      );

      const select = screen.getByRole("combobox", { name: "Active Workspace" });
      expect(select).toBeTruthy();
      expect(screen.getByText("Apex Agency (workspace_owner)")).toBeTruthy();

      fireEvent.change(select, { target: { value: "ws_02" } });
      expect(onSelect).toHaveBeenCalledWith("ws_02");
    });
  });

  describe("WorkspaceTeamTable", () => {
    const mockMembers: WorkspaceMemberWithProfile[] = [
      {
        id: "mem_01",
        workspace_id: "ws_01",
        user_id: "usr_owner",
        role: "workspace_owner",
        status: "active",
        created_at: "2026-11-12T00:00:00Z",
        user: {
          id: "usr_owner",
          display_name: "Ramesh Sharma",
          email: "ramesh@apex.in",
          phone_number: "+919876543210",
        },
      },
      {
        id: "mem_02",
        workspace_id: "ws_01",
        user_id: "usr_staff",
        role: "workspace_member",
        status: "active",
        created_at: "2026-11-12T00:00:00Z",
        user: {
          id: "usr_staff",
          display_name: "Priya Patel",
          email: "priya@apex.in",
          phone_number: null,
        },
      },
    ];

    it("renders team directory with members, contact details, and role badges", () => {
      render(
        <WorkspaceTeamTable
          workspaceId="ws_01"
          members={mockMembers}
          currentUserRole="workspace_owner"
          currentUserId="usr_owner"
        />,
      );

      expect(screen.getByText("Ramesh Sharma")).toBeTruthy();
      expect(screen.getByText("Priya Patel")).toBeTruthy();
      expect(screen.getByText("ramesh@apex.in")).toBeTruthy();
      expect(screen.getByText("priya@apex.in")).toBeTruthy();
      expect(screen.getByText("(You)")).toBeTruthy();
    });

    it("triggers role update action when changing dropdown value", async () => {
      const updateSpy = vi
        .spyOn(workspaceActions, "updateWorkspaceMemberRoleAction")
        .mockResolvedValue({ success: true });
      const onRefresh = vi.fn();

      render(
        <WorkspaceTeamTable
          workspaceId="ws_01"
          members={mockMembers}
          currentUserRole="workspace_owner"
          currentUserId="usr_owner"
          onRefresh={onRefresh}
        />,
      );

      const select = screen.getByRole("combobox", {
        name: "Change role for Priya Patel",
      });
      fireEvent.change(select, { target: { value: "workspace_admin" } });

      await waitFor(() => {
        expect(updateSpy).toHaveBeenCalledWith(null, {
          workspaceId: "ws_01",
          targetUserId: "usr_staff",
          newRole: "workspace_admin",
        });
      });
    });

    it("triggers remove action when confirmed", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(true);
      const removeSpy = vi
        .spyOn(workspaceActions, "removeWorkspaceMemberAction")
        .mockResolvedValue({ success: true, data: { success: true } });
      const onRefresh = vi.fn();

      render(
        <WorkspaceTeamTable
          workspaceId="ws_01"
          members={mockMembers}
          currentUserRole="workspace_owner"
          currentUserId="usr_owner"
          onRefresh={onRefresh}
        />,
      );

      const removeBtn = screen.getByRole("button", { name: "Remove" });
      fireEvent.click(removeBtn);

      await waitFor(() => {
        expect(removeSpy).toHaveBeenCalledWith(null, {
          workspaceId: "ws_01",
          targetUserId: "usr_staff",
        });
      });
    });
  });

  describe("WorkspaceSettingsForm", () => {
    const mockWorkspace: WorkspaceRow = {
      id: "ws_01",
      name: "Apex Agency",
      slug: "apex-agency",
      owner_user_id: "usr_owner",
      plan: "agency",
      status: "active",
      created_at: "2026-11-12T00:00:00Z",
      updated_at: "2026-11-12T00:00:00Z",
    };

    it("renders workspace settings form and allows editing for workspace_owner", () => {
      render(<WorkspaceSettingsForm workspace={mockWorkspace} currentUserRole="workspace_owner" />);

      const nameInput = screen.getByLabelText(/Workspace Name/) as HTMLInputElement;
      const slugInput = screen.getByLabelText(/Workspace Slug/) as HTMLInputElement;
      const submitButton = screen.getByRole("button", {
        name: "Save Settings",
      }) as HTMLButtonElement;

      expect(nameInput.value).toBe("Apex Agency");
      expect(slugInput.value).toBe("apex-agency");
      expect(submitButton.disabled).toBe(false);
    });

    it("disables form editing when user does not have update permissions", () => {
      render(
        <WorkspaceSettingsForm workspace={mockWorkspace} currentUserRole="workspace_member" />,
      );

      const submitButton = screen.getByRole("button", {
        name: "Save Settings",
      }) as HTMLButtonElement;
      expect(submitButton.disabled).toBe(true);
      expect(
        screen.getByText("Only workspace owners can update workspace profile settings."),
      ).toBeTruthy();
    });

    it("submits updated profile settings successfully", async () => {
      const updateSpy = vi
        .spyOn(workspaceActions, "updateWorkspaceProfileAction")
        .mockResolvedValue({ success: true, data: { ...mockWorkspace, name: "Apex Renamed" } });

      render(<WorkspaceSettingsForm workspace={mockWorkspace} currentUserRole="workspace_owner" />);

      const nameInput = screen.getByLabelText(/Workspace Name/) as HTMLInputElement;
      fireEvent.change(nameInput, { target: { value: "Apex Renamed" } });

      const submitButton = screen.getByRole("button", { name: "Save Settings" });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(updateSpy).toHaveBeenCalledWith(null, {
          workspaceId: "ws_01",
          name: "Apex Renamed",
          slug: "apex-agency",
        });
      });
    });
  });

  describe("WorkspaceInviteModal", () => {
    it("renders nothing when isOpen is false", () => {
      const { container } = render(
        <WorkspaceInviteModal workspaceId="ws_01" isOpen={false} onClose={vi.fn()} />,
      );
      expect(container.firstChild).toBeNull();
    });

    it("renders invite modal and generates invitation token on submission", async () => {
      const inviteSpy = vi
        .spyOn(workspaceActions, "inviteWorkspaceMemberAction")
        .mockResolvedValue({
          success: true,
          data: {
            invitationId: "inv_abc",
            rawToken: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
          },
        });

      const onClose = vi.fn();
      const onSuccess = vi.fn();

      render(
        <WorkspaceInviteModal
          workspaceId="ws_01"
          isOpen={true}
          onClose={onClose}
          onSuccess={onSuccess}
        />,
      );

      expect(screen.getByRole("heading", { name: "Invite Team Member" })).toBeTruthy();

      const emailInput = screen.getByLabelText(/Email Address/) as HTMLInputElement;
      fireEvent.change(emailInput, { target: { value: "newinvitee@apex.in" } });

      const submitBtn = screen.getByRole("button", { name: "Send Invitation" });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(inviteSpy).toHaveBeenCalledWith(null, {
          workspaceId: "ws_01",
          email: "newinvitee@apex.in",
          role: "workspace_member",
        });
      });

      await waitFor(() => {
        expect(
          screen.getByText(
            /Token: abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890/,
          ),
        ).toBeTruthy();
      });

      const doneBtn = screen.getByRole("button", { name: "Done" });
      fireEvent.click(doneBtn);
      expect(onClose).toHaveBeenCalled();
    });
  });
});
