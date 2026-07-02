/**
 * health-bar.tsx — Reusable health bar component
 *
 * Renders a colored ASCII health bar with label and value.
 * Supports mouse hover and screen reader labels.
 */

import React from "react";
import { Box, Text } from "ink";

interface HealthBarProps {
  label: string;
  value: number;
  max?: number;
  width?: number;
  showPercentage?: boolean;
  ariaLabel?: string;
}

export function HealthBar({
  label,
  value,
  max = 100,
  width = 20,
  showPercentage = true,
  ariaLabel,
}: HealthBarProps): React.ReactElement {
  const pct = Math.min(1, Math.max(0, value / max));
  const filled = Math.round(pct * width);
  const empty = width - filled;

  const barColor = pct >= 0.8 ? "green" : pct >= 0.5 ? "yellow" : "red";
  const filledChar = "█";
  const emptyChar = "░";

  const filledStr = filledChar.repeat(filled);
  const emptyStr = emptyChar.repeat(empty);
  const pctStr = `${Math.round(pct * 100)}%`;

  return (
    <Box aria-label={ariaLabel || `${label}: ${pctStr}`}>
      <Text bold>{label.padEnd(14)}</Text>
      <Text color={barColor}>{filledStr}</Text>
      <Text dimColor>{emptyStr}</Text>
      {showPercentage && <Text bold> {pctStr}</Text>}
    </Box>
  );
}

interface MiniBarProps {
  value: number;
  max?: number;
  width?: number;
}

export function MiniBar({ value, max = 100, width = 10 }: MiniBarProps): React.ReactElement {
  const pct = Math.min(1, Math.max(0, value / max));
  const filled = Math.round(pct * width);
  const empty = width - filled;

  const barColor = pct >= 0.8 ? "green" : pct >= 0.5 ? "yellow" : "red";

  return (
    <Text>
      <Text color={barColor}>{"█".repeat(filled)}</Text>
      <Text dimColor>{"░".repeat(empty)}</Text>
    </Text>
  );
}

interface ScoreGaugeProps {
  label: string;
  score: number;
  max?: number;
  ariaLabel?: string;
}

export function ScoreGauge({ label, score, max = 100, ariaLabel }: ScoreGaugeProps): React.ReactElement {
  return (
    <Box flexDirection="column" aria-label={ariaLabel || `${label}: ${score}/${max}`}>
      <Box>
        <Text bold>{label}</Text>
      </Box>
      <Box>
        <HealthBar label="" value={score} max={max} width={25} />
        <Text bold> {score}/{max}</Text>
      </Box>
    </Box>
  );
}
