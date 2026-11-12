import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export interface UserProfileBootstrapOptions {
  fullName?: string;
  phone?: string;
  email?: string;
  preferredLanguage?: string;
}

/**
 * Ensures that a corresponding row in public.users and public.user_auth_identities
 * exists for the authenticated user.
 *
 * In production Supabase, this is handled by database trigger handle_new_auth_user()
 * (migration 20261112000002_auth_profile_trigger.sql).
 *
 * This application-layer helper serves as an idempotent fallback for environments
 * where direct auth triggers might not have fired or during local testing with mocked clients.
 */
export async function ensureUserProfile(
  supabase: SupabaseClient<Database>,
  user: User,
  options?: UserProfileBootstrapOptions,
): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = user.id;
    const displayName =
      options?.fullName ||
      (typeof user.user_metadata?.display_name === "string"
        ? user.user_metadata.display_name
        : null) ||
      (typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null) ||
      (typeof user.user_metadata?.name === "string" ? user.user_metadata.name : null) ||
      (user.email ? user.email.split("@")[0] : null) ||
      (user.phone ? user.phone : null) ||
      "VyapOne User";

    const email = options?.email || user.email || null;
    const phone = options?.phone || user.phone || null;
    const preferredLanguage = options?.preferredLanguage || "en";

    // Check if user already exists
    const { data: existingUser, error: fetchError } = await supabase
      .from("users")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (fetchError && fetchError.code !== "PGRST116") {
      return { success: false, error: fetchError.message };
    }

    if (!existingUser) {
      // Insert public user profile
      const { error: insertUserError } = await supabase.from("users").insert({
        id: userId,
        display_name: displayName,
        email: email,
        phone_number: phone,
        status: "active",
        preferred_language: preferredLanguage,
      });

      if (insertUserError) {
        return { success: false, error: insertUserError.message };
      }
    }

    // Ensure auth identity record exists
    if (phone) {
      const { data: existingPhoneIdentity } = await supabase
        .from("user_auth_identities")
        .select("id")
        .eq("user_id", userId)
        .eq("provider", "phone_otp")
        .eq("identifier", phone)
        .maybeSingle();

      if (!existingPhoneIdentity) {
        await supabase.from("user_auth_identities").insert({
          user_id: userId,
          provider: "phone_otp",
          identifier: phone,
          verified_at: user.phone_confirmed_at || new Date().toISOString(),
        });
      }
    }

    if (email) {
      const { data: existingEmailIdentity } = await supabase
        .from("user_auth_identities")
        .select("id")
        .eq("user_id", userId)
        .eq("provider", "email_password")
        .eq("identifier", email)
        .maybeSingle();

      if (!existingEmailIdentity) {
        await supabase.from("user_auth_identities").insert({
          user_id: userId,
          provider: "email_password",
          identifier: email,
          verified_at: user.email_confirmed_at || new Date().toISOString(),
        });
      }
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to ensure user profile",
    };
  }
}
