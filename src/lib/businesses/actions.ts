"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  BusinessActionResult,
  BusinessMemberRow,
  BusinessMemberWithProfile,
  BusinessRow,
  BusinessSummary,
  BusinessWithLocations,
  LocationRow,
} from "./types";
import {
  createBusiness,
  getBusiness,
  getUserBusinesses,
  updateBusinessProfile,
  createLocation,
  updateLocation,
  getBusinessLocations,
  getBusinessMembers,
  addBusinessMember,
  updateBusinessMemberRole,
  removeBusinessMember,
  BusinessError,
} from "./service";
import {
  createBusinessSchema,
  updateBusinessProfileSchema,
  createLocationSchema,
  updateLocationSchema,
  addBusinessMemberSchema,
  updateBusinessMemberRoleSchema,
  type CreateBusinessInput,
  type UpdateBusinessProfileInput,
  type CreateLocationInput,
  type UpdateLocationInput,
  type AddBusinessMemberInput,
  type UpdateBusinessMemberRoleInput,
} from "./schemas";

function sanitizeError(error: unknown): { error: string; code: string } {
  if (error instanceof BusinessError) {
    return { error: error.message, code: error.code };
  }
  if (error instanceof Error) {
    return { error: error.message, code: "INTERNAL_ERROR" };
  }
  return { error: "An unexpected error occurred", code: "UNKNOWN_ERROR" };
}

/**
 * Creates a new sovereign business and its primary location.
 */
export async function createBusinessAction(
  rawInput: CreateBusinessInput,
): Promise<BusinessActionResult<BusinessWithLocations>> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Authentication required", code: "UNAUTHENTICATED" };
    }

    const parseResult = createBusinessSchema.safeParse(rawInput);
    if (!parseResult.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parseResult.error.issues) {
        const path = issue.path.join(".");
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return {
        success: false,
        error: "Validation failed",
        code: "VALIDATION_FAILED",
        validationErrors: fieldErrors,
      };
    }

    const result = await createBusiness(supabase, user.id, parseResult.data);
    revalidatePath("/dashboard");
    revalidatePath("/workspace");
    return { success: true, data: result };
  } catch (error) {
    const sanitized = sanitizeError(error);
    return { success: false, ...sanitized };
  }
}

/**
 * Retrieves a business and its locations.
 */
export async function getBusinessAction(
  businessId: string,
): Promise<BusinessActionResult<BusinessWithLocations>> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Authentication required", code: "UNAUTHENTICATED" };
    }

    const result = await getBusiness(supabase, businessId, user.id);
    return { success: true, data: result };
  } catch (error) {
    const sanitized = sanitizeError(error);
    return { success: false, ...sanitized };
  }
}

/**
 * Retrieves all businesses accessible to the caller.
 */
export async function getUserBusinessesAction(): Promise<BusinessActionResult<BusinessSummary[]>> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Authentication required", code: "UNAUTHENTICATED" };
    }

    const result = await getUserBusinesses(supabase, user.id);
    return { success: true, data: result };
  } catch (error) {
    const sanitized = sanitizeError(error);
    return { success: false, ...sanitized };
  }
}

/**
 * Updates a business's core statutory & profile details.
 */
export async function updateBusinessProfileAction(
  businessId: string,
  rawInput: UpdateBusinessProfileInput,
): Promise<BusinessActionResult<BusinessRow>> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Authentication required", code: "UNAUTHENTICATED" };
    }

    const parseResult = updateBusinessProfileSchema.safeParse(rawInput);
    if (!parseResult.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parseResult.error.issues) {
        const path = issue.path.join(".");
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return {
        success: false,
        error: "Validation failed",
        code: "VALIDATION_FAILED",
        validationErrors: fieldErrors,
      };
    }

    const result = await updateBusinessProfile(supabase, businessId, user.id, parseResult.data);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/settings");
    return { success: true, data: result };
  } catch (error) {
    const sanitized = sanitizeError(error);
    return { success: false, ...sanitized };
  }
}

/**
 * Creates a location under a business.
 */
export async function createLocationAction(
  rawInput: CreateLocationInput,
): Promise<BusinessActionResult<LocationRow>> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Authentication required", code: "UNAUTHENTICATED" };
    }

    const parseResult = createLocationSchema.safeParse(rawInput);
    if (!parseResult.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parseResult.error.issues) {
        const path = issue.path.join(".");
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return {
        success: false,
        error: "Validation failed",
        code: "VALIDATION_FAILED",
        validationErrors: fieldErrors,
      };
    }

    const result = await createLocation(
      supabase,
      parseResult.data.business_id,
      user.id,
      parseResult.data,
    );
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/settings");
    return { success: true, data: result };
  } catch (error) {
    const sanitized = sanitizeError(error);
    return { success: false, ...sanitized };
  }
}

