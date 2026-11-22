/**
 * VyapOne — Website Configuration Service [VO-040]
 *
 * Provides tenant-authorized operations for managing websites and versioned
 * structured configurations in accordance with PRD FINAL v2 §6.14, §15.3, §16, §17:
 * - Scoped to business and parent workspace.
 * - Enforces immutable versioning in `public.site_versions`.
 * - Validates media isolation for referenced assets (VO-032).
 * - Enforces strict server-side validation against `websiteConfigurationSchema`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";
import { assertAuthenticatedUser, assertBusinessAccess } from "@/lib/auth/tenant-access";
import { CANONICAL_MODULES } from "@/lib/niches/constants";
import { buildInitialWebsiteConfiguration } from "./defaults";
import {
  restoreVersionToDraftInputSchema,
  rollbackPublishedVersionInputSchema,
  saveSiteDraftInputSchema,
  type RestoreVersionToDraftInput,
  type RollbackPublishedVersionInput,
  type SaveSiteDraftInput,
} from "./schemas";
import type {
  GetSiteVersionsResult,
  MediaItemSummary,
  ModuleOperationalStatus,
  ModuleRenderStatus,
  RestoreVersionToDraftResult,
  RollbackPublishedVersionResult,
  SaveSiteDraftResult,
  SiteRow,
  SiteVersionRow,
  SiteVersionSummary,
  WebsiteConfiguration,
} from "./types";
import { migrateWebsiteConfiguration } from "./versioning";

export class WebsiteError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = "WebsiteError";
  }
}

/**
 * Extracts all media UUIDs referenced across the configuration document.
 */
function extractReferencedMediaIds(config: WebsiteConfiguration): string[] {
  const ids = new Set<string>();

  if (config.metadata.faviconMediaId) ids.add(config.metadata.faviconMediaId);
  if (config.header.logoMediaId) ids.add(config.header.logoMediaId);

  for (const page of config.pages) {
    if (page.seo?.ogImageMediaId) ids.add(page.seo.ogImageMediaId);

    for (const section of page.sections) {
      if (!section.props || typeof section.props !== "object") continue;
      const props = section.props as Record<string, unknown>;

      if (typeof props.imageMediaId === "string") {
        ids.add(props.imageMediaId);
      }

      if (Array.isArray(props.images)) {
        for (const img of props.images) {
          if (
            img &&
            typeof img === "object" &&
            typeof (img as { mediaId?: string }).mediaId === "string"
          ) {
            ids.add((img as { mediaId: string }).mediaId);
          }
        }
      }
    }
  }

  return Array.from(ids);
}

/**
 * Retrieves the site record associated with a business.
 */
export async function getSiteByBusinessId(
  supabase: SupabaseClient<Database>,
  businessId: string,
): Promise<SiteRow | null> {
  const { business } = await assertBusinessAccess(supabase, businessId);

  const { data: site, error } = await supabase
    .from("sites")
    .select("*")
    .eq("business_id", business.id)
    .maybeSingle();

  if (error) {
    throw new WebsiteError("Failed to fetch site for business", "SITE_FETCH_FAILED", 500);
  }

  return site;
}

/**
 * Retrieves a site by its primary ID with tenant authorization.
 */
export async function getSiteById(
  supabase: SupabaseClient<Database>,
  siteId: string,
): Promise<SiteRow> {
  const { data: site, error } = await supabase
    .from("sites")
    .select("*")
    .eq("id", siteId)
    .maybeSingle();

  if (error || !site) {
    throw new WebsiteError("Site not found", "SITE_NOT_FOUND", 404);
  }

  // Authorize business access
  await assertBusinessAccess(supabase, site.business_id);

  return site;
}

/**
 * Retrieves all versions for a given site in descending version order.
 * Optionally supports pagination through limit and offset.
 */
