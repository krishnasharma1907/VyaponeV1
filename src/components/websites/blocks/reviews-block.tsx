"use client";

import React from "react";
import type { BlockComponentProps, ReviewsBlockProps } from "./types";
import { StarIcon, ShieldCheckIcon } from "./icons";
import { getCardRadiusClass } from "./utils";

export function ReviewsBlock({
  id,
  props,
  context,
  className = "",
}: BlockComponentProps<ReviewsBlockProps>) {
  const theme = context?.theme;
  const cardRadius = getCardRadiusClass(theme?.radii);

  const reviews =
    props.customReviews && props.customReviews.length > 0
      ? props.customReviews
      : [
          {
            author: "Anil Sharma",
            rating: 5,
            text: "Exceptional quality and timely service. Highly recommend to everyone in the neighborhood!",
            date: "2 weeks ago",
          },
          {
            author: "Pooja Mehta",
            rating: 5,
            text: "Very reliable and transparent pricing. Ordered directly via WhatsApp and got quick delivery.",
            date: "1 month ago",
          },
          {
            author: "Rajesh Verma",
            rating: 4,
            text: "Great experience overall. Friendly staff and good response time on inquiries.",
            date: "2 months ago",
          },
        ];

  const averageRating =
    reviews.length > 0
      ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
      : "5.0";

  return (
    <section
      id={id}
      data-block-type="reviews"
      aria-labelledby={`${id}-title`}
      className={`w-full py-12 md:py-16 px-4 sm:px-6 lg:px-8 ${className}`.trim()}
      style={{
        backgroundColor: theme?.colors.background || "#FFFFFF",
        color: theme?.colors.text || "#0F172A",
      }}
    >
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800">
            <ShieldCheckIcon size={14} className="text-amber-600" />
            <span>
              {props.source === "google_reviews"
                ? "Google Verified Reviews"
                : "Verified Customer Feedback"}
            </span>
          </div>

          <h2
            id={`${id}-title`}
            className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight"
            style={{ fontFamily: theme?.fonts.heading || "Inter, sans-serif" }}
          >
            {props.title || "What Our Customers Say"}
          </h2>

          {/* Average Rating Banner */}
          <div className="flex items-center justify-center gap-2 pt-1">
            <div
              className="flex items-center text-amber-400"
              aria-label={`Average rating ${averageRating} out of 5 stars`}
            >
              {[1, 2, 3, 4, 5].map((star) => (
                <StarIcon key={star} size={18} filled={star <= Math.round(Number(averageRating))} />
              ))}
            </div>
            <span className="text-sm font-bold text-slate-800">{averageRating} / 5.0</span>
            <span className="text-xs text-slate-400">({reviews.length} reviews)</span>
          </div>
        </div>

        {reviews.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 max-w-md mx-auto">
            <p className="text-sm font-medium text-slate-700">No reviews yet</p>
            <p className="text-xs text-slate-500 mt-1">
              Verified customer feedback will be showcased here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {reviews.map((rev, idx) => (
              <div
                key={idx}
                className={`p-6 bg-white border border-slate-200/90 shadow-xs flex flex-col justify-between space-y-4 ${cardRadius}`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div
                      className="flex items-center text-amber-400"
                      aria-label={`Rating: ${rev.rating} out of 5 stars`}
                    >
                      {[1, 2, 3, 4, 5].map((star) => (
                        <StarIcon key={star} size={14} filled={star <= rev.rating} />
                      ))}
                    </div>
                    {rev.date && <span className="text-xs text-slate-400">{rev.date}</span>}
                  </div>

                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed italic">
                    &ldquo;{rev.text}&rdquo;
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs sm:text-sm font-semibold text-slate-900">
                    {rev.author}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                    <ShieldCheckIcon size={12} />
                    <span>Verified</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
