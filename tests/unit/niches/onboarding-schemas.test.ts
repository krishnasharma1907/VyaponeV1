import { describe, expect, it } from "vitest";
import { CANONICAL_NICHE_GROUPS, DEFAULT_NICHE_MANIFESTS } from "@/lib/niches/constants";
import {
  nicheManifestSchema,
  onboardingQuestionSchema,
  questionConditionSchema,
  structuredAddressSchema,
} from "@/lib/niches/schemas";

describe("VO-031 Category-Specific Onboarding Schemas", () => {
  describe("1. Manifest Coverage Across All 9 Canonical PRD Groups", () => {
    it("ensures all 9 canonical PRD §7 groups have corresponding manifests", () => {
      const manifests = Object.values(DEFAULT_NICHE_MANIFESTS);
      const coveredGroupSlugs = new Set(manifests.map((m) => m.nicheGroupSlug));

      for (const group of CANONICAL_NICHE_GROUPS) {
        expect(
          coveredGroupSlugs.has(group.slug),
          `Missing manifest for canonical group: ${group.slug} (${group.name})`,
        ).toBe(true);
      }
    });

    it("validates all manifests strictly against the versioned nicheManifestSchema", () => {
      for (const [slug, manifest] of Object.entries(DEFAULT_NICHE_MANIFESTS)) {
        const parseResult = nicheManifestSchema.safeParse(manifest);
        if (!parseResult.success) {
          throw new Error(
            `Manifest validation failed for '${slug}': ${JSON.stringify(parseResult.error.format())}`,
          );
        }
        expect(parseResult.success).toBe(true);
        expect(manifest.version).toBe("v1");
      }
    });
  });

  describe("2. Onboarding Question Schema Constraints", () => {
    it("validates question key formatting requires lower-snake-case", () => {
      const validQuestion = {
        key: "valid_question_key_123",
        label: "Valid Question",
        type: "text",
        required: true,
      };
      expect(onboardingQuestionSchema.safeParse(validQuestion).success).toBe(true);

      const invalidKeyQuestion = {
        key: "InvalidKey-With-Dashes",
        label: "Invalid Key Question",
        type: "text",
        required: true,
      };
      const invalidResult = onboardingQuestionSchema.safeParse(invalidKeyQuestion);
      expect(invalidResult.success).toBe(false);
    });

    it("accepts all 9 supported question types", () => {
      const types = [
        "text",
        "number",
        "boolean",
        "select",
        "multiselect",
        "date",
        "time",
        "structured_address",
        "file",
      ] as const;

      for (const type of types) {
        const q = {
          key: `test_${type}`,
          label: `Test ${type}`,
          type,
          required: false,
        };
        expect(onboardingQuestionSchema.safeParse(q).success).toBe(true);
      }
    });

    it("rejects unknown question types", () => {
      const invalidTypeQuestion = {
        key: "unknown_type_field",
        label: "Unknown",
        type: "unsupported_custom_type",
        required: false,
      };
      expect(onboardingQuestionSchema.safeParse(invalidTypeQuestion).success).toBe(false);
    });

    it("validates question conditions with valid operators", () => {
      const operators = [
        "equals",
        "not_equals",
        "in",
        "not_in",
        "contains",
        "greater_than",
        "less_than",
        "truthy",
        "falsy",
      ] as const;

      for (const op of operators) {
        const condition = {
          dependsOn: "parent_question",
          operator: op,
          value: "test",
        };
        expect(questionConditionSchema.safeParse(condition).success).toBe(true);
      }

      const invalidOperator = {
        dependsOn: "parent_question",
        operator: "invalid_operator",
        value: "test",
      };
      expect(questionConditionSchema.safeParse(invalidOperator).success).toBe(false);
    });
  });

  describe("3. Structured Indian Address Schema", () => {
    it("validates a compliant Indian structured address with 6-digit PIN", () => {
      const validAddress = {
        addressLine1: "Shop No. 4, Ground Floor, Sai Complex",
        addressLine2: "Opposite Metro Station, M.G. Road",
        landmark: "Near City Post Office",
        city: "Bengaluru",
        state: "Karnataka",
        pincode: "560001",
      };
      const result = structuredAddressSchema.safeParse(validAddress);
      expect(result.success).toBe(true);
    });

    it("rejects invalid Indian PIN codes starting with 0 or non-6-digits", () => {
      const invalidPinZero = {
        addressLine1: "Main Road",
        city: "New Delhi",
        state: "Delhi",
        pincode: "010001", // Indian PINs cannot start with 0
      };
      expect(structuredAddressSchema.safeParse(invalidPinZero).success).toBe(false);

      const invalidPinLength = {
        addressLine1: "Main Road",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "40001", // 5 digits
      };
      expect(structuredAddressSchema.safeParse(invalidPinLength).success).toBe(false);

      const invalidPinLetters = {
        addressLine1: "Main Road",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "40000A",
      };
      expect(structuredAddressSchema.safeParse(invalidPinLetters).success).toBe(false);
    });

    it("requires addressLine1, city, and state", () => {
      const missingCity = {
        addressLine1: "Some Street",
        state: "Maharashtra",
        pincode: "400001",
      };
      expect(structuredAddressSchema.safeParse(missingCity).success).toBe(false);
    });
  });

  describe("4. Niche Group Manifest Integrity", () => {
    it("ensures restaurant manifest has conditional takeaway delivery radius", () => {
      const restaurant = DEFAULT_NICHE_MANIFESTS["restaurant"]!;
      const deliveryRadius = restaurant.onboarding.requiredQuestions.find(
        (q) => q.key === "delivery_radius_km",
      );
      expect(deliveryRadius).toBeDefined();
      expect(deliveryRadius?.condition).toEqual({
        dependsOn: "offers_takeaway",
        operator: "equals",
        value: true,
      });
      expect(deliveryRadius?.validation?.min).toBe(1);
      expect(deliveryRadius?.validation?.max).toBe(50);
    });

    it("ensures property_broker manifest has conditional RERA ID", () => {
      const broker = DEFAULT_NICHE_MANIFESTS["property_broker"]!;
      const reraId = broker.onboarding.requiredQuestions.find((q) => q.key === "rera_id");
      expect(reraId).toBeDefined();
      expect(reraId?.condition).toEqual({
        dependsOn: "is_rera_registered",
        operator: "equals",
        value: true,
      });
    });

    it("ensures salon manifest has conditional home service radius", () => {
      const salon = DEFAULT_NICHE_MANIFESTS["salon"]!;
      const homeRadius = salon.onboarding.requiredQuestions.find(
        (q) => q.key === "home_service_radius_km",
      );
      expect(homeRadius).toBeDefined();
      expect(homeRadius?.condition).toEqual({
        dependsOn: "offers_home_service",
        operator: "equals",
        value: true,
      });
    });
  });
});
