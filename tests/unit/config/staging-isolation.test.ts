import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  assertStagingIsolation,
  ConfigurationError,
  extractSupabaseProjectRef,
  extractSupabaseRefFromJwt,
  isProductionAppUrl,
  isProductionSupabaseReference,
  PRODUCTION_SUPABASE_PROJECT_REF,
  validateEnvironment,
} from "@/config/env";
import { getPublicConfig } from "@/config/public";
import { createBrowserSupabaseClient, _resetBrowserClientForTesting } from "@/lib/supabase/client";
import { loadIsolatedStagingEnv, parseEnvContents } from "../../../scripts/staging/env-loader.mjs";

const require = createRequire(import.meta.url);

function createMockJwtWithRef(ref: string): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({ iss: "supabase", ref, role: "anon", exp: 1999999999 }),
  ).toString("base64url");
  return `${header}.${payload}.mock-signature-do-not-use`;
}

describe("Staging Isolation & Environment Security [STAGING-001]", () => {
  const originalEnv = { ...process.env };
  const tempDirs: string[] = [];

  beforeEach(() => {
    process.env = { ...originalEnv };
    _resetBrowserClientForTesting();
  });

  afterEach(() => {
    process.env = originalEnv;
    _resetBrowserClientForTesting();
    vi.restoreAllMocks();
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir && fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it("ignores .env.staging.local and .env.staging in .gitignore while tracking .env.staging.local.example", () => {
    const gitignoreLines = fs
      .readFileSync(path.resolve(process.cwd(), ".gitignore"), "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim());

    expect(gitignoreLines).toContain(".env.staging.local");
    expect(gitignoreLines).toContain(".env.staging");
    expect(gitignoreLines).toContain("!.env.staging.local.example");
  });

  it("provides a sanitized .env.staging.local.example covering required variables without production refs", () => {
    const examplePath = path.resolve(process.cwd(), ".env.staging.local.example");
    expect(fs.existsSync(examplePath)).toBe(true);

    const raw = fs.readFileSync(examplePath, "utf8");
    const parsed = parseEnvContents(raw);

    expect(parsed.NEXT_PUBLIC_APP_ENV).toBe("staging");
    expect(parsed.NEXT_PUBLIC_APP_URL).toBeTruthy();
    expect(parsed.NEXT_PUBLIC_SUPABASE_URL).toBeTruthy();
    expect(parsed.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBeTruthy();
    expect(parsed.DATABASE_URL).toBeTruthy();
    expect(parsed.DATABASE_DIRECT_URL).toBeTruthy();
    expect(parsed.SUPABASE_SERVICE_ROLE_KEY).toBeTruthy();
    expect(parsed.SESSION_SECRET).toBeTruthy();
    expect(parsed.VYAPONE_STAGING_PROJECT_REF).toBeTruthy();

    expect(isProductionSupabaseReference(parsed.NEXT_PUBLIC_SUPABASE_URL)).toBe(false);
    expect(isProductionSupabaseReference(parsed.DATABASE_URL)).toBe(false);
    expect(isProductionAppUrl(parsed.NEXT_PUBLIC_APP_URL)).toBe(false);
  });

  it("extracts project refs accurately from JWTs, Supabase URLs, and Postgres DSNs", () => {
    const prodJwt = createMockJwtWithRef(PRODUCTION_SUPABASE_PROJECT_REF);
    expect(extractSupabaseRefFromJwt(prodJwt)).toBe(PRODUCTION_SUPABASE_PROJECT_REF);
    expect(
      extractSupabaseProjectRef(`https://${PRODUCTION_SUPABASE_PROJECT_REF}.supabase.co`),
    ).toBe(PRODUCTION_SUPABASE_PROJECT_REF);
    expect(
      extractSupabaseProjectRef(
        `postgresql://postgres.${PRODUCTION_SUPABASE_PROJECT_REF}:pw@aws-0-ap-south-1.pooler.supabase.com:6543/postgres`,
      ),
    ).toBe(PRODUCTION_SUPABASE_PROJECT_REF);
    expect(
      extractSupabaseProjectRef(
        `postgresql://postgres:pw@db.${PRODUCTION_SUPABASE_PROJECT_REF}.supabase.co:5432/postgres`,
      ),
    ).toBe(PRODUCTION_SUPABASE_PROJECT_REF);
    expect(isProductionSupabaseReference(prodJwt)).toBe(true);
    expect(isProductionSupabaseReference("https://staging-vyapone-test.supabase.co")).toBe(false);
  });

  it("rejects production project ref across URLs, DSNs, and JWTs in staging mode without leaking secrets", () => {
    const prodJwt = createMockJwtWithRef(PRODUCTION_SUPABASE_PROJECT_REF);
    const stagingJwt = createMockJwtWithRef("stagingvyaponeref01");
    const secretServiceRole = createMockJwtWithRef(PRODUCTION_SUPABASE_PROJECT_REF);

    expect(() =>
      assertStagingIsolation({
        NEXT_PUBLIC_APP_ENV: "staging",
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
        NEXT_PUBLIC_SUPABASE_URL: `https://${PRODUCTION_SUPABASE_PROJECT_REF}.supabase.co`,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: stagingJwt,
      }),
    ).toThrow(ConfigurationError);

    expect(() =>
      getPublicConfig({
        NEXT_PUBLIC_APP_ENV: "staging",
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
        NEXT_PUBLIC_SUPABASE_URL: "https://stagingvyaponeref01.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: prodJwt,
      }),
    ).toThrow(ConfigurationError);

    try {
      validateEnvironment({
        NODE_ENV: "production",
        NEXT_PUBLIC_APP_ENV: "staging",
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
        NEXT_PUBLIC_SUPABASE_URL: "https://stagingvyaponeref01.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: stagingJwt,
        DATABASE_URL: `postgresql://postgres.${PRODUCTION_SUPABASE_PROJECT_REF}:secret@aws-0-ap-south-1.pooler.supabase.com:6543/postgres`,
        SUPABASE_SERVICE_ROLE_KEY: secretServiceRole,
        SESSION_SECRET: "staging-test-only-random-session-secret-min-32-chars",
      });
      expect.unreachable("Expected ConfigurationError for production DB/service key in staging");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigurationError);
      const message = (error as Error).message;
      expect(message).toContain("production Supabase project reference");
      expect(message).not.toContain(secretServiceRole);
      expect(message).not.toContain(PRODUCTION_SUPABASE_PROJECT_REF);
    }
  });

  it("blocks production VyapOne origins and cross-project ref mismatches in staging", () => {
    const stagingJwtA = createMockJwtWithRef("stagingrefalpha001");
    const stagingJwtB = createMockJwtWithRef("stagingrefbravo002");

    expect(() =>
      assertStagingIsolation({
        NEXT_PUBLIC_APP_ENV: "staging",
        NEXT_PUBLIC_APP_URL: "https://vyapone.kssharma2022krish.workers.dev",
        NEXT_PUBLIC_SUPABASE_URL: "https://stagingrefalpha001.supabase.co",
      }),
    ).toThrow(/targets a production VyapOne origin/);

    expect(() =>
      assertStagingIsolation({
        NEXT_PUBLIC_APP_ENV: "staging",
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
        NEXT_PUBLIC_SUPABASE_URL: "https://stagingrefalpha001.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: stagingJwtB,
      }),
    ).toThrow(/do not match/);

    expect(() =>
      assertStagingIsolation({
        NEXT_PUBLIC_APP_ENV: "staging",
        NEXT_PUBLIC_APP_URL: "https://staging.vyapone.in",
        NEXT_PUBLIC_SUPABASE_URL: "https://stagingrefalpha001.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: stagingJwtA,
      }),
    ).not.toThrow();
  });

  it("keeps browser public config strictly allowlisted and guards Supabase clients in staging", () => {
    const publicOnly = getPublicConfig({
      NEXT_PUBLIC_APP_ENV: "staging",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      NEXT_PUBLIC_SUPABASE_URL: "https://stagingrefalpha001.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: createMockJwtWithRef("stagingrefalpha001"),
      SUPABASE_SERVICE_ROLE_KEY: "should-never-appear",
      DATABASE_URL: "postgresql://should-never-appear",
    });

    expect(Object.keys(publicOnly).sort()).toEqual([
      "appEnv",
      "appUrl",
      "isDevelopment",
      "isProduction",
      "isSupabaseConfigured",
      "isTest",
      "supabaseAnonKey",
      "supabaseUrl",
    ]);

    process.env.NEXT_PUBLIC_APP_ENV = "staging";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    process.env.NEXT_PUBLIC_SUPABASE_URL = `https://${PRODUCTION_SUPABASE_PROJECT_REF}.supabase.co`;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = createMockJwtWithRef("stagingrefalpha001");

    expect(() => createBrowserSupabaseClient()).toThrow(ConfigurationError);
  });

  it("refuses silent .env fallback and prevents @next/env hydration in loadIsolatedStagingEnv", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vyapone-staging-test-"));
    tempDirs.push(tmpDir);

    const prodAnon = createMockJwtWithRef(PRODUCTION_SUPABASE_PROJECT_REF);
    fs.writeFileSync(
      path.join(tmpDir, ".env"),
      [
        "NEXT_PUBLIC_APP_ENV=development",
        "NEXT_PUBLIC_APP_URL=https://vyapone.kssharma2022krish.workers.dev",
        `NEXT_PUBLIC_SUPABASE_URL=https://${PRODUCTION_SUPABASE_PROJECT_REF}.supabase.co`,
        `NEXT_PUBLIC_SUPABASE_ANON_KEY=${prodAnon}`,
        "DATABASE_URL=postgresql://postgres:prod@db.fjoezwoyowihbxacmoyp.supabase.co:5432/postgres",
        "REDIS_URL=redis://prod-redis-must-not-leak:6379",
        "EXTRA_PROD_ONLY_KEY=must-be-scrubbed",
      ].join("\n"),
      "utf8",
    );

    // 1. Must refuse when .env.staging.local is missing (no .env fallback)
    expect(() => loadIsolatedStagingEnv({ rootDir: tmpDir, command: "dev" })).toThrow(
      /Staging refuses to fall back to "\.env"/,
    );

    // 2. Must refuse attempting to pass .env explicitly
    expect(() =>
      loadIsolatedStagingEnv({ rootDir: tmpDir, envFile: ".env", command: "dev" }),
    ).toThrow(/Refusing to load "\.env"/);

    const stagingRef = "stagingisolatedref01";
    const stagingAnon = createMockJwtWithRef(stagingRef);
    const stagingSvc = createMockJwtWithRef(stagingRef);
    fs.writeFileSync(
      path.join(tmpDir, ".env.staging.local"),
      [
        `VYAPONE_STAGING_PROJECT_REF=${stagingRef}`,
        "NEXT_PUBLIC_APP_ENV=staging",
        "NEXT_PUBLIC_APP_URL=http://localhost:3000",
        `NEXT_PUBLIC_SUPABASE_URL=https://${stagingRef}.supabase.co`,
        `NEXT_PUBLIC_SUPABASE_ANON_KEY=${stagingAnon}`,
        "SESSION_SECRET=isolated-staging-only-secret-key-min-32-characters",
        `DATABASE_URL=postgresql://postgres.${stagingRef}:stagingpw@aws-0-ap-south-1.pooler.supabase.com:6543/postgres`,
        `DATABASE_DIRECT_URL=postgresql://postgres:stagingpw@db.${stagingRef}.supabase.co:5432/postgres`,
        `SUPABASE_SERVICE_ROLE_KEY=${stagingSvc}`,
      ].join("\n"),
      "utf8",
    );

    const loaded = loadIsolatedStagingEnv({
      rootDir: tmpDir,
      command: "build",
      baseEnv: {
        PATH: process.env.PATH,
        REDIS_URL: "redis://inherited-ambient-prod:6379",
        NEXT_PUBLIC_SUPABASE_URL: `https://${PRODUCTION_SUPABASE_PROJECT_REF}.supabase.co`,
      },
    });

    expect(loaded.stagingProjectRef).toBe(stagingRef);
    expect(loaded.env.NODE_ENV).toBe("production");
    expect(loaded.env.NEXT_PUBLIC_APP_ENV).toBe("staging");
    expect(loaded.env.PORT).toBe("3000");
    expect(loaded.env.STORAGE_REGION).toBe("ap-south-1");
    expect(loaded.env.VYAPONE_STAGING_MODE).toBe("1");
    expect(loaded.env.__NEXT_PROCESSED_ENV).toBe("true");
    expect(loaded.env.NEXT_PUBLIC_SUPABASE_URL).toBe(`https://${stagingRef}.supabase.co`);
    expect(loaded.env.REDIS_URL).toBe("");
    expect(loaded.env.EXTRA_PROD_ONLY_KEY).toBe("");

    const validatedLoaded = validateEnvironment(loaded.env);
    expect(validatedLoaded.public.appEnv).toBe("staging");
    expect(validatedLoaded.server.port).toBe(3000);
    expect(validatedLoaded.server.storage.region).toBe("ap-south-1");

    // Verify @next/env cannot hydrate production keys from `.env` under isolated process.env
    const nextPkgDir = path.dirname(require.resolve("next/package.json"));
    const nextEnvPath = require.resolve("@next/env", { paths: [nextPkgDir] });
    const nextEnv = require(nextEnvPath) as {
      resetEnv: () => void;
      loadEnvConfig: (
        dir: string,
        dev?: boolean,
      ) => { combinedEnv: Record<string, string | undefined> };
    };
    const snapshot = { ...process.env };
    try {
      process.env = {
        ...loaded.env,
        NODE_ENV: "production",
      } as NodeJS.ProcessEnv;
      nextEnv.resetEnv();
      const { combinedEnv } = nextEnv.loadEnvConfig(tmpDir, false);
      expect(combinedEnv.NEXT_PUBLIC_SUPABASE_URL).toBe(`https://${stagingRef}.supabase.co`);
      expect(combinedEnv.REDIS_URL).toBe("");
      expect(combinedEnv.EXTRA_PROD_ONLY_KEY).toBe("");
    } finally {
      process.env = snapshot;
      nextEnv.resetEnv();
    }
  });
});
