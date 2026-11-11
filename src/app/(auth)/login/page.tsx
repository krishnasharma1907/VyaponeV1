import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "Sign In — VyapOne",
  description: "Sign in with your registered phone number or email.",
};

export default function LoginPage() {
  return (
    <Card variant="elevated">
      <CardHeader>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <CardTitle as="h1">Sign In</CardTitle>
          <Badge variant="info">OTP Login</Badge>
        </div>
        <CardDescription>
          Enter your 10-digit mobile number to receive a secure one-time passcode.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <Field
            id="login-phone"
            label="Mobile Number"
            required
            helperText="We will send a 6-digit OTP"
          >
            <Input type="tel" placeholder="98765 43210" autoComplete="tel" />
          </Field>
          <Button type="button" variant="primary" style={{ width: "100%" }}>
            Send OTP &rarr;
          </Button>
        </form>
      </CardContent>
      <CardFooter>
        <span
          style={{ fontSize: "var(--font-size-body-sm)", color: "var(--color-text-secondary)" }}
        >
          Don&apos;t have an account?
        </span>
        <Link
          href="/register"
          style={{
            fontSize: "var(--font-size-body-sm)",
            color: "var(--color-brand-primary)",
            fontWeight: "var(--font-weight-medium)",
            textDecoration: "none",
          }}
        >
          Create Account
        </Link>
      </CardFooter>
    </Card>
  );
}
