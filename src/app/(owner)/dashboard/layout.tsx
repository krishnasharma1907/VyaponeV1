import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Badge, Nav, NavList, NavItem, NavLink } from "@/components/ui";

export const metadata: Metadata = {
  title: "Business Owner Dashboard — VyapOne",
  description:
    "Sovereign merchant operations: orders, sequential GST billing, catalogue, WhatsApp, and website builder.",
};

const ownerNavItems = [
  { label: "Daily Pulse", href: "/dashboard" },
  { label: "Products", href: "/dashboard/catalogue" },
  { label: "Orders", href: "/dashboard/orders" },
  { label: "GST Billing", href: "/dashboard/billing" },
  { label: "Customers", href: "/dashboard/customers" },
  { label: "WhatsApp", href: "/dashboard/whatsapp" },
  { label: "Website", href: "/dashboard/website" },
  { label: "Analytics", href: "/dashboard/analytics" },
  { label: "Settings", href: "/dashboard/settings" },
];

export default function BusinessOwnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen-safe"
      style={{
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--color-background)",
      }}
    >
      {/* Business Owner Header */}
      <header
        className="glass-surface app-header"
        style={{
          position: "sticky",
          top: 0,
          zIndex: "var(--z-glass-nav)",
        }}
      >
        <div
          style={{
            maxWidth: "1280px",
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
              href="/dashboard"
              style={{
                textDecoration: "none",
                color: "var(--color-brand-emerald)",
                fontSize: "var(--font-size-h3)",
                fontWeight: "var(--font-weight-bold)",
              }}
            >
              Merchant Dashboard
            </Link>
            <Badge variant="accent">Owner Portal</Badge>
          </div>

          {/* Desktop Navigation */}
          <Nav
            aria-label="Business Owner Navigation"
            variant="horizontal"
            className="owner-desktop-nav"
          >
            <NavList style={{ flexWrap: "wrap" }}>
              {ownerNavItems.map((item) => (
                <NavItem key={item.href}>
                  <NavLink href={item.href}>{item.label}</NavLink>
                </NavItem>
              ))}
            </NavList>
          </Nav>
        </div>
      </header>

      {/* Main Content */}
      <main
        id="main-content"
        className="app-container has-bottom-bar"
        style={{
          flex: 1,
          maxWidth: "1280px",
          margin: "0 auto",
          paddingTop: "var(--space-6)",
        }}
      >
        {children}
      </main>

      {/* Mobile Bottom Navigation Bar (WCAG 44px+ touch target) */}
      <Nav aria-label="Mobile Bottom Navigation" variant="bottom-bar">
        <NavList>
          <NavItem>
            <NavLink href="/dashboard">Pulse</NavLink>
          </NavItem>
          <NavItem>
            <NavLink href="/dashboard/billing">Bill</NavLink>
          </NavItem>
          <NavItem>
            <NavLink href="/dashboard/orders">Orders</NavLink>
          </NavItem>
          <NavItem>
            <NavLink href="/dashboard/whatsapp">WA</NavLink>
          </NavItem>
          <NavItem>
            <NavLink href="/dashboard/settings">More</NavLink>
          </NavItem>
        </NavList>
      </Nav>
    </div>
  );
}
