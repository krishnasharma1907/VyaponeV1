"use client";

import React, { useState } from "react";
import type { BlockComponentProps, FaqBlockProps } from "./types";
import { ChevronDownIcon } from "./icons";
import { getCardRadiusClass } from "./utils";

export function FaqBlock({
  id,
  props,
  context,
  className = "",
}: BlockComponentProps<FaqBlockProps>) {
  const theme = context?.theme;
  const cardRadius = getCardRadiusClass(theme?.radii);
  const [openIndices, setOpenIndices] = useState<Set<number>>(new Set([0])); // First item open by default

  const toggleIndex = (index: number) => {
    setOpenIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const items =
    props.items && props.items.length > 0
      ? props.items
      : [
          {
            question: "How do I place an order?",
            answer:
              "You can place an order directly via WhatsApp or call our store using the buttons on this website.",
          },
          {
            question: "What payment methods are accepted?",
            answer:
              "We accept UPI (Google Pay, PhonePe, Paytm), cash on delivery, and direct bank transfers. Verified GST bills are provided for all transactions.",
          },
          {
            question: "What are your delivery and pickup timings?",
            answer:
              "Orders are prepared fresh and dispatched during regular operating hours. Local delivery is usually completed within 45 to 90 minutes.",
          },
        ];

  return (
    <section
      id={id}
      data-block-type="faq"
      aria-labelledby={`${id}-title`}
      className={`w-full py-12 md:py-16 px-4 sm:px-6 lg:px-8 ${className}`.trim()}
      style={{
        backgroundColor: theme?.colors.background || "#FFFFFF",
        color: theme?.colors.text || "#0F172A",
      }}
    >
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <h2
            id={`${id}-title`}
            className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight"
            style={{ fontFamily: theme?.fonts.heading || "Inter, sans-serif" }}
          >
            {props.title || "Frequently Asked Questions"}
          </h2>
          <p className="text-sm sm:text-base text-slate-600">
            Quick answers to common questions about our products, ordering, and policies.
          </p>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 max-w-md mx-auto">
            <p className="text-sm font-medium text-slate-700">No FAQs available</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item, idx) => {
              const isOpen = openIndices.has(idx);
              const buttonId = `${id}-faq-btn-${idx}`;
              const panelId = `${id}-faq-panel-${idx}`;

              return (
                <div
                  key={idx}
                  className={`border border-slate-200/90 bg-white overflow-hidden transition-colors shadow-2xs ${cardRadius}`}
                >
                  <h3>
                    <button
                      id={buttonId}
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      className="w-full flex items-center justify-between p-4 sm:p-5 text-left text-sm sm:text-base font-semibold text-slate-900 hover:bg-slate-50/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 transition-colors"
                      onClick={() => toggleIndex(idx)}
                    >
                      <span className="pr-4">{item.question}</span>
                      <ChevronDownIcon
                        size={18}
                        className={`shrink-0 text-slate-400 transition-transform duration-200 ${
                          isOpen ? "rotate-180 text-emerald-700" : ""
                        }`}
                      />
                    </button>
                  </h3>

                  {isOpen && (
                    <div
                      id={panelId}
                      role="region"
                      aria-labelledby={buttonId}
                      className="px-4 pb-5 sm:px-5 sm:pb-6 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3"
                    >
                      <p>{item.answer}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
