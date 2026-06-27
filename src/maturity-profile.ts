/**
 * maturity-profile.ts — Perfil de Maturidade do Projeto
 *
 * Substitui o sistema L1/L2/L3 por um perfil multi-dimensional.
 * Cada dimensão representa um aspecto da maturidade do projeto.
 *
 * PRINCÍPIO: O perfil é calculado a partir de respostas do questionário
 * E análise automática do projeto. Nunca é fixo — evolui com o projeto.
 */

import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { ProjectAnalysis } from "./analyser.js";

// ── Types ───────────────────────────────────────────────────────────────────

/** Dimensões de maturidade do projeto (0-100 cada). */
export interface MaturityDimensions {
  /** Estrutura arquitetural, separação de concerns, padrões */
  architecture: number;
  /** Processos de governança, decisões documentadas, workflows */
  governance: number;
  /** Testes, validação, CI/CD, qualidade de código */
  quality: number;
  /** Automação: CI/CD, scripts, pipelines */
  automation: number;
  /** Uso de IA no desenvolvimento */
  ai: number;
  /** Documentação: ADRs, skills, guias */
  documentation: number;
  /** Observabilidade: logs, métricas, relatórios */
  observability: number;
}

/** Capacidades que o Nexus pode instalar. */
export type Capability =
  | "core"           // Sempre instalado — o essencial
  | "knowledge"      // Skills, AGENTS.md, documentação
  | "architecture"   // ADRs, SDRs, planos
  | "governance"     // Contratos de agentes, workflows, context buffer
  | "ai"             // Agentes IA, prompts, orquestração
  | "quality"        // Validação, health checks, testes
  | "metrics"        // Relatórios, scoring, complexidade
  | "operations"     // Scripts, sessões, runbooks
  | "compliance";    // FORBIDDEN_OPERATIONS, DESDO, reviews

/** Informação sobre uma capacidade. */
export interface CapabilityInfo {
  id: Capability;
  name: string;
  description: string;
  /** Dimensões que esta capacidade suporta ( peso: 0-1) */
  dimensions: Partial<Record<keyof MaturityDimensions, number>>;
  /** Se true, sempre instalado */
  alwaysInstalled: boolean;
  /** Capacidades que dependem desta */
  requires: Capability[];
}

/** Resultado do cálculo de maturidade. */
export interface MaturityProfile {
  /** Dimensões calculadas (0-100 cada). */
  dimensions: MaturityDimensions;
  /** Score geral (média ponderada das dimensões). */
  overallScore: number;
  /** Capacidades recomendadas com base no perfil. */
  recommendedCapabilities: Capability[];
  /** Capacidades que o projeto já possui. */
  installedCapabilities: Capability[];
  /** Capacidades futuras (não recomendadas ainda). */
  futureCapabilities: Capability[];
  /** Data do cálculo. */
  computedAt: string;
}

// ── Capability Definitions ──────────────────────────────────────────────────

export const CAPABILITIES: CapabilityInfo[] = [
  {
    id: "core",
    name: "Core",
    description: "Núcleo essencial — configuração base, opencode.json, workspace",
    dimensions: {},
    alwaysInstalled: true,
    requires: [],
  },
  {
    id: "knowledge",
    name: "Knowledge",
    description: "Skills de engenharia, AGENTS.md, guias de referência",
    dimensions: { documentation: 0.4, quality: 0.1 },
    alwaysInstalled: false,
    requires: ["core"],
  },
  {
    id: "architecture",
    name: "Architecture",
    description: "ADRs, SDRs, planos de tarefa, documentação arquitetural",
    dimensions: { architecture: 0.4, documentation: 0.2 },
    alwaysInstalled: false,
    requires: ["core"],
  },
  {
    id: "governance",
    name: "Governance",
    description: "Workflows, SYSTEM_MAP, context buffer, handoffs",
    dimensions: { governance: 0.5, documentation: 0.1 },
    alwaysInstalled: false,
    requires: ["core"],
  },
  {
    id: "ai",
    name: "AI",
    description: "Contratos de agentes IA, prompts, orquestração, cognição",
    dimensions: { ai: 0.5, governance: 0.2 },
    alwaysInstalled: false,
    requires: ["governance"],
  },
  {
    id: "quality",
    name: "Quality",
    description: "Validação de sessão, health checks, sessões estruturadas",
    dimensions: { quality: 0.4, automation: 0.1 },
    alwaysInstalled: false,
    requires: ["core"],
  },
  {
    id: "metrics",
    name: "Metrics",
    description: "Relatórios de complexidade, scoring, telemetria de maturidade",
    dimensions: { observability: 0.4, quality: 0.1 },
    alwaysInstalled: false,
    requires: ["quality"],
  },
  {
    id: "operations",
    name: "Operations",
    description: "Scripts de sessão, runbooks, close-session, premortem",
    dimensions: { automation: 0.4, governance: 0.1 },
    alwaysInstalled: false,
    requires: ["core"],
  },
  {
    id: "compliance",
    name: "Compliance",
    description: "FORBIDDEN_OPERATIONS, DESDO, reviews obrigatórias, premortem",
    dimensions: { governance: 0.3, quality: 0.2 },
    alwaysInstalled: false,
    requires: ["governance"],
  },
];

