/**
 * pattern-detector.ts — Fase 2: Extração de Padrão
 *
 * Lê o histórico acumulado (docs/history/) e relatórios (reports/)
 * para detectar recorrência — mesmo tipo de erro, mesma violação,
 * mesma decisão revertida — e propor regras candidatas.
 *
 * PRINCÍPIO: Este módulo SÓ PROPÕE, nunca aplica.
 * A aprovação de mudança de regra é sempre manual, sempre do Tech Lead.
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ── Types (re-exported from domain entities) ────────────────────────────────

import type {
  DetectedPattern,
  CandidateRule,
  PatternDetectionReport,
} from "./domain/entities/engineering-state.js";

export type {
  DetectedPattern,
  CandidateRule,
  PatternDetectionReport,
} from "./domain/entities/engineering-state.js";

// ── History Reader ───────────────────────────────────────────────────────────

interface HistoryEntry {
  filename: string;
  date: string;
  content: string;
  violations: string[];
  areas: string[];
}

function readHistoryEntries(nexusDir: string): HistoryEntry[] {
  const historyDir = join(nexusDir, "docs", "history");
  if (!existsSync(historyDir)) return [];

  const files = readdirSync(historyDir).filter(
    (f) => f.endsWith(".md") && !f.startsWith("README")
  );

  const violationKeywords = [
    "erro", "bug", "corrigi", "falhou", "rollback",
    "violação", "violated", "revert", "fix", "broken",
    "regression", "incidente", "problema",
  ];

  return files.map((file) => {
    const content = readFileSync(join(historyDir, file), "utf-8");

    // Extract date from filename (YYYY-MM-DD-sessao-NN.md)
    const dateMatch = file.match(/(\d{4}-\d{2}-\d{2})/);
    const date = dateMatch?.[1] ?? "unknown";

    // Detect violations mentioned
    const lower = content.toLowerCase();
    const violations = violationKeywords.filter((kw) => lower.includes(kw));

    // Detect areas mentioned (look for src/, packages/, apps/ references)
    const areaRegex = /((?:src|packages|apps|lib)\/[\w-]+)/g;
    const areaMatches = content.match(areaRegex) || [];
    const areas = [...new Set(areaMatches)];

    return { filename: file, date, content, violations, areas };
  });
}

// ── Report Reader ────────────────────────────────────────────────────────────

interface ReportSummary {
  projectName: string;
  score: number;
  level: string;
  areaScores: Array<{
    area: string;
    score: number;
    violations: number;
    churn: number;
  }>;
}

function readRecentReports(nexusDir: string): ReportSummary[] {
  const reportsDir = join(nexusDir, "reports");
  if (!existsSync(reportsDir)) return [];

  const files = readdirSync(reportsDir)
    .filter((f) => f.startsWith("complexity-") && f.endsWith(".json"))
    .sort()
    .slice(-10); // Last 10 reports

  return files.map((file) => {
    try {
      const content = readFileSync(join(reportsDir, file), "utf-8");
      return JSON.parse(content) as ReportSummary;
    } catch {
      return null;
    }
  }).filter((r): r is ReportSummary => r !== null);
}

// ── Pattern Detection ────────────────────────────────────────────────────────

function detectRecurringErrors(entries: HistoryEntry[]): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];

  // Group violations by area
  const violationsByArea = new Map<string, string[]>();

  for (const entry of entries) {
    if (entry.violations.length === 0) continue;

    const key = entry.areas.length > 0 ? (entry.areas[0] ?? "global") : "global";
    if (!violationsByArea.has(key)) {
      violationsByArea.set(key, []);
    }
    const existing = violationsByArea.get(key);
    if (existing) {
      existing.push(`${entry.date} (${entry.filename}): ${entry.violations.join(", ")}`);
    }
  }

  for (const [area, evidence] of violationsByArea) {
    if (evidence.length >= 3) {
      patterns.push({
        type: "recurring_error",
        description: `Erros recorrentes na área "${area}" — ${evidence.length} ocorrências no histórico`,
        occurrences: evidence.length,
        evidence,
        affectedArea: area,
        severity: Math.min(5, evidence.length),
      });
    }
  }

  return patterns;
}

function detectRevertedDecisions(entries: HistoryEntry[]): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];
  const revertKeywords = ["revert", "rollback", "desfazer", "voltar", "removido", "removida"];

  const revertEntries = entries.filter((entry) => {
    const lower = entry.content.toLowerCase();
    return revertKeywords.some((kw) => lower.includes(kw));
  });

  if (revertEntries.length >= 2) {
    patterns.push({
      type: "reverted_decision",
      description: `${revertEntries.length} decisões revertidas/rollback no histórico — padrão de indecisão ou inadequação da solução`,
      occurrences: revertEntries.length,
      evidence: revertEntries.map(
        (e) => `${e.date} (${e.filename}): ${e.violations.join(", ") || "rollback detected"}`
      ),
      affectedArea: "cross-cutting",
      severity: Math.min(5, revertEntries.length),
    });
  }

  return patterns;
}

function detectHotAreas(reports: ReportSummary[]): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];

  // Aggregate scores across reports
  const areaScores = new Map<string, number[]>();

  for (const report of reports) {
    for (const area of report.areaScores || []) {
      if (!areaScores.has(area.area)) {
        areaScores.set(area.area, []);
      }
      areaScores.get(area.area)!.push(area.score);
    }
  }

  for (const [area, scores] of areaScores) {
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    if (avgScore >= 6 && scores.length >= 2) {
      patterns.push({
        type: "hot_area",
        description: `Área "${area}" com score elevado consistente (média ${avgScore.toFixed(1)} em ${scores.length} relatórios)`,
        occurrences: scores.length,
        evidence: scores.map((s, i) => `Relatório ${i + 1}: score ${s}`),
        affectedArea: area,
        severity: Math.min(5, Math.floor(avgScore / 2)),
      });
    }
  }

  return patterns;
}

// ── Rule Proposal ────────────────────────────────────────────────────────────

function proposeRules(patterns: DetectedPattern[]): CandidateRule[] {
  const rules: CandidateRule[] = [];
  let ruleId = 1;

  for (const pattern of patterns) {
    if (pattern.type === "recurring_error" && pattern.occurrences >= 3) {
      rules.push({
        id: `RULE-${String(ruleId++).padStart(3, "0")}`,
        title: `Prevenir erros recorrentes em ${pattern.affectedArea}`,
        description: `Baseado em ${pattern.occurrences} ocorrências de erros na área "${pattern.affectedArea}"`,
        target: "FORBIDDEN_OPERATIONS",
        supportingPatterns: [pattern],
        ruleText: `**${pattern.affectedArea.toUpperCase()}-01**: Implementar validação específica para ${pattern.affectedArea} antes de commitar — ${pattern.occurrences} erros recorrentes envolvendo: ${pattern.evidence[0] || "ver histórico"}.`,
        status: "proposed",
      });
    }

    if (pattern.type === "reverted_decision" && pattern.occurrences >= 2) {
      rules.push({
        id: `RULE-${String(ruleId++).padStart(3, "0")}`,
        title: "Exigir review antes de decisões estruturais",
        description: `${pattern.occurrences} decisões revertidas no histórico — considerar processo de review obrigatório`,
        target: "AGENTS.md",
        supportingPatterns: [pattern],
        ruleText: `**REVIEW-01**: Toda decisão estrutural (migração, refactor de arquitectura, mudança de framework) deve passar por review antes de implementação.`,
        status: "proposed",
      });
    }

    if (pattern.type === "hot_area" && pattern.severity >= 4) {
      rules.push({
        id: `RULE-${String(ruleId++).padStart(3, "0")}`,
        title: `Governance reforçada para ${pattern.affectedArea}`,
        description: `Área "${pattern.affectedArea}" com complexidade persistentemente alta`,
        target: "AGENTS.md",
        supportingPatterns: [pattern],
        ruleText: `**GOV-01**: Área "${pattern.affectedArea}" deve ter PR obrigatório com review de 2 revisores antes de merge.`,
        status: "proposed",
      });
    }
  }

  return rules;
}

// ── Main Detection Function ──────────────────────────────────────────────────

/**
 * Executa a detecção de padrões no projecto.
 * SÓ PROPÕE — nunca aplica regras.
 *
 * @param projectRoot - Raiz do projecto
 * @param nexusDir - Caminho para nexus-system/
 * @returns Relatório de detecção com padrões e regras candidatas
 */
