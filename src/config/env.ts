import { z } from "zod";

/**
 * VyapOne Configuration Error
 *
 * Dedicated error class that aggregates configuration issues and guarantees that
 * actual secret values or partial credentials are NEVER printed in error messages,
 * stack traces, or logs.
 */
export class ConfigurationError extends Error {
  public readonly issues: ReadonlyArray<{ path: string; message: string }>;

  constructor(issues: ReadonlyArray<{ path: string; message: string }>) {
    const formatted = issues.map((i) => `  - ${i.path}: ${i.message}`).join("\n");
    super(
      `[VyapOne Configuration Error] Missing or invalid environment configuration:\n${formatted}`,
    );
    this.name = "ConfigurationError";
    this.issues = issues;
    Object.setPrototypeOf(this, ConfigurationError.prototype);
  }
}

/**
 * Public Environment Schema (safe for client bundles).
 * All keys MUST be prefixed with NEXT_PUBLIC_.
 */
export const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_ENV: z
    .enum(["development", "preview", "staging", "production", "test"])
    .default("development"),
  NEXT_PUBLIC_APP_URL: z
    .string()
    .url("Must be a valid URL (e.g., https://vyapone.in or http://localhost:3000)")
    .default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url("Must be a valid HTTPS URL (e.g., https://<project>.supabase.co)")
    .optional()
    .or(z.literal("")),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional().or(z.literal("")),
});

export type PublicEnvInput = z.infer<typeof publicEnvSchema>;

/**
 * Core Server Environment Schema.
 * Privileged credentials and platform runtime configuration.
 */
export const serverCoreEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  SESSION_SECRET: z
    .string()
    .min(32, "Must be at least 32 characters long for session security")
    .default("dev-only-secret-do-not-use-in-production-min-32-chars"),
  DATABASE_URL: z
    .string()
    .refine(
      (val) => val === "" || val.startsWith("postgresql://") || val.startsWith("postgres://"),
      {
        message:
          "Must be a valid PostgreSQL connection string starting with postgresql:// or postgres://",
      },
    )
    .optional()
    .or(z.literal("")),
  DATABASE_DIRECT_URL: z
    .string()
    .refine(
      (val) => val === "" || val.startsWith("postgresql://") || val.startsWith("postgres://"),
      {
        message:
          "Must be a valid PostgreSQL connection string starting with postgresql:// or postgres://",
      },
    )
    .optional()
    .or(z.literal("")),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().or(z.literal("")),
});

export type ServerCoreEnvInput = z.infer<typeof serverCoreEnvSchema>;

/**
 * Optional Integration Environment Schema.
 * Third-party integrations (payments, WhatsApp, AI, storage, redis) that can be absent in local development.
 */
export const optionalIntegrationsEnvSchema = z.object({
  // Storage (Cloudflare R2 / S3 / Supabase Storage)
  STORAGE_ENDPOINT: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  STORAGE_BUCKET: z.string().optional().or(z.literal("")),
  STORAGE_REGION: z.string().default("ap-south-1"),
  STORAGE_ACCESS_KEY_ID: z.string().optional().or(z.literal("")),
  STORAGE_SECRET_ACCESS_KEY: z.string().optional().or(z.literal("")),

  // Cache & Queues (Redis)
  REDIS_URL: z
    .string()
    .refine((val) => val === "" || val.startsWith("redis://") || val.startsWith("rediss://"), {
      message: "Must be a valid Redis URL starting with redis:// or rediss://",
    })
    .optional()
    .or(z.literal("")),

  // Payments (Razorpay)
  RAZORPAY_KEY_ID: z.string().optional().or(z.literal("")),
  RAZORPAY_KEY_SECRET: z.string().optional().or(z.literal("")),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional().or(z.literal("")),

  // WhatsApp Business Platform (Cloud API via BSP)
  META_WHATSAPP_TOKEN: z.string().optional().or(z.literal("")),
  META_WHATSAPP_PHONE_NUMBER_ID: z.string().optional().or(z.literal("")),
  META_WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().optional().or(z.literal("")),
  META_WEBHOOK_VERIFY_TOKEN: z.string().optional().or(z.literal("")),

  // AI Gateway (Anthropic & Google Cloud)
  ANTHROPIC_API_KEY: z.string().optional().or(z.literal("")),
  GEMINI_API_KEY: z.string().optional().or(z.literal("")),
});

