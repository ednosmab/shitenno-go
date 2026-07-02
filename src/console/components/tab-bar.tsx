/**
 * tab-bar.tsx — Navigation tab bar component
 *
 * Renders horizontally scrollable tabs with mouse click support.
 * Highlights active tab and supports keyboard + mouse navigation.
 */

import React from "react";
import { Box, Text } from "ink";

interface Tab {
  id: string;
  label: string;
  shortcut?: string;
}

interface TabBarProps {
  tabs: Tab[];
  activeIndex: number;
  onSelect: (index: number) => void;
  ariaLabel?: string;
}

export function TabBar({ tabs, activeIndex, onSelect, ariaLabel }: TabBarProps): React.ReactElement {
  return (
    <Box
      flexDirection="row"
      borderStyle="single"
      borderBottom={true}
      borderTop={false}
      borderLeft={false}
      borderRight={false}
      paddingX={1}
      aria-label={ariaLabel || "Navigation tabs"}
    >
      {tabs.map((tab, index) => {
        const isActive = index === activeIndex;
        const shortcut = tab.shortcut ? `[${tab.shortcut}]` : "";

        return (
          <Box key={tab.id} marginRight={1}>
            <Text
              bold={isActive}
              inverse={isActive}
              color={isActive ? "cyan" : undefined}
            >
              {` ${tab.label} `}
            </Text>
            {shortcut && (
              <Text dimColor>{shortcut}</Text>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
