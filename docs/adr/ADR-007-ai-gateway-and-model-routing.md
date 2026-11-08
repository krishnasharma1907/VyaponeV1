# ADR-007: AI Gateway, Multi-Model Routing and Token Budgets

**Date:** 8 November 2026  
**Status:** `PROPOSED`  
**Deciders:** Technical Lead  
**Related PRD Requirements:** FR-04, FR-19, FR-20, VYA-01 to VYA-13, AC-04, AC-20, AC-21  
**Affected Tasks:** `VO-003`, `VO-050`, `VO-051`, `VO-052`, `VO-058`  

---

## 1. Context and Problem Statement
Vya is the platform AI assistant serving two primary personas:
1. **The Builder:** Generating structured proposals and JSON site configurations from onboarding conversations.
2. **The Daily Business Helper:** Answering owner queries about sales/bills/stock, scheduling daily briefings, drafting review replies, and running the WhatsApp customer bot.

PRD FINAL §6.8 explicitly mandates a **multi-model routing architecture**:
- **Primary Model:** Anthropic Claude 3.5 / 5.5 Sonnet (for complex multi-turn proposals, block generation, and nuanced Hindi/English conversation).
- **Fallback Model:** Google Gemini 1.5 / 2.0 Flash (automatic zero-downtime failover if primary errors or times out).
- **Small / Fast Tasks:** Claude 3.5 Haiku / Gemini Flash-Lite (for quick summaries, classification, intent extraction, and draft review replies).
- **Indian Speech & Languages:** Sarvam AI (candidate for Indic STT/TTS and Hindi/Hinglish speech synthesis).

We need an AI gateway architecture that provides unified function calling, streaming responses, provider failover, token budget enforcement, and strict prompt-injection defenses.

---

## 2. Options Considered

### Option 1: Vercel AI SDK + Provider-Neutral AI Gateway Layer (Recommended in PRD FINAL §6.22, §15.1)
- **Framework:** Vercel AI SDK (`ai` package) with `@ai-sdk/anthropic` and `@ai-sdk/google`.
- **Gateway Abstraction:** An in-house `AiGatewayService` that wraps model calls with:
  1. Pre-call budget and rate-limit check per reseller plan.
  2. Input sanitization (untrusted text treated as data, zero prompt injection).
  3. Automatic circuit-breaker failover: if Claude fails or exceeds 2.5s, transparently retry with Gemini Flash.
  4. Response streaming (`streamText`) directly to client components.
  5. Structured outputs (`generateObject`) validated with Zod schemas.

### Option 2: Third-Party Managed LLM Gateway (Portkey / LiteLLM / Helicone)
- **Architecture:** Route all model requests through an external proxy service.

### Option 3: Direct Anthropic and Google SDKs without Unified Framework
- **Architecture:** Bespoke wrappers calling official REST APIs directly.

---

## 3. Comparison of Options

| Criterion | Option 1: Vercel AI SDK In-House Gateway | Option 2: Portkey / LiteLLM Proxy | Option 3: Bespoke SDK Wrappers |
|---|---|---|---|
| **Streaming & React 19 UI Binding** | **Native:** Built-in hooks (`useChat`, `useCompletion`, RSC streaming). | **Moderate:** Requires custom streaming adapters. | **Complex:** Re-implementing SSE streaming and cancellation logic. |
| **Tool Calling & Schema Validation** | **First-Class:** Zod schemas passed directly to model tool definitions; strict JSON enforcement. | **Good:** Standard function calling. | **Manual:** Manual parsing and schema validation. |
| **Data Privacy & DPDP Compliance** | **Highest:** Direct API connection to models; zero intermediate third-party logging proxy storing prompt PII. | **Privacy Risk:** External proxy intercepts and logs all customer/owner prompts. | **High:** Direct API connection. |
| **Cost & Latency Overhead** | **Zero extra cost;** zero added network hop. | Added latency per request + per-request SaaS subscription cost. | Zero extra cost, but high maintenance. |

---

## 4. Architectural Implications

- **Latency Targets (NFR-PERF-03, AC-20):** First token streaming must start in under 2.0 seconds. Streaming ensures the user perceives an immediate response while tool calls execute asynchronously.
- **Failover Logic:** If Claude Sonnet returns HTTP 429, 500, or times out after 2500ms, the router falls back to Gemini Flash with the identical tool definition and conversation history without raising a user-facing error.
- **Safety & Confirm-Before-Act (AC-21):** Vya tools are partitioned into `READ_ONLY` (executed immediately) and `MUTATION` (returns a `PendingAction` preview token requiring explicit user tap in UI). Vya never executes writes directly.
- **Budget Enforcer:** Reseller plan allowances (e.g. Starter: 50k tokens/mo) are tracked in Redis. When allowance reaches 90%, warning notifications fire; at 100%, operations fall back to manual form editing until recharge.

---

## 5. Vendor Lock-in & Portability
The `AiGatewayService` isolates all vendor-specific headers and SDKs behind standard TypeScript interfaces. Switching between Anthropic, Google Gemini, OpenAI, or local Indian models (Sarvam / Krutrim) requires only updating model config parameters.

---

## 6. Recommendation and Rationale
**Adopt Option 1: Vercel AI SDK integrated into an in-house provider-neutral AI Gateway Service.**
- Directly implements the multi-model routing and latency criteria mandated in PRD FINAL §6.8 and §6.19.
- Guarantees zero third-party proxy data retention under India's DPDP Act 2023.
- Native integration with Next.js streaming and React Server Components.

---

## 7. Dependencies & Reversal Strategy
- **Dependencies:** API keys for Anthropic (Claude Sonnet 3.5/5.5, Haiku) and Google AI Studio / Vertex (Gemini Flash), Sarvam AI credentials for speech.
- **Reversal Strategy:** All AI calls go through `IAiService.generateStructured()` and `IAiService.streamConversation()`. Model providers can be swapped with zero change to Vya prompts or tool schemas.
- **Approval Requirement:** Technical Lead & AI Budget Owner. Marked `PROPOSED`.
