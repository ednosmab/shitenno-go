/**
 * state-manager.ts — Pilar 7: Separação dos Estados
 *
 * Distingue claramente diferentes naturezas de informação:
 * - Knowledge: Conhecimento permanente (ADRs, skills, docs)
 * - State: Estado actual do projecto (maturidade, capacidades)
 * - Memory: Estado temporário da sessão (context buffer)
 *
 * PRINCÍPIO: Separação reduce acoplamento e facilita integrações com IA.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";
import { analyseProject } from "./analyser.js";
import { logger } from "./logger.js";

// ── Types ───────────────────────────────────────────────────────────────────

/** Knowledge — Conhecimento permanente. */
export interface KnowledgeState {
  /** ADRs criados. */
  adrs: Array<{ id: string; title: string; status: string; path: string }>;
  /** Skills disponíveis. */
  skills: Array<{ id: string; name: string; path: string }>;
  /** Contratos de agentes. */
  contracts: Array<{ id: string; name: string; role: string; path: string }>;
  /** Documentos de governança. */
  governanceDocs: Array<{ name: string; path: string; critical: boolean }>;
  /** Scripts de automação. */
  scripts: Array<{ id: string; name: string; path: string }>;
  /** Runbooks. */
  runbooks: Array<{ id: string; name: string; path: string }>;
}

/** State — Estado actual do projecto. */
export interface ProjectState {
  /** Maturidade actual. */
  maturity: {
    overallScore: number;
    dimensions: Record<string, number>;
    computedAt: string;
  } | null;
  /** Capacidades instaladas. */
  installedCapabilities: string[];
  /** Capacidades recomendadas. */
  recommendedCapabilities: string[];
  /** Dívida de conhecimento. */
  knowledgeDebt: {
    totalGaps: number;
    healthScore: number;
    detectedAt: string;
  } | null;
  /** Complexidade actual. */
  complexity: {
    score: number;
    level: string;
    computedAt: string;
  } | null;
  /** Estado do projecto. */
  projectInfo: {
    name: string;
    stack: string[];
    hasGit: boolean;
    hasCI: boolean;
    hasTests: boolean;
    hasTypeScript: boolean;
    packageCount: number;
    sourceFileCount: number;
  };
}

/** Memory — Estado temporário da sessão. */
export interface SessionMemory {
  /** ID da sessão. */
  sessionId: string | null;
  /** Branch actual. */
  branch: string | null;
  /** Tipo de operação. */
  operationType: string | null;
  /** Tarefa actual. */
  currentTask: {
    id: string | null;
    type: string | null;
    description: string | null;
    status: string | null;
  };
  /** Quick board. */
  quickBoard: {
    emCurso: string | null;
    parado: string[];
    proximo: string[];
  };
  /** Lembretes. */
  reminders: string[];
  /** Passos restantes. */
  nextSteps: string[];
  /** Blockers. */
  blockers: string[];
  /** Documentos carregados. */
  documentsLoaded: string[];
}

/** Estado consolidado. */
export interface ShitennoState {
  /** Conhecimento permanente. */
  knowledge: KnowledgeState;
  /** Estado do projecto. */
  project: ProjectState;
  /** Memória da sessão. */
  memory: SessionMemory;
  /** Timestamp da consolidação. */
  consolidatedAt: string;
}

// ── Knowledge Reader ────────────────────────────────────────────────────────

