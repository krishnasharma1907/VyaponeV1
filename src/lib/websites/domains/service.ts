/**
 * VyapOne — Custom Domain Service [VO-049]
 *
 * Provides tenant-isolated management of custom domain hostnames, DNS verification
 * challenges, SSL status tracking, and public domain resolution.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { assertBusinessAccess } from "@/lib/auth/tenant-access";
import { recordAuditEvent } from "@/lib/audit/service";
import {
  addCustomDomainInputSchema,
  removeCustomDomainInputSchema,
  verifyCustomDomainInputSchema,
  type AddCustomDomainInput,
  type RemoveCustomDomainInput,
  type VerifyCustomDomainInput,
} from "../schemas";
import type { DomainDnsInstructions, SiteDomainRow, SiteRow, SiteVersionRow } from "../types";
import { WebsiteError } from "../service";
import { getCustomDomainAdapter } from "./adapter";
import type { CustomDomainProviderAdapter } from "./types";

export interface AddDomainResult {
  domain: SiteDomainRow;
  instructions: DomainDnsInstructions;
}

export interface VerifyDomainResult {
  success: boolean;
  domain: SiteDomainRow;
  reason?: string;
}

/**
 * Builds DNS verification instructions for a domain record.
 */
export function formatDnsInstructions(domainRow: SiteDomainRow): DomainDnsInstructions {
  return {
    domain: domainRow.domain,
    recordType: domainRow.verification_method === "dns_cname" ? "CNAME" : "TXT",
    host: `_vyapone-challenge.${domainRow.domain}`,
    value: domainRow.verification_target || domainRow.verification_token,
    status: domainRow.status,
  };
}

/**
 * Adds a custom domain to a website and generates DNS verification challenge.
 */
export async function addCustomDomain(
  supabase: SupabaseClient<Database>,
  input: AddCustomDomainInput,
  customAdapter?: CustomDomainProviderAdapter,
): Promise<AddDomainResult> {
  const parsed = addCustomDomainInputSchema.parse(input);
  const adapter = customAdapter || getCustomDomainAdapter();

  // 1. Fetch site & assert tenant access
  const { data: site, error: siteError } = await supabase
    .from("sites")
    .select("*")
    .eq("id", parsed.siteId)
    .maybeSingle();

  if (siteError || !site) {
    throw new WebsiteError("Site not found or inaccessible", "SITE_NOT_FOUND", 404);
  }

  const { business } = await assertBusinessAccess(supabase, site.business_id);

  // 2. Check if domain is already registered anywhere
  const { data: existingDomain } = await supabase
    .from("site_domains")
    .select("id, business_id, site_id, status")
    .eq("domain", parsed.domain)
    .maybeSingle();

  if (existingDomain) {
    if (existingDomain.business_id !== site.business_id) {
      throw new WebsiteError(
        "This domain is already registered to another account",
        "DOMAIN_ALREADY_REGISTERED",
        409,
      );
    }
    if (existingDomain.site_id === site.id && existingDomain.status !== "suspended") {
      throw new WebsiteError(
        "This domain is already added to this website",
        "DOMAIN_ALREADY_EXISTS_ON_SITE",
        409,
      );
    }
  }

  // 3. Request challenge from provider adapter
  const challenge = await adapter.createDnsChallenge(parsed.domain);

  // 4. Insert domain record
  const { data: insertedDomain, error: insertError } = await supabase
    .from("site_domains")
    .insert({
      site_id: site.id,
      business_id: site.business_id,
      domain: parsed.domain,
      status: "pending_verification",
      verification_method: challenge.method,
      verification_token: challenge.token,
      verification_target: challenge.value,
      ssl_status: "pending",
    })
    .select("*")
    .single();

  if (insertError || !insertedDomain) {
    throw new WebsiteError(
      `Failed to register custom domain: ${insertError?.message || "Unknown database error"}`,
      "DOMAIN_INSERT_FAILED",
      500,
    );
  }

  // 5. Emit audit event
  try {
    if (business.workspace_id) {
      await recordAuditEvent(supabase, {
        workspaceId: business.workspace_id,
        action: "site.domain_added",
        resource: "site_domains",
        metadata: {
          site_id: site.id,
          business_id: site.business_id,
          domain: parsed.domain,
          domain_id: insertedDomain.id,
        },
      });
    }
  } catch {
    // Non-blocking audit recording
  }

  return {
    domain: insertedDomain,
    instructions: formatDnsInstructions(insertedDomain),
  };
}

/**
 * Checks DNS verification for a pending domain.
 */
