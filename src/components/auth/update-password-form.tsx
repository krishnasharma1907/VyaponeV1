"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Field,
  Input,
  Badge,
} from "@/components/ui";
import { updatePasswordAction } from "@/lib/auth/actions";

export function UpdatePasswordForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    startTransition(async () => {
      const result = await updatePasswordAction(null, {
        password,
        confirmPassword,
      });

      if (!result.success) {
        setErrorMessage(result.error || "Failed to update password.");
      } else {
        setSuccessMessage("Password updated successfully! Redirecting...");
        router.push(result.redirectTo || "/dashboard");
        router.refresh();
      }
    });
  };

  return (
    <Card variant="elevated">
      <CardHeader>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <CardTitle as="h1">Set New Password</CardTitle>
          <Badge variant="primary">Security</Badge>
        </div>
        <CardDescription>
          Enter your new password below. It must be at least 8 characters long and contain letters
          and numbers.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {errorMessage && (
          <div
            role="alert"
            style={{
              padding: "var(--space-3)",
              marginBottom: "var(--space-4)",
              borderRadius: "var(--radius-md)",
              backgroundColor: "var(--color-status-error-bg, #fee2e2)",
              color: "var(--color-status-error-text, #991b1b)",
              fontSize: "var(--font-size-body-sm)",
              border: "1px solid var(--color-status-error-border, #f87171)",
            }}
          >
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div
            role="status"
            style={{
              padding: "var(--space-3)",
              marginBottom: "var(--space-4)",
              borderRadius: "var(--radius-md)",
              backgroundColor: "var(--color-status-success-bg, #dcfce7)",
              color: "var(--color-status-success-text, #166534)",
              fontSize: "var(--font-size-body-sm)",
              border: "1px solid var(--color-status-success-border, #86efac)",
            }}
          >
            {successMessage}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}
        >
          <Field
            id="update-new-password"
            label="New Password"
            required
            helperText="Minimum 8 characters with letters and numbers"
          >
            <Input
              type="password"
              id="update-new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
              disabled={isPending}
            />
          </Field>

          <Field id="update-confirm-password" label="Confirm Password" required>
            <Input
              type="password"
              id="update-confirm-password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
              disabled={isPending}
            />
          </Field>

          <Button
            type="submit"
            variant="primary"
            style={{ width: "100%" }}
            disabled={isPending || !password || !confirmPassword}
          >
            {isPending ? "Updating Password..." : "Update Password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
