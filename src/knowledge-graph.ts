/**
 * knowledge-graph.ts — Pilar 6: Knowledge Graph
 *
 * Thin facade — all logic split into knowledge-graph/ modules.
 */

export type {
  ArtifactType,
  RelationType,
  Artifact,
  Relation,
  GraphAnalysis,
} from "./knowledge-graph/types.js";

export {
  loadArtifacts,
  loadRelations,
  saveArtifacts,
  saveRelations,
} from "./knowledge-graph/storage.js";

export { discoverArtifacts, discoverRelations } from "./knowledge-graph/discovery.js";
export { analyzeGraph } from "./knowledge-graph/analysis.js";
export { graphToText } from "./knowledge-graph/visualization.js";

import { discoverArtifacts, discoverRelations } from "./knowledge-graph/discovery.js";
import { saveArtifacts, saveRelations } from "./knowledge-graph/storage.js";
import { getEventBus, type NexusEventType } from "./event-bus.js";

function rebuildGraph(nexusDir: string): void {
  const artifacts = discoverArtifacts(nexusDir);
  const relations = discoverRelations(artifacts);
  saveArtifacts(nexusDir, artifacts);
  saveRelations(nexusDir, relations);
}

export function initializeKnowledgeGraph(nexusDir: string): void {
  const bus = getEventBus();

  const eventTypes: NexusEventType[] = [
    "adr.created",
    "skill.created",
    "capability.installed",
  ];

  for (const eventType of eventTypes) {
    bus.subscribe(eventType, () => {
      rebuildGraph(nexusDir);
    });
  }
}
