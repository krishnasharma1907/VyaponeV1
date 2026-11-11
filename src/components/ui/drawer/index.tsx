"use client";

import React, {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
} from "react";

interface DrawerContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titleId: string;
  descriptionId: string;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

const DrawerContext = createContext<DrawerContextValue | null>(null);

export function useDrawerContext() {
  const context = useContext(DrawerContext);
  if (!context) {
    throw new Error("Drawer compound components must be rendered within a <Drawer> provider.");
  }
  return context;
}

export interface DrawerProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

/**
 * Accessible Drawer / Bottom-Sheet Component
 *
 * Tailored for mobile viewports (390px) and merchant counter POS usage.
 * Slides up from the bottom with focus management and backdrop dismiss.
 */
export function Drawer({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange: controlledOnOpenChange,
  children,
}: DrawerProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const onOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(nextOpen);
      }
      controlledOnOpenChange?.(nextOpen);
    },
    [isControlled, controlledOnOpenChange],
  );

  const autoId = useId();
  const titleId = `drawer-title-${autoId}`;
  const descriptionId = `drawer-desc-${autoId}`;
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  return (
    <DrawerContext.Provider
      value={{
        open,
        onOpenChange,
        titleId,
        descriptionId,
        triggerRef,
      }}
    >
      {children}
    </DrawerContext.Provider>
  );
}

export type DrawerTriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

export const DrawerTrigger = forwardRef<HTMLButtonElement, DrawerTriggerProps>(
  ({ children, onClick, className = "", ...props }, ref) => {
    const { open, onOpenChange, triggerRef } = useDrawerContext();

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(e);
      if (!e.defaultPrevented) {
        onOpenChange(!open);
      }
    };

    return (
      <button
        ref={(node) => {
          triggerRef.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
        }}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={handleClick}
        className={`ui-drawer-trigger ${className}`.trim()}
        {...props}
      >
        {children}
      </button>
    );
  },
);
DrawerTrigger.displayName = "DrawerTrigger";

export interface DrawerContentProps extends React.HTMLAttributes<HTMLDivElement> {
  closeOnEscape?: boolean;
  closeOnBackdropClick?: boolean;
}

export const DrawerContent = forwardRef<HTMLDivElement, DrawerContentProps>(
  (
    { children, closeOnEscape = true, closeOnBackdropClick = true, className = "", ...props },
    ref,
  ) => {
    const { open, onOpenChange, titleId, descriptionId, triggerRef } = useDrawerContext();
    const contentRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
      if (!open) return;

      const triggerNode = triggerRef.current;

      const handleKeyDown = (e: KeyboardEvent) => {
        if (closeOnEscape && e.key === "Escape") {
          e.preventDefault();
          onOpenChange(false);
          return;
        }

        // Focus trap
        if (e.key === "Tab" && contentRef.current) {
          const focusable = contentRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
          );
          if (focusable.length === 0) return;

          const first = focusable[0];
          const last = focusable[focusable.length - 1];

          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      };

      document.addEventListener("keydown", handleKeyDown);
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      const timer = setTimeout(() => {
        if (contentRef.current) {
          const focusable = contentRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
          );
          if (focusable.length > 0) focusable[0].focus();
          else contentRef.current.focus();
        }
      }, 20);

      return () => {
        document.removeEventListener("keydown", handleKeyDown);
        document.body.style.overflow = prevOverflow;
        clearTimeout(timer);
        triggerNode?.focus();
      };
    }, [open, closeOnEscape, onOpenChange, triggerRef]);

    if (!open) return null;

    return (
      <div
        className="ui-drawer-backdrop"
        onClick={(e) => {
          if (closeOnBackdropClick && e.target === e.currentTarget) {
            onOpenChange(false);
          }
        }}
      >
        <div
          ref={(node) => {
            contentRef.current = node;
            if (typeof ref === "function") ref(node);
            else if (ref) ref.current = node;
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          tabIndex={-1}
          className={`ui-drawer-content ${className}`.trim()}
          {...props}
        >
          <div className="ui-drawer-handle" aria-hidden="true" />
          {children}
        </div>
      </div>
    );
  },
);
DrawerContent.displayName = "DrawerContent";

export function DrawerHeader({
  children,
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`ui-drawer-header ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}

export function DrawerTitle({
  children,
  className = "",
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  const { titleId } = useDrawerContext();
  return (
    <h2 id={titleId} className={`ui-drawer-title ${className}`.trim()} {...props}>
      {children}
    </h2>
  );
}

export function DrawerDescription({
  children,
  className = "",
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  const { descriptionId } = useDrawerContext();
  return (
    <p id={descriptionId} className={`ui-drawer-description ${className}`.trim()} {...props}>
      {children}
    </p>
  );
}

export function DrawerFooter({
  children,
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`ui-drawer-footer ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}

export function DrawerClose({
  children,
  onClick,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { onOpenChange } = useDrawerContext();

  return (
    <button
      type="button"
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) {
          onOpenChange(false);
        }
      }}
      className={`ui-drawer-close ${className}`.trim()}
      aria-label={children ? undefined : "Close drawer"}
      {...props}
    >
      {children || <span aria-hidden="true">&times;</span>}
    </button>
  );
}
