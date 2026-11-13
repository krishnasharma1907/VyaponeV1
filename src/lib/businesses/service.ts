import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type {
  BusinessMemberRow,
  BusinessMemberWithProfile,
  BusinessRole,
  BusinessRow,
  BusinessSummary,
  BusinessWithLocations,
  LocationRow,
} from "./types";
import { canAssignBusinessRole, canManageBusinessRole, hasBusinessPermission } from "./permissions";
import type {
  AddBusinessMemberInput,
  CreateBusinessOutput,
  CreateLocationInput,
  UpdateBusinessMemberRoleInput,
  UpdateBusinessProfileInput,
  UpdateLocationInput,
} from "./schemas";

export class BusinessError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number = 400,
  ) {
    super(message);
    this.name = "BusinessError";
  }
}

/**
 * Normalizes text to an alphanumeric URL slug.
 */
function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "business";
}

/**
 * Resolves caller's business role and sovereign ownership status for a given business.
 */
export async function getCallerBusinessAccess(
  supabase: SupabaseClient<Database>,
  businessId: string,
  callerUserId: string,
): Promise<{
  role: BusinessRole | null;
  isSovereignOwner: boolean;
  isWorkspaceManager: boolean;
}> {
  // 1. Fetch business record to check sovereign_owner_id and workspace_id
  const { data: business, error: bizError } = await supabase
    .from("businesses")
    .select("id, sovereign_owner_id, workspace_id")
    .eq("id", businessId)
    .maybeSingle();

  if (bizError || !business) {
    return { role: null, isSovereignOwner: false, isWorkspaceManager: false };
  }

  const isSovereignOwner = business.sovereign_owner_id === callerUserId;

  // 2. Fetch direct business membership
  const { data: member } = await supabase
    .from("business_members")
    .select("role, status")
    .eq("business_id", businessId)
    .eq("user_id", callerUserId)
    .eq("status", "active")
    .maybeSingle();

  let directRole: BusinessRole | null = (member?.role as BusinessRole) ?? null;

  // If sovereign owner doesn't have an explicit member record, treat as owner
  if (isSovereignOwner && !directRole) {
    directRole = "owner";
  }

  // 3. Check workspace manager status if business is linked to a workspace
  let isWorkspaceManager = false;
  if (business.workspace_id) {
    const { data: wsMember } = await supabase
      .from("workspace_members")
      .select("role, status")
      .eq("workspace_id", business.workspace_id)
      .eq("user_id", callerUserId)
      .eq("status", "active")
      .maybeSingle();

    if (
      wsMember &&
      ["workspace_owner", "workspace_admin", "reseller_admin"].includes(wsMember.role)
    ) {
      isWorkspaceManager = true;
    }
  }

  return {
    role: directRole,
    isSovereignOwner,
    isWorkspaceManager,
  };
}

/**
 * Creates a new business along with its primary location and initial business_owner membership.
 * Operates atomically via RPC if available, or sequential verified database calls.
 */
