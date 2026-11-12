# VyapOne Application Configuration & Environment Architecture

**Task ID:** VO-016  
**Phase:** P1 — Repository, Design System and Application Shell  
**Authority:** `reference/PRD_VERSIONS/PRD_FINAL_v2_2026-11-03.md` (§15.2, §17.3)  
**Status:** Canonical Configuration Architecture Specification  

---

## 1. Architectural Overview & Security Invariants

VyapOne enforces strict, typed, runtime-validated application configuration with absolute compile-time and runtime isolation between **public browser-safe configuration** and **privileged server-only secrets**.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       External Environment Sources                          │
│     • Local: `.env.local` / `.env`                                         │
│     • Cloudflare Pages / Workers: Runtime `context.env` & Dashboard secrets │
│     • Production Container: System Environment Variables                    │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Raw Dictionary
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                 Central Validation Engine (`src/config/env.ts`)              │
│     • Strict Zod Schema Parsing (`publicEnvSchema`, `serverCoreEnvSchema`)  │
│     • Format Validation (URLs, PostgreSQL Protocols, Enums, Port Ranges)   │
│     • Secret-Redacted Error Reporting (`ConfigurationError`)                │
└───────────────────────┬─────────────────────────────────────┬───────────────┘
                        │ Validated                           │ Validated
                        ▼                                     ▼
┌─────────────────────────────────────────┐ ┌─────────────────────────────────┐
│     Public Config (`src/config/public.ts`)│ │ Server Config (`src/config/server.ts`)│
│  • Safe for React Client Components     │ │  • Guarded by `import "server-only"`│
│  • Strict Allowlist of `NEXT_PUBLIC_*`  │ │  • Database URLs, Service Role Keys │
│  • Zero Secret Exposure                 │ │  • Session Secrets, Provider Tokens │
└─────────────────────────────────────────┘ └─────────────────────────────────┘
```

### Core Security Invariants
1. **Zero Secrets in Client Bundles:** Privileged database connection strings, Supabase service-role keys, session encryption secrets, and API keys must NEVER be accessible to client components or bundled into browser assets.
2. **Server-Only Compile-Time Protection:** `src/config/server.ts` imports `server-only`. Any accidental import by a Client Component (`"use client"`) triggers a build-time failure.
3. **No Secret Leakage in Error Logs:** When configuration fails validation, `ConfigurationError` reports the variable name and expected format, but **never prints the actual received value**.
4. **Graceful Local Development:** Missing third-party integration credentials (payments, WhatsApp, AI, storage) do not crash local development; they report `isConfigured: false` safely.

---

## 2. Environment Variable Classification Matrix

### 2.1 Public Configuration (`NEXT_PUBLIC_*`)
Exposed intentionally to browser JavaScript.

| Variable | Type / Format | Default (Dev) | Description |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_APP_ENV` | `"development"` \| `"preview"` \| `"staging"` \| `"production"` \| `"test"` | `"development"` | Current deployment stage. |
| `NEXT_PUBLIC_APP_URL` | Valid URL (`http://` or `https://`) | `http://localhost:3000` | Canonical application base URL. |
| `NEXT_PUBLIC_SUPABASE_URL` | Valid HTTPS URL | `""` | Supabase project URL (`https://<project-ref>.supabase.co`). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | String (JWT) | `""` | Supabase anonymous API key. Safe for browser; enforces PostgreSQL RLS. |

### 2.2 Server-Only Core Configuration (Privileged)
Guarded by `import "server-only"`. Required for production server operation.

| Variable | Type / Format | Production Requirement | Description |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | `"development"` \| `"production"` \| `"test"` | **REQUIRED** | Node runtime environment mode. |
| `PORT` | Integer `1..65535` | Optional (default 3000) | Local HTTP port. |
| `SESSION_SECRET` | String (min 32 characters) | **REQUIRED** | Encryption secret for session cookies and JWT signing. Dev default rejected in prod. |
| `DATABASE_URL` | `postgresql://` or `postgres://` | **REQUIRED** | Supabase transaction pooler or PostgreSQL connection string with RLS context. |
| `DATABASE_DIRECT_URL` | `postgresql://` or `postgres://` | Optional | Direct connection string for Drizzle database migrations and DDL operations. |
| `SUPABASE_SERVICE_ROLE_KEY` | String (min 32 characters) | **REQUIRED** | Privileged backend key. Bypasses RLS. Used exclusively for admin services and background jobs. |

