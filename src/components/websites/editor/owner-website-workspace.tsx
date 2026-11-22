"use client";

/**
 * VyapOne — Owner Website Workspace Client [VO-044 Audit B & D]
 *
 * Client workspace wrapper for the merchant dashboard website editor.
 * Initializes from authenticated server action `loadOwnerWebsiteWorkspaceAction`.
 * Strictly enforces business authorization, tenant isolation, and clear starter draft status.
 */

import React, { useEffect, useState } from "react";
import { Badge } from "@/components/ui";
import { ConstrainedWebsiteEditor } from "./constrained-website-editor";
import { loadOwnerWebsiteWorkspaceAction } from "@/lib/websites/actions";
import type {
  MediaItemSummary,
  ModuleRenderStatus,
  SiteRow,
  SiteVersionRow,
  WebsiteConfiguration,
} from "@/lib/websites/types";
import type { WebsiteRenderContext } from "@/components/websites/blocks/types";

export interface OwnerWebsiteWorkspaceProps {
  initialSite: SiteRow;
  initialVersion: SiteVersionRow;
  initialConfiguration: WebsiteConfiguration;
  initialContext: WebsiteRenderContext;
  businessId?: string;
}

export function OwnerWebsiteWorkspace({
  initialSite,
  initialVersion,
  initialConfiguration,
  initialContext,
  businessId,
}: OwnerWebsiteWorkspaceProps) {
  const [site, setSite] = useState<SiteRow>(initialSite);
  const [version, setVersion] = useState<SiteVersionRow>(initialVersion);
  const [configuration, setConfiguration] = useState<WebsiteConfiguration>(initialConfiguration);
  const [context, setContext] = useState<WebsiteRenderContext>(initialContext);
  const [availableMedia, setAvailableMedia] = useState<MediaItemSummary[]>([]);
  const [availableModules, setAvailableModules] = useState<Record<string, ModuleRenderStatus>>({});
  const [isStarter, setIsStarter] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    async function loadWorkspace() {
      try {
        setIsLoading(true);
        const res = await loadOwnerWebsiteWorkspaceAction(businessId);
        if (!isMounted) return;
        if (res.success && res.data) {
          setSite(res.data.site);
          setVersion(res.data.version);
          setConfiguration(res.data.configuration);
          setAvailableMedia(res.data.availableMedia || []);
          setAvailableModules(res.data.availableModules || {});
          setContext({
            business: res.data.business,
            catalogueItems: res.data.catalogueItems,
            mediaUrls: res.data.mediaUrls || {},
            modules: res.data.availableModules || {},
            previewMode: true,
          });
          setIsStarter(res.data.isStarterDraft);
          setAuthError(null);
        } else if (!res.success && res.error) {
          // If unauthorized or cross-tenant error
          if (
            res.code === "UNAUTHENTICATED" ||
            res.code === "FORBIDDEN" ||
            res.code === "TENANT_MISMATCH"
          ) {
            setAuthError(res.error);
          }
        }
      } catch {
        // Fallback gracefully in testing environments
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadWorkspace();
    return () => {
      isMounted = false;
    };
  }, [businessId]);

  if (authError) {
    return (
      <div
        role="alert"
        className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 max-w-xl mx-auto my-8"
      >
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="danger">Access Denied</Badge>
          <span className="font-bold text-sm">Tenant Authorization Failed</span>
        </div>
        <p className="text-xs text-rose-800 leading-relaxed mb-3">{authError}</p>
        <p className="text-[11px] text-rose-600">
          You do not have permission to view or edit website configurations for this business.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {isStarter && (
        <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl px-3.5 py-2 text-xs text-amber-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="warning">Starter Draft</Badge>
            <span>
              This is a generated starter website configuration. Save your draft to persist changes
              to your business.
            </span>
          </div>
          {isLoading && (
            <span className="text-[11px] text-amber-600 animate-pulse">Syncing...</span>
          )}
        </div>
      )}
      <ConstrainedWebsiteEditor
        initialSite={site}
        initialVersion={version}
        initialConfiguration={configuration}
        context={context}
        availableMedia={availableMedia}
        availableModules={availableModules}
      />
    </div>
  );
}