export async function createBusiness(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  input: CreateBusinessOutput,
): Promise<BusinessWithLocations> {
  const slug = input.slug
    ? slugify(input.slug)
    : `${slugify(input.trade_name)}-${Math.random().toString(36).substring(2, 6)}`;

  // 1. If workspace_id is provided, verify caller has permission in workspace
  if (input.workspace_id) {
    const { data: wsMember, error: wsError } = await supabase
      .from("workspace_members")
      .select("role, status")
      .eq("workspace_id", input.workspace_id)
      .eq("user_id", callerUserId)
      .eq("status", "active")
      .maybeSingle();

    if (
      wsError ||
      !wsMember ||
      !["workspace_owner", "workspace_admin", "reseller_admin"].includes(wsMember.role)
    ) {
      throw new BusinessError(
        "You do not have management permissions in the specified workspace",
        "WORKSPACE_PERMISSION_DENIED",
        403,
      );
    }
  }

  // 2. Check for slug collision
  const { data: existingSlug } = await supabase
    .from("businesses")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (existingSlug) {
    throw new BusinessError("A business with this slug already exists", "SLUG_CONFLICT", 409);
  }

  // 3. Insert Business record with caller as sovereign_owner_id
  const { data: business, error: bizError } = await supabase
    .from("businesses")
    .insert({
      workspace_id: input.workspace_id ?? null,
      legal_name: input.legal_name,
      trade_name: input.trade_name,
      slug,
      gst_number: input.gst_number ?? null,
      pan_number: input.pan_number ?? null,
      status: "onboarding",
      currency_code: "INR",
      sovereign_owner_id: callerUserId,
    })
    .select("*")
    .single();

  if (bizError || !business) {
    if (bizError?.code === "23505") {
      throw new BusinessError("A business with this slug already exists", "SLUG_CONFLICT", 409);
    }
    throw new BusinessError(
      bizError?.message ?? "Failed to create business",
      "BUSINESS_CREATE_FAILED",
      500,
    );
  }

  // 4. Insert Primary Location
  const locationSlug = "main";
  const { data: primaryLocation, error: locError } = await supabase
    .from("locations")
    .insert({
      business_id: business.id,
      name: input.location_name,
      slug: locationSlug,
      address_line1: input.address_line1,
      address_line2: input.address_line2 ?? null,
      city: input.city,
      state: input.state,
      postal_code: input.postal_code,
      is_primary: true,
    })
    .select("*")
    .single();

  if (locError || !primaryLocation) {
    throw new BusinessError(
      locError?.message ?? "Failed to create primary location",
      "PRIMARY_LOCATION_CREATE_FAILED",
      500,
    );
  }

  // 5. Insert Initial Owner Membership
  const { error: memberError } = await supabase.from("business_members").insert({
    business_id: business.id,
    user_id: callerUserId,
    role: "owner",
    location_id: primaryLocation.id,
    permissions: {
      can_bill: true,
      can_manage_catalogue: true,
      can_view_reports: true,
      can_edit_settings: true,
    },
    status: "active",
  });

  if (memberError) {
    throw new BusinessError(memberError.message, "BUSINESS_MEMBER_INIT_FAILED", 500);
  }

  // 6. Record append-only audit log
  await supabase.from("audit_logs").insert({
    business_id: business.id,
    workspace_id: business.workspace_id,
    user_id: callerUserId,
    action: "business.created",
    resource: "businesses",
    metadata_json: {
      trade_name: business.trade_name,
      slug: business.slug,
      primary_location_id: primaryLocation.id,
      workspace_id: business.workspace_id,
    },
  });

  return {
    business,
    primaryLocation,
    locations: [primaryLocation],
    currentUserRole: "owner",
    isSovereignOwner: true,
  };
}

/**
 * Retrieves a business and its locations, verifying caller access.
 */
export async function getBusiness(
  supabase: SupabaseClient<Database>,
  businessId: string,
  callerUserId: string,
): Promise<BusinessWithLocations> {
  const access = await getCallerBusinessAccess(supabase, businessId, callerUserId);

  if (!access.isSovereignOwner && !access.role && !access.isWorkspaceManager) {
    throw new BusinessError("You do not have access to this business", "FORBIDDEN", 403);
  }

  const { data: business, error: bizError } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", businessId)
    .single();

  if (bizError || !business) {
    throw new BusinessError("Business not found", "NOT_FOUND", 404);
  }

  const { data: locations, error: locError } = await supabase
    .from("locations")
    .select("*")
    .eq("business_id", businessId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });

  if (locError) {
    throw new BusinessError("Failed to fetch business locations", "LOCATIONS_FETCH_FAILED", 500);
  }

  const allLocations = locations ?? [];
  const primaryLocation = allLocations.find((l) => l.is_primary) ?? allLocations[0] ?? null;

  return {
    business,
    primaryLocation,
    locations: allLocations,
    currentUserRole: access.role ?? (access.isSovereignOwner ? "owner" : "staff"),
    isSovereignOwner: access.isSovereignOwner,
  };
}

/**
 * Retrieves all businesses accessible to the caller (sovereign owner, direct member, or workspace manager).
 */
