import { publicEnvSchema, type PublicEnvInput } from "./env";

/**
 * Public Client-Safe Configuration
 *
 * This module is safe to import in React Client Components ("use client")
 * and server components alike. It strictly extracts only allowlisted
 * `NEXT_PUBLIC_*` configuration parameters.
 *
 * PRIVILEGED SECRETS, DATABASE PASSWORDS, SERVICE ROLE KEYS, AND THIRD-PARTY
 * API KEYS MUST NEVER BE ADDED TO THIS MODULE.
 */

// Allowlist of safe public environment keys
const ALLOWED_PUBLIC_KEYS = [
  "NEXT_PUBLIC_APP_ENV",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

type AllowedPublicKey = (typeof ALLOWED_PUBLIC_KEYS)[number];

function extractPublicEnv(): Record<AllowedPublicKey, string | undefined> {
  return {
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

const parsed = publicEnvSchema.parse(extractPublicEnv());

export interface PublicConfig {
  readonly appEnv: "development" | "preview" | "staging" | "production" | "test";
  readonly appUrl: string;
  readonly supabaseUrl: string;
  readonly supabaseAnonKey: string;
  readonly isSupabaseConfigured: boolean;
  readonly isProduction: boolean;
  readonly isDevelopment: boolean;
  readonly isTest: boolean;
}

export const publicConfig: PublicConfig = {
  appEnv: parsed.NEXT_PUBLIC_APP_ENV,
  appUrl: parsed.NEXT_PUBLIC_APP_URL,
  supabaseUrl: parsed.NEXT_PUBLIC_SUPABASE_URL || "",
  supabaseAnonKey: parsed.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  isSupabaseConfigured: Boolean(
    parsed.NEXT_PUBLIC_SUPABASE_URL && parsed.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  ),
  isProduction: parsed.NEXT_PUBLIC_APP_ENV === "production",
  isDevelopment: parsed.NEXT_PUBLIC_APP_ENV === "development",
  isTest: parsed.NEXT_PUBLIC_APP_ENV === "test",
};

/**
 * Helper to validate a custom public environment record (useful for testing or Cloudflare runtime context).
 */
export function getPublicConfig(
  rawEnv: Record<string, string | undefined> = process.env,
): PublicConfig {
  const customExtract: Record<string, string | undefined> = {};
  for (const key of ALLOWED_PUBLIC_KEYS) {
    customExtract[key] = rawEnv[key];
  }
  const result = publicEnvSchema.parse(customExtract) as PublicEnvInput;

  return {
    appEnv: result.NEXT_PUBLIC_APP_ENV,
    appUrl: result.NEXT_PUBLIC_APP_URL,
    supabaseUrl: result.NEXT_PUBLIC_SUPABASE_URL || "",
    supabaseAnonKey: result.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    isSupabaseConfigured: Boolean(
      result.NEXT_PUBLIC_SUPABASE_URL && result.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ),
    isProduction: result.NEXT_PUBLIC_APP_ENV === "production",
    isDevelopment: result.NEXT_PUBLIC_APP_ENV === "development",
    isTest: result.NEXT_PUBLIC_APP_ENV === "test",
  };
}
