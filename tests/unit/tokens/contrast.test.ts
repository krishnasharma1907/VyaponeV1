import { describe, expect, it } from "vitest";
import {
  calculateContrastRatio,
  calculateRelativeLuminance,
  passesWcagAA,
} from "@/design-system/contrast";
import {
  brandPalette,
  designTokens,
  semanticColors,
  touchTargets,
  typography,
} from "@/design-system/tokens";

describe("WCAG 2.2 Contrast Ratio Calculations", () => {
  it("calculates known theoretical boundary ratios accurately", () => {
    // Pure black on pure white is 21.0:1
    expect(calculateContrastRatio("#000000", "#FFFFFF")).toBe(21);
    // Pure white on pure white is 1.0:1
    expect(calculateContrastRatio("#FFFFFF", "#FFFFFF")).toBe(1);

    // Relative luminance checks
    expect(calculateRelativeLuminance("#FFFFFF")).toBeCloseTo(1.0, 2);
    expect(calculateRelativeLuminance("#000000")).toBeCloseTo(0.0, 2);
  });

  describe("PRD Section 12.2 Authoritative Color Pairings", () => {
    it("validates Primary Emerald (#0B6E4F) with White text (PRD: 6.25:1, requires >= 4.5:1)", () => {
      const ratio = calculateContrastRatio("#FFFFFF", brandPalette.emerald.primary);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
      expect(ratio).toBeCloseTo(6.25, 1);
      expect(passesWcagAA(ratio, "normalText")).toBe(true);
    });

    it("validates Dark Text (#10201A) on Accent Marigold (#F5A524) (PRD: 8.27:1, requires >= 4.5:1)", () => {
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
      expect(ratio).toBeGreaterThanOrEqual(7.0); // Meets WCAG AAA
      expect(ratio).toBeCloseTo(15.9, 0);
      expect(passesWcagAA(ratio, "normalText")).toBe(true);
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

    it("validates Marigold Accent (#F5A524) on Deep Green (#0A3D2E) (PRD: 5.98:1, requires >= 4.5:1)", () => {
      const ratio = calculateContrastRatio(brandPalette.marigold.accent, brandPalette.emerald.deep);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
      expect(ratio).toBeCloseTo(5.98, 1);
      expect(passesWcagAA(ratio, "normalText")).toBe(true);
    });

    it("ENFORCES FORBIDDEN RULE: White text on Marigold (#F5A524) FAILS (PRD: 2.04:1 < 4.5:1)", () => {
      const ratio = calculateContrastRatio("#FFFFFF", brandPalette.marigold.accent);
      expect(ratio).toBeLessThan(4.5);
      expect(ratio).toBeCloseTo(2.04, 1);
      expect(passesWcagAA(ratio, "normalText")).toBe(false);
      // Ensure the semantic token for marigold text is strictly dark text, never white
      expect(semanticColors.colorBrandAccentFg).toBe(brandPalette.text.onMarigold);
      expect(semanticColors.colorBrandAccentFg).toBe("#10201A");
    });

    it("validates Danger Red (#B52B48) on White surface (requires >= 4.5:1)", () => {
      const ratio = calculateContrastRatio(brandPalette.status.danger, "#FFFFFF");
      expect(ratio).toBeGreaterThanOrEqual(4.5);
      expect(ratio).toBeCloseTo(6.17, 1);
      expect(passesWcagAA(ratio, "normalText")).toBe(true);
    });

    it("validates White text on Danger Red (#B52B48) (requires >= 4.5:1)", () => {
      const ratio = calculateContrastRatio("#FFFFFF", brandPalette.status.danger);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
      expect(ratio).toBeCloseTo(6.17, 1);
      expect(passesWcagAA(ratio, "normalText")).toBe(true);
    });

    it("validates White text on Warning Amber (#B45309) (requires >= 4.5:1)", () => {
      const ratio = calculateContrastRatio("#FFFFFF", brandPalette.status.warning);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
      expect(passesWcagAA(ratio, "normalText")).toBe(true);
    });

    it("validates White text on Info Slate-Teal (#0C5A75) (requires >= 4.5:1)", () => {
      const ratio = calculateContrastRatio("#FFFFFF", brandPalette.status.info);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
      expect(passesWcagAA(ratio, "normalText")).toBe(true);
    });
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

describe("Design Token Completeness", () => {
  it("verifies all token dictionary branches are non-empty", () => {
    expect(Object.keys(designTokens.brand)).toHaveLength(6);
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
