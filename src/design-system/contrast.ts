/**
 * WCAG 2.2 Relative Luminance and Contrast Ratio Calculation Utilities
 *
 * Reference: W3C Web Content Accessibility Guidelines (WCAG) 2.2, Guidelines 1.4.3, 1.4.6 & 1.4.11
 */

/**
 * Converts a 6-digit or 3-digit hexadecimal color string into [R, G, B] channels in 0..255.
 * Strictly validates hex format and supports both lowercase and uppercase.
 */
export function hexToRgb(hex: string): [number, number, number] {
  let cleanHex = hex.replace(/^#/, "").trim();
  if (cleanHex.length === 3) {
    cleanHex = cleanHex
      .split("")
      .map((char) => char + char)
      .join("");
  }
  if (cleanHex.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(cleanHex)) {
    throw new Error(`Invalid hex color: "${hex}"`);
  }
  const r = parseInt(cleanHex.slice(0, 2), 16);
  const g = parseInt(cleanHex.slice(2, 4), 16);
  const b = parseInt(cleanHex.slice(4, 6), 16);
  return [r, g, b];
}

/**
 * Computes the relative luminance of an sRGB color.
 * Standard WCAG 2.2 formula:
 * L = 0.2126 * R_linear + 0.7152 * G_linear + 0.0722 * B_linear
 * Output range: 0.0 (darkest black #000000) to 1.0 (lightest white #FFFFFF).
 */
export function calculateRelativeLuminance(hex: string): number {
  const [r8, g8, b8] = hexToRgb(hex);

  const toLinear = (channel8: number): number => {
    const channel = channel8 / 255;
    return channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
  };

  const rLinear = toLinear(r8);
  const gLinear = toLinear(g8);
  const bLinear = toLinear(b8);

  return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
}

/**
 * Calculates the exact contrast ratio between two colors.
 * Formula: (L1 + 0.05) / (L2 + 0.05), where L1 is the lighter color.
 * Output: Unrounded floating point ratio between 1.0 and 21.0.
 * NOTE: Values are NOT rounded before threshold comparisons to eliminate rounding bias.
 */
export function calculateContrastRatio(foregroundHex: string, backgroundHex: string): number {
  const lum1 = calculateRelativeLuminance(foregroundHex);
  const lum2 = calculateRelativeLuminance(backgroundHex);

  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Formats a contrast ratio for display rounded to two decimal places (e.g. "6.25:1").
 */
export function formatContrastRatio(ratio: number): string {
  const rounded = Math.round(ratio * 100) / 100;
  return `${rounded.toFixed(2)}:1`;
}

/**
 * Evaluates whether an unrounded contrast ratio passes WCAG 2.2 Level AA.
 * - Normal text (< 18pt or < 14pt bold): >= 4.5:1
 * - Large text (>= 18pt or >= 14pt bold) and non-text UI components: >= 3.0:1
 */
export function passesWcagAA(
  ratio: number,
  type: "normalText" | "largeText" | "uiComponent" = "normalText",
): boolean {
  if (type === "normalText") {
    return ratio >= 4.5;
  }
  return ratio >= 3.0;
}

/**
 * Evaluates whether an unrounded contrast ratio passes WCAG 2.2 Level AAA (enhanced contrast).
 * - Normal text: >= 7.0:1
 * - Large text: >= 4.5:1
 */
export function passesWcagAAA(
  ratio: number,
  type: "normalText" | "largeText" = "normalText",
): boolean {
  if (type === "normalText") {
    return ratio >= 7.0;
  }
  return ratio >= 4.5;
}
