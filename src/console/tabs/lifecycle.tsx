/**
 * lifecycle.tsx — Tab 10: Lifecycle
 *
 * Shows lifecycle state, transition history, growth profile.
 */

import React from "react";
import { Box, Text } from "ink";
import { HealthBar, MiniBar } from "../components/health-bar.js";
import { SectionBox, DataRow } from "../components/section-box.js";
import type { ConsoleData } from "../data-collector.js";

interface LifecycleTabProps {
  data: ConsoleData;
  scrollOffset?: number;
}

const STATE_ORDER = ["uninitialized", "discovered", "assessed", "governed", "evolved", "operational"];

export function LifecycleTab({ data, scrollOffset = 0 }: LifecycleTabProps): React.ReactElement {
  const { lifecycle, growth, capabilityEntities } = data;

  const currentIndex = STATE_ORDER.indexOf(lifecycle);

  return (
    <Box flexDirection="column" gap={1}>
      {/* Current State */}
      <SectionBox title="Current State">
        <Box>
          <Text bold color="green">● {lifecycle}</Text>
        </Box>
        <Box marginTop={1}>
          {STATE_ORDER.map((state, index) => (
            <Box key={state}>
              <Text
                color={index <= currentIndex ? "green" : "gray"}
                bold={index === currentIndex}
              >
                {state}
              </Text>
              {index < STATE_ORDER.length - 1 && (
                <Text dimColor> → </Text>
              )}
            </Box>
          ))}
        </Box>
      </SectionBox>

      {/* Growth Profile */}
      {growth && (
        <SectionBox title="Growth Profile">
          <Box>
            <Text bold>Growth Capacity: </Text>
            <Text bold color="cyan">{Math.round(growth.growthCapacity * 100)}%</Text>
          </Box>
          <HealthBar label="" value={growth.growthCapacity * 100} width={20} />
          <Box>
            <Text bold>Challenge Level: </Text>
            <Text bold color="cyan">{Math.round(growth.challengeLevel * 100)}%</Text>
          </Box>
          <HealthBar label="" value={growth.challengeLevel * 100} width={20} />
          {growth.patterns.length > 0 && (
            <Box marginTop={1}>
              <Text>Pattern: </Text>
              <Text bold color="cyan">{growth.patterns[0]?.type ?? "unknown"}</Text>
              <Text dimColor> (confidence: {Math.round((growth.patterns[0]?.confidence ?? 0) * 100)}%)</Text>
            </Box>
          )}
        </SectionBox>
      )}

      {/* Capability Lifecycle */}
      <SectionBox title="Capability Lifecycle">
        {capabilityEntities.map((cap) => (
          <Box key={cap.id}>
            <Text>{cap.name.padEnd(16)}</Text>
            <Text dimColor>→ </Text>
            <Text color={cap.maturity === "optimized" ? "green" : cap.maturity === "active" ? "cyan" : "yellow"}>
              {cap.maturity}
            </Text>
          </Box>
        ))}
      </SectionBox>
    </Box>
  );
}