// ── Profile Calculation ─────────────────────────────────────────────────────

/** Mapeia respostas do questionário para dimensões de maturidade. */
export interface MaturityAnswers {
  // Experiência
  usedNexusBefore: boolean;
  isFirstProject: boolean;

  // Projeto
  projectAge: "new" | "few_months" | "established" | "mature";
  teamSize: "solo" | "small" | "medium" | "large";
  hasDedicatedTeam: boolean;

  // Arquitetura
  hasArchitectureDocs: boolean;
  hasADRs: boolean;
  hasTechnicalReviews: boolean;

  // Qualidade
  hasCICD: boolean;
  hasAutomatedTests: boolean;
  hasValidationPipeline: boolean;

  // IA
  intendsToUseAI: boolean;
  aiWillImplement: boolean;
  requiresHumanReview: boolean;

  // Governança
  hasDefinedPatterns: boolean;
  hasReviewProcess: boolean;
  hasDecisionControl: boolean;
}

/**
 * Calcula o perfil de maturidade a partir de respostas e análise do projeto.
 */
export function calculateMaturityProfile(
  answers: MaturityAnswers,
  analysis: ProjectAnalysis,
  nexusDir?: string
): MaturityProfile {
  const dimensions = calculateDimensions(answers, analysis);
  const overallScore = calculateOverallScore(dimensions);
  const installed: Capability[] = nexusDir ? detectInstalledCapabilities(nexusDir) : ["core"];
  const recommended = recommendCapabilities(dimensions, installed);
  const future = getFutureCapabilities(dimensions, installed, recommended);

  return {
    dimensions,
    overallScore,
    recommendedCapabilities: recommended,
    installedCapabilities: installed,
    futureCapabilities: future,
    computedAt: new Date().toISOString(),
  };
}

function calculateDimensions(
  answers: MaturityAnswers,
  analysis: ProjectAnalysis
): MaturityDimensions {
  // Arquitetura (0-100)
  let architecture = 0;
  if (answers.hasArchitectureDocs) architecture += 30;
  if (answers.hasADRs) architecture += 25;
  if (answers.hasTechnicalReviews) architecture += 20;
  if (analysis.monorepo) architecture += 15;
  if (analysis.packageCount >= 3) architecture += 10;

  // Governança (0-100)
  let governance = 0;
  if (answers.hasDefinedPatterns) governance += 25;
  if (answers.hasReviewProcess) governance += 25;
  if (answers.hasDecisionControl) governance += 25;
  if (answers.usedNexusBefore) governance += 15;
  if (answers.teamSize === "medium" || answers.teamSize === "large") governance += 10;

  // Qualidade (0-100)
  let quality = 0;
  if (answers.hasAutomatedTests) quality += 30;
  if (answers.hasCICD) quality += 25;
  if (answers.hasValidationPipeline) quality += 20;
  if (analysis.hasTests) quality += 15;
  if (analysis.hasLinter) quality += 10;

  // Automação (0-100)
  let automation = 0;
  if (answers.hasCICD) automation += 40;
  if (answers.hasValidationPipeline) automation += 30;
  if (answers.hasAutomatedTests) automation += 20;
  if (analysis.hasTypeScript) automation += 10;

  // IA (0-100)
  let ai = 0;
  if (answers.intendsToUseAI) ai += 30;
  if (answers.aiWillImplement) ai += 35;
  if (answers.requiresHumanReview) ai += 25;
  if (!answers.isFirstProject) ai += 10;

  // Documentação (0-100)
  let documentation = 0;
  if (answers.hasArchitectureDocs) documentation += 30;
  if (answers.hasADRs) documentation += 25;
  if (answers.hasDefinedPatterns) documentation += 20;
  if (answers.usedNexusBefore) documentation += 15;
  if (analysis.sourceFileCount >= 100) documentation += 10;

  // Observabilidade (0-100)
  let observability = 0;
  if (answers.hasCICD) observability += 25;
  if (answers.hasValidationPipeline) observability += 25;
  if (answers.hasAutomatedTests) observability += 20;
  if (answers.teamSize === "medium" || answers.teamSize === "large") observability += 15;
  if (analysis.monorepo) observability += 15;

  // Clamp all to 0-100
  return {
    architecture: Math.min(100, Math.max(0, architecture)),
    governance: Math.min(100, Math.max(0, governance)),
    quality: Math.min(100, Math.max(0, quality)),
    automation: Math.min(100, Math.max(0, automation)),
    ai: Math.min(100, Math.max(0, ai)),
    documentation: Math.min(100, Math.max(0, documentation)),
    observability: Math.min(100, Math.max(0, observability)),
  };
}

