/**
 * architecture.tsx — Tab 3: Architecture
 *
 * Shows knowledge graph: nodes, relations, tree structure, orphans, hubs.
 */

import React from "react";
import { Box, Text } from "ink";
import { HealthBar } from "../components/health-bar.js";
import { SectionBox, DataRow, TreeView, type TreeItem } from "../components/section-box.js";
import type { ConsoleData } from "../data-collector.js";

interface ArchitectureTabProps {
  data: ConsoleData;
  scrollOffset?: number;
}

export function ArchitectureTab({ data, scrollOffset = 0 }: ArchitectureTabProps): React.ReactElement {
  const { graph } = data;

  // Build tree structure from artifacts and relations
  const treeItems = buildGraphTree(graph);

  // Relations by type
  const relationsByType = Object.entries(graph.relationsByType)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8);

  const maxRelations = Math.max(...relationsByType.map(([, c]) => c), 1);

  return (
    <Box flexDirection="column" gap={1}>
      {/* Graph Overview */}
      <SectionBox title="Knowledge Graph">
        <Box gap={4}>
          <DataRow label="Nodes" value={graph.totalArtifacts} />
          <DataRow label="Relations" value={graph.totalRelations} />
          <DataRow
            label="Health"
            value={`${graph.healthScore}/100`}
          />
        </Box>
        <Box marginTop={1}>
          <Text bold>Connectivity: </Text>
        </Box>
        <HealthBar label="" value={graph.healthScore} width={30} />
        <Box>
          <Text dimColor>Orphans: {graph.orphanArtifacts.length} </Text>
          <Text dimColor>Hubs: {graph.hubArtifacts.length} </Text>
          <Text dimColor>Cycles: {graph.cycles.length}</Text>
        </Box>
      </SectionBox>

      {/* Graph Structure */}
      <SectionBox title="Graph Structure">
        <TreeView
          items={treeItems}
          ariaLabel="Knowledge graph tree structure"
        />
        {graph.orphanArtifacts.length > 0 && (
          <Box marginTop={1}>
            <Text color="yellow">
              ⚠ {graph.orphanArtifacts.length} orphan:{" "}
              {graph.orphanArtifacts
                .slice(0, 3)
                .map((a) => a.name)
                .join(", ")}
              {graph.orphanArtifacts.length > 3 ? "..." : ""}
            </Text>
          </Box>
        )}
        {graph.hubArtifacts.length > 0 && (
          <Box>
            <Text color="cyan">
              🔗 {graph.hubArtifacts.length} hub:{" "}
              {graph.hubArtifacts
                .slice(0, 2)
                .map((h) => `${h.artifact.name} (${h.connectionCount})`)
                .join(", ")}
            </Text>
          </Box>
        )}
      </SectionBox>

      {/* Relations by Type */}
      <SectionBox title="Relations by Type">
        {relationsByType.map(([type, count]) => (
          <Box key={type}>
            <Text>{type.padEnd(16)}</Text>
            <Text color="cyan">
              {"█".repeat(Math.round((count / maxRelations) * 15))}
            </Text>
            <Text dimColor>
              {"░".repeat(15 - Math.round((count / maxRelations) * 15))}
            </Text>
            <Text bold> {count}</Text>
          </Box>
        ))}
      </SectionBox>

      {/* Suggestions */}
      {graph.suggestions.length > 0 && (
        <SectionBox title="Suggestions">
          {graph.suggestions.map((suggestion, index) => (
            <Box key={index}>
              <Text color="yellow">→ </Text>
              <Text>{suggestion}</Text>
            </Box>
          ))}
        </SectionBox>
      )}
    </Box>
  );
}

function buildGraphTree(graph: ConsoleData["graph"]): TreeItem[] {
  const rootNames = ["core", "governance", "docs", "scripts", "nexus-system"];
  const items: TreeItem[] = [];

  for (const root of rootNames) {
    const rootArtifacts = graph.orphanArtifacts.filter((a) =>
      a.path.startsWith(root)
    );
    const connectedArtifacts = graph.hubArtifacts
      .filter((h) => h.artifact.path.startsWith(root))
      .map((h) => h.artifact);

    if (rootArtifacts.length === 0 && connectedArtifacts.length === 0) continue;

    const children: TreeItem[] = [];

    for (const artifact of connectedArtifacts) {
      children.push({
        name: artifact.name,
        isHub: graph.hubArtifacts.some((h) => h.artifact.id === artifact.id),
      });
    }

    for (const artifact of rootArtifacts) {
      children.push({
        name: artifact.name,
        isOrphan: true,
      });
    }

    items.push({
      name: root + "/",
      children,
    });
  }

  // Add any remaining orphans
  const rootPrefixes = rootNames.join("|");
  const remainingOrphans = graph.orphanArtifacts.filter(
    (a) => !rootNames.some((r) => a.path.startsWith(r))
  );

  if (remainingOrphans.length > 0) {
    items.push({
      name: "other/",
      children: remainingOrphans.map((a) => ({
        name: a.name,
        isOrphan: true,
      })),
    });
  }

  return items;
}