export async function getUserBusinesses(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
): Promise<BusinessSummary[]> {
  // 1. Direct memberships
  const { data: memberships } = await supabase
    .from("business_members")
    .select("business_id, role, businesses (*)")
    .eq("user_id", callerUserId)
    .eq("status", "active");

  // 2. Sovereign owned businesses
  const { data: ownedBusinesses } = await supabase
    .from("businesses")
    .select("*")
    .eq("sovereign_owner_id", callerUserId);

  const businessMap = new Map<string, BusinessSummary>();

  if (ownedBusinesses) {
    for (const b of ownedBusinesses) {
      businessMap.set(b.id, {
        id: b.id,
        trade_name: b.trade_name,
        legal_name: b.legal_name,
        slug: b.slug,
        status: b.status,
        workspace_id: b.workspace_id,
        sovereign_owner_id: b.sovereign_owner_id,
        isPrimaryLocationConfigured: true,
        currentUserRole: "owner",
      });
    }
  }

  if (memberships) {
    for (const m of memberships) {
      const b = m.businesses;
      if (b && typeof b === "object" && !businessMap.has(b.id)) {
        businessMap.set(b.id, {
          id: b.id,
          trade_name: b.trade_name,
          legal_name: b.legal_name,
          slug: b.slug,
          status: b.status,
          workspace_id: b.workspace_id,
          sovereign_owner_id: b.sovereign_owner_id,
          isPrimaryLocationConfigured: true,
          currentUserRole: (m.role as BusinessRole) ?? "staff",
        });
      }
    }
  }

  return Array.from(businessMap.values());
}

/**
 * Updates a business's core statutory & profile details.
 */
export async function updateBusinessProfile(
  supabase: SupabaseClient<Database>,
  businessId: string,
  callerUserId: string,
  input: UpdateBusinessProfileInput,
): Promise<BusinessRow> {
  const access = await getCallerBusinessAccess(supabase, businessId, callerUserId);

  const canEdit =
    access.isSovereignOwner ||
    (access.role && hasBusinessPermission(access.role, "business:update_profile")) ||
    access.isWorkspaceManager;

  if (!canEdit) {
    throw new BusinessError(
      "You do not have permission to update this business profile",
      "FORBIDDEN",
      403,
    );
  }

  const updates: Partial<BusinessRow> = {};
  if (input.trade_name !== undefined) updates.trade_name = input.trade_name;
  if (input.legal_name !== undefined) updates.legal_name = input.legal_name;
  if (input.gst_number !== undefined) updates.gst_number = input.gst_number;
  if (input.pan_number !== undefined) updates.pan_number = input.pan_number;
  if (input.status !== undefined) updates.status = input.status;

  const { data: updated, error } = await supabase
    .from("businesses")
    .update(updates)
    .eq("id", businessId)
    .select("*")
    .single();

  if (error || !updated) {
    throw new BusinessError(
      error?.message ?? "Failed to update business profile",
      "PROFILE_UPDATE_FAILED",
      500,
    );
  }

  // Audit log
  await supabase.from("audit_logs").insert({
    business_id: businessId,
    workspace_id: updated.workspace_id,
    user_id: callerUserId,
    action: "business.profile_updated",
    resource: "businesses",
    metadata_json: {
      updated_fields: Object.keys(updates),
    },
  });

  return updated;
}

/**
 * Creates a location under a business.
 * If is_primary is set to true, existing locations for the business are unset.
 */
export async function createLocation(
  supabase: SupabaseClient<Database>,
  businessId: string,
  callerUserId: string,
  input: CreateLocationInput,
): Promise<LocationRow> {
  const access = await getCallerBusinessAccess(supabase, businessId, callerUserId);

  const canManageLocations =
    access.isSovereignOwner ||
    (access.role && hasBusinessPermission(access.role, "business:manage_locations")) ||
    access.isWorkspaceManager;

  if (!canManageLocations) {
    throw new BusinessError(
      "You do not have permission to manage locations for this business",
      "FORBIDDEN",
      403,
    );
  }

  const slug = input.slug
    ? slugify(input.slug)
    : `${slugify(input.name)}-${Math.random().toString(36).substring(2, 6)}`;

  // If new location is primary, unset any existing primary location
  if (input.is_primary) {
    await supabase
      .from("locations")
      .update({ is_primary: false })
      .eq("business_id", businessId)
      .eq("is_primary", true);
  }

  const { data: location, error } = await supabase
    .from("locations")
    .insert({
      business_id: businessId,
      name: input.name,
      slug,
      address_line1: input.address_line1,
      address_line2: input.address_line2 ?? null,
      city: input.city,
      state: input.state,
      postal_code: input.postal_code,
      is_primary: input.is_primary ?? false,
    })
    .select("*")
    .single();

  if (error || !location) {
    if (error?.code === "23505") {
      throw new BusinessError(
        "A location with this slug already exists for this business",
        "LOCATION_SLUG_CONFLICT",
        409,
      );
    }
    throw new BusinessError(
      error?.message ?? "Failed to create location",
      "LOCATION_CREATE_FAILED",
      500,
    );
  }

  // Audit log
  await supabase.from("audit_logs").insert({
    business_id: businessId,
    user_id: callerUserId,
    action: "location.created",
    resource: "locations",
    metadata_json: {
      location_id: location.id,
      name: location.name,
      is_primary: location.is_primary,
    },
  });

  return location;
}

