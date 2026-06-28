/**
 * health-auditor.ts — Fase 3: Auditoria de Saúde do Próprio Nexus
 *
 * Metacognição: o sistema avaliando a sua própria eficácia.
 *
 * - Regra nunca mencionada em N sessões → candidata a remover ou simplificar
 * - Alta taxa de violações no histórico → candidata a reescrever ou promover a lint
 * - Detecção estrutural: pasta nova sem documentação → sinalizar lacuna
 *
 * PRINCÍPIO: Este módulo SÓ SUGERE, nunca aplica.
 * A decisão de optimizar governança é sempre manual.
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ── Types ───────────────────────────────────────────────────────────────────

/** Problema de saúde detectado no sistema. */
export interface HealthIssue {
  type: "dead_rule" | "violation_hotspot" | "missing_docs" | "orphan_dir" | "stale_buffer";
  severity: 1 | 2 | 3;
  description: string;
  location: string;
  recommendation: string;
}

/** Sugestão de optimização de governança. */
export interface GovernanceOptimization {
  id: string;
  title: string;
  description: string;
  action: "remove_rule" | "rewrite_rule" | "promote_to_lint" | "add_docs";
  affectedRule: string;
  evidence: string[];
}

/** Relatório completo de auditoria de saúde. */
export interface HealthAuditReport {
  auditedAt: string;
  totalRules: number;
  historyEntries: number;
  sessionsAnalyzed: number;
  issues: HealthIssue[];
  optimizations: GovernanceOptimization[];
  healthScore: number;
  summary: string;
}

// ── Data Readers ─────────────────────────────────────────────────────────────

interface HistoryEntry {
  filename: string;
  date: string;
  content: string;
}

function readHistory(nexusDir: string): HistoryEntry[] {
  const historyDir = join(nexusDir, "docs", "history");
  if (!existsSync(historyDir)) return [];

  return readdirSync(historyDir)
    .filter((f) => f.endsWith(".md") && !f.startsWith("README"))
    .map((file) => {
      const content = readFileSync(join(historyDir, file), "utf-8");
      const dateMatch = file.match(/(\d{4}-\d{2}-\d{2})/);
      return { filename: file, date: dateMatch?.[1] ?? "unknown", content: content.toLowerCase() };
    });
}

function readRules(nexusDir: string): string[] {
  const agentsPath = join(nexusDir, "docs", "AGENTS.md");
  if (!existsSync(agentsPath)) return [];

  const content = readFileSync(agentsPath, "utf-8");
  const rules: string[] = [];
  // Match numbered rules: "1. **RULE NAME**: description"
  const numberedRegex = /^\d+\.\s+\*\*([^*]+)\*\*/gm;
  let match;
  while ((match = numberedRegex.exec(content)) !== null) {
    const rule = match[1];
    if (rule) rules.push(rule.trim());
  }
  return [...new Set(rules)];
}

// ── Issue Detectors ──────────────────────────────────────────────────────────

const VIOLATION_KEYWORDS = ["erro", "bug", "corrigi", "falhou", "rollback", "violação", "violated", "revert", "broken", "regression", "incidente", "problema"];

