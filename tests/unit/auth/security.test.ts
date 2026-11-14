import { describe, expect, it } from "vitest";
import {
  normalizePhoneNumber,
  isValidIndianMobile,
  isValidInternalRedirect,
  mapAuthError,
} from "@/lib/auth/security";

describe("VO-021 Auth Security Utilities", () => {
  describe("normalizePhoneNumber()", () => {
    it("normalizes a 10-digit Indian mobile number to E.164 (+91)", () => {
      expect(normalizePhoneNumber("9876543210")).toBe("+919876543210");
      expect(normalizePhoneNumber("8765432109")).toBe("+918765432109");
      expect(normalizePhoneNumber("7654321098")).toBe("+917654321098");
      expect(normalizePhoneNumber("6543210987")).toBe("+916543210987");
    });

    it("normalizes an 11-digit number with leading zero to +91", () => {
      expect(normalizePhoneNumber("09876543210")).toBe("+919876543210");
    });

    it("normalizes a 12-digit number starting with 91 to +91", () => {
      expect(normalizePhoneNumber("919876543210")).toBe("+919876543210");
    });

    it("strips whitespace, dashes, dots, and parentheses", () => {
      expect(normalizePhoneNumber("+91 98765-43210")).toBe("+919876543210");
      expect(normalizePhoneNumber("(+91) 98765 43210")).toBe("+919876543210");
      expect(normalizePhoneNumber("98765.43210")).toBe("+919876543210");
    });

    it("preserves international E.164 phone numbers with + prefix", () => {
      expect(normalizePhoneNumber("+1 (555) 123-4567")).toBe("+15551234567");
      expect(normalizePhoneNumber("+44 7911 123456")).toBe("+447911123456");
    });

    it("returns empty string on null, undefined, or empty inputs", () => {
      expect(normalizePhoneNumber("")).toBe("");
      // @ts-expect-error test invalid types safely
      expect(normalizePhoneNumber(null)).toBe("");
      // @ts-expect-error test invalid types safely
      expect(normalizePhoneNumber(undefined)).toBe("");
    });
  });

  describe("isValidIndianMobile()", () => {
    it("returns true for valid E.164 Indian mobile numbers", () => {
      expect(isValidIndianMobile("+919876543210")).toBe(true);
      expect(isValidIndianMobile("+918888888888")).toBe(true);
      expect(isValidIndianMobile("+917000000000")).toBe(true);
      expect(isValidIndianMobile("+916000000000")).toBe(true);
    });

    it("returns false for non-Indian or non-mobile numbers", () => {
      expect(isValidIndianMobile("+15551234567")).toBe(false);
      expect(isValidIndianMobile("+915555555555")).toBe(false); // starts with 5
      expect(isValidIndianMobile("+91987654321")).toBe(false); // only 9 digits
      expect(isValidIndianMobile("9876543210")).toBe(false); // missing +91 prefix
    });
  });

  describe("isValidInternalRedirect()", () => {
    it("allows valid relative internal paths", () => {
      expect(isValidInternalRedirect("/dashboard")).toBe(true);
      expect(isValidInternalRedirect("/dashboard/orders")).toBe(true);
      expect(isValidInternalRedirect("/counter/pos")).toBe(true);
      expect(isValidInternalRedirect("/workspace/clients?filter=active")).toBe(true);
      expect(isValidInternalRedirect("/update-password#step-2")).toBe(true);
    });

    it("rejects absolute URLs pointing to external hosts", () => {
      expect(isValidInternalRedirect("https://attacker.example.com")).toBe(false);
      expect(isValidInternalRedirect("http://evil.com/dashboard")).toBe(false);
      expect(isValidInternalRedirect("//evil.com")).toBe(false);
      expect(isValidInternalRedirect("//evil.com/dashboard")).toBe(false);
    });

    it("rejects backslash Windows path evasion attempts", () => {
      expect(isValidInternalRedirect("/\\evil.com")).toBe(false);
      expect(isValidInternalRedirect("/test\\path")).toBe(false);
      expect(isValidInternalRedirect("\\evil.com")).toBe(false);
    });

    it("rejects javascript: and data: pseudo-protocols", () => {
      expect(isValidInternalRedirect("javascript:alert(1)")).toBe(false);
      expect(isValidInternalRedirect("data:text/html,<script>alert(1)</script>")).toBe(false);
    });

    it("rejects control characters, newlines, and carriage returns", () => {
      expect(isValidInternalRedirect("/dashboard\nhttps://evil.com")).toBe(false);
      expect(isValidInternalRedirect("/dashboard\r\nSet-Cookie:evil=1")).toBe(false);
    });

    it("rejects empty, null, and non-string inputs", () => {
      expect(isValidInternalRedirect("")).toBe(false);
      expect(isValidInternalRedirect("   ")).toBe(false);
      expect(isValidInternalRedirect(null)).toBe(false);
      expect(isValidInternalRedirect(undefined)).toBe(false);
    });
  });

  describe("mapAuthError()", () => {
    it("maps invalid credentials without leaking specific user existence", () => {
      const err = new Error("Invalid login credentials");
      const mapped = mapAuthError(err);
      expect(mapped).toBe("Invalid email, mobile number, or password. Please verify your details.");
    });

    it("maps unconfirmed email messages clearly", () => {
      const err = new Error("Email not confirmed");
      const mapped = mapAuthError(err);
      expect(mapped).toBe(
        "Please confirm your email address. Check your inbox for the confirmation link.",
      );
    });

    it("maps duplicate user registrations cleanly", () => {
      const err = new Error("User already registered");
      const mapped = mapAuthError(err);
      expect(mapped).toBe("An account with these details already exists. Please sign in instead.");
    });

    it("maps expired or invalid OTP tokens", () => {
      const err = new Error("Token has expired or is invalid");
      const mapped = mapAuthError(err);
      expect(mapped).toBe(
        "The verification code is invalid or has expired. Please request a new code.",
      );
    });

    it("maps rate-limiting responses", () => {
      const err = new Error("over_sms_send_rate_limit: rate limit exceeded");
      const mapped = mapAuthError(err);
      expect(mapped).toBe("Too many requests. Please wait a few moments before trying again.");
    });

    it("maps configuration issues with actionable diagnostic guidance", () => {
      const err = new Error(
        "Supabase server client requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to be configured.",
      );
      const mapped = mapAuthError(err);
      expect(mapped).toBe(
        "Authentication service is not properly configured (missing both Supabase URL and Anon Key). Please check deployment settings.",
      );
    });

    it("maps network connectivity and fetch failures", () => {
      const err = new Error("TypeError: Failed to fetch");
      const mapped = mapAuthError(err);
      expect(mapped).toBe(
        "Unable to connect to the authentication service. Please check your network connection and try again.",
      );
    });

    it("maps database errors during user signup cleanly", () => {
      const err = new Error("Database error saving new user");
      const mapped = mapAuthError(err);
      expect(mapped).toBe(
        "Unable to create account due to a server database error. Please try again later.",
      );
    });

    it("maps disabled signups cleanly", () => {
      const err = new Error("Signups not allowed for this instance");
      const mapped = mapAuthError(err);
      expect(mapped).toBe("Account registration is currently disabled on this platform.");
    });

    it("maps provider password requirement messages", () => {
      const err = new Error("Password should be at least 8 characters");
      const mapped = mapAuthError(err);
      expect(mapped).toBe(
        "Password does not meet security requirements. Please use at least 8 characters with letters and numbers.",
      );
    });

    it("maps provider invalid email messages", () => {
      const err = new Error("Email address is invalid");
      const mapped = mapAuthError(err);
      expect(mapped).toBe("Please provide a valid email address.");
    });

    it("maps confirmation email sending failures", () => {
      const err = new Error("Error sending confirmation mail: SMTP server error");
      const mapped = mapAuthError(err);
      expect(mapped).toBe(
        "Could not send confirmation email. Please verify your email address or try again later.",
      );
    });

    it("falls back to a generic safe message for unexpected internal errors", () => {
      const err = new Error("FATAL 28000: password authentication failed for user supabase_admin");
      const mapped = mapAuthError(err);
      expect(mapped).toBe("An error occurred during authentication. Please try again.");
      expect(mapped).not.toContain("supabase_admin");
      expect(mapped).not.toContain("28000");
    });
  });
});
