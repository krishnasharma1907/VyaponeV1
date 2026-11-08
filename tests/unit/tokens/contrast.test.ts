import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  calculateContrastRatio,
  calculateRelativeLuminance,
  formatContrastRatio,
  hexToRgb,
  passesWcagAA,
  passesWcagAAA,
} from "@/design-system/contrast";
import {
  brandPalette,
  designTokens,
  semanticColors,
  touchTargets,
  typography,
} from "@/design-system/tokens";

describe("WCAG 2.2 Hex Parsing & Luminance Utilities", () => {
  it("parses valid 6-digit and 3-digit hex strings accurately", () => {
    expect(hexToRgb("#FFFFFF")).toEqual([255, 255, 255]);
    expect(hexToRgb("#fff")).toEqual([255, 255, 255]);
    expect(hexToRgb("#000000")).toEqual([0, 0, 0]);
    expect(hexToRgb("#000")).toEqual([0, 0, 0]);
    expect(hexToRgb("0B6E4F")).toEqual([11, 110, 79]);
    expect(hexToRgb("#0b6e4f")).toEqual([11, 110, 79]);
  });

  it("strictly rejects malformed and non-hex inputs", () => {
    expect(() => hexToRgb("#GGGGGG")).toThrow(/Invalid hex color/);
    expect(() => hexToRgb("#12")).toThrow(/Invalid hex color/);
    expect(() => hexToRgb("#1234567")).toThrow(/Invalid hex color/);
    expect(() => hexToRgb("rgba(0,0,0,1)")).toThrow(/Invalid hex color/);
  });

  it("calculates known theoretical boundary ratios accurately without pre-rounding", () => {
    const blackWhiteRatio = calculateContrastRatio("#000000", "#FFFFFF");
    expect(blackWhiteRatio).toBe(21);
    expect(formatContrastRatio(blackWhiteRatio)).toBe("21.00:1");

    const whiteWhiteRatio = calculateContrastRatio("#FFFFFF", "#FFFFFF");
    expect(whiteWhiteRatio).toBe(1);
    expect(formatContrastRatio(whiteWhiteRatio)).toBe("1.00:1");

    expect(calculateRelativeLuminance("#FFFFFF")).toBeCloseTo(1.0, 4);
    expect(calculateRelativeLuminance("#000000")).toBeCloseTo(0.0, 4);
  });
});

describe("Canonical Brand Palette Contrast Verification", () => {
  it("validates Canonical Brand Emerald (#0F5132) with White text (Meets AAA: 9.36:1 >= 7.0:1)", () => {
    const ratio = calculateContrastRatio("#FFFFFF", brandPalette.canonical.emerald);
    expect(ratio).toBeGreaterThanOrEqual(7.0);
    expect(ratio).toBeCloseTo(9.36, 1);
    expect(passesWcagAA(ratio, "normalText")).toBe(true);
    expect(passesWcagAAA(ratio, "normalText")).toBe(true);
    expect(semanticColors.colorBrandEmeraldFg).toBe("#FFFFFF");
  });

  it("validates Canonical Brand Marigold (#D97706) with Dark Text (#10201A) (Meets AA: 5.30:1 >= 4.5:1)", () => {
    const ratio = calculateContrastRatio(
      brandPalette.text.primary,
      brandPalette.canonical.marigold,
    );
    expect(ratio).toBeGreaterThanOrEqual(4.5);
    expect(ratio).toBeCloseTo(5.3, 1);
    expect(passesWcagAA(ratio, "normalText")).toBe(true);
    expect(semanticColors.colorBrandMarigoldFg).toBe("#10201A");
  });

  it("documents White text on Brand Marigold (#D97706) as 3.19:1 (fails normal AA 4.5:1, passes large text 3:1)", () => {
    const ratio = calculateContrastRatio("#FFFFFF", brandPalette.canonical.marigold);
    expect(ratio).toBeLessThan(4.5);
    expect(ratio).toBeGreaterThanOrEqual(3.0);
    expect(ratio).toBeCloseTo(3.19, 1);
    expect(passesWcagAA(ratio, "normalText")).toBe(false);
    expect(passesWcagAA(ratio, "largeText")).toBe(true);
  });
});

