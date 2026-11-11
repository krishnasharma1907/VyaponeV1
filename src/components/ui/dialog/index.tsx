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

interface DialogContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titleId: string;
  descriptionId: string;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

const DialogContext = createContext<DialogContextValue | null>(null);

export function useDialogContext() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error("Dialog compound components must be rendered within a <Dialog> provider.");
  }
  return context;
}

export interface DialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

/**
 * Accessible Modal Dialog Component
 *
 * Implements WAI-ARIA Dialog (Modal) pattern:
 * - Traps keyboard focus inside dialog when open.
 * - Restores focus to the trigger element upon closing.
 * - Dismisses on Escape key.
 * - Prevents background scrolling when open.
 */
export function Dialog({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange: controlledOnOpenChange,
  children,
}: DialogProps) {
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
  const titleId = `dialog-title-${autoId}`;
  const descriptionId = `dialog-desc-${autoId}`;
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  return (
    <DialogContext.Provider
      value={{
        open,
        onOpenChange,
        titleId,
        descriptionId,
        triggerRef,
      }}
    >
      {children}
    </DialogContext.Provider>
  );
}

export interface DialogTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

export const DialogTrigger = forwardRef<HTMLButtonElement, DialogTriggerProps>(
  ({ children, onClick, className = "", ...props }, ref) => {
    const { open, onOpenChange, triggerRef } = useDialogContext();

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
        className={`ui-dialog-trigger ${className}`.trim()}
        {...props}
      >
        {children}
      </button>
    );
  },
);
DialogTrigger.displayName = "DialogTrigger";

export interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  closeOnEscape?: boolean;
  closeOnBackdropClick?: boolean;
}

export const DialogContent = forwardRef<HTMLDivElement, DialogContentProps>(
  (
    { children, closeOnEscape = true, closeOnBackdropClick = true, className = "", ...props },
    ref,
  ) => {
    const { open, onOpenChange, titleId, descriptionId, triggerRef } = useDialogContext();
    const contentRef = useRef<HTMLDivElement | null>(null);

    // Escape key listener & focus trapping
    useEffect(() => {
      if (!open) return;

      const triggerNode = (triggerRef.current || document.activeElement) as HTMLElement | null;

      const handleKeyDown = (e: KeyboardEvent) => {
        if (closeOnEscape && e.key === "Escape") {
          e.preventDefault();
          onOpenChange(false);
          return;
        }

        // Focus trap
        if (e.key === "Tab" && contentRef.current) {
          const focusable = Array.from(
            contentRef.current.querySelectorAll<HTMLElement>(
              'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
            ),
          );
          if (focusable.length === 0) {
            e.preventDefault();
            contentRef.current.focus();
            return;
          }

          const first = focusable[0];
          const last = focusable[focusable.length - 1];

          if (!contentRef.current.contains(document.activeElement)) {
            e.preventDefault();
            first.focus();
          } else if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      };

      document.addEventListener("keydown", handleKeyDown);

      // Lock body scroll
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      // Focus first focusable element inside modal
      const focusInitial = () => {
        if (!contentRef.current) return;
        const focusable = contentRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length > 0) {
          focusable[0].focus();
        } else {
          contentRef.current.focus();
        }
      };

      focusInitial();
      const timer = setTimeout(focusInitial, 0);

      return () => {
        document.removeEventListener("keydown", handleKeyDown);
        document.body.style.overflow = prevOverflow;
        clearTimeout(timer);
        // Restore focus to trigger
        triggerNode?.focus();
      };
    }, [open, closeOnEscape, onOpenChange, triggerRef]);

    if (!open) return null;

    return (
      <div
        className="ui-dialog-backdrop"
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
          className={`ui-dialog-content ${className}`.trim()}
          {...props}
        >
          {children}
        </div>
      </div>
    );
  },
);
DialogContent.displayName = "DialogContent";

export function DialogHeader({
  children,
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`ui-dialog-header ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}

export function DialogTitle({
  children,
  className = "",
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  const { titleId } = useDialogContext();
  return (
    <h2 id={titleId} className={`ui-dialog-title ${className}`.trim()} {...props}>
      {children}
    </h2>
  );
}

export function DialogDescription({
  children,
  className = "",
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  const { descriptionId } = useDialogContext();
  return (
    <p id={descriptionId} className={`ui-dialog-description ${className}`.trim()} {...props}>
      {children}
    </p>
  );
}

export function DialogFooter({
  children,
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`ui-dialog-footer ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}

export function DialogClose({
  children,
  onClick,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { onOpenChange } = useDialogContext();

  return (
    <button
      type="button"
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) {
          onOpenChange(false);
        }
      }}
      className={`ui-dialog-close ${className}`.trim()}
      aria-label={children ? undefined : "Close dialog"}
      {...props}
    >
      {children || <span aria-hidden="true">&times;</span>}
    </button>
  );
}
