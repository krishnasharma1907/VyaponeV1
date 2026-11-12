import { describe, expect, it } from "vitest";
import {
  signUpSchema,
  signInWithPasswordSchema,
  phoneOtpRequestSchema,
  phoneOtpVerifySchema,
  requestPasswordResetSchema,
  updatePasswordSchema,
} from "@/lib/auth/schemas";

describe("VO-021 Auth Zod Schemas", () => {
  describe("signUpSchema", () => {
    it("validates valid business owner registration data", () => {
      const result = signUpSchema.safeParse({
        fullName: "Ramesh Kumar",
        businessName: "Kumar Kirana",
        email: "ramesh@example.com",
        phone: "9876543210",
        password: "Password123",
        accountType: "owner",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe("ramesh@example.com");
        expect(result.data.phone).toBe("+919876543210");
        expect(result.data.accountType).toBe("owner");
      }
    });

    it("accepts signup without phone number", () => {
      const result = signUpSchema.safeParse({
        fullName: "Priya Sharma",
        email: "priya@example.com",
        password: "SecurePass123",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.phone).toBeUndefined();
        expect(result.data.accountType).toBe("owner"); // default
      }
    });

    it("rejects weak password without numbers or letters", () => {
      const noNumbers = signUpSchema.safeParse({
        fullName: "Test User",
        email: "test@example.com",
        password: "passwordonly",
      });
      expect(noNumbers.success).toBe(false);

      const noLetters = signUpSchema.safeParse({
        fullName: "Test User",
        email: "test@example.com",
        password: "12345678",
      });
      expect(noLetters.success).toBe(false);

      const tooShort = signUpSchema.safeParse({
        fullName: "Test User",
        email: "test@example.com",
        password: "Pass1",
      });
      expect(tooShort.success).toBe(false);
    });

    it("rejects invalid email addresses", () => {
      const invalidEmail = signUpSchema.safeParse({
        fullName: "Test User",
        email: "not-an-email",
        password: "ValidPassword123",
      });
      expect(invalidEmail.success).toBe(false);
    });
  });

  describe("signInWithPasswordSchema", () => {
    it("validates email and password credentials", () => {
      const result = signInWithPasswordSchema.safeParse({
        email: "owner@vyapone.in",
        password: "SuperSecretPassword1",
        redirectTo: "/dashboard",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe("owner@vyapone.in");
        expect(result.data.redirectTo).toBe("/dashboard");
      }
    });

    it("rejects empty password", () => {
      const result = signInWithPasswordSchema.safeParse({
        email: "owner@vyapone.in",
        password: "",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("phoneOtpRequestSchema", () => {
    it("validates and normalizes 10-digit Indian phone", () => {
      const result = phoneOtpRequestSchema.safeParse({
        phone: "9876543210",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.phone).toBe("+919876543210");
      }
    });

    it("rejects invalid phone numbers", () => {
      const result = phoneOtpRequestSchema.safeParse({
        phone: "123",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("phoneOtpVerifySchema", () => {
    it("validates 6-digit OTP code and phone", () => {
      const result = phoneOtpVerifySchema.safeParse({
        phone: "9876543210",
        token: "123456",
        redirectTo: "/counter",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.phone).toBe("+919876543210");
        expect(result.data.token).toBe("123456");
      }
    });

    it("rejects tokens that are not 6 digits", () => {
      const tooShort = phoneOtpVerifySchema.safeParse({
        phone: "9876543210",
        token: "12345",
      });
      expect(tooShort.success).toBe(false);

      const nonNumeric = phoneOtpVerifySchema.safeParse({
        phone: "9876543210",
        token: "12345a",
      });
      expect(nonNumeric.success).toBe(false);
    });
  });

  describe("requestPasswordResetSchema", () => {
    it("validates email for password recovery", () => {
      const result = requestPasswordResetSchema.safeParse({
        email: "recovery@example.com",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("updatePasswordSchema", () => {
    it("validates matching new passwords", () => {
      const result = updatePasswordSchema.safeParse({
        password: "NewPassword123",
        confirmPassword: "NewPassword123",
      });
      expect(result.success).toBe(true);
    });

    it("rejects mismatched passwords", () => {
      const result = updatePasswordSchema.safeParse({
        password: "NewPassword123",
        confirmPassword: "DifferentPassword456",
      });
      expect(result.success).toBe(false);
    });
  });
});
