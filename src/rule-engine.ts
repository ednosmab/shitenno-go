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
import { InvalidRuleError } from "./errors.js";
import { logger } from "./logger.js";
import { type Capability, loadMaturityProfile } from "./maturity-profile.js";
import { transitionTask, type BacklogState } from "./backlog-state-machine.js";
import { replaceSectionField, updateNextP0 } from "./context-buffer-writer.js";

// ── Security: Allowed Scripts ────────────────────────────────────────────────

/** Comandos permitidos para execução via regras. */
const ALLOWED_SCRIPTS: Record<string, string> = {
  "git-status": "git status --short",
  "git-diff": "git diff --stat",
  "git-log": "git log --oneline -5",
  "list-files": "find . -maxdepth 2 -type f | head -20",
};

/** Comandos Nexus permitidos para execução via regras. */
const ALLOWED_NEXUS_COMMANDS: Record<string, string> = {
  "briefing": "briefing --summary",
  "docs-audit": "docs-audit --json",
  "status": "status --quiet",
  "validate": "validate",
};

function isScriptAllowed(script: string): boolean {
  return script in ALLOWED_SCRIPTS;
}

function isNexusCommandAllowed(command: string): boolean {
  return command in ALLOWED_NEXUS_COMMANDS;
}

// ── Security: Rule ID Validation ────────────────────────────────────────────

function isValidRuleId(id: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(id) && id.length <= 100;
}

// ── Security: Regex Helpers ─────────────────────────────────────────────────

import { escapeRegex } from "./validation.js";

// ── Security: Prototype Pollution Protection ────────────────────────────────

const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype", "toString", "valueOf"]);

// ── Security: Schema Validation ─────────────────────────────────────────────

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export const VALID_ACTION_TYPES: readonly ActionType[] = [
  "update_context_buffer", "create_reminder", "remove_reminder",
  "update_quick_board", "create_adr", "create_skill", "log_event",
  "send_notification", "trigger_assessment", "trigger_health_check",
  "update_backlog", "run_local_script", "run_script", "run_nexus_command",
  "update_file", "create_file", "remove_file", "update_backlog_status",
  "archive_plan", "auto_populate_next_p0",
];

export function validateRule(rule: unknown): ValidationResult {
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
  if (r.requiredCapability !== undefined && typeof r.requiredCapability !== "string") errors.push("'requiredCapability' must be a string");

  if (Array.isArray(r.actions)) {
    for (const action of r.actions) {
      if (typeof action !== "object" || action === null) {
        errors.push("Action is not an object");
        continue;
      }
      const a = action as Record<string, unknown>;
      if (!VALID_ACTION_TYPES.includes(a.type as ActionType)) {
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
  | "task_completed"
  | "plan_archived"
  | "plan_status_changed"
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
  | "run_local_script"
  | "run_script"
  | "run_nexus_command"
  | "update_file"
  | "create_file"
  | "remove_file"
  | "update_backlog_status"
  | "archive_plan"
  | "auto_populate_next_p0";

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
  /** Capability necessária para a regra executar. Se ausente, a regra roda sempre. */
  requiredCapability?: Capability;
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
  /** Capabilities instaladas no projecto. */
  installedCapabilities?: Capability[];
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
        logger.warn("RuleEngine", `Invalid rule in ${file}: ${validation.errors.join(", ")}`);
        continue;
      }

      rules.push(parsed as Rule);
    } catch {
      logger.warn("RuleEngine", `Failed to parse ${file}`);
    }
  }

  return rules;
}

