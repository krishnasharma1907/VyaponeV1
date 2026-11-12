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
