/**
 * knowledge-debt.ts — Pilar 8: Dívida de Conhecimento
 *
 * Cria um novo indicador de saúde do projeto.
 * Além da dívida técnica, o Nexus passa a medir conhecimento ausente.
 *
 * PRINCÍPIO: Conhecimento ausente é tão perigoso quanto código errado.
 * Lacunas de conhecimento devem ser rastreáveis e acionáveis.
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ── Types ───────────────────────────────────────────────────────────────────

/** Tipos de dívida de conhecimento. */
export type DebtType =
  | "adr_missing"           // Decisão sem ADR
  | "runbook_missing"       // Incidente sem Runbook
  | "skill_missing"         // Padrão recorrente sem Skill
  | "docs_missing"          // Arquitetura sem documentação
  | "automation_missing"    // Processo repetido sem automação
  | "contract_missing"      // Agente IA sem contrato
  | "workflow_missing"      // Processo sem workflow
  | "review_missing"        // Mudança sem review
  | "test_missing"          // Código sem testes
  | "adr_stale";            // ADR desactualizado

/** Severidade da dívida. */
export type DebtSeverity = "critical" | "high" | "medium" | "low";

/** Uma lacuna de conhecimento detectada. */
export interface KnowledgeGap {
  /** Identificador único. */
  id: string;
  /** Tipo da lacuna. */
  type: DebtType;
  /** Severidade. */
  severity: DebtSeverity;
  /** Descrição legível. */
  description: string;
  /** Localização (caminho ou referência). */
  location: string;
  /** Artefacto ausente esperado. */
  expectedArtifact: string;
  /** Recomendação para resolver. */
  recommendation: string;
  /** Data de detecção. */
  detectedAt: string;
  /** Se já foi endereçada. */
  addressed: boolean;
}

/** Relatório de dívida de conhecimento. */
export interface KnowledgeDebtReport {
  /** Data do relatório. */
  generatedAt: string;
  /** Total de lacunas. */
  totalGaps: number;
  /** Lacunas por severidade. */
  gapsBySeverity: Record<DebtSeverity, number>;
  /** Lacunas por tipo. */
  gapsByType: Record<DebtType, number>;
  /** Lista de lacunas. */
  gaps: KnowledgeGap[];
  /** Score de saúde (0-100, 100 = sem dívida). */
  healthScore: number;
  /** Resumo legível. */
  summary: string;
  /** Recomendações prioritárias. */
  recommendations: string[];
}

// ── Detection ───────────────────────────────────────────────────────────────

/** Detecta lacunas de conhecimento no projecto. */
export function detectKnowledgeDebt(
  projectRoot: string,
  nexusDir: string
): KnowledgeDebtReport {
  const gaps: KnowledgeGap[] = [];
  const now = new Date().toISOString();

  // 1. Decisões sem ADR
  gaps.push(...detectMissingAdrs(nexusDir, now));

  // 2. Incidentes sem Runbook
  gaps.push(...detectMissingRunbooks(nexusDir, now));

  // 3. Padrões sem Skill
  gaps.push(...detectMissingSkills(nexusDir, now));

  // 4. Arquitetura sem documentação
  gaps.push(...detectMissingDocs(nexusDir, now));

  // 5. Processos sem automação
  gaps.push(...detectMissingAutomation(nexusDir, now));

  // 6. Agentes sem contrato
  gaps.push(...detectMissingContracts(nexusDir, now));

  // 7. Processos sem workflow
  gaps.push(...detectMissingWorkflows(nexusDir, now));

  // 8. ADRs desactualizados
  gaps.push(...detectStaleAdrs(nexusDir, now));

  // Calcular severidades
  const gapsBySeverity: Record<DebtSeverity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  const gapsByType: Record<DebtType, number> = {} as Record<DebtType, number>;

  for (const gap of gaps) {
    gapsBySeverity[gap.severity]++;
    gapsByType[gap.type] = (gapsByType[gap.type] || 0) + 1;
  }

  // Score de saúde
  const healthScore = calculateDebtHealth(gaps);

  // Recomendações
  const recommendations = generateRecommendations(gaps);

  // Resumo
  const critical = gapsBySeverity.critical;
  const high = gapsBySeverity.high;
  const parts: string[] = [];
  parts.push(`${gaps.length} knowledge gap(s) detected.`);
  if (critical > 0) parts.push(`${critical} critical.`);
  if (high > 0) parts.push(`${high} high.`);
  parts.push(`Health score: ${healthScore}/100.`);

  return {
    generatedAt: now,
    totalGaps: gaps.length,
    gapsBySeverity,
    gapsByType,
    gaps,
    healthScore,
    summary: parts.join(" "),
    recommendations,
  };
}

