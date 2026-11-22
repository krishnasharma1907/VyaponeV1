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
  className = "",
}: EditorTopBarProps) {
  return (
    <header
      role="toolbar"
      aria-label="Website Editor Controls"
      className={`bg-white border-b border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 ${className}`.trim()}
    >
      {/* Site Identity & Version Info */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-slate-900">{siteSubdomain}.vyapone.in</span>
          <Badge variant="default" className="text-[10px] font-mono py-0 px-1.5">
            {versionNumber ? `Draft v${versionNumber}` : "Draft (Initial)"}
          </Badge>
        </div>

        {/* Save Status Badge */}
        {saveStatus === "saving" && (
          <Badge variant="warning" className="text-[10px] py-0 px-1.5 animate-pulse">
            Saving Draft...
          </Badge>
        )}
        {saveStatus === "saved" && (
          <Badge variant="success" className="text-[10px] py-0 px-1.5">
            ✓ Draft Saved
          </Badge>
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
          value={changeSummary}
          onChange={(e) => onChangeSummary(e.target.value)}
          maxLength={200}
          placeholder="Brief note on changes (e.g. Added winter menu)..."
          className="w-full px-2.5 py-1 text-xs border border-slate-200 rounded-md focus:outline-hidden focus:ring-2 focus:ring-emerald-700 placeholder:text-slate-400"
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
          disabled={isSaving || !hasUnsavedChanges}
          aria-label="Save website draft"
          className="font-medium"
        >
          {isSaving ? "Saving..." : "Save Draft"}
        </Button>
      </div>

      {/* Conflict / Error Banner */}
      {saveError && (
        <div
          role="alert"
          className="w-full text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-1.5 flex items-center justify-between"
        >
          <span>{saveError}</span>
        </div>
      )}
    </header>
  );
}
