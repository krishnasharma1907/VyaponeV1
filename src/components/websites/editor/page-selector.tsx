"use client";

/**
 * VyapOne — Constrained Visual Editor: Page Selector [VO-044]
 *
 * Allows switching between website pages and adding new pages with validated slugs.
 */

import React, { useState } from "react";
import { normalizePageSlug } from "@/lib/websites/seo";
import type { PageSelectorProps } from "./types";

export function PageSelector({
  pages,
  selectedSlug,
  onSelectSlug,
  onAddPage,
  className = "",
}: PageSelectorProps) {
  const [isAddingPage, setIsAddingPage] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState("");
  const [newPageSlug, setNewPageSlug] = useState("");
  const [slugError, setSlugError] = useState<string | null>(null);

  const handleCreatePage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPageTitle.trim()) return;

    let cleanSlug = newPageSlug.trim();
    if (!cleanSlug) {
      cleanSlug =
        "/" +
        newPageTitle
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
    }
    if (!cleanSlug.startsWith("/")) {
      cleanSlug = "/" + cleanSlug;
    }

    try {
      const normalized = normalizePageSlug(cleanSlug);
      if (pages.some((p) => normalizePageSlug(p.slug) === normalized)) {
        setSlugError(`A page with path "${normalized}" already exists.`);
        return;
      }
      onAddPage(newPageTitle.trim(), normalized);
      setNewPageTitle("");
      setNewPageSlug("");
      setSlugError(null);
      setIsAddingPage(false);
    } catch {
      setSlugError("Invalid URL path format (e.g. /about or /menu)");
    }
  };

  return (
    <div
      className={`bg-slate-100/70 border-b border-slate-200 px-4 py-2 flex items-center justify-between gap-2 overflow-x-auto ${className}`.trim()}
    >
      {/* Pages Tabs */}
      <div
        className="flex items-center gap-1.5 flex-1 min-w-0"
        role="tablist"
        aria-label="Website Pages"
      >
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1 shrink-0">
          Page:
        </span>
        {pages.map((page) => {
          const isSelected = normalizePageSlug(page.slug) === normalizePageSlug(selectedSlug);
          return (
            <button
              type="button"
              role="tab"
              key={page.id}
              aria-selected={isSelected}
              onClick={() => onSelectSlug(page.slug)}
              className={`px-3 py-1 text-xs rounded-lg font-medium transition-all shrink-0 flex items-center gap-1.5 ${
                isSelected
                  ? "bg-white text-emerald-900 shadow-xs border border-slate-200"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              <span>{page.title}</span>
              <code className="text-[10px] text-slate-400 font-normal">
                {page.slug === "/" ? "home" : page.slug}
              </code>
            </button>
          );
        })}

        {/* Add Page Button */}
        {!isAddingPage ? (
          <button
            type="button"
            onClick={() => setIsAddingPage(true)}
            className="px-2 py-1 text-xs text-emerald-800 hover:text-emerald-950 font-medium hover:bg-emerald-50 rounded-md transition-colors shrink-0"
          >
            + New Page
          </button>
        ) : (
          <form
            onSubmit={handleCreatePage}
            className="flex items-center gap-1.5 shrink-0 bg-white p-1 rounded-lg border border-emerald-300 shadow-xs"
          >
            <input
              type="text"
              required
              placeholder="Page Name (e.g. Menu)"
              value={newPageTitle}
              onChange={(e) => {
                setNewPageTitle(e.target.value);
                setSlugError(null);
              }}
              className="px-2 py-0.5 text-xs border border-slate-200 rounded-sm w-28 focus:outline-hidden focus:ring-1 focus:ring-emerald-700"
            />
            <input
              type="text"
              placeholder="/slug (optional)"
              value={newPageSlug}
              onChange={(e) => {
                setNewPageSlug(e.target.value);
                setSlugError(null);
              }}
              className="px-2 py-0.5 text-xs border border-slate-200 rounded-sm w-24 focus:outline-hidden focus:ring-1 focus:ring-emerald-700"
            />
            <button
              type="submit"
              className="px-2 py-0.5 text-xs font-semibold bg-emerald-800 text-white rounded-sm hover:bg-emerald-900"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => {
                setIsAddingPage(false);
                setSlugError(null);
              }}
              className="px-1 text-slate-400 hover:text-slate-700 text-xs"
            >
              ×
            </button>
          </form>
        )}
      </div>

      {slugError && (
        <span className="text-[11px] text-rose-600 bg-rose-50 px-2 py-0.5 rounded-sm shrink-0">
          {slugError}
        </span>
      )}
    </div>
  );
}
