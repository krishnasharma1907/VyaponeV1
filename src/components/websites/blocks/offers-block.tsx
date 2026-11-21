"use client";

import React, { useState } from "react";
import type { BlockComponentProps, OffersBlockProps } from "./types";
import { TagIcon, CheckCircleIcon } from "./icons";
import { getCardRadiusClass } from "./utils";

export function OffersBlock({
  id,
  props,
  context,
  className = "",
}: BlockComponentProps<OffersBlockProps>) {
  const theme = context?.theme;
  const cardRadius = getCardRadiusClass(theme?.radii);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleCopy = (code: string) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    }
    context?.onAction?.("coupon_copied", { code });
  };

  return (
    <section
      id={id}
      data-block-type="offers"
      aria-labelledby={`${id}-title`}
      className={`w-full py-12 md:py-16 px-4 sm:px-6 lg:px-8 ${className}`.trim()}
      style={{
        backgroundColor: theme?.colors.surface || "#F8FAFC",
        color: theme?.colors.text || "#0F172A",
      }}
    >
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800">
            <TagIcon size={14} className="text-amber-600" />
            <span>Exclusive Deals</span>
          </div>
          <h2
            id={`${id}-title`}
            className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight"
            style={{ fontFamily: theme?.fonts.heading || "Inter, sans-serif" }}
          >
            {props.title || "Special Offers & Discounts"}
          </h2>
          <p className="text-sm sm:text-base text-slate-600">
            Take advantage of these limited-time promotional benefits.
          </p>
        </div>

        {props.offers.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-xl border border-dashed border-slate-300 bg-white max-w-md mx-auto">
            <p className="text-sm font-medium text-slate-700">No active offers right now</p>
            <p className="text-xs text-slate-500 mt-1">
              Check back soon for seasonal promotions and coupons.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {props.offers.map((offer, idx) => (
              <div
                key={idx}
                className={`p-6 bg-white border-2 border-dashed border-amber-300 shadow-xs flex flex-col justify-between space-y-4 relative ${cardRadius}`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-600">
                      Special Deal
                    </span>
                    {offer.expiresAt && (
                      <span className="text-[11px] font-medium text-slate-400">
                        Valid till: {offer.expiresAt}
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 leading-snug">
                    {offer.headline}
                  </h3>

                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {offer.description}
                  </p>
                </div>

                {offer.couponCode && (
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-md font-mono text-xs font-bold text-slate-800 tracking-wider">
                      {offer.couponCode}
                    </div>

                    <button
                      type="button"
                      aria-label={`Copy coupon code ${offer.couponCode}`}
                      className="px-3 py-1.5 text-xs font-semibold rounded-md transition-colors bg-amber-500 hover:bg-amber-600 text-white shadow-2xs"
                      onClick={() => handleCopy(offer.couponCode!)}
                    >
                      {copiedCode === offer.couponCode ? (
                        <span className="flex items-center gap-1">
                          <CheckCircleIcon size={12} /> Copied!
                        </span>
                      ) : (
                        "Copy Code"
                      )}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
