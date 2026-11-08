# VyapOne Design Tokens Specification

**Status:** CANONICAL IMPLEMENTATION (Task `VO-012` Corrective Audit & Verification)  
**Phase:** P1 — Repository, Design System and Application Shell  
**Authority:** `reference/PRD_VERSIONS/PRD_FINAL_v2_2026-11-03.md` (Section 12: Visual Design System) & `docs/QUALITY_GATES.md`  
**Implementation Source:** [`src/design-system/tokens.ts`](file:///f:/VyaponeV2/src/design-system/tokens.ts) and [`src/app/globals.css`](file:///f:/VyaponeV2/src/app/globals.css)

---

## 1. Brand Identity and Visual Direction

VyapOne uses an original **Emerald + Marigold** visual system rooted in everyday Indian business operations with Apple-inspired principles of clarity, depth, material, responsive motion, and restraint.

- **Product Name:** VyapOne
- **Brand Line:** *"Every business. One platform."*
- **AI Assistant:** Vya (Mascot Design H1: floating green speech-bubble robot with marigold antenna dot and kurta collar)
- **Established Brand Palette:**
  - **Canonical Brand Emerald:** `#0F5132` (Deep Forest Emerald — established corporate brand mark, PWA browser themeColor)
  - **Canonical Brand Marigold:** `#D97706` (Deep Marigold — established warm brand accent)
- **UI Operational Palette (PRD Section 12.2):**
  - **UI Action Emerald:** `#0B6E4F` (Primary action green, selection, active state, links)
  - **UI Accent Marigold:** `#F5A524` (High-priority action highlight, "New Bill", "Waitlist", always paired with dark text `#10201A`)
  - **UI Deep Green:** `#0A3D2E` (Dark hero and footer canvas)
- **Palette Ratio:** Approximately 60% warm background canvas, 30% emerald green structures, 10% marigold accents.
- **Glassmorphism:** Light-first translucent materials (80% white opacity with 12px blur) for framing and navigation, with solid fallbacks for forms, tables, transaction states, and unsupported browsers.

---

## 2. Token Architecture & Naming Conventions

Tokens are defined centrally in TypeScript ([`src/design-system/tokens.ts`](file:///f:/VyaponeV2/src/design-system/tokens.ts)) and exposed globally via CSS custom properties ([`src/app/globals.css`](file:///f:/VyaponeV2/src/app/globals.css)).

### Naming Structure
- **Canonical Brand:** `--color-brand-emerald`, `--color-brand-marigold`
- **Canonical Foreground:** `--color-brand-emerald-fg`, `--color-brand-marigold-fg`
- **UI Primitive Palette:** `--color-{family}-{variant}` (e.g. `--color-emerald-primary`, `--color-marigold-accent`)
- **Semantic Usage:** `--color-{role}` (e.g. `--color-brand-primary`, `--color-brand-accent`, `--color-background`, `--color-surface`, `--color-border`)
- **Semantic Foreground:** `--color-{role}-fg` (e.g. `--color-brand-primary-fg`, `--color-brand-accent-fg`)
- **Typography:** `--font-{family}`, `--font-size-{level}`, `--line-height-{level}`
- **Spacing:** `--space-{step}` (based on 4px grid)
- **Touch Targets:** `--target-{purpose}`
- **Glass Materials:** `--glass-{property}`

---

## 3. Color Tokens

### 3.1 Canonical Brand & UI Action Palette
| Token | HEX / Value | Role |
| :--- | :--- | :--- |
| `--color-brand-emerald` | `#0F5132` | **Canonical Brand Emerald:** Corporate brand mark, mobile browser themeColor (9.36:1 AAA) |
| `--color-brand-emerald-fg`| `#FFFFFF` | Accessible white text on canonical brand emerald |
| `--color-brand-marigold`| `#D97706` | **Canonical Brand Marigold:** Established warm brand accent (5.30:1 AA with dark text) |
| `--color-brand-marigold-fg`| `#10201A` | Accessible dark text on canonical brand marigold |
| `--color-emerald-primary` | `#0B6E4F` | **UI Action Emerald:** PRD §12.2 primary CTAs, links, active tab indicators (6.25:1 AA) |
| `--color-emerald-hover` | `#095C42` | Hover / pressed state of primary actions |
| `--color-emerald-deep` | `#0A3D2E` | Deep green for dark hero banners and footer sections |
| `--color-emerald-soft` | `#E8F5EE` | Soft emerald background for active items / positive badges |
| `--color-marigold-accent` | `#F5A524` | **UI Accent Marigold:** PRD §12.2 rare high-priority CTA (e.g. "New Bill", "Waitlist") |
| `--color-marigold-hover` | `#D97706` | Hover / pressed state for marigold buttons (aligns with canonical brand marigold) |
| `--color-marigold-deep` | `#B45309` | Deep amber for warning indicators and borders (5.02:1 AA with white) |
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
| Token | HEX / Value | Role | Contrast Ratio |
| :--- | :--- | :--- | :--- |
| `--color-text-primary` | `#10201A` | Headings and primary body copy on canvas | **15.91:1** (AAA) |
| `--color-text-secondary` | `#5B6B63` | Supporting metadata, timestamps, subtitles on canvas | **5.31:1** (AA) |
| `--color-text-muted` | `#788880` | Field placeholders, inactive hints | — |
| `--color-text-disabled` | `#A3B0A9` | Disabled text | — |
| `--color-text-inverse` | `#FFFFFF` | White text on emerald or dark surfaces | **6.25:1** (AA) |
| `--color-text-on-marigold` | `#10201A` | **FORCED:** Dark text on marigold (`#F5A524` / `#D97706`) | **8.27:1** / **5.30:1** (AA) |

> [!CAUTION]
> **Strict Accessibility Invariant:** White text on UI Accent Marigold (`#FFFFFF` on `#F5A524`) calculates to **2.04:1** and is **STRICTLY FORBIDDEN**. White text on Brand Marigold (`#FFFFFF` on `#D97706`) calculates to **3.19:1** (fails normal text 4.5:1). All marigold buttons, tags, and highlights must use `--color-brand-accent-fg` / `--color-brand-marigold-fg` (`#10201A`).

### 3.4 Semantic Feedback States
| State | Indicator | Foreground | Background | Recalculated Contrast Ratio | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Success** | `--color-success` (`#0B6E4F`) | `#FFFFFF` | `#E8F5EE` | **6.25:1** | PASS (AA) |
| **Warning** | `--color-warning` (`#B45309`) | `#FFFFFF` | `#FFFBEB` | **5.02:1** | PASS (AA) |
| **Danger / Error** | `--color-danger` (`#B52B48`) | `#FFFFFF` | `#FDF2F4` | **6.17:1** | PASS (AA) |
| **Information** | `--color-info` (`#0C5A75`) | `#FFFFFF` | `#F0F9FF` | **7.68:1** | PASS (AAA) |

*Note on recalculation:* Earlier documentation cited Warning as 5.60:1 and Info as 6.10:1. Independent mathematical recalculation using the standard WCAG relative luminance formula yields exact ratios of **5.02:1** for White on `#B45309` and **7.68:1** for White on `#0C5A75`. Both exceed the 4.5:1 AA threshold.

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

| Foreground | Background | Calculated Ratio | WCAG 2.2 Level | Status |
| :--- | :--- | :--- | :--- | :--- |
| `#FFFFFF` (White) | `#0F5132` (Canonical Brand Emerald) | **9.36:1** | $\ge 7.0:1$ (Meets AAA) | **PASS** |
| `#10201A` (Dark Text) | `#D97706` (Canonical Brand Marigold) | **5.30:1** | $\ge 4.5:1$ (Normal Text AA) | **PASS** |
| `#FFFFFF` (White) | `#D97706` (Canonical Brand Marigold) | **3.19:1** | $< 4.5:1$ (Fails normal, passes $\ge 3:1$ large text) | **LARGE TEXT ONLY** |
| `#FFFFFF` (White) | `#0B6E4F` (UI Action Emerald) | **6.25:1** | $\ge 4.5:1$ (Normal Text AA) | **PASS** |
| `#10201A` (Dark Text) | `#F5A524` (UI Accent Marigold) | **8.27:1** | $\ge 4.5:1$ (Normal Text AA) | **PASS** |
| `#10201A` (Dark Text) | `#FAF8F3` (Warm Background) | **15.91:1** | $\ge 7.0:1$ (Meets AAA) | **PASS** |
| `#5B6B63` (Secondary) | `#FAF8F3` (Warm Background) | **5.31:1** | $\ge 4.5:1$ (Normal Text AA) | **PASS** |
| `#F5A524` (UI Accent Marigold) | `#0A3D2E` (Deep Green) | **5.98:1** | $\ge 4.5:1$ (Normal Text AA) | **PASS** |
| `#D97706` (Brand Marigold) | `#0A3D2E` (Deep Green) | **3.83:1** | $\ge 3.0:1$ (Large Text & UI AA) | **PASS** |
| `#B52B48` (Danger Crimson) | `#FFFFFF` (White Surface) | **6.17:1** | $\ge 4.5:1$ (Normal Text AA) | **PASS** |
| `#FFFFFF` (White) | `#B52B48` (Danger Crimson) | **6.17:1** | $\ge 4.5:1$ (Normal Text AA) | **PASS** |
| `#FFFFFF` (White) | `#B45309` (Warning Amber) | **5.02:1** | $\ge 4.5:1$ (Normal Text AA) | **PASS** |
| `#FFFFFF` (White) | `#0C5A75` (Info Slate-Teal) | **7.68:1** | $\ge 7.0:1$ (Meets AAA) | **PASS** |
| `#FFFFFF` (White) | `#F5A524` (UI Accent Marigold) | **2.04:1** | $< 4.5:1$ | **FORBIDDEN (FAIL)** |

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
