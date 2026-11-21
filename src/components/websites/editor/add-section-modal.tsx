"use client";

/**
 * VyapOne — Constrained Visual Editor: Add Section Modal [VO-044]
 *
 * Constrained component selector that exclusively exposes the 13 canonical
 * approved blocks from `APPROVED_BLOCK_REGISTRY` (PRD FINAL v2 §15.3, §6.14).
 * Arbitrary or user-defined code blocks cannot be added.
 */

import React, { useEffect, useState } from "react";
import type { ApprovedBlockType, BlockMetadata } from "@/components/websites/blocks/types";
import {
  APPROVED_BLOCK_REGISTRY,
  getAllApprovedBlockTypes,
} from "@/components/websites/blocks/block-registry";
import { Badge, Button } from "@/components/ui";
import type { AddSectionModalProps } from "./types";

const CATEGORY_LABELS: Record<BlockMetadata["category"], string> = {
  core: "Essential Core",
  commerce: "Store & Commerce",
  content: "Content & Story",
  interaction: "Customer Action",
  navigation: "Navigation & Footer",
};

const CATEGORY_COLORS: Record<
  BlockMetadata["category"],
  "primary" | "accent" | "info" | "success" | "warning"
> = {
  core: "primary",
  commerce: "accent",
  content: "info",
  interaction: "success",
  navigation: "warning",
};

export function AddSectionModal({ isOpen, onClose, onAddBlock }: AddSectionModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const allBlocks = getAllApprovedBlockTypes().map(
    (type) => APPROVED_BLOCK_REGISTRY[type].metadata,
  );

  const filteredBlocks = allBlocks.filter((block) => {
    const matchesCategory = selectedCategory === "all" || block.category === selectedCategory;
    const matchesSearch =
      searchQuery.trim() === "" ||
      block.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      block.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-section-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 id="add-section-title" className="text-lg font-bold text-slate-900">
              Add Approved Website Block
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select an approved block to add to your page. Blocks are safe and guaranteed
              responsive.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close add block modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus:outline-hidden focus:ring-2 focus:ring-emerald-700"
          >
            <span className="text-xl leading-none">×</span>
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="px-6 py-3 border-b border-slate-100 bg-white space-y-2">
          <input
            type="search"
            placeholder="Search approved blocks (e.g. Menu, About, Reviews)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-700 focus:border-emerald-700"
          />
          <div className="flex flex-wrap gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => setSelectedCategory("all")}
              className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                selectedCategory === "all"
                  ? "bg-emerald-800 text-white font-medium"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              All (13)
            </button>
            {(["core", "commerce", "content", "interaction", "navigation"] as const).map((cat) => (
              <button
                type="button"
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                  selectedCategory === cat
                    ? "bg-emerald-800 text-white font-medium"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        </div>

        {/* Block Grid */}
        <div className="p-6 overflow-y-auto space-y-3 flex-1">
          {filteredBlocks.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              No approved blocks matched your search.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredBlocks.map((block) => (
                <button
                  type="button"
                  key={block.type}
                  onClick={() => {
                    onAddBlock(block.type as ApprovedBlockType);
                    onClose();
                  }}
                  className="text-left p-3.5 rounded-xl border border-slate-200 hover:border-emerald-600 hover:bg-emerald-50/40 hover:shadow-sm transition-all flex flex-col justify-between group focus:outline-hidden focus:ring-2 focus:ring-emerald-700"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-semibold text-slate-900 group-hover:text-emerald-900 text-sm">
                        {block.name}
                      </span>
                      <Badge variant={CATEGORY_COLORS[block.category]}>{block.category}</Badge>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">{block.description}</p>
                  </div>
                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Variants: {block.allowedVariants?.length || 1}</span>
                    <span className="text-emerald-700 font-medium group-hover:underline">
                      + Add to Page
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
