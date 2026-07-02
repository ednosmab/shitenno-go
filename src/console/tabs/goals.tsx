/**
 * goals.tsx — Tab 6: Goals
 *
 * Shows active goals with progress, priorities, targets.
 * Supports item expansion via Enter key and mouse click.
 */

import React, { useRef } from "react";
import { Box, Text } from "ink";
import { useOnClick } from "@ink-tools/ink-mouse";
import { HealthBar } from "../components/health-bar.js";
import { SectionBox, DataRow } from "../components/section-box.js";
import type { ConsoleData } from "../data-collector.js";

interface GoalsTabProps {
  data: ConsoleData;
  scrollOffset?: number;
  expandedItem?: string | null;
  onExpandItem?: (id: string) => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: "red",
  high: "yellow",
  medium: "cyan",
  low: "gray",
};

interface GoalItemProps {
  goal: ConsoleData["goals"][0];
  isExpanded: boolean;
  onExpand: (id: string) => void;
}

function GoalItem({ goal, isExpanded, onExpand }: GoalItemProps): React.ReactElement {
  const ref = useRef(null);

  useOnClick(ref, () => {
    onExpand(goal.id);
  });

  return (
    <Box
      ref={ref}
      key={goal.id}
      flexDirection="column"
      marginBottom={1}
      borderStyle={isExpanded ? "bold" : undefined}
      borderColor={isExpanded ? "cyan" : undefined}
      paddingX={isExpanded ? 1 : 0}
    >
      <Box>
        <Text color="cyan">{isExpanded ? "▼" : "▶"} </Text>
        <Text bold color={PRIORITY_COLORS[goal.priority] ?? "white"}>
          [{goal.priority.toUpperCase()}]
        </Text>
        <Text bold> {goal.title}</Text>
      </Box>
      <Box paddingLeft={2}>
        <HealthBar label="Progress" value={goal.progress} width={15} />
      </Box>
      {goal.targets.length > 0 && (
        <Box paddingLeft={2}>
          <Text dimColor>Targets: {goal.targets.join(", ")}</Text>
        </Box>
      )}
      {isExpanded && (
        <Box flexDirection="column" paddingLeft={2} marginTop={1}>
          {goal.description && (
            <Box>
              <Text bold>Description: </Text>
              <Text>{goal.description}</Text>
            </Box>
          )}
          {goal.criteria && goal.criteria.length > 0 && (
            <Box flexDirection="column">
              <Text bold>Criteria:</Text>
              {goal.criteria.map((criterion, i) => (
                <Text key={i}>  • {criterion}</Text>
              ))}
            </Box>
          )}
          {goal.tags && goal.tags.length > 0 && (
            <Box>
              <Text bold>Tags: </Text>
              <Text color="cyan">{goal.tags.join(", ")}</Text>
            </Box>
          )}
          {goal.createdAt && (
            <Box>
              <Text dimColor>Created: {goal.createdAt}</Text>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}

export function GoalsTab({ data, scrollOffset = 0, expandedItem, onExpandItem }: GoalsTabProps): React.ReactElement {
  const { goals } = data;

  if (goals.length === 0) {
    return (
      <SectionBox title="Goals">
        <Text dimColor>No goals defined yet.</Text>
        <Text dimColor>Use "nexus goal add" to create one.</Text>
      </SectionBox>
    );
  }

  const activeGoals = goals.filter((g) => g.status === "active");
  const completedGoals = goals.filter((g) => g.status === "completed");
  const avgProgress = activeGoals.length > 0
    ? Math.round(activeGoals.reduce((sum, g) => sum + g.progress, 0) / activeGoals.length)
    : 0;

  const visibleActiveGoals = activeGoals.slice(scrollOffset);

  return (
    <Box flexDirection="column" gap={1}>
      {/* Active Goals */}
      <SectionBox title="Active Goals">
        {visibleActiveGoals.map((goal) => (
          <GoalItem
            key={goal.id}
            goal={goal}
            isExpanded={expandedItem === goal.id}
            onExpand={(id) => onExpandItem?.(id)}
          />
        ))}
        {scrollOffset > 0 && (
          <Box>
            <Text dimColor>↑ {scrollOffset} more goals above</Text>
          </Box>
        )}
      </SectionBox>

      {/* Goal Statistics */}
      <SectionBox title="Goal Statistics">
        <Box gap={4}>
          <DataRow label="Total" value={goals.length} />
          <DataRow label="Active" value={activeGoals.length} />
          <DataRow label="Completed" value={completedGoals.length} />
          <DataRow label="Avg Progress" value={`${avgProgress}%`} />
        </Box>
      </SectionBox>
    </Box>
  );
}
