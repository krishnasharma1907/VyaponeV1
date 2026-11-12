import { describe, expect, it } from "vitest";
import {
  assertSafeSeedEnvironment,
  getSeededDemoData,
  SeedingSecurityError,
} from "@/lib/database/seed";
import { createCanonicalDemoDataset } from "../../fixtures/demo-seed";

describe("Canonical Seeded Demo Dataset & Security Guards [VO-019]", () => {
  it("generates a complete, structurally sound multi-tenant demo hierarchy", () => {
    const data = createCanonicalDemoDataset();

    // Verify Platform Admin
    expect(data.platformAdmin.id).toBe("usr_platform_admin_0001");
    expect(data.platformAdmin.email).toContain("@example.vyapone.internal");

    // Verify Workspace & Ownership
    expect(data.workspace.owner_user_id).toBe(data.resellerOwner.id);
    expect(data.workspaceMembers).toHaveLength(2);
    expect(data.workspaceMembers[0].user_id).toBe(data.resellerOwner.id);
    expect(data.workspaceMembers[1].user_id).toBe(data.resellerStaff.id);

    // Verify Sovereign Business Ownership & Location Hierarchy
    expect(data.business.workspace_id).toBe(data.workspace.id);
    expect(data.business.sovereign_owner_id).toBe(data.businessOwner.id);
    expect(data.business.currency_code).toBe("INR");
    expect(data.location.business_id).toBe(data.business.id);
    expect(data.location.is_primary).toBe(true);

    // Verify Business Staff Roles & Scopes
    expect(data.businessMembers).toHaveLength(3);
    const roles = data.businessMembers.map((m) => m.role);
    expect(roles).toEqual(["owner", "manager", "cashier"]);

    // Verify Published Site
    expect(data.site.business_id).toBe(data.business.id);
    expect(data.site.subdomain).toBe("kaveri-silks");
    expect(data.site.status).toBe("published");
  });

  it("enforces minor integer monetary math on catalogue items, orders, and bills", () => {
    const data = createCanonicalDemoDataset();

    // Check Catalogue items
    expect(data.catalogueItems).toHaveLength(3);
    for (const item of data.catalogueItems) {
      expect(Number.isInteger(item.price_minor)).toBe(true);
      expect(item.currency_code).toBe("INR");
    }

    // Check Bill invoice math: base + tax === total
    expect(data.bills).toHaveLength(1);
    const bill = data.bills[0];
    expect(bill.invoice_number).toBe("INV/2026-27/0001");
    expect(bill.amount_minor).toBe(720339);
    expect(bill.tax_minor).toBe(129661);
    expect(bill.total_minor).toBe(850000);
    expect(bill.amount_minor + bill.tax_minor).toBe(bill.total_minor);

    // Check Order matches Bill total
    expect(data.orders).toHaveLength(2);
    const primaryOrder = data.orders[0];
    expect(primaryOrder.total_minor).toBe(bill.total_minor);
    expect(primaryOrder.payment_status).toBe("paid");
  });

  it("blocks seeding execution if NODE_ENV is production", () => {
    expect(() => {
      assertSafeSeedEnvironment({
        NODE_ENV: "production",
      });
    }).toThrow(SeedingSecurityError);

    expect(() => {
      assertSafeSeedEnvironment({
        NODE_ENV: "production",
      });
    }).toThrow(/Database seeding is strictly forbidden in production/);
  });

  it("blocks seeding execution if NEXT_PUBLIC_APP_ENV is production or staging", () => {
    expect(() => {
      assertSafeSeedEnvironment({
        NODE_ENV: "development",
        NEXT_PUBLIC_APP_ENV: "production",
      });
    }).toThrow(SeedingSecurityError);

    expect(() => {
      assertSafeSeedEnvironment({
        NODE_ENV: "development",
        NEXT_PUBLIC_APP_ENV: "staging",
      });
    }).toThrow(/Database seeding cannot run when NEXT_PUBLIC_APP_ENV is/);
  });

  it("blocks seeding if DATABASE_URL points to a remote host", () => {
    expect(() => {
      assertSafeSeedEnvironment({
        NODE_ENV: "development",
        NEXT_PUBLIC_APP_ENV: "development",
        DATABASE_URL: "postgresql://postgres:secret@db.projectref.supabase.co:5432/postgres",
      });
    }).toThrow(SeedingSecurityError);

    expect(() => {
      assertSafeSeedEnvironment({
        NODE_ENV: "development",
        NEXT_PUBLIC_APP_ENV: "development",
        DATABASE_URL: "postgresql://postgres:secret@db.projectref.supabase.co:5432/postgres",
      });
    }).toThrow(/Refusing to seed non-local database target/);
  });

  it("allows seeding with local database target in development", () => {
    const devEnv = {
      NODE_ENV: "development",
      NEXT_PUBLIC_APP_ENV: "development",
      DATABASE_URL: "postgresql://postgres:postgres@localhost:54322/postgres",
    };

    expect(() => assertSafeSeedEnvironment(devEnv)).not.toThrow();
    const data = getSeededDemoData(devEnv);
    expect(data.business.legal_name).toContain("Kaveri Silks");
  });
});
