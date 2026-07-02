/**
 * decisions.tsx — Tab 7: Decisions
 *
 * Shows recent decisions with scores, recommendations, confidence.
 * Supports item expansion via Enter key.
 */

import React from "react";
import { Box, Text } from "ink";
import { SectionBox, DataRow } from "../components/section-box.js";
import type { ConsoleData } from "../data-collector.js";

interface DecisionsTabProps {
  data: ConsoleData;
  scrollOffset?: number;
  expandedItem?: string | null;
  onExpandItem?: (id: string) => void;
}

const RECOMMENDATION_COLORS: Record<string, string> = {
  proceed: "green",
  proceed_with_caution: "yellow",
  block: "red",
  defer: "gray",
};

export function DecisionsTab({ data, scrollOffset = 0, expandedItem, onExpandItem }: DecisionsTabProps): React.ReactElement {
  const { decisions } = data;

  if (decisions.length === 0) {
    return (
      <SectionBox title="Decisions">
        <Text dimColor>No decisions recorded yet.</Text>
        <Text dimColor>Use "nexus decide" to evaluate an action.</Text>
      </SectionBox>
    );
  }

  const avgScore = decisions.length > 0
    ? Math.round(decisions.reduce((sum, d) => sum + d.compositeScore, 0) / decisions.length)
    : 0;
  const avgConfidence = decisions.length > 0
    ? Math.round(decisions.reduce((sum, d) => sum + d.confidence, 0) / decisions.length)
    : 0;

  const visibleDecisions = decisions.slice(0, 5).slice(scrollOffset);

  return (
    <Box flexDirection="column" gap={1}>
      {/* Recent Decisions */}
      <SectionBox title="Recent Decisions">
        {visibleDecisions.map((decision) => {
          const isExpanded = expandedItem === decision.id;
          return (
            <Box
              key={decision.id}
              flexDirection="column"
              marginBottom={1}
              borderStyle={isExpanded ? "bold" : undefined}
              borderColor={isExpanded ? "cyan" : undefined}
              paddingX={isExpanded ? 1 : 0}
            >
              <Box>
                <Text color="cyan">{isExpanded ? "▼" : "▶"} </Text>
                <Text color={RECOMMENDATION_COLORS[decision.recommendation] ?? "white"}>
                  {decision.recommendation === "proceed" ? "✅" : "⚠️"}
                </Text>
                <Text bold> {decision.request.action}</Text>
              </Box>
              <Box paddingLeft={2}>
                <Text>
                  Recommendation:{" "}
                  <Text bold color={RECOMMENDATION_COLORS[decision.recommendation] ?? "white"}>
                    {decision.recommendation.replace(/_/g, " ").toUpperCase()}
                  </Text>
                </Text>
                <Text> │ Score: {decision.compositeScore} │ Confidence: {decision.confidence}%</Text>
              </Box>
              <Box paddingLeft={2}>
                <Text dimColor>
                  Evaluators:{" "}
                  {decision.scores
                    .map((s) => `${s.evaluator}(${s.score})`)
                    .join(" ")}
                </Text>
              </Box>
              {isExpanded && (
                <Box flexDirection="column" paddingLeft={2} marginTop={1}>
                  <Box>
                    <Text bold>Category: </Text>
                    <Text color="cyan">{decision.request.category}</Text>
                  </Box>
                  <Box marginTop={1}>
                    <Text bold>Evaluator Scores:</Text>
                  </Box>
                  {decision.scores.map((score) => (
                    <Box key={score.evaluator} paddingLeft={2}>
                      <Text>{score.evaluator}: </Text>
                      <Text bold color={score.score >= 70 ? "green" : score.score >= 40 ? "yellow" : "red"}>
                        {score.score}/100
                      </Text>
                      {score.reasoning && (
                        <Text dimColor> — {score.reasoning}</Text>
                      )}
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          );
        })}
        {scrollOffset > 0 && (
          <Box>
            <Text dimColor>↑ {scrollOffset} more decisions above</Text>
          </Box>
        )}
      </SectionBox>

      {/* Decision Statistics */}
      <SectionBox title="Decision Statistics">
        <Box gap={4}>
          <DataRow label="Total" value={decisions.length} />
          <DataRow label="Avg Score" value={avgScore} />
          <DataRow label="Avg Confidence" value={`${avgConfidence}%`} />
        </Box>
      </SectionBox>
    </Box>
  );
}
