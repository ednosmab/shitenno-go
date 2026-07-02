/**
 * sparkline.tsx — ASCII sparkline component
 *
 * Renders a compact ASCII sparkline chart.
 */

import React from "react";
import { Text } from "ink";

interface SparklineProps {
  data: number[];
  width?: number;
  ariaLabel?: string;
}

const CHARS = " ▁▂▃▄▅▆▇█";

export function Sparkline({ data, width, ariaLabel }: SparklineProps): React.ReactElement {
  if (data.length === 0) {
    return <Text dimColor>(no data)</Text>;
  }

  const displayData = width ? data.slice(-width) : data;
  const min = Math.min(...displayData);
  const max = Math.max(...displayData);
  const range = max - min || 1;

  const sparkline = displayData
    .map((s) => {
      const idx = Math.round(((s - min) / range) * (CHARS.length - 1));
      return CHARS[idx];
    })
    .join("");

  const latest = displayData[displayData.length - 1];
  const label = ariaLabel || `Trend: ${latest}`;

  return (
    <Text color="cyan" aria-label={label}>
      {sparkline}
    </Text>
  );
}
