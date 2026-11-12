import type { TableRow } from "../factories/types";

export interface DemoDataset {
  platformAdmin: TableRow<"users">;
  resellerOwner: TableRow<"users">;
  resellerStaff: TableRow<"users">;
  workspace: TableRow<"workspaces">;
  workspaceMembers: TableRow<"workspace_members">[];
  businessOwner: TableRow<"users">;
  businessManager: TableRow<"users">;
  businessCashier: TableRow<"users">;
  business: TableRow<"businesses">;
  location: TableRow<"locations">;
  businessMembers: TableRow<"business_members">[];
  site: TableRow<"sites">;
  catalogueItems: TableRow<"catalogue_items">[];
  customers: TableRow<"customers">[];
  orders: TableRow<"orders">[];
  bills: TableRow<"bills">[];
  auditLogs: TableRow<"audit_logs">[];
}

export const DEMO_TIMESTAMP = "2026-11-01T09:00:00.000Z";

export function createCanonicalDemoDataset(): DemoDataset {
  // 1. Platform & Reseller Identities
  const platformAdmin: TableRow<"users"> = {
    id: "usr_platform_admin_0001",
    display_name: "Super Admin",
    email: "admin@example.vyapone.internal",
    phone_number: "+919999900001",
    status: "active",
    preferred_language: "en",
    created_at: DEMO_TIMESTAMP,
    updated_at: DEMO_TIMESTAMP,
  };

  const resellerOwner: TableRow<"users"> = {
    id: "usr_reseller_owner_0001",
    display_name: "Vikram Mehta",
    email: "vikram@example.vyapone.internal",
    phone_number: "+919876500001",
    status: "active",
    preferred_language: "en",
    created_at: DEMO_TIMESTAMP,
    updated_at: DEMO_TIMESTAMP,
  };

  const resellerStaff: TableRow<"users"> = {
    id: "usr_reseller_staff_0001",
    display_name: "Siddharth Rao",
    email: "siddharth@example.vyapone.internal",
    phone_number: "+919876500002",
    status: "active",
    preferred_language: "en",
    created_at: DEMO_TIMESTAMP,
    updated_at: DEMO_TIMESTAMP,
  };

  const workspace: TableRow<"workspaces"> = {
    id: "ws_apex_commerce_0001",
    name: "Apex Commerce Studio",
    slug: "apex-commerce-studio",
    owner_user_id: resellerOwner.id,
    status: "active",
    plan: "agency",
    created_at: DEMO_TIMESTAMP,
    updated_at: DEMO_TIMESTAMP,
  };

  const workspaceMembers: TableRow<"workspace_members">[] = [
    {
      id: "wsm_0001",
      workspace_id: workspace.id,
      user_id: resellerOwner.id,
      role: "reseller_admin",
      status: "active",
      created_at: DEMO_TIMESTAMP,
    },
    {
      id: "wsm_0002",
      workspace_id: workspace.id,
      user_id: resellerStaff.id,
      role: "reseller_staff",
      status: "active",
      created_at: DEMO_TIMESTAMP,
    },
  ];

  // 2. Sovereign Business, Location, and Members
  const businessOwner: TableRow<"users"> = {
    id: "usr_biz_owner_0001",
    display_name: "Priya Sharma",
    email: "priya@example.vyapone.internal",
    phone_number: "+919876510001",
    status: "active",
    preferred_language: "kn",
    created_at: DEMO_TIMESTAMP,
    updated_at: DEMO_TIMESTAMP,
  };

  const businessManager: TableRow<"users"> = {
    id: "usr_biz_mgr_0001",
    display_name: "Rajesh Kulkarni",
    email: "rajesh@example.vyapone.internal",
    phone_number: "+919876510002",
    status: "active",
    preferred_language: "en",
    created_at: DEMO_TIMESTAMP,
    updated_at: DEMO_TIMESTAMP,
  };

  const businessCashier: TableRow<"users"> = {
    id: "usr_biz_cashier_0001",
    display_name: "Deepa Nayak",
    email: "deepa@example.vyapone.internal",
    phone_number: "+919876510003",
    status: "active",
    preferred_language: "kn",
    created_at: DEMO_TIMESTAMP,
    updated_at: DEMO_TIMESTAMP,
  };

  const business: TableRow<"businesses"> = {
    id: "biz_kaveri_silks_0001",
    workspace_id: workspace.id,
    legal_name: "Kaveri Silks and Handlooms Private Limited",
    trade_name: "Kaveri Silks & Sarees",
    slug: "kaveri-silks",
    gst_number: "29AAAAA0000A1Z5",
    pan_number: "AAAAA0000A",
    status: "active",
    currency_code: "INR",
    sovereign_owner_id: businessOwner.id,
    created_at: DEMO_TIMESTAMP,
    updated_at: DEMO_TIMESTAMP,
  };

  const location: TableRow<"locations"> = {
    id: "loc_kaveri_commercial_st_0001",
    business_id: business.id,
    name: "Commercial Street Flagship Store",
    slug: "commercial-street",
    address_line1: "42 Commercial Street",
    address_line2: "Opposite Oriental Bank",
    city: "Bengaluru",
    state: "Karnataka",
    postal_code: "560001",
    is_primary: true,
    created_at: DEMO_TIMESTAMP,
    updated_at: DEMO_TIMESTAMP,
  };

  const businessMembers: TableRow<"business_members">[] = [
    {
      id: "bm_0001",
      business_id: business.id,
      user_id: businessOwner.id,
      role: "owner",
      location_id: null,
      permissions: { can_all: true },
      status: "active",
      created_at: DEMO_TIMESTAMP,
    },
    {
      id: "bm_0002",
      business_id: business.id,
      user_id: businessManager.id,
      role: "manager",
      location_id: location.id,
      permissions: { can_bill: true, can_manage_catalogue: true, can_view_reports: true },
      status: "active",
      created_at: DEMO_TIMESTAMP,
    },
    {
      id: "bm_0003",
      business_id: business.id,
      user_id: businessCashier.id,
      role: "cashier",
      location_id: location.id,
      permissions: { can_bill: true, can_tender_payments: true },
      status: "active",
      created_at: DEMO_TIMESTAMP,
    },
  ];

  // 3. Site and Catalogue Items (in Minor INR Units: paise)
  const site: TableRow<"sites"> = {
    id: "site_kaveri_0001",
    business_id: business.id,
    primary_domain: null,
    subdomain: "kaveri-silks",
    published_version_id: "ver_0001",
    status: "published",
    created_at: DEMO_TIMESTAMP,
    updated_at: DEMO_TIMESTAMP,
  };

  const catalogueItems: TableRow<"catalogue_items">[] = [
    {
      id: "cat_item_kanjeevaram_0001",
      business_id: business.id,
      location_id: location.id,
      title: "Bridal Kanjeevaram Pure Silk Saree",
      description: "Crimson red with pure gold zari work woven by master artisans",
      price_minor: 850000, // ₹8,500.00
      currency_code: "INR",
      tax_rate_id: null,
      sku: "KANJ-RED-001",
      is_available: true,
      created_at: DEMO_TIMESTAMP,
      updated_at: DEMO_TIMESTAMP,
    },
    {
      id: "cat_item_mysore_crepe_0002",
      business_id: business.id,
      location_id: location.id,
      title: "Mysuru Crepe Silk Saree",
      description: "Royal blue traditional lightweight silk saree with zari border",
      price_minor: 320000, // ₹3,200.00
      currency_code: "INR",
      tax_rate_id: null,
      sku: "MYS-BLU-002",
      is_available: true,
      created_at: DEMO_TIMESTAMP,
      updated_at: DEMO_TIMESTAMP,
    },
    {
      id: "cat_item_kasavu_0003",
      business_id: business.id,
      location_id: location.id,
      title: "Kerala Kasavu Cotton Handloom Saree",
      description: "Off-white traditional festive saree with golden border",
      price_minor: 125000, // ₹1,250.00
      currency_code: "INR",
      tax_rate_id: null,
      sku: "KAS-WHT-003",
      is_available: true,
      created_at: DEMO_TIMESTAMP,
      updated_at: DEMO_TIMESTAMP,
    },
  ];

  // 4. Customers
  const customers: TableRow<"customers">[] = [
    {
      id: "cust_ananya_0001",
      business_id: business.id,
      full_name: "Ananya Rao",
      phone_number: "+919876520001",
      email: "ananya.rao@example.vyapone.internal",
      total_spend_minor: 850000,
      visits_count: 1,
      created_at: DEMO_TIMESTAMP,
      updated_at: DEMO_TIMESTAMP,
    },
    {
      id: "cust_rahul_0002",
      business_id: business.id,
      full_name: "Rahul Verma",
      phone_number: "+919876520002",
      email: "rahul.verma@example.vyapone.internal",
      total_spend_minor: 320000,
      visits_count: 1,
      created_at: DEMO_TIMESTAMP,
      updated_at: DEMO_TIMESTAMP,
    },
  ];

  // 5. Orders and Statutory Gap-Free Sequential Bills
  const orders: TableRow<"orders">[] = [
    {
      id: "ord_2026_0001",
      business_id: business.id,
      location_id: location.id,
      customer_id: customers[0].id,
      order_number: "ORD-2026-0001",
      status: "completed",
      total_minor: 850000, // ₹8,500.00
      payment_status: "paid",
      currency_code: "INR",
      notes: "In-store counter POS order. Paid via UPI QR.",
      created_at: DEMO_TIMESTAMP,
      updated_at: DEMO_TIMESTAMP,
    },
    {
      id: "ord_2026_0002",
      business_id: business.id,
      location_id: location.id,
      customer_id: customers[1].id,
      order_number: "ORD-2026-0002",
      status: "confirmed",
      total_minor: 320000, // ₹3,200.00
      payment_status: "received",
      currency_code: "INR",
      notes: "Counter cash payment received.",
      created_at: DEMO_TIMESTAMP,
      updated_at: DEMO_TIMESTAMP,
    },
  ];

  const bills: TableRow<"bills">[] = [
    {
      id: "bill_2026_0001",
      business_id: business.id,
      location_id: location.id,
      customer_id: customers[0].id,
      invoice_number: "INV/2026-27/0001",
      financial_year: "2026-27",
      amount_minor: 720339, // ₹7,203.39 base
      tax_minor: 129661, // ₹1,296.61 (18% GST: 9% CGST + 9% SGST)
      total_minor: 850000, // ₹8,500.00 total
      currency_code: "INR",
      status: "paid",
      created_at: DEMO_TIMESTAMP,
      updated_at: DEMO_TIMESTAMP,
    },
  ];

  // 6. Audit Trail
  const auditLogs: TableRow<"audit_logs">[] = [
    {
      id: "aud_0001",
      business_id: business.id,
      workspace_id: workspace.id,
      user_id: businessOwner.id,
      action: "order.created",
      resource: "orders",
      metadata_json: {
        order_number: "ORD-2026-0001",
        total_minor: 850000,
      },
      ip_address: "127.0.0.1",
      created_at: DEMO_TIMESTAMP,
    },
    {
      id: "aud_0002",
      business_id: business.id,
      workspace_id: workspace.id,
      user_id: businessOwner.id,
      action: "bill.issued",
      resource: "bills",
      metadata_json: {
        invoice_number: "INV/2026-27/0001",
        total_minor: 850000,
      },
      ip_address: "127.0.0.1",
      created_at: DEMO_TIMESTAMP,
    },
  ];

  return {
    platformAdmin,
    resellerOwner,
    resellerStaff,
    workspace,
    workspaceMembers,
    businessOwner,
    businessManager,
    businessCashier,
    business,
    location,
    businessMembers,
    site,
    catalogueItems,
    customers,
    orders,
    bills,
    auditLogs,
  };
}