export function detectPatterns(
  _projectRoot: string,
  nexusDir: string
): PatternDetectionReport {
  // 1. Read history entries
  const historyEntries = readHistoryEntries(nexusDir);

  // 2. Read recent reports
  const reports = readRecentReports(nexusDir);

  // 3. Detect patterns
  const patterns: DetectedPattern[] = [
    ...detectRecurringErrors(historyEntries),
    ...detectRevertedDecisions(historyEntries),
    ...detectHotAreas(reports),
  ];

  // 4. Propose rules based on patterns
  const candidateRules = proposeRules(patterns);

  // 5. Generate summary
  const summary = generateSummary(patterns, candidateRules, historyEntries.length, reports.length);

  return {
    detectedAt: new Date().toISOString(),
    historyEntriesAnalyzed: historyEntries.length,
    reportsAnalyzed: reports.length,
    patterns,
    candidateRules,
    summary,
  };
}

function generateSummary(
  patterns: DetectedPattern[],
  rules: CandidateRule[],
  historyCount: number,
  reportCount: number
): string {
  if (patterns.length === 0) {
    return `Análise de ${historyCount} entradas de histórico e ${reportCount} relatórios. Nenhum padrão significativo detectado.`;
  }

  const highSeverity = patterns.filter((p) => p.severity >= 4);
  const parts: string[] = [];

  parts.push(`${patterns.length} padrão(ões) detectado(s) em ${historyCount} entradas de histórico e ${reportCount} relatórios.`);

  if (highSeverity.length > 0) {
    parts.push(`${highSeverity.length} de severidade alta — atenção urgente recomendada.`);
  }

  if (rules.length > 0) {
    parts.push(`${rules.length} regra(s) candidata(s) proposta(s) para aprovação do Tech Lead.`);
  }

  return parts.join(" ");
}

// ── Report Writer ────────────────────────────────────────────────────────────

/**
 * Grava o relatório de detecção de padrões em reports/.
 */
export function writePatternReport(
  nexusDir: string,
  report: PatternDetectionReport
): string | null {
  const reportsDir = join(nexusDir, "reports");
  if (!existsSync(reportsDir)) return null;

  const date = new Date().toISOString().slice(0, 10);
  const filename = `patterns-${date}.json`;
  const filepath = join(reportsDir, filename);

  try {
    writeFileSync(filepath, JSON.stringify(report, null, 2), "utf-8");
    return filename;
  } catch {
    return null;
  }
}
