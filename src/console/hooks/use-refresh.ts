/**
 * use-refresh.ts — Auto-refresh hook
 *
 * Periodically re-collects data for live dashboard updates.
 */

import { useState, useEffect, useCallback } from "react";
import { collectConsoleData, type ConsoleData } from "../data-collector.js";

export function useRefresh(
  projectRoot: string,
  nexusDir: string,
  intervalMs: number = 0
) {
  const [data, setData] = useState<ConsoleData>(() =>
    collectConsoleData(projectRoot, nexusDir)
  );
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const refresh = useCallback(() => {
    const newData = collectConsoleData(projectRoot, nexusDir);
    setData(newData);
    setLastRefresh(new Date());
  }, [projectRoot, nexusDir]);

  useEffect(() => {
    if (intervalMs <= 0) return;

    const timer = setInterval(refresh, intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs, refresh]);

  return { data, refresh, lastRefresh };
}
