/**
 * VyapOne — Pre-publish Validation Service [VO-049]
 *
 * Server-authoritative pre-publish validation engine ensuring website drafts meet:
 * 1. Business facts requirements (trade name, primary phone, address)
 * 2. Site metadata integrity (title, subdomain, description, favicon)
 * 3. Navigation & page link integrity (homepage presence, valid internal routes, HTTPS external links)
 * 4. Media asset readiness & tenant isolation (status='ready', owned by business)
 * 5. Approved block library conformity (only APPROVED_BLOCK_REGISTRY components)
 * 6. Module operational readiness (canonical & active business modules)
 * 7. Subscription plan capacity (live_websites limit enforcement)
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { assertBusinessAccess } from "@/lib/auth/tenant-access";
import { APPROVED_BLOCK_REGISTRY } from "@/components/websites/blocks/block-registry";
import { getCapacityUsage } from "@/lib/plans/service";
import { websiteConfigurationSchema } from "./schemas";
import type {
  PrePublishCheckItem,
  PrePublishValidationResult,
  WebsiteConfiguration,
} from "./types";
import { WebsiteError } from "./service";

interface MediaReference {
  mediaId: string;
  location: string;
}

/**
 * Traverses website configuration to extract all media asset references with location context.
 */
function extractMediaReferences(config: WebsiteConfiguration): MediaReference[] {
  const references: MediaReference[] = [];

  if (config.metadata.faviconMediaId) {
    references.push({
      mediaId: config.metadata.faviconMediaId,
      location: "Site Metadata (Favicon)",
    });
  }

  if (config.header.logoMediaId) {
    references.push({
      mediaId: config.header.logoMediaId,
      location: "Header (Logo)",
    });
  }

  for (const page of config.pages) {
    if (page.seo?.ogImageMediaId) {
      references.push({
        mediaId: page.seo.ogImageMediaId,
        location: `Page "${page.title}" (OG Image)`,
      });
    }

    for (const section of page.sections) {
      if (!section.props || typeof section.props !== "object") continue;
      const props = section.props as Record<string, unknown>;

      if (typeof props.imageMediaId === "string" && props.imageMediaId) {
        references.push({
          mediaId: props.imageMediaId,
          location: `Page "${page.title}" -> Section "${section.id}" (${section.type})`,
        });
      }

      if (typeof props.bannerMediaId === "string" && props.bannerMediaId) {
        references.push({
          mediaId: props.bannerMediaId,
          location: `Page "${page.title}" -> Section "${section.id}" (${section.type})`,
        });
      }

      if (Array.isArray(props.images)) {
        for (let i = 0; i < props.images.length; i++) {
          const img = props.images[i];
          if (
            img &&
            typeof img === "object" &&
            typeof (img as { mediaId?: string }).mediaId === "string"
          ) {
            references.push({
              mediaId: (img as { mediaId: string }).mediaId,
              location: `Page "${page.title}" -> Section "${section.id}" -> Image #${i + 1}`,
            });
          }
        }
      }

      if (Array.isArray(props.items)) {
        for (let i = 0; i < props.items.length; i++) {
          const item = props.items[i];
          if (
            item &&
            typeof item === "object" &&
            typeof (item as { mediaId?: string }).mediaId === "string"
          ) {
            references.push({
              mediaId: (item as { mediaId: string }).mediaId,
              location: `Page "${page.title}" -> Section "${section.id}" -> Item #${i + 1}`,
            });
          }
        }
      }
    }
  }

  return references;
}

/**
 * Validates a website draft configuration against pre-publishing rules.
 */
