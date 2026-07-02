/**
 * sessions.tsx — Tab 8: Sessions
 *
 * Shows session metrics, command frequency, token economy, feedback patterns.
 * Supports item expansion via Enter key and mouse click.
 */

import React, { useRef } from "react";
import { Box, Text } from "ink";
import { useOnClick } from "@ink-tools/ink-mouse";
import { HealthBar } from "../components/health-bar.js";
import { SectionBox, DataRow } from "../components/section-box.js";
import type { ConsoleData } from "../data-collector.js";

interface SessionsTabProps {
  data: ConsoleData;
  scrollOffset?: number;
  expandedItem?: string | null;
  onExpandItem?: (id: string) => void;
}

interface SessionMetricsItemProps {
  session: ConsoleData["session"];
  isExpanded: boolean;
  onExpand: () => void;
}

function SessionMetricsItem({ session, isExpanded, onExpand }: SessionMetricsItemProps): React.ReactElement {
  const ref = useRef(null);

  useOnClick(ref, () => {
    onExpand();
  });

  return (
    <Box
      ref={ref}
      flexDirection="column"
      borderStyle={isExpanded ? "bold" : undefined}
      borderColor={isExpanded ? "cyan" : undefined}
      paddingX={isExpanded ? 1 : 0}
    >
      <Box>
        <Text color="cyan">{isExpanded ? "▼" : "▶"} </Text>
        <Text bold>Session Overview</Text>
      </Box>
      <Box gap={4} paddingLeft={2}>
        <DataRow label="Total Sessions" value={session.totalSessions} />
        <DataRow label="Avg Duration" value={`${session.avgDuration} min`} />
        <DataRow label="Total Commands" value={session.totalCommands} />
        <DataRow label="Avg Feedback" value={`${session.avgFeedbackPerSession}/session`} />
      </Box>
      <Box marginTop={1} paddingLeft={2}>
        <Text bold>Success Rate: </Text>
      </Box>
      <HealthBar
        label=""
        value={session.totalSessions > 0 ? Math.round((session.totalAccepts / Math.max(session.totalAccepts + session.totalRejects, 1)) * 100) : 0}
        width={30}
      />
      <Box paddingLeft={2}>
        <Text color="green">✓ Accepts: {session.totalAccepts} </Text>
        <Text color="red">✗ Rejects: {session.totalRejects} </Text>
      </Box>
      {isExpanded && (
        <Box flexDirection="column" paddingLeft={2} marginTop={1}>
          <Box>
            <Text bold>Acceptance Rate: </Text>
            <Text color="green">
              {session.totalSessions > 0
                ? Math.round((session.totalAccepts / Math.max(session.totalAccepts + session.totalRejects, 1)) * 100)
                : 0}%
            </Text>
          </Box>
          <Box>
            <Text bold>Avg Commands/Session: </Text>
            <Text>{session.totalSessions > 0 ? Math.round(session.totalCommands / session.totalSessions) : 0}</Text>
          </Box>
          <Box>
            <Text bold>Avg Feedback/Session: </Text>
            <Text>{session.avgFeedbackPerSession}</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}

export function SessionsTab({ data, scrollOffset = 0, expandedItem, onExpandItem }: SessionsTabProps): React.ReactElement {
  const { session } = data;

  // Top commands
  const topCommands = Object.entries(session.commandFrequency)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8);

  const maxCmdCount = topCommands[0]?.[1] ?? 1;

  return (
    <Box flexDirection="column" gap={1}>
      {/* Session Metrics */}
      <SectionBox title="Session Metrics">
        <SessionMetricsItem
          session={session}
          isExpanded={expandedItem === "session-metrics"}
          onExpand={() => onExpandItem?.("session-metrics")}
        />
      </SectionBox>

      {/* Top Commands */}
      <SectionBox title="Top Commands">
        {topCommands.slice(scrollOffset).map(([cmd, count]) => (
          <Box key={cmd}>
            <Text>{cmd.padEnd(16)}</Text>
            <Text color="cyan">
              {"█".repeat(Math.round((count / maxCmdCount) * 15))}
            </Text>
            <Text dimColor>
              {"░".repeat(15 - Math.round((count / maxCmdCount) * 15))}
            </Text>
            <Text bold> {count}</Text>
          </Box>
        ))}
        {scrollOffset > 0 && (
          <Box>
            <Text dimColor>↑ {scrollOffset} more commands above</Text>
          </Box>
        )}
      </SectionBox>

      {/* Path Choices */}
      <SectionBox title="Path Choices">
        <Box>
          <Text>Challenging Ratio: </Text>
          <Text bold color={session.challengingRatio >= 0.5 ? "green" : "yellow"}>
            {Math.round(session.challengingRatio * 100)}%
          </Text>
          <Text dimColor>
            {" "}
            ({session.challengingRatio >= 0.7
              ? "prefers growth"
              : session.challengingRatio <= 0.3
              ? "prefers comfort"
              : "balanced"})
          </Text>
        </Box>
      </SectionBox>
    </Box>
  );
}
