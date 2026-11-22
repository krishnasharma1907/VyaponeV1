"use client";

/**
 * VyapOne — Pre-publish Review & Publishing Modal [VO-049]
 *
 * Pre-publish validation checklist modal:
 * - Checks business facts, metadata, navigation, media, approved blocks, modules, and plan capacity.
 * - Categorizes findings into blocking Errors and non-blocking Warnings.
 * - Enforces atomic publishing RPC with optimistic concurrency protection.
 * - Displays success state with live storefront URLs and permanent dynamic QR code.
 */

import React, { useEffect, useState } from "react";
import { Badge, Button } from "@/components/ui";
import type {
  PrePublishCheckCategory,
  PrePublishCheckItem,
  PrePublishValidationResult,
  PublishSiteResult,
  SiteRow,
} from "@/lib/websites/types";
import { publishSiteDraftAction, validateSitePrePublishAction } from "@/lib/websites/actions";

export interface PublishModalProps {
  isOpen: boolean;
  onClose: () => void;
  site: SiteRow;
  draftVersionNumber: number;
  onPublishSuccess?: (result: PublishSiteResult) => void;
}

const CATEGORY_LABELS: Record<PrePublishCheckCategory, string> = {
  business_facts: "Business Details",
  site_metadata: "Storefront Metadata & SEO",
  navigation: "Navigation & Links",
  media: "Media Assets",
  blocks: "Approved Blocks",
  modules: "Business Modules",
  plan_capacity: "Plan Capacity",
};

