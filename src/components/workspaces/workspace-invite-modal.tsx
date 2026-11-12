"use client";

import React, { useState, useTransition } from "react";
import type { WorkspaceRole } from "@/lib/workspaces/types";
import { Button, Card, CardHeader, CardTitle, CardContent, Field, Input } from "@/components/ui";
import { inviteWorkspaceMemberAction } from "@/lib/workspaces/actions";

interface WorkspaceInviteModalProps {
  workspaceId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function WorkspaceInviteModal({
  workspaceId,
  isOpen,
  onClose,
  onSuccess,
}: WorkspaceInviteModalProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<WorkspaceRole>("workspace_member");
  const [error, setError] = useState<string | null>(null);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await inviteWorkspaceMemberAction(null, {
        workspaceId,
        email,
        role: role as "workspace_admin" | "workspace_member" | "reseller_admin" | "reseller_staff",
      });

      if (!result.success) {
        setError(result.error ?? "Failed to invite member");
      } else if (result.data) {
        setGeneratedToken(result.data.rawToken);
        onSuccess?.();
      }
    });
  };

  const handleReset = () => {
    setEmail("");
    setRole("workspace_member");
    setError(null);
    setGeneratedToken(null);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-modal-title"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        padding: "var(--space-4)",
      }}
    >
      <div style={{ width: "100%", maxWidth: "500px" }}>
        <Card variant="elevated">
          <CardHeader>
            <CardTitle id="invite-modal-title" as="h2">
              Invite Team Member
            </CardTitle>
          </CardHeader>
          <CardContent>
            {generatedToken ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                <p style={{ color: "var(--color-success-fg)", fontSize: "var(--font-size-body)" }}>
                  Invitation created successfully for <strong>{email}</strong>!
                </p>
                <div
                  style={{
                    padding: "var(--space-3)",
                    backgroundColor: "var(--color-surface-sunken)",
                    borderRadius: "var(--radius-sm)",
                    fontFamily: "var(--font-mono)",
                    wordBreak: "break-all",
                    fontSize: "var(--font-size-caption)",
                  }}
                >
                  Token: {generatedToken}
                </div>
                <p
                  style={{
                    fontSize: "var(--font-size-caption)",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  Share this token or link securely with the invitee. This token expires in 7 days.
                </p>
                <Button variant="primary" onClick={handleReset}>
                  Done
                </Button>
              </div>
            ) : (
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

                <Field id="invite-email" label="Email Address" required>
                  <Input
                    id="invite-email"
                    type="email"
                    required
                    placeholder="colleague@agency.in"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isPending}
                  />
                </Field>

                <Field id="invite-role" label="Assigned Role">
                  <select
                    id="invite-role"
                    value={role}
                    onChange={(e) => setRole(e.target.value as WorkspaceRole)}
                    disabled={isPending}
                    style={{
                      padding: "var(--space-2) var(--space-3)",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--color-border-subtle)",
                      backgroundColor: "var(--color-surface-elevated)",
                      color: "var(--color-text-primary)",
                      fontSize: "var(--font-size-body)",
                      width: "100%",
                    }}
                  >
                    <option value="workspace_member">workspace_member (Team Staff)</option>
                    <option value="workspace_admin">workspace_admin (Administrator)</option>
                  </select>
                </Field>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: "var(--space-2)",
                    marginTop: "var(--space-2)",
                  }}
                >
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleReset}
                    disabled={isPending}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" disabled={isPending}>
                    {isPending ? "Generating Invitation..." : "Send Invitation"}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
