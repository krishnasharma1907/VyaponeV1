import React from "react";
import Link from "next/link";
import { Nav, NavList, NavItem, NavLink } from "@/components/ui";

export default function PublicStorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--color-background)",
      }}
    >
      {/* Public Storefront Header */}
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
            maxWidth: "1024px",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--space-4)",
          }}
        >
          <Link
            href="/"
            style={{
              textDecoration: "none",
              color: "var(--color-brand-emerald)",
              fontSize: "var(--font-size-h3)",
              fontWeight: "var(--font-weight-bold)",
            }}
          >
            Storefront
          </Link>

          <Nav aria-label="Storefront Navigation" variant="horizontal">
            <NavList>
              <NavItem>
                <NavLink href="/s/demo-store" isActive={true}>
                  Home
                </NavLink>
              </NavItem>
              <NavItem>
                <NavLink href="/privacy">Privacy</NavLink>
              </NavItem>
              <NavItem>
                <NavLink href="/login">Merchant Sign In</NavLink>
              </NavItem>
            </NavList>
          </Nav>
        </div>
      </header>

      {/* Main Public Content */}
      <main
        id="main-content"
        style={{
          flex: 1,
          maxWidth: "1024px",
          width: "100%",
          margin: "0 auto",
          padding: "var(--space-6) var(--page-gutter-mobile)",
        }}
      >
        {children}
      </main>

      {/* Public Footer */}
      <footer
        style={{
          backgroundColor: "var(--color-surface)",
          borderTop: "1px solid var(--color-border)",
          padding: "var(--space-6) var(--page-gutter-mobile)",
          marginTop: "auto",
        }}
      >
        <div
          style={{
            maxWidth: "1024px",
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "var(--space-4)",
            fontSize: "var(--font-size-caption)",
            color: "var(--color-text-secondary)",
          }}
        >
          <span>Powered by VyapOne Sovereign Commerce</span>
          <div style={{ display: "flex", gap: "var(--space-4)" }}>
            <Link href="/privacy" style={{ color: "inherit", textDecoration: "none" }}>
              Privacy &amp; Grievance
            </Link>
            <Link href="/login" style={{ color: "inherit", textDecoration: "none" }}>
              Staff / Admin Portal
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
