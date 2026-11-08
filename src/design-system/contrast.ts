/**
 * WCAG 2.2 Relative Luminance and Contrast Ratio Calculation Utilities
 *
 * Reference: W3C Web Content Accessibility Guidelines (WCAG) 2.2, Guideline 1.4.3 & 1.4.11
 */

/**
 * Converts a 6-digit or 3-digit hex color string into [R, G, B] values in 0..255.
 */
export function hexToRgb(hex: string): [number, number, number] {
  let cleanHex = hex.replace(/^#/, "").trim();
  if (cleanHex.length === 3) {
    cleanHex = cleanHex
      .split("")
      .map((char) => char + char)
      .join("");
  }
  if (cleanHex.length !== 6) {
    throw new Error(`Invalid hex color: "${hex}"`);
  }
  const r = parseInt(cleanHex.slice(0, 2), 16);
  const g = parseInt(cleanHex.slice(2, 4), 16);
  const b = parseInt(cleanHex.slice(4, 6), 16);
  return [r, g, b];
}

/**
 * Computes the relative luminance of an sRGB color.
 * Normalized output range: 0.0 (darkest black) to 1.0 (lightest white).
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
 * Calculates the contrast ratio between two colors.
 * Formula: (L1 + 0.05) / (L2 + 0.05), where L1 is the lighter color.
 * Output range: 1.0 to 21.0.
 */
export function calculateContrastRatio(foregroundHex: string, backgroundHex: string): number {
  const lum1 = calculateRelativeLuminance(foregroundHex);
  const lum2 = calculateRelativeLuminance(backgroundHex);

  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  const ratio = (lighter + 0.05) / (darker + 0.05);
  // Round to two decimal places
  return Math.round(ratio * 100) / 100;
}

/**
 * Evaluates whether a contrast ratio passes WCAG 2.2 AA.
 */
export function passesWcagAA(
  ratio: number,
  type: "normalText" | "largeText" | "uiComponent" = "normalText",
): boolean {
  if (type === "normalText") {
    return ratio >= 4.5;
  }
  // Large text (>= 18pt or >= 14pt bold) and non-text UI components/boundaries require >= 3.0:1
  return ratio >= 3.0;
}