export function PublishModal({
  isOpen,
  onClose,
  site,
  draftVersionNumber,
  onPublishSuccess,
}: PublishModalProps) {
  const [isValidating, setIsValidating] = useState<boolean>(true);
  const [validationResult, setValidationResult] = useState<PrePublishValidationResult | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishedData, setPublishedData] = useState<PublishSiteResult | null>(null);
  const [qrSvg, setQrSvg] = useState<string | null>(null);

  // Run validation on modal open
  useEffect(() => {
    if (!isOpen) {
      setPublishedData(null);
      setPublishError(null);
      setQrSvg(null);
      return;
    }

    let isMounted = true;
    setIsValidating(true);
    setValidationError(null);

    validateSitePrePublishAction({ siteId: site.id })
      .then((res) => {
        if (!isMounted) return;
        if (res.success) {
          setValidationResult(res.data);
        } else {
          setValidationError(res.error || "Failed to validate pre-publish checklist");
        }
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        setValidationError(err instanceof Error ? err.message : "Validation failed");
      })
      .finally(() => {
        if (isMounted) setIsValidating(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, site.id]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isPublishing) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isPublishing, onClose]);

  const handlePublish = async () => {
    if (isPublishing) return;
    setIsPublishing(true);
    setPublishError(null);

    try {
      const res = await publishSiteDraftAction({
        siteId: site.id,
        expectedDraftVersionNumber: draftVersionNumber,
      });

      if (!res.success) {
        setPublishError(res.error || "Failed to publish site");
        setIsPublishing(false);
        return;
      }

      setPublishedData(res.data);
      if (res.data.qrSvg) {
        setQrSvg(res.data.qrSvg);
      }
      if (onPublishSuccess) {
        onPublishSuccess(res.data);
      }
    } catch (err: unknown) {
      setPublishError(err instanceof Error ? err.message : "Publishing error occurred");
    } finally {
      setIsPublishing(false);
    }
  };

  if (!isOpen) return null;

  const errors = (validationResult?.checks || []).filter((c) => c.severity === "error");
  const warnings = (validationResult?.checks || []).filter((c) => c.severity === "warning");
  const canPublish = !isValidating && errors.length === 0;

  // Group checks by category
  const checksByCategory = (validationResult?.checks || []).reduce<
    Record<PrePublishCheckCategory, PrePublishCheckItem[]>
  >(
    (acc, check) => {
      if (!acc[check.category]) acc[check.category] = [];
      acc[check.category].push(check);
      return acc;
    },
    {} as Record<PrePublishCheckCategory, PrePublishCheckItem[]>,
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="publish-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
    >
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h2 id="publish-modal-title" className="text-lg font-bold text-slate-900">
              {publishedData ? "Storefront Published!" : "Publish Storefront"}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {publishedData
                ? "Your website is live and ready for customers."
                : `Pre-publish validation checklist for draft v${draftVersionNumber}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPublishing}
            aria-label="Close publish dialog"
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/50 transition-colors cursor-pointer"
          >
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {publishedData ? (
            /* Success View */
            <div className="space-y-6">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-emerald-900">Storefront is now live</h3>
                  <p className="text-xs text-emerald-700 mt-1">
                    Version {publishedData.publishedVersion.version_number} has been published
                    successfully.
                  </p>
                </div>
              </div>

              {/* URLs & QR Code */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Live Web Addresses
                  </h4>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-2">
                    <div>
                      <span className="text-[11px] text-slate-500 font-medium">
                        Platform Domain
                      </span>
                      <a
                        href={publishedData.platformUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-xs font-semibold text-indigo-600 hover:underline break-all mt-0.5"
                      >
                        {publishedData.platformUrl}
                      </a>
                    </div>
                    {publishedData.customDomainUrl && (
                      <div className="pt-2 border-t border-slate-200">
                        <span className="text-[11px] text-slate-500 font-medium">
                          Custom Domain
                        </span>
                        <a
                          href={publishedData.customDomainUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-xs font-semibold text-emerald-600 hover:underline break-all mt-0.5"
                        >
                          {publishedData.customDomainUrl}
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Permanent QR Code */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Permanent QR Code
                  </h4>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-md flex flex-col items-center text-center">
                    {qrSvg ? (
                      <div
                        className="w-36 h-36 bg-white p-2 border border-slate-200 rounded-md shadow-xs flex items-center justify-center"
                        dangerouslySetInnerHTML={{ __html: qrSvg }}
                      />
                    ) : (
                      <div className="w-36 h-36 bg-slate-100 border border-slate-200 rounded-md flex items-center justify-center text-xs text-slate-400">
                        QR Standee Ready
                      </div>
                    )}
                    <span className="text-[11px] text-slate-600 mt-2 font-medium">
                      High-contrast scan-safe QR with 4-module quiet zone
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : isValidating ? (
            /* Loading State */
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-500">
              <svg
                className="w-7 h-7 animate-spin text-emerald-600"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <p className="text-xs font-medium">Running pre-publish validation checks...</p>
            </div>
          ) : validationError ? (
            /* Error Loading Validation */
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs">
              <p className="font-semibold">Pre-publish validation failed to run:</p>
              <p className="mt-1">{validationError}</p>
            </div>
          ) : (
            /* Checklist Overview */
            <div className="space-y-4">
              {/* Summary Banner */}
              <div
                className={`p-3.5 rounded-lg border text-xs flex items-center justify-between gap-3 ${
                  errors.length > 0
                    ? "bg-rose-50 border-rose-200 text-rose-900"
                    : warnings.length > 0
                      ? "bg-amber-50 border-amber-200 text-amber-900"
                      : "bg-emerald-50 border-emerald-200 text-emerald-900"
                }`}
              >
                <div>
                  <span className="font-bold">
                    {errors.length > 0
                      ? `${errors.length} blocking ${errors.length === 1 ? "error" : "errors"} must be resolved.`
                      : warnings.length > 0
                        ? `Ready to publish with ${warnings.length} non-blocking ${warnings.length === 1 ? "warning" : "warnings"}.`
                        : "All checks passed! Storefront is completely ready to publish."}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {errors.length > 0 && (
                    <Badge variant="danger" className="text-[10px]">
                      {errors.length} Errors
                    </Badge>
                  )}
                  {warnings.length > 0 && (
                    <Badge variant="warning" className="text-[10px]">
                      {warnings.length} Warnings
                    </Badge>
                  )}
                  {errors.length === 0 && warnings.length === 0 && (
                    <Badge variant="success" className="text-[10px]">
                      100% Passed
                    </Badge>
                  )}
                </div>
              </div>

              {/* Plan Capacity Status */}
              {validationResult?.planCapacity && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-md text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-700">Workspace Live Websites:</span>
                    <span className="text-slate-600 font-mono">
                      {validationResult.planCapacity.currentPublishedSites} /{" "}
                      {validationResult.planCapacity.maxPublishedSites} used
                    </span>
                  </div>
                  {validationResult.planCapacity.allowed ? (
                    <Badge variant="success" className="text-[10px]">
                      Slot Available
                    </Badge>
                  ) : (
                    <Badge variant="danger" className="text-[10px]">
                      Limit Reached
                    </Badge>
                  )}
                </div>
              )}

              {/* Publish Error Banner */}
              {publishError && (
                <div className="p-3 bg-rose-100 border border-rose-300 text-rose-800 rounded-md text-xs">
                  <span className="font-bold">Publishing failed:</span> {publishError}
                </div>
              )}

              {/* Checks by Category */}
              <div className="space-y-3">
                {(
                  Object.entries(checksByCategory) as [
                    PrePublishCheckCategory,
                    PrePublishCheckItem[],
                  ][]
                ).map(([category, items]) => (
                  <div
                    key={category}
                    className="border border-slate-200 rounded-lg overflow-hidden"
                  >
                    <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">
                        {CATEGORY_LABELS[category] || category}
                      </span>
                      <span className="text-[11px] text-slate-400 font-medium">
                        {items.length} {items.length === 1 ? "check" : "checks"}
                      </span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {items.map((check) => (
                        <div
                          key={check.id}
                          className="p-3 flex items-start justify-between gap-3 text-xs"
                        >
                          <div className="flex items-start gap-2.5">
                            {check.severity === "error" ? (
                              <svg
                                className="w-4 h-4 text-rose-600 shrink-0 mt-0.5"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            ) : (
                              <svg
                                className="w-4 h-4 text-amber-500 shrink-0 mt-0.5"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            )}
                            <div>
                              <span
                                className={`font-semibold ${
                                  check.severity === "error" ? "text-rose-900" : "text-amber-900"
                                }`}
                              >
                                {check.title}
                              </span>
                              <p className="text-slate-600 mt-0.5">{check.message}</p>
                            </div>
                          </div>
                          {check.navigationPath && (
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                // Navigate or focus section if within editor
                              }}
                              className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 underline shrink-0 cursor-pointer"
                            >
                              Fix
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isPublishing}>
            {publishedData ? "Close" : "Cancel"}
          </Button>

          {!publishedData && (
            <Button
              variant="primary"
              size="sm"
              onClick={handlePublish}
              disabled={!canPublish || isPublishing}
              className="bg-emerald-600 hover:bg-emerald-700 font-semibold"
            >
              {isPublishing
                ? "Publishing..."
                : warnings.length > 0
                  ? `Publish Anyway (${warnings.length} warnings)`
                  : "Publish Storefront"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
