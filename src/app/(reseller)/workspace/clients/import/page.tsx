import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button, Card, CardContent } from "@/components/ui";
import { ImportReviewContainer } from "@/components/businesses/import-review";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Import Client Business — Reseller Workspace | VyapOne",
  description:
    "Import external business data, menus, catalogues, and operating facts with human confirmation review.",
};

export default async function ImportClientBusinessPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/auth/login?returnUrl=/workspace/clients/import");
  }

  // Resolve user's active reseller workspace
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id, role, workspaces (id, name, slug)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership || !membership.workspace_id) {
    return (
      <div style={{ maxWidth: "600px", margin: "var(--space-8) auto", padding: "var(--space-4)" }}>
        <Card variant="default">
          <CardContent style={{ padding: "var(--space-6)", textAlign: "center" }}>
            <h2 style={{ fontSize: "var(--font-size-h2)", color: "var(--color-text-primary)" }}>
              No Active Workspace Found
            </h2>
            <p
              style={{
                color: "var(--color-text-secondary)",
                margin: "var(--space-2) 0 var(--space-4) 0",
              }}
            >
              You must belong to an active agency or reseller workspace before importing client
              stores.
            </p>
            <Link href="/onboarding" style={{ textDecoration: "none" }}>
              <Button variant="primary">Create or Join Workspace</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      {/* Breadcrumb / Back Navigation */}
      <nav aria-label="Breadcrumb">
        <Link
          href="/workspace/clients"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--space-1)",
            color: "var(--color-text-secondary)",
            textDecoration: "none",
            fontSize: "var(--font-size-sm)",
            minHeight: "44px",
          }}
        >
          &larr; Back to Client Directory
        </Link>
      </nav>

      {/* Main Import Review Container */}
      <ImportReviewContainer
        workspaceId={membership.workspace_id}
        userId={user.id}
        onSuccessRedirect="/workspace/clients"
      />
    </div>
  );
}