describe("PRD Section 12.2 Authoritative UI Action Color Pairings", () => {
  it("validates UI Action Emerald (#0B6E4F) with White text (PRD: 6.25:1, requires >= 4.5:1)", () => {
    const ratio = calculateContrastRatio("#FFFFFF", brandPalette.emerald.primary);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
    expect(ratio).toBeCloseTo(6.25, 1);
    expect(passesWcagAA(ratio, "normalText")).toBe(true);
  });

  it("validates Dark Text (#10201A) on UI Accent Marigold (#F5A524) (PRD: 8.27:1, requires >= 4.5:1)", () => {
    const ratio = calculateContrastRatio(brandPalette.text.primary, brandPalette.marigold.accent);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
    expect(ratio).toBeCloseTo(8.27, 1);
    expect(passesWcagAA(ratio, "normalText")).toBe(true);
  });

  it("validates Dark Text (#10201A) on Warm Background (#FAF8F3) (PRD: 15.9:1, requires >= 4.5:1)", () => {
    const ratio = calculateContrastRatio(
      brandPalette.text.primary,
      brandPalette.neutral.background,
    );
    expect(ratio).toBeGreaterThanOrEqual(7.0);
    expect(ratio).toBeCloseTo(15.91, 1);
    expect(passesWcagAA(ratio, "normalText")).toBe(true);
    expect(passesWcagAAA(ratio, "normalText")).toBe(true);
  });

  it("validates Secondary Text (#5B6B63) on Warm Background (#FAF8F3) (PRD: 5.31:1, requires >= 4.5:1)", () => {
    const ratio = calculateContrastRatio(
      brandPalette.text.secondary,
      brandPalette.neutral.background,
    );
    expect(ratio).toBeGreaterThanOrEqual(4.5);
    expect(ratio).toBeCloseTo(5.31, 1);
    expect(passesWcagAA(ratio, "normalText")).toBe(true);
  });

  it("validates UI Accent Marigold (#F5A524) on Deep Green (#0A3D2E) (PRD: 5.98:1, requires >= 4.5:1)", () => {
    const ratio = calculateContrastRatio(brandPalette.marigold.accent, brandPalette.emerald.deep);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
    expect(ratio).toBeCloseTo(5.98, 1);
    expect(passesWcagAA(ratio, "normalText")).toBe(true);
  });

  it("ENFORCES FORBIDDEN RULE: White text on UI Accent Marigold (#F5A524) FAILS (PRD: 2.04:1 < 4.5:1)", () => {
    const ratio = calculateContrastRatio("#FFFFFF", brandPalette.marigold.accent);
    expect(ratio).toBeLessThan(4.5);
    expect(ratio).toBeCloseTo(2.04, 1);
    expect(passesWcagAA(ratio, "normalText")).toBe(false);
    expect(semanticColors.colorBrandAccentFg).toBe(brandPalette.text.onMarigold);
    expect(semanticColors.colorBrandAccentFg).toBe("#10201A");
  });

  it("validates Danger Red (#B52B48) with White surface & text (recalculated: 6.17:1, requires >= 4.5:1)", () => {
    const ratio = calculateContrastRatio(brandPalette.status.danger, "#FFFFFF");
    expect(ratio).toBeGreaterThanOrEqual(4.5);
    expect(ratio).toBeCloseTo(6.17, 1);
    expect(passesWcagAA(ratio, "normalText")).toBe(true);
  });

  it("validates Warning Amber (#B45309) with White text (recalculated: 5.02:1, requires >= 4.5:1)", () => {
    const ratio = calculateContrastRatio("#FFFFFF", brandPalette.status.warning);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
    expect(ratio).toBeCloseTo(5.02, 1);
    expect(passesWcagAA(ratio, "normalText")).toBe(true);
  });

  it("validates Info Slate-Teal (#0C5A75) with White text (recalculated: 7.68:1, requires >= 4.5:1)", () => {
    const ratio = calculateContrastRatio("#FFFFFF", brandPalette.status.info);
    expect(ratio).toBeGreaterThanOrEqual(7.0);
    expect(ratio).toBeCloseTo(7.68, 1);
    expect(passesWcagAA(ratio, "normalText")).toBe(true);
    expect(passesWcagAAA(ratio, "normalText")).toBe(true);
  });
});

