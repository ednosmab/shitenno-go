/**
 * events.tsx — Tab 9: Events
 *
 * Shows recent events timeline, event distribution.
 */

import React from "react";
import { Box, Text } from "ink";
import { SectionBox, DataRow } from "../components/section-box.js";
import type { ConsoleData } from "../data-collector.js";

interface EventsTabProps {
  data: ConsoleData;
  scrollOffset?: number;
}

export function EventsTab({ data, scrollOffset = 0 }: EventsTabProps): React.ReactElement {
  const { recentEvents } = data;

  // Group events by type
  const eventsByType: Record<string, number> = {};
  for (const event of recentEvents) {
    eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
  }

  const sortedTypes = Object.entries(eventsByType)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8);

  const maxCount = sortedTypes[0]?.[1] ?? 1;

  return (
    <Box flexDirection="column" gap={1}>
      {/* Recent Events */}
      <SectionBox title="Recent Events">
        {recentEvents.slice(-10).reverse().map((event, index) => {
          const time = event.timestamp.slice(11, 19);
          return (
            <Box key={index}>
              <Text dimColor>{time} </Text>
              <Text color="cyan">● </Text>
              <Text>{event.type}</Text>
            </Box>
          );
        })}
        {recentEvents.length === 0 && (
          <Text dimColor>No events recorded yet.</Text>
        )}
      </SectionBox>

      {/* Event Distribution */}
      <SectionBox title="Event Distribution">
        {sortedTypes.map(([type, count]) => (
          <Box key={type}>
            <Text>{type.padEnd(28)}</Text>
            <Text color="cyan">
              {"█".repeat(Math.round((count / maxCount) * 15))}
            </Text>
            <Text dimColor>
              {"░".repeat(15 - Math.round((count / maxCount) * 15))}
            </Text>
            <Text bold> {count}</Text>
          </Box>
        ))}
        <Box marginTop={1}>
          <Text bold>Total: {recentEvents.length} events</Text>
        </Box>
      </SectionBox>
    </Box>
  );
}
