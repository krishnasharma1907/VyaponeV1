import React, { forwardRef } from "react";

export type SkeletonVariant = "text" | "circular" | "rectangular";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: SkeletonVariant;
  width?: string | number;
  height?: string | number;
}

/**
 * Accessible Skeleton Loader Primitive
 *
 * Implements aria-hidden="true" so screen readers ignore placeholder loading blocks.
 * Loading state should be announced at the parent container level via aria-busy.
 */
export const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(
  ({ variant = "text", width, height, style, className = "", ...props }, ref) => {
    const inlineStyle: React.CSSProperties = {
      ...style,
      ...(width !== undefined ? { width: typeof width === "number" ? `${width}px` : width } : {}),
      ...(height !== undefined
        ? { height: typeof height === "number" ? `${height}px` : height }
        : {}),
    };

    return (
      <div
        ref={ref}
        aria-hidden="true"
        className={`ui-skeleton ui-skeleton-${variant} ${className}`.trim()}
        style={inlineStyle}
        {...props}
      />
    );
  },
);

Skeleton.displayName = "Skeleton";