function readAdrs(shitennoDir: string): KnowledgeState["adrs"] {
  const adrDir = join(shitennoDir, "docs", "adrs");
  if (!existsSync(adrDir)) return [];
  const files = readdirSync(adrDir).filter((f) => f.endsWith(".md") && !f.startsWith("ADR-TEMPLATE"));
  return files.map((file) => {
    const content = readFileSync(join(adrDir, file), "utf-8");
    const titleMatch = content.match(/^#\s+(.+)/m);
    const statusMatch = content.match(/Estado:\s*(\w+)/i) || content.match(/Status:\s*(\w+)/i);
    return {
      id: file.replace(".md", ""),
      title: titleMatch?.[1] ?? file.replace(".md", ""),
      status: statusMatch?.[1] ?? "unknown",
      path: `docs/adrs/${file}`,
    };
  });
}

function readSkills(shitennoDir: string): KnowledgeState["skills"] {
  const skillsDir = join(shitennoDir, "docs", "skills");
  if (!existsSync(skillsDir)) return [];
  return readdirSync(skillsDir).filter((f) => f.endsWith(".md")).map((file) => ({
    id: file.replace(".md", ""),
    name: file.replace(".md", "").replace(/_/g, " "),
    path: `docs/skills/${file}`,
  }));
}

function readContracts(shitennoDir: string): KnowledgeState["contracts"] {
  const contractsDir = join(shitennoDir, "governance", "agents");
  if (!existsSync(contractsDir)) return [];
  const files = readdirSync(contractsDir).filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));
  return files.map((file) => {
    const content = readFileSync(join(contractsDir, file), "utf-8");
    const nameMatch = content.match(/name:\s*(.+)/);
    const roleMatch = content.match(/agent:\s*(.+)/);
    return {
      id: file.replace(/\.(yaml|yml)$/, ""),
      name: nameMatch?.[1]?.trim() ?? file,
      role: roleMatch?.[1]?.trim() ?? "unknown",
      path: `governance/agents/${file}`,
    };
  });
}

function readGovernanceDocs(shitennoDir: string): KnowledgeState["governanceDocs"] {
  const maturityPath = join(shitennoDir, "maturity-profile.json");
  let caps: string[] = [];
  if (existsSync(maturityPath)) {
    try {
      const profile = JSON.parse(readFileSync(maturityPath, "utf-8"));
      caps = profile.installedCapabilities || [];
    } catch { /* ignore */ }
  }
  return buildExpectedDocs(caps).filter((doc) => existsSync(join(shitennoDir, doc.path)));
}

function readScripts(shitennoDir: string): KnowledgeState["scripts"] {
  const scriptsDir = join(shitennoDir, "scripts");
  if (!existsSync(scriptsDir)) return [];
  return readdirSync(scriptsDir).filter((f) => /\.(ts|tsx|js|jsx|vue|svelte)$/.test(f)).map((file) => ({
    id: file.replace(/\.(ts|js)$/, ""),
    name: file.replace(/\.(ts|js)$/, "").replace(/-/g, " "),
    path: `scripts/${file}`,
  }));
}

function readRunbooks(shitennoDir: string): KnowledgeState["runbooks"] {
  const runbooksDir = join(shitennoDir, "docs", "runbooks");
  if (!existsSync(runbooksDir)) return [];
  return readdirSync(runbooksDir).filter((f) => f.endsWith(".md")).map((file) => ({
    id: file.replace(".md", ""),
    name: file.replace(".md", "").replace(/-/g, " "),
    path: `docs/runbooks/${file}`,
  }));
}

export function readKnowledgeState(shitennoDir: string): KnowledgeState {
  return {
    adrs: readAdrs(shitennoDir),
    skills: readSkills(shitennoDir),
    contracts: readContracts(shitennoDir),
    governanceDocs: readGovernanceDocs(shitennoDir),
    scripts: readScripts(shitennoDir),
    runbooks: readRunbooks(shitennoDir),
  };
}

// ── Project State Reader ────────────────────────────────────────────────────

/** Build expected docs list with conditional criticality based on installed capabilities. */
function buildExpectedDocs(installedCapabilities: string[]) {
  return [
    { name: "AGENTS.md", path: "docs/AGENTS.md", critical: true },
    { name: "FORBIDDEN_OPERATIONS.md", path: "docs/FORBIDDEN_OPERATIONS.md", critical: true },
    { name: "DESDO.md", path: "docs/DESDO.md", critical: true },
    { name: "CONCEPTUAL_MODEL.md", path: "docs/CONCEPTUAL_MODEL.md", critical: false },
    { name: "KNOWLEDGE_LIFECYCLE.md", path: "docs/KNOWLEDGE_LIFECYCLE.md", critical: false },
    { name: "WORKFLOW.md", path: "governance/WORKFLOW.md",
      critical: installedCapabilities.includes("governance") },
    { name: "SYSTEM_MAP.md", path: "governance/SYSTEM_MAP.md", critical: false },
  ];
}

