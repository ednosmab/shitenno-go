/**
 * section-box.tsx — Section container with title
 *
 * Renders a titled box section with consistent styling.
 * Supports mouse click to expand/focus.
 */

import React from "react";
import { Box, Text } from "ink";

interface SectionBoxProps {
  title: string;
  children: React.ReactNode;
  width?: number | string;
  ariaLabel?: string;
}

export function SectionBox({ title, children, width, ariaLabel }: SectionBoxProps): React.ReactElement {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="gray"
      paddingX={1}
      paddingY={0}
      width={width}
      aria-label={ariaLabel || title}
    >
      <Box>
        <Text bold color="cyan">
          {title}
        </Text>
      </Box>
      <Box flexDirection="column">
        {children}
      </Box>
    </Box>
  );
}

interface DataRowProps {
  label: string;
  value: string | number;
  color?: string;
}

export function DataRow({ label, value, color }: DataRowProps): React.ReactElement {
  return (
    <Box>
      <Text dimColor>{label.padEnd(20)}</Text>
      <Text color={color} bold>{String(value)}</Text>
    </Box>
  );
}

interface TreeViewProps {
  items: TreeItem[];
  ariaLabel?: string;
}

export interface TreeItem {
  name: string;
  children?: TreeItem[];
  isOrphan?: boolean;
  isHub?: boolean;
}

export function TreeView({ items, ariaLabel }: TreeViewProps): React.ReactElement {
  return (
    <Box flexDirection="column" aria-label={ariaLabel || "Tree view"}>
      {items.map((item, index) => (
        <TreeNode key={index} item={item} depth={0} isLast={index === items.length - 1} />
      ))}
    </Box>
  );
}

function TreeNode({ item, depth, isLast }: { item: TreeItem; depth: number; isLast: boolean }): React.ReactElement {
  const prefix = depth === 0 ? "" : isLast ? "└── " : "├── ";
  const connector = depth === 0 ? "" : isLast ? "    " : "│   ";

  const nameColor = item.isOrphan ? "yellow" : item.isHub ? "cyan" : undefined;
  const suffix = item.isOrphan ? " ⚠" : item.isHub ? " 🔗" : "";

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={nameColor}>
          {prefix}{item.name}{suffix}
        </Text>
      </Box>
      {item.children?.map((child, index) => (
        <TreeNode
          key={index}
          item={child}
          depth={depth + 1}
          isLast={index === (item.children?.length ?? 0) - 1}
        />
      ))}
    </Box>
  );
}
