/**
 * knowledge.tsx — Tab 4: Knowledge
 *
 * Shows knowledge debt: gaps by type/severity, health, recommendations.
 */

import React from "react";
import { Box, Text } from "ink";
import { HealthBar } from "../components/health-bar.js";
import { SectionBox, DataRow } from "../components/section-box.js";
import type { ConsoleData } from "../data-collector.js";

interface KnowledgeTabProps {
  data: ConsoleData;
  scrollOffset?: number;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "red",
  high: "yellow",
  medium: "yellow",
  low: "gray",
};

export function KnowledgeTab({ data, scrollOffset = 0 }: KnowledgeTabProps): React.ReactElement {
  const { debt, graph } = data;

  if (!debt) {
    return (
      <SectionBox title="Knowledge">
        <Text dimColor>No knowledge debt data available.</Text>
      </SectionBox>
    );
  }

  // Gaps by type
  const gapsByType = Object.entries(debt.gapsByType)
    .filter(([, count]) => count > 0)
    .sort(([, a], [, b]) => b - a);

  const maxGaps = Math.max(...gapsByType.map(([, c]) => c), 1);

  return (
    <Box flexDirection="column" gap={1}>
      {/* Debt Overview */}
      <SectionBox title="Debt Overview">
        <Box>
          <Text bold>Health Score: </Text>
          <Text bold color="cyan">{debt.healthScore}/100</Text>
        </Box>
        <HealthBar label="" value={debt.healthScore} width={30} />
        <Box>
          <Text bold>Total Gaps: {debt.totalGaps}</Text>
        </Box>
        <Box gap={2}>
          <Text color="red">Critical: {debt.gapsBySeverity.critical ?? 0}</Text>
          <Text color="yellow">High: {debt.gapsBySeverity.high ?? 0}</Text>
          <Text color="yellow">Medium: {debt.gapsBySeverity.medium ?? 0}</Text>
          <Text dimColor>Low: {debt.gapsBySeverity.low ?? 0}</Text>
        </Box>
      </SectionBox>

      {/* Gaps by Type */}
      <SectionBox title="Gaps by Type">
        {gapsByType.map(([type, count]) => (
          <Box key={type}>
            <Text>{type.padEnd(20)}</Text>
            <Text color="yellow">
              {"█".repeat(Math.round((count / maxGaps) * 15))}
            </Text>
            <Text dimColor>
              {"░".repeat(15 - Math.round((count / maxGaps) * 15))}
            </Text>
            <Text bold> {count}</Text>
          </Box>
        ))}
      </SectionBox>

      {/* Top Gaps */}
      <SectionBox title="Top Gaps">
        {debt.gaps.slice(0, 5).map((gap) => (
          <Box key={gap.id} flexDirection="column">
            <Box>
              <Text color={SEVERITY_COLORS[gap.severity] ?? "white"}>
                ⚠ [{gap.severity.toUpperCase()}]
              </Text>
              <Text> {gap.description}</Text>
            </Box>
            <Box paddingLeft={2}>
              <Text dimColor>Location: {gap.location}</Text>
            </Box>
            <Box paddingLeft={2}>
              <Text dimColor>Expected: {gap.expectedArtifact}</Text>
            </Box>
          </Box>
        ))}
      </SectionBox>

      {/* Recommendations */}
      {debt.recommendations.length > 0 && (
        <SectionBox title="Recommendations">
          {debt.recommendations.slice(0, 5).map((rec, index) => (
            <Box key={index}>
              <Text color="yellow">{index + 1}. </Text>
              <Text>{rec}</Text>
            </Box>
          ))}
        </SectionBox>
      )}
    </Box>
  );
}