function loadMaturity(shitennoDir: string): Pick<ProjectState, "maturity" | "installedCapabilities" | "recommendedCapabilities"> {
  const maturityPath = join(shitennoDir, "maturity-profile.json");
  if (!existsSync(maturityPath)) {
    return { maturity: null, installedCapabilities: [], recommendedCapabilities: [] };
  }
  try {
    const content = JSON.parse(readFileSync(maturityPath, "utf-8"));
    return {
      maturity: { overallScore: content.overallScore, dimensions: content.dimensions, computedAt: content.computedAt },
      installedCapabilities: content.installedCapabilities || [],
      recommendedCapabilities: content.recommendedCapabilities || [],
    };
  } catch {
    logger.debug("state-manager", "Failed to parse maturity profile");
    return { maturity: null, installedCapabilities: [], recommendedCapabilities: [] };
  }
}

function loadKnowledgeDebt(shitennoDir: string): ProjectState["knowledgeDebt"] {
  const reportsDir = join(shitennoDir, "reports");
  if (!existsSync(reportsDir)) return null;
  const debtFiles = readdirSync(reportsDir)
    .filter((f) => f.startsWith("knowledge-debt-") && f.endsWith(".json"))
    .sort().slice(-1);
  if (debtFiles.length === 0) return null;
  const debtFile = debtFiles[0];
  if (!debtFile) return null;
  try {
    const content = JSON.parse(readFileSync(join(reportsDir, debtFile), "utf-8"));
    return { totalGaps: content.totalGaps, healthScore: content.healthScore, detectedAt: content.generatedAt };
  } catch {
    logger.debug("state-manager", "Failed to parse knowledge debt report:", debtFile);
    return null;
  }
}

function loadProjectInfo(projectRoot: string): ProjectState["projectInfo"] {
  try {
    const analysis = analyseProject(projectRoot);
    return {
      name: projectRoot.split("/").pop() || "",
      stack: analysis.stack,
      hasGit: analysis.hasGit,
      hasCI: analysis.hasCI,
      hasTests: analysis.hasTests,
      hasTypeScript: analysis.hasTypeScript,
      packageCount: analysis.packageCount,
      sourceFileCount: analysis.sourceFileCount,
    };
  } catch {
    logger.debug("state-manager", "Project analysis unavailable");
    return { name: "", stack: [], hasGit: false, hasCI: false, hasTests: false, hasTypeScript: false, packageCount: 0, sourceFileCount: 0 };
  }
}

export function readProjectState(
  projectRoot: string,
  shitennoDir: string
): ProjectState {
  const maturityData = loadMaturity(shitennoDir);
  return {
    ...maturityData,
    knowledgeDebt: loadKnowledgeDebt(shitennoDir),
    complexity: null,
    projectInfo: loadProjectInfo(projectRoot),
  };
}

// ── Session Memory Reader ───────────────────────────────────────────────────

function parseContextBuffer(bufferPath: string): Record<string, unknown> | null {
  if (!existsSync(bufferPath)) return null;
  try {
    const content = readFileSync(bufferPath, "utf-8");
    const parsed = YAML.parse(content);
    return (parsed && typeof parsed === "object") ? parsed : null;
  } catch {
    logger.debug("state-manager", "Failed to read session memory");
    return null;
  }
}

function extractStringArray(parsed: Record<string, unknown>, key: string): string[] {
  return Array.isArray(parsed[key]) ? (parsed[key] as unknown[]).map(String) : [];
}

function extractSession(parsed: Record<string, unknown>): Pick<SessionMemory, "sessionId" | "branch" | "operationType"> {
  const session = (parsed.session && typeof parsed.session === "object") ? parsed.session as Record<string, unknown> : {};
  return {
    sessionId: (session.id as string) || null,
    branch: (session.branch as string) || null,
    operationType: (session.operation_type as string) || null,
  };
}

