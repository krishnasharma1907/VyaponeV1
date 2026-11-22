/**
 * VyapOne — Constrained Visual Editor History Hook [VO-047]
 *
 * Implements bounded undo/redo history for WebsiteConfiguration edits:
 * 1. Strict immutability and schema preservation (operates on valid WebsiteConfiguration).
 * 2. Bounded stack (maxDepth = 40) preventing unbounded browser memory growth.
 * 3. Irrelevant UI state (device previews, active tab, section selection) is NEVER recorded in history.
 * 4. Subsequent edits after undo correctly prune the future redo stack.
 */

import { useCallback, useState } from "react";
import type { WebsiteConfiguration } from "@/lib/websites/types";

export const DEFAULT_MAX_HISTORY_DEPTH = 40;

export interface EditorHistoryState {
  past: WebsiteConfiguration[];
  present: WebsiteConfiguration;
  future: WebsiteConfiguration[];
}

export interface UseEditorHistoryReturn {
  configuration: WebsiteConfiguration;
  canUndo: boolean;
  canRedo: boolean;
  historyLength: number;
  undo: () => WebsiteConfiguration | null;
  redo: () => WebsiteConfiguration | null;
  setConfiguration: (
    updater: WebsiteConfiguration | ((prev: WebsiteConfiguration) => WebsiteConfiguration),
    recordHistory?: boolean,
  ) => void;
  resetHistory: (newConfiguration: WebsiteConfiguration) => void;
}

/**
 * Custom React hook managing undo/redo history for website configuration drafts.
 */
export function useEditorHistory(
  initialConfiguration: WebsiteConfiguration,
  maxDepth: number = DEFAULT_MAX_HISTORY_DEPTH,
): UseEditorHistoryReturn {
  const [history, setHistory] = useState<EditorHistoryState>(() => ({
    past: [],
    present: initialConfiguration,
    future: [],
  }));

  const setConfiguration = useCallback(
    (
      updater: WebsiteConfiguration | ((prev: WebsiteConfiguration) => WebsiteConfiguration),
      recordHistory: boolean = true,
    ) => {
      setHistory((current) => {
        const nextConfig = typeof updater === "function" ? updater(current.present) : updater;

        // Skip if structurally identical
        if (JSON.stringify(nextConfig) === JSON.stringify(current.present)) {
          return current;
        }

        if (!recordHistory) {
          return {
            ...current,
            present: nextConfig,
          };
        }

        const newPast = [...current.past, current.present];
        // Enforce max depth
        if (newPast.length > maxDepth) {
          newPast.splice(0, newPast.length - maxDepth);
        }

        return {
          past: newPast,
          present: nextConfig,
          future: [], // New change clears redo stack
        };
      });
    },
    [maxDepth],
  );

  const undo = useCallback((): WebsiteConfiguration | null => {
    let restoredConfig: WebsiteConfiguration | null = null;

    setHistory((current) => {
      if (current.past.length === 0) return current;

      const previous = current.past[current.past.length - 1];
      const newPast = current.past.slice(0, current.past.length - 1);
      const newFuture = [current.present, ...current.future];

      restoredConfig = previous;

      return {
        past: newPast,
        present: previous,
        future: newFuture,
      };
    });

    return restoredConfig;
  }, []);

  const redo = useCallback((): WebsiteConfiguration | null => {
    let restoredConfig: WebsiteConfiguration | null = null;

    setHistory((current) => {
      if (current.future.length === 0) return current;

      const next = current.future[0];
      const newFuture = current.future.slice(1);
      const newPast = [...current.past, current.present];

      restoredConfig = next;

      return {
        past: newPast,
        present: next,
        future: newFuture,
      };
    });

    return restoredConfig;
  }, []);

  const resetHistory = useCallback((newConfiguration: WebsiteConfiguration) => {
    setHistory({
      past: [],
      present: newConfiguration,
      future: [],
    });
  }, []);

  return {
    configuration: history.present,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    historyLength: history.past.length,
    undo,
    redo,
    setConfiguration,
    resetHistory,
  };
}
