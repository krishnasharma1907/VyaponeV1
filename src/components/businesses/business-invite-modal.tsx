"use client";

import React, { useState, useTransition } from "react";
import type { BusinessRole } from "@/lib/businesses/types";
import { Button, Card, CardHeader, CardTitle, CardContent, Field, Input } from "@/components/ui";
import { inviteBusinessMemberAction } from "@/lib/businesses/actions";

interface BusinessInviteModalProps {
  businessId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  callerRole?: BusinessRole;
  isSovereignOwner?: boolean;
}

export function BusinessInviteModal({
  businessId,
  isOpen,
  onClose,
  onSuccess,
  callerRole = "manager",
  isSovereignOwner = false,
}: BusinessInviteModalProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<BusinessRole>("staff");
  const [error, setError] = useState<string | null>(null);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!isOpen) return null;

  const isOwnerAuthority = isSovereignOwner || callerRole === "owner";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await inviteBusinessMemberAction({
        business_id: businessId,
        email,
        role,
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
    setRole("staff");
    setError(null);
    setGeneratedToken(null);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="business-invite-modal-title"
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
            <CardTitle id="business-invite-modal-title" as="h2">
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
                  Share this invitation token with the recipient to allow them to join via the
                  invitation link.
                </p>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <Button variant="primary" onClick={handleReset}>
                    Done
                  </Button>
                </div>
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

                <Field label="Recipient Email Address" required>
                  <Input
                    type="email"
                    required
                    placeholder="teammate@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isPending}
                  />
                </Field>

                <Field label="Operational Role" required>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as BusinessRole)}
                    disabled={isPending}
                    style={{
                      width: "100%",
                      padding: "var(--space-2) var(--space-3)",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--color-border-subtle)",
                      backgroundColor: "var(--color-surface-elevated)",
                      fontSize: "var(--font-size-body)",
                      color: "var(--color-text-primary)",
                    }}
                  >
                    {isOwnerAuthority && (
                      <option value="owner">Owner (Full sovereign control)</option>
                    )}
                    <option value="manager">Manager (Manage locations, staff, profile)</option>
                    <option value="cashier">Cashier (Point of sale, billing, orders)</option>
                    <option value="staff">Staff (Operational tasks, catalogue view)</option>
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
                  <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" disabled={isPending}>
                    {isPending ? "Generating..." : "Generate Invitation"}
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