export async function getSiteVersions(
  supabase: SupabaseClient<Database>,
  siteId: string,
  options?: { limit?: number; offset?: number },
): Promise<SiteVersionRow[]> {
  const site = await getSiteById(supabase, siteId);

  let query = supabase
    .from("site_versions")
    .select("*")
    .eq("site_id", site.id)
    .order("version_number", { ascending: false });

  if (options?.limit !== undefined) {
    const from = options.offset || 0;
    const to = from + options.limit - 1;
    query = query.range(from, to);
  }

  const { data: versions, error } = await query;

  if (error) {
    throw new WebsiteError("Failed to fetch site versions", "VERSIONS_FETCH_FAILED", 500);
  }

  return versions || [];
}

/**
 * Retrieves paginated site version history with status flags and summary [VO-048].
 */
export async function getSiteVersionHistory(
  supabase: SupabaseClient<Database>,
  siteId: string,
  options?: { limit?: number; offset?: number },
): Promise<GetSiteVersionsResult> {
  const site = await getSiteById(supabase, siteId);

  const { count, error: countError } = await supabase
    .from("site_versions")
    .select("*", { count: "exact", head: true })
    .eq("site_id", site.id);

  if (countError) {
    throw new WebsiteError("Failed to count site versions", "VERSIONS_COUNT_FAILED", 500);
  }

  const versions = await getSiteVersions(supabase, siteId, options);

  const summaries: SiteVersionSummary[] = versions.map((v) => ({
    id: v.id,
    siteId: v.site_id,
    businessId: v.business_id,
    versionNumber: v.version_number,
    schemaVersion: v.schema_version,
    changeSummary: v.change_summary,
    createdBy: v.created_by,
    publishedAt: v.published_at,
    createdAt: v.created_at,
    isCurrentDraft: v.id === site.current_draft_version_id,
    isPublished: v.id === site.published_version_id,
  }));

  return {
    versions,
    summaries,
    totalCount: count ?? versions.length,
    currentDraftVersionId: site.current_draft_version_id,
    publishedVersionId: site.published_version_id,
  };
}

/**
 * Retrieves and validates the configuration for a specific version ID [VO-048].
 */
export async function getSiteConfigurationById(
  supabase: SupabaseClient<Database>,
  siteId: string,
  versionId: string,
): Promise<{ version: SiteVersionRow; configuration: WebsiteConfiguration }> {
  const site = await getSiteById(supabase, siteId);

  const { data: version, error } = await supabase
    .from("site_versions")
    .select("*")
    .eq("site_id", site.id)
    .eq("id", versionId)
    .maybeSingle();

  if (error || !version) {
    throw new WebsiteError(`Site version '${versionId}' not found`, "VERSION_NOT_FOUND", 404);
  }

  const validatedConfig = migrateWebsiteConfiguration(version.configuration);

  return {
    version,
    configuration: validatedConfig,
  };
}

/**
 * Retrieves and validates the configuration for a specific version or the current draft.
 */
export async function getSiteConfiguration(
  supabase: SupabaseClient<Database>,
  siteId: string,
  versionNumber?: number,
): Promise<{ version: SiteVersionRow; configuration: WebsiteConfiguration }> {
  const site = await getSiteById(supabase, siteId);

  let query = supabase.from("site_versions").select("*").eq("site_id", site.id);

  if (versionNumber !== undefined) {
    query = query.eq("version_number", versionNumber);
  } else if (site.current_draft_version_id) {
    query = query.eq("id", site.current_draft_version_id);
  } else {
    // Pick latest version by number
    query = query.order("version_number", { ascending: false }).limit(1);
  }

  const { data: version, error } = await query.maybeSingle();

  if (error || !version) {
    throw new WebsiteError(
      versionNumber
        ? `Site version ${versionNumber} not found`
        : "No website configuration found for this site",
      "VERSION_NOT_FOUND",
      404,
    );
  }

  const validatedConfig = migrateWebsiteConfiguration(version.configuration);

  return {
    version,
    configuration: validatedConfig,
  };
}

/**
 * Saves a new draft configuration version for a site.
 * Increments the version number, guarantees immutability of historical versions,
 * verifies media isolation, updates the current draft pointer, and logs an audit event.
 */
