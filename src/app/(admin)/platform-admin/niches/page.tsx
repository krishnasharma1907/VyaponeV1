import React from "react";
import type { Metadata } from "next";
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { CANONICAL_MODULES, CANONICAL_NICHE_GROUPS } from "@/lib/niches/constants";

export const metadata: Metadata = {
  title: "Niches & Modules — Platform Administration | VyapOne",
  description:
    "Review canonical industry niche groups, versioned manifests, availability labels, and platform capabilities.",
};

const availabilityVariantMap: Record<
  string,
  "success" | "info" | "warning" | "default" | "danger"
> = {
  live_operational: "success",
  informational_with_enquiry: "info",
  coming_soon: "warning",
};

const availabilityLabels: Record<string, string> = {
  live_operational: "Live Operational",
  informational_with_enquiry: "Informational + Enquiry",
  coming_soon: "Coming Soon",
};

export default function AdminNichesPage() {
  const groups = CANONICAL_NICHE_GROUPS;
  const modules = CANONICAL_MODULES;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      {/* Page Header */}
      <header>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <h1
            style={{
              fontSize: "var(--font-size-h1)",
              color: "var(--color-text-primary)",
              marginBottom: "var(--space-1)",
            }}
          >
            Niche &amp; Module Registry
          </h1>
          <Badge variant="default">VO-030</Badge>
        </div>
        <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--font-size-body)" }}>
          Platform registry of 9 canonical industry groups, versioned onboarding manifests,
          availability labels, and 21 modular business capabilities.
        </p>
      </header>

      {/* Summary Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "var(--space-4)",
        }}
      >
        <Card variant="default">
          <CardHeader>
            <CardDescription>Canonical Industry Groups</CardDescription>
            <CardTitle style={{ fontSize: "var(--font-size-h2)" }}>{groups.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-secondary)" }}>
              PRD §7: Food, Retail, Services, Health, Education, Real Estate, Auto, Manufacturing,
              Other.
            </p>
          </CardContent>
        </Card>

        <Card variant="default">
          <CardHeader>
            <CardDescription>Platform Modules</CardDescription>
            <CardTitle style={{ fontSize: "var(--font-size-h2)" }}>{modules.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-secondary)" }}>
              PRD §8: 21 composable capabilities across core, commerce, ops, and intelligence.
            </p>
          </CardContent>
        </Card>

        <Card variant="default">
          <CardHeader>
            <CardDescription>Entitlement Invariant</CardDescription>
            <CardTitle style={{ fontSize: "var(--font-size-h3)", color: "var(--color-success)" }}>
              Plan-Decoupled
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-secondary)" }}>
              Niche presets recommend modules; tenant plan entitlements strictly govern server
              execution.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Niche Groups Table */}
      <Card variant="default">
        <CardHeader>
          <CardTitle>Industry Niche Groups (PRD §7)</CardTitle>
          <CardDescription>
            High-level classification for onboarding wizards, website templates, and preset
            recommendations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead style={{ width: "80px" }}>Order</TableHead>
                <TableHead>Group Name</TableHead>
                <TableHead>Identifier</TableHead>
                <TableHead>Default Availability</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((group) => {
                const availabilityKey =
                  group.slug === "food_and_beverage" ||
                  group.slug === "personal_care_beauty" ||
                  group.slug === "retail_and_kirana"
                    ? "live_operational"
                    : group.slug === "real_estate" ||
                        group.slug === "automotive" ||
                        group.slug === "education_and_coaching"
                      ? "informational_with_enquiry"
                      : "live_operational";

                return (
                  <TableRow key={group.slug}>
                    <TableCell style={{ fontWeight: "var(--font-weight-bold)" }}>
                      {group.displayOrder}
                    </TableCell>
                    <TableCell style={{ fontWeight: "var(--font-weight-medium)" }}>
                      {group.name}
                    </TableCell>
                    <TableCell>
                      <code>{group.slug}</code>
                    </TableCell>
                    <TableCell>
                      <Badge variant={availabilityVariantMap[availabilityKey] ?? "default"}>
                        {availabilityLabels[availabilityKey] ?? availabilityKey}
                      </Badge>
                    </TableCell>
                    <TableCell style={{ color: "var(--color-text-secondary)" }}>
                      {group.description}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Platform Modules Table */}
      <Card variant="default">
        <CardHeader>
          <CardTitle>Platform Capabilities &amp; Modules (PRD §8)</CardTitle>
          <CardDescription>
            21 reusable building blocks activated per business and validated against subscription
            tiers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Entitlement Key</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {modules.map((mod) => (
                <TableRow key={mod.key}>
                  <TableCell>
                    <code>{mod.key}</code>
                  </TableCell>
                  <TableCell style={{ fontWeight: "var(--font-weight-medium)" }}>
                    {mod.name}
                  </TableCell>
                  <TableCell>
                    <Badge variant="default">{mod.category}</Badge>
                  </TableCell>
                  <TableCell>
                    {mod.category === "core" ? (
                      <Badge variant="primary">Core (Mandatory)</Badge>
                    ) : (
                      <Badge variant="default">Optional</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {mod.entitlementFeatureKey ? (
                      <code style={{ fontSize: "var(--font-size-xs)" }}>
                        {mod.entitlementFeatureKey}
                      </code>
                    ) : (
                      <span
                        style={{
                          color: "var(--color-text-tertiary)",
                          fontSize: "var(--font-size-xs)",
                        }}
                      >
                        All Plans
                      </span>
                    )}
                  </TableCell>
                  <TableCell style={{ color: "var(--color-text-secondary)" }}>
                    {mod.description}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
