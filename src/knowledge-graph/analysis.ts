import type { Artifact, Relation, ArtifactType, RelationType, GraphAnalysis } from "./types.js";

export function analyzeGraph(
  artifacts: Artifact[],
  relations: Relation[]
): GraphAnalysis {
  const artifactsByType = {} as Record<ArtifactType, number>;
  const relationsByType = {} as Record<RelationType, number>;

  for (const a of artifacts) {
    artifactsByType[a.type] = (artifactsByType[a.type] || 0) + 1;
  }
  for (const r of relations) {
    relationsByType[r.type] = (relationsByType[r.type] || 0) + 1;
  }

  const connectedIds = new Set<string>();
  for (const r of relations) {
    connectedIds.add(r.source);
    connectedIds.add(r.target);
  }
  const orphanArtifacts = artifacts.filter((a) => !connectedIds.has(a.id));

  const connectionCounts = new Map<string, number>();
  for (const r of relations) {
    connectionCounts.set(r.source, (connectionCounts.get(r.source) || 0) + 1);
    connectionCounts.set(r.target, (connectionCounts.get(r.target) || 0) + 1);
  }

  const hubArtifacts = artifacts
    .map((a) => ({
      artifact: a,
      connectionCount: connectionCounts.get(a.id) || 0,
    }))
    .filter((h) => h.connectionCount > 0)
    .sort((a, b) => b.connectionCount - a.connectionCount)
    .slice(0, 10);

  const cycles = detectCycles(artifacts, relations);
  const healthScore = calculateGraphHealth(artifacts, relations, orphanArtifacts, cycles);
  const suggestions = generateSuggestions(artifacts, relations, orphanArtifacts, cycles);

  return {
    totalArtifacts: artifacts.length,
    totalRelations: relations.length,
    artifactsByType,
    relationsByType,
    orphanArtifacts,
    hubArtifacts,
    cycles,
    longestPaths: [],
    healthScore,
    suggestions,
  };
}

function detectCycles(artifacts: Artifact[], relations: Relation[]): string[][] {
  const adjList = new Map<string, string[]>();
  for (const a of artifacts) {
    adjList.set(a.id, []);
  }
  for (const r of relations) {
    const neighbors = adjList.get(r.source) || [];
    neighbors.push(r.target);
    adjList.set(r.source, neighbors);
  }

  const cycles: string[][] = [];
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const path: string[] = [];

  function dfs(node: string) {
    if (inStack.has(node)) {
      const cycleStart = path.indexOf(node);
      if (cycleStart >= 0) {
        cycles.push([...path.slice(cycleStart), node]);
      }
      return;
    }
    if (visited.has(node)) return;

    visited.add(node);
    inStack.add(node);
    path.push(node);

    for (const neighbor of adjList.get(node) || []) {
      dfs(neighbor);
    }

    path.pop();
    inStack.delete(node);
  }

  for (const a of artifacts) {
    dfs(a.id);
  }

  return cycles.slice(0, 5);
}

function calculateGraphHealth(
  artifacts: Artifact[],
  relations: Relation[],
  orphanArtifacts: Artifact[],
  cycles: string[][]
): number {
  let score = 100;

  const orphanRatio = artifacts.length > 0 ? orphanArtifacts.length / artifacts.length : 0;
  score -= orphanRatio * 30;

  score -= cycles.length * 10;

  const relationTypes = new Set(relations.map((r) => r.type));
  score += Math.min(10, relationTypes.size * 2);

  if (artifacts.length > 0 && relations.length > 0) {
    const avgConnections = (relations.length * 2) / artifacts.length;
    score += Math.min(10, avgConnections * 5);
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function generateSuggestions(
  artifacts: Artifact[],
  relations: Relation[],
  orphanArtifacts: Artifact[],
  cycles: string[][]
): string[] {
  const suggestions: string[] = [];

  if (orphanArtifacts.length > 0) {
    suggestions.push(
      `${orphanArtifacts.length} artifact(s) orphaned — consider adding relations to connect them`
    );
  }

  if (cycles.length > 0) {
    suggestions.push(
      `${cycles.length} cycle(s) detected — review for potential circular dependencies`
    );
  }

  if (artifacts.length > 5 && relations.length < artifacts.length) {
    suggestions.push(
      "Low relation density — add more connections between artifacts"
    );
  }

  const adrCount = artifacts.filter((a) => a.type === "adr").length;
  const skillCount = artifacts.filter((a) => a.type === "skill").length;
  if (adrCount > 0 && skillCount === 0) {
    suggestions.push(
      "ADRs exist but no skills — extract patterns from ADRs into skills"
    );
  }

  return suggestions;
}
