import React, { Suspense } from "react";
import type { Metadata } from "next";
import { AcceptInvitationCard } from "@/components/auth/accept-invitation-card";
import { Skeleton } from "@/components/ui";

export const metadata: Metadata = {
  title: "Accept Invitation — VyapOne",
  description: "Accept an invitation to join a workspace or business on VyapOne.",
};

export default function AcceptInvitationPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: "var(--space-6)" }}>
          <Skeleton height={320} />
        </div>
      }
    >
      <AcceptInvitationCard />
    </Suspense>
  );
}