describe("Touch Target Accessibility Tokens", () => {
  it("enforces WCAG 2.2 AA Criterion 2.5.8 minimum target dimension (>= 24px)", () => {
    const minTargetPx = parseInt(touchTargets.minInteractive, 10);
    expect(minTargetPx).toBeGreaterThanOrEqual(24);
  });

  it("enforces mobile-first ergonomics (>= 44px for primary controls and inputs)", () => {
    const preferredMobilePx = parseInt(touchTargets.preferredMobile, 10);
    const formControlPx = parseInt(touchTargets.formControlHeight, 10);
    const iconButtonPx = parseInt(touchTargets.iconButtonSize, 10);

    expect(preferredMobilePx).toBeGreaterThanOrEqual(44);
    expect(formControlPx).toBeGreaterThanOrEqual(44);
    expect(iconButtonPx).toBeGreaterThanOrEqual(44);
  });
});

describe("Typography and Mobile Prevention Tokens", () => {
  it("enforces standard mobile body text at minimum 16px to prevent iOS Safari auto-zoom", () => {
    expect(typography.scale.body.fontSize).toBe("1rem");
  });

  it("provides comprehensive fallback font stacks for Latin and Indic scripts", () => {
    expect(typography.fonts.sans).toContain("Inter");
    expect(typography.fonts.sans).toContain("-apple-system");
    expect(typography.fonts.sans).toContain("sans-serif");
    expect(typography.fonts.devanagari).toContain("Noto Sans Devanagari");
    expect(typography.fonts.mono).toContain("monospace");
  });
});

describe("Token Source Consistency (TypeScript <-> CSS Custom Properties)", () => {
  it("verifies tokens.ts definitions match globals.css CSS custom properties exactly", () => {
    const globalsCssPath = path.resolve(process.cwd(), "src/app/globals.css");
    const globalsCss = fs.readFileSync(globalsCssPath, "utf-8");

    // Canonical Brand Tokens
    expect(globalsCss).toContain("--color-brand-emerald: #0f5132;");
    expect(globalsCss).toContain("--color-brand-marigold: #d97706;");

    // UI Action Palette (PRD §12.2)
    expect(globalsCss).toContain("--color-emerald-primary: #0b6e4f;");
    expect(globalsCss).toContain("--color-emerald-hover: #095c42;");
    expect(globalsCss).toContain("--color-emerald-deep: #0a3d2e;");
    expect(globalsCss).toContain("--color-marigold-accent: #f5a524;");

    // Canvas & Typography
    expect(globalsCss).toContain("--color-background: #faf8f3;");
    expect(globalsCss).toContain("--color-surface: #ffffff;");
    expect(globalsCss).toContain("--color-text-primary: #10201a;");
    expect(globalsCss).toContain("--color-text-secondary: #5b6b63;");

    // Status Colors
    expect(globalsCss).toContain("--color-danger: #b52b48;");
    expect(globalsCss).toContain("--color-warning: #b45309;");
    expect(globalsCss).toContain("--color-info: #0c5a75;");

    // Touch Targets
    expect(globalsCss).toContain("--target-min: 24px;");
    expect(globalsCss).toContain("--target-mobile-preferred: 48px;");
    expect(globalsCss).toContain("--target-control-height: 44px;");
  });

  it("verifies all token dictionary branches in designTokens are non-empty", () => {
    expect(Object.keys(designTokens.brand)).toHaveLength(7);
    expect(Object.keys(designTokens.semantic).length).toBeGreaterThan(15);
    expect(Object.keys(designTokens.glass).length).toBeGreaterThan(5);
    expect(Object.keys(designTokens.spacing).length).toBeGreaterThan(10);
    expect(Object.keys(designTokens.radii).length).toBeGreaterThan(6);
    expect(Object.keys(designTokens.shadows).length).toBeGreaterThan(5);
    expect(Object.keys(designTokens.breakpoints)).toHaveLength(5);
    expect(Object.keys(designTokens.motion.duration)).toHaveLength(3);
    expect(Object.keys(designTokens.zIndex).length).toBeGreaterThan(6);
  });
});
