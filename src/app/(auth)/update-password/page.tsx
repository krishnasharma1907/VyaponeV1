import React, { Suspense } from "react";
import type { Metadata } from "next";
import { UpdatePasswordForm } from "@/components/auth/update-password-form";
import { Skeleton } from "@/components/ui";

export const metadata: Metadata = {
  title: "Update Password — VyapOne",
  description: "Set a new secure password for your VyapOne account.",
};

export default function UpdatePasswordPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: "var(--space-6)" }}>
          <Skeleton height={300} />
        </div>
      }
    >
      <UpdatePasswordForm />
    </Suspense>
  );
}
