"use client";

import React from "react";
import type { BlockComponentProps, LocationMapBlockProps } from "./types";
import { MapPinIcon, ClockIcon, ExternalLinkIcon, PhoneIcon } from "./icons";
import { getButtonRadiusClass, getCardRadiusClass } from "./utils";

export function LocationMapBlock({
  id,
  props,
  context,
  className = "",
}: BlockComponentProps<LocationMapBlockProps>) {
  const theme = context?.theme;
  const business = context?.business;
  const location = business?.primaryLocation;
  const buttonRadius = getButtonRadiusClass(theme?.radii);
  const cardRadius = getCardRadiusClass(theme?.radii);

  const fullAddress = location
    ? [
        location.addressLine1,
        location.addressLine2,
        location.city,
        `${location.state} - ${location.postalCode}`,
      ]
        .filter(Boolean)
        .join(", ")
    : "Store address on file";

  const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${business?.name || ""} ${fullAddress}`,
  )}`;

  const operatingHours = location?.operatingHours || {
    "Monday - Friday": "9:30 AM - 8:30 PM",
    Saturday: "10:00 AM - 9:00 PM",
    Sunday: "10:00 AM - 6:00 PM",
  };

  return (
    <section
      id={id}
      data-block-type="location_map"
      aria-labelledby={`${id}-title`}
      className={`w-full py-12 md:py-16 px-4 sm:px-6 lg:px-8 ${className}`.trim()}
      style={{
        backgroundColor: theme?.colors.background || "#FFFFFF",
        color: theme?.colors.text || "#0F172A",
      }}
    >
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800">
            <MapPinIcon size={14} className="text-emerald-700" />
            <span>Store Location & Hours</span>
          </div>
          <h2
            id={`${id}-title`}
            className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight"
            style={{ fontFamily: theme?.fonts.heading || "Inter, sans-serif" }}
          >
            {props.title || "Visit Our Store"}
          </h2>
          <p className="text-sm sm:text-base text-slate-600">
            Conveniently located with dedicated on-site parking and friendly store staff.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          {/* Address & Timings */}
          <div
            className={`p-6 sm:p-8 bg-slate-50/70 border border-slate-200/90 shadow-xs space-y-6 ${cardRadius}`}
          >
            {/* Address */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-lg">
                <MapPinIcon size={20} className="text-emerald-700" />
                <h3>Primary Location</h3>
              </div>
              <p className="text-sm sm:text-base text-slate-700 leading-relaxed pl-7">
                {fullAddress}
              </p>
              {business?.phone && (
                <div className="pl-7 pt-1 flex items-center gap-2 text-sm text-slate-600">
                  <PhoneIcon size={16} className="text-slate-500" />
                  <a
                    href={`tel:${business.phone}`}
                    className="font-semibold text-emerald-800 hover:underline"
                  >
                    {business.phone}
                  </a>
                </div>
              )}
            </div>

            {/* Operating Hours */}
            {props.showTimings !== false && (
              <div className="space-y-3 pt-4 border-t border-slate-200">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
                  <ClockIcon size={18} className="text-emerald-700" />
                  <h4>Business Operating Hours</h4>
                </div>
                <dl className="pl-7 space-y-1.5 text-xs sm:text-sm">
                  {Object.entries(operatingHours).map(([days, hours]) => (
                    <div
                      key={days}
                      className="flex justify-between py-1 border-b border-slate-100 last:border-0"
                    >
                      <dt className="text-slate-600 font-medium">{days}</dt>
                      <dd className="text-slate-900 font-semibold">{hours}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>

          {/* Map Embed Card */}
          {props.showMap !== false && (
            <div
              className={`p-6 sm:p-8 bg-white border border-slate-200/90 shadow-xs flex flex-col justify-between space-y-6 ${cardRadius}`}
            >
              <div className="space-y-3">
                <div className="aspect-16/9 w-full bg-slate-100 rounded-lg border border-slate-200 flex flex-col items-center justify-center p-6 text-center space-y-2">
                  <MapPinIcon size={36} className="text-emerald-700 animate-bounce" />
                  <span className="text-sm font-semibold text-slate-800">
                    {business?.name || "Store Location"}
                  </span>
                  <span className="text-xs text-slate-500 max-w-xs">{fullAddress}</span>
                </div>
              </div>

              <div>
                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`w-full inline-flex items-center justify-center gap-2 py-3 px-4 text-sm font-semibold text-white shadow-xs transition-opacity hover:opacity-95 ${buttonRadius}`}
                  style={{ backgroundColor: theme?.colors.primary || "#0B6E4F" }}
                  onClick={() =>
                    context?.onAction?.("directions_clicked", { address: fullAddress })
                  }
                >
                  <ExternalLinkIcon size={16} />
                  <span>Get Directions on Google Maps</span>
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
