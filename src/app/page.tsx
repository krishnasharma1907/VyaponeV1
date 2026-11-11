import React from "react";
import Link from "next/link";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui";

export default function HomePage() {
  const portals = [
    {
      title: "Business Owner Dashboard",
      path: "/dashboard",
      badge: "Sovereign Owner",
      badgeVariant: "accent" as const,
      desc: "Daily pulse, catalogue, orders, sequential GST billing, customers, WhatsApp, and website builder.",
    },
    {
      title: "Staff Counter Terminal",
      path: "/counter",
      badge: "Staff POS",
      badgeVariant: "warning" as const,
      desc: "High-contrast fast order punching, instant receipts, and station PIN unlock.",
    },
    {
      title: "Reseller Agency Workspace",
      path: "/workspace",
      badge: "Reseller Agency",
      badgeVariant: "primary" as const,
      desc: "Client business roster, wholesale billing, agency team, and white-label branding.",
    },
    {
      title: "Platform Administration",
      path: "/platform-admin",
      badge: "Super-Admin",
      badgeVariant: "danger" as const,
      desc: "Global system health, tenant inspector, statutory GST master tables, and audit trail.",
    },
    {
      title: "Public Storefront Touchpoint",
      path: "/s/demo-store",
      badge: "Customer Storefront",
      badgeVariant: "default" as const,
      desc: "Responsive public storefront home for merchant customers (*.vyapone.in).",
    },
    {
      title: "Authentication Portal",
      path: "/login",
      badge: "Auth Entry",
      badgeVariant: "info" as const,
      desc: "Phone OTP and email login for merchants, agency staff, and platform operators.",
    },
  ];

  return (
    <main
      id="main-content"
      style={{
        padding: "var(--page-gutter-mobile)",
        maxWidth: "768px",
        margin: "0 auto",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-6)",
      }}
    >
      <header
        style={{
          paddingTop: "var(--space-6)",
        }}
      >
        <div
          style={{
            marginBottom: "var(--space-3)",
            display: "flex",
            gap: "var(--space-2)",
            flexWrap: "wrap",
          }}
        >
          <Badge variant="info">Developer Route Shell Showcase (Phase P1 / VO-014)</Badge>
        </div>
        <h1
          style={{
            fontSize: "var(--font-size-h1)",
            lineHeight: "var(--line-height-h1)",
            letterSpacing: "var(--letter-spacing-h1)",
            color: "var(--color-text-primary)",
            marginBottom: "var(--space-2)",
          }}
        >
          VyapOne
        </h1>
        <p
          style={{
            color: "var(--color-text-secondary)",
            fontSize: "var(--font-size-body)",
            lineHeight: "var(--line-height-body)",
            marginBottom: "var(--space-3)",
          }}
        >
          Developer-only navigation navigator to inspect and verify application route shells,
          layouts, and role-aware navigation. Real server-side authentication (VO-021) and tenant
          database authorization (VO-024) will protect operational routes.
        </p>
      </header>

      {/* Application Route Shell Portals */}
      <section aria-labelledby="portals-heading">
        <h2
          id="portals-heading"
          style={{
            fontSize: "var(--font-size-h2)",
            color: "var(--color-text-primary)",
            marginBottom: "var(--space-4)",
          }}
        >
          Application Portals &amp; Route Shells
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: "var(--space-4)",
          }}
        >
          {portals.map((portal) => (
            <Card key={portal.path} variant="default">
              <CardHeader>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "var(--space-2)",
                  }}
                >
                  <CardTitle as="h3">{portal.title}</CardTitle>
                  <Badge variant={portal.badgeVariant}>{portal.badge}</Badge>
                </div>
                <CardDescription>{portal.desc}</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href={portal.path} style={{ textDecoration: "none" }}>
                  <Button variant="outline" size="sm">
                    Open {portal.title} &rarr;
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Design System Glassmorphism Badge */}
      <footer
        className="glass-surface"
        style={{
          padding: "var(--space-4)",
          borderRadius: "var(--radius-lg)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "var(--space-2)",
          marginTop: "auto",
        }}
      >
        <span
          style={{
            fontSize: "var(--font-size-caption)",
            color: "var(--color-text-secondary)",
          }}
        >
          Canonical Emerald (#0F5132) &amp; Marigold (#D97706) &bull; WCAG 2.2 AA
        </span>
        <Link
          href="/privacy"
          style={{
            fontSize: "var(--font-size-caption)",
            color: "var(--color-brand-primary)",
            fontWeight: "var(--font-weight-medium)",
            textDecoration: "none",
          }}
        >
          Privacy Policy &amp; Grievance Redressal
        </Link>
      </footer>
    </main>
  );
}
