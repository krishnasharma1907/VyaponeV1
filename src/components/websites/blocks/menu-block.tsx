"use client";

import React, { useState } from "react";
import type { BlockComponentProps, MenuBlockProps } from "./types";
import { formatCurrencyMinor, getButtonRadiusClass, getCardRadiusClass } from "./utils";
import { WhatsAppIcon } from "./icons";

// Inline helper for food icon
function FoodIcon({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
      <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
      <line x1="6" y1="1" x2="6" y2="4" />
      <line x1="10" y1="1" x2="10" y2="4" />
      <line x1="14" y1="1" x2="14" y2="4" />
    </svg>
  );
}

export function MenuBlock({
  id,
  props,
  context,
  className = "",
}: BlockComponentProps<MenuBlockProps>) {
  const theme = context?.theme;
  const business = context?.business;
  const catalogue = context?.catalogueItems || [];
  const buttonRadius = getButtonRadiusClass(theme?.radii);
  const cardRadius = getCardRadiusClass(theme?.radii);

  // Filter items by categoryIds if specified
  const filteredItems =
    props.categoryIds && props.categoryIds.length > 0
      ? catalogue.filter(
          (item) =>
            (item.categoryId && props.categoryIds!.includes(item.categoryId)) ||
            (item.category && props.categoryIds!.includes(item.category)),
        )
      : catalogue;

  // Extract unique categories
  const categories = Array.from(
    new Set(filteredItems.map((item) => item.category || "General").filter(Boolean)),
  );

  const [activeCategory, setActiveCategory] = useState<string>("all");

  const displayItems =
    activeCategory === "all"
      ? filteredItems
      : filteredItems.filter((item) => (item.category || "General") === activeCategory);

  const handleOrderWhatsApp = (itemName: string, price: string) => {
    if (context?.onAction) {
      context.onAction("whatsapp_order", { itemName, price });
      return;
    }
    const num = (business?.whatsappNumber || business?.phone || "").replace(/[^0-9]/g, "");
    if (num) {
      const msg = encodeURIComponent(
        `Hello, I would like to order "${itemName}" (${price}) from ${business?.name || "your menu"}.`,
      );
      window.open(`https://wa.me/${num}?text=${msg}`, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <section
      id={id}
      data-block-type="menu"
      aria-labelledby={`${id}-title`}
      className={`w-full py-12 md:py-16 px-4 sm:px-6 lg:px-8 ${className}`.trim()}
      style={{
        backgroundColor: theme?.colors.background || "#FFFFFF",
        color: theme?.colors.text || "#0F172A",
      }}
    >
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800">
            <FoodIcon size={14} />
            <span>Curated Menu</span>
          </div>
          <h2
            id={`${id}-title`}
            className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight"
            style={{ fontFamily: theme?.fonts.heading || "Inter, sans-serif" }}
          >
            {props.title || "Our Menu"}
          </h2>
          {props.subtitle && (
            <p
              className="text-base sm:text-lg text-slate-600"
              style={{ fontFamily: theme?.fonts.body || "Inter, sans-serif" }}
            >
              {props.subtitle}
            </p>
          )}
        </div>

        {/* Category Pills Filter */}
        {categories.length > 1 && (
          <div
            className="flex flex-wrap items-center justify-center gap-2 pt-2"
            role="tablist"
            aria-label="Menu Categories"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeCategory === "all"}
              className={`px-4 py-2 text-sm font-medium transition-colors ${buttonRadius} ${
                activeCategory === "all"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
              onClick={() => setActiveCategory("all")}
            >
              All Items ({filteredItems.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={activeCategory === cat}
                className={`px-4 py-2 text-sm font-medium transition-colors ${buttonRadius} ${
                  activeCategory === cat
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Menu Items Grid or Empty State */}
        {displayItems.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 max-w-md mx-auto">
            <FoodIcon size={32} className="mx-auto text-slate-400 mb-2" />
            <p className="text-sm font-medium text-slate-700">No menu items available</p>
            <p className="text-xs text-slate-500 mt-1">
              Items dynamically bind to the server catalogue when configured.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
            {displayItems.map((item) => {
              const formattedPrice = formatCurrencyMinor(item.priceMinor, item.currency);
              return (
                <div
                  key={item.id}
                  className={`flex items-start justify-between p-4 bg-white border border-slate-200 shadow-xs hover:border-slate-300 transition-colors ${cardRadius}`}
                >
                  <div className="flex-1 pr-4 space-y-1">
                    <div className="flex items-center gap-2">
                      {item.dietaryPreference === "veg" && (
                        <span
                          className="inline-block w-3.5 h-3.5 border-2 border-emerald-600 p-0.5 rounded-xs"
                          title="Vegetarian"
                          aria-label="Vegetarian"
                        >
                          <span className="block w-full h-full bg-emerald-600 rounded-full" />
                        </span>
                      )}
                      {item.dietaryPreference === "non_veg" && (
                        <span
                          className="inline-block w-3.5 h-3.5 border-2 border-rose-600 p-0.5 rounded-xs"
                          title="Non-Vegetarian"
                          aria-label="Non-Vegetarian"
                        >
                          <span className="block w-full h-full bg-rose-600 rounded-full" />
                        </span>
                      )}
                      <h3 className="text-base font-semibold text-slate-900">{item.name}</h3>
                    </div>
                    {item.description && (
                      <p className="text-xs sm:text-sm text-slate-500 line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                    )}
                    <div className="pt-2">
                      <span
                        className="text-base sm:text-lg font-bold"
                        style={{ color: theme?.colors.primary || "#0B6E4F" }}
                      >
                        {formattedPrice}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {item.imageUrl && (
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    )}
                    <button
                      type="button"
                      aria-label={`Order ${item.name} on WhatsApp for ${formattedPrice}`}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 ${buttonRadius}`}
                      style={{ backgroundColor: theme?.colors.primary || "#0B6E4F" }}
                      onClick={() => handleOrderWhatsApp(item.name, formattedPrice)}
                    >
                      <WhatsAppIcon size={14} />
                      <span>Order</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
