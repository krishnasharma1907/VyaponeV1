import { createCanonicalDemoDataset, type DemoDataset } from "../../../tests/fixtures/demo-seed";

export class SeedingSecurityError extends Error {
  constructor(message: string) {
    super(`[SeedingSecurityError] ${message}`);
    this.name = "SeedingSecurityError";
  }
}

/**
 * Validates that seeding is never executed against a production or remote environment.
 */
export function assertSafeSeedEnvironment(
  env: Record<string, string | undefined> = process.env,
): void {
  const nodeEnv = env.NODE_ENV?.toLowerCase();
  if (nodeEnv === "production") {
    throw new SeedingSecurityError(
      "Database seeding is strictly forbidden in production environments.",
    );
  }

  const appEnv = env.NEXT_PUBLIC_APP_ENV?.toLowerCase();
  if (appEnv === "production" || appEnv === "staging") {
    throw new SeedingSecurityError(
      `Database seeding cannot run when NEXT_PUBLIC_APP_ENV is "${appEnv}".`,
    );
  }

  const dbUrl = env.DATABASE_URL || "";
  if (
    dbUrl &&
    !dbUrl.includes("localhost") &&
    !dbUrl.includes("127.0.0.1") &&
    !dbUrl.includes("supabase_db")
  ) {
    throw new SeedingSecurityError(
      "Refusing to seed non-local database target. DATABASE_URL must point to localhost or 127.0.0.1.",
    );
  }
}

/**
 * Returns the canonical synthetic demo dataset for local development and integration tests.
 */
export function getSeededDemoData(env?: Record<string, string | undefined>): DemoDataset {
  assertSafeSeedEnvironment(env);
  return createCanonicalDemoDataset();
}
