/**
 * command-output.tsx — Command execution output component
 *
 * Displays formatted output from a command execution with
 * duration, status, and navigation hints.
 */

import React from "react";
import { Box, Text } from "ink";
import type { CommandExecution } from "../hooks/use-command.js";

interface CommandOutputProps {
  execution: CommandExecution;
  onBack: () => void;
  onRerun: () => void;
}

function formatJsonOutput(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return raw;
  }
}

function isJsonOutput(raw: string): boolean {
  const trimmed = raw.trim();
  return (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  );
}

function truncateOutput(raw: string, maxLines: number): { text: string; truncated: boolean } {
  const lines = raw.split("\n");
  if (lines.length <= maxLines) {
    return { text: raw, truncated: false };
  }
  const truncated = lines.slice(0, maxLines).join("\n");
  return { text: truncated, truncated: true };
}

export function CommandOutput({
  execution,
  onBack,
  onRerun,
}: CommandOutputProps): React.ReactElement {
  const { label, status, output, error, duration } = execution;

  const displayOutput = isJsonOutput(output) ? formatJsonOutput(output) : output;
  const { text, truncated } = truncateOutput(displayOutput, 50);

  const statusColor = status === "done" ? "green" : "red";
  const statusIcon = status === "done" ? "✔" : "✘";
  const durationStr = duration !== undefined ? `${duration.toFixed(1)}s` : "—";

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box
        borderStyle="double"
        borderColor={statusColor}
        paddingX={1}
        justifyContent="space-between"
      >
        <Box>
          <Text bold color={statusColor}>
            {statusIcon} {label}
          </Text>
        </Box>
        <Box>
          <Text dimColor>Duration: {durationStr}</Text>
        </Box>
      </Box>

      {/* Output */}
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor="gray"
        paddingX={1}
        marginTop={1}
      >
        {status === "running" && (
          <Box>
            <Text color="yellow">⏳ Executing command...</Text>
          </Box>
        )}

        {status === "error" && error && (
          <Box flexDirection="column">
            <Text bold color="red">Error:</Text>
            <Text color="red">{error}</Text>
          </Box>
        )}

        {status !== "running" && output && (
          <Box flexDirection="column">
            <Text>{text}</Text>
            {truncated && (
              <Box marginTop={1}>
                <Text dimColor>... (output truncated, {output.split("\n").length} total lines)</Text>
              </Box>
            )}
          </Box>
        )}

        {status !== "running" && !output && !error && (
          <Box>
            <Text dimColor>No output</Text>
          </Box>
        )}
      </Box>

      {/* Hints */}
      <Box marginTop={1} gap={2}>
        <Text dimColor>[ESC] Back</Text>
        <Text dimColor>[R] Re-run</Text>
      </Box>
    </Box>
  );
}
