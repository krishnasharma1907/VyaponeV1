import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ConfigurationError, PRODUCTION_SUPABASE_PROJECT_REF } from "@/config/env";
import { _resetServerConfigForTesting } from "@/config/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { updateSession } from "@/lib/supabase/middleware";
import { createServerSupabaseClient } from "@/lib/supabase/server";

vi.mock("server-only", () => ({}));

function createMockJwtWithRef(ref: string): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({ iss: "supabase", ref, role: "service_role", exp: 1999999999 }),
  ).toString("base64url");
  return `${header}.${payload}.mock-signature`;
}

describe("Supabase Server, Middleware & Admin Staging Runtime Guards [STAGING-001]", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    _resetServerConfigForTesting();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    _resetServerConfigForTesting();
    vi.restoreAllMocks();
  });

  it("refuses module startup at import time when staging targets production ref", async () => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_APP_ENV = "staging";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    process.env.NEXT_PUBLIC_SUPABASE_URL = `https://${PRODUCTION_SUPABASE_PROJECT_REF}.supabase.co`;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = createMockJwtWithRef("stagingok01");

    await expect(import("@/config/public")).rejects.toMatchObject({
      name: "ConfigurationError",
      message: expect.stringMatching(/production Supabase project reference/),
    });
    vi.resetModules();
  });

  it("refuses createServerSupabaseClient at runtime when staging targets production ref", async () => {
    process.env.NEXT_PUBLIC_APP_ENV = "staging";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    process.env.NEXT_PUBLIC_SUPABASE_URL = `https://${PRODUCTION_SUPABASE_PROJECT_REF}.supabase.co`;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = createMockJwtWithRef("stagingok01");

    await expect(
      createServerSupabaseClient({
        getAll: () => [],
      }),
    ).rejects.toThrow(ConfigurationError);
  });

  it("refuses middleware updateSession when staging targets production ref", async () => {
    process.env.NEXT_PUBLIC_APP_ENV = "staging";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://stagingok01.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = createMockJwtWithRef(
      PRODUCTION_SUPABASE_PROJECT_REF,
    );

    const request = new NextRequest("http://localhost:3000/dashboard");
    await expect(updateSession(request)).rejects.toThrow(ConfigurationError);
  });

  it("refuses createAdminSupabaseClient when staging customEnv or process.env resolves to production ref", () => {
    expect(() =>
      createAdminSupabaseClient({
        NODE_ENV: "production",
        NEXT_PUBLIC_APP_ENV: "staging",
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
        NEXT_PUBLIC_SUPABASE_URL: "https://stagingok01.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: createMockJwtWithRef("stagingok01"),
        DATABASE_URL:
          "postgresql://postgres.stagingok01:pw@aws-0-ap-south-1.pooler.supabase.com:6543/postgres",
        SUPABASE_SERVICE_ROLE_KEY: createMockJwtWithRef(PRODUCTION_SUPABASE_PROJECT_REF),
        SESSION_SECRET: "staging-test-only-random-session-secret-min-32-chars",
      }),
    ).toThrow(ConfigurationError);
  });
});
