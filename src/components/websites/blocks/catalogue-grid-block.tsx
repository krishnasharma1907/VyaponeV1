"use client";

import React from "react";
import type { BlockComponentProps, CatalogueGridBlockProps } from "./types";
import { formatCurrencyMinor, getButtonRadiusClass, getCardRadiusClass } from "./utils";
import { WhatsAppIcon } from "./icons";

export function CatalogueGridBlock({
  id,
  props,
  context,
  className = "",
}: BlockComponentProps<CatalogueGridBlockProps>) {
  const theme = context?.theme;
  const business = context?.business;
  const catalogue = context?.catalogueItems || [];
  const buttonRadius = getButtonRadiusClass(theme?.radii);
  const cardRadius = getCardRadiusClass(theme?.radii);

  // Apply featuredOnly filter if requested
  const items = props.featuredOnly ? catalogue.filter((item) => item.isFeatured) : catalogue;

  const cols = props.columns || 3;
  const gridColClass =
    cols === 2
      ? "grid-cols-1 sm:grid-cols-2"
      : cols === 4
        ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
        : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";

  const handleOrder = (itemName: string, price: string) => {
    if (context?.onAction) {
      context.onAction("whatsapp_order", { itemName, price });
      return;
    }
    const num = (business?.whatsappNumber || business?.phone || "").replace(/[^0-9]/g, "");
    if (num) {
      const msg = encodeURIComponent(
        `Hi, I'm interested in buying "${itemName}" (${price}) from your catalogue.`,
      );
      window.open(`https://wa.me/${num}?text=${msg}`, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <section
      id={id}
      data-block-type="catalogue_grid"
      aria-labelledby={`${id}-title`}
      className={`w-full py-12 md:py-16 px-4 sm:px-6 lg:px-8 ${className}`.trim()}
      style={{
        backgroundColor: theme?.colors.background || "#FFFFFF",
        color: theme?.colors.text || "#0F172A",
      }}
    >
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <h2
            id={`${id}-title`}
            className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight"
            style={{ fontFamily: theme?.fonts.heading || "Inter, sans-serif" }}
          >
            {props.title || "Our Products"}
          </h2>
          <p className="text-sm sm:text-base text-slate-600">
            Explore our verified selection. All orders processed directly with verified local store
            support.
          </p>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 max-w-md mx-auto">
            <p className="text-sm font-medium text-slate-700">No products available</p>
            <p className="text-xs text-slate-500 mt-1">
              Products will be displayed dynamically once added to the catalogue.
            </p>
          </div>
        ) : (
          <div className={`grid ${gridColClass} gap-6`}>
            {items.map((item) => {
              const formattedPrice = formatCurrencyMinor(item.priceMinor, item.currency);
              return (
                <div
                  key={item.id}
                  className={`flex flex-col overflow-hidden bg-white border border-slate-200/90 shadow-xs hover:shadow-md transition-shadow ${cardRadius}`}
                >
                  {/* Product Image */}
                  <div className="relative aspect-4/3 w-full bg-slate-100 overflow-hidden">
                    {item.imageUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
                        No image available
                      </div>
                    )}
                    {item.isFeatured && (
                      <div className="absolute top-2.5 right-2.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500 text-white shadow-xs">
                          Featured
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Body */}
                  <div className="flex-1 p-4 flex flex-col justify-between space-y-3">
                    <div className="space-y-1">
                      {item.category && (
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                          {item.category}
                        </p>
                      )}
                      <h3 className="text-base font-bold text-slate-900 leading-snug">
                        {item.name}
                      </h3>
                      {item.description && (
                        <p className="text-xs sm:text-sm text-slate-500 line-clamp-2 leading-relaxed">
                          {item.description}
                        </p>
                      )}
                    </div>

                    <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                      <div>
                        <span
                          className="text-lg font-extrabold tracking-tight"
                          style={{ color: theme?.colors.primary || "#0B6E4F" }}
                        >
                          {formattedPrice}
                        </span>
                      </div>

                      <button
                        type="button"
                        aria-label={`Order ${item.name} for ${formattedPrice} on WhatsApp`}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition-opacity hover:opacity-90 ${buttonRadius}`}
                        style={{ backgroundColor: theme?.colors.primary || "#0B6E4F" }}
                        onClick={() => handleOrder(item.name, formattedPrice)}
                      >
                        <WhatsAppIcon size={14} />
                        <span>Order</span>
                      </button>
                    </div>
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
