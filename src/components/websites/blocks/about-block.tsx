"use client";

import React from "react";
import type { BlockComponentProps, AboutBlockProps } from "./types";
import { CheckCircleIcon } from "./icons";
import { getCardRadiusClass } from "./utils";

export function AboutBlock({
  id,
  props,
  variant = "split",
  context,
  className = "",
}: BlockComponentProps<AboutBlockProps>) {
  const theme = context?.theme;
  const imageUrl =
    props.imageMediaId && context?.mediaUrls ? context.mediaUrls[props.imageMediaId] : undefined;
  const cardRadius = getCardRadiusClass(theme?.radii);

  // Split story into readable paragraphs safely without HTML injection
  const paragraphs = props.story
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const isCentered = variant === "centered";

  return (
    <section
      id={id}
      data-block-type="about"
      aria-labelledby={`${id}-title`}
      className={`w-full py-12 md:py-16 px-4 sm:px-6 lg:px-8 ${className}`.trim()}
      style={{
        backgroundColor: theme?.colors.surface || "#F8FAFC",
        color: theme?.colors.text || "#0F172A",
      }}
    >
      <div className="max-w-7xl mx-auto">
        <div
          className={`flex flex-col gap-8 md:gap-12 ${
            isCentered
              ? "max-w-3xl mx-auto text-center"
              : imageUrl
                ? "md:flex-row items-center"
                : "max-w-4xl mx-auto"
          }`}
        >
          {/* Main Story & Highlights */}
          <div className="flex-1 space-y-6">
            <div className="space-y-2">
              <span
                className="text-xs font-bold tracking-wider uppercase"
                style={{ color: theme?.colors.accent || "#D97706" }}
              >
                Our Story
              </span>
              <h2
                id={`${id}-title`}
                className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight"
                style={{ fontFamily: theme?.fonts.heading || "Inter, sans-serif" }}
              >
                {props.title}
              </h2>
            </div>

            <div
              className="space-y-4 text-base sm:text-lg leading-relaxed"
              style={{
                fontFamily: theme?.fonts.body || "Inter, sans-serif",
                color: theme?.colors.muted || "#475569",
              }}
            >
              {paragraphs.map((p, idx) => (
                <p key={idx}>{p}</p>
              ))}
            </div>

            {/* Highlights Chips / Badges */}
            {props.highlights && props.highlights.length > 0 && (
              <div className="pt-2">
                <h3 className="sr-only">Key Highlights</h3>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {props.highlights.map((highlight, idx) => (
                    <li
                      key={idx}
                      className={`flex items-start gap-2.5 p-3 bg-white/80 border border-slate-200/80 shadow-xs ${cardRadius}`}
                    >
                      <CheckCircleIcon
                        size={20}
                        className="shrink-0 mt-0.5"
                        style={{ color: theme?.colors.primary || "#0B6E4F" }}
                      />
                      <span className="text-sm font-medium text-slate-800 leading-snug">
                        {highlight}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Optional Image */}
          {imageUrl && (
            <div className="flex-1 w-full max-w-md md:max-w-none">
              <div
                className={`relative aspect-4/3 rounded-2xl overflow-hidden shadow-md border border-slate-200 bg-slate-100 ${cardRadius}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt={props.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
