"use client";

import React from "react";
import type { BlockComponentProps, PricingBlockProps } from "./types";
import { formatCurrencyMinor, getButtonRadiusClass, getCardRadiusClass } from "./utils";
import { CheckCircleIcon } from "./icons";

export function PricingBlock({
  id,
  props,
  context,
  className = "",
}: BlockComponentProps<PricingBlockProps>) {
  const theme = context?.theme;
  const catalogue = context?.catalogueItems || [];
  const buttonRadius = getButtonRadiusClass(theme?.radii);
  const cardRadius = getCardRadiusClass(theme?.radii);

  // Group catalogue items into tiers or display service packages
  const items =
    catalogue.length > 0
      ? catalogue
      : [
          {
            id: "tier_1",
            name: "Basic Plan",
            description: "Essential package for individuals and small setups",
            priceMinor: 49900,
            currency: "INR",
            category: "General",
            isFeatured: false,
          },
          {
            id: "tier_2",
            name: "Standard Plan",
            description: "Complete service package with priority assistance",
            priceMinor: 99900,
            currency: "INR",
            category: "Recommended",
            isFeatured: true,
          },
          {
            id: "tier_3",
            name: "Premium Package",
            description: "All-inclusive comprehensive solution with dedicated support",
            priceMinor: 199900,
            currency: "INR",
            category: "General",
            isFeatured: false,
          },
        ];

  const handleSelect = (tierName: string, price: string) => {
    if (context?.onAction) {
      context.onAction("pricing_selected", { tierName, price });
      return;
    }
    const business = context?.business;
    const num = (business?.whatsappNumber || business?.phone || "").replace(/[^0-9]/g, "");
    if (num) {
      const msg = encodeURIComponent(
        `Hi, I would like to book the "${tierName}" package (${price}).`,
      );
      window.open(`https://wa.me/${num}?text=${msg}`, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <section
      id={id}
      data-block-type="pricing"
      aria-labelledby={`${id}-title`}
      className={`w-full py-12 md:py-16 px-4 sm:px-6 lg:px-8 ${className}`.trim()}
      style={{
        backgroundColor: theme?.colors.surface || "#F8FAFC",
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
            {props.title || "Transparent Pricing"}
          </h2>
          <p className="text-sm sm:text-base text-slate-600">
            Clear, upfront rates with no hidden charges. All statutory taxes clearly indicated.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {items.map((item) => {
            const isHighlighted =
              (props.highlightCategory && item.category === props.highlightCategory) ||
              item.isFeatured ||
              item.name.toLowerCase().includes("standard") ||
              item.name.toLowerCase().includes("popular");

            const formattedPrice = formatCurrencyMinor(item.priceMinor, item.currency);

            return (
              <div
                key={item.id}
                className={`relative flex flex-col justify-between p-6 bg-white border transition-all ${cardRadius} ${
                  isHighlighted
                    ? "border-2 shadow-lg ring-1 ring-emerald-600/20"
                    : "border-slate-200 shadow-xs"
                }`}
                style={{
                  borderColor: isHighlighted ? theme?.colors.primary || "#0B6E4F" : undefined,
                }}
              >
                {isHighlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span
                      className="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider text-white shadow-xs"
                      style={{ backgroundColor: theme?.colors.primary || "#0B6E4F" }}
                    >
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold text-slate-900">{item.name}</h3>
                    {item.description && (
                      <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                        {item.description}
                      </p>
                    )}
                  </div>

                  <div className="pt-2 pb-4 border-b border-slate-100">
                    <span
                      className="text-3xl font-extrabold tracking-tight"
                      style={{ color: theme?.colors.text || "#0F172A" }}
                    >
                      {formattedPrice}
                    </span>
                    <span className="text-xs text-slate-400 ml-1.5 font-medium">/ package</span>
                  </div>

                  {/* Feature Checklist */}
                  <ul className="space-y-2.5 text-xs sm:text-sm text-slate-700">
                    <li className="flex items-center gap-2">
                      <CheckCircleIcon size={16} className="text-emerald-600 shrink-0" />
                      <span>Verified genuine service</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircleIcon size={16} className="text-emerald-600 shrink-0" />
                      <span>GST invoice available</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircleIcon size={16} className="text-emerald-600 shrink-0" />
                      <span>Direct WhatsApp updates</span>
                    </li>
                  </ul>
                </div>

                <div className="pt-6">
                  <button
                    type="button"
                    aria-label={`Select ${item.name} for ${formattedPrice}`}
                    className={`w-full py-2.5 px-4 text-sm font-semibold transition-opacity hover:opacity-90 ${buttonRadius} ${
                      isHighlighted
                        ? "text-white shadow-sm"
                        : "border border-slate-300 text-slate-800 bg-slate-50 hover:bg-slate-100"
                    }`}
                    style={
                      isHighlighted
                        ? { backgroundColor: theme?.colors.primary || "#0B6E4F" }
                        : undefined
                    }
                    onClick={() => handleSelect(item.name, formattedPrice)}
                  >
                    Select Plan
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
