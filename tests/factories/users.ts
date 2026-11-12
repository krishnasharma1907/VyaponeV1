import { BASE_TEST_TIMESTAMP, formatDeterministicId, type TableRow } from "./types";

export function createTestUser(overrides: Partial<TableRow<"users">> = {}): TableRow<"users"> {
  const id = overrides.id ?? formatDeterministicId("usr");
  return {
    id,
    display_name: "Test User",
    email: `${id}@example.vyapone.internal`,
    phone_number: "+919876543210",
    status: "active",
    preferred_language: "en",
    created_at: BASE_TEST_TIMESTAMP,
    updated_at: BASE_TEST_TIMESTAMP,
    ...overrides,
  };
}

export function createTestUserAuthIdentity(
  overrides: Partial<TableRow<"user_auth_identities">> = {},
): TableRow<"user_auth_identities"> {
  const id = overrides.id ?? formatDeterministicId("uai");
  const userId = overrides.user_id ?? formatDeterministicId("usr");
  return {
    id,
    user_id: userId,
    provider: "phone_otp",
    identifier: "+919876543210",
    verified_at: BASE_TEST_TIMESTAMP,
    created_at: BASE_TEST_TIMESTAMP,
    ...overrides,
  };
}
