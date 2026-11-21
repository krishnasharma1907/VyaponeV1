"use client";

/**
 * VyapOne — Constrained Visual Editor: Section Navigator [VO-044]
 *
 * Provides page section list, reordering, visibility toggling, removal,
 * and selection for property inspection.
 */

import React from "react";
import {
  APPROVED_BLOCK_REGISTRY,
  isApprovedBlockType,
} from "@/components/websites/blocks/block-registry";
import { Badge, Button } from "@/components/ui";
import type { SectionNavigatorProps } from "./types";

export function SectionNavigator({
  sections,
  selectedSectionId,
  onSelectSection,
  onMoveUp,
  onMoveDown,
  onToggleEnabled,
  onRemoveSection,
  onOpenAddModal,
  className = "",
}: SectionNavigatorProps) {
  return (
    <div className={`flex flex-col h-full bg-white border-r border-slate-200 ${className}`.trim()}>
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Page Sections</h2>
          <p className="text-[11px] text-slate-500">
            {sections.length} section{sections.length === 1 ? "" : "s"} on this page
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={onOpenAddModal}>
          + Add Section
        </Button>
      </div>

      {/* Section List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {sections.length === 0 ? (
          <div className="text-center py-10 px-4 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
            <p className="text-xs font-semibold text-slate-700">No sections added yet</p>
            <p className="text-[11px] text-slate-500 mt-1 mb-3">
              Start building your page by adding an approved block like Hero Banner or Menu.
            </p>
            <Button variant="secondary" size="sm" onClick={onOpenAddModal}>
              + Add Section
            </Button>
          </div>
        ) : (
          sections.map((section, index) => {
            const isApproved = isApprovedBlockType(section.type);
            const metadata = isApproved ? APPROVED_BLOCK_REGISTRY[section.type].metadata : null;
            const isSelected = selectedSectionId === section.id;
            const isEnabled = section.isEnabled !== false;
            const isFirst = index === 0;
            const isLast = index === sections.length - 1;

            return (
              <div
                key={section.id}
                className={`p-3 rounded-xl border transition-all ${
                  isSelected
                    ? "border-emerald-700 bg-emerald-50/30 ring-1 ring-emerald-700"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                } ${!isEnabled ? "opacity-60 bg-slate-50" : ""}`}
              >
                {/* Main Card Header */}
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectSection(section.id)}
                    className="flex-1 text-left focus:outline-hidden"
                  >
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-sm">
                        #{index + 1}
                      </span>
                      <span className="text-xs font-bold text-slate-900 hover:text-emerald-800">
                        {metadata?.name || section.type}
                      </span>
                      {metadata?.category && (
                        <Badge variant="default" className="text-[10px] py-0 px-1">
                          {metadata.category}
                        </Badge>
                      )}
                      {!isEnabled && (
                        <Badge variant="default" className="text-[10px] py-0 px-1">
                          Hidden
                        </Badge>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                      <span>
                        Variant:{" "}
                        <code className="text-[10px] bg-slate-100 px-1 rounded-sm">
                          {section.variant || "default"}
                        </code>
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="text-emerald-700 font-medium hover:underline">
                        {isSelected ? "Editing Properties" : "Click to Edit"}
                      </span>
                    </div>
                  </button>

                  {/* Quick Action Controls */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onToggleEnabled(section.id)}
                      aria-label={
                        isEnabled
                          ? `Hide ${metadata?.name || section.type}`
                          : `Show ${metadata?.name || section.type}`
                      }
                      title={
                        isEnabled ? "Hide section from storefront" : "Show section on storefront"
                      }
                      className={`p-1 text-xs rounded-md border transition-colors ${
                        isEnabled
                          ? "border-slate-200 text-slate-600 hover:bg-slate-100"
                          : "border-amber-300 bg-amber-50 text-amber-800 font-medium"
                      }`}
                    >
                      {isEnabled ? "Hide" : "Show"}
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveSection(section.id)}
                      aria-label={`Remove ${metadata?.name || section.type}`}
                      title="Remove section from page"
                      className="p-1 text-xs text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-md border border-transparent hover:border-rose-200 transition-colors"
                    >
                      ×
                    </button>
                  </div>
                </div>

                {/* Reorder Buttons */}
                <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={isFirst}
                      onClick={() => onMoveUp(index)}
                      aria-label={`Move ${metadata?.name || section.type} up`}
                      className="px-2 py-0.5 text-[10px] font-medium rounded-sm border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700"
                    >
                      ▲ Move Up
                    </button>
                    <button
                      type="button"
                      disabled={isLast}
                      onClick={() => onMoveDown(index)}
                      aria-label={`Move ${metadata?.name || section.type} down`}
                      className="px-2 py-0.5 text-[10px] font-medium rounded-sm border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700"
                    >
                      ▼ Move Down
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectSection(section.id)}
                    className="text-xs font-semibold text-emerald-800 hover:underline"
                  >
                    {isSelected ? "Inspector Active" : "Configure →"}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
