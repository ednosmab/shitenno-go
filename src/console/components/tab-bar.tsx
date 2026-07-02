/**
 * tab-bar.tsx — Navigation tab bar component
 *
 * Renders horizontally scrollable tabs with mouse click support.
 * Highlights active tab and supports keyboard + mouse navigation.
 */

import React, { useRef } from "react";
import { Box, Text } from "ink";
import { useOnClick } from "@ink-tools/ink-mouse";

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

interface TabItemProps {
  tab: Tab;
  index: number;
  isActive: boolean;
  onSelect: (index: number) => void;
}

function TabItem({ tab, index, isActive, onSelect }: TabItemProps): React.ReactElement {
  const ref = useRef(null);

  useOnClick(ref, () => {
    onSelect(index);
  });

  const shortcut = tab.shortcut ? `[${tab.shortcut}]` : "";

  return (
    <Box ref={ref} marginRight={1}>
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
      {tabs.map((tab, index) => (
        <TabItem
          key={tab.id}
          tab={tab}
          index={index}
          isActive={index === activeIndex}
          onSelect={onSelect}
        />
      ))}
    </Box>
  );
}