function extractCurrentTask(parsed: Record<string, unknown>): SessionMemory["currentTask"] {
  const task = (parsed.current_task && typeof parsed.current_task === "object") ? parsed.current_task as Record<string, unknown> : {};
  return {
    id: (task.id as string) || null,
    type: (task.type as string) || null,
    description: (task.description as string) || null,
    status: (task.status as string) || null,
  };
}

export function readSessionMemory(shitennoDir: string): SessionMemory {
  const bufferPath = join(shitennoDir, "governance", "context", "context_buffer.yaml");
  const parsed = parseContextBuffer(bufferPath);
  if (!parsed) {
    return {
      sessionId: null, branch: null, operationType: null,
      currentTask: { id: null, type: null, description: null, status: null },
      quickBoard: { emCurso: null, parado: [], proximo: [] },
      reminders: [], nextSteps: [], blockers: [], documentsLoaded: [],
    };
  }

  const session = extractSession(parsed);
  return {
    ...session,
    currentTask: extractCurrentTask(parsed),
    quickBoard: { emCurso: null, parado: [], proximo: [] },
    reminders: extractStringArray(parsed, "reminders"),
    nextSteps: extractStringArray(parsed, "next_steps"),
    blockers: extractStringArray(parsed, "blockers"),
    documentsLoaded: extractStringArray(parsed, "documents_loaded"),
  };
}

// ── Consolidation ───────────────────────────────────────────────────────────

/**
 * Consolida todos os estados num único objecto.
 * @deprecated Use consolidateEngineeringState() from engineering-state.ts instead.
 * This function will be removed in a future version.
 */
export function consolidateState(
  projectRoot: string,
  shitennoDir: string
): ShitennoState {
  return {
    knowledge: readKnowledgeState(shitennoDir),
    project: readProjectState(projectRoot, shitennoDir),
    memory: readSessionMemory(shitennoDir),
    consolidatedAt: new Date().toISOString(),
  };
}

// ── Report ──────────────────────────────────────────────────────────────────

/** Gera relatório textual do estado consolidado. */
export function stateToText(state: ShitennoState): string {
  const lines: string[] = [];
  lines.push("# Shugo State Report");
  lines.push(`Consolidated at: ${state.consolidatedAt}`);
  lines.push("");

  // Knowledge
  lines.push("## Knowledge (Permanent)");
  lines.push(`  ADRs: ${state.knowledge.adrs.length}`);
  lines.push(`  Skills: ${state.knowledge.skills.length}`);
  lines.push(`  Contracts: ${state.knowledge.contracts.length}`);
  lines.push(`  Governance docs: ${state.knowledge.governanceDocs.length}`);
  lines.push(`  Scripts: ${state.knowledge.scripts.length}`);
  lines.push(`  Runbooks: ${state.knowledge.runbooks.length}`);
  lines.push("");

  // Project
  lines.push("## Project State (Current)");
  if (state.project.maturity) {
    lines.push(`  Maturity: ${state.project.maturity.overallScore}/100`);
    lines.push(`  Capabilities: ${state.project.installedCapabilities.join(", ")}`);
  }
  if (state.project.knowledgeDebt) {
    lines.push(`  Knowledge debt: ${state.project.knowledgeDebt.totalGaps} gap(s), score ${state.project.knowledgeDebt.healthScore}/100`);
  }
  lines.push(`  Stack: ${state.project.projectInfo.stack.join(", ") || "none detected"}`);
  lines.push("");

  // Memory
  lines.push("## Session Memory (Temporary)");
  lines.push(`  Session: ${state.memory.sessionId || "none"}`);
  lines.push(`  Branch: ${state.memory.branch || "none"}`);
  lines.push(`  Current task: ${state.memory.currentTask.description || "none"}`);
  lines.push(`  Reminders: ${state.memory.reminders.length}`);
  lines.push(`  Next steps: ${state.memory.nextSteps.length}`);
  lines.push(`  Blockers: ${state.memory.blockers.length}`);
  lines.push("");

  return lines.join("\n");
}
