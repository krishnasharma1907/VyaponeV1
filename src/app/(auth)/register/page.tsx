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
  Select,
  Badge,
} from "@/components/ui";

export const metadata: Metadata = {
  title: "Register — VyapOne",
  description: "Create your business owner or reseller workspace account.",
};

export default function RegisterPage() {
  return (
    <Card variant="elevated">
      <CardHeader>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <CardTitle as="h1">Get Started</CardTitle>
          <Badge variant="primary">New Account</Badge>
        </div>
        <CardDescription>
          Join VyapOne as an independent business owner or authorized reseller agency.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <Field id="account-type" label="Account Type" required>
            <Select defaultValue="owner">
              <option value="owner">Business Owner (Single/Multi-Location)</option>
              <option value="reseller">Reseller Agency (Manage Multiple Clients)</option>
            </Select>
          </Field>
          <Field id="reg-business-name" label="Business or Agency Name" required>
            <Input placeholder="e.g., Sharma General Store" />
          </Field>
          <Field
            id="reg-phone"
            label="Mobile Number"
            required
            helperText="Your primary login identifier"
          >
            <Input type="tel" placeholder="98765 43210" autoComplete="tel" />
          </Field>
          <Button type="button" variant="primary" style={{ width: "100%" }}>
            Continue to Verification &rarr;
          </Button>
        </form>
      </CardContent>
      <CardFooter>
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
