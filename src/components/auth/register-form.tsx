"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  Select,
  Badge,
} from "@/components/ui";
import { signUpAction } from "@/lib/auth/actions";

export function RegisterForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [accountType, setAccountType] = useState<"owner" | "reseller">("owner");
  const [businessName, setBusinessName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    startTransition(async () => {
      const result = await signUpAction(null, {
        fullName,
        businessName,
        email,
        phone: phone.trim() ? phone : undefined,
        password,
        accountType,
      });

      if (!result.success) {
        setErrorMessage(result.error || "Failed to create account.");
      } else {
        setSuccessMessage(result.message || "Account registered successfully.");
        if (result.redirectTo) {
          router.push(result.redirectTo);
          router.refresh();
        }
      }
    });
  };

  return (
    <Card variant="elevated">
      <CardHeader>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <CardTitle as="h1">Get Started</CardTitle>
          <Badge variant="primary">New Account</Badge>
        </div>
        <CardDescription>Create your business owner or reseller workspace account.</CardDescription>
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
          <Field id="account-type" label="Account Type" required>
            <Select
              id="account-type"
              value={accountType}
              onChange={(e) => setAccountType(e.target.value as "owner" | "reseller")}
              disabled={isPending}
            >
              <option value="owner">Business Owner (Single/Multi-Location)</option>
              <option value="reseller">Reseller Agency (Manage Multiple Clients)</option>
            </Select>
          </Field>

          <Field id="reg-business-name" label="Business or Agency Name" required>
            <Input
              id="reg-business-name"
              placeholder="e.g., Sharma General Store"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              required
              disabled={isPending}
            />
          </Field>

          <Field id="reg-full-name" label="Full Name" required>
            <Input
              id="reg-full-name"
              placeholder="e.g., Rahul Sharma"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              disabled={isPending}
            />
          </Field>

          <Field id="reg-email" label="Email Address" required>
            <Input
              type="email"
              id="reg-email"
              placeholder="rahul@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              disabled={isPending}
            />
          </Field>

          <Field
            id="reg-phone"
            label="Mobile Number"
            helperText="10-digit Indian mobile number (optional for password registration)"
          >
            <Input
              type="tel"
              id="reg-phone"
              placeholder="98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              disabled={isPending}
            />
          </Field>

          <Field
            id="reg-password"
            label="Password"
            required
            helperText="At least 8 characters with letters and numbers"
          >
            <Input
              type="password"
              id="reg-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
              disabled={isPending}
            />
          </Field>

          <Button
            type="submit"
            variant="primary"
            style={{ width: "100%" }}
            disabled={isPending || !email || !password || !fullName || !businessName}
          >
            {isPending ? "Creating Account..." : "Create Account"}
          </Button>
        </form>
      </CardContent>

      <CardFooter style={{ display: "flex", justifyContent: "center", gap: "var(--space-2)" }}>
        <span
          style={{ fontSize: "var(--font-size-body-sm)", color: "var(--color-text-secondary)" }}
        >
          Already registered?
        </span>
        <Link
          href="/login"
          style={{
            fontSize: "var(--font-size-body-sm)",
            color: "var(--color-brand-primary)",
            fontWeight: "var(--font-weight-medium)",
            textDecoration: "none",
          }}
        >
          Sign In
        </Link>
      </CardFooter>
    </Card>
  );
}
