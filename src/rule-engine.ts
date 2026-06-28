/**
 * rule-engine.ts — Pilar 5: Rule Engine
 *
 * Centraliza todos os comportamentos automáticos do Nexus.
 * Mecanismo declarativo para gatilhos: quando algo acontece,
 * o engine avalia condições e executa acções.
 *
 * PRINCÍPIO: Declaração sobre imperativo.
 * Novos comportamentos sem alterar código — apenas adicionar regras.
 */

import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

// ── Security: Allowed Scripts ────────────────────────────────────────────────

/** Comandos permitidos para execução via regras. */
const ALLOWED_SCRIPTS: Record<string, string> = {
  "git-status": "git status --short",
  "git-diff": "git diff --stat",
  "git-log": "git log --oneline -5",
  "list-files": "find . -maxdepth 2 -type f | head -20",
};

function isScriptAllowed(script: string): boolean {
  return script in ALLOWED_SCRIPTS;
}

// ── Security: Rule ID Validation ────────────────────────────────────────────

function isValidRuleId(id: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(id) && id.length <= 100;
}

// ── Security: Regex Helpers ─────────────────────────────────────────────────

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Security: Prototype Pollution Protection ────────────────────────────────

const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype", "toString", "valueOf"]);

// ── Security: Schema Validation ─────────────────────────────────────────────

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const VALID_ACTION_TYPES = [
  "create_reminder", "update_quick_board", "log_event",
  "trigger_assessment", "trigger_health_check", "update_backlog", "run_script",
];

