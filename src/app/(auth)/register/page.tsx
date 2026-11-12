import React, { Suspense } from "react";
import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/register-form";
import { Skeleton } from "@/components/ui";

export const metadata: Metadata = {
  title: "Register — VyapOne",
  description: "Create your business owner or reseller workspace account.",
};

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: "var(--space-6)" }}>
          <Skeleton height={380} />
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
