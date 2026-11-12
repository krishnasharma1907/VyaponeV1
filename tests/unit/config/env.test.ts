import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ConfigurationError,
  publicEnvSchema,
  serverCoreEnvSchema,
  validateEnvironment,
} from "@/config/env";
import { getPublicConfig } from "@/config/public";

describe("Application Configuration & Environment Handling [VO-016]", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Isolate process.env per test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original process.env
    process.env = originalEnv;
  });

  describe("1. Valid Environment Configuration", () => {
    it("parses valid development configuration with safe defaults", () => {
      const config = validateEnvironment({
        NODE_ENV: "development",
        PORT: "3000",
        NEXT_PUBLIC_APP_ENV: "development",
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      });

      expect(config.server.nodeEnv).toBe("development");
      expect(config.server.port).toBe(3000);
      expect(config.server.isDevelopment).toBe(true);
      expect(config.server.isProduction).toBe(false);
      expect(config.public.appEnv).toBe("development");
      expect(config.public.appUrl).toBe("http://localhost:3000");
    });

    it("parses valid complete production configuration", () => {
      const prodEnv: Record<string, string> = {
        NODE_ENV: "production",
        PORT: "8080",
        NEXT_PUBLIC_APP_ENV: "production",
        NEXT_PUBLIC_APP_URL: "https://vyapone.in",
        NEXT_PUBLIC_SUPABASE_URL: "https://xyzcompany.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJhYmMxMjMiLCJhbGciOiJIUzI1NiJ9.anonkeyhere",
        SESSION_SECRET: "a-secure-production-session-secret-that-is-at-least-32-chars",
        DATABASE_URL: "postgresql://postgres:securepass@db.xyz.supabase.co:5432/postgres",
        DATABASE_DIRECT_URL: "postgresql://postgres:securepass@db.xyz.supabase.co:5432/postgres",
        SUPABASE_SERVICE_ROLE_KEY: "eyJhYmMxMjMiLCJhbGciOiJIUzI1NiJ9.servicerolekeyhere",
      };

      const config = validateEnvironment(prodEnv);

      expect(config.server.nodeEnv).toBe("production");
      expect(config.server.port).toBe(8080);
      expect(config.server.isProduction).toBe(true);
      expect(config.server.database.isConfigured).toBe(true);
      expect(config.server.supabase.isConfigured).toBe(true);
      expect(config.public.isSupabaseConfigured).toBe(true);
      expect(config.public.appUrl).toBe("https://vyapone.in");
    });
  });

  describe("2. Missing Required Configuration & Production Failures", () => {
    it("refuses to start in production if DATABASE_URL is missing", () => {
      const invalidProdEnv: Record<string, string> = {
        NODE_ENV: "production",
        NEXT_PUBLIC_APP_ENV: "production",
        NEXT_PUBLIC_APP_URL: "https://vyapone.in",
        NEXT_PUBLIC_SUPABASE_URL: "https://xyzcompany.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key-12345678901234567890",
        SESSION_SECRET: "a-secure-production-session-secret-that-is-at-least-32-chars",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key-12345678901234567890",
        // DATABASE_URL missing!
      };

      expect(() => validateEnvironment(invalidProdEnv)).toThrow(ConfigurationError);
      expect(() => validateEnvironment(invalidProdEnv)).toThrow(/DATABASE_URL/);
    });

    it("refuses to start in production if SUPABASE_SERVICE_ROLE_KEY is missing", () => {
      const invalidProdEnv: Record<string, string> = {
        NODE_ENV: "production",
        NEXT_PUBLIC_APP_ENV: "production",
        NEXT_PUBLIC_APP_URL: "https://vyapone.in",
        NEXT_PUBLIC_SUPABASE_URL: "https://xyzcompany.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key-12345678901234567890",
        SESSION_SECRET: "a-secure-production-session-secret-that-is-at-least-32-chars",
        DATABASE_URL: "postgresql://postgres:pass@localhost:5432/db",
        // SUPABASE_SERVICE_ROLE_KEY missing!
      };

      expect(() => validateEnvironment(invalidProdEnv)).toThrow(ConfigurationError);
      expect(() => validateEnvironment(invalidProdEnv)).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
    });

    it("refuses to start in production if default dev SESSION_SECRET is left unchanged", () => {
      const invalidProdEnv: Record<string, string> = {
        NODE_ENV: "production",
        NEXT_PUBLIC_APP_ENV: "production",
        NEXT_PUBLIC_APP_URL: "https://vyapone.in",
        NEXT_PUBLIC_SUPABASE_URL: "https://xyzcompany.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key-12345678901234567890",
        DATABASE_URL: "postgresql://postgres:pass@localhost:5432/db",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key-12345678901234567890",
        SESSION_SECRET: "dev-only-secret-do-not-use-in-production-min-32-chars", // insecure dev default!
      };

      expect(() => validateEnvironment(invalidProdEnv)).toThrow(ConfigurationError);
      expect(() => validateEnvironment(invalidProdEnv)).toThrow(/SESSION_SECRET/);
    });

    it("refuses to start in production if public Supabase credentials are missing", () => {
      const invalidProdEnv: Record<string, string> = {
        NODE_ENV: "production",
        NEXT_PUBLIC_APP_ENV: "production",
        NEXT_PUBLIC_APP_URL: "https://vyapone.in",
        DATABASE_URL: "postgresql://postgres:pass@localhost:5432/db",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key-12345678901234567890",
        SESSION_SECRET: "a-secure-production-session-secret-that-is-at-least-32-chars",
        // NEXT_PUBLIC_SUPABASE_URL and ANON_KEY missing!
      };

      expect(() => validateEnvironment(invalidProdEnv)).toThrow(ConfigurationError);
      expect(() => validateEnvironment(invalidProdEnv)).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
    });
  });

  describe("3. Format & Enumeration Validation", () => {
    it("fails on malformed URLs for NEXT_PUBLIC_APP_URL", () => {
      expect(() =>
        publicEnvSchema.parse({
          NEXT_PUBLIC_APP_URL: "not-a-valid-url",
        }),
      ).toThrow();
    });

    it("fails on non-PostgreSQL protocol for DATABASE_URL", () => {
      expect(() =>
        serverCoreEnvSchema.parse({
          DATABASE_URL: "mysql://root:pass@localhost:3306/db",
        }),
      ).toThrow(/Must be a valid PostgreSQL connection string/);
    });

    it("fails on invalid NODE_ENV enum", () => {
      expect(() =>
        serverCoreEnvSchema.parse({
          NODE_ENV: "invalid-env",
        }),
      ).toThrow();
    });

    it("fails on invalid PORT range", () => {
      expect(() =>
        serverCoreEnvSchema.parse({
          PORT: "999999",
        }),
      ).toThrow();
    });
  });

  describe("4. Optional Integrations Absence Handling", () => {
    it("allows third-party credentials to be absent without throwing in local development", () => {
      const config = validateEnvironment({
        NODE_ENV: "development",
        NEXT_PUBLIC_APP_ENV: "development",
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      });

      // Explicit and safe false state for absent integrations
      expect(config.server.storage.isConfigured).toBe(false);
      expect(config.server.redis.isConfigured).toBe(false);
      expect(config.server.payments.razorpay.isConfigured).toBe(false);
      expect(config.server.whatsapp.isConfigured).toBe(false);
      expect(config.server.ai.isConfigured).toBe(false);
    });

    it("reports isConfigured: true when integration credentials are fully provided", () => {
      const config = validateEnvironment({
        NODE_ENV: "development",
        NEXT_PUBLIC_APP_ENV: "development",
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
        RAZORPAY_KEY_ID: "rzp_test_123456",
        RAZORPAY_KEY_SECRET: "secret123",
        REDIS_URL: "redis://localhost:6379",
        ANTHROPIC_API_KEY: "sk-ant-12345",
      });

      expect(config.server.payments.razorpay.isConfigured).toBe(true);
      expect(config.server.payments.razorpay.keyId).toBe("rzp_test_123456");
      expect(config.server.redis.isConfigured).toBe(true);
      expect(config.server.ai.isConfigured).toBe(true);
      expect(config.server.ai.anthropicApiKey).toBe("sk-ant-12345");
      expect(config.server.whatsapp.isConfigured).toBe(false);
    });
  });

  describe("5. Public Configuration Allowlisting & Security Isolation", () => {
    it("exposes only allowlisted NEXT_PUBLIC_* variables in publicConfig", () => {
      const testEnv = {
        NEXT_PUBLIC_APP_ENV: "staging" as const,
        NEXT_PUBLIC_APP_URL: "https://staging.vyapone.in",
        NEXT_PUBLIC_SUPABASE_URL: "https://staging.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-token-xyz",
        // Secret that must never leak:
        DATABASE_URL: "postgresql://secret_user:secret_pass@localhost:5432/db",
        SUPABASE_SERVICE_ROLE_KEY: "super-secret-service-role-key",
      };

      const publicConfig = getPublicConfig(testEnv);

      // Verify public properties exist
      expect(publicConfig.appEnv).toBe("staging");
      expect(publicConfig.appUrl).toBe("https://staging.vyapone.in");
      expect(publicConfig.supabaseUrl).toBe("https://staging.supabase.co");
      expect(publicConfig.supabaseAnonKey).toBe("anon-token-xyz");

      // Verify privileged keys are completely absent from publicConfig
      const publicKeys = Object.keys(publicConfig);
      expect(publicKeys).not.toContain("databaseUrl");
      expect(publicKeys).not.toContain("DATABASE_URL");
      expect(publicKeys).not.toContain("serviceRoleKey");
      expect(publicKeys).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
      expect(publicKeys).not.toContain("sessionSecret");
    });
  });

  describe("6. Secret Redaction in Error Messages", () => {
    it("never includes actual invalid secret values in error messages", () => {
      const sensitivePassword = "super_secret_actual_database_password";
      const badEnv = {
        NODE_ENV: "production",
        // Malformed protocol with sensitive password in the string
        DATABASE_URL: `mysql://admin:${sensitivePassword}@localhost:3306/db`,
      };

      let thrownError: ConfigurationError | null = null;
      try {
        validateEnvironment(badEnv);
      } catch (err) {
        if (err instanceof ConfigurationError) {
          thrownError = err;
        }
      }

      expect(thrownError).not.toBeNull();
      // The error message must mention the field path and expected format
      expect(thrownError?.message).toContain("DATABASE_URL");
      // CRITICAL SECURITY INVARIANT: The error message must NEVER leak the password!
      expect(thrownError?.message).not.toContain(sensitivePassword);
    });
  });

  describe("7. Cloudflare Runtime Context & Explicit Env Passing", () => {
    it("accepts an explicit runtime environment dictionary rather than relying solely on process.env", () => {
      // Simulates Cloudflare Pages / Workers context.env bindings
      const cloudflareContextEnv: Record<string, string> = {
        NODE_ENV: "production",
        NEXT_PUBLIC_APP_ENV: "production",
        NEXT_PUBLIC_APP_URL: "https://vyapone.in",
        NEXT_PUBLIC_SUPABASE_URL: "https://prod.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "cf-anon-token-12345678901234567890",
        DATABASE_URL: "postgresql://postgres:cf-pass@db.supabase.co:5432/postgres",
        SUPABASE_SERVICE_ROLE_KEY: "cf-service-role-12345678901234567890",
        SESSION_SECRET: "cf-session-secret-must-be-at-least-32-chars-long",
      };

      // Completely clear process.env to prove validateEnvironment works purely from passed bindings
      process.env = {} as NodeJS.ProcessEnv;

      const config = validateEnvironment(cloudflareContextEnv);

      expect(config.server.isProduction).toBe(true);
      expect(config.public.supabaseUrl).toBe("https://prod.supabase.co");
      expect(config.server.database.url).toContain("cf-pass");
    });
  });
});