function validateRule(rule: unknown): ValidationResult {
  const errors: string[] = [];

  if (typeof rule !== "object" || rule === null) {
    return { valid: false, errors: ["Rule is not an object"] };
  }

  const r = rule as Record<string, unknown>;

  if (typeof r.id !== "string" || !r.id) errors.push("Missing or invalid 'id'");
  if (typeof r.trigger !== "string") errors.push("Missing or invalid 'trigger'");
  if (!Array.isArray(r.conditions)) errors.push("'conditions' must be an array");
  if (!Array.isArray(r.actions)) errors.push("'actions' must be an array");
  if (typeof r.priority !== "number") errors.push("'priority' must be a number");
  if (r.tags !== undefined && !Array.isArray(r.tags)) errors.push("'tags' must be an array");

  if (Array.isArray(r.actions)) {
    for (const action of r.actions) {
      if (typeof action !== "object" || action === null) {
        errors.push("Action is not an object");
        continue;
      }
      const a = action as Record<string, unknown>;
      if (!VALID_ACTION_TYPES.includes(a.type as string)) {
        errors.push(`Invalid action type: "${a.type}"`);
      }
      if (typeof a.params !== "object" || a.params === null) {
        errors.push(`Action "${a.type}" missing 'params'`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ── Types ───────────────────────────────────────────────────────────────────

/** Tipos de evento que disparam regras. */
export type TriggerType =
  | "session_start"
  | "session_end"
  | "file_change"
  | "git_commit"
  | "git_push"
  | "assessment"
  | "health_check"
  | "capability_install"
  | "capability_remove"
  | "adr_created"
  | "skill_created"
  | "contrato_created"
  | "validation_fail"
  | "validation_pass"
  | "maturity_change"
  | "knowledge_debt_detected"
  | "pattern_detected"
  | "pipeline_complete"
  | "manual";

/** Operadores para condições. */
export type ConditionOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "greater_than"
  | "less_than"
  | "exists"
  | "not_exists"
  | "matches_regex";

/** Acções executáveis pelo engine. */
export type ActionType =
  | "update_context_buffer"
  | "create_reminder"
  | "remove_reminder"
  | "update_quick_board"
  | "create_adr"
  | "create_skill"
  | "log_event"
  | "send_notification"
  | "trigger_assessment"
  | "trigger_health_check"
  | "update_backlog"
  | "run_script"
  | "update_file"
  | "create_file"
  | "remove_file";

/** Uma regra declarativa. */
export interface Rule {
  /** Identificador único da regra. */
  id: string;
  /** Descrição legível. */
  description: string;
  /** Quando activar (trigger). */
  trigger: TriggerType;
  /** Condições para executar (todas devem ser verdadeiras). */
  conditions: RuleCondition[];
  /** Acções a executar (em ordem). */
  actions: RuleAction[];
  /** Prioridade (1=alta, 5=baixa). */
  priority: number;
  /** Regras que devem executar primeiro. */
  dependencies: string[];
  /** Se true, regra está activa. */
  enabled: boolean;
  /** Tags para filtragem. */
  tags: string[];
}

/** Condição de uma regra. */
export interface RuleCondition {
  /** Campo a avaliar (ex: "maturity.overallScore"). */
  field: string;
  /** Operador. */
  operator: ConditionOperator;
  /** Valor para comparar. */
  value: string | number | boolean;
}

/** Acção de uma regra. */
export interface RuleAction {
  /** Tipo de acção. */
  type: ActionType;
  /** Parâmetros da acção. */
  params: Record<string, string | number | boolean>;
}

/** Contexto de execução de uma regra. */
export interface RuleContext {
  /** Tipo de evento que disparou. */
  trigger: TriggerType;
  /** Dados do evento. */
  eventData: Record<string, unknown>;
  /** Project root. */
  projectRoot: string;
  /** Nexus dir. */
  nexusDir: string;
  /** Timestamp. */
  timestamp: string;
}

/** Resultado da execução de uma regra. */
export interface RuleResult {
  /** ID da regra executada. */
  ruleId: string;
  /** Se foi executada com sucesso. */
  success: boolean;
  /** Mensagem resultado. */
  message: string;
  /** Acções executadas. */
  actionsExecuted: number;
  /** Tempo de execução (ms). */
  duration: number;
}

/** Resultado do engine. */
export interface EngineResult {
  /** Total de regras avaliadas. */
  rulesEvaluated: number;
  /** Total de regras executadas. */
  rulesExecuted: number;
  /** Total de regras ignoradas (condições não cumpridas). */
  rulesSkipped: number;
  /** Total de erros. */
  rulesFailed: number;
  /** Resultados individuais. */
  results: RuleResult[];
  /** Resumo legível. */
  summary: string;
}

// ── Rule Storage ────────────────────────────────────────────────────────────

const RULES_DIR = "governance/rules";

/** Lê todas as regras de um directório. */
export function loadRules(nexusDir: string): Rule[] {
  const rulesPath = join(nexusDir, RULES_DIR);
  if (!existsSync(rulesPath)) return [];

  const files = readdirSync(rulesPath).filter(
    (f) => f.endsWith(".json") && !f.startsWith("_")
  );

  const rules: Rule[] = [];
  for (const file of files) {
    try {
      const content = readFileSync(join(rulesPath, file), "utf-8");
      const parsed = JSON.parse(content);
      const validation = validateRule(parsed);

      if (!validation.valid) {
        console.warn(`[RuleEngine] Invalid rule in ${file}: ${validation.errors.join(", ")}`);
        continue;
      }

      rules.push(parsed as Rule);
    } catch {
      console.warn(`[RuleEngine] Failed to parse ${file}`);
    }
  }

  return rules;
}

/** Grava uma regra no directório. */
export function saveRule(nexusDir: string, rule: Rule): void {
  if (!isValidRuleId(rule.id)) {
    throw new Error(`Invalid rule ID: "${rule.id}". Only alphanumeric, hyphens and underscores allowed.`);
  }

  const rulesPath = join(nexusDir, RULES_DIR);
  if (!existsSync(rulesPath)) {
    mkdirSync(rulesPath, { recursive: true });
  }

  const filepath = join(rulesPath, `${rule.id}.json`);
  writeFileSync(filepath, JSON.stringify(rule, null, 2), "utf-8");
}

// ── Condition Evaluator ─────────────────────────────────────────────────────

/** Avalia uma condição contra o contexto. */
function evaluateCondition(
  condition: RuleCondition,
  context: RuleContext
): boolean {
  const fieldValue = resolveField(condition.field, context);
  const targetValue = condition.value;

  switch (condition.operator) {
    case "equals":
      return fieldValue === targetValue;
    case "not_equals":
      return fieldValue !== targetValue;
    case "contains":
      return String(fieldValue).includes(String(targetValue));
    case "not_contains":
      return !String(fieldValue).includes(String(targetValue));
    case "greater_than":
      return Number(fieldValue) > Number(targetValue);
    case "less_than":
      return Number(fieldValue) < Number(targetValue);
    case "exists":
      return fieldValue !== undefined && fieldValue !== null;
    case "not_exists":
      return fieldValue === undefined || fieldValue === null;
    case "matches_regex": {
      try {
        const pattern = String(targetValue);
        if (pattern.length > 200) return false;
        const groupCount = (pattern.match(/\(/g) || []).length;
        if (groupCount > 10) return false;
        const regex = new RegExp(pattern);
        return regex.test(String(fieldValue));
      } catch {
        return false;
      }
    }
    default:
      return false;
  }
}

/** Resolve um campo do contexto (notação pontilhada). */
function resolveField(
  field: string,
  context: RuleContext
): string | number | boolean | undefined {
  const parts = field.split(".");
  let current: unknown = context;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (DANGEROUS_KEYS.has(part)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current as string | number | boolean | undefined;
}

// ── Action Executor ─────────────────────────────────────────────────────────

/** Executa uma acção. */
function executeAction(
  action: RuleAction,
  context: RuleContext
): { success: boolean; message: string } {
  switch (action.type) {
    case "create_reminder": {
      const bufferPath = join(context.nexusDir, "governance", "context", "context_buffer.yaml");
      if (!existsSync(bufferPath)) return { success: false, message: "context_buffer.yaml not found" };

      try {
        let content = readFileSync(bufferPath, "utf-8");
        let reminder = String(action.params.message || "Reminder from rule engine");
        reminder = reminder
          .replace(/\\/g, "\\\\")
          .replace(/"/g, '\\"')
          .replace(/\n/g, "\\n")
          .substring(0, 200);
        content = content.replace(
          /^reminders:\s*\n/,
          `reminders:\n  - "${reminder}"\n`
        );
        writeFileSync(bufferPath, content, "utf-8");
        return { success: true, message: `Created reminder: ${reminder}` };
      } catch {
        return { success: false, message: "Failed to create reminder" };
      }
    }

    case "update_quick_board": {
      const bufferPath = join(context.nexusDir, "governance", "context", "context_buffer.yaml");
      if (!existsSync(bufferPath)) return { success: false, message: "context_buffer.yaml not found" };

      try {
        let content = readFileSync(bufferPath, "utf-8");
        const item = String(action.params.item || "");
        const section = String(action.params.section || "proximo");

        if (item) {
          content = content.replace(
            new RegExp(`(${escapeRegex(section)}:\\s*\\n)`),
            `$1    - "${item}"\n`
          );
          writeFileSync(bufferPath, content, "utf-8");
          return { success: true, message: `Updated quick board: ${section}` };
        }
        return { success: false, message: "No item specified" };
      } catch {
        return { success: false, message: "Failed to update quick board" };
      }
    }

    case "log_event": {
      const historyDir = join(context.nexusDir, "docs", "history");
      if (!existsSync(historyDir)) return { success: false, message: "history/ not found" };

      try {
        const date = new Date().toISOString().slice(0, 10);
        const event = String(action.params.event || "rule_engine_event")
          .replace(/[^a-zA-Z0-9_-]/g, "_")
          .slice(0, 50);
        const message = String(action.params.message || "");
        const filename = `${date}-rule-${event}.md`;
        const filepath = join(historyDir, filename);

        const content = `# ${event}\n\nDate: ${context.timestamp}\nRule: ${context.eventData.ruleId || "unknown"}\n\n${message}\n`;
        writeFileSync(filepath, content, "utf-8");
        return { success: true, message: `Logged event: ${event}` };
      } catch {
        return { success: false, message: "Failed to log event" };
      }
    }

    case "trigger_assessment": {
      return { success: true, message: "Assessment triggered (manual action required)" };
    }

    case "trigger_health_check": {
      return { success: true, message: "Health check triggered (manual action required)" };
    }

    case "update_backlog": {
      const backlogPath = join(context.nexusDir, "docs", "BACKLOG.md");
      if (!existsSync(backlogPath)) return { success: false, message: "BACKLOG.md not found" };

      try {
        let content = readFileSync(backlogPath, "utf-8");
        const item = String(action.params.item || "");
        if (item) {
          content += `\n| ${item} | 🟡 Médio | Backlog | ${new Date().toISOString().slice(0, 10)} | unassigned |`;
          writeFileSync(backlogPath, content, "utf-8");
          return { success: true, message: `Updated backlog: ${item}` };
        }
        return { success: false, message: "No item specified" };
      } catch {
        return { success: false, message: "Failed to update backlog" };
      }
    }

    case "run_script": {
      const script = String(action.params.script || "");
      if (!script) return { success: false, message: "No script specified" };

      if (!isScriptAllowed(script)) {
        return {
          success: false,
          message: `Script "${script}" not in allowlist. Allowed: ${Object.keys(ALLOWED_SCRIPTS).join(", ")}`,
        };
      }

      try {
        const command = ALLOWED_SCRIPTS[script]!;
        execSync(command, {
          cwd: context.projectRoot,
          timeout: 30000,
          encoding: "utf-8",
          stdio: "pipe",
        });
        return { success: true, message: `Script executed: ${script}` };
      } catch (error) {
        return { success: false, message: `Script failed: ${error instanceof Error ? error.message : String(error)}` };
      }
    }

    default:
      return { success: false, message: `Unknown action type: ${action.type}` };
  }
}

// ── Engine ──────────────────────────────────────────────────────────────────

/**
 * Executa o engine de regras para um determinado trigger.
 */
export function executeRules(
  rules: Rule[],
  context: RuleContext
): EngineResult {
  const results: RuleResult[] = [];
  let executed = 0;
  let skipped = 0;
  let failed = 0;

  // Filtrar regras para este trigger, ordenar por prioridade
  const applicableRules = rules
    .filter((r) => r.enabled && r.trigger === context.trigger)
    .sort((a, b) => a.priority - b.priority);

  for (const rule of applicableRules) {
    const startTime = Date.now();

    // Verificar dependências
    if (rule.dependencies.length > 0) {
      const depsMet = rule.dependencies.every((depId) =>
        results.some((r) => r.ruleId === depId && r.success)
      );
      if (!depsMet) {
        results.push({
          ruleId: rule.id,
          success: false,
          message: "Dependencies not met",
          actionsExecuted: 0,
          duration: Date.now() - startTime,
        });
        skipped++;
        continue;
      }
    }

    // Avaliar condições
    const conditionsMet = rule.conditions.every((cond) =>
      evaluateCondition(cond, context)
    );

    if (!conditionsMet) {
      results.push({
        ruleId: rule.id,
        success: false,
        message: "Conditions not met",
        actionsExecuted: 0,
        duration: Date.now() - startTime,
      });
      skipped++;
      continue;
    }

    // Executar acções
    let actionsExecuted = 0;
    let allSuccess = true;

    for (const action of rule.actions) {
      const result = executeAction(action, context);
      if (result.success) {
        actionsExecuted++;
      } else {
        allSuccess = false;
      }
    }

    const duration = Date.now() - startTime;

    results.push({
      ruleId: rule.id,
      success: allSuccess,
      message: allSuccess
        ? `${actionsExecuted} action(s) executed`
        : "Some actions failed",
      actionsExecuted,
      duration,
    });

    if (allSuccess) executed++;
    else failed++;
  }

  const total = rules.filter((r) => r.enabled && r.trigger === context.trigger).length;

  return {
    rulesEvaluated: total,
    rulesExecuted: executed,
    rulesSkipped: skipped,
    rulesFailed: failed,
    results,
    summary: `${executed}/${total} rules executed, ${skipped} skipped, ${failed} failed`,
  };
}

// ── Default Rules ───────────────────────────────────────────────────────────

/** Gera regras padrão para o Nexus System. */
export function getDefaultRules(): Rule[] {
  return [
    {
      id: "RULE-001",
      description: "Log session start in history",
      trigger: "session_start",
      conditions: [],
      actions: [
        { type: "log_event", params: { event: "session_start", message: "Session started" } },
      ],
      priority: 1,
      dependencies: [],
      enabled: true,
      tags: ["session", "logging"],
    },
    {
      id: "RULE-002",
      description: "Log session end in history",
      trigger: "session_end",
      conditions: [],
      actions: [
        { type: "log_event", params: { event: "session_end", message: "Session ended" } },
      ],
      priority: 1,
      dependencies: [],
      enabled: true,
      tags: ["session", "logging"],
    },
    {
      id: "RULE-003",
      description: "Trigger health check on validation failure",
      trigger: "validation_fail",
      conditions: [
        { field: "eventData.failCount", operator: "greater_than", value: 3 },
      ],
      actions: [
        { type: "trigger_health_check", params: {} },
        { type: "create_reminder", params: { message: "Multiple validation failures detected — run 'nexus audit'" } },
      ],
      priority: 2,
      dependencies: [],
      enabled: true,
      tags: ["validation", "health"],
    },
    {
      id: "RULE-004",
      description: "Recommend capability upgrade on maturity increase",
      trigger: "maturity_change",
      conditions: [
        { field: "eventData.delta", operator: "greater_than", value: 10 },
      ],
      actions: [
        { type: "update_quick_board", params: { item: "Run 'nexus upgrade --accept-recommended'", section: "proximo" } },
      ],
      priority: 3,
      dependencies: [],
      enabled: true,
      tags: ["maturity", "upgrade"],
    },
    {
      id: "RULE-005",
      description: "Update backlog when knowledge debt is detected",
      trigger: "knowledge_debt_detected",
      conditions: [
        { field: "eventData.gapCount", operator: "greater_than", value: 0 },
      ],
      actions: [
        { type: "update_backlog", params: { item: "Address knowledge debt gaps" } },
        { type: "create_reminder", params: { message: "Knowledge debt detected — review gaps" } },
      ],
      priority: 2,
      dependencies: [],
      enabled: true,
      tags: ["knowledge", "debt", "backlog"],
    },
    {
      id: "RULE-006",
      description: "Log pattern detection results",
      trigger: "pattern_detected",
      conditions: [
        { field: "eventData.patternCount", operator: "greater_than", value: 0 },
      ],
      actions: [
        { type: "log_event", params: { event: "pattern_detected", message: "Patterns detected in project history" } },
      ],
      priority: 3,
      dependencies: [],
      enabled: true,
      tags: ["pattern", "logging"],
    },
    {
      id: "RULE-007",
      description: "Remind to improve health when pipeline score is low",
      trigger: "session_start",
      conditions: [
        { field: "eventData.healthScore", operator: "less_than", value: 50 },
      ],
      actions: [
        { type: "create_reminder", params: { message: "Health score is below 50 — run 'nexus audit' to improve" } },
      ],
      priority: 2,
      dependencies: [],
      enabled: true,
      tags: ["health", "reminder", "pipeline"],
    },
    {
      id: "RULE-008",
      description: "Log ADR creation and suggest skill extraction",
      trigger: "adr_created",
      conditions: [],
      actions: [
        { type: "log_event", params: { event: "adr_created", message: "New ADR created — consider extracting skills" } },
      ],
      priority: 3,
      dependencies: [],
      enabled: true,
      tags: ["adr", "skill", "logging"],
    },
    {
      id: "RULE-009",
      description: "Log successful full validation",
      trigger: "validation_pass",
      conditions: [
        { field: "eventData.passRate", operator: "equals", value: 100 },
      ],
      actions: [
        { type: "log_event", params: { event: "validation_complete", message: "All validations passed — system is healthy" } },
      ],
      priority: 4,
      dependencies: [],
      enabled: true,
      tags: ["validation", "logging", "success"],
    },
    {
      id: "RULE-010",
      description: "Remind about knowledge debt on session start",
      trigger: "session_start",
      conditions: [
        { field: "eventData.knowledgeDebt", operator: "greater_than", value: 5 },
      ],
      actions: [
        { type: "create_reminder", params: { message: "Knowledge debt is high — address gaps in ADRs and skills" } },
        { type: "update_backlog", params: { item: "Reduce knowledge debt" } },
      ],
      priority: 1,
      dependencies: [],
      enabled: true,
      tags: ["knowledge", "debt", "session"],
    },
  ];
}

// ── Engine Initialization ───────────────────────────────────────────────────

/** Inicializa o directório de regras com regras padrão se vazio. */
export function initializeRules(nexusDir: string): void {
  const rulesPath = join(nexusDir, RULES_DIR);
  if (!existsSync(rulesPath)) {
    mkdirSync(rulesPath, { recursive: true });
  }

  const existingRules = loadRules(nexusDir);
  if (existingRules.length > 0) return;

  const defaultRules = getDefaultRules();
  for (const rule of defaultRules) {
    saveRule(nexusDir, rule);
  }
}

// ── Event Bus Integration ──────────────────────────────────────────────────

import { getEventBus, type NexusEventType } from "./event-bus.js";

/** Map event bus events to rule engine triggers. */
const EVENT_TO_TRIGGER: Partial<Record<NexusEventType, TriggerType>> = {
  "session.start": "session_start",
  "session.end": "session_end",
  "validation.completed": "validation_fail",
  "maturity.changed": "maturity_change",
  "pattern.detected": "pattern_detected",
  "health.checked": "health_check",
  "pipeline.complete": "pipeline_complete",
  "adr.created": "adr_created",
};

/** Subscribe to event bus events and execute matching rules. */
export function initializeRuleEngine(
  projectRoot: string,
  nexusDir: string
): void {
  const bus = getEventBus();

  for (const [eventType, trigger] of Object.entries(EVENT_TO_TRIGGER)) {
    bus.subscribe(eventType as NexusEventType, (payload: unknown) => {
      const rules = loadRules(nexusDir);
      if (rules.length === 0) return;

      const context: RuleContext = {
        trigger,
        eventData: payload as Record<string, unknown>,
        projectRoot,
        nexusDir,
        timestamp: new Date().toISOString(),
      };

      executeRules(rules, context);
    });
  }
}
