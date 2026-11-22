"use client";

/**
 * VyapOne — Constrained Visual Editor: Version History & Rollback Modal [VO-048]
 *
 * Implements the version history and rollback dialog for merchants:
 * - Lists historical website configuration versions in descending order.
 * - Distinguishes between Active Draft, Live Published, Previously Published, and Draft Snapshots.
 * - Allows read-only historical inspection in the preview canvas.
 * - Allows restoring a historical configuration into a new working draft (MAX + 1).
 * - Allows rolling back the live published pointer to a previously published version with concurrency checks.
 * - Preserves immutability of all past versions (never deletes or overwrites site_versions).
 */

import React, { useEffect, useState, useCallback } from "react";
import { Badge, Button } from "@/components/ui";
import { getSiteVersionsAction } from "@/lib/websites/actions";
import type { SiteVersionSummary } from "@/lib/websites/types";

export interface VersionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  siteId: string;
  siteSubdomain?: string;
  currentDraftVersionId?: string | null;
  currentPublishedVersionId?: string | null;
  currentVersionNumber?: number | null;
  initialVersions?: SiteVersionSummary[];
  onInspectVersion: (version: SiteVersionSummary) => void;
  onRestoreToDraft: (version: SiteVersionSummary) => Promise<void>;
  onRollbackLiveSite: (version: SiteVersionSummary) => Promise<void>;
  isRestoring?: boolean;
  isRollingBack?: boolean;
}

type ConfirmActionType = "restore" | "rollback" | null;

