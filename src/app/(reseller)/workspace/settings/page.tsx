import React from "react";
import type { Metadata } from "next";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Field,
  Input,
  Button,
} from "@/components/ui";

export const metadata: Metadata = {
  title: "Branding Settings — Reseller Workspace | VyapOne",
  description: "Configure white-label agency domain, custom logo, and support contacts.",
};

export default function ResellerSettingsPage() {
  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", maxWidth: "800px" }}
    >
      <header>
        <h1
          style={{
            fontSize: "var(--font-size-h1)",
            color: "var(--color-text-primary)",
            marginBottom: "var(--space-1)",
          }}
        >
          White-Label &amp; Agency Settings
        </h1>
        <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--font-size-body)" }}>
          Customize your agency portal branding, support email, and custom CNAME domain.
        </p>
      </header>

      <Card variant="default">
        <CardHeader>
          <CardTitle as="h2">Agency Identity</CardTitle>
          <CardDescription>Branding displayed to your onboarded merchants</CardDescription>
        </CardHeader>
        <CardContent>
          <form style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <Field id="agency-name" label="Agency Display Name">
              <Input placeholder="e.g., Apex Digital Agency" disabled />
            </Field>
            <Field
              id="agency-domain"
              label="Custom Portal Domain"
              helperText="Point your CNAME to cname.vyapone.in (Phase P11)"
            >
              <Input placeholder="e.g., portal.apexdigital.in" disabled />
            </Field>
            <Field id="agency-support" label="Support Contact Phone/Email">
              <Input placeholder="e.g., support@apexdigital.in" disabled />
            </Field>
            <div>
              <Button type="button" variant="primary" disabled>
                Save Changes (VO-110)
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
