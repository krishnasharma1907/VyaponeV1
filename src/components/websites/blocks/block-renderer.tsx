"use client";

import React, { Component, type ReactNode } from "react";
import type { SectionConfig } from "@/lib/websites/types";
import { sectionConfigSchema } from "@/lib/websites/schemas";
import type { WebsiteRenderContext } from "./types";
import { getApprovedBlockComponent, isApprovedBlockType } from "./block-registry";

interface ErrorBoundaryProps {
  fallbackTitle: string;
  children: ReactNode;
  previewMode?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class BlockErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[BlockRenderer] Render error caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.previewMode) {
        return (
          <div
            role="alert"
            className="w-full p-4 my-2 border-2 border-dashed border-rose-300 bg-rose-50 text-rose-800 rounded-lg text-xs"
          >
            <p className="font-bold">Error rendering block: {this.props.fallbackTitle}</p>
            <p className="font-mono mt-1 text-[11px]">
              {this.state.error?.message || "Unknown error"}
            </p>
          </div>
        );
      }
      // In production, suppress crashing the page
      return null;
    }

    return this.props.children;
  }
}

export interface BlockRendererProps {
  section: SectionConfig;
  context?: WebsiteRenderContext;
  className?: string;
}

/**
 * Safe Block Renderer Component
 *
 * Validates section configuration against canonical Zod schemas, rejects
 * unapproved blocks, enforces security invariants (zero arbitrary code),
 * and isolates render errors within a boundary.
 */
export function BlockRenderer({ section, context, className = "" }: BlockRendererProps) {
  // 1. Skip disabled sections
  if (section.isEnabled === false) {
    return null;
  }

  // 2. Reject unapproved block types
  if (!isApprovedBlockType(section.type)) {
    console.warn(`[BlockRenderer] Rejected unapproved block type: "${section.type}"`);
    if (context?.previewMode) {
      return (
        <div
          role="alert"
          className="w-full p-4 my-2 border border-amber-300 bg-amber-50 text-amber-900 rounded-lg text-xs"
        >
          <span className="font-bold">Unapproved Block: </span>
          <span>
            Block type &quot;{section.type}&quot; is not part of the approved 13 canonical
            components.
          </span>
        </div>
      );
    }
    return null;
  }

  // 3. Schema validation
  const validationResult = sectionConfigSchema.safeParse(section);
  if (!validationResult.success) {
    console.warn(
      `[BlockRenderer] Section schema validation failed for "${section.id}":`,
      validationResult.error.format(),
    );
    if (context?.previewMode) {
      return (
        <div
          role="alert"
          className="w-full p-4 my-2 border border-rose-300 bg-rose-50 text-rose-900 rounded-lg text-xs"
        >
          <p className="font-bold">
            Schema Validation Error in section &quot;{section.id}&quot; ({section.type})
          </p>
          <ul className="list-disc pl-4 mt-1 space-y-0.5">
            {validationResult.error.issues.map((issue, idx) => (
              <li key={idx}>
                {issue.path.join(".")}: {issue.message}
              </li>
            ))}
          </ul>
        </div>
      );
    }
    return null;
  }

  const Component = getApprovedBlockComponent(section.type);

  return (
    <BlockErrorBoundary
      fallbackTitle={`${section.type} (${section.id})`}
      previewMode={context?.previewMode}
    >
      <Component
        id={section.id}
        props={section.props as never}
        variant={section.variant}
        context={context}
        className={className}
      />
    </BlockErrorBoundary>
  );
}
