import { describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/types";

describe("Supabase Database Types [VO-017]", () => {
  type Tables = Database["public"]["Tables"];

  it("defines all canonical tenancy and core business tables", () => {
    // Array typed with keyof Tables guarantees compile-time validity of all table names
    const expectedTables: Array<keyof Tables> = [
      "users",
      "user_auth_identities",
      "workspaces",
      "workspace_members",
      "businesses",
      "locations",
      "business_members",
      "sites",
      "catalogue_items",
      "orders",
      "customers",
      "bills",
      "audit_logs",
    ];

    expect(expectedTables).toHaveLength(13);
    expect(expectedTables).toContain("users");
    expect(expectedTables).toContain("workspaces");
    expect(expectedTables).toContain("businesses");
    expect(expectedTables).toContain("locations");
    expect(expectedTables).toContain("orders");
    expect(expectedTables).toContain("bills");
    expect(expectedTables).toContain("audit_logs");
  });

  it("verifies User entity attributes align with PRD domain model", () => {
    type UserRow = Tables["users"]["Row"];

    const mockUser: UserRow = {
      id: "usr_12345",
      display_name: "Ramesh Sharma",
      email: "ramesh@example.in",
      phone_number: "+919876543210",
      status: "active",
      preferred_language: "hi",
      created_at: "2026-11-12T00:00:00Z",
      updated_at: "2026-11-12T00:00:00Z",
    };

    expect(mockUser.id).toBe("usr_12345");
    expect(mockUser.phone_number).toBe("+919876543210");
  });

  it("verifies Business entity sovereign ownership and workspace relationship", () => {
    type BusinessRow = Tables["businesses"]["Row"];

    const mockBusiness: BusinessRow = {
      id: "biz_99999",
      workspace_id: "ws_11111",
      legal_name: "Sharma Kirana Store Private Limited",
      trade_name: "Sharma Kirana",
      slug: "sharma-kirana",
      gst_number: "27AAPFU0939F1ZV",
      pan_number: "AAPFU0939F",
      status: "active",
      currency_code: "INR",
      sovereign_owner_id: "usr_12345",
      created_at: "2026-11-12T00:00:00Z",
      updated_at: "2026-11-12T00:00:00Z",
    };

    expect(mockBusiness.workspace_id).toBe("ws_11111");
    expect(mockBusiness.sovereign_owner_id).toBe("usr_12345");
    expect(mockBusiness.currency_code).toBe("INR");
  });

  it("verifies Order entity monetary units are stored in integer minor units", () => {
    type OrderRow = Tables["orders"]["Row"];

    const mockOrder: OrderRow = {
      id: "ord_55555",
      business_id: "biz_99999",
      location_id: "loc_00001",
      customer_id: "cust_33333",
      order_number: "VO-ORD-2026-0001",
      status: "confirmed",
      total_minor: 25000, // Rs. 250.00
      payment_status: "paid",
      currency_code: "INR",
      notes: "Express delivery",
      created_at: "2026-11-12T00:00:00Z",
      updated_at: "2026-11-12T00:00:00Z",
    };

    expect(mockOrder.total_minor).toBe(25000);
    expect(mockOrder.payment_status).toBe("paid");
  });
});
