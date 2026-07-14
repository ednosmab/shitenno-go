/** Tipos de artefactos no grafo. */
export type ArtifactType =
  | "adr"
  | "skill"
  | "contract"
  | "workflow"
  | "runbook"
  | "plan"
  | "sdr"
  | "doc"
  | "script"
  | "template"
  | "feedback"
  | "report"
  | "code"
  | "config";

/** Tipos de relações entre artefactos. */
export type RelationType =
  | "generates"
  | "uses"
  | "executes"
  | "produces"
  | "references"
  | "implements"
  | "validates"
  | "documents"
  | "depends_on"
  | "supersedes"
  | "extends"
  | "triggers"
  | "reviews"
  | "creates";

/** Um artefacto no grafo. */
export interface Artifact {
  id: string;
  type: ArtifactType;
  name: string;
  path: string;
  description: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  status: "active" | "archived" | "draft";
}

/** Uma relação entre dois artefactos. */
export interface Relation {
  source: string;
  target: string;
  type: RelationType;
  description: string;
  createdAt: string;
}

/** Resultado da análise do grafo. */
export interface GraphAnalysis {
  totalArtifacts: number;
  totalRelations: number;
  artifactsByType: Record<ArtifactType, number>;
  relationsByType: Record<RelationType, number>;
  orphanArtifacts: Artifact[];
  hubArtifacts: Array<{ artifact: Artifact; connectionCount: number }>;
  cycles: string[][];
  longestPaths: string[][];
  healthScore: number;
  suggestions: string[];
}
