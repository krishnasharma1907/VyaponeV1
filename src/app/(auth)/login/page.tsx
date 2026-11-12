import React, { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { Skeleton } from "@/components/ui";

export const metadata: Metadata = {
  title: "Sign In — VyapOne",
  description: "Sign in to your VyapOne account using Mobile OTP or Email/Password.",
};

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: "var(--space-6)" }}>
          <Skeleton height={320} />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
