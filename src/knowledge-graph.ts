/**
 * knowledge-graph.ts — Pilar 6: Grafo do Conhecimento
 *
 * Representa explicitamente as relações entre artefactos do Nexus.
 * O conhecimento deixa de ser apenas uma coleção de documentos.
 * Passa a formar uma rede navegável.
 *
 * PRINCÍPIO: Todo artefacto pode ser ligado a outro.
 * As relações são bidireccionais e rastreáveis.
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ── Types ───────────────────────────────────────────────────────────────────

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
  | "generates"       // ADR gera Skill
  | "uses"            // Skill usa Contrato
  | "executes"        // Contrato executado por CLI
  | "produces"        // CLI produz Feedback
  | "references"      // Doc referencia ADR
  | "implements"      // Código implementa Skill
  | "validates"       // Script valida Workflow
  | "documents"       // Doc documenta Código
  | "depends_on"      // Artefacto depende de outro
  | "supersedes"      // ADR suplanta outro ADR
  | "extends"         // Skill estende outra Skill
  | "triggers"        // Evento dispara outro evento
  | "reviews"         // Reviewer revê outro artefacto
  | "creates";        // Agente cria artefacto

/** Um artefacto no grafo. */
export interface Artifact {
  /** Identificador único. */
  id: string;
  /** Tipo do artefacto. */
  type: ArtifactType;
  /** Nome legível. */
  name: string;
  /** Caminho relativo ao nexus-system/. */
  path: string;
  /** Descrição curta. */
  description: string;
  /** Tags para filtragem. */
  tags: string[];
  /** Data de criação. */
  createdAt: string;
  /** Data da última modificação. */
  updatedAt: string;
  /** Estado: active, archived, draft. */
  status: "active" | "archived" | "draft";
}

/** Uma relação entre dois artefactos. */
export interface Relation {
  /** Artefacto origem. */
  source: string;
  /** Artefacto destino. */
  target: string;
  /** Tipo da relação. */
  type: RelationType;
  /** Descrição da relação. */
  description: string;
  /** Data da relação. */
  createdAt: string;
}

/** Resultado da análise do grafo. */
export interface GraphAnalysis {
  /** Total de artefactos. */
  totalArtifacts: number;
  /** Total de relações. */
  totalRelations: number;
  /** Artefactos por tipo. */
  artifactsByType: Record<ArtifactType, number>;
  /** Relações por tipo. */
  relationsByType: Record<RelationType, number>;
  /** Artefactos sem relações (órfãos). */
  orphanArtifacts: Artifact[];
  /** Artefactos mais conectados. */
  hubArtifacts: Array<{ artifact: Artifact; connectionCount: number }>;
  /** Ciclos detectados. */
  cycles: string[][];
  /** Caminhos mais longos. */
  longestPaths: string[][];
  /** Score de saúde do grafo (0-100). */
  healthScore: number;
  /** Sugestões de melhoria. */
  suggestions: string[];
}

// ── Graph Storage ───────────────────────────────────────────────────────────

const GRAPH_DIR = "governance/knowledge-graph";
const ARTIFACTS_FILE = "artifacts.json";
const RELATIONS_FILE = "relations.json";

/** Carrega artefactos do grafo. */
export function loadArtifacts(nexusDir: string): Artifact[] {
  const filepath = join(nexusDir, GRAPH_DIR, ARTIFACTS_FILE);
  if (!existsSync(filepath)) return [];

  try {
    return JSON.parse(readFileSync(filepath, "utf-8")) as Artifact[];
  } catch {
    return [];
  }
}

/** Carrega relações do grafo. */
export function loadRelations(nexusDir: string): Relation[] {
  const filepath = join(nexusDir, GRAPH_DIR, RELATIONS_FILE);
  if (!existsSync(filepath)) return [];

  try {
    return JSON.parse(readFileSync(filepath, "utf-8")) as Relation[];
  } catch {
    return [];
  }
}

/** Grava artefactos no grafo. */
export function saveArtifacts(nexusDir: string, artifacts: Artifact[]): void {
  const dir = join(nexusDir, GRAPH_DIR);
  if (!existsSync(dir)) return;

  const filepath = join(dir, ARTIFACTS_FILE);
  writeFileSync(filepath, JSON.stringify(artifacts, null, 2), "utf-8");
}

/** Grava relações no grafo. */
export function saveRelations(nexusDir: string, relations: Relation[]): void {
  const dir = join(nexusDir, GRAPH_DIR);
  if (!existsSync(dir)) return;

  const filepath = join(dir, RELATIONS_FILE);
  writeFileSync(filepath, JSON.stringify(relations, null, 2), "utf-8");
}

// ── Discovery ───────────────────────────────────────────────────────────────

