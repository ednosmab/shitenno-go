/**
 * engineering.tsx — Tab 2: Engineering
 *
 * Shows engineering strength: 7 maturity dimensions, capabilities, assets by type.
 */

import React from "react";
import { Box, Text } from "ink";
import { HealthBar, MiniBar } from "../components/health-bar.js";
import { SectionBox, DataRow } from "../components/section-box.js";
import type { ConsoleData } from "../data-collector.js";

interface EngineeringTabProps {
  data: ConsoleData;
  scrollOffset?: number;
}

const DIMENSION_WEIGHTS: Record<string, number> = {
  architecture: 18,
  quality: 18,
  automation: 15,
  documentation: 15,
  governance: 12,
  ai: 12,
  observability: 10,
};

const DIMENSION_LABELS: Record<string, string> = {
  architecture: "Architecture",
  quality: "Quality",
  automation: "Automation",
  documentation: "Documentation",
  governance: "Governance",
  ai: "AI",
  observability: "Observability",
};

export function EngineeringTab({ data, scrollOffset = 0 }: EngineeringTabProps): React.ReactElement {
  const { maturity, capabilityEntities, engineering } = data;

  const dimensions = maturity?.dimensions ?? {};

  // Count assets by type
  const assetsByType: Record<string, number> = {};
  for (const asset of engineering.assets) {
    assetsByType[asset.type] = (assetsByType[asset.type] || 0) + 1;
  }

  const sortedAssets = Object.entries(assetsByType)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

  return (
    <Box flexDirection="column" gap={1}>
      {/* Maturity Dimensions */}
      <SectionBox title="Maturity Dimensions (Radar)">
        {Object.entries(DIMENSION_LABELS).map(([key, label]) => {
          const value = dimensions[key as keyof typeof dimensions] ?? 0;
          const weight = DIMENSION_WEIGHTS[key] ?? 0;
          return (
            <Box key={key}>
              <HealthBar
                label={label}
                value={value}
                width={20}
              />
              <Text dimColor> ← weight: {weight}%</Text>
            </Box>
          );
        })}
        <Box marginTop={1}>
          <Text bold>Overall Weighted Score: </Text>
          <Text bold color="cyan">{maturity?.overallScore ?? "N/A"}/100</Text>
        </Box>
      </SectionBox>

      {/* Capability Maturity */}
      <SectionBox title="Capability Maturity">
        <Box>
          <Text bold dimColor>{"".padEnd(16)}</Text>
          <Text bold dimColor>{"Maturity".padEnd(10)}</Text>
          <Text bold dimColor>{"Score".padEnd(8)}</Text>
          <Text bold dimColor>{"Level".padEnd(14)}</Text>
        </Box>
        {capabilityEntities.map((cap) => (
          <Box key={cap.id}>
            <Text>{cap.name.padEnd(16)}</Text>
            <MiniBar value={cap.maturityScore} width={8} />
            <Text> {String(cap.maturityScore).padStart(4)}</Text>
            <Text dimColor> {cap.maturity.padEnd(14)}</Text>
          </Box>
        ))}
        <Box marginTop={1}>
          <Text bold>Overall Capability Score: </Text>
          <Text bold color="cyan">
            {capabilityEntities.length > 0
              ? Math.round(
                  capabilityEntities.reduce((sum, c) => sum + c.maturityScore, 0) /
                    capabilityEntities.length
                )
              : "N/A"}
            /100
          </Text>
        </Box>
      </SectionBox>

      {/* Assets by Type */}
      <SectionBox title="Assets by Type">
        {sortedAssets.map(([type, count]) => (
          <Box key={type}>
            <Text>{type.padEnd(14)}</Text>
            <Text color="cyan">{"█".repeat(Math.min(count, 20))}</Text>
            <Text dimColor>{"░".repeat(Math.max(0, 20 - count))}</Text>
            <Text bold> {count}</Text>
          </Box>
        ))}
        <Box marginTop={1}>
          <Text bold>Total: {engineering.assets.length} assets</Text>
        </Box>
      </SectionBox>
    </Box>
  );
}