/** Grava uma regra no directório. */
export function saveRule(nexusDir: string, rule: Rule): void {
  if (!isValidRuleId(rule.id)) {
    throw new InvalidRuleError(`Rule ID: "${rule.id}". Only alphanumeric, hyphens and underscores allowed.`);
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

// ── Action Helpers ────────────────────────────────────────────────────────

/** Garante que governance/context/context_buffer.yaml existe, criando-o se necessário. */
function ensureContextBuffer(nexusDir: string): string {
  const bufferPath = join(nexusDir, "governance", "context", "context_buffer.yaml");
  if (!existsSync(bufferPath)) {
    const contextDir = join(nexusDir, "governance", "context");
    if (!existsSync(contextDir)) {
      mkdirSync(contextDir, { recursive: true });
    }
    writeFileSync(bufferPath, "reminders:\n\nproximo:\n\nsession:\n  id: \"auto-created\"\n  status: \"in_progress\"\n", "utf-8");
  }
  return bufferPath;
}

// ── Action Executor ─────────────────────────────────────────────────────────

/** Executa uma acção. */
async function executeAction(
  action: RuleAction,
  context: RuleContext
): Promise<{ success: boolean; message: string }> {
  switch (action.type) {
    case "update_context_buffer": {
      const field = String(action.params.field || "");
      const value = String(action.params.value || "");

      if (!field || !value) {
        return { success: false, message: "No field or value specified" };
      }

      const result = replaceSectionField(
        readFileSync(join(context.nexusDir, "governance", "context", "context_buffer.yaml"), "utf-8"),
        field,
        value
      );

      if (result.updated) {
        writeFileSync(join(context.nexusDir, "governance", "context", "context_buffer.yaml"), result.content, "utf-8");
        return { success: true, message: `Updated ${field} = ${value}` };
      }
      return { success: false, message: `Field "${field}" not found in buffer` };
    }

    case "create_reminder": {
      const bufferPath = ensureContextBuffer(context.nexusDir);

      try {
        let content = readFileSync(bufferPath, "utf-8");
        let reminder = String(action.params.message || "Reminder from rule engine");
        reminder = reminder
          .replace(/\\/g, "\\\\")
          .replace(/"/g, '\\"')
          .replace(/\n/g, "\\n")
          .substring(0, 200);
        const priority = String(action.params.priority || "medium");
        const category = String(action.params.category || "feature");
        const createdAt = new Date().toISOString();
        content = content.replace(
          /^reminders:\s*\n/,
          `reminders:\n  - message: "${reminder}"\n    priority: "${priority}"\n    category: "${category}"\n    createdAt: "${createdAt}"\n`
        );
        writeFileSync(bufferPath, content, "utf-8");
        return { success: true, message: `Created reminder: ${reminder} [${priority}/${category}]` };
      } catch {
        return { success: false, message: "Failed to create reminder" };
      }
    }

    case "update_quick_board": {
      const bufferPath = ensureContextBuffer(context.nexusDir);

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
      if (!existsSync(historyDir)) {
        mkdirSync(historyDir, { recursive: true });
      }

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
      const assessBin = join(context.projectRoot, "dist", "nexus.js");
      if (!existsSync(assessBin)) {
        return { success: true, message: "Assessment skipped: nexus binary not found (dev environment)" };
      }
      try {
        execSync("NEXUS_CHILD=1 node dist/nexus.js assess", {
          cwd: context.projectRoot,
          timeout: 60000,
          encoding: "utf-8",
          stdio: "pipe",
        });
        return { success: true, message: "Assessment triggered successfully" };
      } catch (error) {
        return { success: false, message: `Assessment failed: ${error instanceof Error ? error.message : String(error)}` };
      }
    }

    case "trigger_health_check": {
      const doctorBin = join(context.projectRoot, "dist", "nexus.js");
      if (!existsSync(doctorBin)) {
        return { success: true, message: "Health check skipped: nexus binary not found (dev environment)" };
      }
      try {
        execSync("NEXUS_CHILD=1 node dist/nexus.js doctor", {
          cwd: context.projectRoot,
          timeout: 60000,
          encoding: "utf-8",
          stdio: "pipe",
        });
        return { success: true, message: "Health check triggered successfully" };
      } catch (error) {
        return { success: false, message: `Health check failed: ${error instanceof Error ? error.message : String(error)}` };
      }
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

    case "update_backlog_status": {
      const taskId = String(action.params.taskId || "");
      const fromState = String(action.params.fromState || "");
      const toState = String(action.params.toState || "");

      if (!taskId || !fromState || !toState) {
        return { success: false, message: "Missing required params: taskId, fromState, toState" };
      }

      try {
        const result = transitionTask(context.nexusDir, taskId, fromState as BacklogState, toState as BacklogState);
        return { success: result.success, message: result.message };
      } catch (error) {
        return { success: false, message: `Failed to transition backlog: ${error instanceof Error ? error.message : String(error)}` };
      }
    }

    case "archive_plan": {
      const planId = String(action.params.planId || "");
      if (!planId) {
        return { success: false, message: "No plan ID specified" };
      }

      try {
        execSync(`NEXUS_CHILD=1 node dist/nexus.js plan md done ${planId}`, {
          cwd: context.projectRoot,
          timeout: 30000,
          encoding: "utf-8",
          stdio: "pipe",
        });
        return { success: true, message: `Plan archived: ${planId}` };
      } catch (error) {
        return { success: false, message: `Failed to archive plan: ${error instanceof Error ? error.message : String(error)}` };
      }
    }

    case "run_local_script": {
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

    case "run_script": {
      logger.warn("rule-engine", "'run_script' is deprecated, use 'run_local_script'");
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

    case "run_nexus_command": {
      const command = String(action.params.command || "");
      if (!command) return { success: false, message: "No nexus command specified" };

      if (!isNexusCommandAllowed(command)) {
        return {
          success: false,
          message: `Nexus command "${command}" not in allowlist. Allowed: ${Object.keys(ALLOWED_NEXUS_COMMANDS).join(", ")}`,
        };
      }

      try {
        const nexusCommand = ALLOWED_NEXUS_COMMANDS[command]!;
        const result = execSync(`NEXUS_CHILD=1 node dist/nexus.js ${nexusCommand}`, {
          cwd: context.projectRoot,
          timeout: 30000,
          encoding: "utf-8",
          stdio: "pipe",
        });
        return { success: true, message: `Nexus command executed: ${command}\n${result.trim()}` };
      } catch (error) {
        return { success: false, message: `Nexus command failed: ${error instanceof Error ? error.message : String(error)}` };
      }
    }

    case "auto_populate_next_p0": {
      try {
        const nexusDir = join(context.projectRoot, "nexus-system");
        const backlogPath = join(nexusDir, "docs", "BACKLOG.md");

        if (!existsSync(backlogPath)) {
          return { success: false, message: "BACKLOG.md not found" };
        }

        const backlogContent = readFileSync(backlogPath, "utf-8");

        // Find first unchecked P0 item
        const p0Match = backlogContent.match(/^- \[ \] \((P0|high)\)\s+(.+)/m);
        if (!p0Match) {
          return { success: true, message: "No P0 items in backlog to populate" };
        }

        const taskDesc = p0Match[2]!.trim();
        const result = updateNextP0(nexusDir, taskDesc);
        return { success: result.success, message: result.message };
      } catch (error) {
        return { success: false, message: `auto_populate_next_p0 failed: ${error instanceof Error ? error.message : String(error)}` };
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
export async function executeRules(
  rules: Rule[],
  context: RuleContext
): Promise<EngineResult> {
  const results: RuleResult[] = [];
  let executed = 0;
  let skipped = 0;
  let failed = 0;

  // Filtrar regras para este trigger, ordenar por prioridade
  const applicableRules = rules
    .filter((r) => {
      if (!r.enabled) return false;
      if (r.trigger !== context.trigger) return false;
      if (r.requiredCapability && context.installedCapabilities) {
        if (!context.installedCapabilities.includes(r.requiredCapability)) {
          logger.debug("rule-engine", `Skipping ${r.id}: requires capability "${r.requiredCapability}" (not installed)`);
          return false;
        }
      }
      return true;
    })
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
      const result = await executeAction(action, context);
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
      requiredCapability: "metrics",
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
      requiredCapability: "metrics",
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
      requiredCapability: "governance",
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
      requiredCapability: "governance",
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
      requiredCapability: "governance",
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
      requiredCapability: "metrics",
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
      requiredCapability: "governance",
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
      requiredCapability: "metrics",
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
      requiredCapability: "metrics",
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
      requiredCapability: "governance",
    },
    {
      id: "RULE-011",
      description: "Auto-audit when health status is critical",
      trigger: "health_check",
      conditions: [
        { field: "eventData.status", operator: "equals", value: "critical" },
      ],
      actions: [
        { type: "run_nexus_command", params: { command: "validate" } },
        { type: "create_reminder", params: { message: "Health status is CRITICAL — immediate action required" } },
      ],
      priority: 1,
      dependencies: [],
      enabled: true,
      tags: ["health", "critical", "auto-audit"],
      requiredCapability: undefined,
    },
    {
      id: "RULE-012",
      description: "Update context buffer on significant maturity change",
      trigger: "maturity_change",
      conditions: [
        { field: "eventData.delta", operator: "greater_than", value: 5 },
      ],
      actions: [
        { type: "update_context_buffer", params: { field: "current_task.description", value: "Maturity changed significantly" } },
        { type: "log_event", params: { event: "maturity_shift", message: "Significant maturity change detected" } },
      ],
      priority: 2,
      dependencies: [],
      enabled: true,
      tags: ["maturity", "context", "tracking"],
      requiredCapability: undefined,
    },
    {
      id: "RULE-013",
      description: "Create backlog item when knowledge debt gaps exceed threshold",
      trigger: "knowledge_debt_detected",
      conditions: [
        { field: "eventData.gapCount", operator: "greater_than", value: 3 },
      ],
      actions: [
        { type: "update_backlog", params: { item: "Address critical knowledge debt (3+ gaps detected)" } },
        { type: "create_reminder", params: { message: "High knowledge debt detected — create ADRs and skills" } },
      ],
      priority: 1,
      dependencies: [],
      enabled: true,
      tags: ["knowledge", "debt", "backlog", "critical"],
      requiredCapability: undefined,
    },
    {
      id: "RULE-014",
      description: "Create reminder when validation fails",
      trigger: "validation_fail",
      conditions: [],
      actions: [
        { type: "create_reminder", params: { message: "Validation failed — review issues and fix" } },
        { type: "update_quick_board", params: { item: "Fix validation failures", section: "parado" } },
      ],
      priority: 2,
      dependencies: [],
      enabled: true,
      tags: ["validation", "reminder", "fix"],
      requiredCapability: undefined,
    },
    {
      id: "RULE-015",
      description: "Archive active plans on session end",
      trigger: "session_end",
      conditions: [],
      actions: [
        { type: "log_event", params: { event: "session_end_plans", message: "Session ended — run 'nexus plan md lifecycle' to archive active plans" } },
      ],
      priority: 3,
      dependencies: [],
      enabled: true,
      tags: ["session", "plans", "verification"],
      requiredCapability: undefined,
    },
    {
      id: "RULE-016",
      description: "Auto-transition backlog to em validacao on task completion",
      trigger: "task_completed",
      conditions: [],
      actions: [
        { type: "update_backlog_status", params: { taskId: "${eventData.taskId}", fromState: "em implementação", toState: "em validação" } },
      ],
      priority: 1,
      dependencies: [],
      enabled: true,
      tags: ["backlog", "automation", "completion"],
      requiredCapability: undefined,
    },
    {
      id: "RULE-017",
      description: "Update context buffer on task completion",
      trigger: "task_completed",
      conditions: [],
      actions: [
        { type: "update_context_buffer", params: { field: "current_task.status", value: "completed" } },
      ],
      priority: 1,
      dependencies: [],
      enabled: true,
      tags: ["buffer", "automation", "completion"],
      requiredCapability: undefined,
    },
    {
      id: "RULE-018",
      description: "Update context buffer when a plan is archived",
      trigger: "plan_archived",
      conditions: [],
      actions: [
        { type: "update_context_buffer", params: { field: "current_task.status", value: "completed" } },
        { type: "update_context_buffer", params: { field: "session.status", value: "completed" } },
        { type: "log_event", params: { event: "plan_archived", message: "Plan archived — buffer updated automatically" } },
      ],
      priority: 1,
      dependencies: [],
      enabled: true,
      tags: ["buffer", "automation", "plan", "completion"],
      requiredCapability: undefined,
    },
    {
      id: "RULE-019",
      description: "Auto-populate next_p0 from BACKLOG.md when a plan is archived",
      trigger: "plan_archived",
      conditions: [],
      actions: [
        { type: "auto_populate_next_p0", params: {} },
      ],
      priority: 2,
      dependencies: ["RULE-018"],
      enabled: true,
      tags: ["buffer", "automation", "plan", "backlog", "next_p0"],
      requiredCapability: undefined,
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
  // Session events
  "session.start": "session_start",
  "session.end": "session_end",

  // Analysis events
  "analysis.complete": "file_change",
  "score.calculated": "file_change",

  // Pattern and health events
  "pattern.detected": "pattern_detected",
  "health.checked": "health_check",
  "debt.detected": "knowledge_debt_detected",

  // Capability events
  "capability.installed": "capability_install",
  "capability.unlocked": "capability_install",
  "maturity.changed": "maturity_change",

  // Rule events
  "rule.triggered": "manual",

  // Evolution events
  "evolution.recommended": "file_change",

  // Asset events
  "adr.created": "adr_created",
  "skill.created": "skill_created",
  "asset.created": "file_change",
  "asset.updated": "file_change",
  "asset.archived": "file_change",

  // Validation events
  "validation.completed": "validation_pass",
  "task.completed": "task_completed",

  // Pipeline events
  "pipeline.stage.start": "file_change",
  "pipeline.stage.complete": "file_change",
  "pipeline.complete": "pipeline_complete",

  // Lifecycle events
  "lifecycle.state_changed": "file_change",

  // Plan events
  "plan.archived": "plan_archived",
  "plan.status_changed": "plan_status_changed",

  // Knowledge events
  "knowledge.analyzed": "file_change",
  "knowledge_debt.detected": "knowledge_debt_detected",

  // Engineering state events
  "engineering_state.updated": "file_change",
  "engineering_state.consolidated": "file_change",

  // Recommendation feedback events
  "recommendation.accepted": "file_change",
  "recommendation.rejected": "file_change",

  // Governance events
  "governance.policy_applied": "file_change",

  // Entropy events
  "entropy.calculated": "file_change",

  // Command events
  "command.completed": "task_completed",

  // Doc lifecycle events
  "doc.lifecycle.audited": "file_change",

  // System events
  "system.updated": "file_change",

  // Pipeline start event
  "pipeline.started": "file_change",

  // Challenge events
  "challenge.generated": "file_change",

  // Doc sync events
  "docs.sync.triggered": "file_change",

  // State mutation events
  "state.mutated": "file_change",
};

/** Subscribe to event bus events and execute matching rules. */
export function initializeRuleEngine(
  projectRoot: string,
  nexusDir: string
): void {
  const bus = getEventBus();

  for (const [eventType, trigger] of Object.entries(EVENT_TO_TRIGGER)) {
    bus.subscribe(eventType as NexusEventType, async (payload: unknown) => {
      const rules = loadRules(nexusDir);
      if (rules.length === 0) {
        logger.debug(
          "rule-engine",
          `No rules loaded for event "${eventType}" — seed rules via governance/rules/ or see docs/adr/` 
        );
        return;
      }

      // Determine actual trigger based on payload
      let actualTrigger = trigger;
      if (eventType === "validation.completed") {
        const p = payload as Record<string, unknown>;
        actualTrigger = p.passed === false ? "validation_fail" : "validation_pass";
      }

      const context: RuleContext = {
        trigger: actualTrigger,
        eventData: payload as Record<string, unknown>,
        projectRoot,
        nexusDir,
        timestamp: new Date().toISOString(),
        installedCapabilities: loadMaturityProfile(nexusDir)?.installedCapabilities ?? ["core"],
      };

      await executeRules(rules, context);
    });
  }
}
