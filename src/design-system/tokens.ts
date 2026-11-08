/**
 * VyapOne Canonical Design Tokens
 *
 * Brand: VyapOne ("Every business. One platform.")
 * Visual Direction: Light-first glassmorphism, Emerald + Marigold palette
 * Reference: PRD_FINAL_v2_2026-11-03 Section 12
 *
 * All monetary amounts in the UI are formatted in 64-bit integer minor units.
 * All touch targets adhere to WCAG 2.2 AA (>= 24px minimum, 44-48px preferred).
 */

export interface ColorToken {
  value: string;
  description: string;
  usage: string;
  contrastWithWhite?: number;
  contrastWithDark?: number;
}

export interface TypographyToken {
  fontSize: string;
  lineHeight: string;
  letterSpacing: string;
  fontWeight: number;
  description: string;
}

export const brandPalette = {
  // Primary Emerald family
  emerald: {
    primary: "#0B6E4F", // Primary actions, links, active states, logo green
    hover: "#095C42", // Hover / pressed state of primary actions
    deep: "#0A3D2E", // Dark hero sections, footers, dark backgrounds
    forest: "#0F5132", // Deep forest theme color (mobile browser chrome)
    soft: "#E8F5EE", // Soft emerald tint for selected list items / badges
  },
  // Accent Marigold family (rare, high-impact only, ALWAYS paired with dark text #10201A)
  marigold: {
    accent: "#F5A524", // High-priority CTAs (New bill, Join waitlist, primary alerts)
    hover: "#D97706", // Hover state for marigold CTAs
    deep: "#B45309", // Deep marigold / warm amber
    soft: "#FEF3C7", // Soft amber tint for warning / alert banners
  },
  // Neutral Canvas & Surface family (warm white foundation)
  neutral: {
    background: "#FAF8F3", // Warm white main canvas (60% volume)
    backgroundSubtle: "#F4F0E6", // Subtle warm container background
    surface: "#FFFFFF", // Cards, forms, tables, sheets, data grids
    surfaceElevated: "#FFFFFF", // Modals, popovers, dropdowns
    surfaceDark: "#0A3D2E", // Inverted dark canvas sections
  },
  // Neutral Content & Typography family
  text: {
    primary: "#10201A", // Primary body and headings (15.9:1 on warm background)
    secondary: "#5B6B63", // Secondary supporting text (5.31:1 on warm background)
    muted: "#788880", // Field placeholders, hints, timestamps
    disabled: "#A3B0A9", // Disabled controls, inactive toggles
    inverse: "#FFFFFF", // Text on primary emerald or dark surfaces
    onMarigold: "#10201A", // FORCED: Dark text on marigold (8.27:1) - White text forbidden!
  },
  // Borders and Dividers
  border: {
    default: "#E7E2D6", // Primary boundary for cards, inputs, dividers
    subtle: "#F0ECE1", // Subtle inner card dividers
    strong: "#CBD5CE", // High-contrast control outlines
    focusRing: "#0B6E4F", // Accessible 3px focus ring with 2px offset
  },
  // Semantic Feedback States
  status: {
    success: "#0B6E4F", // Success matches Emerald brand
    successBg: "#E8F5EE",
    successFg: "#FFFFFF",
    warning: "#B45309", // Warm amber with 5.6:1 contrast on white
    warningBg: "#FFFBEB",
    warningFg: "#FFFFFF",
    danger: "#B52B48", // PRD error crimson with 5.45:1 contrast on white
    dangerBg: "#FDF2F4",
    dangerFg: "#FFFFFF",
    info: "#0C5A75", // Restrained slate-teal with 6.1:1 contrast on white
    infoBg: "#F0F9FF",
    infoFg: "#FFFFFF",
  },
} as const;

