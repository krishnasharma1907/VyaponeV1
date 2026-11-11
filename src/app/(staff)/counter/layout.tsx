import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Badge, Nav, NavList, NavItem, NavLink } from "@/components/ui";

export const metadata: Metadata = {
  title: "Staff Counter Terminal — VyapOne",
  description: "High-contrast rapid counter POS billing, instant receipts, and station PIN lock.",
};

export default function StaffCounterLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen-safe"
      style={{
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--color-surface)", // Clean white high-contrast background for POS
      }}
    >
      {/* High-Contrast POS Header */}
      <header
        className="app-header"
        style={{
          borderBottom: "2px solid var(--color-border)",
          backgroundColor: "var(--color-background-subtle)",
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
              href="/counter"
              style={{
                textDecoration: "none",
                color: "var(--color-brand-emerald)",
                fontSize: "var(--font-size-h3)",
                fontWeight: "var(--font-weight-bold)",
              }}
            >
              Counter Station #1
            </Link>
            <Badge variant="warning">Staff Counter POS</Badge>
          </div>

          {/* Role-Aware Navigation: Zero Settings/Bank VPAs/Analytics */}
          <Nav
            aria-label="Staff Counter Navigation"
            variant="horizontal"
            className="ui-nav-scrollable"
          >
            <NavList>
              <NavItem>
                <NavLink href="/counter">Station Home</NavLink>
              </NavItem>
              <NavItem>
                <NavLink href="/counter/pos">Fast POS Punch</NavLink>
              </NavItem>
              <NavItem>
                <NavLink href="/counter/unlock">Lock / Switch PIN</NavLink>
              </NavItem>
            </NavList>
          </Nav>
        </div>
      </header>

      {/* Main Counter POS Content */}
      <main
        id="main-content"
        className="app-container"
        style={{
          flex: 1,
          maxWidth: "1440px",
          margin: "0 auto",
          paddingTop: "var(--space-4)",
          paddingBottom: "var(--space-6)",
        }}
      >
        {children}
      </main>
    </div>
  );
}
