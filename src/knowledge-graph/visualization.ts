import type { Artifact, Relation, ArtifactType } from "./types.js";

export function graphToText(
  artifacts: Artifact[],
  relations: Relation[]
): string {
  const lines: string[] = [];
  lines.push("# Knowledge Graph");
  lines.push("");
  lines.push(`Artifacts: ${artifacts.length} | Relations: ${relations.length}`);
  lines.push("");

  const byType = new Map<ArtifactType, Artifact[]>();
  for (const a of artifacts) {
    const list = byType.get(a.type) || [];
    list.push(a);
    byType.set(a.type, list);
  }

  for (const [type, typeArtifacts] of byType) {
    lines.push(`## ${type.toUpperCase()} (${typeArtifacts.length})`);
    for (const a of typeArtifacts) {
      const outRelations = relations.filter((r) => r.source === a.id);
      const inRelations = relations.filter((r) => r.target === a.id);

      lines.push(`  ${a.name}`);
      for (const r of outRelations) {
        const target = artifacts.find((a) => a.id === r.target);
        lines.push(`    ──${r.type}──▶ ${target?.name || r.target}`);
      }
      for (const r of inRelations) {
        const source = artifacts.find((a) => a.id === r.source);
        lines.push(`    ◀──${r.type}── ${source?.name || r.source}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}
