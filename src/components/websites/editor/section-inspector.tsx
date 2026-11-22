"use client";

/**
 * VyapOne — Constrained Visual Editor: Section Inspector [VO-044]
 *
 * Dedicated configuration inspector for the selected section.
 * Enforces strict 1:1 mapping with approved Zod schemas.
 * Rejects arbitrary code/script/HTML injection and sanitizes all URLs.
 */

import React, { useState } from "react";
import {
  APPROVED_BLOCK_REGISTRY,
  isApprovedBlockType,
} from "@/components/websites/blocks/block-registry";
import { Badge, Button } from "@/components/ui";
import { sanitizeLinkUrl } from "@/components/websites/blocks/utils";
import type { SectionInspectorProps } from "./types";

export function SectionInspector({
  section,
  availableMedia = [],
  availableModules = {},
  onUpdateProps,
  onClose,
  validationErrors = {},
  className = "",
}: SectionInspectorProps) {
  const isApproved = isApprovedBlockType(section.type);
  const metadata = isApproved ? APPROVED_BLOCK_REGISTRY[section.type].metadata : null;

  const [currentVariant, setCurrentVariant] = useState<string>(
    section.variant || metadata?.allowedVariants?.[0] || "default",
  );
  const [propsState, setPropsState] = useState<Record<string, unknown>>({
    ...section.props,
  });

  const handleVariantChange = (newVariant: string) => {
    setCurrentVariant(newVariant);
    onUpdateProps(section.id, propsState, newVariant);
  };

  const handlePropChange = (key: string, value: unknown) => {
    const updated = { ...propsState, [key]: value };
    setPropsState(updated);
    onUpdateProps(section.id, updated, currentVariant);
  };

  if (!isApproved || !metadata) {
    return (
      <div className={`p-4 bg-amber-50 border-l-4 border-amber-500 text-amber-900 ${className}`}>
        <p className="font-bold text-xs">Unapproved Block Type</p>
        <p className="text-[11px] mt-1">
          Block type &quot;{section.type}&quot; is not an approved VyapOne component.
        </p>
        <Button variant="ghost" size="sm" onClick={onClose} className="mt-3">
          Close Inspector
        </Button>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col h-full bg-slate-50/50 border-l border-slate-200 ${className}`.trim()}
    >
      {/* Header */}
      <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <h2 className="text-sm font-bold text-slate-900">{metadata.name}</h2>
            <Badge variant="default" className="text-[10px] py-0 px-1">
              {metadata.category}
            </Badge>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">Configure section content & layout</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close inspector"
          className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Form Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Layout Variant Selector */}
        {metadata.allowedVariants && metadata.allowedVariants.length > 1 && (
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2">
            <label
              htmlFor="block-layout-variant"
              className="block text-xs font-bold text-slate-800"
            >
              Block Layout Variant
            </label>
            <select
              id="block-layout-variant"
              value={currentVariant}
              onChange={(e) => handleVariantChange(e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-700"
            >
              {metadata.allowedVariants.map((variant) => (
                <option key={variant} value={variant}>
                  {variant.charAt(0).toUpperCase() + variant.slice(1).replace("-", " ")}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500">
              Choose from approved visual styles designed for this component.
            </p>
          </div>
        )}

        {/* Dynamic Binding Notice */}
        {metadata.supportsDynamicBinding && (
          <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl text-emerald-900 text-xs">
            <strong className="block font-semibold">⚡ Authoritative Server Binding</strong>
            <p className="mt-0.5 text-[11px] text-emerald-800 leading-relaxed">
              Items, prices, and taxes in this block resolve automatically from your verified{" "}
              <strong>{metadata.bindingSource || "catalogue"}</strong>. They cannot be altered
              manually to ensure GST compliance.
            </p>
          </div>
        )}

        {/* Block Specific Form Fields */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-3.5">
          {/* Hero Form */}
          {section.type === "hero" && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Headline <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={(propsState.title as string) || ""}
                  onChange={(e) => handlePropChange("title", e.target.value)}
                  maxLength={120}
                  placeholder="e.g. Authentic Handcrafted Indian Sweets"
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-700"
                />
                {validationErrors["props.title"] && (
                  <p className="text-[11px] text-rose-600 mt-0.5">
                    {validationErrors["props.title"][0]}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Subheadline / Tagline
                </label>
                <textarea
                  rows={2}
                  value={(propsState.subtitle as string) || ""}
                  onChange={(e) => handlePropChange("subtitle", e.target.value)}
                  maxLength={255}
                  placeholder="e.g. Made fresh daily with pure desi ghee in Bengaluru."
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-700"
                />
              </div>

              {/* Primary CTA */}
              <div className="pt-2 border-t border-slate-100">
                <span className="block text-xs font-bold text-slate-800 mb-2">
                  Primary Action Button (CTA)
                </span>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-0.5">Button Label</label>
                    <input
                      type="text"
                      value={((propsState.cta as Record<string, unknown>)?.label as string) || ""}
                      onChange={(e) => {
                        const currentCta = (propsState.cta as Record<string, unknown>) || {};
                        handlePropChange("cta", { ...currentCta, label: e.target.value });
                      }}
                      placeholder="e.g. Order on WhatsApp"
                      className="w-full px-2.5 py-1 text-xs border border-slate-200 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-0.5">Action Type</label>
                    <select
                      value={
                        ((propsState.cta as Record<string, unknown>)?.action as string) ||
                        "whatsapp_order"
                      }
                      onChange={(e) => {
                        const currentCta = (propsState.cta as Record<string, unknown>) || {};
                        handlePropChange("cta", { ...currentCta, action: e.target.value });
                      }}
                      className="w-full px-2 py-1 text-xs border border-slate-200 rounded-md bg-white"
                    >
                      <option value="whatsapp_order">WhatsApp Order</option>
                      <option value="phone_call">Phone Call</option>
                      <option value="enquiry">Send Enquiry</option>
                      <option value="catalogue">View Catalogue</option>
                      <option value="custom_link">Custom Link</option>
                    </select>
                  </div>
                </div>
                {(propsState.cta as Record<string, unknown>)?.action === "custom_link" && (
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-0.5">Target URL</label>
                    <input
                      type="text"
                      value={((propsState.cta as Record<string, unknown>)?.target as string) || ""}
                      onChange={(e) => {
                        const currentCta = (propsState.cta as Record<string, unknown>) || {};
                        const clean = sanitizeLinkUrl(e.target.value);
                        handlePropChange("cta", {
                          ...currentCta,
                          target: clean === "#" && e.target.value === "" ? "" : clean,
                        });
                      }}
                      placeholder="https://..."
                      className="w-full px-2.5 py-1 text-xs border border-slate-200 rounded-md"
                    />
                  </div>
                )}
              </div>

              {/* Hero Banner Media Image */}
              <div className="pt-2 border-t border-slate-100">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Featured Banner Image (Optional)
                </label>
                {propsState.imageMediaId ? (
                  <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="text-[11px] font-medium text-slate-800 truncate max-w-[200px]">
                      {availableMedia.find((m) => m.id === propsState.imageMediaId)
                        ?.originalFilename ||
                        `Media ID: ${(propsState.imageMediaId as string).substring(0, 8)}...`}
                    </span>
                    <button
                      type="button"
                      onClick={() => handlePropChange("imageMediaId", undefined)}
                      className="text-xs text-rose-600 hover:text-rose-800 font-semibold px-2 py-0.5"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <select
                    aria-label="Select hero image"
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        handlePropChange("imageMediaId", e.target.value);
                      }
                    }}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="">Select from business media library...</option>
                    {availableMedia
                      .filter((m) =>
                        ["website_asset", "catalogue_image", "business_logo"].includes(m.category),
                      )
                      .map((media) => (
                        <option key={media.id} value={media.id}>
                          {media.originalFilename} ({media.category})
                        </option>
                      ))}
                  </select>
                )}
                <p className="text-[10px] text-slate-400 mt-1">
                  Only verified business media items can be attached to website banners.
                </p>
              </div>
            </>
          )}

          {/* About Form */}
          {section.type === "about" && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Section Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={(propsState.title as string) || ""}
                  onChange={(e) => handlePropChange("title", e.target.value)}
                  maxLength={100}
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Our Story / Heritage <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={4}
                  value={(propsState.story as string) || ""}
                  onChange={(e) => handlePropChange("story", e.target.value)}
                  maxLength={3000}
                  placeholder="Share your business journey, passion, and heritage..."
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Highlight Badges (Max 10)
                </label>
                <div className="space-y-1.5">
                  {((propsState.highlights as string[]) || []).map((highlight, hIndex) => (
                    <div key={hIndex} className="flex gap-1.5">
                      <input
                        type="text"
                        value={highlight}
                        onChange={(e) => {
                          const list = [...((propsState.highlights as string[]) || [])];
                          list[hIndex] = e.target.value;
                          handlePropChange("highlights", list);
                        }}
                        className="flex-1 px-2.5 py-1 text-xs border border-slate-200 rounded-md"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const list = ((propsState.highlights as string[]) || []).filter(
                            (_, i) => i !== hIndex,
                          );
                          handlePropChange("highlights", list);
                        }}
                        className="px-2 text-rose-600 hover:bg-rose-50 rounded-md"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {((propsState.highlights as string[]) || []).length < 10 && (
                    <button
                      type="button"
                      onClick={() => {
                        const list = [
                          ...((propsState.highlights as string[]) || []),
                          "Trusted quality",
                        ];
                        handlePropChange("highlights", list);
                      }}
                      className="text-xs text-emerald-800 font-medium hover:underline pt-1"
                    >
                      + Add Highlight
                    </button>
                  )}
                </div>
              </div>

              {/* About Photo Media Image */}
              <div className="pt-2 border-t border-slate-100">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Story / Store Photo (Optional)
                </label>
                {propsState.imageMediaId ? (
                  <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="text-[11px] font-medium text-slate-800 truncate max-w-[200px]">
                      {availableMedia.find((m) => m.id === propsState.imageMediaId)
                        ?.originalFilename ||
                        `Media ID: ${(propsState.imageMediaId as string).substring(0, 8)}...`}
                    </span>
                    <button
                      type="button"
                      onClick={() => handlePropChange("imageMediaId", undefined)}
                      className="text-xs text-rose-600 hover:text-rose-800 font-semibold px-2 py-0.5"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <select
                    aria-label="Select about story photo"
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        handlePropChange("imageMediaId", e.target.value);
                      }
                    }}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="">Select from business media library...</option>
                    {availableMedia
                      .filter((m) =>
                        ["website_asset", "catalogue_image", "business_logo"].includes(m.category),
                      )
                      .map((media) => (
                        <option key={media.id} value={media.id}>
                          {media.originalFilename} ({media.category})
                        </option>
                      ))}
                  </select>
                )}
              </div>
            </>
          )}

          {/* Menu / Catalogue Form */}
          {(section.type === "menu" || section.type === "catalogue_grid") && (
            <>
              <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-lg text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-emerald-900">Server Data Binding</span>
                  <Badge variant="success" className="text-[10px]">
                    {availableModules.catalogue_services?.status === "operational"
                      ? "Catalogue Active"
                      : "Catalogue Informational"}
                  </Badge>
                </div>
                <p className="text-[11px] text-emerald-800">
                  Products, prices, and availability are server-owned facts dynamically rendered
                  from the Catalogue.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Section Headline
                </label>
                <input
                  type="text"
                  value={(propsState.title as string) || ""}
                  onChange={(e) => handlePropChange("title", e.target.value)}
                  maxLength={100}
                  placeholder="e.g. Our Fresh Menu"
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg"
                />
              </div>

              {section.type === "catalogue_grid" && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Grid Columns
                    </label>
                    <select
                      value={(propsState.columns as number) || 3}
                      onChange={(e) => handlePropChange("columns", Number(e.target.value))}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                    >
                      <option value={2}>2 Columns</option>
                      <option value={3}>3 Columns (Recommended)</option>
                      <option value={4}>4 Columns</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="featured-only-toggle"
                      checked={Boolean(propsState.featuredOnly)}
                      onChange={(e) => handlePropChange("featuredOnly", e.target.checked)}
                      className="rounded-sm border-slate-300 text-emerald-700 focus:ring-emerald-700"
                    />
                    <label htmlFor="featured-only-toggle" className="text-xs text-slate-700">
                      Show Featured Items Only
                    </label>
                  </div>
                </>
              )}
            </>
          )}

          {/* Gallery Form */}
          {section.type === "gallery" && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Gallery Title
                </label>
                <input
                  type="text"
                  value={(propsState.title as string) || ""}
                  onChange={(e) => handlePropChange("title", e.target.value)}
                  maxLength={100}
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Display Columns
                </label>
                <select
                  value={(propsState.columns as number) || 3}
                  onChange={(e) => handlePropChange("columns", Number(e.target.value))}
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                >
                  <option value={2}>2 Columns</option>
                  <option value={3}>3 Columns</option>
                  <option value={4}>4 Columns</option>
                </select>
              </div>

              {/* Gallery Photos Manager */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-800">
                    Gallery Photos ({((propsState.images as Array<unknown>) || []).length} / 50)
                  </span>
                </div>

                <div className="space-y-3">
                  {(
                    (propsState.images as Array<{
                      mediaId: string;
                      caption?: string;
                      altText?: string;
                    }>) || []
                  ).map((img, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-white border border-slate-200 rounded-lg space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700">
                          Photo {idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const currentImages = [
                              ...((propsState.images as Array<{
                                mediaId: string;
                                caption?: string;
                                altText?: string;
                              }>) || []),
                            ];
                            currentImages.splice(idx, 1);
                            handlePropChange("images", currentImages);
                          }}
                          className="text-xs text-rose-600 hover:text-rose-800 font-medium"
                        >
                          Remove
                        </button>
                      </div>
                      <select
                        aria-label={`Select media for photo ${idx + 1}`}
                        value={img.mediaId}
                        onChange={(e) => {
                          const currentImages = [
                            ...((propsState.images as Array<{
                              mediaId: string;
                              caption?: string;
                              altText?: string;
                            }>) || []),
                          ];
                          currentImages[idx] = { ...currentImages[idx], mediaId: e.target.value };
                          handlePropChange("images", currentImages);
                        }}
                        className="w-full px-2.5 py-1 text-xs border border-slate-200 rounded-md bg-white"
                      >
                        {availableMedia
                          .filter((m) => ["website_asset", "catalogue_image"].includes(m.category))
                          .map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.originalFilename} ({m.category})
                            </option>
                          ))}
                        {!availableMedia.some((m) => m.id === img.mediaId) && (
                          <option value={img.mediaId}>{img.mediaId.substring(0, 8)}...</option>
                        )}
                      </select>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Caption (optional)"
                          value={img.caption || ""}
                          onChange={(e) => {
                            const currentImages = [
                              ...((propsState.images as Array<{
                                mediaId: string;
                                caption?: string;
                                altText?: string;
                              }>) || []),
                            ];
                            currentImages[idx] = { ...currentImages[idx], caption: e.target.value };
                            handlePropChange("images", currentImages);
                          }}
                          className="px-2 py-1 text-xs border border-slate-200 rounded-md"
                        />
                        <input
                          type="text"
                          placeholder="Alt text"
                          value={img.altText || ""}
                          onChange={(e) => {
                            const currentImages = [
                              ...((propsState.images as Array<{
                                mediaId: string;
                                caption?: string;
                                altText?: string;
                              }>) || []),
                            ];
                            currentImages[idx] = { ...currentImages[idx], altText: e.target.value };
                            handlePropChange("images", currentImages);
                          }}
                          className="px-2 py-1 text-xs border border-slate-200 rounded-md"
                        />
                      </div>
                    </div>
                  ))}

                  {((propsState.images as Array<unknown>) || []).length < 50 && (
                    <button
                      type="button"
                      disabled={availableMedia.length === 0}
                      onClick={() => {
                        if (availableMedia.length === 0) return;
                        const firstPublishable =
                          availableMedia.find((m) =>
                            ["website_asset", "catalogue_image"].includes(m.category),
                          ) || availableMedia[0];
                        const currentImages = [
                          ...((propsState.images as Array<{
                            mediaId: string;
                            caption?: string;
                            altText?: string;
                          }>) || []),
                        ];
                        currentImages.push({
                          mediaId: firstPublishable.id,
                          caption: "",
                          altText: firstPublishable.originalFilename,
                        });
                        handlePropChange("images", currentImages);
                      }}
                      className="w-full py-2 px-3 border border-dashed border-slate-300 text-xs font-semibold text-emerald-800 bg-white hover:bg-slate-50 rounded-lg transition-colors disabled:opacity-50"
                    >
                      + Add Photo from Media Library
                    </button>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Booking Form */}
          {section.type === "booking_form" && (
            <>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">Appointments Module</span>
                  <Badge
                    variant={
                      availableModules.appointments?.status === "operational"
                        ? "success"
                        : availableModules.appointments?.status === "coming_soon"
                          ? "default"
                          : "warning"
                    }
                    className="text-[10px]"
                  >
                    {availableModules.appointments?.status === "operational"
                      ? "Operational"
                      : availableModules.appointments?.status === "coming_soon"
                        ? "Coming Soon"
                        : "Informational Mode"}
                  </Badge>
                </div>
                <p className="text-[11px] text-slate-500">
                  {availableModules.appointments?.status === "operational"
                    ? "Direct slot booking connected to services catalogue."
                    : "Runs in informational mode: customer booking requests are delivered as enquiries."}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Booking Headline
                </label>
                <input
                  type="text"
                  value={(propsState.title as string) || ""}
                  onChange={(e) => handlePropChange("title", e.target.value)}
                  maxLength={100}
                  placeholder="e.g. Schedule an Appointment"
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Booking Notice / Instructions
                </label>
                <textarea
                  rows={2}
                  value={(propsState.notice as string) || ""}
                  onChange={(e) => handlePropChange("notice", e.target.value)}
                  maxLength={500}
                  placeholder="e.g. Please arrive 10 minutes prior to your time slot."
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg"
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="require-phone-toggle"
                  checked={propsState.requirePhone !== false}
                  onChange={(e) => handlePropChange("requirePhone", e.target.checked)}
                  className="rounded-sm border-slate-300 text-emerald-700"
                />
                <label htmlFor="require-phone-toggle" className="text-xs text-slate-700">
                  Require customer +91 phone number
                </label>
              </div>
            </>
          )}

          {/* Reviews Form */}
          {section.type === "reviews" && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reviews Headline
                </label>
                <input
                  type="text"
                  value={(propsState.title as string) || ""}
                  onChange={(e) => handlePropChange("title", e.target.value)}
                  maxLength={100}
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Review Source
                </label>
                <select
                  value={(propsState.source as string) || "verified_reviews"}
                  onChange={(e) => handlePropChange("source", e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                >
                  <option value="verified_reviews">Verified Customer Orders</option>
                  <option value="google_reviews">Google Reviews (Synced)</option>
                  <option value="custom">Curated Testimonials</option>
                </select>
              </div>
            </>
          )}

          {/* Location Map Form */}
          {section.type === "location_map" && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Location Headline
                </label>
                <input
                  type="text"
                  value={(propsState.title as string) || ""}
                  onChange={(e) => handlePropChange("title", e.target.value)}
                  maxLength={100}
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg"
                />
              </div>
              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="show-timings-toggle"
                    checked={propsState.showTimings !== false}
                    onChange={(e) => handlePropChange("showTimings", e.target.checked)}
                    className="rounded-sm border-slate-300 text-emerald-700"
                  />
                  <label htmlFor="show-timings-toggle" className="text-xs text-slate-700">
                    Display Operating Hours & Weekly Timings
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="show-map-toggle"
                    checked={propsState.showMap !== false}
                    onChange={(e) => handlePropChange("showMap", e.target.checked)}
                    className="rounded-sm border-slate-300 text-emerald-700"
                  />
                  <label htmlFor="show-map-toggle" className="text-xs text-slate-700">
                    Display Google Maps Directions Button
                  </label>
                </div>
              </div>
            </>
          )}

          {/* Contact Form */}
          {section.type === "contact" && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Contact Headline
                </label>
                <input
                  type="text"
                  value={(propsState.title as string) || ""}
                  onChange={(e) => handlePropChange("title", e.target.value)}
                  maxLength={100}
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg"
                />
              </div>
              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="contact-whatsapp-toggle"
                    checked={propsState.showWhatsapp !== false}
                    onChange={(e) => handlePropChange("showWhatsapp", e.target.checked)}
                    className="rounded-sm border-slate-300 text-emerald-700"
                  />
                  <label htmlFor="contact-whatsapp-toggle" className="text-xs text-slate-700">
                    Enable Direct WhatsApp Button
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="contact-phone-toggle"
                    checked={propsState.showPhone !== false}
                    onChange={(e) => handlePropChange("showPhone", e.target.checked)}
                    className="rounded-sm border-slate-300 text-emerald-700"
                  />
                  <label htmlFor="contact-phone-toggle" className="text-xs text-slate-700">
                    Enable Direct Phone Call Button
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="contact-form-toggle"
                    checked={propsState.enableForm !== false}
                    onChange={(e) => handlePropChange("enableForm", e.target.checked)}
                    className="rounded-sm border-slate-300 text-emerald-700"
                  />
                  <label htmlFor="contact-form-toggle" className="text-xs text-slate-700">
                    Enable Customer Inquiry Message Form
                  </label>
                </div>
              </div>
            </>
          )}

          {/* FAQ Form */}
          {section.type === "faq" && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  FAQ Headline
                </label>
                <input
                  type="text"
                  value={(propsState.title as string) || ""}
                  onChange={(e) => handlePropChange("title", e.target.value)}
                  maxLength={100}
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Questions & Answers
                </label>
                <div className="space-y-2">
                  {((propsState.items as Array<{ question: string; answer: string }>) || []).map(
                    (faqItem, fIndex) => (
                      <div
                        key={fIndex}
                        className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1.5"
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-slate-500">
                            Question #{fIndex + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const items = (
                                (propsState.items as Array<{ question: string; answer: string }>) ||
                                []
                              ).filter((_, i) => i !== fIndex);
                              handlePropChange("items", items);
                            }}
                            className="text-xs text-rose-600 hover:text-rose-800"
                          >
                            Remove
                          </button>
                        </div>
                        <input
                          type="text"
                          value={faqItem.question}
                          onChange={(e) => {
                            const items = [
                              ...((propsState.items as Array<{
                                question: string;
                                answer: string;
                              }>) || []),
                            ];
                            items[fIndex] = { ...items[fIndex], question: e.target.value };
                            handlePropChange("items", items);
                          }}
                          placeholder="Question..."
                          className="w-full px-2 py-1 text-xs border border-slate-200 rounded-sm bg-white"
                        />
                        <textarea
                          rows={2}
                          value={faqItem.answer}
                          onChange={(e) => {
                            const items = [
                              ...((propsState.items as Array<{
                                question: string;
                                answer: string;
                              }>) || []),
                            ];
                            items[fIndex] = { ...items[fIndex], answer: e.target.value };
                            handlePropChange("items", items);
                          }}
                          placeholder="Answer..."
                          className="w-full px-2 py-1 text-xs border border-slate-200 rounded-sm bg-white"
                        />
                      </div>
                    ),
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      const items = [
                        ...((propsState.items as Array<{ question: string; answer: string }>) ||
                          []),
                        {
                          question: "Do you offer home delivery?",
                          answer: "Yes, we deliver across our local service area.",
                        },
                      ];
                      handlePropChange("items", items);
                    }}
                    className="text-xs text-emerald-800 font-medium hover:underline pt-1"
                  >
                    + Add Question
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Footer Form */}
          {section.type === "footer" && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Copyright Notice
                </label>
                <input
                  type="text"
                  value={(propsState.copyright as string) || ""}
                  onChange={(e) => handlePropChange("copyright", e.target.value)}
                  maxLength={120}
                  placeholder="e.g. © 2026 Sharma Sweets. All rights reserved."
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg"
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="show-powered-by-toggle"
                  checked={propsState.showPoweredBy !== false}
                  onChange={(e) => handlePropChange("showPoweredBy", e.target.checked)}
                  className="rounded-sm border-slate-300 text-emerald-700"
                />
                <label htmlFor="show-powered-by-toggle" className="text-xs text-slate-700">
                  Show &quot;Powered by VyapOne&quot; badge
                </label>
              </div>
            </>
          )}

          {/* Fallback for other blocks */}
          {["pricing", "offers"].includes(section.type) && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Section Headline
              </label>
              <input
                type="text"
                value={(propsState.title as string) || ""}
                onChange={(e) => handlePropChange("title", e.target.value)}
                maxLength={100}
                className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg"
              />
            </div>
          )}
        </div>
      </div>

      {/* Footer / Done Button */}
      <div className="p-3 bg-white border-t border-slate-200 flex justify-between items-center">
        <span className="text-[11px] text-slate-400">Changes update live in preview</span>
        <Button variant="secondary" size="sm" onClick={onClose}>
          Done Editing
        </Button>
      </div>
    </div>
  );
}