export type OptionalIntegrationsEnvInput = z.infer<typeof optionalIntegrationsEnvSchema>;

/**
 * Composite Validated Configuration Structure
 */
export interface ValidatedConfig {
  public: {
    appEnv: "development" | "preview" | "staging" | "production" | "test";
    appUrl: string;
    supabaseUrl: string;
    supabaseAnonKey: string;
    isSupabaseConfigured: boolean;
  };
  server: {
    nodeEnv: "development" | "production" | "test";
    port: number;
    isProduction: boolean;
    isDevelopment: boolean;
    isTest: boolean;
    sessionSecret: string;
    database: {
      url: string;
      directUrl: string;
      isConfigured: boolean;
    };
    supabase: {
      url: string;
      anonKey: string;
      serviceRoleKey: string;
      isConfigured: boolean;
    };
    storage: {
      endpoint: string;
      bucket: string;
      region: string;
      accessKeyId: string;
      secretAccessKey: string;
      isConfigured: boolean;
    };
    redis: {
      url: string;
      isConfigured: boolean;
    };
    payments: {
      razorpay: {
        keyId: string;
        keySecret: string;
        webhookSecret: string;
        isConfigured: boolean;
      };
    };
    whatsapp: {
      token: string;
      phoneNumberId: string;
      businessAccountId: string;
      webhookVerifyToken: string;
      isConfigured: boolean;
    };
    ai: {
      anthropicApiKey: string;
      geminiApiKey: string;
      isConfigured: boolean;
    };
  };
}

/**
 * Validates a raw environment record against the VyapOne configuration schemas.
 *
 * @param rawEnv Raw environment dictionary (defaults to process.env if omitted).
 *               Accepts explicit runtime bindings for Cloudflare Pages/Workers context.
 * @returns Fully validated and structured ValidatedConfig object.
 * @throws ConfigurationError if genuinely required configuration is missing or malformed.
 */