export const semanticColors = {
  // Backgrounds & Canvas
  colorBackground: brandPalette.neutral.background,
  colorBackgroundSubtle: brandPalette.neutral.backgroundSubtle,
  colorSurface: brandPalette.neutral.surface,
  colorSurfaceElevated: brandPalette.neutral.surfaceElevated,
  colorSurfaceDark: brandPalette.neutral.surfaceDark,

  // Brand Actions
  colorBrandPrimary: brandPalette.emerald.primary,
  colorBrandPrimaryHover: brandPalette.emerald.hover,
  colorBrandPrimarySoft: brandPalette.emerald.soft,
  colorBrandPrimaryFg: brandPalette.text.inverse,

  colorBrandAccent: brandPalette.marigold.accent,
  colorBrandAccentHover: brandPalette.marigold.hover,
  colorBrandAccentSoft: brandPalette.marigold.soft,
  colorBrandAccentFg: brandPalette.text.onMarigold, // FORCED DARK TEXT (8.27:1)

  // Typography
  colorTextPrimary: brandPalette.text.primary,
  colorTextSecondary: brandPalette.text.secondary,
  colorTextMuted: brandPalette.text.muted,
  colorTextDisabled: brandPalette.text.disabled,
  colorTextInverse: brandPalette.text.inverse,

  // Borders & Focus
  colorBorder: brandPalette.border.default,
  colorBorderSubtle: brandPalette.border.subtle,
  colorBorderStrong: brandPalette.border.strong,
  colorFocusRing: brandPalette.border.focusRing,

  // Feedback States
  colorSuccess: brandPalette.status.success,
  colorSuccessBg: brandPalette.status.successBg,
  colorSuccessFg: brandPalette.status.successFg,
  colorWarning: brandPalette.status.warning,
  colorWarningBg: brandPalette.status.warningBg,
  colorWarningFg: brandPalette.status.warningFg,
  colorDanger: brandPalette.status.danger,
  colorDangerBg: brandPalette.status.dangerBg,
  colorDangerFg: brandPalette.status.dangerFg,
  colorInfo: brandPalette.status.info,
  colorInfoBg: brandPalette.status.infoBg,
  colorInfoFg: brandPalette.status.infoFg,
} as const;

export const glassTokens = {
  // Translucent glass surfaces (PRD §12.3: 80% white + subtle border + restrained blur)
  background: "rgba(255, 255, 255, 0.80)",
  backgroundElevated: "rgba(255, 255, 255, 0.90)",
  border: "rgba(255, 255, 255, 0.60)",
  borderSubtle: "rgba(231, 226, 214, 0.50)",
  blur: "12px",
  blurSm: "6px",
  // Opaque fallback for devices/browsers without backdrop-filter support
  fallbackBackground: brandPalette.neutral.background,
  fallbackBorder: brandPalette.border.default,
} as const;

