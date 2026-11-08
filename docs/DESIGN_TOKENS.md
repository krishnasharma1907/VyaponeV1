# VyapOne Design Tokens Specification

**Status:** CANONICAL IMPLEMENTATION (Task `VO-012`)  
**Phase:** P1 — Repository, Design System and Application Shell  
**Authority:** `reference/PRD_VERSIONS/PRD_FINAL_v2_2026-11-03.md` (Section 12: Visual Design System)  
**Implementation Source:** [`src/design-system/tokens.ts`](file:///f:/VyaponeV2/src/design-system/tokens.ts) and [`src/app/globals.css`](file:///f:/VyaponeV2/src/app/globals.css)

---

## 1. Brand Identity and Visual Direction

VyapOne uses an original **Emerald + Marigold** visual system rooted in everyday Indian business operations with Apple-inspired principles of clarity, depth, material, responsive motion, and restraint.

- **Product Name:** VyapOne
- **Brand Line:** *"Every business. One platform."*
- **AI Assistant:** Vya (Mascot Design H1: floating green speech-bubble robot with marigold antenna dot and kurta collar)
- **Palette Ratio:** Approximately 60% warm background canvas, 30% emerald green structures, 10% marigold accents.
- **Glassmorphism:** Light-first translucent materials (80% white opacity with 12px blur) for framing and navigation, with solid fallbacks for forms, tables, transaction states, and unsupported browsers.

---

## 2. Token Architecture & Naming Conventions

Tokens are defined centrally in TypeScript ([`src/design-system/tokens.ts`](file:///f:/VyaponeV2/src/design-system/tokens.ts)) and exposed globally via CSS custom properties ([`src/app/globals.css`](file:///f:/VyaponeV2/src/app/globals.css)).

### Naming Structure
- **Primitive Palette:** `--color-{family}-{variant}` (e.g. `--color-emerald-primary`, `--color-marigold-accent`)
- **Semantic Usage:** `--color-{role}` (e.g. `--color-brand-primary`, `--color-brand-accent`, `--color-background`, `--color-surface`, `--color-border`)
- **Semantic Foreground:** `--color-{role}-fg` (e.g. `--color-brand-primary-fg`, `--color-brand-accent-fg`)
- **Typography:** `--font-{family}`, `--font-size-{level}`, `--line-height-{level}`
- **Spacing:** `--space-{step}` (based on 4px grid)
- **Touch Targets:** `--target-{purpose}`
- **Glass Materials:** `--glass-{property}`

---

## 3. Color Tokens

### 3.1 Brand Palette
| Token | HEX / Value | Role |
| :--- | :--- | :--- |
| `--color-emerald-primary` | `#0B6E4F` | Primary actions, links, active tab indicator, logo green |
| `--color-emerald-hover` | `#095C42` | Hover / pressed state of primary actions |
| `--color-emerald-deep` | `#0A3D2E` | Deep green for dark hero banners and footer sections |
| `--color-emerald-forest` | `#0F5132` | PWA chrome themeColor (mobile browser bar) |
| `--color-emerald-soft` | `#E8F5EE` | Soft emerald background for active items / positive badges |
| `--color-marigold-accent` | `#F5A524` | Rare high-priority CTA (e.g. "New Bill", "Join waitlist") |
| `--color-marigold-hover` | `#D97706` | Hover / pressed state for marigold buttons |
| `--color-marigold-deep` | `#B45309` | Deep amber for warnings and high-contrast borders |
| `--color-marigold-soft` | `#FEF3C7` | Soft amber tint for alert containers |

### 3.2 Canvas & Surfaces
| Token | Value | Role |
| :--- | :--- | :--- |
| `--color-background` | `#FAF8F3` | Warm white main canvas (60% visual surface) |
| `--color-background-subtle` | `#F4F0E6` | Subtle container background for sidebars and section bands |
| `--color-surface` | `#FFFFFF` | Cards, forms, tables, transaction sheets, dense data |
| `--color-surface-elevated` | `#FFFFFF` | Modals, popovers, dropdown menus |
| `--color-surface-dark` | `#0A3D2E` | Dark hero and footer canvas |

### 3.3 Semantic Typography
| Token | HEX / Value | Role |
| :--- | :--- | :--- |
| `--color-text-primary` | `#10201A` | Headings and primary body copy (15.9:1 contrast) |
| `--color-text-secondary` | `#5B6B63` | Supporting metadata, timestamps, subtitles (5.31:1 contrast) |
| `--color-text-muted` | `#788880` | Field placeholders, inactive hints |
| `--color-text-disabled` | `#A3B0A9` | Disabled text |
| `--color-text-inverse` | `#FFFFFF` | White text on emerald or dark surfaces (6.25:1 contrast) |
| `--color-text-on-marigold` | `#10201A` | **FORCED:** Dark text on marigold (8.27:1 contrast) |

> [!CAUTION]
> **Strict Accessibility Invariant:** White text on marigold (`#FFFFFF` on `#F5A524`) calculates to **2.04:1** and is **STRICTLY FORBIDDEN**. All marigold buttons, tags, and highlights must use `--color-brand-accent-fg` (`#10201A`).

### 3.4 Semantic Feedback States
| State | Indicator | Foreground | Background | Minimum WCAG Ratio |
| :--- | :--- | :--- | :--- | :--- |
| **Success** | `--color-success` (`#0B6E4F`) | `#FFFFFF` | `#E8F5EE` | 6.25:1 |
| **Warning** | `--color-warning` (`#B45309`) | `#FFFFFF` | `#FFFBEB` | 5.60:1 |
| **Danger / Error** | `--color-danger` (`#B52B48`) | `#FFFFFF` | `#FDF2F4` | 6.17:1 |
| **Information** | `--color-info` (`#0C5A75`) | `#FFFFFF` | `#F0F9FF` | 6.10:1 |

---

## 4. Glassmorphism System

Per PRD §12.3, glass is reserved for framing, navigation, and Vya assistance, avoiding dense transactional data.

| Token | CSS Value | Purpose |
| :--- | :--- | :--- |
| `--glass-bg` | `rgba(255, 255, 255, 0.80)` | 80% translucent white surface |
| `--glass-bg-elevated`| `rgba(255, 255, 255, 0.90)` | 90% translucent white modal surface |
| `--glass-border` | `rgba(255, 255, 255, 0.60)` | Subtle specular border highlight |
| `--glass-blur` | `12px` | Primary backdrop blur filter |
| `--glass-blur-sm` | `6px` | Compact backdrop blur for toolbars |
| `--glass-shadow` | `0 8px 24px -4px rgba(11, 110, 79, 0.08)` | Emerald-tinted ambient glass shadow |
| `--glass-fallback-bg` | `#FAF8F3` | Opaque fallback canvas when `backdrop-filter` is unsupported |

---

## 5. Typography Scale

Input fields and body copy enforce a **16px minimum** to eliminate auto-zoom on mobile iOS devices.

| Level | Size | Line Height | Letter Spacing | Weight | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `display` | `clamp(2rem, 5vw, 3rem)` | 1.15 | -0.02em | 700 | Hero landing titles |
| `h1` | `clamp(1.75rem, 4vw, 2.25rem)` | 1.20 | -0.02em | 700 | Top-level page titles |
| `h2` | `clamp(1.375rem, 3vw, 1.75rem)` | 1.25 | -0.01em | 600 | Section headers |
| `h3` | `clamp(1.125rem, 2vw, 1.25rem)` | 1.30 | -0.01em | 600 | Card titles, modal headers |
| `h4` | `1rem` (16px) | 1.40 | 0 | 600 | Item labels, subsection titles |
| `body-lg` | `1.125rem` (18px) | 1.50 | 0 | 400 | Marketing leads |
| `body` | `1rem` (16px) | 1.50 | 0 | 400 | Standard copy, input fields |
| `body-sm` | `0.875rem` (14px) | 1.45 | 0.01em | 400 | Table cells, secondary copy |
| `caption` | `0.75rem` (12px) | 1.40 | 0.02em | 500 | Badges, pills, metadata |
| `overline`| `0.6875rem` (11px) | 1.35 | 0.06em | 700 | Uppercase category tags |

---

## 6. Spacing Scale (4px Base Grid)

| Token | CSS Value | Pixels | Usage |
| :--- | :--- | :--- | :--- |
| `--space-1` | `0.25rem` | 4px | Micro gap, icon-to-label spacing |
| `--space-2` | `0.5rem` | 8px | Badge padding, compact element spacing |
| `--space-3` | `0.75rem` | 12px | Form field inner padding, button gap |
| `--space-4` | `1rem` | 16px | Standard component gap, card padding (mobile) |
| `--space-5` | `1.25rem` | 20px | Card padding (comfortable) |
| `--space-6` | `1.5rem` | 24px | Section inner gap, grid spacing |
| `--space-8` | `2rem` | 32px | Component block separation |
| `--space-10`| `2.5rem` | 40px | Mobile section separation |
| `--space-12`| `3rem` | 48px | Desktop section separation |
| `--space-16`| `4rem` | 64px | Page hero vertical separation |

---

## 7. Radii & Shadows

### Radii
- `--radius-xs` (4px): micro tags, tooltips
- `--radius-sm` (6px): inner badges, sub-controls
- `--radius-md` (8px): standard buttons, form inputs, select menus
- `--radius-lg` (12px): cards, dialogue containers, floating panels
- `--radius-xl` (16px): large cards, bottom sheet containers
- `--radius-2xl` (24px): featured containers, mascot frame
- `--radius-full` (9999px): circular pills, round icon actions

### Shadows
- `--shadow-xs`: `0 1px 2px rgba(16, 32, 26, 0.04)` (subtle divider)
- `--shadow-sm`: `0 2px 4px rgba(16, 32, 26, 0.06), 0 1px 2px rgba(16, 32, 26, 0.04)` (standard card)
- `--shadow-md`: `0 4px 8px -2px rgba(16, 32, 26, 0.08)` (dropdowns, popovers)
- `--shadow-lg`: `0 12px 24px -4px rgba(16, 32, 26, 0.10)` (floating panels, bottom sheets)
- `--shadow-xl`: `0 20px 32px -6px rgba(16, 32, 26, 0.14)` (modal dialogs)

---

## 8. Touch Target Standards (WCAG 2.2 AA & Mobile Ergonomics)

| Token | Dimension | Standard / Specification |
| :--- | :--- | :--- |
| `--target-min` | `24px` | WCAG 2.2 AA Criterion 2.5.8 Target Size Minimum |
| `--target-mobile-preferred` | `48px` | Apple HIG & Android Material touch target standard |
| `--target-control-height` | `44px` | Standard button and input interactive height |
| `--target-icon-button` | `44px` | Navigation, back, close, search icon touch area |
| `--target-table-row` | `48px` | Mobile POS bill item row height for reliable tapping |

---

## 9. Contrast Validation Matrix (Automated Vitest Suite)

Calculated via [`src/design-system/contrast.ts`](file:///f:/VyaponeV2/src/design-system/contrast.ts) and verified in [`tests/unit/tokens/contrast.test.ts`](file:///f:/VyaponeV2/tests/unit/tokens/contrast.test.ts):

| Foreground | Background | Calculated Ratio | WCAG 2.2 AA Required | Status |
| :--- | :--- | :--- | :--- | :--- |
| `#FFFFFF` (White) | `#0B6E4F` (Emerald Primary) | **6.25:1** | $\ge 4.5:1$ | **PASS** |
| `#10201A` (Dark Text) | `#F5A524` (Marigold Accent) | **8.27:1** | $\ge 4.5:1$ | **PASS** |
| `#10201A` (Dark Text) | `#FAF8F3` (Warm Background) | **15.90:1** | $\ge 4.5:1$ (Meets AAA) | **PASS** |
| `#5B6B63` (Secondary) | `#FAF8F3` (Warm Background) | **5.31:1** | $\ge 4.5:1$ | **PASS** |
| `#F5A524` (Marigold Accent) | `#0A3D2E` (Deep Green) | **5.98:1** | $\ge 4.5:1$ | **PASS** |
| `#B52B48` (Danger Crimson) | `#FFFFFF` (White Surface) | **6.17:1** | $\ge 4.5:1$ | **PASS** |
| `#FFFFFF` (White) | `#B52B48` (Danger Crimson) | **6.17:1** | $\ge 4.5:1$ | **PASS** |
| `#FFFFFF` (White) | `#B45309` (Warning Amber) | **5.60:1** | $\ge 4.5:1$ | **PASS** |
| `#FFFFFF` (White) | `#0C5A75` (Info Teal) | **6.10:1** | $\ge 4.5:1$ | **PASS** |
| `#FFFFFF` (White) | `#F5A524` (Marigold Accent) | **2.04:1** | $< 4.5:1$ | **FORBIDDEN (FAIL)** |

---

## 10. How Future Components Should Consume Tokens

1. **CSS Modules & Global CSS:**
   ```css
   .primaryButton {
     min-height: var(--target-control-height);
     padding: 0 var(--space-4);
     background-color: var(--color-brand-primary);
     color: var(--color-brand-primary-fg);
     border-radius: var(--radius-md);
   }
   ```
2. **TypeScript / Inline Styles:**
   ```tsx
   import { semanticColors, touchTargets, radii } from "@/design-system";

   <button style={{
     minHeight: touchTargets.formControlHeight,
     backgroundColor: semanticColors.colorBrandAccent,
     color: semanticColors.colorBrandAccentFg, // Ensures dark text
     borderRadius: radii.md,
   }}>
     New Bill
   </button>
   ```
3. **Tailwind CSS Integration (When Installed):**
   Tokens directly map to Tailwind theme extensions (`colors: { brand: { primary: 'var(--color-brand-primary)' } }`).
