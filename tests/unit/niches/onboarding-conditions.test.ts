import { describe, expect, it } from "vitest";
import {
  detectCircularConditions,
  evaluateOnboardingAnswers,
  isQuestionVisible,
  validateConditionDependencies,
} from "@/lib/niches/service";
import type { NicheManifest, OnboardingQuestion } from "@/lib/niches/types";

describe("VO-031 Conditional Logic & Dependency Engine", () => {
  describe("1. Circular Dependency Detection & Cycle Safety", () => {
    it("returns an empty array when conditions are acyclic", () => {
      const questions: OnboardingQuestion[] = [
        { key: "q1", label: "Q1", type: "boolean", required: true },
        {
          key: "q2",
          label: "Q2",
          type: "number",
          required: true,
          condition: { dependsOn: "q1", operator: "equals", value: true },
        },
        {
          key: "q3",
          label: "Q3",
          type: "text",
          required: false,
          condition: { dependsOn: "q2", operator: "greater_than", value: 10 },
        },
      ];

      const cycles = detectCircularConditions(questions);
      expect(cycles).toEqual([]);
      expect(validateConditionDependencies(questions).valid).toBe(true);
    });

    it("detects direct 2-node circular dependencies (A -> B -> A)", () => {
      const circularQuestions: OnboardingQuestion[] = [
        {
          key: "node_a",
          label: "Node A",
          type: "boolean",
          required: true,
          condition: { dependsOn: "node_b", operator: "equals", value: true },
        },
        {
          key: "node_b",
          label: "Node B",
          type: "boolean",
          required: true,
          condition: { dependsOn: "node_a", operator: "equals", value: true },
        },
      ];

      const cycles = detectCircularConditions(circularQuestions);
      expect(cycles.length).toBeGreaterThan(0);
      expect(cycles).toContain("node_a");
      expect(cycles).toContain("node_b");

      const validation = validateConditionDependencies(circularQuestions);
      expect(validation.valid).toBe(false);
      expect(validation.errors[0]).toContain("Circular dependency detected");
    });

    it("rejects self-referencing question conditions (A -> A)", () => {
      const selfRefQuestions: OnboardingQuestion[] = [
        {
          key: "self_ref",
          label: "Self Ref",
          type: "boolean",
          required: true,
          condition: { dependsOn: "self_ref", operator: "equals", value: true },
        },
      ];

      const validation = validateConditionDependencies(selfRefQuestions);
      expect(validation.valid).toBe(false);
      expect(validation.errors[0]).toContain("cannot depend on itself");
    });

    it("rejects conditions referencing non-existent questions", () => {
      const orphanConditionQuestions: OnboardingQuestion[] = [
        {
          key: "orphan",
          label: "Orphan",
          type: "text",
          required: true,
          condition: { dependsOn: "non_existent_key", operator: "equals", value: "hello" },
        },
      ];

      const validation = validateConditionDependencies(orphanConditionQuestions);
      expect(validation.valid).toBe(false);
      expect(validation.errors[0]).toContain("depends on non-existent question");
    });
  });

  describe("2. Condition Operators Evaluation", () => {
    it("evaluates 'equals' and 'not_equals' correctly", () => {
      const qEquals: OnboardingQuestion = {
        key: "q_child",
        label: "Child",
        type: "text",
        required: true,
        condition: { dependsOn: "parent_bool", operator: "equals", value: true },
      };

      expect(isQuestionVisible(qEquals, { parent_bool: true })).toBe(true);
      expect(isQuestionVisible(qEquals, { parent_bool: false })).toBe(false);

      const qNotEquals: OnboardingQuestion = {
        key: "q_not",
        label: "Not Equal",
        type: "text",
        required: true,
        condition: { dependsOn: "plan_tier", operator: "not_equals", value: "free" },
      };

      expect(isQuestionVisible(qNotEquals, { plan_tier: "pro" })).toBe(true);
      expect(isQuestionVisible(qNotEquals, { plan_tier: "free" })).toBe(false);
    });

    it("evaluates 'in' and 'not_in' correctly", () => {
      const qIn: OnboardingQuestion = {
        key: "q_in",
        label: "In Check",
        type: "text",
        required: true,
        condition: { dependsOn: "category", operator: "in", value: ["cafe", "bakery", "deli"] },
      };

      expect(isQuestionVisible(qIn, { category: "bakery" })).toBe(true);
      expect(isQuestionVisible(qIn, { category: "salon" })).toBe(false);
    });

    it("evaluates 'greater_than' and 'less_than' correctly", () => {
      const qGreater: OnboardingQuestion = {
        key: "q_gt",
        label: "Greater Check",
        type: "text",
        required: true,
        condition: { dependsOn: "staff_count", operator: "greater_than", value: 5 },
      };

      expect(isQuestionVisible(qGreater, { staff_count: 10 })).toBe(true);
      expect(isQuestionVisible(qGreater, { staff_count: 5 })).toBe(false);
      expect(isQuestionVisible(qGreater, { staff_count: 2 })).toBe(false);
    });

    it("evaluates 'truthy' and 'falsy' correctly", () => {
      const qTruthy: OnboardingQuestion = {
        key: "q_tr",
        label: "Truthy Check",
        type: "text",
        required: true,
        condition: { dependsOn: "has_custom_domain", operator: "truthy" },
      };

      expect(isQuestionVisible(qTruthy, { has_custom_domain: true })).toBe(true);
      expect(isQuestionVisible(qTruthy, { has_custom_domain: "example.com" })).toBe(true);
      expect(isQuestionVisible(qTruthy, { has_custom_domain: false })).toBe(false);
      expect(isQuestionVisible(qTruthy, { has_custom_domain: "" })).toBe(false);
      expect(isQuestionVisible(qTruthy, {})).toBe(false);
    });
  });

  describe("3. Cascading Parent-Child Conditional Visibility", () => {
    it("hides child question when parent question itself is hidden", () => {
      const grandParent: OnboardingQuestion = {
        key: "grand_parent",
        label: "Grandparent",
        type: "boolean",
        required: true,
      };

      const parent: OnboardingQuestion = {
        key: "parent",
        label: "Parent",
        type: "boolean",
        required: true,
        condition: { dependsOn: "grand_parent", operator: "equals", value: true },
      };

      const child: OnboardingQuestion = {
        key: "child",
        label: "Child",
        type: "text",
        required: true,
        condition: { dependsOn: "parent", operator: "equals", value: true },
      };

      const questionMap = new Map<string, OnboardingQuestion>([
        ["grand_parent", grandParent],
        ["parent", parent],
        ["child", child],
      ]);

      // When grandparent is false, parent is hidden, so child must be hidden
      // even if answers happens to have parent: true
      const answers = {
        grand_parent: false,
        parent: true,
      };

      expect(isQuestionVisible(child, answers, questionMap)).toBe(false);
    });
  });

  describe("4. Missing-Field Detection and Hidden Field Stripping", () => {
    const testManifest: NicheManifest = {
      version: "v1",
      nicheGroupSlug: "food_hospitality",
      nicheSlug: "test_restaurant",
      name: "Test Restaurant",
      availabilityLabel: "live_operational",
      modules: {
        defaultEnabled: ["website_engine"],
        recommended: [],
      },
      dashboardNavigation: [],
      onboarding: {
        requiredQuestions: [
          {
            key: "business_title",
            label: "Business Title",
            type: "text",
            required: true,
          },
          {
            key: "offers_dine_in",
            label: "Offers Dine In",
            type: "boolean",
            required: true,
          },
          {
            key: "table_count",
            label: "Table Count",
            type: "number",
            required: true,
            condition: { dependsOn: "offers_dine_in", operator: "equals", value: true },
            validation: { min: 1, max: 200 },
          },
          {
            key: "special_notes",
            label: "Special Notes",
            type: "text",
            required: false,
          },
        ],
      },
    };

    it("evaluates required missing fields for visible questions only", () => {
      // Dine-in is false -> table_count is conditionally hidden!
      const answers = {
        business_title: "My Cafe",
        offers_dine_in: false,
        // table_count is not provided, and not required because it is hidden
      };

      const result = evaluateOnboardingAnswers(testManifest, answers);
      expect(result.isValid).toBe(true);
      expect(result.isComplete).toBe(true);
      expect(result.visibleQuestions).toContain("business_title");
      expect(result.visibleQuestions).toContain("offers_dine_in");
      expect(result.visibleQuestions).toContain("special_notes");
      expect(result.hiddenQuestions).toContain("table_count");
      expect(result.missingRequiredFields).toHaveLength(0);
    });

    it("detects missing required field when conditionally visible", () => {
      // Dine-in is true -> table_count IS visible and REQUIRED!
      const answers = {
        business_title: "My Cafe",
        offers_dine_in: true,
        // table_count missing
      };

      const result = evaluateOnboardingAnswers(testManifest, answers);
      expect(result.isValid).toBe(true);
      expect(result.isComplete).toBe(false);
      expect(result.visibleQuestions).toContain("table_count");
      expect(result.missingRequiredFields).toHaveLength(1);
      expect(result.missingRequiredFields[0]?.key).toBe("table_count");
    });

    it("strips hidden fields from sanitizedAnswers to prevent storing stale data", () => {
      // Previously user answered table_count = 25, but then switched offers_dine_in to false!
      const answersWithStaleData = {
        business_title: "My Cafe",
        offers_dine_in: false,
        table_count: 25, // should be stripped!
      };

      const result = evaluateOnboardingAnswers(testManifest, answersWithStaleData);
      expect(result.isComplete).toBe(true);
      expect(result.sanitizedAnswers["business_title"]).toBe("My Cafe");
      expect(result.sanitizedAnswers["offers_dine_in"]).toBe(false);
      expect(result.sanitizedAnswers["table_count"]).toBeUndefined();
    });
  });
});
