"use client";

import React, { useState, useTransition } from "react";
import type { WorkspaceRole, WorkspaceRow } from "@/lib/workspaces/types";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Field,
  Input,
} from "@/components/ui";
import { hasWorkspacePermission } from "@/lib/workspaces/permissions";
import { updateWorkspaceProfileAction } from "@/lib/workspaces/actions";

interface WorkspaceSettingsFormProps {
  workspace: WorkspaceRow;
  currentUserRole: WorkspaceRole;
}

export function WorkspaceSettingsForm({ workspace, currentUserRole }: WorkspaceSettingsFormProps) {
  const [name, setName] = useState(workspace.name);
  const [slug, setSlug] = useState(workspace.slug);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canEdit = hasWorkspacePermission(currentUserRole, "workspace:update_profile");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const result = await updateWorkspaceProfileAction(null, {
        workspaceId: workspace.id,
        name,
        slug,
      });

      if (!result.success) {
        setError(result.error ?? "Failed to update workspace profile");
      } else {
        setSuccess("Workspace settings updated successfully");
      }
    });
  };

  return (
    <Card variant="default">
      <CardHeader>
        <CardTitle as="h2">Workspace Profile</CardTitle>
        <CardDescription>General agency settings and public identifier.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}
        >
          {error && (
            <div
              role="alert"
              style={{
                padding: "var(--space-2) var(--space-3)",
                backgroundColor: "var(--color-danger-subtle)",
                color: "var(--color-danger-fg)",
                borderRadius: "var(--radius-sm)",
                fontSize: "var(--font-size-body)",
              }}
            >
              {error}
            </div>
          )}

          {success && (
            <div
              role="status"
              style={{
                padding: "var(--space-2) var(--space-3)",
                backgroundColor: "var(--color-success-subtle)",
                color: "var(--color-success-fg)",
                borderRadius: "var(--radius-sm)",
                fontSize: "var(--font-size-body)",
              }}
            >
              {success}
            </div>
          )}

          <Field id="ws-name" label="Workspace Name" required>
            <Input
              id="ws-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canEdit || isPending}
            />
          </Field>

          <Field
            id="ws-slug"
            label="Workspace Slug"
            helperText="Lowercase alphanumeric URL identifier"
            required
          >
            <Input
              id="ws-slug"
              type="text"
              required
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              disabled={!canEdit || isPending}
            />
          </Field>

          <div>
            <Button type="submit" variant="primary" disabled={!canEdit || isPending}>
              {isPending ? "Saving Changes..." : "Save Settings"}
            </Button>
            {!canEdit && (
              <p
                style={{
                  marginTop: "var(--space-2)",
                  fontSize: "var(--font-size-caption)",
                  color: "var(--color-text-secondary)",
                }}
              >
                Only workspace owners can update workspace profile settings.
              </p>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
