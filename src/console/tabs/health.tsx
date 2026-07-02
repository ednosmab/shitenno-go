/**
 * health.tsx — Tab 5: Health
 *
 * Shows system health: entropy, issues, optimizations.
 */

import React from "react";
import { Box, Text } from "ink";
import { HealthBar } from "../components/health-bar.js";
import { SectionBox, DataRow } from "../components/section-box.js";
import type { ConsoleData } from "../data-collector.js";

interface HealthTabProps {
  data: ConsoleData;
  scrollOffset?: number;
}

export function HealthTab({ data, scrollOffset = 0 }: HealthTabProps): React.ReactElement {
  const { health, entropy } = data;

  return (
    <Box flexDirection="column" gap={1}>
      {/* System Health */}
      <SectionBox title="System Health">
        <Box>
          <Text bold>Overall Health: </Text>
          <Text bold color="cyan">{health.overall}/100</Text>
        </Box>
        <HealthBar label="" value={health.overall} width={30} />
        <Box marginTop={1}>
          <HealthBar label="Knowledge Debt" value={health.knowledgeDebt} />
          <HealthBar label="Knowledge Graph" value={health.knowledgeGraph} />
          <HealthBar label="Entropy" value={health.entropy} />
        </Box>
      </SectionBox>

      {/* Entropy Decomposition */}
      <SectionBox title="Entropy Decomposition">
        <DataRow
          label="Orphaned Assets"
          value={`${entropy.orphanedAssets} (${data.engineering.assets.length > 0 ? Math.round((entropy.orphanedAssets / data.engineering.assets.length) * 100) : 0}%)`}
        />
        <DataRow
          label="Stale Assets"
          value={`${entropy.staleAssets} (${data.engineering.assets.length > 0 ? Math.round((entropy.staleAssets / data.engineering.assets.length) * 100) : 0}%)`}
        />
        <DataRow
          label="Missing Deps"
          value={`${entropy.missingDependencies} (${data.engineering.assets.length > 0 ? Math.round((entropy.missingDependencies / data.engineering.assets.length) * 100) : 0}%)`}
        />
        <Box marginTop={1}>
          <Text bold>Entropy Score: </Text>
          <Text bold color={entropy.score < 30 ? "green" : entropy.score < 60 ? "yellow" : "red"}>
            {entropy.score}/100 (lower = better)
          </Text>
        </Box>
      </SectionBox>

      {/* Active Rules */}
      <SectionBox title="Active Rules">
        <DataRow label="Active Rules" value={data.engineering.activeRules} />
        <DataRow label="Active Policies" value={data.engineering.activePolicies} />
      </SectionBox>
    </Box>
  );
}