/**
 * Updates an existing location's profile and primary status.
 */
export async function updateLocation(
  supabase: SupabaseClient<Database>,
  locationId: string,
  callerUserId: string,
  input: UpdateLocationInput,
): Promise<LocationRow> {
  // 1. Fetch location to get business_id
  const { data: location, error: fetchError } = await supabase
    .from("locations")
    .select("*")
    .eq("id", locationId)
    .single();

  if (fetchError || !location) {
    throw new BusinessError("Location not found", "NOT_FOUND", 404);
  }

  const access = await getCallerBusinessAccess(supabase, location.business_id, callerUserId);
  const canManageLocations =
    access.isSovereignOwner ||
    (access.role && hasBusinessPermission(access.role, "business:manage_locations")) ||
    access.isWorkspaceManager;

  if (!canManageLocations) {
    throw new BusinessError(
      "You do not have permission to manage locations for this business",
      "FORBIDDEN",
      403,
    );
  }

  // If toggling is_primary to true, unset any other primary location
  if (input.is_primary === true) {
    await supabase
      .from("locations")
      .update({ is_primary: false })
      .eq("business_id", location.business_id)
      .eq("is_primary", true);
  }

  const updates: Partial<LocationRow> = {};
  if (input.name !== undefined) updates.name = input.name;
  if (input.slug !== undefined) updates.slug = slugify(input.slug);
  if (input.address_line1 !== undefined) updates.address_line1 = input.address_line1;
  if (input.address_line2 !== undefined) updates.address_line2 = input.address_line2;
  if (input.city !== undefined) updates.city = input.city;
  if (input.state !== undefined) updates.state = input.state;
  if (input.postal_code !== undefined) updates.postal_code = input.postal_code;
  if (input.is_primary !== undefined) updates.is_primary = input.is_primary;

  const { data: updated, error } = await supabase
    .from("locations")
    .update(updates)
    .eq("id", locationId)
    .select("*")
    .single();

  if (error || !updated) {
    throw new BusinessError(
      error?.message ?? "Failed to update location",
      "LOCATION_UPDATE_FAILED",
      500,
    );
  }

  // Audit log
  await supabase.from("audit_logs").insert({
    business_id: location.business_id,
    user_id: callerUserId,
    action: "location.updated",
    resource: "locations",
    metadata_json: {
      location_id: locationId,
      updated_fields: Object.keys(updates),
    },
  });

  return updated;
}

/**
 * Retrieves all locations for a business.
 */
export async function getBusinessLocations(
  supabase: SupabaseClient<Database>,
  businessId: string,
  callerUserId: string,
): Promise<LocationRow[]> {
  const access = await getCallerBusinessAccess(supabase, businessId, callerUserId);

  if (!access.isSovereignOwner && !access.role && !access.isWorkspaceManager) {
    throw new BusinessError("You do not have access to this business", "FORBIDDEN", 403);
  }

  const { data: locations, error } = await supabase
    .from("locations")
    .select("*")
    .eq("business_id", businessId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    throw new BusinessError(
      error?.message ?? "Failed to fetch locations",
      "LOCATIONS_FETCH_FAILED",
      500,
    );
  }

  return locations ?? [];
}

/**
 * Fetches all operational members for a business.
 */
