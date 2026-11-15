import { BASE_TEST_TIMESTAMP, formatDeterministicId, type TableRow } from "./types";

export function createTestWorkspace(
  overrides: Partial<TableRow<"workspaces">> = {},
): TableRow<"workspaces"> {
  const id = overrides.id ?? formatDeterministicId("ws");
  return {
    id,
    name: "Test Reseller Workspace",
    slug: `test-workspace-${id}`,
    owner_user_id: overrides.owner_user_id ?? formatDeterministicId("usr"),
    status: "active",
    plan: "agency",
    created_at: BASE_TEST_TIMESTAMP,
    updated_at: BASE_TEST_TIMESTAMP,
    ...overrides,
  };
}

export function createTestWorkspaceMember(
  overrides: Partial<TableRow<"workspace_members">> = {},
): TableRow<"workspace_members"> {
  const id = overrides.id ?? formatDeterministicId("wsm");
  return {
    id,
    workspace_id: overrides.workspace_id ?? formatDeterministicId("ws"),
    user_id: overrides.user_id ?? formatDeterministicId("usr"),
    role: "reseller_admin",
    status: "active",
    created_at: BASE_TEST_TIMESTAMP,
    ...overrides,
  };
}

export function createTestWorkspaceInvitation(
  overrides: Partial<TableRow<"workspace_invitations">> = {},
): TableRow<"workspace_invitations"> {
  const id = overrides.id ?? formatDeterministicId("wsi");
  return {
    id,
    workspace_id: overrides.workspace_id ?? formatDeterministicId("ws"),
    email: "invitee@example.vyapone.internal",
    role: "workspace_member",
    token_hash: "mock_sha256_token_hash_for_test",
    invited_by: overrides.invited_by ?? formatDeterministicId("usr"),
    status: "pending",
    expires_at: "2026-11-08T10:00:00.000Z",
    created_at: BASE_TEST_TIMESTAMP,
    ...overrides,
  };
}

export function createTestSubscription(
  overrides: Partial<TableRow<"subscriptions">> = {},
): TableRow<"subscriptions"> {
  const id = overrides.id ?? formatDeterministicId("sub");
  return {
    id,
    workspace_id: overrides.workspace_id ?? formatDeterministicId("ws"),
    plan_id: "starter",
    status: "active",
    current_period_start: BASE_TEST_TIMESTAMP,
    current_period_end: "2026-12-01T00:00:00.000Z",
    grace_period_end: null,
    provider_reference: null,
    created_at: BASE_TEST_TIMESTAMP,
    updated_at: BASE_TEST_TIMESTAMP,
    ...overrides,
  };
}

export function createTestEntitlementOverride(
  overrides: Partial<TableRow<"entitlement_overrides">> = {},
): TableRow<"entitlement_overrides"> {
  const id = overrides.id ?? formatDeterministicId("eno");
  return {
    id,
    workspace_id: overrides.workspace_id ?? formatDeterministicId("ws"),
    business_id: null,
    feature_key: "custom_domain",
    is_enabled: true,
    expires_at: null,
    reason: "Test override grant",
    granted_by: overrides.granted_by ?? formatDeterministicId("usr"),
    created_at: BASE_TEST_TIMESTAMP,
    updated_at: BASE_TEST_TIMESTAMP,
    ...overrides,
  };
}

export function createTestCapacityOverride(
  overrides: Partial<TableRow<"capacity_overrides">> = {},
): TableRow<"capacity_overrides"> {
  const id = overrides.id ?? formatDeterministicId("cao");
  return {
    id,
    workspace_id: overrides.workspace_id ?? formatDeterministicId("ws"),
    metric: "live_websites",
    additional_capacity: 5,
    expires_at: null,
    reason: "Test capacity boost",
    granted_by: overrides.granted_by ?? formatDeterministicId("usr"),
    created_at: BASE_TEST_TIMESTAMP,
    updated_at: BASE_TEST_TIMESTAMP,
    ...overrides,
  };
}
