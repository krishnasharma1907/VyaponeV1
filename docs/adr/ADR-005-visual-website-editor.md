# ADR-005: Constrained Visual Website Editor

**Date:** 8 November 2026  
**Status:** `PROPOSED`  
**Deciders:** Technical Lead  
**Related PRD Requirements:** FR-05, FR-06, NFR-PERF-01, AC-06, AC-07  
**Affected Tasks:** `VO-003`, `VO-044`, `VO-045`, `VO-047`  

---

## 1. Context and Problem Statement
VyapOne websites are assembled from approved, validated component blocks (hero, menu/catalog grid, services, gallery, booking form, pricing, reviews, offers, about, map, FAQ, footer). The platform requires a visual website editor operable on a mobile phone (390 px) and desktop, allowing non-technical resellers and owners to reorder sections, edit text, toggle blocks, and customize approved themes.

A critical invariant (PRD FINAL §15.3) is: **AI and the visual editor assemble blocks; they never write, inject, or execute arbitrary code.** The editor must produce and manipulate a versioned, structured JSON schema (`WebsiteConfig`).

---

## 2. Options Considered

### Option 1: Puck Editor adapted to Constrained VyapOne Component Library (Candidate in PRD FINAL §15.1, §15.3)
- **Architecture:** Open-source React visual editor (Puck). We configure Puck with a strictly closed set of approved block definitions, strict Zod property validation schemas, and a custom mobile-first drawer UI for small viewports (390 px).
- **Output:** Clean, serialized JSON configuration conforming to VyapOne's versioned `WebsiteConfig` schema.

### Option 2: Custom In-House React Drag-and-Drop Editor
- **Architecture:** Built from scratch using `@hello-pangea/dnd` or `@dnd-kit` and custom form drawers.
- **Output:** Custom JSON structure.

### Option 3: Heavy Headless CMS Visual Builder (GrapesJS / Builder.io / TinaCMS)
- **Architecture:** Generic web page builder toolkits.

---

## 3. Comparison of Options

| Criterion | Option 1: Puck Adapted | Option 2: Custom In-House Editor | Option 3: GrapesJS / Builder.io |
|---|---|---|---|
| **JSON-First & No Raw HTML/Code Injection** | **Native:** Puck is 100% structured data driven; components are React blocks defined by us. | **Native:** Complete control. | **Poor:** Designed for arbitrary HTML/CSS strings; prone to code injection. |
| **Mobile 390px Usability** | **Good with tuning:** Requires custom mobile drawer adaptation for property panels. | **High:** Designed from day one for mobile touch. | **Very Poor:** Heavy desktop-oriented sidebars; unusable on mobile screens. |
| **Development Time & Maintenance** | **Fast:** Proven open-source state management, undo/redo, and drag-and-drop mechanics. | **Very Slow:** Re-implementing undo/redo, tree manipulation, drag-and-drop, and preview synchronization takes weeks. | **Moderate:** High integration overhead. |
| **Schema Validation & Vya Interop** | **Seamless:** Vya outputs JSON matching Puck component props; Puck renders it instantly. | **Good:** Requires custom parser. | **Complex:** Mismatched data models. |

---

## 4. Architectural Implications

- **Security (Anti-XSS):** Because Puck maps JSON props to compiled React components, users and AI cannot inject `<script>` tags, arbitrary HTML, or malicious iframes. All string inputs are sanitized.
- **Autosave & Undo/Redo:** Puck provides built-in undo/redo state stacks. Edits trigger debounced autosave (`VO-047`) to persistent database draft tables.
- **Responsive Viewport Preview:** Editor interface embeds an isolated iframe with switchable device containers (320px, 390px, 768px, 1024px, 1440px) matching the public website renderer.

---

## 5. Vendor Lock-in & Portability
Puck is open-source (MIT license) and outputs a pure JSON AST. The stored site JSON is completely independent of Puck and can be rendered by any React component pipeline without Puck loaded in the runtime bundle.

---

## 6. Recommendation and Rationale
**Adopt Option 1: Puck Editor adapted to VyapOne's constrained component model.**
- Exactly aligns with PRD FINAL §15.1 and §15.3.
- Guarantees sites never break, load fast, and remain mobile-responsive.
- Avoids reinventing drag-and-drop, history stacks, and selection state machinery.

---

## 7. Dependencies & Reversal Strategy
- **Dependencies:** React 19, Puck (`@measured/puck`), Zod component prop schemas.
- **Reversal Strategy:** The persistent data format is our own versioned `WebsiteConfig` JSON. If Puck is ever replaced, only the editor UI layer changes; all stored websites and public renderers remain untouched.
- **Approval Requirement:** Technical Lead & UX Review. Marked `PROPOSED`.
