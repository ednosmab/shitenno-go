/**
 * Audit module — Suggestion Engine
 *
 * Generates fix suggestions for detected issues.
 * NEVER auto-applies — always requires user confirmation.
 * All suggestions are deterministic — no LLM calls, no external APIs.
 */

import type { HealthIssue, SourceFileInfo } from "./types.js";

// ── Suggestion Interface ─────────────────────────────────────────────────────

export interface Suggestion {
  id: string;
  issueType: string;
  description: string;
  file: string;
  line: number;
  currentCode: string;
  suggestedCode: string;
  confidence: number; // 0-1, based on deterministic patterns
  requiresConfirmation: true; // ALWAYS true
  reasoning: string; // Why this suggestion
}

// ── Fix Templates (deterministic patterns) ──────────────────────────────────

const FIX_TEMPLATES: Record<string, (issue: HealthIssue) => Suggestion | null> = {
  "unused_import": (issue) => {
    const match = issue.description.match(/Import não usado: "(\w+)" em "([^"]+)"/);
    if (!match?.[1] || !match?.[2]) return null;

    return {
      id: `fix-${issue.type}-${Date.now()}`,
      issueType: issue.type,
      description: `Remover import não utilizado: ${match[1]}`,
      file: match[2],
      line: 0,
      currentCode: `import { ${match[1]} } from "...";`,
      suggestedCode: `// Remover esta linha`,
      confidence: 0.95,
      requiresConfirmation: true,
      reasoning: "Import não utilizado aumenta tamanho do bundle e dificulta manutenção.",
    };
  },

  "empty_catch": (issue) => {
    const match = issue.description.match(/em "([^"]+)"/);
    if (!match?.[1]) return null;

    return {
      id: `fix-${issue.type}-${Date.now()}`,
      issueType: issue.type,
      description: "Catch block vazio — adicionar tratamento de erro ou log",
      file: match[1],
      line: 0,
      currentCode: "catch (error) { }",
      suggestedCode: "catch (error) { console.error('Error:', error); }",
      confidence: 0.85,
      requiresConfirmation: true,
      reasoning: "Catch blocks vazios engolem erros silenciosamente, dificultando debug.",
    };
  },

  "console_log_outside_cmd": (issue) => {
    const match = issue.description.match(/em "([^"]+)"/);
    if (!match?.[1]) return null;

    return {
      id: `fix-${issue.type}-${Date.now()}`,
      issueType: issue.type,
      description: "Substituir console.log por logger estruturado",
      file: match[1],
      line: 0,
      currentCode: "console.log(data)",
      suggestedCode: "logger.info({ data }, 'Event');",
      confidence: 0.75,
      requiresConfirmation: true,
      reasoning: "Logger estruturado oferece levels, timestamps e contexto para produção.",
    };
  },

  "magic_numbers": (issue) => {
    const match = issue.description.match(/em "([^"]+)"/);
    if (!match?.[1]) return null;

    return {
      id: `fix-${issue.type}-${Date.now()}`,
      issueType: issue.type,
      description: "Extrair número mágico para constante nomeada",
      file: match[1],
      line: 0,
      currentCode: "if (retries > 3)",
      suggestedCode: "const MAX_RETRIES = 3;\nif (retries > MAX_RETRIES)",
      confidence: 0.9,
      requiresConfirmation: true,
      reasoning: "Constantes nomeadas melhoram legibilidade e facilitam manutenção.",
    };
  },

  "missing_circuit_breaker": (issue) => {
    const match = issue.description.match(/em "([^"]+)"/);
    if (!match?.[1]) return null;

    return {
      id: `fix-${issue.type}-${Date.now()}`,
      issueType: issue.type,
      description: "Adicionar circuit breaker em chamada externa",
      file: match[1],
      line: 0,
      currentCode: "await fetch(url)",
      suggestedCode: "await circuitBreaker.execute(() => fetch(url))",
      confidence: 0.7,
      requiresConfirmation: true,
      reasoning: "Circuit breaker previne cascata de falhas em chamadas externas.",
    };
  },

  "missing_retry_policy": (issue) => {
    const match = issue.description.match(/em "([^"]+)"/);
    if (!match?.[1]) return null;

    return {
      id: `fix-${issue.type}-${Date.now()}`,
      issueType: issue.type,
      description: "Adicionar política de retry com backoff",
      file: match[1],
      line: 0,
      currentCode: "await fetch(url)",
      suggestedCode: "await retry(() => fetch(url), { retries: 3, backoff: 'exponential' })",
      confidence: 0.75,
      requiresConfirmation: true,
      reasoning: "Retry com backoff tolera falhas temporárias em serviços externos.",
    };
  },

  "missing_timeout": (issue) => {
    const match = issue.description.match(/em "([^"]+)"/);
    if (!match?.[1]) return null;

    return {
      id: `fix-${issue.type}-${Date.now()}`,
      issueType: issue.type,
      description: "Adicionar timeout em chamada externa",
      file: match[1],
      line: 0,
      currentCode: "await fetch(url)",
      suggestedCode: "await fetch(url, { signal: AbortSignal.timeout(5000) })",
      confidence: 0.8,
      requiresConfirmation: true,
      reasoning: "Timeout previne bloqueio indefinido em chamadas lentas.",
    };
  },

  "n_plus_one_query": (issue) => {
    const match = issue.description.match(/em "([^"]+)"/);
    if (!match?.[1]) return null;

    return {
      id: `fix-${issue.type}-${Date.now()}`,
      issueType: issue.type,
      description: "Substituir N+1 query por batch query",
      file: match[1],
      line: 0,
      currentCode: "for (const item of items) { await db.get(item.id); }",
      suggestedCode: "await db.getByIds(items.map(i => i.id));",
      confidence: 0.85,
      requiresConfirmation: true,
      reasoning: "N+1 query causa degradação de performance exponencial com volume.",
    };
  },
};

// ── Suggestion Engine ───────────────────────────────────────────────────────

export function generateFixSuggestions(
  issues: HealthIssue[],
  _files: SourceFileInfo[],
): Suggestion[] {
  const suggestions: Suggestion[] = [];

  for (const issue of issues) {
    const template = FIX_TEMPLATES[issue.type];
    if (!template) continue;

    const suggestion = template(issue);
    if (suggestion && suggestion.confidence >= 0.7) {
      suggestions.push(suggestion);
    }
  }

  return suggestions;
}

// ── Priority Sort ───────────────────────────────────────────────────────────

export function prioritizeSuggestions(suggestions: Suggestion[]): Suggestion[] {
  return suggestions.sort((a, b) => {
    const scoreA = a.confidence * (a.issueType.includes("security") ? 2 : 1);
    const scoreB = b.confidence * (b.issueType.includes("security") ? 2 : 1);
    return scoreB - scoreA;
  });
}

// ── Effort Estimation ───────────────────────────────────────────────────────

const EFFORT_HOURS: Record<string, number> = {
  "unused_import": 0.25,
  "empty_catch": 0.5,
  "console_log_outside_cmd": 0.5,
  "magic_numbers": 0.25,
  "missing_circuit_breaker": 2,
  "missing_retry_policy": 1,
  "missing_timeout": 0.5,
  "n_plus_one_query": 1,
};

export function estimateFixEffort(suggestions: Suggestion[]): Map<string, number> {
  const effort = new Map<string, number>();

  for (const s of suggestions) {
    const hours = EFFORT_HOURS[s.issueType] || 1;
    effort.set(s.id, hours);
  }

  return effort;
}
