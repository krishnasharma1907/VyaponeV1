import { defineConfig, devices } from "@playwright/test";

/**
 * VyapOne Playwright End-to-End Browser Testing Configuration
 *
 * Implements mobile-first browser verification matching NFR-PERF-01 and NFR-A11Y-01
 * across standard mobile (390x844) and desktop (1440x900) viewports.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  outputDir: "./docs/evidence/e2e-results",
  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || "http://127.0.0.1:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "mobile-standard-390px",
      use: {
        ...devices["iPhone 14"],
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: "desktop-1440px",
      use: {
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
});