export async function getBusinessMembers(
  supabase: SupabaseClient<Database>,
  businessId: string,
  callerUserId: string,
): Promise<BusinessMemberWithProfile[]> {
  const access = await getCallerBusinessAccess(supabase, businessId, callerUserId);

  if (!access.isSovereignOwner && !access.role && !access.isWorkspaceManager) {
    throw new BusinessError("You do not have access to this business", "FORBIDDEN", 403);
  }

  const { data: members, error } = await supabase
    .from("business_members")
    .select("*, users (id, display_name, email, phone_number)")
    .eq("business_id", businessId)
    .order("created_at", { ascending: true });

  if (error || !members) {
    throw new BusinessError(
      error?.message ?? "Failed to fetch business members",
      "MEMBERS_FETCH_FAILED",
      500,
    );
  }

  return members.map((m) => ({
    id: m.id,
    business_id: m.business_id,
    user_id: m.user_id,
    role: m.role as BusinessRole,
    location_id: m.location_id,
    permissions: (m.permissions as Record<string, boolean>) ?? {},
    status: m.status as "active" | "invited" | "deactivated",
    created_at: m.created_at,
    user: (m.users as unknown as {
      id: string;
      display_name: string;
      email: string | null;
      phone_number: string | null;
    }) ?? {
      id: m.user_id,
      display_name: "Team Member",
      email: null,
      phone_number: null,
    },
  }));
}

/**
 * Adds an operational team member to a business.
 */
export async function addBusinessMember(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  input: AddBusinessMemberInput,
): Promise<BusinessMemberRow> {
  const access = await getCallerBusinessAccess(supabase, input.business_id, callerUserId);

  const callerRole = access.isSovereignOwner ? "owner" : access.role;
  if (!callerRole || !hasBusinessPermission(callerRole, "business:manage_members")) {
    throw new BusinessError(
      "You do not have permission to add members to this business",
      "FORBIDDEN",
      403,
    );
  }

  if (!canAssignBusinessRole(callerRole, input.role)) {
    throw new BusinessError(
      `Your role (${callerRole}) cannot assign the role ${input.role}`,
      "INSUFFICIENT_ROLE_AUTHORITY",
      403,
    );
  }

  const { data: member, error } = await supabase
    .from("business_members")
    .insert({
      business_id: input.business_id,
      user_id: input.user_id,
      role: input.role,
      location_id: input.location_id ?? null,
      permissions: input.permissions ?? {},
      status: "active",
    })
    .select("*")
    .single();

  if (error || !member) {
    if (error?.code === "23505") {
      throw new BusinessError(
        "User is already a member of this business",
        "MEMBER_ALREADY_EXISTS",
        409,
      );
    }
    throw new BusinessError(
      error?.message ?? "Failed to add business member",
      "MEMBER_ADD_FAILED",
      500,
    );
  }

  // Audit log
  await supabase.from("audit_logs").insert({
    business_id: input.business_id,
    user_id: callerUserId,
    action: "business_member.added",
    resource: "business_members",
    metadata_json: {
      added_user_id: input.user_id,
      role: input.role,
    },
  });

  return member;
}

/**
 * Updates a member's role or status, enforcing Last-Owner Protection and hierarchy authority.
 */
