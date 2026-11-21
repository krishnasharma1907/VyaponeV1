"use client";

/**
 * VyapOne — Public Website Renderer [VO-042, VO-043]
 *
 * Renders an assembled website from its published structured configuration document
 * and verified server facts context in strict accordance with PRD FINAL v2 §6.14, §15.3:
 * - Multi-page navigation through WebsiteHeaderNav.
 * - Active page selection and within-storefront 404 handling.
 * - Assembled blocks only (all 13 canonical approved blocks supported).
 * - Enforces zero arbitrary executable code.
 * - Persistent accessible footer landmark (<footer role="contentinfo">).
 * - Mobile-first responsive layout (320px, 390px, 768px, 1024px, 1440px).
 * - WCAG 2.2 AA accessible landmarks, skip link, and focus indicators.
 * - Isolates section rendering failures inside BlockErrorBoundary.
 */

import React from "react";
import type { WebsiteConfiguration } from "@/lib/websites/types";
import { BlockRenderer } from "../blocks/block-renderer";
import { FooterBlock } from "../blocks/footer-block";
import type { WebsiteRenderContext } from "../blocks/types";
import { WebsiteHeaderNav } from "./website-header-nav";
import { normalizePageSlug } from "@/lib/websites/seo";

export interface PublicWebsiteRendererProps {
  configuration: WebsiteConfiguration;
  context: WebsiteRenderContext;
  currentPath?: string;
  subdomain?: string;
  className?: string;
}

export function PublicWebsiteRenderer({
  configuration,
  context,
  currentPath = "/",
  subdomain,
  className = "",
}: PublicWebsiteRendererProps) {
  const theme = configuration.theme;
  const normCurrentPath = normalizePageSlug(currentPath);

  // Check if requested page exists in published pages
  const isHomeRequest = normCurrentPath === "/";
  const matchedPage = configuration.pages.find(
    (p) => normalizePageSlug(p.slug) === normCurrentPath,
  );

  // If root "/" requested and no page has slug "/", fallback to the first page
  const activePage = matchedPage || (isHomeRequest ? configuration.pages[0] : null);

  // Filter enabled sections if active page exists
  const enabledSections = (activePage?.sections || []).filter(
    (section) => section.isEnabled !== false,
  );

  // Check if page already includes a footer block section
  const hasFooterSection = enabledSections.some((s) => s.type === "footer");

  const homeHref = subdomain ? `/s/${subdomain}` : "/";

  return (
    <div
      className={`w-full min-h-screen flex flex-col transition-colors ${className}`.trim()}
      style={{
        backgroundColor: theme.colors.background || "#FFFFFF",
        color: theme.colors.text || "#0F172A",
        fontFamily: theme.fonts.body || "Inter, -apple-system, sans-serif",
      }}
    >
      {/* Skip to Main Content (Accessibility WCAG 2.2 AA) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-emerald-800 focus:text-white focus:rounded-md focus:shadow-lg focus:outline-hidden text-sm font-semibold"
      >
        Skip to main content
      </a>

      {/* Primary Header Navigation Landmark */}
      <WebsiteHeaderNav
        header={configuration.header}
        pages={configuration.pages}
        theme={configuration.theme}
        context={context}
        currentPath={normCurrentPath}
        subdomain={subdomain}
      />

      {/* Main Content Landmark */}
      <main id="main-content" className="w-full flex-1 flex flex-col">
        {activePage ? (
          enabledSections.map((section) => (
            <BlockRenderer
              key={section.id}
              section={section}
              context={context}
              className="w-full"
            />
          ))
        ) : (
          /* Safe within-storefront 404 for unknown page slug */
          <section
            aria-labelledby="page-not-found-heading"
            className="w-full flex-1 flex flex-col items-center justify-center py-24 px-4 text-center"
          >
            <h1
              id="page-not-found-heading"
              className="text-2xl sm:text-3xl font-bold tracking-tight mb-3"
              style={{
                fontFamily: theme.fonts.heading || theme.fonts.body || "Inter, sans-serif",
                color: theme.colors.text || "#0F172A",
              }}
            >
              Page Not Found
            </h1>
            <p className="text-slate-600 max-w-md mb-8 text-sm sm:text-base">
              The page you are looking for could not be found on this store.
            </p>
            <a
              href={homeHref}
              className="inline-flex items-center px-5 py-2.5 text-sm font-semibold text-white rounded-md shadow-xs transition-opacity hover:opacity-95"
              style={{ backgroundColor: theme.colors.primary || "#0B6E4F" }}
            >
              Return to Home
            </a>
          </section>
        )}
      </main>

      {/* Persistent Footer Landmark (if not already included in page sections) */}
      {!hasFooterSection && (
        <FooterBlock id="site-persistent-footer" props={configuration.footer} context={context} />
      )}
    </div>
  );
}
