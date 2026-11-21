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
            Draft v{versionNumber}
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

      {/* Right: View Mode Toggle & Save Button */}
      <div className="flex items-center gap-2">
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
