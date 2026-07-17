/**
 * Audit module — Governance Enforcement detectors
 *
 * Detectors that enforce governance rules: session lifecycle,
 * backlog state machine, plan format, and policy compliance.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../logger.js";
import { checkpointBuffer } from "../governance/buffer-checkpoint.js";
import type { HealthIssue } from "./types.js";

// ── 2.1 Incomplete Session Close ────────────────────────────────────────────

export function detectIncompleteSessionClose(shitenDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const bufferPath = join(shitenDir, "governance", "context", "context_buffer.yaml");
  if (!existsSync(bufferPath)) return issues;

  try {
    const content = readFileSync(bufferPath, "utf-8");
    const activeLines = content.split("\n").filter((l) => l.trim().length > 0 && !l.startsWith("#") && !l.startsWith("---")).length;

    const hasInProgress = content.includes("status: in_progress") || content.includes("status: active");
    const hasStaleBuffer = activeLines > 50;

    // Create checkpoint before reporting any issues
    if (hasInProgress || hasStaleBuffer) {
      const checkpointResult = checkpointBuffer(shitenDir);
      if (checkpointResult.success) {
        logger.debug("governance-enforcement", `Checkpoint created before buffer report: ${checkpointResult.checkpointPath}`);
      }
    }

    if (hasInProgress) {
      issues.push({
        type: "session_not_closed",
        severity: 2,
        description: "context_buffer.yaml indica sessão em curso não fechada — ritual de fim de sessão não executado",
        location: "governance/context/context_buffer.yaml",
        recommendation: "Executar 'pnpm run close:session' antes de iniciar nova sessão (AGENTS.md #12).",
        confidence: 0.7,
      });
    }

    if (hasStaleBuffer) {
      issues.push({
        type: "buffer_not_pruned",
        severity: 2,
        description: `context_buffer.yaml tem ${activeLines} linhas activas (máx: 50) — buffer não foi podado no fim de sessão`,
        location: "governance/context/context_buffer.yaml",
        recommendation: "Podar buffer no ritual de fim de sessão: remover secções obsoletas, consolidar estado.",
        confidence: 0.7,
      });
    }
  } catch {
    logger.debug("governance-enforcement", "Failed to read context buffer");
  }

  return issues;
}

// ── 2.2 Missing Feedback ────────────────────────────────────────────────────

export function detectMissingFeedback(shitenDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const feedbackDir = join(shitenDir, "feedback", "records");
  if (!existsSync(feedbackDir)) {
    issues.push({
      type: "missing_feedback_dir",
      severity: 1,
      description: "Directório feedback/records/ não existe — feedback de sessão não está a ser registado",
      location: "shitenno-go/feedback/records/",
      recommendation: "Criar directório e executar 'shiten feedback --outcome success' após cada sessão.",
      confidence: 0.95,
    });
    return issues;
  }

  try {
    const files = readdirSync(feedbackDir).filter((f) => f.endsWith(".json"));
    if (files.length === 0) {
      issues.push({
        type: "no_feedback_records",
        severity: 1,
        description: "Directório feedback/records/ está vazio — nenhum registo de feedback encontrado",
        location: "shitenno-go/feedback/records/",
        recommendation: "Executar 'shiten feedback --outcome success' ou 'shiten feedback --outcome failure' após sessões.",
        confidence: 0.95,
      });
    }
  } catch {
    logger.debug("governance-enforcement", "Failed to scan feedback directory");
  }

  return issues;
}

// ── 2.3 Invalid Backlog States ──────────────────────────────────────────────

const VALID_BACKLOG_STATES = new Set([
  "Backlog", "In Progress", "Paused", "Done",
  "planeado", "em investigação", "em implementação", "em validação",
  "concluído", "encerrado", "pausado", "adiado",
]);

export function detectInvalidBacklogStates(shitenDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const backlogPath = join(shitenDir, "docs", "BACKLOG.md");
  if (!existsSync(backlogPath)) return issues;

  try {
    const content = readFileSync(backlogPath, "utf-8");
    const statusRegex = /\*\*Status\*\*\s*\|\s*([A-Za-zÀ-ú\s]+)\|/g;
    let match;
    const invalidStates: string[] = [];

    while ((match = statusRegex.exec(content)) !== null) {
      const state = (match[1] ?? "").trim();
      if (state && !VALID_BACKLOG_STATES.has(state)) {
        invalidStates.push(state);
      }
    }

    if (invalidStates.length > 0) {
      issues.push({
        type: "invalid_backlog_state",
        severity: 2,
        description: `${invalidStates.length} estado(s) inválido(s) no BACKLOG.md: ${[...new Set(invalidStates)].join(", ")}`,
        location: "shitenno-go/docs/BACKLOG.md",
        recommendation: `Estados válidos: ${[...VALID_BACKLOG_STATES].join(", ")}. Actualizar para um dos estados permitidos.`,
        confidence: 0.65,
      });
    }
  } catch {
    logger.debug("governance-enforcement", "Failed to parse BACKLOG.md");
  }

  return issues;
}

// ── 2.4 Plan Format (Status field vs checkboxes) ───────────────────────────

export function detectPlanFormat(shitenDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const plansDir = join(shitenDir, "governance", "plans");
  if (!existsSync(plansDir)) return issues;

  try {
    const files = readdirSync(plansDir).filter((f) => f.endsWith(".md") && !f.startsWith("TEMPLATE"));
    for (const file of files) {
      const path = join(plansDir, file);
      const content = readFileSync(path, "utf-8");
      const hasCheckboxes = /^\s*-\s*\[[ x]\]\s*/m.test(content);
      const hasStatusField = /^\*\*Status:\*\*/m.test(content) || /^Status:\s*/m.test(content);

      if (hasCheckboxes && !hasStatusField) {
        issues.push({
          type: "plan_format_violation",
          severity: 1,
          description: `Plano "${file}" usa checkboxes em vez de campo "Status:" —.Workflow.md requer campo Status`,
          location: `shitenno-go/governance/plans/${file}`,
          recommendation: "Substituir checkboxes por '**Status:** [em execução|concluído|pendente]'.",
          confidence: 0.65,
        });
      }
    }
  } catch {
    logger.debug("governance-enforcement", "Failed to scan plans directory");
  }

  return issues;
}

