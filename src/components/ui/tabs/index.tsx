"use client";

import React, { createContext, forwardRef, useCallback, useContext, useId, useRef } from "react";

interface TabsContextValue {
  value: string;
  onValueChange: (value: string) => void;
  baseId: string;
  orientation: "horizontal" | "vertical";
}

const TabsContext = createContext<TabsContextValue | null>(null);

export function useTabsContext() {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error("Tabs compound components must be rendered within a <Tabs> provider.");
  }
  return context;
}

export interface TabsProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  orientation?: "horizontal" | "vertical";
  className?: string;
  children: React.ReactNode;
}

/**
 * Accessible Tabs Primitive
 *
 * Implements WAI-ARIA Tabs pattern:
 * - Proper roles: tablist, tab, tabpanel.
 * - ARIA states: aria-selected, aria-controls, aria-labelledby.
 * - Keyboard navigation: ArrowLeft/ArrowRight (horizontal) or ArrowUp/ArrowDown (vertical),
 *   Home (first tab), End (last tab).
 */
export function Tabs({
  value: controlledValue,
  defaultValue = "",
  onValueChange: controlledOnValueChange,
  orientation = "horizontal",
  className = "",
  children,
}: TabsProps) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue);
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : uncontrolledValue;

  const onValueChange = useCallback(
    (nextValue: string) => {
      if (!isControlled) {
        setUncontrolledValue(nextValue);
      }
      controlledOnValueChange?.(nextValue);
    },
    [isControlled, controlledOnValueChange],
  );

  const baseId = useId();

  return (
    <TabsContext.Provider
      value={{
        value,
        onValueChange,
        baseId,
        orientation,
      }}
    >
      <div
        className={`ui-tabs ui-tabs-${orientation} ${className}`.trim()}
        data-orientation={orientation}
      >
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export interface TabsListProps extends React.HTMLAttributes<HTMLDivElement> {
  "aria-label"?: string;
}

export const TabsList = forwardRef<HTMLDivElement, TabsListProps>(
  ({ children, className = "", "aria-label": ariaLabel, ...props }, ref) => {
    const { orientation } = useTabsContext();
    const listRef = useRef<HTMLDivElement | null>(null);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      const tabs = Array.from(
        (listRef.current || e.currentTarget).querySelectorAll<HTMLButtonElement>(
          'button[role="tab"]:not([disabled])',
        ),
      );
      if (tabs.length === 0) return;

      const currentIndex = tabs.findIndex(
        (tab) => tab === document.activeElement || tab.contains(document.activeElement),
      );
      if (currentIndex === -1) return;

      const isHorizontal = orientation === "horizontal";
      const prevKey = isHorizontal ? "ArrowLeft" : "ArrowUp";
      const nextKey = isHorizontal ? "ArrowRight" : "ArrowDown";

      let nextIndex = currentIndex;
      if (e.key === nextKey) {
        e.preventDefault();
        nextIndex = (currentIndex + 1) % tabs.length;
      } else if (e.key === prevKey) {
        e.preventDefault();
        nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      } else if (e.key === "Home") {
        e.preventDefault();
        nextIndex = 0;
      } else if (e.key === "End") {
        e.preventDefault();
        nextIndex = tabs.length - 1;
      } else {
        return;
      }

      tabs[nextIndex].focus();
      tabs[nextIndex].click();
    };

    return (
      <div
        ref={(node) => {
          listRef.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
        }}
        role="tablist"
        aria-orientation={orientation}
        aria-label={ariaLabel}
        onKeyDown={handleKeyDown}
        className={`ui-tabs-list ${className}`.trim()}
        {...props}
      >
        {children}
      </div>
    );
  },
);
TabsList.displayName = "TabsList";

export interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

export const TabsTrigger = forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ value: tabValue, children, disabled, className = "", onClick, ...props }, ref) => {
    const { value, onValueChange, baseId } = useTabsContext();
    const isSelected = value === tabValue;
    const tabId = `${baseId}-tab-${tabValue}`;
    const panelId = `${baseId}-panel-${tabValue}`;

    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        id={tabId}
        disabled={disabled}
        aria-selected={isSelected}
        aria-controls={panelId}
        tabIndex={isSelected ? 0 : -1}
        onClick={(e) => {
          onClick?.(e);
          if (!disabled) {
            onValueChange(tabValue);
          }
        }}
        className={`ui-tabs-trigger ${isSelected ? "ui-tabs-trigger-active" : ""} ${className}`.trim()}
        {...props}
      >
        {children}
      </button>
    );
  },
);
TabsTrigger.displayName = "TabsTrigger";

export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

export const TabsContent = forwardRef<HTMLDivElement, TabsContentProps>(
  ({ value: tabValue, children, className = "", ...props }, ref) => {
    const { value, baseId } = useTabsContext();
    const isSelected = value === tabValue;
    const tabId = `${baseId}-tab-${tabValue}`;
    const panelId = `${baseId}-panel-${tabValue}`;

    if (!isSelected) return null;

    return (
      <div
        ref={ref}
        role="tabpanel"
        id={panelId}
        aria-labelledby={tabId}
        tabIndex={0}
        className={`ui-tabs-content ${className}`.trim()}
        {...props}
      >
        {children}
      </div>
    );
  },
);
TabsContent.displayName = "TabsContent";
