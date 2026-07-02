/**
 * footer.tsx — Bottom navigation hints bar
 *
 * Shows keyboard shortcuts and current mode.
 * Adapts to screen reader mode.
 */

import React from "react";
import { Box, Text } from "ink";

interface FooterProps {
  hints: Array<{ key: string; action: string }>;
  mode?: string;
  ariaLabel?: string;
}

export function Footer({ hints, mode, ariaLabel }: FooterProps): React.ReactElement {
  return (
    <Box
      borderStyle="single"
      borderTop={true}
      borderBottom={false}
      borderLeft={false}
      borderRight={false}
      paddingX={1}
      justifyContent="space-between"
      aria-label={ariaLabel || "Keyboard shortcuts"}
    >
      <Box>
        {hints.map((hint, index) => (
          <Box key={index} marginRight={2}>
            <Text bold color="cyan">{hint.key}</Text>
            <Text dimColor> {hint.action}</Text>
          </Box>
        ))}
      </Box>
      {mode && (
        <Text dimColor>{mode}</Text>
      )}
    </Box>
  );
}

export const DEFAULT_HINTS = [
  { key: "←→", action: "Tabs" },
  { key: "1-0,c", action: "Jump" },
  { key: "↑↓", action: "Scroll" },
  { key: "Enter", action: "Select" },
  { key: "Esc", action: "Back" },
  { key: "q", action: "Quit" },
  { key: "r", action: "Refresh" },
];