/** Descobre artefactos existentes no projecto. */
export function discoverArtifacts(nexusDir: string): Artifact[] {
  const artifacts: Artifact[] = [];
  const now = new Date().toISOString();

  // ADRs
  const adrDir = join(nexusDir, "docs", "adrs");
  if (existsSync(adrDir)) {
    const files = readdirSync(adrDir).filter(
      (f) => f.endsWith(".md") && !f.startsWith("ADR-TEMPLATE")
    );
    for (const file of files) {
      artifacts.push({
        id: `adr-${file.replace(".md", "")}`,
        type: "adr",
        name: file.replace(".md", "").replace(/-/g, " "),
        path: `docs/adrs/${file}`,
        description: `Architecture Decision Record: ${file}`,
        tags: ["adr", "decision"],
        createdAt: now,
        updatedAt: now,
        status: "active",
      });
    }
  }

  // Skills
  const skillsDir = join(nexusDir, "docs", "skills");
  if (existsSync(skillsDir)) {
    const files = readdirSync(skillsDir).filter((f) => f.endsWith(".md"));
    for (const file of files) {
      artifacts.push({
        id: `skill-${file.replace(".md", "")}`,
        type: "skill",
        name: file.replace(".md", "").replace(/_/g, " "),
        path: `docs/skills/${file}`,
        description: `Engineering skill: ${file}`,
        tags: ["skill", "engineering"],
        createdAt: now,
        updatedAt: now,
        status: "active",
      });
    }
  }

  // Contracts
  const contractsDir = join(nexusDir, "governance", "agents");
  if (existsSync(contractsDir)) {
    const files = readdirSync(contractsDir).filter(
      (f) => f.endsWith(".yaml") || f.endsWith(".yml")
    );
    for (const file of files) {
      artifacts.push({
        id: `contract-${file.replace(/\.(yaml|yml)$/, "")}`,
        type: "contract",
        name: file.replace(/\.(yaml|yml)$/, "").replace(/-/g, " "),
        path: `governance/agents/${file}`,
        description: `AI agent contract: ${file}`,
        tags: ["contract", "agent"],
        createdAt: now,
        updatedAt: now,
        status: "active",
      });
    }
  }

  // Workflows
  const workflowPath = join(nexusDir, "governance", "WORKFLOW.md");
  if (existsSync(workflowPath)) {
    artifacts.push({
      id: "workflow-main",
      type: "workflow",
      name: "Main Workflow",
      path: "governance/WORKFLOW.md",
      description: "Main session workflow",
      tags: ["workflow", "session"],
      createdAt: now,
      updatedAt: now,
      status: "active",
    });
  }

  // Runbooks
  const runbooksDir = join(nexusDir, "docs", "runbooks");
  if (existsSync(runbooksDir)) {
    const files = readdirSync(runbooksDir).filter((f) => f.endsWith(".md"));
    for (const file of files) {
      artifacts.push({
        id: `runbook-${file.replace(".md", "")}`,
        type: "runbook",
        name: file.replace(".md", "").replace(/-/g, " "),
        path: `docs/runbooks/${file}`,
        description: `Operational runbook: ${file}`,
        tags: ["runbook", "operations"],
        createdAt: now,
        updatedAt: now,
        status: "active",
      });
    }
  }

  // Plans
  const plansDir = join(nexusDir, "docs", "plans");
  if (existsSync(plansDir)) {
    const files = readdirSync(plansDir).filter(
      (f) => f.endsWith(".md") && !f.startsWith("TEMPLATE")
    );
    for (const file of files) {
      artifacts.push({
        id: `plan-${file.replace(".md", "")}`,
        type: "plan",
        name: file.replace(".md", "").replace(/-/g, " "),
        path: `docs/plans/${file}`,
        description: `Execution plan: ${file}`,
        tags: ["plan", "execution"],
        createdAt: now,
        updatedAt: now,
        status: "active",
      });
    }
  }

  // Scripts
  const scriptsDir = join(nexusDir, "scripts");
  if (existsSync(scriptsDir)) {
    const files = readdirSync(scriptsDir).filter(
      (f) => f.endsWith(".ts") || f.endsWith(".js")
    );
    for (const file of files) {
      artifacts.push({
        id: `script-${file.replace(/\.(ts|js)$/, "")}`,
        type: "script",
        name: file.replace(/\.(ts|js)$/, "").replace(/-/g, " "),
        path: `scripts/${file}`,
        description: `Automation script: ${file}`,
        tags: ["script", "automation"],
        createdAt: now,
        updatedAt: now,
        status: "active",
      });
    }
  }

  // Docs
  const docsDir = join(nexusDir, "docs");
  if (existsSync(docsDir)) {
    const files = readdirSync(docsDir).filter(
      (f) => f.endsWith(".md") && !f.startsWith("README")
    );
    for (const file of files) {
      artifacts.push({
        id: `doc-${file.replace(".md", "")}`,
        type: "doc",
        name: file.replace(".md", "").replace(/_/g, " "),
        path: `docs/${file}`,
        description: `Documentation: ${file}`,
        tags: ["doc", "documentation"],
        createdAt: now,
        updatedAt: now,
        status: "active",
      });
    }
  }

  return artifacts;
}

// ── Relation Discovery ──────────────────────────────────────────────────────

