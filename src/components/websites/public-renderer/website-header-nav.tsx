"use client";

/**
 * VyapOne — Storefront Primary Header Navigation [VO-043]
 *
 * Implements accessible multi-page navigation for published storefronts
 * in accordance with PRD FINAL v2 §8.2, §15.3, §16, §17:
 * - Semantic <header role="banner"> and <nav aria-label="Main Navigation"> landmarks.
 * - Active page indication with aria-current="page".
 * - Mobile responsive navigation with keyboard-accessible hamburger toggle (Escape to close).
 * - Safe internal page links and URL sanitization.
 * - Visible focus indicators and WCAG 2.2 AA compliant contrast.
 */

import React, { useState, useEffect, useRef } from "react";
import type { HeaderConfig, PageConfig, ThemeConfig, ButtonCta } from "@/lib/websites/types";
import type { WebsiteRenderContext } from "@/components/websites/blocks/types";
import { sanitizeLinkUrl, getButtonRadiusClass } from "@/components/websites/blocks/utils";
import { normalizePageSlug } from "@/lib/websites/seo";
import { WhatsAppIcon, PhoneIcon } from "@/components/websites/blocks/icons";

export interface WebsiteHeaderNavProps {
  header: HeaderConfig;
  pages: PageConfig[];
  theme: ThemeConfig;
  context: WebsiteRenderContext;
  currentPath?: string;
  subdomain?: string;
  className?: string;
}

