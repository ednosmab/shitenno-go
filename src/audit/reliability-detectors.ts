/**
 * Audit module — Reliability, Resilience & Concurrency detectors
 *
 * Detectors that validate circuit breakers, retry policies, timeouts,
 * health checks, graceful degradation, and concurrency safety.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { HealthIssue, SourceFileInfo } from "./types.js";

// ── 17.1 Circuit Breaker ────────────────────────────────────────────────────

export function detectCircuitBreaker(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const skipPatterns = [/\.test\.ts$/, /\.spec\.ts$/, /__tests__/];

  const externalCallPatterns = [/fetch\(/g, /axios\./g, /\.get\(/g, /\.post\(/g, /http\./g];
  const circuitBreakerPatterns = [/circuit.?breaker/i, /CircuitBreaker/, /opossum/, /cockatiel/];

  let externalCalls = 0;
  let hasCircuitBreaker = false;

  for (const file of files) {
    if (skipPatterns.some((p) => p.test(file.relPath))) continue;

    for (const pattern of externalCallPatterns) {
      const matches = file.content.match(pattern);
      if (matches) externalCalls += matches.length;
    }

    if (circuitBreakerPatterns.some((p) => p.test(file.content))) {
      hasCircuitBreaker = true;
    }
  }

  if (externalCalls > 10 && !hasCircuitBreaker) {
    issues.push({
      type: "missing_circuit_breaker",
      severity: 1,
      description: `${externalCalls} chamada(s) externa(s) detectada(s) mas nenhum circuit breaker configurado`,
      location: "src/",
      recommendation: "Implementar circuit breaker para chamadas externas (opossum, cockatiel, ou padrão próprio).",
    });
  }

  return issues;
}

// ── 17.2 Retry Policy ───────────────────────────────────────────────────────

export function detectRetryPolicy(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const skipPatterns = [/\.test\.ts$/, /\.spec\.ts$/, /__tests__/];

  const httpCallPattern = /(?:fetch|axios|got|node-fetch)\s*\(/g;
  const retryPattern = /retry|retries|backoff|exponential/i;

  let httpCalls = 0;
  let hasRetry = false;

  for (const file of files) {
    if (skipPatterns.some((p) => p.test(file.relPath))) continue;

    const matches = file.content.match(httpCallPattern);
    if (matches) httpCalls += matches.length;

    if (retryPattern.test(file.content)) {
      hasRetry = true;
    }
  }

  if (httpCalls > 5 && !hasRetry) {
    issues.push({
      type: "missing_retry_policy",
      severity: 1,
      description: `${httpCalls} chamada(s) HTTP detectada(s) mas nenhum mecanismo de retry configurado`,
      location: "src/",
      recommendation: "Adicionar retry com backoff exponencial para chamadas HTTP (async-retry, p-retry).",
    });
  }

  return issues;
}

// ── 17.3 Timeout Configuration ──────────────────────────────────────────────

export function detectTimeoutConfig(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const skipPatterns = [/\.test\.ts$/, /\.spec\.ts$/, /__tests__/];

  const fetchPattern = /fetch\s*\([^)]+\)/g;
  const timeoutPattern = /timeout|AbortController|AbortSignal|signal\s*:/;

  let fetchCalls = 0;
  let hasTimeout = false;

  for (const file of files) {
    if (skipPatterns.some((p) => p.test(file.relPath))) continue;

    const matches = file.content.match(fetchPattern);
    if (matches) fetchCalls += matches.length;

    if (timeoutPattern.test(file.content)) {
      hasTimeout = true;
    }
  }

  if (fetchCalls > 3 && !hasTimeout) {
    issues.push({
      type: "missing_timeout",
      severity: 1,
      description: `${fetchCalls} chamada(s) fetch() detectada(s) mas nenhum timeout configurado`,
      location: "src/",
      recommendation: "Adicionar timeout via AbortController/AbortSignal em todas as chamadas fetch().",
    });
  }

  return issues;
}

// ── 18.1 Health Check Endpoints ─────────────────────────────────────────────

export function detectHealthChecks(projectRoot: string): HealthIssue[] {
  const issues: HealthIssue[] = [];

  const commandDir = join(projectRoot, "src", "commands");
  if (!existsSync(commandDir)) return issues;

  const commandFiles = readdirSync(commandDir).filter((f: string) => f.endsWith(".ts") || f.endsWith(".tsx"));

  const hasHealthEndpoint = commandFiles.some((f: string) => {
    const content = readFileSync(join(commandDir, f), "utf-8");
    return /health|ready|alive|status|ping/i.test(content);
  });

  if (!hasHealthEndpoint && commandFiles.length > 3) {
    issues.push({
      type: "missing_health_check",
      severity: 1,
      description: "Nenhum endpoint de health check detectado entre os comandos",
      location: "src/commands/",
      recommendation: "Adicionar endpoint /health ou /status para verificação de disponibilidade.",
    });
  }

  return issues;
}

// ── 18.2 Graceful Degradation ───────────────────────────────────────────────

export function detectGracefulDegradation(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const skipPatterns = [/\.test\.ts$/, /\.spec\.ts$/, /__tests__/];

  let emptyCatchCount = 0;
  let catchWithFallback = 0;

  for (const file of files) {
    if (skipPatterns.some((p) => p.test(file.relPath))) continue;

    const catchBlocks = file.content.matchAll(/catch\s*(?:\([^)]*\))?\s*\{([^}]*)\}/g);
    for (const match of catchBlocks) {
      const block = match[1]?.trim() ?? "";
      if (block === "" || block === "// ignore" || block === "/* skip */") {
        emptyCatchCount++;
      } else if (/fallback|default|alternative|retry|return\s+(?:null|undefined|false|\[\]|\{\})/i.test(block)) {
        catchWithFallback++;
      }
    }
  }

  if (emptyCatchCount > 3 && catchWithFallback === 0) {
    issues.push({
      type: "no_graceful_degradation",
      severity: 1,
      description: `${emptyCatchCount} catch block(s) vazio(s) sem mecanismo de fallback`,
      location: "src/",
      recommendation: "Adicionar fallback ou default value em catch blocks para degradação graciosa.",
    });
  }

  return issues;
}