/**
 * Saves a new draft configuration version for a site.
 * Executes atomically via PostgreSQL RPC `save_site_draft_configuration_atomic`:
 * - Locks the site row FOR UPDATE to serialize concurrent version saves.
 * - Verifies caller session identity and business authorization.
 * - Enforces media readiness (status = 'ready', verified_at) and approved website categories.
 * - Increments version number, creates immutable version, updates draft pointer, and logs audit event.
 */
export async function saveSiteDraftConfiguration(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  input: SaveSiteDraftInput,
): Promise<SaveSiteDraftResult> {
  const validated = saveSiteDraftInputSchema.parse(input);

  // 1. Authorize site and business access
  const site = await getSiteById(supabase, validated.siteId);
  const { business } = await assertBusinessAccess(supabase, site.business_id);

  // 2. Validate tenant consistency between configuration and database records
  if (validated.configuration.siteId !== site.id) {
    throw new WebsiteError(
      "Configuration siteId does not match target site",
      "SITE_ID_MISMATCH",
      400,
    );
  }

  if (validated.configuration.businessId !== business.id) {
    throw new WebsiteError(
      "Configuration businessId does not match site business owner",
      "BUSINESS_ID_MISMATCH",
      400,
    );
  }

  // 3. Pre-verify media items referenced in configuration (VO-032 / Audit E)
  const referencedMediaIds = extractReferencedMediaIds(validated.configuration);
  if (referencedMediaIds.length > 0) {
    const { data: mediaItems, error: mediaError } = await supabase
      .from("media_items")
      .select("id, business_id, workspace_id, status, verified_at, category")
      .in("id", referencedMediaIds);

    if (mediaError) {
      throw new WebsiteError(
        "Failed to verify referenced media items",
        "MEDIA_VERIFICATION_FAILED",
        500,
      );
    }

    const foundMediaMap = new Map((mediaItems || []).map((m) => [m.id, m]));
    const allowedCategories = [
      "business_logo",
      "catalogue_image",
      "website_asset",
      "onboarding_upload",
    ];

    for (const mediaId of referencedMediaIds) {
      const media = foundMediaMap.get(mediaId);
      if (!media) {
        throw new WebsiteError(
          `Referenced media item '${mediaId}' does not exist`,
          "MEDIA_NOT_FOUND",
          400,
        );
      }

      // Check tenant ownership
      const matchesBusiness = media.business_id === business.id;
      const matchesWorkspace =
        business.workspace_id && media.workspace_id === business.workspace_id;

      if (!matchesBusiness && !matchesWorkspace) {
        throw new WebsiteError(
          `Referenced media item '${mediaId}' belongs to another tenant`,
          "MEDIA_ISOLATION_VIOLATION",
          403,
        );
      }

      // Check media readiness and verification status
      if (media.status !== "ready" || !media.verified_at) {
        throw new WebsiteError(
          `Referenced media item '${mediaId}' is not verified and ready for use`,
          "MEDIA_NOT_READY",
          400,
        );
      }

      // Check allowed category for website assets
      if (!allowedCategories.includes(media.category)) {
        throw new WebsiteError(
          `Referenced media item '${mediaId}' has category '${media.category}' which is not permitted in websites`,
          "MEDIA_CATEGORY_NOT_ALLOWED",
          400,
        );
      }
    }
  }

  // 4. Execute atomic transactional RPC for version creation, pointer update, and audit logging
  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "save_site_draft_configuration_atomic",
    {
      p_site_id: site.id,
      p_business_id: business.id,
      p_caller_user_id: callerUserId,
      p_schema_version: "v1",
      p_configuration: validated.configuration as unknown as Json,
      p_change_summary: validated.changeSummary || null,
      p_referenced_media_ids: referencedMediaIds.length > 0 ? referencedMediaIds : null,
      p_expected_base_version_number: validated.expectedBaseVersionNumber,
    },
  );

  if (rpcError || !rpcData) {
    const errorMsg = rpcError?.message || "Failed to save draft configuration atomically";
    if (
      errorMsg.includes("Concurrency conflict") ||
      errorMsg.includes("conflict") ||
      rpcError?.code === "VY049"
    ) {
      throw new WebsiteError(errorMsg, "CONFLICT", 409);
    }
    if (
      errorMsg.includes("caller does not match authenticated session") ||
      rpcError?.code === "VY020"
    ) {
      throw new WebsiteError(errorMsg, "UNAUTHENTICATED", 401);
    }
    if (errorMsg.includes("permission") || rpcError?.code === "VY021") {
      throw new WebsiteError(errorMsg, "FORBIDDEN", 403);
    }
    if (errorMsg.includes("Cross-tenant") || rpcError?.code === "VY024") {
      throw new WebsiteError(errorMsg, "TENANT_MISMATCH", 403);
    }
    if (errorMsg.includes("media") || rpcError?.code === "VY032") {
      throw new WebsiteError(errorMsg, "MEDIA_VALIDATION_FAILED", 400);
    }
    if (rpcError?.code === "VY040") {
      throw new WebsiteError(errorMsg, "CONFIGURATION_INVALID", 400);
    }
    throw new WebsiteError(errorMsg, "DRAFT_SAVE_FAILED", 500);
  }

  const result = rpcData as unknown as { version: SiteVersionRow; site: SiteRow };

  return {
    site: result.site,
    version: result.version,
    configuration: validated.configuration,
  };
}

