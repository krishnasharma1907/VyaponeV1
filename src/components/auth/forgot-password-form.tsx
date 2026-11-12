"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Field,
  Input,
  Badge,
} from "@/components/ui";
import { requestPasswordResetAction } from "@/lib/auth/actions";

export function ForgotPasswordForm() {
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    startTransition(async () => {
      const result = await requestPasswordResetAction(null, { email });
      if (!result.success) {
        setErrorMessage(result.error || "Failed to process password reset.");
      } else {
        setSuccessMessage(
          result.message ||
            "If an account with that email exists, password reset instructions have been sent.",
        );
      }
    });
  };

  return (
    <Card variant="elevated">
      <CardHeader>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <CardTitle as="h1">Reset Password</CardTitle>
          <Badge variant="default">Recovery</Badge>
        </div>
        <CardDescription>
          Enter your registered email address and we will send you a password reset link.
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
            id="forgot-email"
            label="Email Address"
            required
            helperText="We'll send a secure reset link to this address."
          >
            <Input
              type="email"
              id="forgot-email"
              placeholder="merchant@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              disabled={isPending}
            />
          </Field>

          <Button
            type="submit"
            variant="primary"
            style={{ width: "100%" }}
            disabled={isPending || !email.trim()}
          >
            {isPending ? "Sending Link..." : "Send Reset Link"}
          </Button>
        </form>
      </CardContent>

      <CardFooter style={{ display: "flex", justifyContent: "center" }}>
        <Link
          href="/login"
          style={{
            fontSize: "var(--font-size-body-sm)",
            color: "var(--color-brand-primary)",
            fontWeight: "var(--font-weight-medium)",
            textDecoration: "none",
          }}
        >
          Back to Sign In
        </Link>
      </CardFooter>
    </Card>
  );
}
