/**
 * overview.tsx — Tab 1: Overview
 *
 * Shows the big picture: health, maturity, lifecycle, capabilities, project info.
 */

import React from "react";
import { Box, Text } from "ink";
import { HealthBar, ScoreGauge } from "../components/health-bar.js";
import { SectionBox, DataRow } from "../components/section-box.js";
import { Sparkline } from "../components/sparkline.js";
import type { ConsoleData } from "../data-collector.js";

interface OverviewTabProps {
  data: ConsoleData;
  scrollOffset?: number;
}

export function OverviewTab({ data, scrollOffset = 0 }: OverviewTabProps): React.ReactElement {
  const { health, maturity, lifecycle, capabilities, engineering, stats } = data;

  // Maturity history for sparkline
  const maturityHistory = data.maturity?.overallScore
    ? [data.maturity.overallScore]
    : [];

  return (
    <Box flexDirection="column" gap={1}>
      {/* Row 1: Health + Maturity */}
      <Box gap={2}>
        <SectionBox title="Health Score" width="45%">
          <HealthBar label="Overall" value={health.overall} />
          <HealthBar label="Debt" value={health.knowledgeDebt} />
          <HealthBar label="Graph" value={health.knowledgeGraph} />
          <HealthBar label="Entropy" value={health.entropy} />
        </SectionBox>

        <SectionBox title="Maturity" width="45%">
          <Box>
            <Text bold>Overall: </Text>
            <Text bold color="cyan">{maturity?.overallScore ?? "N/A"}/100</Text>
          </Box>
          {maturityHistory.length > 0 && (
            <Sparkline data={maturityHistory} ariaLabel="Maturity trend" />
          )}
          {maturity?.recommendedCapabilities && maturity.recommendedCapabilities.length > 0 && (
            <Box>
              <Text dimColor>Next: </Text>
              <Text color="yellow">{maturity.recommendedCapabilities[0]}</Text>
            </Box>
          )}
        </SectionBox>
      </Box>

      {/* Row 2: Lifecycle + Capabilities + Project */}
      <Box gap={2}>
        <SectionBox title="Lifecycle">
          <Box>
            <Text bold color="green">● {data.lifecycle}</Text>
          </Box>
          <DataRow label="Transitions" value={engineering.assets.length > 0 ? "active" : "none"} />
        </SectionBox>

        <SectionBox title={`Capabilities (${capabilities.length}/9)`}>
          {capabilities.map((cap) => (
            <Box key={cap}>
              <Text color="green">✔ </Text>
              <Text>{cap}</Text>
            </Box>
          ))}
          {Array.from({ length: 9 - capabilities.length }).map((_, i) => (
            <Box key={`missing-${i}`}>
              <Text dimColor>○ </Text>
              <Text dimColor>—</Text>
            </Box>
          ))}
        </SectionBox>

        <SectionBox title="Project">
          <DataRow label="Stack" value={engineering.project.stack.join(", ") || "unknown"} />
          <DataRow label="TypeScript" value={engineering.project.hasTypeScript ? "yes" : "no"} />
          <DataRow label="Monorepo" value={engineering.project.monorepo ? "yes" : "no"} />
          <DataRow label="Source Files" value={engineering.project.sourceFileCount} />
          <DataRow label="Git" value={engineering.project.hasGit ? "yes" : "no"} />
          <DataRow label="CI" value={engineering.project.hasCI ? "yes" : "no"} />
        </SectionBox>
      </Box>

      {/* Row 3: Quick Stats */}
      <SectionBox title="Quick Stats">
        <Box gap={2}>
          <DataRow label="Assets" value={stats.totalAssets} />
          <DataRow label="Rules" value={stats.totalRules} />
          <DataRow label="Skills" value={stats.totalSkills} />
          <DataRow label="ADRs" value={stats.totalAdrs} />
          <DataRow label="Contracts" value={stats.totalContracts} />
          <DataRow label="Sessions" value={stats.totalSessions} />
          <DataRow label="Events" value={stats.totalEvents} />
          <DataRow label="Goals" value={stats.totalGoals} />
          <DataRow label="Decisions" value={stats.totalDecisions} />
        </Box>
      </SectionBox>
    </Box>
  );
}