export async function verifyCustomDomain(
  supabase: SupabaseClient<Database>,
  input: VerifyCustomDomainInput,
  customAdapter?: CustomDomainProviderAdapter,
): Promise<VerifyDomainResult> {
  const parsed = verifyCustomDomainInputSchema.parse(input);
  const adapter = customAdapter || getCustomDomainAdapter();

  // 1. Fetch domain record
  const { data: domainRow, error: domainError } = await supabase
    .from("site_domains")
    .select("*")
    .eq("id", parsed.domainId)
    .eq("site_id", parsed.siteId)
    .maybeSingle();

  if (domainError || !domainRow) {
    throw new WebsiteError("Domain record not found", "DOMAIN_NOT_FOUND", 404);
  }

  // 2. Tenant access assertion
  const { business } = await assertBusinessAccess(supabase, domainRow.business_id);

  // 3. Run verification check via adapter
  const verification = await adapter.verifyDomain(domainRow.domain, domainRow.verification_token);

  if (!verification.verified) {
    const { data: updatedFailed } = await supabase
      .from("site_domains")
      .update({
        status: "failed",
        ssl_status: verification.sslStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", domainRow.id)
      .select("*")
      .single();

    return {
      success: false,
      domain: updatedFailed || domainRow,
      reason: verification.reason || "DNS challenge verification failed",
    };
  }

  // 4. Mark verified & activate SSL
  const now = new Date().toISOString();
  const { data: updatedDomain, error: updateError } = await supabase
    .from("site_domains")
    .update({
      status: "verified",
      ssl_status: verification.sslStatus,
      verified_at: now,
      updated_at: now,
    })
    .eq("id", domainRow.id)
    .select("*")
    .single();

  if (updateError || !updatedDomain) {
    throw new WebsiteError(
      `Failed to update verified domain: ${updateError?.message || "Unknown database error"}`,
      "DOMAIN_UPDATE_FAILED",
      500,
    );
  }

  // 5. Update site primary_domain if not set
  const { data: site } = await supabase
    .from("sites")
    .select("primary_domain")
    .eq("id", parsed.siteId)
    .maybeSingle();

  if (site && !site.primary_domain) {
    await supabase
      .from("sites")
      .update({
        primary_domain: updatedDomain.domain,
        updated_at: now,
      })
      .eq("id", parsed.siteId);
  }

  // 6. Emit audit event
  try {
    if (business.workspace_id) {
      await recordAuditEvent(supabase, {
        workspaceId: business.workspace_id,
        action: "site.domain_verified",
        resource: "site_domains",
        metadata: {
          site_id: parsed.siteId,
          business_id: domainRow.business_id,
          domain: updatedDomain.domain,
          domain_id: updatedDomain.id,
        },
      });
    }
  } catch {
    // Non-blocking audit recording
  }

  return {
    success: true,
    domain: updatedDomain,
  };
}

/**
 * Removes a custom domain from a site.
 */
export async function removeCustomDomain(
  supabase: SupabaseClient<Database>,
  input: RemoveCustomDomainInput,
  customAdapter?: CustomDomainProviderAdapter,
): Promise<{ success: boolean }> {
  const parsed = removeCustomDomainInputSchema.parse(input);
  const adapter = customAdapter || getCustomDomainAdapter();

  // 1. Fetch domain record
  const { data: domainRow, error: domainError } = await supabase
    .from("site_domains")
    .select("*")
    .eq("id", parsed.domainId)
    .eq("site_id", parsed.siteId)
    .maybeSingle();

  if (domainError || !domainRow) {
    throw new WebsiteError("Domain record not found", "DOMAIN_NOT_FOUND", 404);
  }

  // 2. Tenant access assertion
  const { business } = await assertBusinessAccess(supabase, domainRow.business_id);

  // 3. Remove from external provider
  await adapter.removeDomain(domainRow.domain);

  // 4. Delete row from database
  const { error: deleteError } = await supabase
    .from("site_domains")
    .delete()
    .eq("id", domainRow.id);

  if (deleteError) {
    throw new WebsiteError(
      `Failed to remove domain: ${deleteError.message}`,
      "DOMAIN_DELETE_FAILED",
      500,
    );
  }

  // 5. If this was the site's primary domain, clear it
  const { data: site } = await supabase
    .from("sites")
    .select("primary_domain")
    .eq("id", parsed.siteId)
    .maybeSingle();

  if (site && site.primary_domain === domainRow.domain) {
    await supabase
      .from("sites")
      .update({
        primary_domain: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", parsed.siteId);
  }

  // 6. Emit audit event
  try {
    if (business.workspace_id) {
      await recordAuditEvent(supabase, {
        workspaceId: business.workspace_id,
        action: "site.domain_removed",
        resource: "site_domains",
        metadata: {
          site_id: parsed.siteId,
          business_id: domainRow.business_id,
          domain: domainRow.domain,
        },
      });
    }
  } catch {
    // Non-blocking audit recording
  }

  return { success: true };
}

/**
 * Lists all custom domains configured for a website.
 */
export async function getSiteDomains(
  supabase: SupabaseClient<Database>,
  siteId: string,
): Promise<SiteDomainRow[]> {
  const { data: site } = await supabase
    .from("sites")
    .select("business_id")
    .eq("id", siteId)
    .maybeSingle();

  if (!site) return [];

  await assertBusinessAccess(supabase, site.business_id);

  const { data: domains, error } = await supabase
    .from("site_domains")
    .select("*")
    .eq("site_id", siteId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new WebsiteError(`Failed to fetch domains: ${error.message}`, "DOMAIN_FETCH_FAILED", 500);
  }

  return domains || [];
}

/**
 * Resolves a public custom domain request to its corresponding published site.
 */
export async function resolveSiteByDomain(
  supabase: SupabaseClient<Database>,
  rawHost: string,
): Promise<{ site: SiteRow; version: SiteVersionRow } | null> {
  const cleanHost = rawHost.toLowerCase().split(":")[0].trim();

  // Find verified domain
  const { data: domainRow, error: domainError } = await supabase
    .from("site_domains")
    .select("site_id, business_id, status")
    .eq("domain", cleanHost)
    .in("status", ["verified", "active"])
    .maybeSingle();

  if (domainError || !domainRow) {
    return null;
  }

  // Fetch published site
  const { data: site, error: siteError } = await supabase
    .from("sites")
    .select("*")
    .eq("id", domainRow.site_id)
    .eq("status", "published")
    .maybeSingle();

  if (siteError || !site || !site.published_version_id) {
    return null;
  }

  // Fetch published version
  const { data: version, error: versionError } = await supabase
    .from("site_versions")
    .select("*")
    .eq("id", site.published_version_id)
    .maybeSingle();

  if (versionError || !version) {
    return null;
  }

  return { site, version };
}