export const typography = {
  fonts: {
    sans: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    devanagari: '"Noto Sans Devanagari", "Noto Sans", sans-serif',
    mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
  weights: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  scale: {
    display: {
      fontSize: "clamp(2rem, 5vw, 3rem)", // 32px to 48px
      lineHeight: "1.15",
      letterSpacing: "-0.02em",
      fontWeight: 700,
      description: "Hero landing headers, high-impact marketing titles",
    },
    h1: {
      fontSize: "clamp(1.75rem, 4vw, 2.25rem)", // 28px to 36px
      lineHeight: "1.2",
      letterSpacing: "-0.02em",
      fontWeight: 700,
      description: "Top-level page titles in dashboards and storefronts",
    },
    h2: {
      fontSize: "clamp(1.375rem, 3vw, 1.75rem)", // 22px to 28px
      lineHeight: "1.25",
      letterSpacing: "-0.01em",
      fontWeight: 600,
      description: "Section headings, modal dialog titles",
    },
    h3: {
      fontSize: "clamp(1.125rem, 2vw, 1.25rem)", // 18px to 20px
      lineHeight: "1.3",
      letterSpacing: "-0.01em",
      fontWeight: 600,
      description: "Card titles, subsection dividers, counter table headers",
    },
    h4: {
      fontSize: "1rem", // 16px
      lineHeight: "1.4",
      letterSpacing: "0",
      fontWeight: 600,
      description: "Item titles, form group labels",
    },
    bodyLarge: {
      fontSize: "1.125rem", // 18px
      lineHeight: "1.5",
      letterSpacing: "0",
      fontWeight: 400,
      description: "Lead paragraphs, marketing subheadings",
    },
    body: {
      fontSize: "1rem", // 16px (matches mobile input minimum)
      lineHeight: "1.5",
      letterSpacing: "0",
      fontWeight: 400,
      description: "Standard body text, form input text (prevents iOS auto-zoom)",
    },
    bodySmall: {
      fontSize: "0.875rem", // 14px
      lineHeight: "1.45",
      letterSpacing: "0.01em",
      fontWeight: 400,
      description: "Secondary table cells, metadata, timestamps, helper text",
    },
    caption: {
      fontSize: "0.75rem", // 12px
      lineHeight: "1.4",
      letterSpacing: "0.02em",
      fontWeight: 500,
      description: "Badges, pills, footnote disclaimers, micro-labels",
    },
    overline: {
      fontSize: "0.6875rem", // 11px
      lineHeight: "1.35",
      letterSpacing: "0.06em",
      fontWeight: 700,
      description: "Uppercase category tags, status pill labels",
    },
  },
} as const;

export const spacing = {
  // Base 4px scale
  0: "0",
  1: "0.25rem", // 4px
  2: "0.5rem", // 8px
  3: "0.75rem", // 12px
  4: "1rem", // 16px
  5: "1.25rem", // 20px
  6: "1.5rem", // 24px
  8: "2rem", // 32px
  10: "2.5rem", // 40px
  12: "3rem", // 48px
  16: "4rem", // 64px
  20: "5rem", // 80px
  24: "6rem", // 96px

  // Semantic layout spacing
  layout: {
    pageGutterMobile: "1rem", // 16px for 390px viewport
    pageGutterTablet: "1.5rem", // 24px for 768px viewport
    pageGutterDesktop: "2rem", // 32px for 1024px+
    cardPaddingCompact: "0.75rem", // 12px
    cardPadding: "1rem", // 16px
    cardPaddingComfortable: "1.5rem", // 24px
    sectionGapMobile: "2rem", // 32px
    sectionGapDesktop: "3.5rem", // 56px
  },
} as const;

export const radii = {
  none: "0",
  xs: "0.25rem", // 4px: micro tags, tooltips
  sm: "0.375rem", // 6px: compact sub-controls, inner badges
  md: "0.5rem", // 8px: standard buttons, text inputs, dropdown menus
  lg: "0.75rem", // 12px: cards, dialogue boxes, floating panels
  xl: "1rem", // 16px: large cards, bottom sheet containers
  "2xl": "1.5rem", // 24px: prominent featured hero panels, mascot frames
  full: "9999px", // Full circular pills, avatar badges, round actions
} as const;

export const shadows = {
  none: "none",
  xs: "0 1px 2px rgba(16, 32, 26, 0.04)",
  sm: "0 2px 4px rgba(16, 32, 26, 0.06), 0 1px 2px rgba(16, 32, 26, 0.04)",
  md: "0 4px 8px -2px rgba(16, 32, 26, 0.08), 0 2px 4px -2px rgba(16, 32, 26, 0.04)",
  lg: "0 12px 24px -4px rgba(16, 32, 26, 0.10), 0 4px 8px -2px rgba(16, 32, 26, 0.04)",
  xl: "0 20px 32px -6px rgba(16, 32, 26, 0.14), 0 8px 16px -4px rgba(16, 32, 26, 0.06)",
  glass: "0 8px 24px -4px rgba(11, 110, 79, 0.08), 0 2px 6px -1px rgba(16, 32, 26, 0.04)",
} as const;

export const touchTargets = {
  // WCAG 2.2 Criterion 2.5.8 Target Size Minimum
  minInteractive: "24px",
  // Apple HIG & Android Material preferred touch dimensions
  preferredMobile: "48px",
  // Standard form inputs and primary buttons
  formControlHeight: "44px",
  // Action icon buttons (back, search, close, menu toggle)
  iconButtonSize: "44px",
  // Compact table / list row height for mobile POS & bills
  tableRowHeight: "48px",
} as const;

export const breakpoints = {
  xs: "320px", // Smallest mobile baseline
  sm: "390px", // Primary mobile design validation target
  md: "768px", // Tablet and counter mode
  lg: "1024px", // Desktop dashboard
  xl: "1440px", // Wide display
} as const;

export const motion = {
  duration: {
    fast: "120ms", // Hover, active, micro-press states
    normal: "180ms", // Dropdown reveals, badge state toggles
    dialog: "240ms", // Sheet transitions, modal presentation
  },
  easing: {
    standard: "cubic-bezier(0.2, 0, 0, 1)", // Fluid Apple-inspired deceleration
    inOut: "cubic-bezier(0.4, 0, 0.2, 1)",
    out: "cubic-bezier(0, 0, 0.2, 1)",
  },
} as const;

export const zIndex = {
  base: 0,
  card: 1,
  sticky: 100,
  glassNav: 200,
  dropdown: 300,
  backdrop: 400,
  modal: 500,
  popover: 600,
  toast: 700,
} as const;

export const designTokens = {
  brand: brandPalette,
  semantic: semanticColors,
  glass: glassTokens,
  typography,
  spacing,
  radii,
  shadows,
  touchTargets,
  breakpoints,
  motion,
  zIndex,
} as const;

export type DesignTokens = typeof designTokens;
