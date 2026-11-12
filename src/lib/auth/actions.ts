"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  signUpSchema,
  signInWithPasswordSchema,
  phoneOtpRequestSchema,
  phoneOtpVerifySchema,
  requestPasswordResetSchema,
  updatePasswordSchema,
  type SignUpInput,
  type SignInWithPasswordInput,
  type PhoneOtpRequestInput,
  type PhoneOtpVerifyInput,
  type RequestPasswordResetInput,
  type UpdatePasswordInput,
} from "./schemas";
import { isValidInternalRedirect, mapAuthError } from "./security";
import { ensureUserProfile } from "./profile";

export interface AuthActionResult<T = void> {
  success: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  redirectTo?: string;
  data?: T;
}

/**
 * Extracts form field values into an object.
 */
function extractFormData(formData: FormData): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  formData.forEach((value, key) => {
    // If empty string, keep as empty string for schema transformations
    data[key] = value;
  });
  return data;
}

/**
 * Account Registration Server Action
 *
 * Supports email/password registration with optional phone and role metadata.
 */
export async function signUpAction(
  _prevState: unknown,
  input: FormData | SignUpInput,
): Promise<AuthActionResult> {
  try {
    const rawData = input instanceof FormData ? extractFormData(input) : input;
    const parsed = signUpSchema.safeParse(rawData);

    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      const firstErrorMessage =
        Object.values(fieldErrors)[0]?.[0] || "Please check your inputs and try again.";
      return {
        success: false,
        error: firstErrorMessage,
        fieldErrors,
      };
    }

    const { email, password, fullName, phone, accountType, businessName } = parsed.data;

    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone: phone || null,
          account_type: accountType,
          business_name: businessName || null,
        },
      },
    });

    if (error) {
      return {
        success: false,
        error: mapAuthError(error),
      };
    }

    if (data.user) {
      await ensureUserProfile(supabase, data.user, {
        fullName,
        email,
        phone,
      });
    }

    // If confirmation is required by Supabase Auth
    if (data.user && !data.session) {
      return {
        success: true,
        message:
          "Registration successful! Please check your email inbox to verify your account before logging in.",
        redirectTo: "/verify-email",
      };
    }

    return {
      success: true,
      message: "Account created successfully.",
      redirectTo: "/dashboard",
    };
  } catch (err) {
    return {
      success: false,
      error: mapAuthError(err),
    };
  }
}

/**
 * Email and Password Sign-In Server Action
 */
export async function signInWithPasswordAction(
  _prevState: unknown,
  input: FormData | SignInWithPasswordInput,
): Promise<AuthActionResult> {
  try {
    const rawData = input instanceof FormData ? extractFormData(input) : input;
    const parsed = signInWithPasswordSchema.safeParse(rawData);

    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      const firstErrorMessage = Object.values(fieldErrors)[0]?.[0] || "Invalid login credentials.";
      return {
        success: false,
        error: firstErrorMessage,
        fieldErrors,
      };
    }

    const { email, password, redirectTo } = parsed.data;

    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return {
        success: false,
        error: mapAuthError(error),
      };
    }

    if (data.user) {
      await ensureUserProfile(supabase, data.user);
    }

    const safeRedirect = isValidInternalRedirect(redirectTo)
      ? (redirectTo as string)
      : "/dashboard";

    return {
      success: true,
      message: "Signed in successfully.",
      redirectTo: safeRedirect,
    };
  } catch (err) {
    return {
      success: false,
      error: mapAuthError(err),
    };
  }
}

/**
 * Mobile SMS / WhatsApp OTP Request Server Action
 */
export async function requestPhoneOtpAction(
  _prevState: unknown,
  input: FormData | PhoneOtpRequestInput,
): Promise<AuthActionResult> {
  try {
    const rawData = input instanceof FormData ? extractFormData(input) : input;
    const parsed = phoneOtpRequestSchema.safeParse(rawData);

    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      const firstErrorMessage =
        Object.values(fieldErrors)[0]?.[0] || "Please enter a valid mobile number.";
      return {
        success: false,
        error: firstErrorMessage,
        fieldErrors,
      };
    }

    const { phone } = parsed.data;

    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.signInWithOtp({
      phone,
      options: {
        channel: "sms",
      },
    });

    if (error) {
      return {
        success: false,
        error: mapAuthError(error),
      };
    }

    return {
      success: true,
      message: `A 6-digit verification code has been sent to ${phone}.`,
    };
  } catch (err) {
    return {
      success: false,
      error: mapAuthError(err),
    };
  }
}

