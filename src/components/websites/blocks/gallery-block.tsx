"use client";

import React, { useState } from "react";
import type { BlockComponentProps, GalleryBlockProps } from "./types";
import { getCardRadiusClass } from "./utils";

export function GalleryBlock({
  id,
  props,
  context,
  className = "",
}: BlockComponentProps<GalleryBlockProps>) {
  const theme = context?.theme;
  const cardRadius = getCardRadiusClass(theme?.radii);
  const mediaUrls = context?.mediaUrls || {};
  const [selectedImage, setSelectedImage] = useState<{
    url: string;
    alt: string;
    caption?: string;
  } | null>(null);

  const cols = props.columns || 3;
  const gridColClass =
    cols === 2
      ? "grid-cols-1 sm:grid-cols-2"
      : cols === 4
        ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
        : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";

  return (
    <section
      id={id}
      data-block-type="gallery"
      aria-labelledby={`${id}-title`}
      className={`w-full py-12 md:py-16 px-4 sm:px-6 lg:px-8 ${className}`.trim()}
      style={{
        backgroundColor: theme?.colors.surface || "#F8FAFC",
        color: theme?.colors.text || "#0F172A",
      }}
    >
      <div className="max-w-7xl mx-auto space-y-8">
        {props.title && (
          <div className="text-center max-w-2xl mx-auto">
            <h2
              id={`${id}-title`}
              className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight"
              style={{ fontFamily: theme?.fonts.heading || "Inter, sans-serif" }}
            >
              {props.title}
            </h2>
          </div>
        )}

        {props.images.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-xl border border-dashed border-slate-300 bg-white max-w-md mx-auto">
            <p className="text-sm font-medium text-slate-700">No photos in gallery</p>
            <p className="text-xs text-slate-500 mt-1">
              Images will appear here once uploaded and attached.
            </p>
          </div>
        ) : (
          <div className={`grid ${gridColClass} gap-4 md:gap-6`}>
            {props.images.map((img, idx) => {
              const url = mediaUrls[img.mediaId] || "";
              const alt = img.altText || img.caption || `Gallery image ${idx + 1}`;
              return (
                <figure
                  key={idx}
                  className={`group relative overflow-hidden bg-white border border-slate-200/80 shadow-xs cursor-pointer ${cardRadius}`}
                  onClick={() => url && setSelectedImage({ url, alt, caption: img.caption })}
                >
                  <div className="aspect-4/3 sm:aspect-square w-full overflow-hidden bg-slate-100">
                    {url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={url}
                        alt={alt}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                        Image Preview Unavailable
                      </div>
                    )}
                  </div>

                  {img.caption && (
                    <figcaption className="p-3 text-xs sm:text-sm text-slate-700 font-medium bg-white/95">
                      {img.caption}
                    </figcaption>
                  )}
                </figure>
              );
            })}
          </div>
        )}

        {/* Accessible Lightbox Modal */}
        {selectedImage && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs"
            role="dialog"
            aria-modal="true"
            aria-label={selectedImage.alt}
            onClick={() => setSelectedImage(null)}
          >
            <div
              className="relative max-w-4xl max-h-[90vh] bg-white rounded-xl overflow-hidden shadow-2xl p-2"
              onClick={(e) => e.stopPropagation()}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedImage.url}
                alt={selectedImage.alt}
                className="max-h-[75vh] w-auto object-contain mx-auto"
              />
              <div className="p-3 text-center">
                {selectedImage.caption && (
                  <p className="text-sm font-semibold text-slate-800">{selectedImage.caption}</p>
                )}
                <button
                  type="button"
                  className="mt-2 px-4 py-1.5 text-xs font-semibold rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors"
                  onClick={() => setSelectedImage(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
