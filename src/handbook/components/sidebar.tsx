/**
 * sidebar.tsx — Tree view of handbook levels and topics
 *
 * Displays expandable levels with nested topics.
 * Supports keyboard navigation and mouse click (via raw stdin SGR parsing).
 */

import { Box, Text } from "ink";
import type { NavItem } from "../hooks/use-handbook-nav.js";

interface SidebarProps {
  items: NavItem[];
  selectedIndex: number;
}

export function Sidebar({ items, selectedIndex }: SidebarProps) {
  return (
    <Box flexDirection="column" width="40%">
      <Box marginBottom={1}>
        <Text bold color="cyan">
          Handbook
        </Text>
      </Box>

      {items.map((item, index) => (
        <SidebarItem
          key={`${item.type}-${item.levelNumber}-${item.topic?.id}-${item.isExpanded}`}
          item={item}
          isSelected={index === selectedIndex}
        />
      ))}
    </Box>
  );
}

interface SidebarItemProps {
  item: NavItem;
  isSelected: boolean;
}

function SidebarItem({ item, isSelected }: SidebarItemProps) {
  if (item.type === "level") {
    const arrow = item.isExpanded ? "▼" : "▶";
    return (
      <Box flexDirection="column">
        <Box paddingLeft={0}>
          <Text
            bold
            color={isSelected ? "blue" : undefined}
            inverse={isSelected}
          >
            {` ${arrow} ${item.levelNumber} — ${item.levelName}`}
          </Text>
        </Box>
        {isSelected && (
          <Box paddingLeft={2}>
            <Text dimColor>{item.levelName}</Text>
          </Box>
        )}
      </Box>
    );
  }

  if (item.type === "topic" && item.topic) {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text
          color={isSelected ? "blue" : undefined}
          inverse={isSelected}
        >
          {` ▸ ${item.topic.title}`}
        </Text>
        {isSelected && (
          <Box paddingLeft={2}>
            <Text dimColor>{item.topic.description}</Text>
          </Box>
        )}
      </Box>
    );
  }

  return null;
}
