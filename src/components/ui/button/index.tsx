"use client";

import React, { forwardRef } from "react";

export type ButtonVariant =
  "primary" | "secondary" | "outline" | "ghost" | "destructive" | "accent";

export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  loadingText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

/**
 * Accessible Button Primitive
 *
 * Implements WCAG 2.2 AA compliant touch targets (44px md, 48px lg, 24px+ sm).
 * Prevents multiple form submissions during loading by disabling pointer events
 * and managing aria-busy state.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = "primary",
      size = "md",
      isLoading = false,
      loadingText,
      leftIcon,
      rightIcon,
      disabled,
      type = "button",
      className = "",
      style,
      onClick,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || isLoading;

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (isDisabled) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      onClick?.(e);
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-disabled={isDisabled ? "true" : undefined}
        aria-busy={isLoading ? "true" : undefined}
        onClick={handleClick}
        className={`ui-btn ui-btn-${variant} ui-btn-${size} ${isLoading ? "ui-btn-loading" : ""} ${className}`.trim()}
        style={style}
        {...props}
      >
        {isLoading && (
          <span className="ui-btn-spinner" aria-hidden="true" data-testid="button-spinner" />
        )}
        {!isLoading && leftIcon && (
          <span className="ui-btn-icon ui-btn-icon-left" aria-hidden="true">
            {leftIcon}
          </span>
        )}
        <span className="ui-btn-text">{isLoading && loadingText ? loadingText : children}</span>
        {!isLoading && rightIcon && (
          <span className="ui-btn-icon ui-btn-icon-right" aria-hidden="true">
            {rightIcon}
          </span>
        )}
      </button>
    );
  },
);

Button.displayName = "Button";
