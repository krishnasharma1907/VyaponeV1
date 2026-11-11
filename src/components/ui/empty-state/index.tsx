import React, { forwardRef } from "react";

export interface EmptyStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
}

/**
 * Accessible Empty State Primitive
 *
 * Mandatory state for all list and dashboard views when zero records are present.
 * Provides clear actionable guidance to the user.
 */
export const EmptyState = forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ icon, title, description, action, secondaryAction, className = "", ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="region"
        aria-label={typeof title === "string" ? title : "Empty state"}
        className={`ui-empty-state ${className}`.trim()}
        {...props}
      >
        {icon && (
          <div className="ui-empty-state-icon" aria-hidden="true">
            {icon}
          </div>
        )}
        <h3 className="ui-empty-state-title">{title}</h3>
        {description && <p className="ui-empty-state-description">{description}</p>}
        {(action || secondaryAction) && (
          <div className="ui-empty-state-actions">
            {action}
            {secondaryAction}
          </div>
        )}
      </div>
    );
  },
);

EmptyState.displayName = "EmptyState";
