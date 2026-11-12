import { beforeEach, describe, expect, it } from "vitest";
import {
  BASE_TEST_TIMESTAMP,
  createTestAuditLog,
  createTestBill,
  createTestBusiness,
  createTestBusinessMember,
  createTestCatalogueItem,
  createTestCustomer,
  createTestLocation,
  createTestOrder,
  createTestSite,
  createTestUser,
  createTestUserAuthIdentity,
  createTestWorkspace,
  createTestWorkspaceMember,
  resetFactorySequence,
} from "../../factories";

describe("Test Factories & Entity Fixture Builders [VO-019]", () => {
  beforeEach(() => {
    resetFactorySequence();
  });

  it("generates deterministic user and auth identity fixtures", () => {
    const user1 = createTestUser();
    const user2 = createTestUser();

    expect(user1.id).toBe("usr_0001");
    expect(user2.id).toBe("usr_0002");
    expect(user1.display_name).toBe("Test User");
    expect(user1.email).toBe("usr_0001@example.vyapone.internal");
    expect(user1.phone_number).toBe("+919876543210");
    expect(user1.created_at).toBe(BASE_TEST_TIMESTAMP);

    const authIdentity = createTestUserAuthIdentity({ user_id: user1.id });
    expect(authIdentity.id).toBe("uai_0003");
    expect(authIdentity.user_id).toBe("usr_0001");
    expect(authIdentity.provider).toBe("phone_otp");
  });

  it("generates deterministic multi-tenant workspace and member fixtures", () => {
    const workspace = createTestWorkspace({ name: "Karnataka Commerce Partners" });
    const member = createTestWorkspaceMember({
      workspace_id: workspace.id,
      role: "reseller_admin",
    });

    expect(workspace.id).toBe("ws_0001");
    expect(workspace.name).toBe("Karnataka Commerce Partners");
    expect(workspace.plan).toBe("agency");
    expect(member.workspace_id).toBe("ws_0001");
    expect(member.role).toBe("reseller_admin");
  });

  it("generates deterministic business, location, member, and site fixtures", () => {
    const business = createTestBusiness({
      legal_name: "Mysuru Crafts Enterprise Pvt Ltd",
      trade_name: "Mysuru Crafts",
      currency_code: "INR",
    });

    const location = createTestLocation({
      business_id: business.id,
      city: "Mysuru",
      state: "Karnataka",
      postal_code: "570001",
    });

    const member = createTestBusinessMember({
      business_id: business.id,
      role: "owner",
    });

    const site = createTestSite({
      business_id: business.id,
      subdomain: "mysuru-crafts",
    });

    expect(business.id).toBe("biz_0001");
    expect(business.currency_code).toBe("INR");
    expect(business.gst_number).toBe("29AAAAA0000A1Z5");
    expect(location.business_id).toBe("biz_0001");
    expect(location.city).toBe("Mysuru");
    expect(member.business_id).toBe("biz_0001");
    expect(site.business_id).toBe("biz_0001");
    expect(site.subdomain).toBe("mysuru-crafts");
  });

  it("strictly enforces integer minor units for monetary fixtures (paise / cents)", () => {
    const item = createTestCatalogueItem({ price_minor: 125050 });
    const bill = createTestBill({
      amount_minor: 105975,
      tax_minor: 19075,
      total_minor: 125050,
    });

    expect(Number.isInteger(item.price_minor)).toBe(true);
    expect(Number.isInteger(bill.amount_minor)).toBe(true);
    expect(Number.isInteger(bill.tax_minor)).toBe(true);
    expect(Number.isInteger(bill.total_minor)).toBe(true);
    expect(bill.amount_minor + bill.tax_minor).toBe(bill.total_minor);
  });

  it("generates deterministic commerce orders, bills, customers, and audit logs", () => {
    const customer = createTestCustomer({ full_name: "Priya Sharma" });
    const order = createTestOrder({ customer_id: customer.id, total_minor: 499900 });
    const bill = createTestBill({ customer_id: customer.id, total_minor: 499900 });
    const auditLog = createTestAuditLog({ action: "order.placed" });

    expect(customer.id).toBe("cust_0001");
    expect(customer.full_name).toBe("Priya Sharma");
    expect(order.customer_id).toBe("cust_0001");
    expect(order.payment_status).toBe("paid");
    expect(bill.invoice_number).toMatch(/^INV\/2026-27\/\d{4}$/);
    expect(auditLog.action).toBe("order.placed");
  });

  it("supports explicit overrides taking complete precedence", () => {
    const customUser = createTestUser({
      id: "usr_custom_9999",
      display_name: "Overridden Name",
      preferred_language: "hi",
    });

    expect(customUser.id).toBe("usr_custom_9999");
    expect(customUser.display_name).toBe("Overridden Name");
    expect(customUser.preferred_language).toBe("hi");
  });
});
