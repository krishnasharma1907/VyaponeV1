# ADR-016: Multilingual Localization, Indic Typography and Voice Synthesis

**Date:** 8 November 2026  
**Status:** `NEEDS APPROVAL`  
**Deciders:** Product Owner, Language/Content Lead, Technical Lead  
**Related PRD Requirements:** FR-14, VYA-11, AC-20, AC-25, AC-26  
**Affected Tasks:** `VO-003`, `VO-105`, `VO-106`  

---

## 1. Context and Problem Statement
VyapOne is designed for Indian local business owners and resellers who operate predominantly in Indian regional languages and Hinglish. 
- **PRD FINAL §14 (FR-14) & §6.17:** Launch target is English plus up to 8 Indian languages: Hindi, Marathi, Tamil, Telugu, Bengali, Gujarati, Kannada, Malayalam, and Hinglish for conversational Vya.
- **Voice Interactions:** Vya supports hold-to-talk voice input and synthesized speech responses.
- **Key Invariants:**
  1. User input must never be lost during language switching.
  2. Statutory tax terms, legal contracts, and financial amounts must never be machine-translated without verified review.
  3. Indic scripts must render with clean typography without text clipping or layout overflow.
  4. Audio speech must play only on user tap (zero auto-play) and always display synchronized captions.

---

## 2. Options Considered

### Option 1: Next-Intl / i18next with Noto Sans Indic Fonts + Sarvam AI for Speech (Recommended)
- **UI Localization:** Next-intl or i18next managing centralized JSON translation bundles (`messages/hi.json`, `messages/mr.json`).
- **Typography:** Self-hosted Google Noto Sans Indic fonts (`Noto Sans Devanagari`, `Noto Sans Tamil`, `Noto Sans Telugu`, etc.) loaded via `@next/font` with zero layout shift.
- **Speech-to-Text (STT) & Text-to-Speech (TTS):**
  - Indian regional languages & Hinglish: Sarvam AI STT (Saaras) and TTS (Bulbul) candidate (India-focused speech model).
  - English voice: ElevenLabs Multilingual v2 with the PRD FINAL §6.21 chosen settings (confident-playful male, light robotic sheen, tap-only).

### Option 2: Browser Web Speech API Only
- **Architecture:** Rely exclusively on client-side browser speech recognition. (Rejected: Inconsistent support across low-cost Android browsers, poor Indian accent accuracy).

---

## 3. Comparison of Options

| Criterion | Option 1: i18next + Sarvam / ElevenLabs | Option 2: Browser Web Speech API |
|---|---|---|
| **Indic Script Accuracy & Tone** | **High:** Sarvam models are specifically trained on Indian dialects, accents, and code-mixed Hinglish. | **Poor:** Google/Apple browser engines fail frequently on noisy shop background audio. |
| **Deterministic Financial Translations** | **Safe:** All UI strings, WhatsApp templates, and bill labels are human-reviewed before commit. | N/A |
| **Cross-Platform Reliability** | **Uniform:** Consistent audio stream across Android Chrome, iOS Safari, and Desktop. | Highly fragmented; features disabled on many low-end browsers. |

---

## 4. Architectural Implications

- **Translation Review Gate (AC-26):** No automated machine translation can ship for legal terms, bill formats, or WhatsApp templates without human review.
- **Typography Performance:** Subsetting Noto Sans font files ensures total font payload stays under 80 KB per language.
- **Accessibility & Captions (AC-25):** Every synthesized voice response generates an accompanying transcript displayed in real-time captions. `prefers-reduced-motion` is strictly respected.

---

## 5. Recommendation and Rationale
**Adopt Option 1: i18next with self-hosted Noto Sans Indic typography, Sarvam AI for Indian speech, and ElevenLabs for English Vya.**
- Matches PRD FINAL §6.8, §6.17, §6.21, and §12.4.
- Provides authentic Indian-accent recognition and code-mixed Hinglish processing.

---

## 6. Dependencies & Approval Requirement
- **Dependencies:** Sarvam AI API keys, ElevenLabs API keys, Indic font assets.
- **Approval Requirement:** **Product Owner & Language Lead approval on initial launch language rollout batch (Hindi first vs all 8 languages) and reviewed UI strings.** Marked `NEEDS APPROVAL`.
