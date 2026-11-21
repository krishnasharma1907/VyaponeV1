"use client";

import React from "react";
import type { BlockComponentProps, HeroBlockProps } from "./types";
import { WhatsAppIcon, PhoneIcon } from "./icons";
import { sanitizeLinkUrl, getButtonRadiusClass } from "./utils";

export function HeroBlock({
  id,
  props,
  variant = "split",
  context,
  className = "",
}: BlockComponentProps<HeroBlockProps>) {
  const theme = context?.theme;
  const business = context?.business;
  const imageUrl =
    props.imageMediaId && context?.mediaUrls ? context.mediaUrls[props.imageMediaId] : undefined;
  const buttonRadius = getButtonRadiusClass(theme?.radii);

  const resolveCtaHref = (action?: string, target?: string): string => {
    if (target) return sanitizeLinkUrl(target);
    if (action === "whatsapp_order" && (business?.whatsappNumber || business?.phone)) {
      const num = (business.whatsappNumber || business.phone || "").replace(/[^0-9]/g, "");
      return `https://wa.me/${num}?text=${encodeURIComponent(`Hello, I would like to place an order from ${business.name || "your store"}.`)}`;
    }
    if (action === "phone_call" && business?.phone) {
      return `tel:${business.phone.replace(/[^0-9+]/g, "")}`;
    }
    if (action === "catalogue") return "#items";
    if (action === "enquiry" || action === "booking") return "#contact";
    return "#";
  };

  const primaryHref = resolveCtaHref(props.cta?.action, props.cta?.target);
  const secondaryHref = resolveCtaHref(props.secondaryCta?.action, props.secondaryCta?.target);

  const isCenter = variant === "center";
  const isPhotoLeft = variant === "photo-left";

  return (
    <section
      id={id}
      data-block-type="hero"
      aria-labelledby={`${id}-title`}
      className={`relative w-full py-12 md:py-20 lg:py-24 px-4 sm:px-6 lg:px-8 overflow-hidden ${className}`.trim()}
      style={{
        backgroundColor: theme?.colors.background || "#FFFFFF",
        color: theme?.colors.text || "#0F172A",
      }}
    >
      <div className="max-w-7xl mx-auto">
        <div
          className={`flex flex-col gap-8 md:gap-12 items-center ${
            isCenter
              ? "text-center max-w-3xl mx-auto"
              : isPhotoLeft
                ? "md:flex-row-reverse text-left"
                : "md:flex-row text-left"
          }`}
        >
          {/* Text Content */}
          <div className="flex-1 space-y-4 md:space-y-6">
            <h1
              id={`${id}-title`}
              className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight"
              style={{
                fontFamily: theme?.fonts.heading || "Inter, sans-serif",
                color: theme?.colors.text || "#0F172A",
              }}
            >
              {props.title}
            </h1>

            {props.subtitle && (
              <p
                className="text-lg sm:text-xl md:text-2xl font-normal leading-relaxed max-w-2xl"
                style={{
                  fontFamily: theme?.fonts.body || "Inter, sans-serif",
                  color: theme?.colors.muted || "#64748B",
                }}
              >
                {props.subtitle}
              </p>
            )}

            {/* CTAs */}
            {(props.cta || props.secondaryCta) && (
              <div
                className={`pt-2 flex flex-wrap gap-4 items-center ${
                  isCenter ? "justify-center" : "justify-start"
                }`}
              >
                {props.cta && (
                  <a
                    href={primaryHref}
                    target={props.cta.target ? "_blank" : undefined}
                    rel={props.cta.target ? "noopener noreferrer" : undefined}
                    className={`inline-flex items-center justify-center gap-2 px-6 py-3.5 text-base font-semibold text-white shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${buttonRadius}`}
                    style={{
                      backgroundColor: theme?.colors.primary || "#0B6E4F",
                    }}
                    onClick={() =>
                      context?.onAction?.(props.cta!.action, { source: "hero_primary" })
                    }
                  >
                    {props.cta.action === "whatsapp_order" && <WhatsAppIcon size={18} />}
                    {props.cta.action === "phone_call" && <PhoneIcon size={18} />}
                    <span>{props.cta.label}</span>
                  </a>
                )}

                {props.secondaryCta && (
                  <a
                    href={secondaryHref}
                    target={props.secondaryCta.target ? "_blank" : undefined}
                    rel={props.secondaryCta.target ? "noopener noreferrer" : undefined}
                    className={`inline-flex items-center justify-center gap-2 px-6 py-3.5 text-base font-semibold border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${buttonRadius}`}
                    style={{
                      borderColor: theme?.colors.muted || "#CBD5E1",
                      color: theme?.colors.text || "#0F172A",
                      backgroundColor: "transparent",
                    }}
                    onClick={() =>
                      context?.onAction?.(props.secondaryCta!.action, { source: "hero_secondary" })
                    }
                  >
                    <span>{props.secondaryCta.label}</span>
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Optional Media Image */}
          {imageUrl && (
            <div className="flex-1 w-full max-w-md md:max-w-none">
              <div className="relative aspect-4/3 sm:aspect-16/10 rounded-2xl overflow-hidden shadow-lg border border-slate-200/60 bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt={props.title}
                  className="w-full h-full object-cover"
                  loading="eager"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