// ── 19.1 Race Condition Risk ────────────────────────────────────────────────

export function detectRaceConditions(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const skipPatterns = [/\.test\.ts$/, /\.spec\.ts$/, /__tests__/];

  let sharedStateCount = 0;
  let hasSync = false;

  for (const file of files) {
    if (skipPatterns.some((p) => p.test(file.relPath))) continue;

    const globalVarPattern = /^(?:let|var)\s+\w+/gm;
    const matches = file.content.match(globalVarPattern);
    if (matches) sharedStateCount += matches.length;

    if (/Mutex|Semaphore|Lock|synchronized|atomic|worker_threads/.test(file.content)) {
      hasSync = true;
    }
  }

  if (sharedStateCount > 5 && !hasSync) {
    issues.push({
      type: "race_condition_risk",
      severity: 1,
      description: `${sharedStateCount} variável(veis) global(is) detectada(s) sem mecanismo de sincronização`,
      location: "src/",
      recommendation: "Avaliar se variáveis partilhadas precisam de sincronização (Mutex, Semaphore).",
    });
  }

  return issues;
}

// ── 19.2 Deadlock Risk ──────────────────────────────────────────────────────

export function detectDeadlockRisk(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const skipPatterns = [/\.test\.ts$/, /\.spec\.ts$/, /__tests__/];

  let nestedLockCount = 0;

  for (const file of files) {
    if (skipPatterns.some((p) => p.test(file.relPath))) continue;

    const lockPattern = /(?:acquire|lock|wait)\s*\(/g;
    const matches = file.content.match(lockPattern);
    if (matches && matches.length > 1) {
      nestedLockCount += matches.length;
    }
  }

  if (nestedLockCount > 2) {
    issues.push({
      type: "deadlock_risk",
      severity: 2,
      description: `${nestedLockCount} operação(ões) de lock detectada(s) — risco de deadlock se aninhadas`,
      location: "src/",
      recommendation: "Verificar se locks são adquiridos sempre na mesma ordem para evitar deadlock.",
    });
  }

  return issues;
}
