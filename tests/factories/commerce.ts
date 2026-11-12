import { BASE_TEST_TIMESTAMP, formatDeterministicId, type TableRow } from "./types";

export function createTestCatalogueItem(
  overrides: Partial<TableRow<"catalogue_items">> = {},
): TableRow<"catalogue_items"> {
  const id = overrides.id ?? formatDeterministicId("cat");
  return {
    id,
    business_id: overrides.business_id ?? formatDeterministicId("biz"),
    location_id: overrides.location_id ?? null,
    title: "Artisanal Silk Saree",
    description: "Handcrafted pure silk saree with zari border",
    price_minor: 499900, // ₹4,999.00 in minor paise units
    currency_code: "INR",
    tax_rate_id: null,
    sku: `SKU-${id.toUpperCase()}`,
    is_available: true,
    created_at: BASE_TEST_TIMESTAMP,
    updated_at: BASE_TEST_TIMESTAMP,
    ...overrides,
  };
}

export function createTestCustomer(
  overrides: Partial<TableRow<"customers">> = {},
): TableRow<"customers"> {
  const id = overrides.id ?? formatDeterministicId("cust");
  return {
    id,
    business_id: overrides.business_id ?? formatDeterministicId("biz"),
    full_name: "Demo Customer",
    phone_number: "+919876543211",
    email: `${id}@example.vyapone.internal`,
    total_spend_minor: 499900,
    visits_count: 1,
    created_at: BASE_TEST_TIMESTAMP,
    updated_at: BASE_TEST_TIMESTAMP,
    ...overrides,
  };
}

export function createTestOrder(overrides: Partial<TableRow<"orders">> = {}): TableRow<"orders"> {
  const id = overrides.id ?? formatDeterministicId("ord");
  return {
    id,
    business_id: overrides.business_id ?? formatDeterministicId("biz"),
    location_id: overrides.location_id ?? formatDeterministicId("loc"),
    customer_id: overrides.customer_id ?? null,
    order_number: `ORD-2026-${id.slice(-4)}`,
    status: "confirmed",
    total_minor: 499900, // ₹4,999.00 in paise
    payment_status: "paid",
    currency_code: "INR",
    notes: "Counter POS order",
    created_at: BASE_TEST_TIMESTAMP,
    updated_at: BASE_TEST_TIMESTAMP,
    ...overrides,
  };
}

export function createTestBill(overrides: Partial<TableRow<"bills">> = {}): TableRow<"bills"> {
  const id = overrides.id ?? formatDeterministicId("bill");
  // ₹4,236.44 base + ₹762.56 18% GST = ₹4,999.00 total
  return {
    id,
    business_id: overrides.business_id ?? formatDeterministicId("biz"),
    location_id: overrides.location_id ?? formatDeterministicId("loc"),
    customer_id: overrides.customer_id ?? null,
    invoice_number: `INV/2026-27/${id.slice(-4)}`,
    financial_year: "2026-27",
    amount_minor: 423644,
    tax_minor: 76256,
    total_minor: 499900,
    currency_code: "INR",
    status: "issued",
    created_at: BASE_TEST_TIMESTAMP,
    updated_at: BASE_TEST_TIMESTAMP,
    ...overrides,
  };
}

export function createTestAuditLog(
  overrides: Partial<TableRow<"audit_logs">> = {},
): TableRow<"audit_logs"> {
  const id = overrides.id ?? formatDeterministicId("aud");
  return {
    id,
    business_id: overrides.business_id ?? formatDeterministicId("biz"),
    workspace_id: overrides.workspace_id ?? null,
    user_id: overrides.user_id ?? formatDeterministicId("usr"),
    action: "bill.created",
    resource: "bills",
    metadata_json: {
      invoice_number: "INV/2026-27/0001",
      total_minor: 499900,
    },
    ip_address: "127.0.0.1",
    created_at: BASE_TEST_TIMESTAMP,
    ...overrides,
  };
}
