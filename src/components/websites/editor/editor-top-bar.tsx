"use client";

/**
 * VyapOne — Constrained Visual Editor: Top Bar [VO-044]
 *
 * Header controls for the website visual editor:
 * - Version indication (Draft v{versionNumber})
 * - Concurrency & save status feedback
 * - Change summary entry
 * - Safe atomic save draft action dispatch
 * - View mode switching (Split, Edit, Preview)
 */

import React from "react";
import { Badge, Button } from "@/components/ui";
import type { EditorTopBarProps } from "./types";

export function EditorTopBar({
  siteSubdomain,
  versionNumber,
  saveStatus,
  saveError,
  changeSummary,
  onChangeSummary,
  onSave,
  isSaving,
  hasUnsavedChanges,
  viewMode,
  onChangeViewMode,
  deviceMode = "desktop",
  onChangeDeviceMode,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  lastSavedAt,
  onRetrySave,
  isAutosaving = false,
  onOpenHistory,
  isInspectingHistory = false,
  inspectedVersionNumber = null,
  onExitInspection,
  className = "",
}: EditorTopBarProps) {
  const formattedSavedTime = lastSavedAt
    ? lastSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : null;

  return (
    <header
      role="toolbar"
      aria-label="Website Editor Controls"
      className={`bg-white border-b border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 ${className}`.trim()}
    >
      {/* Site Identity, Version Info & Save Status */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-slate-900">{siteSubdomain}.vyapone.in</span>
          {isInspectingHistory ? (
            <Badge variant="warning" className="text-[10px] font-mono py-0 px-1.5 font-bold">
              Viewing v{inspectedVersionNumber} (Read-Only)
            </Badge>
          ) : (
            <Badge variant="default" className="text-[10px] font-mono py-0 px-1.5">
              {versionNumber ? `Draft v${versionNumber}` : "Draft (Initial)"}
            </Badge>
          )}
        </div>

        {/* History Modal Trigger Button */}
        {onOpenHistory && (
          <button
            type="button"
            onClick={onOpenHistory}
            aria-label="Open version history"
            title="Version History & Rollback"
            className="px-2 py-0.5 rounded-md text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors flex items-center gap-1 min-h-[26px] cursor-pointer"
          >
            <svg
              className="w-3.5 h-3.5 text-slate-600"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span>History</span>
          </button>
        )}

        {/* Exit Inspection Button */}
        {isInspectingHistory && onExitInspection && (
          <button
            type="button"
            onClick={onExitInspection}
            aria-label="Exit historical inspection preview"
            className="px-2 py-0.5 rounded-md text-[11px] font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 transition-colors flex items-center gap-1 min-h-[26px] cursor-pointer"
          >
            <span>✕ Exit Preview</span>
          </button>
        )}

        {/* History Controls: Undo / Redo (Only when not in read-only inspection) */}
        {!isInspectingHistory && (onUndo || onRedo) && (
          <div
            role="group"
            aria-label="Edit History"
            className="flex items-center rounded-md border border-slate-200 p-0.5 bg-slate-50 text-[11px]"
          >
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              aria-label="Undo change (Ctrl+Z)"
              title="Undo change (Ctrl+Z)"
              className={`p-1 rounded-xs transition-colors min-h-[28px] min-w-[28px] flex items-center justify-center ${
                canUndo
                  ? "text-slate-700 hover:text-slate-900 hover:bg-white cursor-pointer"
                  : "text-slate-300 cursor-not-allowed"
              }`}
            >
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 7v6h6" />
                <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
              </svg>
            </button>
            <button
              type="button"
              onClick={onRedo}
              disabled={!canRedo}
              aria-label="Redo change (Ctrl+Y)"
              title="Redo change (Ctrl+Y)"
              className={`p-1 rounded-xs transition-colors min-h-[28px] min-w-[28px] flex items-center justify-center ${
                canRedo
                  ? "text-slate-700 hover:text-slate-900 hover:bg-white cursor-pointer"
                  : "text-slate-300 cursor-not-allowed"
              }`}
            >
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 7v6h-6" />
                <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" />
              </svg>
            </button>
          </div>
        )}

        {/* Save Status Badge */}
        {saveStatus === "saving" && (
          <Badge variant="warning" className="text-[10px] py-0 px-1.5 animate-pulse">
            {isAutosaving ? "Autosaving Draft..." : "Saving Draft..."}
          </Badge>
        )}
        {saveStatus === "saved" && (
          <div className="flex items-center gap-1.5">
            <Badge variant="success" className="text-[10px] py-0 px-1.5">
              ✓ Draft Saved
            </Badge>
            {formattedSavedTime && (
              <span className="text-[10px] text-slate-500 hidden sm:inline">
                {formattedSavedTime}
              </span>
            )}
          </div>
        )}
        {saveStatus === "unsaved" && (
          <Badge variant="accent" className="text-[10px] py-0 px-1.5">
            ● Unsaved Changes
          </Badge>
        )}
        {saveStatus === "conflict" && (
          <Badge variant="danger" className="text-[10px] py-0 px-1.5">
            ⚠ Version Conflict
          </Badge>
        )}
        {saveStatus === "error" && (
          <Badge variant="danger" className="text-[10px] py-0 px-1.5">
            ✕ Save Failed
          </Badge>
        )}
      </div>

      {/* Center: Change Summary Input & Save Error Note */}
      <div className="flex items-center gap-2 flex-1 max-w-md min-w-[200px]">
        <input
          type="text"
          value={isInspectingHistory ? "Inspecting historical snapshot (Read-Only)" : changeSummary}
          onChange={(e) => onChangeSummary(e.target.value)}
          maxLength={200}
          disabled={isInspectingHistory}
          placeholder="Brief note on changes (e.g. Added winter menu)..."
          className={`w-full px-2.5 py-1 text-xs border border-slate-200 rounded-md focus:outline-hidden focus:ring-2 focus:ring-emerald-700 placeholder:text-slate-400 ${
            isInspectingHistory ? "bg-slate-50 text-slate-500 italic cursor-not-allowed" : ""
          }`}
          aria-label="Draft change summary note"
        />
      </div>

      {/* Right: Device Mode Selector, View Mode Toggle & Save Button */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Device Mode Selector (Desktop, Tablet, Mobile) */}
        {onChangeDeviceMode && (
          <div
            role="radiogroup"
            aria-label="Preview Device Mode"
            className="flex items-center rounded-md border border-slate-200 p-0.5 bg-slate-50 text-[11px]"
          >
            <button
              type="button"
              role="radio"
              aria-checked={deviceMode === "desktop"}
              aria-label="Desktop Preview Mode"
              title="Desktop Viewport (Responsive)"
              onClick={() => onChangeDeviceMode("desktop")}
              className={`px-2 py-0.5 rounded-xs font-medium flex items-center gap-1 transition-colors min-h-[32px] sm:min-h-[26px] ${
                deviceMode === "desktop"
                  ? "bg-white text-emerald-800 shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect width="20" height="14" x="2" y="3" rx="2" />
                <line x1="8" x2="16" y1="21" y2="21" />
                <line x1="12" x2="12" y1="17" y2="21" />
              </svg>
              <span className="hidden sm:inline">Desktop</span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={deviceMode === "tablet"}
              aria-label="Tablet Preview Mode (768px)"
              title="Tablet Viewport (768px)"
              onClick={() => onChangeDeviceMode("tablet")}
              className={`px-2 py-0.5 rounded-xs font-medium flex items-center gap-1 transition-colors min-h-[32px] sm:min-h-[26px] ${
                deviceMode === "tablet"
                  ? "bg-white text-emerald-800 shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect width="16" height="20" x="4" y="2" rx="2" />
                <line x1="12" x2="12.01" y1="18" y2="18" />
              </svg>
              <span className="hidden sm:inline">Tablet</span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={deviceMode === "mobile"}
              aria-label="Mobile Preview Mode (390px)"
              title="Mobile Viewport (390px)"
              onClick={() => onChangeDeviceMode("mobile")}
              className={`px-2 py-0.5 rounded-xs font-medium flex items-center gap-1 transition-colors min-h-[32px] sm:min-h-[26px] ${
                deviceMode === "mobile"
                  ? "bg-white text-emerald-800 shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect width="14" height="20" x="5" y="2" rx="2" />
                <line x1="12" x2="12.01" y1="18" y2="18" />
              </svg>
              <span className="hidden sm:inline">Mobile (390px)</span>
            </button>
          </div>
        )}

        {/* View mode toggle (Responsive / Mobile-friendly) */}
        <div className="flex rounded-md border border-slate-200 p-0.5 bg-slate-50 text-[11px]">
          <button
            type="button"
            onClick={() => onChangeViewMode("edit")}
            className={`px-2 py-0.5 rounded-xs font-medium transition-colors ${
              viewMode === "edit"
                ? "bg-white text-emerald-800 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Sections
          </button>
          <button
            type="button"
            onClick={() => onChangeViewMode("split")}
            className={`hidden md:block px-2 py-0.5 rounded-xs font-medium transition-colors ${
              viewMode === "split"
                ? "bg-white text-emerald-800 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Split
          </button>
          <button
            type="button"
            onClick={() => onChangeViewMode("preview")}
            className={`px-2 py-0.5 rounded-xs font-medium transition-colors ${
              viewMode === "preview"
                ? "bg-white text-emerald-800 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Live Preview
          </button>
        </div>

        {/* Save Draft Action Button */}
        <Button
          variant="primary"
          size="sm"
          onClick={onSave}
          disabled={isSaving || !hasUnsavedChanges || isInspectingHistory}
          aria-label="Save website draft"
          className="font-medium"
        >
          {isInspectingHistory ? "Read-Only" : isSaving ? "Saving..." : "Save Draft"}
        </Button>
      </div>

      {/* Conflict / Error Banner */}
      {saveError && (
        <div
          role="alert"
          className="w-full text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-1.5 flex items-center justify-between gap-2"
        >
          <span>{saveError}</span>
          {saveStatus === "error" && onRetrySave && (
            <button
              type="button"
              onClick={onRetrySave}
              className="text-xs font-semibold text-rose-800 hover:text-rose-900 underline shrink-0 cursor-pointer"
            >
              Retry Save
            </button>
          )}
        </div>
      )}
    </header>
  );
}