/** Detecta decisões sem ADR. */
function detectMissingAdrs(nexusDir: string, now: string): KnowledgeGap[] {
  const gaps: KnowledgeGap[] = [];
  const adrDir = join(nexusDir, "docs", "adrs");
  const historyDir = join(nexusDir, "docs", "history");

  if (!existsSync(historyDir)) return gaps;

  // Procurar por referências a decisões no histórico sem ADR correspondente
  const historyFiles = readdirSync(historyDir).filter(
    (f) => f.endsWith(".md") && !f.startsWith("README")
  );

  const adrCount = existsSync(adrDir)
    ? readdirSync(adrDir).filter(
        (f) => f.endsWith(".md") && !f.startsWith("ADR-TEMPLATE")
      ).length
    : 0;

  // Se há histórico mas poucos ADRs
  if (historyFiles.length > 5 && adrCount < 2) {
    gaps.push({
      id: "DEBT-ADR-001",
      type: "adr_missing",
      severity: "high",
      description: `${historyFiles.length} session(s) in history but only ${adrCount} ADR(s) — decisions may not be documented`,
      location: "docs/adrs/",
      expectedArtifact: "ADR for each architectural decision",
      recommendation: "Review session history and create ADRs for key decisions",
      detectedAt: now,
      addressed: false,
    });
  }

  return gaps;
}

/** Detecta incidentes sem Runbook. */
function detectMissingRunbooks(nexusDir: string, now: string): KnowledgeGap[] {
  const gaps: KnowledgeGap[] = [];
  const runbooksDir = join(nexusDir, "docs", "runbooks");
  const historyDir = join(nexusDir, "docs", "history");

  if (!existsSync(historyDir)) return gaps;

  const historyFiles = readdirSync(historyDir).filter(
    (f) => f.endsWith(".md") && !f.startsWith("README")
  );

  let incidentCount = 0;
  for (const file of historyFiles) {
    try {
      const content = readFileSync(join(historyDir, file), "utf-8").toLowerCase();
      if (
        content.includes("erro") ||
        content.includes("bug") ||
        content.includes("falhou") ||
        content.includes("rollback") ||
        content.includes("incidente")
      ) {
        incidentCount++;
      }
    } catch {
      // skip
    }
  }

  const runbookCount = existsSync(runbooksDir)
    ? readdirSync(runbooksDir).filter((f) => f.endsWith(".md")).length
    : 0;

  if (incidentCount > 2 && runbookCount === 0) {
    gaps.push({
      id: "DEBT-RB-001",
      type: "runbook_missing",
      severity: "medium",
      description: `${incidentCount} incident(s) in history but no runbooks — no operational procedures documented`,
      location: "docs/runbooks/",
      expectedArtifact: "Runbook for each recurring incident type",
      recommendation: "Create runbooks for the most common incident types",
      detectedAt: now,
      addressed: false,
    });
  }

  return gaps;
}

