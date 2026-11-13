import { describe, expect, it } from "vitest";
import {
  businessSlugSchema,
  locationSlugSchema,
  postalCodeSchema,
  gstinSchema,
  panSchema,
  createBusinessSchema,
  updateBusinessProfileSchema,
  createLocationSchema,
  updateLocationSchema,
  addBusinessMemberSchema,
  updateBusinessMemberRoleSchema,
} from "@/lib/businesses/schemas";

describe("Business & Location Validation Schemas [VO-023]", () => {
  describe("businessSlugSchema", () => {
    it("accepts valid lowercase alphanumeric hyphenated slugs", () => {
      expect(businessSlugSchema.safeParse("ramesh-kirana").success).toBe(true);
      expect(businessSlugSchema.safeParse("cafe-101-bengaluru").success).toBe(true);
      expect(businessSlugSchema.safeParse("quick-mart").success).toBe(true);
    });

    it("rejects uppercase letters, spaces, leading/trailing hyphens, or double hyphens", () => {
      expect(businessSlugSchema.safeParse("Ramesh-Kirana").success).toBe(false);
      expect(businessSlugSchema.safeParse("ramesh kirana").success).toBe(false);
      expect(businessSlugSchema.safeParse("-ramesh").success).toBe(false);
      expect(businessSlugSchema.safeParse("ramesh-").success).toBe(false);
      expect(businessSlugSchema.safeParse("ramesh--kirana").success).toBe(false);
    });

    it("enforces length constraints between 3 and 60 characters", () => {
      expect(businessSlugSchema.safeParse("ab").success).toBe(false);
      expect(businessSlugSchema.safeParse("abc").success).toBe(true);
      expect(businessSlugSchema.safeParse("a".repeat(61)).success).toBe(false);
    });
  });

  describe("locationSlugSchema", () => {
    it("accepts valid location slugs", () => {
      expect(locationSlugSchema.safeParse("main").success).toBe(true);
      expect(locationSlugSchema.safeParse("branch-2").success).toBe(true);
      expect(locationSlugSchema.safeParse("indiranagar").success).toBe(true);
    });

    it("rejects invalid slugs", () => {
      expect(locationSlugSchema.safeParse("a").success).toBe(false);
      expect(locationSlugSchema.safeParse("Branch 1").success).toBe(false);
    });
  });

  describe("postalCodeSchema (Indian PIN Code)", () => {
    it("accepts valid 6-digit Indian PIN codes", () => {
      expect(postalCodeSchema.safeParse("560001").success).toBe(true);
      expect(postalCodeSchema.safeParse("110001").success).toBe(true);
      expect(postalCodeSchema.safeParse("400001").success).toBe(true);
    });

    it("rejects invalid PIN codes", () => {
      expect(postalCodeSchema.safeParse("56001").success).toBe(false); // 5 digits
      expect(postalCodeSchema.safeParse("5600001").success).toBe(false); // 7 digits
      expect(postalCodeSchema.safeParse("56000A").success).toBe(false); // alpha
      expect(postalCodeSchema.safeParse("").success).toBe(false);
    });
  });

  describe("gstinSchema (15-char Indian GSTIN)", () => {
    it("accepts valid 15-character statutory GSTIN", () => {
      expect(gstinSchema.safeParse("29AAAAA0000A1Z5").success).toBe(true);
      expect(gstinSchema.safeParse("27ABCDE1234F2Z8").success).toBe(true);
    });

    it("normalizes lowercase to uppercase", () => {
      const res = gstinSchema.safeParse("29aaaaa0000a1z5");
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data).toBe("29AAAAA0000A1Z5");
      }
    });

    it("rejects malformed GSTIN formats", () => {
      expect(gstinSchema.safeParse("29AAAAA0000A1Z").success).toBe(false); // 14 chars
      expect(gstinSchema.safeParse("29AAAAA0000A1Z55").success).toBe(false); // 16 chars
      expect(gstinSchema.safeParse("XXAAAAA0000A1Z5").success).toBe(false); // invalid state code
    });
  });

  describe("panSchema (10-char Indian PAN)", () => {
    it("accepts valid 10-character PAN", () => {
      expect(panSchema.safeParse("AAAAA0000A").success).toBe(true);
      expect(panSchema.safeParse("ABCDE1234F").success).toBe(true);
    });

    it("normalizes lowercase to uppercase", () => {
      const res = panSchema.safeParse("abcde1234f");
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data).toBe("ABCDE1234F");
      }
    });

    it("rejects malformed PAN formats", () => {
      expect(panSchema.safeParse("ABCDE1234").success).toBe(false); // 9 chars
      expect(panSchema.safeParse("12345ABCDE").success).toBe(false); // wrong structure
    });
  });

  describe("createBusinessSchema", () => {
    const validData = {
      trade_name: "Ramesh Sweets",
      legal_name: "Ramesh Confectionery Pvt Ltd",
      slug: "ramesh-sweets",
      location_name: "Main Branch",
      address_line1: "123 MG Road",
      address_line2: "Near Bus Stop",
      city: "Bengaluru",
      state: "Karnataka",
      postal_code: "560001",
    };

    it("accepts complete valid business and primary location payload", () => {
      const result = createBusinessSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.trade_name).toBe("Ramesh Sweets");
        expect(result.data.postal_code).toBe("560001");
      }
    });

    it("defaults location_name to 'Main Store' if omitted", () => {
      const { location_name: _, ...withoutLocName } = validData;
      const result = createBusinessSchema.safeParse(withoutLocName);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.location_name).toBe("Main Store");
      }
    });

    it("accepts optional workspace_id as UUID or null", () => {
      const withWs = createBusinessSchema.safeParse({
        ...validData,
        workspace_id: "00000000-0000-4000-8000-000000000001",
      });
      expect(withWs.success).toBe(true);

      const withNullWs = createBusinessSchema.safeParse({
        ...validData,
        workspace_id: null,
      });
      expect(withNullWs.success).toBe(true);
    });

    it("rejects missing required fields", () => {
      expect(createBusinessSchema.safeParse({ ...validData, trade_name: "" }).success).toBe(false);
      expect(createBusinessSchema.safeParse({ ...validData, legal_name: "" }).success).toBe(false);
      expect(createBusinessSchema.safeParse({ ...validData, address_line1: "" }).success).toBe(
        false,
      );
      expect(createBusinessSchema.safeParse({ ...validData, postal_code: "123" }).success).toBe(
        false,
      );
    });
  });

  describe("updateBusinessProfileSchema", () => {
    it("accepts partial profile updates", () => {
      expect(updateBusinessProfileSchema.safeParse({ trade_name: "New Name" }).success).toBe(true);
      expect(updateBusinessProfileSchema.safeParse({ status: "active" }).success).toBe(true);
      expect(updateBusinessProfileSchema.safeParse({ gst_number: "29AAAAA0000A1Z5" }).success).toBe(
        true,
      );
    });

    it("rejects invalid status", () => {
      expect(updateBusinessProfileSchema.safeParse({ status: "invalid_status" }).success).toBe(
        false,
      );
    });
  });

  describe("createLocationSchema & updateLocationSchema", () => {
    const validLoc = {
      business_id: "00000000-0000-4000-8000-000000000001",
      name: "Indiranagar Store",
      slug: "indiranagar",
      address_line1: "45 100ft Road",
      city: "Bengaluru",
      state: "Karnataka",
      postal_code: "560038",
      is_primary: false,
    };

    it("validates location creation input", () => {
      expect(createLocationSchema.safeParse(validLoc).success).toBe(true);
    });

    it("rejects non-UUID business_id", () => {
      expect(createLocationSchema.safeParse({ ...validLoc, business_id: "not-uuid" }).success).toBe(
        false,
      );
    });

    it("validates location update input", () => {
      expect(
        updateLocationSchema.safeParse({ name: "Updated Name", is_primary: true }).success,
      ).toBe(true);
    });
  });

  describe("addBusinessMemberSchema & updateBusinessMemberRoleSchema", () => {
    const validMember = {
      business_id: "00000000-0000-4000-8000-000000000001",
      user_id: "00000000-0000-4000-8000-000000000002",
      role: "cashier" as const,
    };

    it("validates member addition", () => {
      expect(addBusinessMemberSchema.safeParse(validMember).success).toBe(true);
    });

    it("rejects invalid business roles", () => {
      expect(
        addBusinessMemberSchema.safeParse({ ...validMember, role: "superadmin" }).success,
      ).toBe(false);
    });

    it("validates role update", () => {
      expect(updateBusinessMemberRoleSchema.safeParse({ role: "manager" }).success).toBe(true);
    });
  });
});
