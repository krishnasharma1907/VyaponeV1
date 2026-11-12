"use client";

import React, { useState, useTransition } from "react";
import type { WorkspaceRole, WorkspaceSummary } from "@/lib/workspaces/types";
import { Badge } from "@/components/ui";

interface WorkspaceSwitcherProps {
  workspaces: WorkspaceSummary[];
  activeWorkspaceId?: string;
  onSelectWorkspace?: (workspaceId: string) => void;
}

export function WorkspaceSwitcher({
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
}: WorkspaceSwitcherProps) {
  const [selectedId, setSelectedId] = useState<string | undefined>(
    activeWorkspaceId ?? workspaces[0]?.workspace.id,
  );
  const [isPending, startTransition] = useTransition();

  const handleSelect = (wsId: string) => {
    setSelectedId(wsId);
    startTransition(() => {
      onSelectWorkspace?.(wsId);
    });
  };

  const getRoleBadgeVariant = (role: WorkspaceRole) => {
    if (role === "workspace_owner") return "success";
    if (role === "workspace_admin" || role === "reseller_admin") return "info";
    return "default";
  };

  if (workspaces.length === 0) {
    return (
      <div style={{ padding: "var(--space-2)" }}>
        <p style={{ fontSize: "var(--font-size-caption)", color: "var(--color-text-secondary)" }}>
          No active workspaces
        </p>
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label="Workspace Switcher"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
        padding: "var(--space-2)",
        backgroundColor: "var(--color-surface-sunken)",
        borderRadius: "var(--radius-md)",
      }}
    >
      <label
        htmlFor="workspace-select"
        style={{
          fontSize: "var(--font-size-caption)",
          fontWeight: 600,
          color: "var(--color-text-secondary)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        Active Workspace
      </label>
      <div
        style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}
      >
        <select
          id="workspace-select"
          value={selectedId}
          disabled={isPending}
          onChange={(e) => handleSelect(e.target.value)}
          style={{
            padding: "var(--space-2) var(--space-3)",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--color-border-subtle)",
            backgroundColor: "var(--color-surface-elevated)",
            color: "var(--color-text-primary)",
            fontSize: "var(--font-size-body)",
            minWidth: "200px",
          }}
        >
          {workspaces.map((ws) => (
            <option key={ws.workspace.id} value={ws.workspace.id}>
              {ws.workspace.name} ({ws.currentUserRole})
            </option>
          ))}
        </select>
        {selectedId && (
          <Badge
            variant={getRoleBadgeVariant(
              workspaces.find((w) => w.workspace.id === selectedId)?.currentUserRole ??
                "workspace_member",
            )}
          >
            {workspaces.find((w) => w.workspace.id === selectedId)?.currentUserRole}
          </Badge>
        )}
      </div>
    </div>
  );
}