export async function updateBusinessMemberRole(
  supabase: SupabaseClient<Database>,
  businessId: string,
  targetUserId: string,
  callerUserId: string,
  input: UpdateBusinessMemberRoleInput,
): Promise<BusinessMemberRow> {
  const access = await getCallerBusinessAccess(supabase, businessId, callerUserId);

  const callerRole = access.isSovereignOwner ? "owner" : access.role;
  if (!callerRole || !hasBusinessPermission(callerRole, "business:manage_members")) {
    throw new BusinessError(
      "You do not have permission to manage members in this business",
      "FORBIDDEN",
      403,
    );
  }

  // Fetch target member
  const { data: targetMember, error: targetError } = await supabase
    .from("business_members")
    .select("*")
    .eq("business_id", businessId)
    .eq("user_id", targetUserId)
    .single();

  if (targetError || !targetMember) {
    throw new BusinessError("Target member not found", "NOT_FOUND", 404);
  }

  // Last-Owner Protection: Prohibit demoting or deactivating the sole owner
  if (
    targetMember.role === "owner" &&
    ((input.role !== undefined && input.role !== "owner") || input.status === "deactivated")
  ) {
    const { count } = await supabase
      .from("business_members")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("role", "owner")
      .eq("status", "active");

    if ((count ?? 0) <= 1) {
      throw new BusinessError(
        "Cannot demote or deactivate the sole owner of the business",
        "LAST_OWNER_PROTECTION",
        400,
      );
    }
  }

  // Downward authority check
  if (!canManageBusinessRole(callerRole, targetMember.role as BusinessRole)) {
    throw new BusinessError(
      `Your role (${callerRole}) cannot manage a member with role ${targetMember.role}`,
      "INSUFFICIENT_ROLE_AUTHORITY",
      403,
    );
  }

  // If assigning a new role, check caller authority
  if (input.role && !canAssignBusinessRole(callerRole, input.role)) {
    throw new BusinessError(
      `Your role (${callerRole}) cannot assign role ${input.role}`,
      "INSUFFICIENT_ROLE_AUTHORITY",
      403,
    );
  }

  const updates: Partial<BusinessMemberRow> = {};
  if (input.role !== undefined) updates.role = input.role;
  if (input.status !== undefined) updates.status = input.status;
  if (input.location_id !== undefined) updates.location_id = input.location_id;
  if (input.permissions !== undefined) updates.permissions = input.permissions;

  const { data: updated, error } = await supabase
    .from("business_members")
    .update(updates)
    .eq("id", targetMember.id)
    .select("*")
    .single();

  if (error || !updated) {
    throw new BusinessError(
      error?.message ?? "Failed to update business member",
      "MEMBER_UPDATE_FAILED",
      500,
    );
  }

  // Audit log
  await supabase.from("audit_logs").insert({
    business_id: businessId,
    user_id: callerUserId,
    action: "business_member.role_changed",
    resource: "business_members",
    metadata_json: {
      target_user_id: targetUserId,
      previous_role: targetMember.role,
      new_role: updated.role,
      status: updated.status,
    },
  });

  return updated;
}

/**
 * Removes a member from a business, enforcing Last-Owner Protection.
 */
export async function removeBusinessMember(
  supabase: SupabaseClient<Database>,
  businessId: string,
  targetUserId: string,
  callerUserId: string,
): Promise<{ success: true }> {
  const access = await getCallerBusinessAccess(supabase, businessId, callerUserId);

  const callerRole = access.isSovereignOwner ? "owner" : access.role;
  if (!callerRole || !hasBusinessPermission(callerRole, "business:manage_members")) {
    throw new BusinessError(
      "You do not have permission to remove members from this business",
      "FORBIDDEN",
      403,
    );
  }

  // Fetch target member
  const { data: targetMember, error: targetError } = await supabase
    .from("business_members")
    .select("*")
    .eq("business_id", businessId)
    .eq("user_id", targetUserId)
    .single();

  if (targetError || !targetMember) {
    throw new BusinessError("Target member not found", "NOT_FOUND", 404);
  }

  // Last-Owner Protection
  if (targetMember.role === "owner") {
    const { count } = await supabase
      .from("business_members")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("role", "owner")
      .eq("status", "active");

    if ((count ?? 0) <= 1) {
      throw new BusinessError(
        "Cannot remove the sole owner of the business",
        "LAST_OWNER_PROTECTION",
        400,
      );
    }
  }

  // Downward authority check
  if (!canManageBusinessRole(callerRole, targetMember.role as BusinessRole)) {
    throw new BusinessError(
      `Your role (${callerRole}) cannot remove a member with role ${targetMember.role}`,
      "INSUFFICIENT_ROLE_AUTHORITY",
      403,
    );
  }

  const { error } = await supabase.from("business_members").delete().eq("id", targetMember.id);

  if (error) {
    throw new BusinessError(
      error.message ?? "Failed to remove member",
      "MEMBER_REMOVE_FAILED",
      500,
    );
  }

  // Audit log
  await supabase.from("audit_logs").insert({
    business_id: businessId,
    user_id: callerUserId,
    action: "business_member.removed",
    resource: "business_members",
    metadata_json: {
      removed_user_id: targetUserId,
      role: targetMember.role,
    },
  });

  return { success: true };
}
