import { z } from "zod";
import { normalizePhoneNumber } from "./security";

/**
 * Phone Number Validation Schema
 *
 * Normalizes input via normalizePhoneNumber and validates E.164 compliance.
 * Accepts 10-digit Indian numbers, prefixed 91 numbers, or international + format.
 */
export const phoneSchema = z
  .string()
  .trim()
  .min(10, "Mobile number must be at least 10 digits")
  .max(16, "Mobile number is too long")
  .transform((val) => normalizePhoneNumber(val))
  .refine((val) => /^\+[1-9]\d{9,14}$/.test(val), {
    message: "Please enter a valid 10-digit mobile number",
  });

/**
 * Email Address Validation Schema
 */
export const emailSchema = z
  .string()
  .trim()
  .email("Please enter a valid email address")
  .max(255, "Email address is too long")
  .toLowerCase();

/**
 * Password Validation Schema
 *
 * Enforces minimum 8 characters, maximum 72 characters, and both letters and numbers.
 */
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must not exceed 72 characters")
  .regex(/[a-zA-Z]/, "Password must contain at least one letter")
  .regex(/[0-9]/, "Password must contain at least one number");

/**
 * 6-Digit SMS / WhatsApp OTP Schema
 */
export const otpSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Verification code must be exactly 6 digits");

/**
 * User Sign-Up Schema
 */
export const signUpSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Full name must be at least 2 characters")
    .max(100, "Full name must not exceed 100 characters"),
  email: emailSchema,
  password: passwordSchema,
  phone: z
    .string()
    .trim()
    .optional()
    .transform((val) => (val && val.length > 0 ? normalizePhoneNumber(val) : undefined))
    .refine((val) => !val || /^\+[1-9]\d{9,14}$/.test(val), {
      message: "Please enter a valid 10-digit mobile number",
    }),
  businessName: z
    .string()
    .trim()
    .min(2, "Business name must be at least 2 characters")
    .max(100, "Business name must not exceed 100 characters")
    .optional(),
  accountType: z.enum(["owner", "reseller", "employee"]).default("owner"),
});

export type SignUpInput = z.input<typeof signUpSchema>;

/**
 * Email/Password Sign-In Schema
 */
export const signInWithPasswordSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
  redirectTo: z.string().optional(),
});

export type SignInWithPasswordInput = z.input<typeof signInWithPasswordSchema>;

/**
 * Phone OTP Request Schema
 */
export const phoneOtpRequestSchema = z.object({
  phone: phoneSchema,
});

export type PhoneOtpRequestInput = z.input<typeof phoneOtpRequestSchema>;

/**
 * Phone OTP Verification Schema
 */
export const phoneOtpVerifySchema = z.object({
  phone: phoneSchema,
  token: otpSchema,
  redirectTo: z.string().optional(),
});

export type PhoneOtpVerifyInput = z.input<typeof phoneOtpVerifySchema>;

/**
 * Password Recovery Request Schema
 */
export const requestPasswordResetSchema = z.object({
  email: emailSchema,
  redirectTo: z.string().optional(),
});

export type RequestPasswordResetInput = z.input<typeof requestPasswordResetSchema>;

/**
 * Update Password Schema (Used during password recovery or setting)
 */
export const updatePasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type UpdatePasswordInput = z.input<typeof updatePasswordSchema>;
