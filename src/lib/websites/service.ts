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
import { assertBusinessAccess } from "@/lib/auth/tenant-access";
import { recordAuditEvent } from "@/lib/audit/service";
import { saveSiteDraftInputSchema, type SaveSiteDraftInput } from "./schemas";
import type { SaveSiteDraftResult, SiteRow, SiteVersionRow, WebsiteConfiguration } from "./types";
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
 */
export async function getSiteVersions(
  supabase: SupabaseClient<Database>,
  siteId: string,
): Promise<SiteVersionRow[]> {
  const site = await getSiteById(supabase, siteId);

  const { data: versions, error } = await supabase
    .from("site_versions")
    .select("*")
    .eq("site_id", site.id)
    .order("version_number", { ascending: false });

  if (error) {
    throw new WebsiteError("Failed to fetch site versions", "VERSIONS_FETCH_FAILED", 500);
  }

  return versions || [];
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

  // 3. Verify media items referenced in configuration belong to this tenant (VO-032)
  const referencedMediaIds = extractReferencedMediaIds(validated.configuration);
  if (referencedMediaIds.length > 0) {
    const { data: mediaItems, error: mediaError } = await supabase
      .from("media_items")
      .select("id, business_id, workspace_id")
      .in("id", referencedMediaIds);

    if (mediaError) {
      throw new WebsiteError(
        "Failed to verify referenced media items",
        "MEDIA_VERIFICATION_FAILED",
        500,
      );
    }

    const foundMediaMap = new Map((mediaItems || []).map((m) => [m.id, m]));
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
    }
  }

  // 4. Calculate next version number
  const { data: latestVersions } = await supabase
    .from("site_versions")
    .select("version_number")
    .eq("site_id", site.id)
    .order("version_number", { ascending: false })
    .limit(1);

  const nextVersionNumber = (latestVersions?.[0]?.version_number || 0) + 1;

  // 5. Insert new immutable version
  const { data: newVersion, error: insertError } = await supabase
    .from("site_versions")
    .insert({
      site_id: site.id,
      business_id: business.id,
      version_number: nextVersionNumber,
      schema_version: "v1",
      configuration: validated.configuration as unknown as Json,
      change_summary: validated.changeSummary || null,
      created_by: callerUserId,
    })
    .select()
    .single();

  if (insertError || !newVersion) {
    throw new WebsiteError(
      insertError?.message || "Failed to insert new site version",
      "VERSION_CREATE_FAILED",
      500,
    );
  }

  // 6. Update current draft version pointer on public.sites
  const { data: updatedSite, error: updateSiteError } = await supabase
    .from("sites")
    .update({
      current_draft_version_id: newVersion.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", site.id)
    .select()
    .single();

  if (updateSiteError || !updatedSite) {
    throw new WebsiteError(
      updateSiteError?.message || "Failed to update site draft version pointer",
      "SITE_UPDATE_FAILED",
      500,
    );
  }

  // 7. Log audit event
  await recordAuditEvent(supabase, {
    businessId: business.id,
    workspaceId: business.workspace_id || undefined,
    actorUserId: callerUserId,
    action: "site.version_created",
    resource: "site",
    metadata: {
      site_id: site.id,
      version_id: newVersion.id,
      version_number: nextVersionNumber,
      schema_version: "v1",
      page_count: validated.configuration.pages.length,
      change_summary: validated.changeSummary || null,
    },
  });

  return {
    site: updatedSite,
    version: newVersion,
    configuration: validated.configuration,
  };
}