/**
 * Rolls back a site's live published version to a previously published version [VO-048].
 * Executes atomically via PostgreSQL RPC `rollback_published_site_version_atomic`:
 * - Locks the site row FOR UPDATE.
 * - Verifies caller identity and permissions.
 * - Enforces optimistic concurrency on current published_version_id.
 * - Verifies target version was previously published.
 * - Updates sites.published_version_id and status to 'published'.
 * - Preserves immutability of all version records (never mutates or deletes site_versions).
 * - Writes audit log: site.published_version_rolled_back.
 */
export async function rollbackPublishedVersion(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  input: RollbackPublishedVersionInput,
): Promise<RollbackPublishedVersionResult> {
  const validated = rollbackPublishedVersionInputSchema.parse(input);

  // 1. Authorize site and business access
  const site = await getSiteById(supabase, validated.siteId);
  const { business } = await assertBusinessAccess(supabase, site.business_id);

  // 2. Execute atomic rollback RPC
  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "rollback_published_site_version_atomic",
    {
      p_site_id: site.id,
      p_business_id: business.id,
      p_caller_user_id: callerUserId,
      p_target_version_id: validated.targetVersionId,
      p_expected_current_published_version_id: validated.expectedCurrentPublishedVersionId ?? null,
    },
  );

  if (rpcError || !rpcData) {
    const errorMsg = rpcError?.message || "Failed to rollback published site version";
    if (
      errorMsg.includes("conflict") ||
      errorMsg.includes("Rollback conflict") ||
      rpcError?.code === "VY049"
    ) {
      throw new WebsiteError(errorMsg, "CONFLICT", 409);
    }
    if (
      errorMsg.includes("Access denied") ||
      errorMsg.includes("Unauthorized") ||
      rpcError?.code === "VY020"
    ) {
      throw new WebsiteError(errorMsg, "UNAUTHORIZED", 403);
    }
    if (errorMsg.includes("not found") || rpcError?.code === "VY040") {
      throw new WebsiteError(errorMsg, "NOT_FOUND", 404);
    }
    throw new WebsiteError(errorMsg, "ROLLBACK_FAILED", 500);
  }

  const rawResult = rpcData as unknown as {
    site: SiteRow;
    targetVersion: SiteVersionRow;
  };

  const migratedConfig = migrateWebsiteConfiguration(rawResult.targetVersion.configuration);

  return {
    site: rawResult.site,
    rolledBackToVersion: rawResult.targetVersion,
    configuration: migratedConfig,
  };
}

/**
 * Restores a historical site version into a new working draft [VO-048].
 * Invariant: Preserves immutability of all past versions.
 * Assigns a new version number (MAX + 1) without touching published_version_id.
 */
