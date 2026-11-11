import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Badge, Nav, NavList, NavItem, NavLink } from "@/components/ui";

export const metadata: Metadata = {
  title: "Reseller Agency Workspace — VyapOne",
  description:
    "Manage client merchants, provision storefronts, track wholesale billing, and configure agency branding.",
};

export default function ResellerWorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--color-background)",
      }}
    >
      {/* Reseller Shell Header */}
      <header
        className="glass-surface"
        style={{
          position: "sticky",
          top: 0,
          zIndex: "var(--z-glass-nav)",
          padding: "var(--space-3) var(--page-gutter-mobile)",
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
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
              href="/workspace"
              style={{
                textDecoration: "none",
                color: "var(--color-brand-emerald)",
                fontSize: "var(--font-size-h3)",
                fontWeight: "var(--font-weight-bold)",
              }}
            >
              Apex Digital Agency
            </Link>
            <Badge variant="primary">Reseller Portal</Badge>
          </div>

          {/* Role-Aware Navigation: Strictly Agency Scoped */}
          <Nav aria-label="Reseller Workspace Navigation" variant="horizontal">
            <NavList>
              <NavItem>
                <NavLink href="/workspace">Overview</NavLink>
              </NavItem>
              <NavItem>
                <NavLink href="/workspace/clients">Client Businesses</NavLink>
              </NavItem>
              <NavItem>
                <NavLink href="/workspace/billing">Wholesale Billing</NavLink>
              </NavItem>
              <NavItem>
                <NavLink href="/workspace/team">Agency Team</NavLink>
              </NavItem>
              <NavItem>
                <NavLink href="/workspace/settings">Branding Settings</NavLink>
              </NavItem>
            </NavList>
          </Nav>
        </div>
      </header>

      {/* Main Reseller Content */}
      <main
        id="main-content"
        style={{
          flex: 1,
          maxWidth: "1200px",
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