### 2.3 Server-Only Optional Integrations
Third-party integration credentials. Evaluated at runtime with safe `isConfigured: false` fallback.

| Module | Variable(s) | Fallback Behavior |
| :--- | :--- | :--- |
| **Storage** | `STORAGE_ENDPOINT`, `STORAGE_BUCKET`, `STORAGE_REGION`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY` | `storage.isConfigured: false`. Local mock/preview used. |
| **Redis / Queue** | `REDIS_URL` | `redis.isConfigured: false`. In-memory or synchronous mock worker used. |
| **Razorpay** | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | `payments.razorpay.isConfigured: false`. Sandbox payment simulations. |
| **WhatsApp BSP**| `META_WHATSAPP_TOKEN`, `META_WHATSAPP_PHONE_NUMBER_ID`, `META_WHATSAPP_BUSINESS_ACCOUNT_ID`, `META_WEBHOOK_VERIFY_TOKEN` | `whatsapp.isConfigured: false`. Console log / dry-run dispatch. |
| **AI Gateway** | `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` | `ai.isConfigured: false`. Fallback mock assistant replies. |

---

## 3. Local Development Setup

1. Copy the sanitized template:
   ```bash
   cp .env.example .env.local
   ```
2. The default `.env.example` provides safe development values. The application will start and run all route shells, design tokens, and components locally without needing external accounts.
3. To connect to a local or staging Supabase project:
   - Provide `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   - Provide `DATABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

---

## 4. Cloudflare Deployment & Runtime Binding Guidance

Cloudflare is the approved hosting direction for VyapOne. Cloudflare Pages and Workers provide environment variables via runtime context (`context.env`) rather than static Node.js `process.env`.

### 4.1 Local Development with Wrangler
When testing Cloudflare Pages locally via `wrangler pages dev`:
- Store local development secrets in `.dev.vars` (excluded by `.gitignore`).
- Store non-secret build flags in `wrangler.toml` under `[vars]`.

### 4.2 Production Cloudflare Environment Variables
- In the Cloudflare Dashboard, navigate to **Compute (Workers) > Settings > Variables and Secrets**.
- Configure all `NEXT_PUBLIC_*` variables under **Environment Variables**.
- Configure all server secrets (`DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`, API keys) as **Encrypted Secrets**.

### 4.3 Runtime Context Compatibility
The validator function `validateEnvironment(rawEnv?: Record<string, string | undefined>)` in `src/config/env.ts` accepts an explicit dictionary. This allows Cloudflare runtime context bindings (`context.env`) to be passed directly without assuming global `process.env` mutability:

```typescript
// In Cloudflare Pages / Edge Route Handler:
import { getServerConfig } from "@/config/server";

export async function onRequest(context: EventContext<Env, any, any>) {
  const config = getServerConfig(context.env);
  // ...
}
```

---

## 5. Secret-Redacted Error Reporting

If required configuration is missing or malformed, the validator throws `ConfigurationError`.  
Example output:

```
[VyapOne Configuration Error] Missing or invalid environment configuration:
  - DATABASE_URL: Required in production mode. Expected PostgreSQL connection string.
  - SUPABASE_SERVICE_ROLE_KEY: Required in production mode for server database operations and tenant provisioning.
  - SESSION_SECRET: Must be set to a secure, unique 32+ character random secret in production mode.
```

Notice that:
- It specifies which configuration item failed.
- It specifies what was expected.
- It **never prints the invalid secret, token, or password** that was supplied, protecting credentials against accidental leakage into CI logs or monitoring tools.
