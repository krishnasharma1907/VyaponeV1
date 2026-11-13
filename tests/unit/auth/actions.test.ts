import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock server-only to allow Server Action testing inside Vitest JSDOM environment
vi.mock("server-only", () => ({}));

import * as serverSupabase from "@/lib/supabase/server";
import * as profileBootstrap from "@/lib/auth/profile";
import {
  signUpAction,
  signInWithPasswordAction,
  requestPhoneOtpAction,
  verifyPhoneOtpAction,
  requestPasswordResetAction,
  updatePasswordAction,
  signOutAction,
} from "@/lib/auth/actions";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

describe("VO-021 Auth Server Actions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const setupMockSupabase = (overrides?: {
    signUpResult?: { data: unknown; error: unknown };
    signInPasswordResult?: { data: unknown; error: unknown };
    signInOtpResult?: { error: unknown };
    verifyOtpResult?: { data: unknown; error: unknown };
    resetPasswordResult?: { error: unknown };
    updateUserResult?: { error: unknown };
    signOutResult?: { error: unknown };
  }) => {
    const mockAuth = {
      signUp: vi.fn(async () => overrides?.signUpResult || { data: { user: null }, error: null }),
      signInWithPassword: vi.fn(
        async () => overrides?.signInPasswordResult || { data: { user: null }, error: null },
      ),
      signInWithOtp: vi.fn(async () => overrides?.signInOtpResult || { error: null }),
      verifyOtp: vi.fn(
        async () => overrides?.verifyOtpResult || { data: { user: null }, error: null },
      ),
      resetPasswordForEmail: vi.fn(async () => overrides?.resetPasswordResult || { error: null }),
      updateUser: vi.fn(async () => overrides?.updateUserResult || { error: null }),
      signOut: vi.fn(async () => overrides?.signOutResult || { error: null }),
    };

    const mockClient = {
      auth: mockAuth,
    } as unknown as SupabaseClient<Database>;

    vi.spyOn(serverSupabase, "createServerSupabaseClient").mockResolvedValue(mockClient);
    vi.spyOn(profileBootstrap, "ensureUserProfile").mockResolvedValue({ success: true });

    return { mockClient, mockAuth };
  };

  describe("signUpAction()", () => {
    it("successfully creates account and returns verification redirect when session is null", async () => {
      const mockUser = { id: "user-1", email: "new@example.com" };
      const { mockAuth } = setupMockSupabase({
        signUpResult: { data: { user: mockUser, session: null }, error: null },
      });

      const result = await signUpAction(null, {
        fullName: "New Merchant",
        businessName: "Merchant Store",
        email: "new@example.com",
        password: "ValidPassword123",
        accountType: "owner",
      });

      expect(result.success).toBe(true);
      expect(result.redirectTo).toBe("/verify-email");
      expect(mockAuth.signUp).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "new@example.com",
          password: "ValidPassword123",
          options: expect.objectContaining({
            emailRedirectTo: expect.stringContaining("/auth/callback"),
          }),
        }),
      );
    });

    it("handles ensureUserProfile non-fatal errors during registration gracefully", async () => {
      const mockUser = { id: "user-1", email: "new@example.com" };
      setupMockSupabase({
        signUpResult: { data: { user: mockUser, session: null }, error: null },
      });
      vi.spyOn(profileBootstrap, "ensureUserProfile").mockRejectedValue(
        new Error("new row violates row-level security policy for table users"),
      );

      const result = await signUpAction(null, {
        fullName: "New Merchant",
        businessName: "Merchant Store",
        email: "new@example.com",
        password: "ValidPassword123",
        accountType: "owner",
      });

      expect(result.success).toBe(true);
      expect(result.redirectTo).toBe("/verify-email");
    });

    it("returns configuration error when Supabase client throws ConfigurationError", async () => {
      vi.spyOn(serverSupabase, "createServerSupabaseClient").mockRejectedValue(
        new Error(
          "Supabase server client requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to be configured.",
        ),
      );

      const result = await signUpAction(null, {
        fullName: "New Merchant",
        businessName: "Merchant Store",
        email: "new@example.com",
        password: "ValidPassword123",
        accountType: "owner",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "Authentication service is not properly configured. Please check deployment settings.",
      );
    });

    it("returns mapped error when Supabase auth returns database error saving user", async () => {
      setupMockSupabase({
        signUpResult: {
          data: { user: null },
          error: new Error("Database error saving new user"),
        },
      });

      const result = await signUpAction(null, {
        fullName: "New Merchant",
        businessName: "Merchant Store",
        email: "new@example.com",
        password: "ValidPassword123",
        accountType: "owner",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "Unable to create account due to a server database error. Please try again later.",
      );
    });

    it("returns validation error when password is too weak", async () => {
      const result = await signUpAction(null, {
        fullName: "New Merchant",
        email: "new@example.com",
        password: "weak",
        accountType: "owner",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Password must be at least 8 characters");
    });
  });

  describe("signInWithPasswordAction()", () => {
    it("successfully authenticates with valid credentials", async () => {
      const mockUser = { id: "user-1", email: "registered@example.com" };
      const { mockAuth } = setupMockSupabase({
        signInPasswordResult: { data: { user: mockUser }, error: null },
      });

      const result = await signInWithPasswordAction(null, {
        email: "registered@example.com",
        password: "ValidPassword123",
        redirectTo: "/dashboard",
      });

      expect(result.success).toBe(true);
      expect(result.redirectTo).toBe("/dashboard");
      expect(mockAuth.signInWithPassword).toHaveBeenCalledWith({
        email: "registered@example.com",
        password: "ValidPassword123",
      });
    });

    it("returns user-safe error on invalid credentials", async () => {
      setupMockSupabase({
        signInPasswordResult: {
          data: { user: null },
          error: new Error("Invalid login credentials"),
        },
      });

      const result = await signInWithPasswordAction(null, {
        email: "registered@example.com",
        password: "WrongPassword123",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "Invalid email, mobile number, or password. Please verify your details.",
      );
    });
  });

  describe("requestPhoneOtpAction()", () => {
    it("requests SMS OTP for normalized Indian phone number", async () => {
      const { mockAuth } = setupMockSupabase({
        signInOtpResult: { error: null },
      });

      const result = await requestPhoneOtpAction(null, {
        phone: "9876543210",
      });

      expect(result.success).toBe(true);
      expect(mockAuth.signInWithOtp).toHaveBeenCalledWith({
        phone: "+919876543210",
        options: { channel: "sms" },
      });
    });
  });

  describe("verifyPhoneOtpAction()", () => {
    it("verifies OTP and redirects to dashboard", async () => {
      const mockUser = { id: "user-1", phone: "+919876543210" };
      const { mockAuth } = setupMockSupabase({
        verifyOtpResult: { data: { user: mockUser }, error: null },
      });

      const result = await verifyPhoneOtpAction(null, {
        phone: "9876543210",
        token: "123456",
        redirectTo: "/counter",
      });

      expect(result.success).toBe(true);
      expect(result.redirectTo).toBe("/counter");
      expect(mockAuth.verifyOtp).toHaveBeenCalledWith({
        phone: "+919876543210",
        token: "123456",
        type: "sms",
      });
    });
  });

  describe("requestPasswordResetAction()", () => {
    it("returns uniform success message regardless of email existence", async () => {
      const { mockAuth } = setupMockSupabase({
        resetPasswordResult: { error: null },
      });

      const result = await requestPasswordResetAction(null, {
        email: "forgot@example.com",
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain("If an account with that email exists");
      expect(mockAuth.resetPasswordForEmail).toHaveBeenCalled();
    });
  });

  describe("updatePasswordAction()", () => {
    it("updates user password via supabase.auth.updateUser", async () => {
      const { mockAuth } = setupMockSupabase({
        updateUserResult: { error: null },
      });

      const result = await updatePasswordAction(null, {
        password: "NewPassword123",
        confirmPassword: "NewPassword123",
      });

      expect(result.success).toBe(true);
      expect(mockAuth.updateUser).toHaveBeenCalledWith({
        password: "NewPassword123",
      });
    });
  });

  describe("signOutAction()", () => {
    it("signs out and redirects to /login", async () => {
      const { mockAuth } = setupMockSupabase({
        signOutResult: { error: null },
      });

      const result = await signOutAction();
      expect(result.success).toBe(true);
      expect(result.redirectTo).toBe("/login");
      expect(mockAuth.signOut).toHaveBeenCalled();
    });
  });
});
