/**
 * use-navigate.ts — Navigation hook with history stack and scroll
 *
 * Manages tab navigation, section depth, and scroll position.
 * Supports ESC to go back, Tab to cycle tabs, mouse wheel scroll.
 */

import { useState, useCallback } from "react";

export interface NavigationState {
  activeTab: number;
  history: number[];
  expandedItem: string | null;
  scrollOffset: number;
}

export function useNavigate(totalTabs: number) {
  const [state, setState] = useState<NavigationState>({
    activeTab: 0,
    history: [0],
    expandedItem: null,
    scrollOffset: 0,
  });

  const goToTab = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(index, totalTabs - 1));
    setState((prev) => ({
      ...prev,
      activeTab: clamped,
      history: [...prev.history, clamped],
      expandedItem: null,
      scrollOffset: 0,
    }));
  }, [totalTabs]);

  const nextTab = useCallback(() => {
    setState((prev) => {
      const next = (prev.activeTab + 1) % totalTabs;
      return {
        ...prev,
        activeTab: next,
        history: [...prev.history, next],
        expandedItem: null,
        scrollOffset: 0,
      };
    });
  }, [totalTabs]);

  const prevTab = useCallback(() => {
    setState((prev) => {
      const next = (prev.activeTab - 1 + totalTabs) % totalTabs;
      return {
        ...prev,
        activeTab: next,
        history: [...prev.history, next],
        expandedItem: null,
        scrollOffset: 0,
      };
    });
  }, [totalTabs]);

  const goBack = useCallback(() => {
    setState((prev) => {
      if (prev.history.length <= 1) {
        return prev;
      }
      const newHistory = prev.history.slice(0, -1);
      const previousTab = newHistory[newHistory.length - 1] ?? 0;
      return {
        ...prev,
        activeTab: previousTab,
        history: newHistory,
        expandedItem: null,
        scrollOffset: 0,
      };
    });
  }, []);

  const expandItem = useCallback((itemId: string) => {
    setState((prev) => ({
      ...prev,
      expandedItem: prev.expandedItem === itemId ? null : itemId,
    }));
  }, []);

  const scrollUp = useCallback(() => {
    setState((prev) => ({
      ...prev,
      scrollOffset: Math.max(0, prev.scrollOffset - 1),
    }));
  }, []);

  const scrollDown = useCallback(() => {
    setState((prev) => ({
      ...prev,
      scrollOffset: prev.scrollOffset + 1,
    }));
  }, []);

  const resetScroll = useCallback(() => {
    setState((prev) => ({
      ...prev,
      scrollOffset: 0,
    }));
  }, []);

  const canGoBack = state.history.length > 1;

  return {
    ...state,
    goToTab,
    nextTab,
    prevTab,
    goBack,
    expandItem,
    scrollUp,
    scrollDown,
    resetScroll,
    canGoBack,
  };
}