/**
 * Mobile Phone OTP Verification Server Action
 */
export async function verifyPhoneOtpAction(
  _prevState: unknown,
  input: FormData | PhoneOtpVerifyInput,
): Promise<AuthActionResult> {
  try {
    const rawData = input instanceof FormData ? extractFormData(input) : input;
    const parsed = phoneOtpVerifySchema.safeParse(rawData);

    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      const firstErrorMessage = Object.values(fieldErrors)[0]?.[0] || "Invalid verification code.";
      return {
        success: false,
        error: firstErrorMessage,
        fieldErrors,
      };
    }

    const { phone, token, redirectTo } = parsed.data;

    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: "sms",
    });

    if (error) {
      return {
        success: false,
        error: mapAuthError(error),
      };
    }

    if (data.user) {
      await ensureUserProfile(supabase, data.user, { phone });
    }

    const safeRedirect = isValidInternalRedirect(redirectTo)
      ? (redirectTo as string)
      : "/dashboard";

    return {
      success: true,
      message: "Phone verified successfully.",
      redirectTo: safeRedirect,
    };
  } catch (err) {
    return {
      success: false,
      error: mapAuthError(err),
    };
  }
}

/**
 * Password Recovery Request Server Action
 *
 * Returns uniform success message to protect against user enumeration.
 */
export async function requestPasswordResetAction(
  _prevState: unknown,
  input: FormData | RequestPasswordResetInput,
): Promise<AuthActionResult> {
  try {
    const rawData = input instanceof FormData ? extractFormData(input) : input;
    const parsed = requestPasswordResetSchema.safeParse(rawData);

    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      const firstErrorMessage =
        Object.values(fieldErrors)[0]?.[0] || "Please enter a valid email address.";
      return {
        success: false,
        error: firstErrorMessage,
        fieldErrors,
      };
    }

    const { email, redirectTo } = parsed.data;

    const safeCallback = isValidInternalRedirect(redirectTo)
      ? (redirectTo as string)
      : "/auth/callback?next=/update-password";

    const supabase = await createServerSupabaseClient();

    // In local or production, construct callback URL
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: safeCallback,
    });

    if (error) {
      // Map error, but do not leak non-existent account
      return {
        success: false,
        error: mapAuthError(error),
      };
    }

    // Always uniform response
    return {
      success: true,
      message:
        "If an account with that email exists, we have sent instructions to reset your password.",
    };
  } catch (err) {
    return {
      success: false,
      error: mapAuthError(err),
    };
  }
}

/**
 * Update Password Server Action
 *
 * Updates password for currently authenticated user (or user in PKCE reset session).
 */
export async function updatePasswordAction(
  _prevState: unknown,
  input: FormData | UpdatePasswordInput,
): Promise<AuthActionResult> {
  try {
    const rawData = input instanceof FormData ? extractFormData(input) : input;
    const parsed = updatePasswordSchema.safeParse(rawData);

    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      const firstErrorMessage = Object.values(fieldErrors)[0]?.[0] || "Invalid password entered.";
      return {
        success: false,
        error: firstErrorMessage,
        fieldErrors,
      };
    }

    const { password } = parsed.data;

    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      return {
        success: false,
        error: mapAuthError(error),
      };
    }

    return {
      success: true,
      message: "Your password has been successfully updated.",
      redirectTo: "/dashboard",
    };
  } catch (err) {
    return {
      success: false,
      error: mapAuthError(err),
    };
  }
}

/**
 * Sign Out Server Action
 */
export async function signOutAction(): Promise<AuthActionResult> {
  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      return {
        success: false,
        error: mapAuthError(error),
      };
    }

    return {
      success: true,
      message: "Signed out successfully.",
      redirectTo: "/login",
    };
  } catch (err) {
    return {
      success: false,
      error: mapAuthError(err),
    };
  }
}
