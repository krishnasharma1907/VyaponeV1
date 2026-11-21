"use client";

import React from "react";
import type { BlockComponentProps, FooterBlockProps } from "./types";
import { WhatsAppIcon, ExternalLinkIcon } from "./icons";
import { sanitizeLinkUrl } from "./utils";

export function FooterBlock({
  id,
  props,
  context,
  className = "",
}: BlockComponentProps<FooterBlockProps>) {
  const theme = context?.theme;
  const business = context?.business;
  const currentYear = new Date().getFullYear();

  const copyrightText =
    props.copyright ||
    `© ${currentYear} ${business?.tradeName || business?.name || "VyapOne Business"}. All rights reserved.`;

  return (
    <footer
      id={id}
      data-block-type="footer"
      role="contentinfo"
      className={`w-full py-12 px-4 sm:px-6 lg:px-8 border-t border-slate-200/80 ${className}`.trim()}
      style={{
        backgroundColor: theme?.colors.surface || "#F8FAFC",
        color: theme?.colors.text || "#0F172A",
      }}
    >
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Brand & Copyright */}
        <div className="flex flex-col items-center md:items-start gap-2 text-center md:text-left">
          <span className="text-base font-extrabold tracking-tight text-slate-900">
            {business?.tradeName || business?.name || "VyapOne"}
          </span>
          <p className="text-xs text-slate-500">{copyrightText}</p>
        </div>

        {/* Footer Navigation Links */}
        {props.links && props.links.length > 0 && (
          <nav aria-label="Footer Navigation">
            <ul className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs font-medium text-slate-600">
              {props.links.map((link, idx) => (
                <li key={idx}>
                  <a
                    href={sanitizeLinkUrl(link.href)}
                    className="hover:text-slate-900 transition-colors hover:underline"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}

        {/* Social Links & Powered-by Badge */}
        <div className="flex flex-col sm:flex-row items-center gap-4">
          {props.socialLinks && props.socialLinks.length > 0 && (
            <ul className="flex items-center gap-3" aria-label="Social Media Links">
              {props.socialLinks.map((s, idx) => {
                const safeUrl = sanitizeLinkUrl(s.url);
                return (
                  <li key={idx}>
                    <a
                      href={safeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={s.platform}
                      className="p-2 rounded-full bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-colors inline-flex items-center justify-center"
                    >
                      {s.platform === "whatsapp" ? (
                        <WhatsAppIcon size={16} />
                      ) : (
                        <ExternalLinkIcon size={14} title={s.platform} />
                      )}
                    </a>
                  </li>
                );
              })}
            </ul>
          )}

          {props.showPoweredBy && (
            <div className="text-center sm:text-right">
              <a
                href="https://vyapone.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-semibold text-slate-700 bg-white border border-slate-200/90 rounded-full hover:bg-slate-50 transition-colors shadow-2xs"
              >
                <span>Powered by</span>
                <span className="font-extrabold tracking-tight" style={{ color: "#0B6E4F" }}>
                  VyapOne
                </span>
              </a>
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