/** Descobre relações entre artefactos analisando conteúdo. */
export function discoverRelations(artifacts: Artifact[]): Relation[] {
  const relations: Relation[] = [];
  const now = new Date().toISOString();

  for (const artifact of artifacts) {
    // ADR → Skill (ADRs geram skills)
    if (artifact.type === "adr") {
      const relatedSkills = artifacts.filter(
        (a) => a.type === "skill" && a.name.toLowerCase().includes(artifact.name.split(" ").slice(0, 2).join(" ").toLowerCase())
      );
      for (const skill of relatedSkills) {
        relations.push({
          source: artifact.id,
          target: skill.id,
          type: "generates",
          description: `ADR generates skill`,
          createdAt: now,
        });
      }
    }

    // Skill → Contract (skills usam contratos)
    if (artifact.type === "skill") {
      const relatedContracts = artifacts.filter(
        (a) => a.type === "contract"
      );
      for (const contract of relatedContracts) {
        relations.push({
          source: artifact.id,
          target: contract.id,
          type: "uses",
          description: `Skill uses contract`,
          createdAt: now,
        });
      }
    }

    // Contract → Script (contratos executam scripts)
    if (artifact.type === "contract") {
      const relatedScripts = artifacts.filter(
        (a) => a.type === "script"
      );
      for (const script of relatedScripts) {
        relations.push({
          source: artifact.id,
          target: script.id,
          type: "executes",
          description: `Contract executes script`,
          createdAt: now,
        });
      }
    }

    // Workflow → ADR (workflow referencia ADRs)
    if (artifact.type === "workflow") {
      const relatedAdrs = artifacts.filter(
        (a) => a.type === "adr"
      );
      for (const adr of relatedAdrs) {
        relations.push({
          source: artifact.id,
          target: adr.id,
          type: "references",
          description: `Workflow references ADR`,
          createdAt: now,
        });
      }
    }

    // Doc → Code (docs documentam código)
    if (artifact.type === "doc") {
      const relatedCode = artifacts.filter(
        (a) => a.type === "code" || a.type === "script"
      );
      for (const code of relatedCode) {
        relations.push({
          source: artifact.id,
          target: code.id,
          type: "documents",
          description: `Doc documents code`,
          createdAt: now,
        });
      }
    }
  }

  return relations;
}

// ── Analysis ────────────────────────────────────────────────────────────────

/** Analisa o grafo e gera métricas. */
export function analyzeGraph(
  artifacts: Artifact[],
  relations: Relation[]
): GraphAnalysis {
  // Contagens por tipo
  const artifactsByType = {} as Record<ArtifactType, number>;
  const relationsByType = {} as Record<RelationType, number>;

  for (const a of artifacts) {
    artifactsByType[a.type] = (artifactsByType[a.type] || 0) + 1;
  }
  for (const r of relations) {
    relationsByType[r.type] = (relationsByType[r.type] || 0) + 1;
  }

  // Artefactos sem relações (órfãos)
  const connectedIds = new Set<string>();
  for (const r of relations) {
    connectedIds.add(r.source);
    connectedIds.add(r.target);
  }
  const orphanArtifacts = artifacts.filter((a) => !connectedIds.has(a.id));

  // Artefactos mais conectados (hubs)
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

  // Detectar ciclos (DFS simples)
  const cycles = detectCycles(artifacts, relations);

  // Score de saúde
  const healthScore = calculateGraphHealth(artifacts, relations, orphanArtifacts, cycles);

  // Sugestões
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

/** Detecta ciclos no grafo. */
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

  return cycles.slice(0, 5); // Limitar a 5 ciclos
}

/** Calcula score de saúde do grafo. */
function calculateGraphHealth(
  artifacts: Artifact[],
  relations: Relation[],
  orphanArtifacts: Artifact[],
  cycles: string[][]
): number {
  let score = 100;

  // Penalizar órfãos
  const orphanRatio = artifacts.length > 0 ? orphanArtifacts.length / artifacts.length : 0;
  score -= orphanRatio * 30;

  // Penalizar ciclos
  score -= cycles.length * 10;

  // Bonificar diversidade de relações
  const relationTypes = new Set(relations.map((r) => r.type));
  score += Math.min(10, relationTypes.size * 2);

  // Bonificar connects
  if (artifacts.length > 0 && relations.length > 0) {
    const avgConnections = (relations.length * 2) / artifacts.length;
    score += Math.min(10, avgConnections * 5);
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

/** Gera sugestões de melhoria. */
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

// ── Visualization ───────────────────────────────────────────────────────────

/** Gera representação textual do grafo. */
export function graphToText(
  artifacts: Artifact[],
  relations: Relation[]
): string {
  const lines: string[] = [];
  lines.push("# Knowledge Graph");
  lines.push("");
  lines.push(`Artifacts: ${artifacts.length} | Relations: ${relations.length}`);
  lines.push("");

  // Agrupar por tipo
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

// ── Event Bus Integration ──────────────────────────────────────────────────

import { getEventBus, type NexusEventType } from "./event-bus.js";

/** Rebuild the knowledge graph from disk. */
function rebuildGraph(nexusDir: string): void {
  const artifacts = discoverArtifacts(nexusDir);
  const relations = discoverRelations(artifacts);
  saveArtifacts(nexusDir, artifacts);
  saveRelations(nexusDir, relations);
}

/** Subscribe to event bus events that should trigger graph rebuilds. */
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
