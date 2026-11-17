import { describe, expect, it } from "vitest";
import { validateQuestionAnswer } from "@/lib/niches/service";
import type { OnboardingQuestion } from "@/lib/niches/types";

describe("VO-031 Onboarding Answer Validation Engine", () => {
  describe("1. Required vs Optional Validation", () => {
    const requiredTextQuestion: OnboardingQuestion = {
      key: "req_text",
      label: "Required Field",
      type: "text",
      required: true,
    };

    const optionalTextQuestion: OnboardingQuestion = {
      key: "opt_text",
      label: "Optional Field",
      type: "text",
      required: false,
    };

    it("fails when required field is undefined, null, or empty string", () => {
      expect(validateQuestionAnswer(requiredTextQuestion, undefined).valid).toBe(false);
      expect(validateQuestionAnswer(requiredTextQuestion, null).valid).toBe(false);
      expect(validateQuestionAnswer(requiredTextQuestion, "").valid).toBe(false);
      expect(validateQuestionAnswer(requiredTextQuestion, "   ").valid).toBe(false);
    });

    it("passes when optional field is undefined, null, or empty string", () => {
      expect(validateQuestionAnswer(optionalTextQuestion, undefined).valid).toBe(true);
      expect(validateQuestionAnswer(optionalTextQuestion, null).valid).toBe(true);
      expect(validateQuestionAnswer(optionalTextQuestion, "").valid).toBe(true);
    });
  });

  describe("2. Text Validation with Length and Regex Patterns", () => {
    const fssaiQuestion: OnboardingQuestion = {
      key: "fssai_num",
      label: "FSSAI License",
      type: "text",
      required: true,
      validation: {
        pattern: "^[0-9]{14}$",
        patternError: "FSSAI license must be exactly 14 numeric digits",
      },
    };

    it("validates 14-digit numeric pattern correctly", () => {
      expect(validateQuestionAnswer(fssaiQuestion, "12345678901234").valid).toBe(true);
      const invalidRes = validateQuestionAnswer(fssaiQuestion, "12345ABC");
      expect(invalidRes.valid).toBe(false);
      expect(invalidRes.error).toBe("FSSAI license must be exactly 14 numeric digits");
    });

    const lengthQuestion: OnboardingQuestion = {
      key: "summary",
      label: "Summary",
      type: "text",
      required: true,
      validation: {
        minLength: 5,
        maxLength: 20,
      },
    };

    it("enforces minLength and maxLength", () => {
      expect(validateQuestionAnswer(lengthQuestion, "Tiny").valid).toBe(false);
      expect(validateQuestionAnswer(lengthQuestion, "Valid string length").valid).toBe(true);
      expect(
        validateQuestionAnswer(
          lengthQuestion,
          "This is a super excessively long string over 20 chars",
        ).valid,
      ).toBe(false);
    });
  });

  describe("3. Number Validation with Min/Max Bounds", () => {
    const tableCountQuestion: OnboardingQuestion = {
      key: "tables",
      label: "Table Count",
      type: "number",
      required: true,
      validation: {
        min: 1,
        max: 100,
      },
    };

    it("accepts valid numbers within range", () => {
      expect(validateQuestionAnswer(tableCountQuestion, 1).valid).toBe(true);
      expect(validateQuestionAnswer(tableCountQuestion, 50).valid).toBe(true);
      expect(validateQuestionAnswer(tableCountQuestion, 100).valid).toBe(true);
      expect(validateQuestionAnswer(tableCountQuestion, "25").valid).toBe(true);
    });

    it("rejects numbers out of bounds or non-numeric values", () => {
      expect(validateQuestionAnswer(tableCountQuestion, 0).valid).toBe(false);
      expect(validateQuestionAnswer(tableCountQuestion, 101).valid).toBe(false);
      expect(validateQuestionAnswer(tableCountQuestion, "not_a_number").valid).toBe(false);
    });
  });

  describe("4. Boolean Validation", () => {
    const boolQuestion: OnboardingQuestion = {
      key: "is_active",
      label: "Is Active",
      type: "boolean",
      required: true,
    };

    it("accepts native booleans and string booleans", () => {
      expect(validateQuestionAnswer(boolQuestion, true).valid).toBe(true);
      expect(validateQuestionAnswer(boolQuestion, false).valid).toBe(true);
      expect(validateQuestionAnswer(boolQuestion, "true").valid).toBe(true);
      expect(validateQuestionAnswer(boolQuestion, "false").valid).toBe(true);
    });

    it("rejects arbitrary objects or non-boolean types", () => {
      expect(validateQuestionAnswer(boolQuestion, 123).valid).toBe(false);
      expect(validateQuestionAnswer(boolQuestion, "maybe").valid).toBe(false);
    });
  });

  describe("5. Select and Multiselect Validation", () => {
    const selectQuestion: OnboardingQuestion = {
      key: "gender",
      label: "Client Gender",
      type: "select",
      required: true,
      options: ["Unisex", "Women Only", "Men Only"],
    };

    it("accepts allowed select option values", () => {
      expect(validateQuestionAnswer(selectQuestion, "Unisex").valid).toBe(true);
      expect(validateQuestionAnswer(selectQuestion, "Women Only").valid).toBe(true);
    });

    it("rejects unlisted select options", () => {
      const res = validateQuestionAnswer(selectQuestion, "Invalid Option");
      expect(res.valid).toBe(false);
      expect(res.error).toContain("contains an invalid option");
    });

    const multiQuestion: OnboardingQuestion = {
      key: "cuisines",
      label: "Cuisines",
      type: "multiselect",
      required: true,
      options: ["North Indian", "South Indian", "Chinese"],
    };

    it("accepts valid array of multiselect options", () => {
      expect(validateQuestionAnswer(multiQuestion, ["North Indian", "Chinese"]).valid).toBe(true);
    });

    it("rejects multiselect array containing an unlisted option", () => {
      expect(validateQuestionAnswer(multiQuestion, ["North Indian", "Italian Pizza"]).valid).toBe(
        false,
      );
    });
  });

  describe("6. Date & Time Validation", () => {
    const dateQuestion: OnboardingQuestion = {
      key: "launch_date",
      label: "Launch Date",
      type: "date",
      required: true,
    };

    it("accepts valid ISO YYYY-MM-DD calendar dates", () => {
      expect(validateQuestionAnswer(dateQuestion, "2026-11-18").valid).toBe(true);
      expect(validateQuestionAnswer(dateQuestion, "2024-02-29").valid).toBe(true); // leap year
    });

    it("rejects invalid date format or impossible calendar dates", () => {
      expect(validateQuestionAnswer(dateQuestion, "18-11-2026").valid).toBe(false);
      expect(validateQuestionAnswer(dateQuestion, "2026/11/18").valid).toBe(false);
      expect(validateQuestionAnswer(dateQuestion, "2026-02-30").valid).toBe(false); // Feb 30 does not exist
      expect(validateQuestionAnswer(dateQuestion, "2026-13-01").valid).toBe(false); // month 13
    });

    const timeQuestion: OnboardingQuestion = {
      key: "opening_time",
      label: "Opening Time",
      type: "time",
      required: true,
    };

    it("accepts valid 24-hr HH:mm strings", () => {
      expect(validateQuestionAnswer(timeQuestion, "09:30").valid).toBe(true);
      expect(validateQuestionAnswer(timeQuestion, "00:00").valid).toBe(true);
      expect(validateQuestionAnswer(timeQuestion, "23:59").valid).toBe(true);
    });

    it("rejects out of range or malformed time strings", () => {
      expect(validateQuestionAnswer(timeQuestion, "24:00").valid).toBe(false);
      expect(validateQuestionAnswer(timeQuestion, "12:60").valid).toBe(false);
      expect(validateQuestionAnswer(timeQuestion, "9:30 AM").valid).toBe(false);
    });
  });

  describe("7. Structured Address Validation", () => {
    const addressQuestion: OnboardingQuestion = {
      key: "store_loc",
      label: "Store Location",
      type: "structured_address",
      required: true,
    };

    it("accepts a fully compliant Indian address", () => {
      const validAddress = {
        addressLine1: "Plot 10, Sector 5",
        city: "Gurugram",
        state: "Haryana",
        pincode: "122001",
      };
      expect(validateQuestionAnswer(addressQuestion, validAddress).valid).toBe(true);
    });

    it("rejects an address missing required city or invalid PIN", () => {
      const missingCity = {
        addressLine1: "Plot 10, Sector 5",
        state: "Haryana",
        pincode: "122001",
      };
      expect(validateQuestionAnswer(addressQuestion, missingCity).valid).toBe(false);

      const invalidPin = {
        addressLine1: "Plot 10, Sector 5",
        city: "Gurugram",
        state: "Haryana",
        pincode: "12200", // 5 digits
      };
      expect(validateQuestionAnswer(addressQuestion, invalidPin).valid).toBe(false);
    });
  });
});
