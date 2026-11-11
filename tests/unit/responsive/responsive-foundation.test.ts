import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  breakpoints,
  touchTargets,
  safeAreaInsets,
  pageGutters,
  designTokens,
} from "@/design-system/tokens";
import { viewport } from "@/app/layout";

describe("Responsive Layout & Mobile Interaction Foundation [VO-015]", () => {
  describe("Design Token Invariants", () => {
    it("exports PRD-mandated responsive breakpoints", () => {
      expect(breakpoints.xs).toBe("320px");
      expect(breakpoints.sm).toBe("390px");
      expect(breakpoints.md).toBe("768px");
      expect(breakpoints.lg).toBe("1024px");
      expect(breakpoints.xl).toBe("1440px");

      // Verify inclusion in composite designTokens object
      expect(designTokens.breakpoints).toEqual(breakpoints);
    });

    it("exports touch target sizes compliant with mobile guidelines and WCAG 2.2 AA", () => {
      // 44px standard control height per WCAG 2.2 AA
      expect(touchTargets.formControlHeight).toBe("44px");
      // 48px preferred mobile touch target
      expect(touchTargets.preferredMobile).toBe("48px");
      // 24px min interactive target
      expect(touchTargets.minInteractive).toBe("24px");

      expect(designTokens.touchTargets).toEqual(touchTargets);
    });

    it("exports safe-area inset tokens with 0px fallbacks", () => {
      expect(safeAreaInsets.top).toBe("env(safe-area-inset-top, 0px)");
      expect(safeAreaInsets.bottom).toBe("env(safe-area-inset-bottom, 0px)");
      expect(safeAreaInsets.left).toBe("env(safe-area-inset-left, 0px)");
      expect(safeAreaInsets.right).toBe("env(safe-area-inset-right, 0px)");

      expect(designTokens.safeAreaInsets).toEqual(safeAreaInsets);
    });

    it("exports responsive page gutter tokens", () => {
      expect(pageGutters.mobile).toBe("16px");
      expect(pageGutters.tablet).toBe("24px");
      expect(pageGutters.desktop).toBe("32px");

      expect(designTokens.pageGutters).toEqual(pageGutters);
    });
  });

  describe("Root Viewport Metadata", () => {
    it("exports viewport configuration with viewportFit cover and zoom allowances", () => {
      expect(viewport.width).toBe("device-width");
      expect(viewport.initialScale).toBe(1);
      expect(viewport.maximumScale).toBe(5); // Accessibility: allow pinch zoom up to 500%
      expect(viewport.viewportFit).toBe("cover"); // Mandatory for notch/island safe areas
      expect(viewport.themeColor).toBe("#0F5132"); // VyapOne primary brand emerald
    });
  });

  describe("Global CSS Responsive Rules and Utilities", () => {
    const cssPath = path.resolve(__dirname, "../../../src/app/globals.css");
    const cssContent = fs.readFileSync(cssPath, "utf-8");

    it("defines CSS custom properties for safe areas with 0px fallbacks", () => {
      expect(cssContent).toContain("--safe-area-top: env(safe-area-inset-top, 0px)");
      expect(cssContent).toContain("--safe-area-bottom: env(safe-area-inset-bottom, 0px)");
      expect(cssContent).toContain("--safe-area-left: env(safe-area-inset-left, 0px)");
      expect(cssContent).toContain("--safe-area-right: env(safe-area-inset-right, 0px)");
    });

    it("defines responsive page gutter CSS variables", () => {
      expect(cssContent).toContain("--page-gutter: var(--space-4);");
      expect(cssContent).toContain("@media (min-width: 768px)");
      expect(cssContent).toContain("--page-gutter: var(--space-6);");
      expect(cssContent).toContain("@media (min-width: 1024px)");
      expect(cssContent).toContain("--page-gutter: var(--space-8);");
    });

    it("defines dynamic viewport height utility with fallback for virtual keyboards", () => {
      expect(cssContent).toContain(".min-h-screen-safe {");
      expect(cssContent).toContain("min-height: 100vh;");
      expect(cssContent).toContain("min-height: 100dvh;");
    });

    it("defines responsive container and header with safe-area padding", () => {
      expect(cssContent).toContain(".app-container {");
      expect(cssContent).toContain(
        "padding-left: max(var(--page-gutter), env(safe-area-inset-left, 0px));",
      );
      expect(cssContent).toContain(
        "padding-right: max(var(--page-gutter), env(safe-area-inset-right, 0px));",
      );

      expect(cssContent).toContain(".app-header {");
      expect(cssContent).toContain(
        "padding-top: max(var(--space-3), env(safe-area-inset-top, 0px));",
      );
    });

    it("defines mobile navigation responsive switching rules", () => {
      // Bottom bar hidden on desktop (min-width: 769px)
      expect(cssContent).toContain("@media (min-width: 769px)");
      expect(cssContent).toContain(".ui-nav-bottom-bar");
      expect(cssContent).toContain("display: none !important");

      // Desktop nav hidden on mobile (max-width: 768px)
      expect(cssContent).toContain("@media (max-width: 768px)");
      expect(cssContent).toContain(".owner-desktop-nav");

      // Safe area padding on bottom bar
      expect(cssContent).toContain(
        "padding-bottom: max(var(--space-2), env(safe-area-inset-bottom, 0px))",
      );

      // Bottom bar clearance utility
      expect(cssContent).toContain(".has-bottom-bar {");
    });

    it("defines horizontal scrollable navigation for multi-tab mobile headers", () => {
      expect(cssContent).toContain(".ui-nav-scrollable {");
      expect(cssContent).toContain("overflow-x: auto;");
      expect(cssContent).toContain("-webkit-overflow-scrolling: touch;");
      expect(cssContent).toContain("scrollbar-width: none;");
    });

    it("defines responsive table container preventing viewport breakages", () => {
      expect(cssContent).toContain(".ui-table-container {");
      expect(cssContent).toContain("overflow-x: auto;");
      expect(cssContent).toContain("-webkit-overflow-scrolling: touch;");
    });

    it("enforces minimum 16px font-size on form controls to prevent iOS auto-zoom", () => {
      // Input font size should be at least 1rem / 16px
      expect(cssContent).toContain(".ui-input,");
      expect(cssContent).toContain("font-size: var(--font-size-body);");
    });

    it("includes prefers-reduced-motion media query for motion safety", () => {
      expect(cssContent).toContain("@media (prefers-reduced-motion: reduce)");
    });
  });
});
