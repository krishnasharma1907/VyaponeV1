"use client";

import React, { useState, useTransition } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Field,
  Input,
  Badge,
} from "@/components/ui";
import { acceptWorkspaceInvitationAction } from "@/lib/workspaces/actions";
import { acceptBusinessInvitationAction } from "@/lib/businesses/actions";

export function AcceptInvitationCard() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialToken = searchParams.get("token") ?? "";
  const initialType = (searchParams.get("type") as "workspace" | "business") ?? "workspace";

  const [token, setToken] = useState(initialToken);
  const [invitationType, setInvitationType] = useState<"workspace" | "business">(initialType);
  const [error, setError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{
    type: "workspace" | "business";
    id: string;
    role: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleAccept = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessInfo(null);

    const cleanToken = token.trim();
    if (!cleanToken) {
      setError("Please enter or paste a valid invitation token.");
      return;
    }

    startTransition(async () => {
      if (invitationType === "workspace") {
        const result = await acceptWorkspaceInvitationAction(null, { token: cleanToken });

        if (result.success && result.data) {
          setSuccessInfo({
            type: "workspace",
            id: result.data.workspaceId,
            role: result.data.role,
          });
        } else {
          // If workspace attempt failed with invalid token, attempt business invitation fallback
          const bResult = await acceptBusinessInvitationAction({ token: cleanToken });
          if (bResult.success) {
            setSuccessInfo({
              type: "business",
              id: bResult.data.businessId,
              role: bResult.data.role,
            });
          } else {
            const err =
              (!result.success ? result.error : undefined) ??
              (!bResult.success ? bResult.error : undefined);
            setError(err ?? "Failed to accept invitation");
          }
        }
      } else {
        const result = await acceptBusinessInvitationAction({ token: cleanToken });

        if (result.success) {
          setSuccessInfo({
            type: "business",
            id: result.data.businessId,
            role: result.data.role,
          });
        } else {
          // Fallback check for workspace
          const wResult = await acceptWorkspaceInvitationAction(null, { token: cleanToken });
          if (wResult.success && wResult.data) {
            setSuccessInfo({
              type: "workspace",
              id: wResult.data.workspaceId,
              role: wResult.data.role,
            });
          } else {
            const err =
              (!result.success ? result.error : undefined) ??
              (!wResult.success ? wResult.error : undefined);
            setError(err ?? "Failed to accept invitation");
          }
        }
      }
    });
  };

  return (
    <Card variant="elevated" style={{ width: "100%", maxWidth: "480px" }}>
      <CardHeader>
        <CardTitle as="h1" style={{ fontSize: "var(--font-size-h2)", margin: 0 }}>
          Accept Invitation
        </CardTitle>
        <p
          style={{
            color: "var(--color-text-secondary)",
            fontSize: "var(--font-size-body)",
            marginTop: "var(--space-1)",
            marginBottom: 0,
          }}
        >
          Join a reseller agency workspace or a local business storefront on VyapOne.
        </p>
      </CardHeader>
      <CardContent>
        {successInfo ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <div
              style={{
                padding: "var(--space-4)",
                backgroundColor: "var(--color-success-subtle)",
                borderRadius: "var(--radius-md)",
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-2)",
              }}
            >
              <h2
                style={{
                  color: "var(--color-success-fg)",
                  fontSize: "var(--font-size-h3)",
                  margin: 0,
                }}
              >
                Welcome to the team!
              </h2>
              <p style={{ margin: 0, fontSize: "var(--font-size-body)" }}>
                You have joined as <Badge variant="success">{successInfo.role}</Badge>
              </p>
            </div>

            <div
              style={{ display: "flex", justifyContent: "flex-end", marginTop: "var(--space-2)" }}
            >
              <Button
                variant="primary"
                onClick={() => {
                  if (successInfo.type === "workspace") {
                    router.push("/workspace/team");
                  } else {
                    router.push("/dashboard");
                  }
                }}
              >
                Go to Dashboard
              </Button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleAccept}
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

            <Field label="Invitation Token" required>
              <Input
                type="text"
                required
                placeholder="Paste your 64-character invitation token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                disabled={isPending}
                style={{ fontFamily: "var(--font-mono)" }}
              />
            </Field>

            <Field label="Invitation Type">
              <div style={{ display: "flex", gap: "var(--space-4)", marginTop: "var(--space-1)" }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-2)",
                    cursor: "pointer",
                    fontSize: "var(--font-size-body)",
                  }}
                >
                  <input
                    type="radio"
                    name="invitationType"
                    value="workspace"
                    checked={invitationType === "workspace"}
                    onChange={() => setInvitationType("workspace")}
                    disabled={isPending}
                  />
                  Agency Workspace
                </label>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-2)",
                    cursor: "pointer",
                    fontSize: "var(--font-size-body)",
                  }}
                >
                  <input
                    type="radio"
                    name="invitationType"
                    value="business"
                    checked={invitationType === "business"}
                    onChange={() => setInvitationType("business")}
                    disabled={isPending}
                  />
                  Business Store
                </label>
              </div>
            </Field>

            <Button type="submit" variant="primary" disabled={isPending} style={{ width: "100%" }}>
              {isPending ? "Validating & Joining..." : "Accept & Join"}
            </Button>

            <div
              style={{
                textAlign: "center",
                marginTop: "var(--space-2)",
                fontSize: "var(--font-size-caption)",
                color: "var(--color-text-secondary)",
              }}
            >
              Need to sign in with another account?{" "}
              <Link
                href={`/login?next=/accept-invitation?token=${encodeURIComponent(token)}`}
                style={{ color: "var(--color-primary)", textDecoration: "underline" }}
              >
                Sign in here
              </Link>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
