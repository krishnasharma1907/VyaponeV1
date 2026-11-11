"use client";

import React, { createContext, forwardRef, useCallback, useContext, useId, useState } from "react";

export type ToastVariant = "info" | "success" | "warning" | "error";

export interface ToastItem {
  id: string;
  title?: React.ReactNode;
  description: React.ReactNode;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastContextValue {
  toasts: ToastItem[];
  addToast: (toast: Omit<ToastItem, "id">) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a <ToastProvider>.");
  }
  return context;
}

export interface ToastProviderProps {
  children: React.ReactNode;
}

/**
 * Accessible Toast Provider & Viewport
 *
 * Implements WAI-ARIA live region for transient feedback:
 * - 'polite' for info/success/warning
 * - 'assertive' / role="alert" for errors
 * - Error toasts persist until explicitly dismissed or after extended duration.
 */
export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const autoId = useId();

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    ({ title, description, variant = "info", duration }: Omit<ToastItem, "id">) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      // Errors default to 0 (no auto-dismiss) or longer time (10s), others to 5s
      const autoDismissDuration =
        duration !== undefined ? duration : variant === "error" ? 10000 : 5000;

      const newToast: ToastItem = {
        id,
        title,
        description,
        variant,
        duration: autoDismissDuration,
      };

      setToasts((prev) => [...prev, newToast]);

      if (autoDismissDuration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, autoDismissDuration);
      }

      return id;
    },
    [removeToast],
  );

  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, clearToasts }}>
      {children}
      <aside
        id={`toast-viewport-${autoId}`}
        aria-label="Notifications"
        className="ui-toast-viewport"
      >
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
        ))}
      </aside>
    </ToastContext.Provider>
  );
}

interface ToastCardProps {
  toast: ToastItem;
  onDismiss: () => void;
}

export const ToastCard = forwardRef<HTMLDivElement, ToastCardProps>(({ toast, onDismiss }, ref) => {
  const isError = toast.variant === "error";

  return (
    <div
      ref={ref}
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      aria-atomic="true"
      className={`ui-toast ui-toast-${toast.variant || "info"}`.trim()}
    >
      <div className="ui-toast-body">
        {toast.title && <strong className="ui-toast-title">{toast.title}</strong>}
        <div className="ui-toast-desc">{toast.description}</div>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="ui-toast-close"
        aria-label="Dismiss notification"
      >
        <span aria-hidden="true">&times;</span>
      </button>
    </div>
  );
});

ToastCard.displayName = "ToastCard";
