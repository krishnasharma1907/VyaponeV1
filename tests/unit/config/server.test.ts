import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// In Next.js Server Components, bundlers resolve "server-only" to empty.js via the react-server export condition.
// In Vitest's JSDOM environment, we mock "server-only" to simulate the authorized Server Component runtime.
vi.mock("server-only", () => ({}));

import { getServerConfig, _resetServerConfigForTesting } from "@/config/server";

describe("Server-Only Configuration [VO-016]", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    _resetServerConfigForTesting();
  });

  afterEach(() => {
    process.env = originalEnv;
    _resetServerConfigForTesting();
  });

  it("exports typed server configuration with dev defaults", () => {
    const config = getServerConfig({
      NODE_ENV: "development",
      PORT: "3000",
    });

    expect(config.nodeEnv).toBe("development");
    expect(config.port).toBe(3000);
    expect(config.isDevelopment).toBe(true);
    expect(config.isProduction).toBe(false);
    expect(config.sessionSecret).toBe("dev-only-secret-do-not-use-in-production-min-32-chars");
  });

  it("memoizes configuration across multiple calls with the same environment", () => {
    const first = getServerConfig();
    const second = getServerConfig();

    expect(first).toBe(second); // Exact same reference
  });

  it("re-evaluates configuration when explicit custom environment is provided", () => {
    const custom = getServerConfig({
      NODE_ENV: "development",
      PORT: "4000",
    });

    expect(custom.port).toBe(4000);
  });
});
