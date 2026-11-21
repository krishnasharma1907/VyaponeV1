import React from "react";
import Link from "next/link";

/**
 * VyapOne — Public Storefront Fail-Closed Not Found View [VO-042]
 *
 * Rendered when a requested storefront is unknown, unpublished, suspended, or archived.
 * Strictly adheres to security invariants:
 * - Never reveals private tenant names, owner IDs, workspace metadata, or draft states.
 * - Mobile-first, fully responsive (320px, 390px, 768px+).
 * - Meets WCAG 2.2 AA accessibility standards.
 */

export interface StorefrontNotFoundProps {
  subdomain?: string;
}

export function StorefrontNotFound({ subdomain: _subdomain }: StorefrontNotFoundProps) {
  return (
    <div className="w-full min-h-[60vh] flex items-center justify-center px-4 py-16 sm:py-24">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Visual Badge */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 text-slate-500 mb-2">
          <svg
            className="w-8 h-8"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
            />
          </svg>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Storefront Unavailable
          </h1>
          <p className="text-sm sm:text-base text-slate-600">
            The website you are looking for is not published or is currently unavailable.
          </p>
        </div>

        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-md text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 transition-colors shadow-xs"
          >
            Return to VyapOne Home
          </Link>
        </div>
      </div>
    </div>
  );
}