function calculateOverallScore(dimensions: MaturityDimensions): number {
  const weights: Record<keyof MaturityDimensions, number> = {
    architecture: 0.18,
    governance: 0.12,
    quality: 0.18,
    automation: 0.15,
    ai: 0.12,
    documentation: 0.15,
    observability: 0.10,
  };

  let total = 0;
  let weightSum = 0;
  for (const [key, weight] of Object.entries(weights)) {
    total += dimensions[key as keyof MaturityDimensions] * weight;
    weightSum += weight;
  }

  return Math.round(total / weightSum);
}

// ── Capability Detection ────────────────────────────────────────────────────

/** Detecta capacidades já instaladas no projeto. */
export function detectInstalledCapabilities(nexusDir: string): Capability[] {
  const installed: Capability[] = ["core"];
  if (!existsSync(nexusDir)) return installed;

  // Knowledge: skills ou AGENTS.md
  if (
    existsSync(join(nexusDir, "docs", "skills")) ||
    existsSync(join(nexusDir, "docs", "AGENTS.md"))
  ) {
    installed.push("knowledge");
  }

  // Architecture: adrs ou sdr ou plans
  if (
    existsSync(join(nexusDir, "docs", "adrs")) ||
    existsSync(join(nexusDir, "docs", "sdr")) ||
    existsSync(join(nexusDir, "docs", "plans"))
  ) {
    installed.push("architecture");
  }

  // Governance: WORKFLOW ou SYSTEM_MAP ou context buffer
  if (
    existsSync(join(nexusDir, "governance", "WORKFLOW.md")) ||
    existsSync(join(nexusDir, "governance", "context"))
  ) {
    installed.push("governance");
  }

  // AI: agent contracts ou cognition
  if (
    existsSync(join(nexusDir, "governance", "agents")) ||
    existsSync(join(nexusDir, "cognition"))
  ) {
    installed.push("ai");
  }

  // Quality: validate script ou health checks
  if (
    existsSync(join(nexusDir, "scripts", "validate-session.ts"))
  ) {
    installed.push("quality");
  }

  // Metrics: reports directory
  if (existsSync(join(nexusDir, "reports"))) {
    installed.push("metrics");
  }

  // Operations: scripts de sessão ou runbooks
  if (
    existsSync(join(nexusDir, "scripts", "close-session.ts")) ||
    existsSync(join(nexusDir, "docs", "runbooks"))
  ) {
    installed.push("operations");
  }

  // Compliance: FORBIDDEN_OPERATIONS ou DESDO ou premortem
  if (
    existsSync(join(nexusDir, "docs", "FORBIDDEN_OPERATIONS.md")) ||
    existsSync(join(nexusDir, "docs", "DESDO.md")) ||
    existsSync(join(nexusDir, "governance", "premortem"))
  ) {
    installed.push("compliance");
  }

  return installed;
}

// ── Recommendation Engine ───────────────────────────────────────────────────

const CAPABILITY_THRESHOLD = 25; // mínimo de relevância para recomendar