/** Detecta padrões sem Skill. */
function detectMissingSkills(nexusDir: string, now: string): KnowledgeGap[] {
  const gaps: KnowledgeGap[] = [];
  const skillsDir = join(nexusDir, "docs", "skills");
  const adrDir = join(nexusDir, "docs", "adrs");

  const skillCount = existsSync(skillsDir)
    ? readdirSync(skillsDir).filter((f) => f.endsWith(".md")).length
    : 0;

  const adrCount = existsSync(adrDir)
    ? readdirSync(adrDir).filter(
        (f) => f.endsWith(".md") && !f.startsWith("ADR-TEMPLATE")
      ).length
    : 0;

  if (adrCount > 3 && skillCount === 0) {
    gaps.push({
      id: "DEBT-SK-001",
      type: "skill_missing",
      severity: "medium",
      description: `${adrCount} ADR(s) exist but no skills — patterns not extracted for reuse`,
      location: "docs/skills/",
      expectedArtifact: "Skills extracted from ADR patterns",
      recommendation: "Extract reusable patterns from ADRs into skills",
      detectedAt: now,
      addressed: false,
    });
  }

  return gaps;
}

/** Detecta arquitetura sem documentação. */
function detectMissingDocs(nexusDir: string, now: string): KnowledgeGap[] {
  const gaps: KnowledgeGap[] = [];
  const expectedDocs = [
    { path: "docs/CONCEPTUAL_MODEL.md", critical: true },
    { path: "docs/KNOWLEDGE_LIFECYCLE.md", critical: true },
    { path: "governance/SYSTEM_MAP.md", critical: false },
    { path: "docs/session-template.md", critical: false },
  ];

  for (const doc of expectedDocs) {
    if (!existsSync(join(nexusDir, doc.path))) {
      gaps.push({
        id: `DEBT-DOC-${doc.path.replace(/[^a-zA-Z]/g, "").slice(0, 6).toUpperCase()}`,
        type: "docs_missing",
        severity: doc.critical ? "high" : "low",
        description: `Expected document "${doc.path}" not found`,
        location: `nexus-system/${doc.path}`,
        expectedArtifact: doc.path,
        recommendation: `Create "${doc.path}" — ${doc.critical ? "critical" : "recommended"}`,
        detectedAt: now,
        addressed: false,
      });
    }
  }

  return gaps;
}

/** Detecta processos sem automação. */
function detectMissingAutomation(nexusDir: string, now: string): KnowledgeGap[] {
  const gaps: KnowledgeGap[] = [];
  const scriptsDir = join(nexusDir, "scripts");

  const scriptCount = existsSync(scriptsDir)
    ? readdirSync(scriptsDir).filter(
        (f) => f.endsWith(".ts") || f.endsWith(".js")
      ).length
    : 0;

  if (scriptCount < 3) {
    gaps.push({
      id: "DEBT-AUTO-001",
      type: "automation_missing",
      severity: "low",
      description: `Only ${scriptCount} automation script(s) — many processes may still be manual`,
      location: "nexus-system/scripts/",
      expectedArtifact: "Scripts for common operations",
      recommendation: "Identify repetitive processes and create automation scripts",
      detectedAt: now,
      addressed: false,
    });
  }

  return gaps;
}

/** Detecta agentes sem contrato. */
function detectMissingContracts(nexusDir: string, now: string): KnowledgeGap[] {
  const gaps: KnowledgeGap[] = [];
  const agentsDir = join(nexusDir, "governance", "agents");
  const configPath = join(nexusDir, "..", "opencode.json");

  if (!existsSync(configPath)) return gaps;

  try {
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    const agentCount = config.agent ? Object.keys(config.agent).length : 0;

    const contractCount = existsSync(agentsDir)
      ? readdirSync(agentsDir).filter(
          (f) => f.endsWith(".yaml") || f.endsWith(".yml")
        ).length
      : 0;

    if (agentCount > 0 && contractCount === 0) {
      gaps.push({
        id: "DEBT-CON-001",
        type: "contract_missing",
        severity: "medium",
        description: `${agentCount} agent(s) configured but no contracts — agent behavior undefined`,
        location: "nexus-system/governance/agents/",
        expectedArtifact: "AI contract for each agent role",
        recommendation: "Create AI contracts defining responsibilities and constraints for each agent",
        detectedAt: now,
        addressed: false,
      });
    }
  } catch {
    // skip
  }

  return gaps;
}

