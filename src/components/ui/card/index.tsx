import React, { forwardRef } from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "elevated" | "glass" | "subtle";
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ children, variant = "default", className = "", ...props }, ref) => {
    return (
      <div ref={ref} className={`ui-card ui-card-${variant} ${className}`.trim()} {...props}>
        {children}
      </div>
    );
  },
);
Card.displayName = "Card";

export type CardHeaderProps = React.HTMLAttributes<HTMLDivElement>;

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ children, className = "", ...props }, ref) => {
    return (
      <div ref={ref} className={`ui-card-header ${className}`.trim()} {...props}>
        {children}
      </div>
    );
  },
);
CardHeader.displayName = "CardHeader";

export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
}

export const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ children, as: Component = "h3", className = "", ...props }, ref) => {
    return (
      <Component ref={ref} className={`ui-card-title ${className}`.trim()} {...props}>
        {children}
      </Component>
    );
  },
);
CardTitle.displayName = "CardTitle";

export type CardDescriptionProps = React.HTMLAttributes<HTMLParagraphElement>;

export const CardDescription = forwardRef<HTMLParagraphElement, CardDescriptionProps>(
  ({ children, className = "", ...props }, ref) => {
    return (
      <p ref={ref} className={`ui-card-description ${className}`.trim()} {...props}>
        {children}
      </p>
    );
  },
);
CardDescription.displayName = "CardDescription";

export type CardContentProps = React.HTMLAttributes<HTMLDivElement>;

export const CardContent = forwardRef<HTMLDivElement, CardContentProps>(
  ({ children, className = "", ...props }, ref) => {
    return (
      <div ref={ref} className={`ui-card-content ${className}`.trim()} {...props}>
        {children}
      </div>
    );
  },
);
CardContent.displayName = "CardContent";

export type CardFooterProps = React.HTMLAttributes<HTMLDivElement>;

export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ children, className = "", ...props }, ref) => {
    return (
      <div ref={ref} className={`ui-card-footer ${className}`.trim()} {...props}>
        {children}
      </div>
    );
  },
);
CardFooter.displayName = "CardFooter";

export type CardActionProps = React.HTMLAttributes<HTMLDivElement>;

export const CardAction = forwardRef<HTMLDivElement, CardActionProps>(
  ({ children, className = "", ...props }, ref) => {
    return (
      <div ref={ref} className={`ui-card-action ${className}`.trim()} {...props}>
        {children}
      </div>
    );
  },
);
CardAction.displayName = "CardAction";