export async function restoreVersionToDraft(
  supabase: SupabaseClient<Database>,
  callerUserId: string,
  input: RestoreVersionToDraftInput,
): Promise<RestoreVersionToDraftResult> {
  const validated = restoreVersionToDraftInputSchema.parse(input);

  // 1. Authorize site access
  const site = await getSiteById(supabase, validated.siteId);

  // 2. Fetch target historical version
  const { data: targetVersion, error: versionError } = await supabase
    .from("site_versions")
    .select("*")
    .eq("id", validated.targetVersionId)
    .eq("site_id", site.id)
    .maybeSingle();

  if (versionError || !targetVersion) {
    throw new WebsiteError(
      `Target site version '${validated.targetVersionId}' not found`,
      "VERSION_NOT_FOUND",
      404,
    );
  }

  // 3. Migrate and align configuration
  const targetConfig = migrateWebsiteConfiguration(targetVersion.configuration);
  targetConfig.siteId = site.id;
  targetConfig.businessId = site.business_id;

  // 4. Determine change summary
  const summary =
    validated.changeSummary || `Restored from version ${targetVersion.version_number}`;

  // 5. Save as a new draft version
  const saveResult = await saveSiteDraftConfiguration(supabase, callerUserId, {
    siteId: site.id,
    configuration: targetConfig,
    changeSummary: summary,
    expectedBaseVersionNumber: validated.expectedBaseVersionNumber,
  });

  return {
    site: saveResult.site,
    version: saveResult.version,
    configuration: saveResult.configuration,
  };
}

export interface OwnerWebsiteWorkspaceData {
  business: {
    id: string;
    name: string;
    tradeName: string;
    phone?: string;
    whatsappNumber?: string;
    primaryLocation?: {
      addressLine1: string;
      addressLine2?: string;
      city: string;
      state: string;
      postalCode: string;
      operatingHours?: Record<string, string>;
    };
  };
  site: SiteRow;
  version: SiteVersionRow;
  configuration: WebsiteConfiguration;
  catalogueItems: Array<{
    id: string;
    name: string;
    priceMinor: number;
    currency: string;
    isAvailable: boolean;
  }>;
  availableMedia: MediaItemSummary[];
  availableModules: Record<string, ModuleRenderStatus>;
  mediaUrls: Record<string, string>;
  isStarterDraft: boolean;
}

/**
 * Validates all media referenced in a website configuration document against the business media library.
 * Surfaces broken, cross-tenant, unverified, or non-publishable references (VO-046).
 */
export async function validateWebsiteMediaReferences(
  supabase: SupabaseClient<Database>,
  businessId: string,
  config: WebsiteConfiguration,
): Promise<{
  isValid: boolean;
  brokenMediaIds: string[];
  unverifiedMediaIds: string[];
  crossTenantMediaIds: string[];
  privateMediaIds: string[];
}> {
  const referencedIds = extractReferencedMediaIds(config);
  if (referencedIds.length === 0) {
    return {
      isValid: true,
      brokenMediaIds: [],
      unverifiedMediaIds: [],
      crossTenantMediaIds: [],
      privateMediaIds: [],
    };
  }

  const { data: mediaItems, error } = await supabase
    .from("media_items")
    .select("id, business_id, status, verified_at, is_public, category, bucket")
    .in("id", referencedIds);

  if (error) {
    throw new WebsiteError("Failed to check media references", "MEDIA_CHECK_FAILED", 500);
  }

  const mediaMap = new Map((mediaItems || []).map((m) => [m.id, m]));
  const brokenMediaIds: string[] = [];
  const unverifiedMediaIds: string[] = [];
  const crossTenantMediaIds: string[] = [];
  const privateMediaIds: string[] = [];

  for (const id of referencedIds) {
    const item = mediaMap.get(id);
    if (!item) {
      brokenMediaIds.push(id);
      continue;
    }
    if (item.business_id !== businessId) {
      crossTenantMediaIds.push(id);
      continue;
    }
    if (item.status !== "ready" || !item.verified_at) {
      unverifiedMediaIds.push(id);
      continue;
    }
    if (!item.is_public || item.bucket !== "vyapone-public-media") {
      privateMediaIds.push(id);
    }
  }

  const isValid =
    brokenMediaIds.length === 0 &&
    unverifiedMediaIds.length === 0 &&
    crossTenantMediaIds.length === 0;

  return {
    isValid,
    brokenMediaIds,
    unverifiedMediaIds,
    crossTenantMediaIds,
    privateMediaIds,
  };
}

