/**
 * command-card.tsx — Clickable command card component
 *
 * Renders a command with label, description, estimated time,
 * and visual status indicator. Supports mouse click and keyboard.
 */

import React, { useRef } from "react";
import { Box, Text } from "ink";
import { useOnClick } from "@ink-tools/ink-mouse";
import type { CommandDefinition, CommandStatus } from "../hooks/use-command.js";

interface CommandCardProps {
  definition: CommandDefinition;
  status: CommandStatus;
  isSelected: boolean;
  onSelect: () => void;
  duration?: number;
}

const STATUS_ICONS: Record<CommandStatus, string> = {
  idle: "▶",
  running: "⏳",
  done: "✔",
  error: "✘",
};

const STATUS_COLORS: Record<CommandStatus, string> = {
  idle: "cyan",
  running: "yellow",
  done: "green",
  error: "red",
};

const STATUS_LABELS: Record<CommandStatus, string> = {
  idle: "Ready",
  running: "Running...",
  done: "Done",
  error: "Failed",
};

export function CommandCard({
  definition,
  status,
  isSelected,
  onSelect,
  duration,
}: CommandCardProps): React.ReactElement {
  const ref = useRef(null);

  useOnClick(ref, () => {
    if (status === "idle") {
      onSelect();
    }
  });

  const icon = STATUS_ICONS[status];
  const color = STATUS_COLORS[status];
  const statusLabel = STATUS_LABELS[status];
  const isDangerous = definition.category === "destructive";
  const borderColor = isDangerous ? "red" : isSelected ? "cyan" : "gray";

  const durationStr =
    duration !== undefined ? ` (${duration.toFixed(1)}s)` : "";

  return (
    <Box
      ref={ref}
      flexDirection="column"
      borderStyle={isSelected ? "bold" : "round"}
      borderColor={borderColor}
      paddingX={1}
      paddingY={0}
      marginBottom={0}
    >
      <Box justifyContent="space-between">
        <Box>
          <Text bold={isSelected} color={color}>
            {icon}{" "}
          </Text>
          <Text bold={isSelected} color={isSelected ? "cyan" : undefined}>
            {definition.label}
          </Text>
          {isDangerous && (
            <Text color="red"> ⚠</Text>
          )}
        </Box>
        <Box>
          <Text dimColor>[{definition.estimatedTime}]</Text>
        </Box>
      </Box>
      <Box>
        <Text dimColor>  {definition.description}</Text>
      </Box>
      <Box>
        <Text>  </Text>
        <Text color={color} dimColor={status === "idle"}>
          {statusLabel}
          {durationStr}
        </Text>
      </Box>
    </Box>
  );
}
