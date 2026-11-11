import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Badge, Nav, NavList, NavItem, NavLink } from "@/components/ui";

export const metadata: Metadata = {
  title: "Platform Administration — VyapOne",
  description:
    "Global tenant inspector, master plan limits, statutory tax rate tables, and tamper-evident audit logs.",
};

const adminNavItems = [
  { label: "System Health", href: "/platform-admin" },
  { label: "Tenants", href: "/platform-admin/tenants" },
  { label: "Master Plans", href: "/platform-admin/plans" },
  { label: "GST Master", href: "/platform-admin/taxes" },
  { label: "Audit Trail", href: "/platform-admin/audit-logs" },
  { label: "Abuse Defense", href: "/platform-admin/abuse" },
];

export default function PlatformAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--color-background)",
      }}
    >
      {/* Super-Admin Platform Header */}
      <header
        style={{
          borderBottom: "2px solid var(--color-danger)",
          backgroundColor: "var(--color-surface)",
          padding: "var(--space-3) var(--page-gutter-mobile)",
        }}
      >
        <div
          style={{
            maxWidth: "1440px",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "var(--space-3)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <Link
              href="/platform-admin"
              style={{
                textDecoration: "none",
                color: "var(--color-danger)",
                fontSize: "var(--font-size-h3)",
                fontWeight: "var(--font-weight-bold)",
              }}
            >
              VyapOne Governance
            </Link>
            <Badge variant="danger">Platform Super-Admin</Badge>
          </div>

          {/* Role-Aware Governance Navigation */}
          <Nav aria-label="Platform Administration Navigation" variant="horizontal">
            <NavList style={{ flexWrap: "wrap" }}>
              {adminNavItems.map((item) => (
                <NavItem key={item.href}>
                  <NavLink href={item.href}>{item.label}</NavLink>
                </NavItem>
              ))}
            </NavList>
          </Nav>
        </div>
      </header>

      {/* Main Admin Content */}
      <main
        id="main-content"
        style={{
          flex: 1,
          maxWidth: "1440px",
          width: "100%",
          margin: "0 auto",
          padding: "var(--space-6) var(--page-gutter-mobile)",
        }}
      >
        {children}
      </main>
    </div>
  );
}