/**
 * Loads the authenticated owner's website editor workspace.
 * Enforces server session authentication and strict business tenancy isolation (VO-044 Audit B & D).
 * Resolves authoritative business facts, catalogue items, and current draft configuration.
 */
export async function loadOwnerWebsiteWorkspace(
  supabase: SupabaseClient<Database>,
  targetBusinessId?: string,
): Promise<OwnerWebsiteWorkspaceData> {
  // 1. Enforce authenticated caller identity
  const caller = await assertAuthenticatedUser(supabase);

  // 2. Resolve active business ID
  let resolvedBusinessId = targetBusinessId;
  if (!resolvedBusinessId) {
    const { data: memberBiz } = await supabase
      .from("business_members")
      .select("business_id")
      .eq("user_id", caller.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (memberBiz?.business_id) {
      resolvedBusinessId = memberBiz.business_id;
    } else {
      const { data: ownedBiz } = await supabase
        .from("businesses")
        .select("id")
        .eq("sovereign_owner_id", caller.id)
        .limit(1)
        .maybeSingle();
      if (ownedBiz?.id) {
        resolvedBusinessId = ownedBiz.id;
      }
    }
  }

  if (!resolvedBusinessId) {
    throw new WebsiteError("No active business found for this merchant", "NO_BUSINESS_FOUND", 404);
  }

  // 3. Strictly assert tenant/business authorization (rejects cross-tenant access)
  const { business } = await assertBusinessAccess(supabase, resolvedBusinessId);

  // 4. Fetch primary location (if exists)
  const { data: location } = await supabase
    .from("locations")
    .select("address_line1, city, state, postal_code")
    .eq("business_id", business.id)
    .eq("is_primary", true)
    .maybeSingle();

  // 5. Fetch active catalogue items (strictly tenant-scoped)
  const { data: catalogueRecords } = await supabase
    .from("catalogue_items")
    .select("id, title, price_minor, currency_code, is_available")
    .eq("business_id", business.id)
    .eq("is_available", true)
    .limit(50);

  const catalogueItems = (catalogueRecords || []).map((item) => ({
    id: item.id,
    name: item.title || ((item as unknown as { name?: string }).name as string) || "",
    priceMinor: Number(item.price_minor),
    currency: item.currency_code || "INR",
    isAvailable: item.is_available ?? true,
  }));

  // 6. Fetch authorized verified media for business (VO-046)
  const { data: mediaRows } = await supabase
    .from("media_items")
    .select(
      "id, original_filename, category, file_size_bytes, width, height, is_public, status, bucket, object_key, verified_at, published_at",
    )
    .eq("business_id", business.id)
    .eq("status", "ready")
    .in("category", ["business_logo", "catalogue_image", "website_asset"])
    .order("created_at", { ascending: false });

  const mediaUrls: Record<string, string> = {};
  const availableMedia: MediaItemSummary[] = (mediaRows || []).map((m) => {
    const isFullUrl = m.object_key.startsWith("https://") || m.object_key.startsWith("http://");
    const url = isFullUrl
      ? m.object_key
      : m.is_public
        ? `https://cdn.vyapone.com/${m.bucket}/${m.object_key}`
        : `https://cdn.vyapone.com/preview/${m.bucket}/${m.object_key}`;

    if (m.verified_at) {
      mediaUrls[m.id] = url;
    }

    return {
      id: m.id,
      originalFilename: m.original_filename,
      category: m.category,
      fileSizeBytes: Number(m.file_size_bytes),
      width: m.width,
      height: m.height,
      isPublic: m.is_public,
      status: m.status,
      url,
    };
  });

  // 7. Fetch business module operational availability (VO-046)
  const { data: bizModules } = await supabase
    .from("business_modules")
    .select("module_key, is_enabled")
    .eq("business_id", business.id);

  const { data: platformModules } = await supabase
    .from("platform_modules")
    .select("key, name, category, status");

  const enabledSet = new Set(
    (bizModules || []).filter((bm) => bm.is_enabled).map((bm) => bm.module_key),
  );

  const availableModules: Record<string, ModuleRenderStatus> = {};
  if (platformModules && platformModules.length > 0) {
    for (const pm of platformModules) {
      const isEnabled = enabledSet.has(pm.key);
      let status: ModuleOperationalStatus = "disabled";

      if (pm.status === "coming_soon") {
        status = "coming_soon";
      } else if (pm.status === "deprecated") {
        status = "disabled";
      } else if (isEnabled) {
        status = "operational";
      } else {
        status = "informational";
      }

      availableModules[pm.key] = {
        status,
        isEnabled,
        name: pm.name,
        category: pm.category,
      };
    }
  } else {
    for (const cm of CANONICAL_MODULES) {
      availableModules[cm.key] = {
        status: cm.status === "coming_soon" ? "coming_soon" : "operational",
        isEnabled: true,
        name: cm.name,
        category: cm.category,
      };
    }
  }

  // 8. Fetch or initialize site
  let site = await getSiteByBusinessId(supabase, business.id);
  let version: SiteVersionRow;
  let configuration: WebsiteConfiguration;
  let isStarterDraft = false;

  if (site && site.current_draft_version_id) {
    try {
      const configResult = await getSiteConfiguration(supabase, site.id);
      version = configResult.version;
      configuration = configResult.configuration;
    } catch {
      isStarterDraft = true;
      configuration = buildInitialWebsiteConfiguration({
        siteId: site.id,
        businessId: business.id,
        tradeName: business.trade_name,
        subdomain: site.subdomain,
        nicheSlug: business.category || "retail",
        description: business.description || undefined,
      });
      version = {
        id: "00000000-0000-4000-8000-000000000001",
        site_id: site.id,
        business_id: business.id,
        version_number: 1,
        schema_version: "v1",
        configuration: configuration as unknown as Json,
        created_by: caller.id,
        change_summary: "Starter draft",
        published_at: null,
        created_at: new Date().toISOString(),
      };
    }
  } else {
    isStarterDraft = true;
    const siteId = site?.id || "00000000-0000-4000-8000-000000000001";
    const subdomain = site?.subdomain || business.slug || "my-store";
    configuration = buildInitialWebsiteConfiguration({
      siteId,
      businessId: business.id,
      tradeName: business.trade_name,
      subdomain,
      nicheSlug: business.category || "retail",
      description: business.description || undefined,
    });
    version = {
      id: "00000000-0000-4000-8000-000000000001",
      site_id: siteId,
      business_id: business.id,
      version_number: 1,
      schema_version: "v1",
      configuration: configuration as unknown as Json,
      created_by: caller.id,
      change_summary: "Starter draft",
      published_at: null,
      created_at: new Date().toISOString(),
    };
    if (!site) {
      site = {
        id: siteId,
        business_id: business.id,
        subdomain,
        primary_domain: null,
        status: "draft",
        current_draft_version_id: version.id,
        published_version_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }
  }

  const contactConfig =
    business.contact_configuration &&
    typeof business.contact_configuration === "object" &&
    !Array.isArray(business.contact_configuration)
      ? (business.contact_configuration as Record<string, unknown>)
      : null;

  return {
    business: {
      id: business.id,
      name: business.legal_name || business.trade_name,
      tradeName: business.trade_name,
      phone: (contactConfig?.primary_phone as string) || undefined,
      whatsappNumber: (contactConfig?.whatsapp_number as string) || undefined,
      primaryLocation:
        location &&
        location.address_line1 &&
        location.city &&
        location.state &&
        location.postal_code
          ? {
              addressLine1: location.address_line1,
              city: location.city,
              state: location.state,
              postalCode: location.postal_code,
            }
          : undefined,
    },
    site,
    version,
    configuration,
    catalogueItems,
    availableMedia,
    availableModules,
    mediaUrls,
    isStarterDraft,
  };
}
