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
      className="min-h-screen-safe"
      style={{
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--color-background)",
      }}
    >
      {/* Super-Admin Platform Header */}
      <header
        className="app-header"
        style={{
          borderBottom: "2px solid var(--color-danger)",
          backgroundColor: "var(--color-surface)",
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
          <Nav
            aria-label="Platform Administration Navigation"
            variant="horizontal"
            className="ui-nav-scrollable"
          >
            <NavList>
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
        className="app-container"
        style={{
          flex: 1,
          maxWidth: "1440px",
          margin: "0 auto",
          paddingTop: "var(--space-6)",
          paddingBottom: "var(--space-8)",
        }}
      >
        {children}
      </main>
    </div>
  );
}