function detectDeadRules(rules: string[], history: HistoryEntry[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  if (history.length < 5) return issues;

  for (const rule of rules) {
    const ruleWords = rule.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    let mentionedCount = 0;

    for (const entry of history) {
      // Check if at least 2 significant words from the rule appear in the entry
      const matches = ruleWords.filter((w) => entry.content.includes(w));
      if (matches.length >= Math.min(2, ruleWords.length)) {
        mentionedCount++;
      }
    }

    // Rule never mentioned in 5+ sessions → candidate for removal
    if (mentionedCount === 0) {
      issues.push({
        type: "dead_rule",
        severity: 1,
        description: `Regra "${rule}" nunca mencionada em ${history.length} sessões — candidata a remover ou simplificar`,
        location: "docs/AGENTS.md",
        recommendation: `Considerar remover "${rule}" ou convertê-la em recomendação não vinculante`,
      });
    }
  }

  return issues;
}

function detectViolationHotspots(history: HistoryEntry[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  if (history.length < 4) return issues;

  let violationCount = 0;
  for (const entry of history) {
    if (VIOLATION_KEYWORDS.some((kw) => entry.content.includes(kw))) {
      violationCount++;
    }
  }

  if (violationCount >= Math.ceil(history.length * 0.5)) {
    issues.push({
      type: "violation_hotspot",
      severity: violationCount >= history.length * 0.7 ? 3 : 2,
      description: `Alta taxa de violações: ${violationCount}/${history.length} sessões com erros — governança pode precisar de reforço`,
      location: "docs/AGENTS.md",
      recommendation: "Revisar regras — considerar adicionar validações automáticas (lint) para regras críticas",
    });
  }

  return issues;
}

function detectMissingDocs(nexusDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const expectedDocs = [
    { path: "docs/AGENTS.md", critical: true },
    { path: "docs/FORBIDDEN_OPERATIONS.md", critical: true },
    { path: "docs/DESDO.md", critical: true },
    { path: "governance/WORKFLOW.md", critical: true },
    { path: "governance/SYSTEM_MAP.md", critical: false },
    { path: "docs/session-template.md", critical: false },
  ];

  for (const doc of expectedDocs) {
    if (!existsSync(join(nexusDir, doc.path))) {
      issues.push({
        type: "missing_docs",
        severity: doc.critical ? 3 : 1,
        description: `Documento "${doc.path}" não encontrado`,
        location: `nexus-system/${doc.path}`,
        recommendation: `Criar "${doc.path}" — ${doc.critical ? "crítico" : "recomendado"}`,
      });
    }
  }

  return issues;
}

function detectOrphanDirs(nexusDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];

  try {
    const dirs = readdirSync(nexusDir, { withFileTypes: true }).filter((d) => d.isDirectory());
    for (const dir of dirs) {
      const dirPath = join(nexusDir, dir.name);
    let files: string[];
    try {
      files = readdirSync(dirPath);
    } catch {
      continue;
    }
    const hasOnlyReadmes = files.length <= 2 && files.every((f) => f === "README.md" || f === ".gitignore");

      if (hasOnlyReadmes && dir.name !== "scripts" && dir.name !== "reports") {
        issues.push({
          type: "orphan_dir",
          severity: 1,
          description: `Directório "${dir.name}" contém apenas README — possivelmente órfão`,
          location: `nexus-system/${dir.name}/`,
          recommendation: `Adicionar conteúdo a "${dir.name}" ou removê-lo se desnecessário`,
        });
      }
    }
  } catch {
    // skip
  }

  return issues;
}

function detectStaleBuffer(nexusDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const bufferPath = join(nexusDir, "governance", "context", "context_buffer.yaml");
  if (!existsSync(bufferPath)) return issues;

  try {
    const content = readFileSync(bufferPath, "utf-8");
    const activeLines = content.split("\n").filter((l) => l.trim().length > 0 && !l.startsWith("#") && !l.startsWith("---")).length;

    if (activeLines > 50) {
      issues.push({
        type: "stale_buffer",
        severity: 2,
        description: `context_buffer.yaml tem ${activeLines} linhas activas (máx recomendado: 50)`,
        location: "governance/context/context_buffer.yaml",
        recommendation: "Podar o buffer — remover secções obsoletas e consolidar estado",
      });
    }

    if (content.includes("in_progress") || content.includes("active")) {
      issues.push({
        type: "stale_buffer",
        severity: 1,
        description: "context_buffer.yaml indica sessão em curso não fechada",
        location: "governance/context/context_buffer.yaml",
        recommendation: "Executar close-session ou actualizar o status",
      });
    }
  } catch {
    // skip
  }

  return issues;
}

// ── Health Score ─────────────────────────────────────────────────────────────

function calculateHealthScore(issues: HealthIssue[]): number {
  let score = 100;
  for (const issue of issues) {
    if (issue.severity === 3) score -= 20;
    else if (issue.severity === 2) score -= 10;
    else score -= 3;
  }
  return Math.max(0, Math.min(100, score));
}

// ── Optimization Proposer ────────────────────────────────────────────────────

function proposeOptimizations(issues: HealthIssue[]): GovernanceOptimization[] {
  const optimizations: GovernanceOptimization[] = [];
  let optId = 1;

  for (const issue of issues) {
    if (issue.type === "dead_rule") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Remover regra morta",
        description: issue.description,
        action: "remove_rule",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "violation_hotspot") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Reescrever ou automatizar regra",
        description: issue.description,
        action: issue.severity === 3 ? "promote_to_lint" : "rewrite_rule",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "orphan_dir") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Popular directório órfão",
        description: issue.description,
        action: "add_docs",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
  }

  return optimizations;
}

// ── Main Audit Function ──────────────────────────────────────────────────────

/**
 * Executa auditoria de saúde do sistema Nexus.
 * SÓ SUGERE — nunca aplica optimizações.
 */
export function auditHealth(
  projectRoot: string,
  nexusDir: string
): HealthAuditReport {
  const history = readHistory(nexusDir);
  const rules = readRules(nexusDir);

  const issues: HealthIssue[] = [
    ...detectDeadRules(rules, history),
    ...detectViolationHotspots(history),
    ...detectMissingDocs(nexusDir),
    ...detectOrphanDirs(nexusDir),
    ...detectStaleBuffer(nexusDir),
  ];

  const healthScore = calculateHealthScore(issues);
  const optimizations = proposeOptimizations(issues);

  const critical = issues.filter((i) => i.severity === 3).length;
  const warnings = issues.filter((i) => i.severity === 2).length;
  const info = issues.filter((i) => i.severity === 1).length;

  const parts: string[] = [];
  parts.push(`Score de saúde: ${healthScore}/100`);
  parts.push(`${rules.length} regras, ${history.length} sessões analisadas.`);
  if (critical > 0) parts.push(`${critical} crítico(s).`);
  if (warnings > 0) parts.push(`${warnings} aviso(s).`);
  if (info > 0) parts.push(`${info} info.`);
  if (optimizations.length > 0) parts.push(`${optimizations.length} optimização(ões) proposta(s).`);

  return {
    auditedAt: new Date().toISOString(),
    totalRules: rules.length,
    historyEntries: history.length,
    sessionsAnalyzed: history.length,
    issues,
    optimizations,
    healthScore,
    summary: parts.join(" "),
  };
}

// ── Report Writer ────────────────────────────────────────────────────────────

export function writeHealthReport(nexusDir: string, report: HealthAuditReport): string | null {
  const reportsDir = join(nexusDir, "reports");
  if (!existsSync(reportsDir)) return null;

  const date = new Date().toISOString().slice(0, 10);
  const filename = `health-${date}.json`;
  const filepath = join(reportsDir, filename);

  try {
    writeFileSync(filepath, JSON.stringify(report, null, 2), "utf-8");
    return filename;
  } catch {
    return null;
  }
}