export function VersionHistoryModal({
  isOpen,
  onClose,
  siteId,
  siteSubdomain = "",
  currentDraftVersionId,
  currentPublishedVersionId,
  currentVersionNumber,
  initialVersions,
  onInspectVersion,
  onRestoreToDraft,
  onRollbackLiveSite,
  isRestoring = false,
  isRollingBack = false,
}: VersionHistoryModalProps) {
  const [versions, setVersions] = useState<SiteVersionSummary[]>(initialVersions || []);
  const [isLoading, setIsLoading] = useState<boolean>(
    !initialVersions || initialVersions.length === 0,
  );
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Confirmation state
  const [confirmTarget, setConfirmTarget] = useState<SiteVersionSummary | null>(null);
  const [confirmType, setConfirmType] = useState<ConfirmActionType>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchVersions = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const res = await getSiteVersionsAction(siteId);
      if (res.success) {
        setVersions(res.data.summaries);
      } else {
        setFetchError(res.error || "Failed to load version history");
      }
    } catch {
      setFetchError("Unable to load version history. Please check your network connection.");
    } finally {
      setIsLoading(false);
    }
  }, [siteId]);

  useEffect(() => {
    if (!isOpen) {
      setConfirmTarget(null);
      setConfirmType(null);
      setActionError(null);
      return;
    }

    if (initialVersions && initialVersions.length > 0) {
      setVersions(initialVersions);
      setIsLoading(false);
    } else {
      fetchVersions();
    }
  }, [isOpen, initialVersions, fetchVersions]);

  // Keyboard navigation: Escape key closes modal or cancel confirmation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (confirmTarget) {
          setConfirmTarget(null);
          setConfirmType(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, confirmTarget, onClose]);

  if (!isOpen) return null;

  const handleConfirmAction = async () => {
    if (!confirmTarget || !confirmType) return;
    setActionError(null);
    try {
      if (confirmType === "restore") {
        await onRestoreToDraft(confirmTarget);
        setConfirmTarget(null);
        setConfirmType(null);
        onClose();
      } else if (confirmType === "rollback") {
        await onRollbackLiveSite(confirmTarget);
        setConfirmTarget(null);
        setConfirmType(null);
        onClose();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Action failed. Please try again.";
      setActionError(msg);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="version-history-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2">
              <h2 id="version-history-title" className="text-lg font-bold text-slate-900">
                Site Version History
              </h2>
              {siteSubdomain && (
                <span className="text-xs font-mono text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded-xs">
                  {siteSubdomain}.vyapone.in
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Review saved snapshots, inspect historical versions in read-only mode, restore to
              draft, or roll back the live website.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchVersions}
              disabled={isLoading}
              aria-label="Refresh version history"
              title="Refresh version history"
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors focus:outline-hidden focus:ring-2 focus:ring-emerald-700 disabled:opacity-50"
            >
              <svg
                className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                <path d="M16 21h5v-5" />
              </svg>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close version history modal"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus:outline-hidden focus:ring-2 focus:ring-emerald-700"
            >
              <span className="text-xl leading-none">×</span>
            </button>
          </div>
        </div>

        {/* Confirmation Banner if active */}
        {confirmTarget && confirmType && (
          <div
            role="alert"
            className={`p-4 border-b ${
              confirmType === "rollback"
                ? "bg-rose-50 border-rose-200 text-rose-950"
                : "bg-emerald-50 border-emerald-200 text-emerald-950"
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                  confirmType === "rollback"
                    ? "bg-rose-100 text-rose-700"
                    : "bg-emerald-100 text-emerald-700"
                }`}
              >
                {confirmType === "rollback" ? (
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M12 9v4m0 4h.01M3.6 15h16.8L12 3z" />
                  </svg>
                ) : (
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                  </svg>
                )}
              </div>
              <div className="flex-1 text-xs space-y-1">
                <div className="font-bold text-sm">
                  {confirmType === "rollback"
                    ? `Roll Back Live Website to Version ${confirmTarget.versionNumber}?`
                    : `Restore Version ${confirmTarget.versionNumber} to Working Draft?`}
                </div>
                <p>
                  {confirmType === "rollback"
                    ? `This will immediately point the live storefront at ${siteSubdomain || "your site"} to version ${confirmTarget.versionNumber}. Customers will see this version immediately. Your working draft remains untouched.`
                    : `This will copy version ${confirmTarget.versionNumber} into a new draft version. Historical snapshots are strictly immutable and will not be overwritten. The live website will not be changed.`}
                </p>
                {actionError && (
                  <div className="text-rose-700 font-semibold mt-1">Error: {actionError}</div>
                )}
                <div className="flex items-center gap-2 pt-2">
                  <Button
                    variant={confirmType === "rollback" ? "destructive" : "primary"}
                    size="sm"
                    onClick={handleConfirmAction}
                    disabled={isRestoring || isRollingBack}
                    aria-label={`Confirm ${confirmType}`}
                  >
                    {isRestoring || isRollingBack
                      ? "Processing..."
                      : confirmType === "rollback"
                        ? `Confirm Rollback to v${confirmTarget.versionNumber}`
                        : `Restore as Draft (v${(currentVersionNumber ?? 0) + 1})`}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setConfirmTarget(null);
                      setConfirmType(null);
                      setActionError(null);
                    }}
                    disabled={isRestoring || isRollingBack}
                    aria-label="Cancel confirmation"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-500">
              <svg
                className="w-6 h-6 animate-spin text-emerald-700"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
              <span className="text-xs">Loading site versions...</span>
            </div>
          ) : fetchError ? (
            <div
              role="alert"
              className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center justify-between gap-3"
            >
              <span>{fetchError}</span>
              <Button variant="secondary" size="sm" onClick={fetchVersions}>
                Retry
              </Button>
            </div>
          ) : versions.length === 0 ? (
            <div className="py-12 text-center text-slate-500 space-y-1">
              <p className="text-sm font-semibold text-slate-700">No versions recorded yet</p>
              <p className="text-xs">Save a draft to create your first website version snapshot.</p>
            </div>
          ) : (
            versions.map((ver) => {
              const isCurrentDraft = ver.id === currentDraftVersionId || ver.isCurrentDraft;
              const isLivePublished = ver.id === currentPublishedVersionId || ver.isPublished;
              const isPreviouslyPublished = ver.publishedAt !== null && !isLivePublished;
              const isDraftSnapshot = ver.publishedAt === null && !isCurrentDraft;

              return (
                <div
                  key={ver.id}
                  data-testid={`version-item-${ver.versionNumber}`}
                  className={`p-4 rounded-xl border transition-colors ${
                    isLivePublished
                      ? "border-emerald-300 bg-emerald-50/40"
                      : isCurrentDraft
                        ? "border-slate-300 bg-slate-50/60"
                        : "border-slate-200 bg-white hover:bg-slate-50/40"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-900 font-mono">
                          v{ver.versionNumber}
                        </span>

                        {isLivePublished && (
                          <Badge variant="success" className="text-[10px] py-0 px-2">
                            ● Live Published
                          </Badge>
                        )}
                        {isCurrentDraft && (
                          <Badge variant="default" className="text-[10px] py-0 px-2">
                            Active Draft
                          </Badge>
                        )}
                        {isPreviouslyPublished && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-100 text-purple-800 border border-purple-200">
                            Previously Published
                          </span>
                        )}
                        {isDraftSnapshot && (
                          <Badge
                            variant="default"
                            className="text-[10px] py-0 px-2 text-slate-600 bg-slate-100 border border-slate-200"
                          >
                            Draft Snapshot
                          </Badge>
                        )}
                      </div>

                      {/* Change summary note */}
                      <p className="text-xs text-slate-700 font-medium">
                        {ver.changeSummary || (
                          <span className="text-slate-400 italic">No change summary note</span>
                        )}
                      </p>

                      {/* Timestamps */}
                      <div className="flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
                        <span>Created {new Date(ver.createdAt).toLocaleString()}</span>
                        {ver.publishedAt && (
                          <span className="text-emerald-700 font-medium">
                            Published {new Date(ver.publishedAt).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions per version */}
                    <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0">
                      {/* Inspect in Preview Mode */}
                      <button
                        type="button"
                        onClick={() => {
                          onInspectVersion(ver);
                          onClose();
                        }}
                        aria-label={`Inspect version ${ver.versionNumber} in read-only preview`}
                        className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
                      >
                        Inspect
                      </button>

                      {/* Restore to working draft */}
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmTarget(ver);
                          setConfirmType("restore");
                          setActionError(null);
                        }}
                        aria-label={`Restore version ${ver.versionNumber} to draft`}
                        className="px-2.5 py-1 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md hover:bg-emerald-100 transition-colors cursor-pointer"
                      >
                        Restore to Draft
                      </button>

                      {/* Rollback Live Site (only for previously published versions) */}
                      {isPreviouslyPublished && (
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmTarget(ver);
                            setConfirmType("rollback");
                            setActionError(null);
                          }}
                          aria-label={`Roll back live site to version ${ver.versionNumber}`}
                          className="px-2.5 py-1 text-xs font-medium text-rose-800 bg-rose-50 border border-rose-200 rounded-md hover:bg-rose-100 transition-colors cursor-pointer"
                        >
                          Rollback Live
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <svg
              className="w-3.5 h-3.5 text-slate-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span>Immutable history: past versions cannot be modified or deleted.</span>
          </div>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
