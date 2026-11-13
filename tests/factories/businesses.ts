import { BASE_TEST_TIMESTAMP, formatDeterministicId, type TableRow } from "./types";

export function createTestBusiness(
  overrides: Partial<TableRow<"businesses">> = {},
): TableRow<"businesses"> {
  const id = overrides.id ?? formatDeterministicId("biz");
  return {
    id,
    workspace_id:
      overrides.workspace_id !== undefined ? overrides.workspace_id : formatDeterministicId("ws"),
    legal_name: "Test Local Business Private Limited",
    trade_name: "Test Store",
    slug: `test-store-${id}`,
    gst_number: "29AAAAA0000A1Z5",
    pan_number: "AAAAA0000A",
    status: "active",
    currency_code: "INR",
    sovereign_owner_id: overrides.sovereign_owner_id ?? formatDeterministicId("usr"),
    created_at: BASE_TEST_TIMESTAMP,
    updated_at: BASE_TEST_TIMESTAMP,
    ...overrides,
  };
}

export function createTestLocation(
  overrides: Partial<TableRow<"locations">> = {},
): TableRow<"locations"> {
  const id = overrides.id ?? formatDeterministicId("loc");
  return {
    id,
    business_id: overrides.business_id ?? formatDeterministicId("biz"),
    name: "Main Branch",
    slug: `main-branch-${id}`,
    address_line1: "100 MG Road",
    address_line2: "Near Metro Station",
    city: "Bengaluru",
    state: "Karnataka",
    postal_code: "560001",
    is_primary: true,
    created_at: BASE_TEST_TIMESTAMP,
    updated_at: BASE_TEST_TIMESTAMP,
    ...overrides,
  };
}

export function createTestBusinessMember(
  overrides: Partial<TableRow<"business_members">> = {},
): TableRow<"business_members"> {
  const id = overrides.id ?? formatDeterministicId("bm");
  return {
    id,
    business_id: overrides.business_id ?? formatDeterministicId("biz"),
    user_id: overrides.user_id ?? formatDeterministicId("usr"),
    role: "owner",
    location_id: overrides.location_id ?? null,
    permissions: {
      can_bill: true,
      can_manage_catalogue: true,
      can_view_reports: true,
      can_edit_settings: true,
    },
    status: "active",
    created_at: BASE_TEST_TIMESTAMP,
    ...overrides,
  };
}

export function createTestSite(overrides: Partial<TableRow<"sites">> = {}): TableRow<"sites"> {
  const id = overrides.id ?? formatDeterministicId("site");
  const businessId = overrides.business_id ?? formatDeterministicId("biz");
  return {
    id,
    business_id: businessId,
    primary_domain: null,
    subdomain: `store-${id}`,
    published_version_id: null,
    status: "published",
    created_at: BASE_TEST_TIMESTAMP,
    updated_at: BASE_TEST_TIMESTAMP,
    ...overrides,
  };
}
