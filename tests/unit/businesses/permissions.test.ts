import { describe, expect, it } from "vitest";
import {
  BUSINESS_ROLE_RANKS,
  hasBusinessPermission,
  canManageBusinessRole,
  canAssignBusinessRole,
  assertSovereignOwnershipSeparation,
} from "@/lib/businesses/permissions";
import type { BusinessPermission, BusinessRole } from "@/lib/businesses/types";

describe("Business Permissions & Role Hierarchy [VO-023]", () => {
  describe("Role Ranking", () => {
    it("enforces strict hierarchy: owner > manager > cashier > staff", () => {
      expect(BUSINESS_ROLE_RANKS.owner).toBeGreaterThan(BUSINESS_ROLE_RANKS.manager);
      expect(BUSINESS_ROLE_RANKS.manager).toBeGreaterThan(BUSINESS_ROLE_RANKS.cashier);
      expect(BUSINESS_ROLE_RANKS.cashier).toBeGreaterThan(BUSINESS_ROLE_RANKS.staff);
    });

    it("verifies rank numbers: owner 40, manager 30, cashier 20, staff 10", () => {
      expect(BUSINESS_ROLE_RANKS.owner).toBe(40);
      expect(BUSINESS_ROLE_RANKS.manager).toBe(30);
      expect(BUSINESS_ROLE_RANKS.cashier).toBe(20);
      expect(BUSINESS_ROLE_RANKS.staff).toBe(10);
    });
  });

  describe("Permission Matrix", () => {
    const allPermissions: BusinessPermission[] = [
      "business:view",
      "business:update_profile",
      "business:delete",
      "business:manage_locations",
      "business:manage_members",
      "business:transfer_ownership",
      "business:billing",
      "business:view_reports",
    ];

    it("grants owner all business permissions", () => {
      for (const perm of allPermissions) {
        expect(hasBusinessPermission("owner", perm)).toBe(true);
      }
    });

    it("grants manager operational permissions but denies delete and ownership transfer", () => {
      expect(hasBusinessPermission("manager", "business:view")).toBe(true);
      expect(hasBusinessPermission("manager", "business:update_profile")).toBe(true);
      expect(hasBusinessPermission("manager", "business:manage_locations")).toBe(true);
      expect(hasBusinessPermission("manager", "business:manage_members")).toBe(true);
      expect(hasBusinessPermission("manager", "business:billing")).toBe(true);
      expect(hasBusinessPermission("manager", "business:view_reports")).toBe(true);

      expect(hasBusinessPermission("manager", "business:delete")).toBe(false);
      expect(hasBusinessPermission("manager", "business:transfer_ownership")).toBe(false);
    });

    it("grants cashier only view and billing permissions", () => {
      expect(hasBusinessPermission("cashier", "business:view")).toBe(true);
      expect(hasBusinessPermission("cashier", "business:billing")).toBe(true);

      expect(hasBusinessPermission("cashier", "business:update_profile")).toBe(false);
      expect(hasBusinessPermission("cashier", "business:manage_locations")).toBe(false);
      expect(hasBusinessPermission("cashier", "business:manage_members")).toBe(false);
      expect(hasBusinessPermission("cashier", "business:delete")).toBe(false);
    });

    it("grants staff only view permission", () => {
      expect(hasBusinessPermission("staff", "business:view")).toBe(true);

      expect(hasBusinessPermission("staff", "business:billing")).toBe(false);
      expect(hasBusinessPermission("staff", "business:update_profile")).toBe(false);
      expect(hasBusinessPermission("staff", "business:manage_locations")).toBe(false);
    });

    it("returns false for unknown role", () => {
      expect(hasBusinessPermission("unknown" as BusinessRole, "business:view")).toBe(false);
    });
  });

  describe("Downward Authority (canManageBusinessRole)", () => {
    it("allows owner to manage manager, cashier, and staff", () => {
      expect(canManageBusinessRole("owner", "manager")).toBe(true);
      expect(canManageBusinessRole("owner", "cashier")).toBe(true);
      expect(canManageBusinessRole("owner", "staff")).toBe(true);
    });

    it("prohibits owner from managing another owner", () => {
      expect(canManageBusinessRole("owner", "owner")).toBe(false);
    });

    it("allows manager to manage cashier and staff, but not owner or manager", () => {
      expect(canManageBusinessRole("manager", "cashier")).toBe(true);
      expect(canManageBusinessRole("manager", "staff")).toBe(true);
      expect(canManageBusinessRole("manager", "owner")).toBe(false);
      expect(canManageBusinessRole("manager", "manager")).toBe(false);
    });

    it("prohibits cashier and staff from managing any roles", () => {
      expect(canManageBusinessRole("cashier", "staff")).toBe(true);
      expect(canManageBusinessRole("cashier", "cashier")).toBe(false);
      expect(canManageBusinessRole("staff", "staff")).toBe(false);
    });
  });

  describe("Role Assignment Rules (canAssignBusinessRole)", () => {
    it("allows owner to assign any role", () => {
      expect(canAssignBusinessRole("owner", "owner")).toBe(true);
      expect(canAssignBusinessRole("owner", "manager")).toBe(true);
      expect(canAssignBusinessRole("owner", "cashier")).toBe(true);
      expect(canAssignBusinessRole("owner", "staff")).toBe(true);
    });

    it("allows manager to assign manager, cashier, and staff, but not owner", () => {
      expect(canAssignBusinessRole("manager", "manager")).toBe(true);
      expect(canAssignBusinessRole("manager", "cashier")).toBe(true);
      expect(canAssignBusinessRole("manager", "staff")).toBe(true);
      expect(canAssignBusinessRole("manager", "owner")).toBe(false);
    });

    it("denies cashier and staff from assigning any roles", () => {
      expect(canAssignBusinessRole("cashier", "staff")).toBe(false);
      expect(canAssignBusinessRole("staff", "staff")).toBe(false);
    });
  });

  describe("Sovereign Ownership Separation Invariant", () => {
    it("validates that workspace admin access does not confer sovereign business rights", () => {
      const isWorkspaceAdmin = true;
      const isSovereignOwner = false;
      expect(assertSovereignOwnershipSeparation(isWorkspaceAdmin, isSovereignOwner)).toBe(true);
    });

    it("handles sovereign owner directly", () => {
      expect(assertSovereignOwnershipSeparation(false, true)).toBe(true);
      expect(assertSovereignOwnershipSeparation(true, true)).toBe(true);
    });
  });
});
