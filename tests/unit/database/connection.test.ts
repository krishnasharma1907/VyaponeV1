import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { _resetServerConfigForTesting } from "@/config/server";

// Mock server-only to simulate server runtime inside Vitest JSDOM environment
vi.mock("server-only", () => ({}));

describe("Database Connection Foundation [VO-017]", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    _resetServerConfigForTesting();
  });

  afterEach(() => {
    process.env = originalEnv;
    _resetServerConfigForTesting();
    vi.restoreAllMocks();
  });

  it("reports unconfigured when DATABASE_URL is not set", async () => {
    const { inspectDatabaseConfig } = await import("@/lib/database");

    const info = inspectDatabaseConfig({
      NODE_ENV: "development",
      DATABASE_URL: "",
    });

    expect(info.isConfigured).toBe(false);
    expect(info.poolerMode).toBe("unconfigured");
    expect(info.host).toBeNull();
    expect(info.port).toBeNull();
  });

  it("identifies Supavisor transaction pooler on port 6543", async () => {
    const { inspectDatabaseConfig } = await import("@/lib/database");

    const secretPassword = "ultra-secret-db-password-12345";
    const info = inspectDatabaseConfig({
      NODE_ENV: "development",
      DATABASE_URL: `postgresql://postgres.myproject:${secretPassword}@aws-0-ap-south-1.pooler.supabase.com:6543/postgres`,
    });

    expect(info.isConfigured).toBe(true);
    expect(info.poolerMode).toBe("transaction_pooler");
    expect(info.port).toBe(6543);
    expect(info.host).toBe("aws-0-ap-south-1.pooler.supabase.com");
    expect(info.databaseName).toBe("postgres");

    // Ensure password is NEVER leaked in connection info
    expect(JSON.stringify(info)).not.toContain(secretPassword);
  });

  it("identifies transaction pooler via pgbouncer=true query parameter", async () => {
    const { inspectDatabaseConfig } = await import("@/lib/database");

    const info = inspectDatabaseConfig({
      NODE_ENV: "development",
      DATABASE_URL: "postgresql://postgres:secret@db.supabase.co:5432/postgres?pgbouncer=true",
    });

    expect(info.isConfigured).toBe(true);
    expect(info.poolerMode).toBe("transaction_pooler");
  });

  it("identifies Supavisor session pooler on port 5432", async () => {
    const { inspectDatabaseConfig } = await import("@/lib/database");

    const info = inspectDatabaseConfig({
      NODE_ENV: "development",
      DATABASE_URL:
        "postgresql://postgres.proj:secret@aws-0-ap-south-1.pooler.supabase.com:5432/postgres",
    });

    expect(info.isConfigured).toBe(true);
    expect(info.poolerMode).toBe("session_pooler");
    expect(info.port).toBe(5432);
  });

  it("identifies unpooled direct database connection", async () => {
    const { inspectDatabaseConfig } = await import("@/lib/database");

    const info = inspectDatabaseConfig({
      NODE_ENV: "development",
      DATABASE_URL: "postgresql://postgres:secret@db.example.com:5432/custom_db",
    });

    expect(info.isConfigured).toBe(true);
    expect(info.poolerMode).toBe("unpooled");
    expect(info.host).toBe("db.example.com");
    expect(info.databaseName).toBe("custom_db");
  });
});