/** Detecta processos sem workflow. */
function detectMissingWorkflows(nexusDir: string, now: string): KnowledgeGap[] {
  const gaps: KnowledgeGap[] = [];
  const workflowPath = join(nexusDir, "governance", "WORKFLOW.md");

  if (!existsSync(workflowPath)) {
    gaps.push({
      id: "DEBT-WF-001",
      type: "workflow_missing",
      severity: "high",
      description: "No WORKFLOW.md found — session flow undefined",
      location: "nexus-system/governance/WORKFLOW.md",
      expectedArtifact: "WORKFLOW.md defining session flow",
      recommendation: "Create WORKFLOW.md defining standard session procedures",
      detectedAt: now,
      addressed: false,
    });
  }

  return gaps;
}

/** Detecta ADRs desactualizados. */
function detectStaleAdrs(nexusDir: string, now: string): KnowledgeGap[] {
  const gaps: KnowledgeGap[] = [];
  const adrDir = join(nexusDir, "docs", "adrs");

  if (!existsSync(adrDir)) return gaps;

  const files = readdirSync(adrDir).filter(
    (f) => f.endsWith(".md") && !f.startsWith("ADR-TEMPLATE")
  );

  for (const file of files) {
    try {
      const content = readFileSync(join(adrDir, file), "utf-8");
      if (content.includes("Estado: deprecated") || content.includes("Status: deprecated")) {
        gaps.push({
          id: `DEBT-ADR-STALE-${file.replace(".md", "")}`,
          type: "adr_stale",
          severity: "low",
          description: `ADR "${file}" is deprecated — may need superseding ADR`,
          location: `docs/adrs/${file}`,
          expectedArtifact: "New ADR superseding deprecated one",
          recommendation: "Create new ADR or remove deprecated one",
          detectedAt: now,
          addressed: false,
        });
      }
    } catch {
      // skip
    }
  }

  return gaps;
}

// ── Scoring ─────────────────────────────────────────────────────────────────

/** Calcula score de saúde baseado na dívida. */
function calculateDebtHealth(gaps: KnowledgeGap[]): number {
  let score = 100;

  for (const gap of gaps) {
    switch (gap.severity) {
      case "critical":
        score -= 25;
        break;
      case "high":
        score -= 15;
        break;
      case "medium":
        score -= 8;
        break;
      case "low":
        score -= 3;
        break;
    }
  }

  return Math.max(0, Math.min(100, score));
}

/** Gera recomendações prioritárias. */
function generateRecommendations(gaps: KnowledgeGap[]): string[] {
  const recommendations: string[] = [];

  const critical = gaps.filter((g) => g.severity === "critical");
  const high = gaps.filter((g) => g.severity === "high");

  if (critical.length > 0) {
    recommendations.push(
      `URGENT: ${critical.length} critical gap(s) — address immediately`
    );
  }

  if (high.length > 0) {
    recommendations.push(
      `HIGH: ${high.length} high-severity gap(s) — address this sprint`
    );
  }

  // Top 3 recomendações por tipo
  const byType = new Map<DebtType, KnowledgeGap[]>();
  for (const gap of gaps) {
    const list = byType.get(gap.type) || [];
    list.push(gap);
    byType.set(gap.type, list);
  }

  for (const [, typeGaps] of byType) {
    if (typeGaps.length > 0) {
      const firstGap = typeGaps[0];
      if (firstGap) recommendations.push(firstGap.recommendation);
    }
  }

  return recommendations.slice(0, 5);
}

// ── Report Writer ───────────────────────────────────────────────────────────

/** Grava relatório de dívida de conhecimento. */
export function writeDebtReport(
  nexusDir: string,
  report: KnowledgeDebtReport
): string | null {
  const reportsDir = join(nexusDir, "reports");
  if (!existsSync(reportsDir)) return null;

  const date = new Date().toISOString().slice(0, 10);
  const filename = `knowledge-debt-${date}.json`;
  const filepath = join(reportsDir, filename);

  try {
    writeFileSync(filepath, JSON.stringify(report, null, 2), "utf-8");
    return filename;
  } catch {
    return null;
  }
}