function recommendCapabilities(
  dimensions: MaturityDimensions,
  installed: Capability[]
): Capability[] {
  const recommended: Capability[] = [];

  for (const cap of CAPABILITIES) {
    if (cap.alwaysInstalled) continue;
    if (installed.includes(cap.id)) continue;

    // Calcular relevância da capacidade com base nas dimensões
    let relevance = 0;
    let weightCount = 0;
    for (const [dim, weight] of Object.entries(cap.dimensions)) {
      const dimScore = dimensions[dim as keyof MaturityDimensions];
      relevance += dimScore * weight;
      weightCount += weight;
    }

    if (weightCount === 0) continue;
    const avgRelevance = relevance / weightCount;

    // Verificar se as dependências estão satisfeitas
    const depsMet = cap.requires.every((req) =>
      installed.includes(req) || recommended.includes(req)
    );

    if (avgRelevance >= CAPABILITY_THRESHOLD && depsMet) {
      recommended.push(cap.id);
    }
  }

  return recommended;
}

function getFutureCapabilities(
  dimensions: MaturityDimensions,
  installed: Capability[],
  recommended: Capability[]
): Capability[] {
  const activeList: Capability[] = [...installed, ...recommended];
  const future: Capability[] = [];

  for (const cap of CAPABILITIES) {
    if (cap.alwaysInstalled || activeList.includes(cap.id)) continue;
    future.push(cap.id);
  }

  return future;
}

// ── Profile Persistence ─────────────────────────────────────────────────────

const PROFILE_FILENAME = "maturity-profile.json";

/** Grava o perfil de maturidade no nexus-system/. */
export function saveMaturityProfile(
  nexusDir: string,
  profile: MaturityProfile
): void {
  if (!existsSync(nexusDir)) {
    mkdirSync(nexusDir, { recursive: true });
  }

  const filePath = join(nexusDir, PROFILE_FILENAME);
  writeFileSync(filePath, JSON.stringify(profile, null, 2), "utf-8");
}

/** Lê o perfil de maturidade do nexus-system/. */
export function loadMaturityProfile(nexusDir: string): MaturityProfile | null {
  const filePath = join(nexusDir, PROFILE_FILENAME);
  if (!existsSync(filePath)) return null;

  try {
    const content = readFileSync(filePath, "utf-8");
    return JSON.parse(content) as MaturityProfile;
  } catch {
    return null;
  }
}

// ── Telemetry ───────────────────────────────────────────────────────────────

/** Snapshot de maturidade para telemetria. */
export interface MaturitySnapshot {
  timestamp: string;
  dimensions: MaturityDimensions;
  overallScore: number;
  installedCapabilities: Capability[];
}

/** Regista um snapshot de evolução de maturidade. */
export function recordMaturitySnapshot(
  nexusDir: string,
  profile: MaturityProfile
): void {
  const telemetryDir = join(nexusDir, "telemetry");
  if (!existsSync(telemetryDir)) {
    mkdirSync(telemetryDir, { recursive: true });
  }

  const snapshot: MaturitySnapshot = {
    timestamp: profile.computedAt,
    dimensions: { ...profile.dimensions },
    overallScore: profile.overallScore,
    installedCapabilities: [...profile.installedCapabilities],
  };

  const date = new Date().toISOString().slice(0, 10);
  const filename = `maturity-${date}.json`;
  const filePath = join(telemetryDir, filename);

  writeFileSync(filePath, JSON.stringify(snapshot, null, 2), "utf-8");
}

/** Lê todos os snapshots de maturidade. */
export function readMaturityHistory(nexusDir: string): MaturitySnapshot[] {
  const telemetryDir = join(nexusDir, "telemetry");
  if (!existsSync(telemetryDir)) return [];

  const files = readdirSync(telemetryDir)
    .filter((f: string) => f.startsWith("maturity-") && f.endsWith(".json"))
    .sort();

  return files.map((file: string) => {
    try {
      const content = readFileSync(join(telemetryDir, file), "utf-8");
      return JSON.parse(content) as MaturitySnapshot;
    } catch {
      return null;
    }
  }).filter((s: MaturitySnapshot | null): s is MaturitySnapshot => s !== null);
}

// ── Legacy Compatibility ────────────────────────────────────────────────────

/** Converte perfil de maturidade para o antigo nível L1/L2/L3 (compatibilidade). */
export function profileToLegacyLevel(
  profile: MaturityProfile
): "junior" | "pleno" | "senior" {
  if (profile.overallScore >= 65) return "senior";
  if (profile.overallScore >= 35) return "pleno";
  return "junior";
}
