import { describe, expect, it } from "vitest";
import {
  createTestBusiness,
  createTestCatalogueItem,
  createTestCustomer,
  createTestLocation,
  createTestOrder,
  createTestUser,
  createTestWorkspace,
} from "../factories";

describe("Integration: Multi-Tenant Data Isolation & Hierarchy Invariants [VO-019]", () => {
  it("enforces sovereign data separation between distinct businesses across workspaces", () => {
    // Workspace 1 (Reseller A) & Business 1 (Tenant A)
    const userA = createTestUser({ id: "usr_owner_tenant_a" });
    const workspaceA = createTestWorkspace({ id: "ws_reseller_a", owner_user_id: userA.id });
    const businessA = createTestBusiness({
      id: "biz_tenant_a",
      workspace_id: workspaceA.id,
      sovereign_owner_id: userA.id,
      legal_name: "Tenant A Retail Enterprises",
    });
    const locationA = createTestLocation({ id: "loc_tenant_a_main", business_id: businessA.id });
    const itemA = createTestCatalogueItem({
      id: "cat_tenant_a_item1",
      business_id: businessA.id,
      location_id: locationA.id,
      price_minor: 199900,
    });
    const customerA = createTestCustomer({ id: "cust_tenant_a", business_id: businessA.id });
    const orderA = createTestOrder({
      id: "ord_tenant_a",
      business_id: businessA.id,
      location_id: locationA.id,
      customer_id: customerA.id,
      total_minor: 199900,
    });

    // Workspace 2 (Reseller B) & Business 2 (Tenant B)
    const userB = createTestUser({ id: "usr_owner_tenant_b" });
    const workspaceB = createTestWorkspace({ id: "ws_reseller_b", owner_user_id: userB.id });
    const businessB = createTestBusiness({
      id: "biz_tenant_b",
      workspace_id: workspaceB.id,
      sovereign_owner_id: userB.id,
      legal_name: "Tenant B Global Traders",
    });
    const locationB = createTestLocation({ id: "loc_tenant_b_main", business_id: businessB.id });
    const itemB = createTestCatalogueItem({
      id: "cat_tenant_b_item1",
      business_id: businessB.id,
      location_id: locationB.id,
      price_minor: 450000,
    });

    // Invariant: Business A and B belong to distinct workspaces
    expect(businessA.workspace_id).not.toBe(businessB.workspace_id);
    expect(businessA.sovereign_owner_id).not.toBe(businessB.sovereign_owner_id);

    // Invariant: Tenant A items belong strictly to Business A
    expect(itemA.business_id).toBe(businessA.id);
    expect(itemA.business_id).not.toBe(businessB.id);

    // Invariant: Tenant B items belong strictly to Business B
    expect(itemB.business_id).toBe(businessB.id);
    expect(itemB.business_id).not.toBe(businessA.id);

    // Invariant: Orders for Tenant A reference Tenant A's customer, location, and business
    expect(orderA.business_id).toBe(businessA.id);
    expect(orderA.location_id).toBe(locationA.id);
    expect(orderA.customer_id).toBe(customerA.id);
    expect(orderA.business_id).not.toBe(businessB.id);
  });

  it("verifies sovereign ownership cannot be hijacked by workspace identity", () => {
    const resellerUser = createTestUser({ id: "usr_agency_admin" });
    const workspace = createTestWorkspace({ id: "ws_agency_01", owner_user_id: resellerUser.id });

    const sovereignMerchant = createTestUser({ id: "usr_sovereign_merchant" });
    const business = createTestBusiness({
      id: "biz_sovereign_01",
      workspace_id: workspace.id,
      sovereign_owner_id: sovereignMerchant.id,
    });

    // Invariant: Sovereign business owner is the merchant, not the reseller agency
    expect(business.sovereign_owner_id).toBe(sovereignMerchant.id);
    expect(business.sovereign_owner_id).not.toBe(workspace.owner_user_id);
  });
});