export async function validateSiteForPublishing(
  supabase: SupabaseClient<Database>,
  siteId: string,
  overrideConfig?: WebsiteConfiguration,
): Promise<PrePublishValidationResult> {
  const checks: PrePublishCheckItem[] = [];

  // 1. Fetch site record
  const { data: site, error: siteError } = await supabase
    .from("sites")
    .select("*")
    .eq("id", siteId)
    .maybeSingle();

  if (siteError || !site) {
    throw new WebsiteError("Site not found or inaccessible", "SITE_NOT_FOUND", 404);
  }

  // 2. Tenant isolation assertion
  const { business } = await assertBusinessAccess(supabase, site.business_id);

  // 3. Resolve target draft configuration
  let config: WebsiteConfiguration;
  let draftVersionId: string | undefined = site.current_draft_version_id ?? undefined;

  if (overrideConfig) {
    config = overrideConfig;
  } else {
    if (!site.current_draft_version_id) {
      checks.push({
        id: "draft_missing",
        category: "site_metadata",
        severity: "error",
        title: "Missing Working Draft",
        message:
          "This website has no draft version configured. Please save a draft before publishing.",
      });

      return {
        isValid: false,
        canPublish: false,
        errorCount: 1,
        warningCount: 0,
        checks,
        validatedAt: new Date().toISOString(),
        siteId,
      };
    }

    const { data: draftVersion, error: draftError } = await supabase
      .from("site_versions")
      .select("*")
      .eq("id", site.current_draft_version_id)
      .maybeSingle();

    if (draftError || !draftVersion) {
      throw new WebsiteError("Draft version record not found", "DRAFT_VERSION_NOT_FOUND", 404);
    }

    draftVersionId = draftVersion.id;
    const parsed = websiteConfigurationSchema.safeParse(draftVersion.configuration);
    if (!parsed.success) {
      checks.push({
        id: "schema_invalid",
        category: "site_metadata",
        severity: "error",
        title: "Invalid Configuration Schema",
        message: `Draft configuration failed schema validation: ${parsed.error.issues.map((e) => e.message).join(", ")}`,
      });

      return {
        isValid: false,
        canPublish: false,
        errorCount: 1,
        warningCount: 0,
        checks,
        validatedAt: new Date().toISOString(),
        siteId,
        draftVersionId,
      };
    }

    config = parsed.data;
  }

  // =========================================================================
  // Check 1: Business Facts
  // =========================================================================
  if (!business.trade_name || business.trade_name.trim().length === 0) {
    checks.push({
      id: "business_trade_name_missing",
      category: "business_facts",
      severity: "error",
      title: "Business Trade Name Required",
      message: "Business trade name is missing. Storefronts require a valid business trade name.",
      navigationPath: "/settings/business",
    });
  }

  const contactConfig = (business.contact_configuration as Record<string, unknown>) || {};
  const phone =
    (typeof contactConfig.phone === "string" && contactConfig.phone.trim()) ||
    (typeof contactConfig.primaryPhone === "string" && contactConfig.primaryPhone.trim()) ||
    (typeof contactConfig.whatsapp === "string" && contactConfig.whatsapp.trim());

  if (!phone) {
    checks.push({
      id: "business_phone_missing",
      category: "business_facts",
      severity: "error",
      title: "Primary Phone Number Required",
      message:
        "A primary contact phone number is required for customer enquiries and WhatsApp orders.",
      navigationPath: "/settings/business",
    });
  }

  const addressConfig = (business.address_configuration as Record<string, unknown>) || {};
  const hasAddress =
    addressConfig &&
    (typeof addressConfig.city === "string" ||
      typeof addressConfig.street === "string" ||
      typeof addressConfig.pincode === "string");

  if (!hasAddress) {
    checks.push({
      id: "business_address_missing",
      category: "business_facts",
      severity: "warning",
      title: "Business Address Recommended",
      message:
        "Physical business address is not configured. Providing location details improves customer trust and local SEO.",
      navigationPath: "/settings/business",
    });
  }

  // =========================================================================
  // Check 2: Site Metadata
  // =========================================================================
  if (!config.metadata.title || config.metadata.title.trim().length === 0) {
    checks.push({
      id: "site_title_missing",
      category: "site_metadata",
      severity: "error",
      title: "Site Title Required",
      message: "Website title cannot be empty.",
      navigationPath: "/editor?tab=settings",
    });
  }

  if (!config.metadata.subdomain || config.metadata.subdomain.trim().length < 3) {
    checks.push({
      id: "site_subdomain_missing",
      category: "site_metadata",
      severity: "error",
      title: "Valid Subdomain Required",
      message: "Subdomain must be at least 3 characters long.",
      navigationPath: "/editor?tab=settings",
    });
  }

  if (!config.metadata.description || config.metadata.description.trim().length === 0) {
    checks.push({
      id: "site_description_empty",
      category: "site_metadata",
      severity: "warning",
      title: "SEO Meta Description Recommended",
      message:
        "A search engine description helps your website rank higher in Google search results.",
      navigationPath: "/editor?tab=settings",
    });
  }

  if (!config.metadata.faviconMediaId) {
    checks.push({
      id: "site_favicon_missing",
      category: "site_metadata",
      severity: "warning",
      title: "Favicon Not Configured",
      message: "Uploading a favicon provides a professional look in browser tabs.",
      navigationPath: "/editor?tab=settings",
    });
  }

  // =========================================================================
  // Check 3: Navigation & Page Links
  // =========================================================================
  const pages = config.pages || [];
  if (pages.length === 0) {
    checks.push({
      id: "nav_no_pages",
      category: "navigation",
      severity: "error",
      title: "No Pages Defined",
      message: "Website must contain at least one page.",
      navigationPath: "/editor?tab=pages",
    });
  }

  const hasHomepage = pages.some((p) => p.slug === "/" || p.slug === "");
  if (!hasHomepage) {
    checks.push({
      id: "nav_missing_homepage",
      category: "navigation",
      severity: "error",
      title: "Homepage Required",
      message: "Website must define a homepage with slug '/'.",
      navigationPath: "/editor?tab=pages",
    });
  }

  const seenSlugs = new Set<string>();
  for (const page of pages) {
    const normalizedSlug = page.slug === "" ? "/" : page.slug;
    if (seenSlugs.has(normalizedSlug)) {
      checks.push({
        id: `nav_duplicate_slug_${page.id}`,
        category: "navigation",
        severity: "error",
        title: "Duplicate Page Route",
        message: `Multiple pages share the path "${normalizedSlug}". Each page must have a unique URL slug.`,
        navigationPath: `/editor?page=${page.id}`,
      });
    }
    seenSlugs.add(normalizedSlug);
  }

  // Check header navigation links
  if (config.header?.navLinks) {
    for (let i = 0; i < config.header.navLinks.length; i++) {
      const link = config.header.navLinks[i];
      if (!link) continue;

      if (link.isExternal || link.href.startsWith("http://") || link.href.startsWith("https://")) {
        if (link.href.startsWith("http://")) {
          checks.push({
            id: `nav_header_http_${i}`,
            category: "navigation",
            severity: "warning",
            title: "Insecure Navigation Link",
            message: `Header navigation link "${link.label}" uses unencrypted HTTP (${link.href}). Use HTTPS instead.`,
            navigationPath: "/editor?section=header",
          });
        }
      } else if (link.href.startsWith("/")) {
        // Internal page route
        const pathOnly = link.href.split("?")[0]?.split("#")[0] || "";
        if (pathOnly && !seenSlugs.has(pathOnly) && pathOnly !== "/") {
          checks.push({
            id: `nav_header_broken_${i}`,
            category: "navigation",
            severity: "error",
            title: "Broken Internal Navigation Link",
            message: `Header navigation link "${link.label}" points to "${link.href}", but no page with this slug exists.`,
            navigationPath: "/editor?section=header",
          });
        }
      }
    }
  }

  // Check footer links
  if (config.footer?.links) {
    for (let i = 0; i < config.footer.links.length; i++) {
      const link = config.footer.links[i];
      if (!link) continue;

      if (link.href.startsWith("http://")) {
        checks.push({
          id: `nav_footer_http_${i}`,
          category: "navigation",
          severity: "warning",
          title: "Insecure Footer Link",
          message: `Footer link "${link.label}" uses unencrypted HTTP (${link.href}). Use HTTPS instead.`,
          navigationPath: "/editor?section=footer",
        });
      } else if (link.href.startsWith("/")) {
        const pathOnly = link.href.split("?")[0]?.split("#")[0] || "";
        if (pathOnly && !seenSlugs.has(pathOnly) && pathOnly !== "/") {
          checks.push({
            id: `nav_footer_broken_${i}`,
            category: "navigation",
            severity: "error",
            title: "Broken Internal Footer Link",
            message: `Footer link "${link.label}" points to "${link.href}", but no page with this slug exists.`,
            navigationPath: "/editor?section=footer",
          });
        }
      }
    }
  }

  // =========================================================================
  // Check 4: Approved Blocks Library
  // =========================================================================
  for (const page of pages) {
    if (!page.sections || page.sections.length === 0) {
      checks.push({
        id: `block_empty_page_${page.id}`,
        category: "blocks",
        severity: "error",
        title: "Empty Page",
        message: `Page "${page.title}" contains no sections. Add at least one content block.`,
        navigationPath: `/editor?page=${page.id}`,
      });
      continue;
    }

    for (const section of page.sections) {
      if (!APPROVED_BLOCK_REGISTRY[section.type]) {
        checks.push({
          id: `block_unapproved_${section.id}`,
          category: "blocks",
          severity: "error",
          title: "Unapproved Block Type",
          message: `Section "${section.id}" uses unapproved block type "${section.type}". Websites may only assemble canonical approved blocks.`,
          navigationPath: `/editor?page=${page.id}&section=${section.id}`,
        });
      }
    }
  }

  // =========================================================================
  // Check 5: Media Readiness & Isolation
  // =========================================================================
  const mediaRefs = extractMediaReferences(config);
  const mediaIds = Array.from(new Set(mediaRefs.map((r) => r.mediaId)));

  if (mediaIds.length > 0) {
    const { data: mediaRows, error: mediaError } = await supabase
      .from("media_items")
      .select("id, business_id, status")
      .in("id", mediaIds);

    if (mediaError) {
      checks.push({
        id: "media_query_failed",
        category: "media",
        severity: "error",
        title: "Media Asset Verification Failed",
        message: `Unable to verify media assets: ${mediaError.message}`,
      });
    } else {
      const mediaMap = new Map((mediaRows || []).map((m) => [m.id, m]));

      for (const ref of mediaRefs) {
        const found = mediaMap.get(ref.mediaId);

        if (!found) {
          checks.push({
            id: `media_not_found_${ref.mediaId}`,
            category: "media",
            severity: "error",
            title: "Missing Media Asset",
            message: `Media referenced at ${ref.location} was not found or was deleted.`,
            details: { mediaId: ref.mediaId, location: ref.location },
          });
        } else if (found.business_id !== site.business_id) {
          checks.push({
            id: `media_tenant_violation_${ref.mediaId}`,
            category: "media",
            severity: "error",
            title: "Unauthorized Media Asset",
            message: `Media referenced at ${ref.location} does not belong to this business.`,
            details: { mediaId: ref.mediaId, location: ref.location },
          });
        } else if (found.status !== "ready") {
          checks.push({
            id: `media_not_ready_${ref.mediaId}`,
            category: "media",
            severity: "error",
            title: "Media Asset Not Ready",
            message: `Media referenced at ${ref.location} is still processing (status: ${found.status}). Please wait until processing completes before publishing.`,
            details: { mediaId: ref.mediaId, location: ref.location, status: found.status },
          });
        }
      }
    }
  }

  // =========================================================================
  // Check 6: Modules Readiness
  // =========================================================================
  if (config.modules && typeof config.modules === "object") {
    const enabledModules = Object.entries(config.modules).filter(([, m]) => m && m.enabled);

    if (enabledModules.length > 0) {
      const moduleKeys = enabledModules.map(([k]) => k);
      const { data: bModules } = await supabase
        .from("business_modules")
        .select("module_key, is_enabled")
        .eq("business_id", site.business_id)
        .in("module_key", moduleKeys);

      const activeModuleSet = new Set(
        (bModules || []).filter((m) => m.is_enabled).map((m) => m.module_key),
      );

      for (const [moduleKey] of enabledModules) {
        if (!activeModuleSet.has(moduleKey)) {
          checks.push({
            id: `module_inactive_${moduleKey}`,
            category: "modules",
            severity: "warning",
            title: `Module Inactive (${moduleKey})`,
            message: `Module "${moduleKey}" is enabled in your website design, but is currently inactive or not configured in your business settings.`,
            navigationPath: "/settings/modules",
          });
        }
      }
    }
  }

  // =========================================================================
  // Check 7: Plan Capacity
  // =========================================================================
  let planCapacityInfo: PrePublishValidationResult["planCapacity"] = undefined;

  if (business.workspace_id) {
    try {
      const usage = await getCapacityUsage(supabase, business.workspace_id, "live_websites");

      const isAlreadyPublished = site.status === "published";
      const hasSlotAvailable = usage.current < usage.effectiveLimit;
      const isAllowed = isAlreadyPublished || hasSlotAvailable;

      planCapacityInfo = {
        currentPublishedSites: usage.current,
        maxPublishedSites: usage.effectiveLimit,
        allowed: isAllowed,
        reason: isAllowed
          ? undefined
          : `Plan limit reached (${usage.current}/${usage.effectiveLimit} published sites). Upgrade your plan to publish.`,
      };

      if (!isAllowed) {
        checks.push({
          id: "plan_capacity_exceeded",
          category: "plan_capacity",
          severity: "error",
          title: "Plan Capacity Limit Reached",
          message: `Your workspace has reached the maximum allowed published websites (${usage.current}/${usage.effectiveLimit}). Upgrade your plan to publish this storefront.`,
          navigationPath: "/settings/billing",
        });
      }
    } catch {
      // If workspace plan cannot be resolved, allow check to proceed without failing
    }
  }

  const errorCount = checks.filter((c) => c.severity === "error").length;
  const warningCount = checks.filter((c) => c.severity === "warning").length;

  return {
    isValid: errorCount === 0,
    canPublish: errorCount === 0,
    errorCount,
    warningCount,
    checks,
    validatedAt: new Date().toISOString(),
    siteId,
    draftVersionId,
    planCapacity: planCapacityInfo,
  };
}