export function validateEnvironment(
  rawEnv: Record<string, string | undefined> = process.env,
): ValidatedConfig {
  const issues: Array<{ path: string; message: string }> = [];

  // 1. Validate Public Configuration
  const publicResult = publicEnvSchema.safeParse(rawEnv);
  if (!publicResult.success) {
    for (const issue of publicResult.error.issues) {
      issues.push({ path: issue.path.join("."), message: issue.message });
    }
  }

  // 2. Validate Server Core Configuration
  const serverCoreResult = serverCoreEnvSchema.safeParse(rawEnv);
  if (!serverCoreResult.success) {
    for (const issue of serverCoreResult.error.issues) {
      issues.push({ path: issue.path.join("."), message: issue.message });
    }
  }

  // 3. Validate Optional Integrations
  const integrationsResult = optionalIntegrationsEnvSchema.safeParse(rawEnv);
  if (!integrationsResult.success) {
    for (const issue of integrationsResult.error.issues) {
      issues.push({ path: issue.path.join("."), message: issue.message });
    }
  }

  // If initial schema validation failed, abort with clean error
  if (issues.length > 0) {
    throw new ConfigurationError(issues);
  }

  const publicData = publicResult.data as PublicEnvInput;
  const serverData = serverCoreResult.data as ServerCoreEnvInput;
  const integrationsData = integrationsResult.data as OptionalIntegrationsEnvInput;

  const nodeEnv = serverData.NODE_ENV;
  const isProduction = nodeEnv === "production";
  const isDevelopment = nodeEnv === "development";
  const isTest = nodeEnv === "test";

  // 4. Strict Production Invariants: Enforce required server credentials
  if (isProduction) {
    if (!serverData.DATABASE_URL) {
      issues.push({
        path: "DATABASE_URL",
        message: "Required in production mode. Expected PostgreSQL connection string.",
      });
    }

    if (
      !serverData.SESSION_SECRET ||
      serverData.SESSION_SECRET === "dev-only-secret-do-not-use-in-production-min-32-chars"
    ) {
      issues.push({
        path: "SESSION_SECRET",
        message: "Must be set to a secure, unique 32+ character random secret in production mode.",
      });
    }

    if (!publicData.NEXT_PUBLIC_SUPABASE_URL) {
      issues.push({
        path: "NEXT_PUBLIC_SUPABASE_URL",
        message: "Required in production mode. Expected Supabase project URL.",
      });
    }

    if (!publicData.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      issues.push({
        path: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        message: "Required in production mode. Expected Supabase anonymous API key.",
      });
    }

    if (!serverData.SUPABASE_SERVICE_ROLE_KEY) {
      issues.push({
        path: "SUPABASE_SERVICE_ROLE_KEY",
        message:
          "Required in production mode for server database operations and tenant provisioning.",
      });
    }

    if (issues.length > 0) {
      throw new ConfigurationError(issues);
    }
  }

  // 5. Build Safe Output Structure
  const isSupabaseConfigured = Boolean(
    publicData.NEXT_PUBLIC_SUPABASE_URL && publicData.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  return {
    public: {
      appEnv: publicData.NEXT_PUBLIC_APP_ENV,
      appUrl: publicData.NEXT_PUBLIC_APP_URL,
      supabaseUrl: publicData.NEXT_PUBLIC_SUPABASE_URL || "",
      supabaseAnonKey: publicData.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
      isSupabaseConfigured,
    },
    server: {
      nodeEnv,
      port: serverData.PORT,
      isProduction,
      isDevelopment,
      isTest,
      sessionSecret: serverData.SESSION_SECRET,
      database: {
        url: serverData.DATABASE_URL || "",
        directUrl: serverData.DATABASE_DIRECT_URL || serverData.DATABASE_URL || "",
        isConfigured: Boolean(serverData.DATABASE_URL),
      },
      supabase: {
        url: publicData.NEXT_PUBLIC_SUPABASE_URL || "",
        anonKey: publicData.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
        serviceRoleKey: serverData.SUPABASE_SERVICE_ROLE_KEY || "",
        isConfigured: Boolean(
          publicData.NEXT_PUBLIC_SUPABASE_URL &&
          publicData.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
          serverData.SUPABASE_SERVICE_ROLE_KEY,
        ),
      },
      storage: {
        endpoint: integrationsData.STORAGE_ENDPOINT || "",
        bucket: integrationsData.STORAGE_BUCKET || "",
        region: integrationsData.STORAGE_REGION,
        accessKeyId: integrationsData.STORAGE_ACCESS_KEY_ID || "",
        secretAccessKey: integrationsData.STORAGE_SECRET_ACCESS_KEY || "",
        isConfigured: Boolean(
          integrationsData.STORAGE_ENDPOINT &&
          integrationsData.STORAGE_BUCKET &&
          integrationsData.STORAGE_ACCESS_KEY_ID &&
          integrationsData.STORAGE_SECRET_ACCESS_KEY,
        ),
      },
      redis: {
        url: integrationsData.REDIS_URL || "",
        isConfigured: Boolean(integrationsData.REDIS_URL),
      },
      payments: {
        razorpay: {
          keyId: integrationsData.RAZORPAY_KEY_ID || "",
          keySecret: integrationsData.RAZORPAY_KEY_SECRET || "",
          webhookSecret: integrationsData.RAZORPAY_WEBHOOK_SECRET || "",
          isConfigured: Boolean(
            integrationsData.RAZORPAY_KEY_ID && integrationsData.RAZORPAY_KEY_SECRET,
          ),
        },
      },
      whatsapp: {
        token: integrationsData.META_WHATSAPP_TOKEN || "",
        phoneNumberId: integrationsData.META_WHATSAPP_PHONE_NUMBER_ID || "",
        businessAccountId: integrationsData.META_WHATSAPP_BUSINESS_ACCOUNT_ID || "",
        webhookVerifyToken: integrationsData.META_WEBHOOK_VERIFY_TOKEN || "",
        isConfigured: Boolean(
          integrationsData.META_WHATSAPP_TOKEN &&
          integrationsData.META_WHATSAPP_PHONE_NUMBER_ID &&
          integrationsData.META_WHATSAPP_BUSINESS_ACCOUNT_ID,
        ),
      },
      ai: {
        anthropicApiKey: integrationsData.ANTHROPIC_API_KEY || "",
        geminiApiKey: integrationsData.GEMINI_API_KEY || "",
        isConfigured: Boolean(
          integrationsData.ANTHROPIC_API_KEY || integrationsData.GEMINI_API_KEY,
        ),
      },
    },
  };
}
