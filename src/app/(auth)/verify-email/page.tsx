import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Badge,
} from "@/components/ui";

export const metadata: Metadata = {
  title: "Verify Your Email — VyapOne",
  description: "Check your inbox for a confirmation link to activate your VyapOne account.",
};

export default function VerifyEmailPage() {
  return (
    <Card variant="elevated">
      <CardHeader>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <CardTitle as="h1">Verify Your Email</CardTitle>
          <Badge variant="info">Verification</Badge>
        </div>
        <CardDescription>
          A verification link has been dispatched to your email address.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p
          style={{
            fontSize: "var(--font-size-body-md)",
            color: "var(--color-text-secondary)",
            lineHeight: "var(--line-height-relaxed)",
            margin: 0,
          }}
        >
          Please check your inbox and click the verification link to confirm your account and access
          your dashboard. If you don&apos;t see the email within a couple of minutes, please check
          your spam or junk folder.
        </p>
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
