"use client";

/**
 * VyapOne — Public Website Renderer [VO-042]
 *
 * Renders an assembled website from its published structured configuration document
 * and verified server facts context in strict accordance with PRD FINAL v2 §6.14, §15.3:
 * - Assembled blocks only (all 13 canonical approved blocks supported).
 * - Enforces zero arbitrary executable code.
 * - Mobile-first responsive layout (320px, 390px, 768px, 1024px, 1440px).
 * - WCAG 2.2 AA accessible landmarks, skip link, and focus indicators.
 * - Isolates section rendering failures inside BlockErrorBoundary.
 */

import React from "react";
import type { WebsiteConfiguration } from "@/lib/websites/types";
import { BlockRenderer } from "../blocks/block-renderer";
import type { WebsiteRenderContext } from "../blocks/types";

export interface PublicWebsiteRendererProps {
  configuration: WebsiteConfiguration;
  context: WebsiteRenderContext;
  currentPath?: string;
  className?: string;
}

export function PublicWebsiteRenderer({
  configuration,
  context,
  currentPath = "/",
  className = "",
}: PublicWebsiteRendererProps) {
  const theme = configuration.theme;

  // Resolve target page by path (default to home page '/')
  const activePage =
    configuration.pages.find((p) => p.slug === currentPath) ||
    configuration.pages.find((p) => p.slug === "/") ||
    configuration.pages[0];

  if (!activePage) {
    return (
      <div className="w-full py-16 px-4 text-center">
        <p className="text-slate-500 text-sm">No published pages found for this website.</p>
      </div>
    );
  }

  // Filter enabled sections only
  const enabledSections = (activePage.sections || []).filter(
    (section) => section.isEnabled !== false,
  );

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

      {/* Main Content Landmark */}
      <main id="main-content" className="w-full flex-1 flex flex-col">
        {enabledSections.map((section) => (
          <BlockRenderer key={section.id} section={section} context={context} className="w-full" />
        ))}
      </main>
    </div>
  );
}
