import React, { Suspense } from "react";
import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { Skeleton } from "@/components/ui";

export const metadata: Metadata = {
  title: "Reset Password — VyapOne",
  description: "Request a password reset link for your VyapOne account.",
};

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: "var(--space-6)" }}>
          <Skeleton height={280} />
        </div>
      }
    >
      <ForgotPasswordForm />
    </Suspense>
  );
}
