/**
 * VyapOne — Approved Block Library Helper Utilities [VO-041]
 *
 * Provides URL sanitization, monetary formatting, and theme helpers.
 */

import type { ThemeConfig } from "./types";

/**
 * Sanitizes URLs to prevent XSS via dangerous schemes (javascript:, data:, vbscript:).
 * Only allows http:, https:, tel:, mailto: or relative anchors (#, /).
 */
export function sanitizeLinkUrl(url?: string | null): string {
  if (!url) return "#";
  const trimmed = url.trim();
  if (trimmed.startsWith("#") || trimmed.startsWith("/")) {
    return trimmed;
  }
  // Check protocol
  try {
    const parsed = new URL(trimmed);
    if (["http:", "https:", "tel:", "mailto:"].includes(parsed.protocol)) {
      return trimmed;
    }
    return "#";
  } catch {
    // If not a full URL, but starts with tel: or mailto:
    if (/^(tel:|mailto:)/i.test(trimmed)) {
      return trimmed;
    }
    // Relative link
    return "#";
  }
}

/**
 * Formats monetary amounts stored in minor units (paisa) to INR rupees format.
 * E.g. 15000 paisa -> "₹150" or "₹150.50".
 */
export function formatCurrencyMinor(amountMinor: number, currency: string = "INR"): string {
  const symbol = currency === "INR" ? "₹" : `${currency} `;
  const major = amountMinor / 100;
  if (Number.isInteger(major)) {
    return `${symbol}${major.toLocaleString("en-IN")}`;
  }
  return `${symbol}${major.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Maps theme radius setting to Tailwind classes.
 */
export function getButtonRadiusClass(radii?: ThemeConfig["radii"]): string {
  switch (radii?.button) {
    case "none":
      return "rounded-none";
    case "sm":
      return "rounded-sm";
    case "lg":
      return "rounded-lg";
    case "full":
      return "rounded-full";
    case "md":
    default:
      return "rounded-md";
  }
}

export function getCardRadiusClass(radii?: ThemeConfig["radii"]): string {
  switch (radii?.card) {
    case "none":
      return "rounded-none";
    case "sm":
      return "rounded-sm";
    case "lg":
      return "rounded-xl";
    case "md":
    default:
      return "rounded-lg";
  }
}
