import React, { forwardRef } from "react";

export type BadgeVariant =
  "default" | "primary" | "accent" | "success" | "warning" | "danger" | "info";

export type BadgeSize = "sm" | "md";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: React.ReactNode;
}

/**
 * Accessible Badge Primitive
 *
 * Provides status and category tags. Adheres to WCAG 2.2 AA:
 * information is never conveyed by color alone; visible label text is required.
 */
export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ children, variant = "default", size = "md", icon, className = "", ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={`ui-badge ui-badge-${variant} ui-badge-${size} ${className}`.trim()}
        {...props}
      >
        {icon && (
          <span className="ui-badge-icon" aria-hidden="true">
            {icon}
          </span>
        )}
        <span className="ui-badge-text">{children}</span>
      </span>
    );
  },
);

Badge.displayName = "Badge";