/**
 * Updates an existing location's profile and primary status.
 */
export async function updateLocationAction(
  locationId: string,
  rawInput: UpdateLocationInput,
): Promise<BusinessActionResult<LocationRow>> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Authentication required", code: "UNAUTHENTICATED" };
    }

    const parseResult = updateLocationSchema.safeParse(rawInput);
    if (!parseResult.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parseResult.error.issues) {
        const path = issue.path.join(".");
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return {
        success: false,
        error: "Validation failed",
        code: "VALIDATION_FAILED",
        validationErrors: fieldErrors,
      };
    }

    const result = await updateLocation(supabase, locationId, user.id, parseResult.data);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/settings");
    return { success: true, data: result };
  } catch (error) {
    const sanitized = sanitizeError(error);
    return { success: false, ...sanitized };
  }
}

/**
 * Retrieves all locations for a business.
 */
export async function getBusinessLocationsAction(
  businessId: string,
): Promise<BusinessActionResult<LocationRow[]>> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Authentication required", code: "UNAUTHENTICATED" };
    }

    const result = await getBusinessLocations(supabase, businessId, user.id);
    return { success: true, data: result };
  } catch (error) {
    const sanitized = sanitizeError(error);
    return { success: false, ...sanitized };
  }
}

/**
 * Fetches all members of a business with their profile details.
 */
export async function getBusinessMembersAction(
  businessId: string,
): Promise<BusinessActionResult<BusinessMemberWithProfile[]>> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Authentication required", code: "UNAUTHENTICATED" };
    }

    const result = await getBusinessMembers(supabase, businessId, user.id);
    return { success: true, data: result };
  } catch (error) {
    const sanitized = sanitizeError(error);
    return { success: false, ...sanitized };
  }
}

/**
 * Adds an operational team member to a business.
 */
export async function addBusinessMemberAction(
  rawInput: AddBusinessMemberInput,
): Promise<BusinessActionResult<BusinessMemberRow>> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Authentication required", code: "UNAUTHENTICATED" };
    }

    const parseResult = addBusinessMemberSchema.safeParse(rawInput);
    if (!parseResult.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parseResult.error.issues) {
        const path = issue.path.join(".");
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return {
        success: false,
        error: "Validation failed",
        code: "VALIDATION_FAILED",
        validationErrors: fieldErrors,
      };
    }

    const result = await addBusinessMember(supabase, user.id, parseResult.data);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/settings");
    return { success: true, data: result };
  } catch (error) {
    const sanitized = sanitizeError(error);
    return { success: false, ...sanitized };
  }
}

/**
 * Modifies an operational team member's role or status.
 */
export async function updateBusinessMemberRoleAction(
  businessId: string,
  targetUserId: string,
  rawInput: UpdateBusinessMemberRoleInput,
): Promise<BusinessActionResult<BusinessMemberRow>> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Authentication required", code: "UNAUTHENTICATED" };
    }

    const parseResult = updateBusinessMemberRoleSchema.safeParse(rawInput);
    if (!parseResult.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parseResult.error.issues) {
        const path = issue.path.join(".");
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return {
        success: false,
        error: "Validation failed",
        code: "VALIDATION_FAILED",
        validationErrors: fieldErrors,
      };
    }

    const result = await updateBusinessMemberRole(
      supabase,
      businessId,
      targetUserId,
      user.id,
      parseResult.data,
    );
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/settings");
    return { success: true, data: result };
  } catch (error) {
    const sanitized = sanitizeError(error);
    return { success: false, ...sanitized };
  }
}

/**
 * Removes an operational team member from a business.
 */
export async function removeBusinessMemberAction(
  businessId: string,
  targetUserId: string,
): Promise<BusinessActionResult<{ success: true }>> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Authentication required", code: "UNAUTHENTICATED" };
    }

    const result = await removeBusinessMember(supabase, businessId, targetUserId, user.id);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/settings");
    return { success: true, data: result };
  } catch (error) {
    const sanitized = sanitizeError(error);
    return { success: false, ...sanitized };
  }
}
