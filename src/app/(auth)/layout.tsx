import React from "react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Authentication — VyapOne",
  description: "Sign in or register for VyapOne sovereign merchant and reseller platform.",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen-safe app-container"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        paddingTop: "max(var(--space-8), env(safe-area-inset-top, 0px))",
        paddingBottom: "max(var(--space-8), env(safe-area-inset-bottom, 0px))",
        backgroundColor: "var(--color-background)",
      }}
    >
      <header
        style={{
          width: "100%",
          maxWidth: "440px",
          marginBottom: "var(--space-6)",
          textAlign: "center",
        }}
      >
        <Link
          href="/"
          style={{
            textDecoration: "none",
            color: "var(--color-brand-emerald)",
            fontSize: "var(--font-size-h2)",
            fontWeight: "var(--font-weight-bold)",
            letterSpacing: "var(--letter-spacing-h2)",
          }}
        >
          VyapOne
        </Link>
      </header>

      <main
        id="main-content"
        style={{
          width: "100%",
          maxWidth: "440px",
        }}
      >
        {children}
      </main>

      <footer
        style={{
          marginTop: "var(--space-8)",
          textAlign: "center",
          fontSize: "var(--font-size-caption)",
          color: "var(--color-text-secondary)",
        }}
      >
        <p>Protected by sovereign tenant isolation &bull; DPDP 2023 Compliant</p>
      </footer>
    </div>
  );
}