// ── 2.5 Rule Execution Compliance ───────────────────────────────────────────

export function detectRuleExecutionCompliance(shitenDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const rulesDir = join(shitenDir, "governance", "rules");
  if (!existsSync(rulesDir)) return issues;

  try {
    const files = readdirSync(rulesDir).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      const path = join(rulesDir, file);
      try {
        const content = readFileSync(path, "utf-8");
        const rule = JSON.parse(content);

        if (!rule.id || !rule.trigger || (!rule.action && !rule.actions)) {
          issues.push({
            type: "invalid_rule_structure",
            severity: 2,
            description: `Regra "${file}" tem estrutura inválida — campos obrigatórios em falta (id, trigger, action/actions)`,
            location: `shitenno-go/governance/rules/${file}`,
            recommendation: "Cada regra JSON deve ter: id, trigger, action (ou actions), requiredCapability.",
            confidence: 0.9,
          });
        }
      } catch {
        issues.push({
          type: "malformed_rule_json",
          severity: 2,
          description: `Regra "${file}" não é JSON válido`,
          location: `shitenno-go/governance/rules/${file}`,
          recommendation: "Corrigir sintaxe JSON da regra.",
          confidence: 0.9,
        });
      }
    }
  } catch {
    logger.debug("governance-enforcement", "Failed to scan rules directory");
  }

  return issues;
}

// ── 2.6 Policy Structure ────────────────────────────────────────────────────

export function detectPolicyStructure(shitenDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const policiesDir = join(shitenDir, "governance", "policies");
  if (!existsSync(policiesDir)) {
    issues.push({
      type: "missing_policies_dir",
      severity: 2,
      description: "Directório governance/policies/ não existe — políticas de commit/branch/review não documentadas",
      location: "shitenno-go/governance/policies/",
      recommendation: "Criar directório com COMMIT-POLICY.md, BRANCH-POLICY.md, REVIEW-POLICY.md.",
      confidence: 0.95,
    });
    return issues;
  }

  const expectedPolicies = ["COMMIT-POLICY.md", "BRANCH-POLICY.md", "REVIEW-POLICY.md"];
  try {
    const files = readdirSync(policiesDir);
    for (const policy of expectedPolicies) {
      if (!files.includes(policy)) {
        issues.push({
          type: "missing_policy",
          severity: 2,
          description: `Política "${policy}" não encontrada em governance/policies/`,
          location: `shitenno-go/governance/policies/${policy}`,
          recommendation: `Criar "${policy}" com regras de governança.`,
          confidence: 0.95,
        });
      }
    }
  } catch {
    logger.debug("governance-enforcement", "Failed to scan policies directory");
  }

  return issues;
}

// ── 2.7 Missing Premortem ───────────────────────────────────────────────────

export function detectMissingPremortem(shitenDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const bufferPath = join(shitenDir, "governance", "context", "context_buffer.yaml");
  if (!existsSync(bufferPath)) return issues;

  try {
    const content = readFileSync(bufferPath, "utf-8");
    const hasComplexTask = content.includes("complexity: high") || content.includes("complexity: critical");

    if (hasComplexTask) {
      const premortemDir = join(shitenDir, "docs", "premortems");
      if (!existsSync(premortemDir) || readdirSync(premortemDir).length === 0) {
        issues.push({
          type: "missing_premortem",
          severity: 2,
          description: "Tarefa complexa detectada mas nenhum premortem encontrado — WORKFLOW.md requer premortem antes de features complexas",
          location: "shitenno-go/docs/premortems/",
          recommendation: "Executar 'pnpm run premortem:check' antes de iniciar tarefa complexa.",
          confidence: 0.7,
        });
      }
    }
  } catch {
    logger.debug("governance-enforcement", "Failed to check premortem");
  }

  return issues;
}

// ── 2.8 Missing ADR for Architectural Changes ───────────────────────────────

export function detectMissingAdrForChanges(shitenDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const adrDir = join(shitenDir, "docs", "adrs");
  if (!existsSync(adrDir)) return issues;

  try {
    const adrFiles = readdirSync(adrDir).filter((f) => f.endsWith(".md") && f.startsWith("ADR-"));
    if (adrFiles.length === 0) {
      issues.push({
        type: "no_adrs_created",
        severity: 1,
        description: "Nenhum ADR encontrado em docs/adrs/ — decisões arquiteturais não rastreadas",
        location: "shitenno-go/docs/adrs/",
        recommendation: "Criar ADRs para decisões arquiteturais significativas (DESDO §4).",
        confidence: 0.95,
      });
    }
  } catch {
    logger.debug("governance-enforcement", "Failed to scan ADR directory");
  }

  return issues;
}
