import React, { forwardRef } from "react";

export type NavVariant = "horizontal" | "vertical" | "bottom-bar";

export interface NavProps extends React.HTMLAttributes<HTMLElement> {
  variant?: NavVariant;
  "aria-label": string;
}

/**
 * Accessible Navigation Landmark Primitive
 *
 * Implements accessible navigation landmark with required aria-label to distinguish
 * multiple navigation areas (e.g., Primary Nav, Mobile Bottom Nav, Utility Nav).
 */
export const Nav = forwardRef<HTMLElement, NavProps>(
  (
    { children, variant = "horizontal", "aria-label": ariaLabel, className = "", ...props },
    ref,
  ) => {
    return (
      <nav
        ref={ref}
        aria-label={ariaLabel}
        className={`ui-nav ui-nav-${variant} ${className}`.trim()}
        {...props}
      >
        {children}
      </nav>
    );
  },
);
Nav.displayName = "Nav";

export type NavListProps = React.HTMLAttributes<HTMLUListElement>;

export const NavList = forwardRef<HTMLUListElement, NavListProps>(
  ({ children, className = "", ...props }, ref) => {
    return (
      <ul ref={ref} className={`ui-nav-list ${className}`.trim()} {...props}>
        {children}
      </ul>
    );
  },
);
NavList.displayName = "NavList";

export type NavItemProps = React.LiHTMLAttributes<HTMLLIElement>;

export const NavItem = forwardRef<HTMLLIElement, NavItemProps>(
  ({ children, className = "", ...props }, ref) => {
    return (
      <li ref={ref} className={`ui-nav-item ${className}`.trim()} {...props}>
        {children}
      </li>
    );
  },
);
NavItem.displayName = "NavItem";

export interface NavLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  isActive?: boolean;
  icon?: React.ReactNode;
}

export const NavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(
  ({ children, isActive = false, icon, className = "", ...props }, ref) => {
    return (
      <a
        ref={ref}
        aria-current={isActive ? "page" : undefined}
        className={`ui-nav-link ${isActive ? "ui-nav-link-active" : ""} ${className}`.trim()}
        {...props}
      >
        {icon && (
          <span className="ui-nav-icon" aria-hidden="true">
            {icon}
          </span>
        )}
        <span className="ui-nav-text">{children}</span>
      </a>
    );
  },
);
NavLink.displayName = "NavLink";