export function WebsiteHeaderNav({
  header,
  pages,
  theme,
  context,
  currentPath = "/",
  subdomain,
  className = "",
}: WebsiteHeaderNavProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileNavRef = useRef<HTMLDivElement>(null);
  const toggleButtonRef = useRef<HTMLButtonElement>(null);

  const normCurrentPath = normalizePageSlug(currentPath);
  const business = context.business;
  const brandName =
    header.logoText?.trim() ||
    business?.tradeName?.trim() ||
    business?.name?.trim() ||
    subdomain ||
    "Storefront";

  // Resolve logo URL from verified public CDN context
  const logoUrl = header.logoMediaId ? context.mediaUrls?.[header.logoMediaId] : undefined;

  // Build navigation items:
  // 1. If header.navLinks are explicitly defined, use them.
  // 2. Otherwise derive from published pages (excluding pages marked isPublished=false).
  const navItems =
    header.navLinks && header.navLinks.length > 0
      ? header.navLinks.map((link) => ({
          label: link.label,
          href: link.href,
          isExternal: Boolean(link.isExternal),
        }))
      : pages
          .filter((p) => p.isPublished !== false)
          .map((p) => ({
            label: p.title,
            href: p.slug,
            isExternal: false,
          }));

  // Close mobile menu on Escape key press
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
        toggleButtonRef.current?.focus();
      }
    }

    if (isMobileMenuOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMobileMenuOpen]);

  /**
   * Resolves href for an internal page link within the multi-tenant public storefront.
   */
  function resolveNavLinkHref(rawHref: string): string {
    const sanitized = sanitizeLinkUrl(rawHref);
    if (sanitized === "#" || sanitized.startsWith("http://") || sanitized.startsWith("https://")) {
      return sanitized;
    }

    // Relative page slug
    const pageSlug = normalizePageSlug(sanitized);
    if (!subdomain) {
      return pageSlug;
    }

    if (pageSlug === "/") {
      return `/s/${subdomain}`;
    }
    return `/s/${subdomain}?p=${encodeURIComponent(pageSlug)}`;
  }

  /**
   * Determines if a navigation link represents the active page.
   */
  function isLinkActive(rawHref: string): boolean {
    if (rawHref.startsWith("http://") || rawHref.startsWith("https://")) {
      return false;
    }
    const slug = normalizePageSlug(rawHref);
    return slug === normCurrentPath;
  }

  /**
   * Action trigger handler for header CTA button.
   */
  function handleCtaClick(cta: ButtonCta) {
    const whatsappNum = business?.whatsappNumber || business?.phone;
    if (cta.action === "whatsapp_order" && whatsappNum) {
      const cleanPhone = whatsappNum.replace(/[^0-9]/g, "");
      const msg = encodeURIComponent(`Hi, I'm visiting your website and have an inquiry.`);
      window.open(`https://wa.me/91${cleanPhone}?text=${msg}`, "_blank", "noopener,noreferrer");
    } else if (cta.action === "phone_call" && business?.phone) {
      window.location.href = `tel:${business.phone}`;
    } else if (cta.action === "custom_link" && cta.target) {
      const safeUrl = sanitizeLinkUrl(cta.target);
      if (safeUrl !== "#") {
        window.open(safeUrl, "_blank", "noopener,noreferrer");
      }
    }
  }

  const primaryColor = theme.colors.primary || "#0B6E4F";
  const surfaceColor = theme.colors.surface || "#FFFFFF";
  const textColor = theme.colors.text || "#0F172A";
  const buttonRadiusClass = getButtonRadiusClass(theme.radii);

  const homeHref = subdomain ? `/s/${subdomain}` : "/";

  return (
    <header
      role="banner"
      className={`w-full sticky top-0 z-40 border-b border-slate-200/80 shadow-xs backdrop-blur-md transition-colors ${className}`.trim()}
      style={{
        backgroundColor: `${surfaceColor}F2`,
        color: textColor,
        fontFamily: theme.fonts.body || "Inter, sans-serif",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand / Logo Landmark */}
        <div className="flex items-center gap-3 shrink-0">
          <a
            href={homeHref}
            className="flex items-center gap-2.5 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-600 rounded-md py-1"
            aria-label={`${brandName} home page`}
          >
            {logoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={logoUrl}
                alt={`${brandName} logo`}
                className="h-9 w-auto max-w-[140px] object-contain rounded-xs"
              />
            ) : null}
            <span
              className="text-lg sm:text-xl font-bold tracking-tight select-none"
              style={{
                fontFamily: theme.fonts.heading || theme.fonts.body || "Inter, sans-serif",
                color: primaryColor,
              }}
            >
              {brandName}
            </span>
          </a>
        </div>

        {/* Desktop Primary Navigation */}
        <nav
          aria-label="Main Navigation"
          className="hidden md:flex items-center gap-1 lg:gap-2 flex-1 justify-center max-w-2xl"
        >
          {navItems.map((item, idx) => {
            const active = isLinkActive(item.href);
            const resolvedHref = item.isExternal
              ? sanitizeLinkUrl(item.href)
              : resolveNavLinkHref(item.href);

            return (
              <a
                key={idx}
                href={resolvedHref}
                target={item.isExternal ? "_blank" : undefined}
                rel={item.isExternal ? "noopener noreferrer" : undefined}
                aria-current={active ? "page" : undefined}
                className={`px-3 py-1.5 text-sm font-medium transition-colors rounded-md focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-600 ${
                  active
                    ? "font-semibold text-slate-900 border-b-2"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                }`}
                style={{
                  borderBottomColor: active ? primaryColor : "transparent",
                  color: active ? primaryColor : undefined,
                }}
              >
                {item.label}
              </a>
            );
          })}
        </nav>

        {/* Header Action CTA (Desktop) */}
        <div className="hidden md:flex items-center gap-3 shrink-0">
          {header.cta ? (
            <button
              type="button"
              onClick={() => handleCtaClick(header.cta as ButtonCta)}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white shadow-xs transition-opacity hover:opacity-95 active:opacity-90 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-600 ${buttonRadiusClass}`}
              style={{ backgroundColor: primaryColor }}
            >
              {header.cta.action === "whatsapp_order" && (
                <WhatsAppIcon className="w-4 h-4 fill-current shrink-0" aria-hidden="true" />
              )}
              {header.cta.action === "phone_call" && (
                <PhoneIcon className="w-4 h-4 fill-current shrink-0" aria-hidden="true" />
              )}
              <span>{header.cta.label}</span>
            </button>
          ) : null}
        </div>

        {/* Mobile Hamburger Toggle Button */}
        <div className="flex md:hidden items-center">
          <button
            ref={toggleButtonRef}
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-nav-dialog"
            aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            className="p-2 rounded-md text-slate-700 hover:text-slate-900 hover:bg-slate-100 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-600"
          >
            {isMobileMenuOpen ? (
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            ) : (
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Dropdown / Drawer */}
      {isMobileMenuOpen && (
        <div
          id="mobile-nav-dialog"
          ref={mobileNavRef}
          role="navigation"
          aria-label="Mobile Navigation"
          className="md:hidden border-t border-slate-200/80 px-4 pt-3 pb-6 space-y-2 bg-white shadow-lg animate-in fade-in slide-in-from-top-2 duration-150 motion-reduce:animate-none"
          style={{ backgroundColor: surfaceColor }}
        >
          <ul className="flex flex-col space-y-1">
            {navItems.map((item, idx) => {
              const active = isLinkActive(item.href);
              const resolvedHref = item.isExternal
                ? sanitizeLinkUrl(item.href)
                : resolveNavLinkHref(item.href);

              return (
                <li key={idx}>
                  <a
                    href={resolvedHref}
                    target={item.isExternal ? "_blank" : undefined}
                    rel={item.isExternal ? "noopener noreferrer" : undefined}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`block px-3 py-2.5 rounded-md text-base font-medium transition-colors ${
                      active
                        ? "font-semibold text-slate-900 bg-slate-100"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                    }`}
                    style={{
                      color: active ? primaryColor : undefined,
                    }}
                  >
                    {item.label}
                  </a>
                </li>
              );
            })}
          </ul>

          {/* Mobile CTA */}
          {header.cta ? (
            <div className="pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  handleCtaClick(header.cta as ButtonCta);
                }}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 text-base font-semibold text-white shadow-xs ${buttonRadiusClass}`}
                style={{ backgroundColor: primaryColor }}
              >
                {header.cta.action === "whatsapp_order" && (
                  <WhatsAppIcon className="w-4 h-4 fill-current shrink-0" aria-hidden="true" />
                )}
                {header.cta.action === "phone_call" && (
                  <PhoneIcon className="w-4 h-4 fill-current shrink-0" aria-hidden="true" />
                )}
                <span>{header.cta.label}</span>
              </button>
            </div>
          ) : null}
        </div>
      )}
    </header>
  );
}
