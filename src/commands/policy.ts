/**
 * policy.ts — Policy Engine CLI Command
 *
 * The `nexus policy` command. Manage and evaluate declarative policies.
 *
 * Usage:
 *   nexus policy list
 *   nexus policy show POL-abc123
 *   nexus policy create "No hardcoded secrets" --mode enforce --effect deny --field "fileContent" --operator contains --value "password"
 *   nexus policy evaluate --field "riskLevel" --operator equals --value "critical"
 *   nexus policy enable POL-abc123
 *   nexus policy disable POL-abc123
 *   nexus policy delete POL-abc123
 *   nexus policy stats
 */

import { Command } from "commander";
import chalk from "chalk";
import { join } from "node:path";
import { guardNotInitialized } from "../shared.js";
import { NEXUS_DIR_NAME } from "../constants.js";
import {
  PolicyEngine,
  FilePolicyRepository,
  type PolicyMode,
  type PolicyEffect,
  type ComparisonOperator,
} from "../policy-engine.js";
import { outputJson } from "../formatting.js";
import { output, outputBlank, outputSection, outputSuccess, outputError, outputWarning } from "../output.js";

// ── Helpers ────────────────────────────────────────────────────────────────

function getEngine(dir: string): PolicyEngine {
  const nexusDir = join(dir, NEXUS_DIR_NAME);
  return new PolicyEngine(new FilePolicyRepository(nexusDir));
}

const MODE_COLORS: Record<PolicyMode, (s: string) => string> = {
  enforce: (s) => chalk.red.bold(s),
  advisory: (s) => chalk.yellow(s),
};

const EFFECT_COLORS: Record<PolicyEffect, (s: string) => string> = {
  allow: (s) => chalk.green(s),
  deny: (s) => chalk.red(s),
  require: (s) => chalk.cyan(s),
  notify: (s) => chalk.gray(s),
};

// ── Command ────────────────────────────────────────────────────────────────

export function policyCommand(): Command {
  const cmd = new Command("policy")
    .description("Manage and evaluate declarative governance policies")
    .option("-d, --dir <path>", "Project directory");

  // ── list ────────────────────────────────────────────────────────────────
  cmd
    .command("list")
    .description("List all policies")
    .option("--mode <mode>", "Filter by mode (enforce, advisory)")
    .option("--category <cat>", "Filter by category")
    .option("--json", "Output as JSON")
    .action((opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;

      const engine = getEngine(ctx.projectRoot);
      const policies = engine.list({
        mode: opts.mode as PolicyMode,
        category: opts.category as string,
      });

      if (isJson) {
        outputJson(policies as unknown as Record<string, unknown>);
        return;
      }

      outputBlank();
      if (policies.length === 0) {
        output(chalk.dim("  No policies defined. Create one with: nexus policy create \"<name>\""));
      } else {
        outputSection(`Policies (${policies.length})`);
        output(chalk.dim("  " + "─".repeat(70)));
        for (const p of policies) {
          const status = p.enabled ? chalk.green("ON ") : chalk.dim("OFF");
          const mode = MODE_COLORS[p.mode](p.mode.padEnd(8));
          const effect = EFFECT_COLORS[p.effect](p.effect.padEnd(8));
          output(`  ${chalk.bold(p.id)}  ${status}  ${mode}  ${effect}  ${p.name}`);
        }
      }
      outputBlank();
    });

  // ── show ────────────────────────────────────────────────────────────────
  cmd
    .command("show")
    .description("Show policy details")
    .argument("<id>", "Policy ID")
    .option("--json", "Output as JSON")
    .action((id: string, opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;

      const engine = getEngine(ctx.projectRoot);
      const policy = engine.get(id);

      if (!policy) {
        if (isJson) {
          outputJson({ error: "Policy not found" });
        } else {
          outputError(`Policy not found: ${id}`);
        }
        return;
      }

      if (isJson) {
        outputJson(policy as unknown as Record<string, unknown>);
        return;
      }

      outputBlank();
      output(chalk.bold(`  ${policy.id}`));
      output(`  ${policy.name}`);
      if (policy.description) output(`  ${chalk.dim(policy.description)}`);
      outputBlank();
      output(`  Mode:     ${MODE_COLORS[policy.mode](policy.mode)}`);
      output(`  Effect:   ${EFFECT_COLORS[policy.effect](policy.effect)}`);
      output(`  Enabled:  ${policy.enabled ? chalk.green("Yes") : chalk.red("No")}`);
      output(`  Priority: ${policy.priority}`);
      if (policy.categories?.length) output(`  Categories: ${policy.categories.join(", ")}`);
      if (policy.tags?.length) output(`  Tags:     ${policy.tags.join(", ")}`);
      outputBlank();
      if (policy.conditions.length > 0) {
        outputSection("Conditions:");
        for (const c of policy.conditions) {
          output(`    ${c.field} ${c.operator} ${c.value ?? "(any)"}`);
        }
      }
      if (policy.actions.length > 0) {
        outputSection("Actions:");
        for (const a of policy.actions) {
          output(`    ${a.type}: ${JSON.stringify(a.params)}`);
        }
      }
      outputBlank();
    });

  // ── create ──────────────────────────────────────────────────────────────
  cmd
    .command("create")
    .description("Create a new policy")
    .argument("<name>", "Policy name")
    .option("--description <text>", "Policy description")
    .option("--mode <mode>", "Mode: enforce, advisory", "advisory")
    .option("--effect <effect>", "Effect: allow, deny, require, notify", "notify")
    .option("--field <field>", "Condition field path")
    .option("--operator <op>", "Condition operator", "equals")
    .option("--value <value>", "Condition value")
    .option("--category <cats>", "Comma-separated categories")
    .option("--tag <tags>", "Comma-separated tags")
    .option("--priority <n>", "Priority (lower = higher)", "100")
    .option("--json", "Output as JSON")
    .action((name: string, opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;

      const engine = getEngine(ctx.projectRoot);
      const policy = engine.create({
        name,
        description: opts.description as string,
        mode: (opts.mode as PolicyMode) ?? "advisory",
        effect: (opts.effect as PolicyEffect) ?? "notify",
        conditions: opts.field
          ? [{
              field: opts.field as string,
              operator: (opts.operator as ComparisonOperator) ?? "equals",
              value: opts.value,
            }]
          : [],
        categories: opts.category ? (opts.category as string).split(",").map((s) => s.trim()) : undefined,
        tags: opts.tag ? (opts.tag as string).split(",").map((s) => s.trim()) : undefined,
        priority: parseInt(opts.priority as string, 10) || 100,
      });

      if (isJson) {
        outputJson(policy as unknown as Record<string, unknown>);
      } else {
        outputSuccess(`Policy created: ${chalk.bold(policy.id)}`);
        output(`    ${policy.name}`);
      }
    });

  // ── evaluate ────────────────────────────────────────────────────────────
  cmd
    .command("evaluate")
    .description("Evaluate policies against a context")
    .option("--field <field>", "Context field to test")
    .option("--operator <op>", "Operator", "equals")
    .option("--value <value>", "Value to test")
    .option("--mode <mode>", "Filter by policy mode")
    .option("--json", "Output as JSON")
    .action((opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;

      const engine = getEngine(ctx.projectRoot);
      const context: Record<string, unknown> = {};

      if (opts.field && opts.value) {
        // Simple context from CLI args
        const parts = (opts.field as string).split(".");
        let obj: Record<string, unknown> = context;
        for (let i = 0; i < parts.length - 1; i++) {
          const key = parts[i]!;
          obj[key] = {};
          obj = obj[key] as Record<string, unknown>;
        }
        const lastKey = parts[parts.length - 1]!;
        obj[lastKey] = opts.value;
      }

      const evaluation = engine.evaluate(context, {
        mode: opts.mode as PolicyMode,
      });

      if (isJson) {
        outputJson(evaluation as unknown as Record<string, unknown>);
        return;
      }

      outputBlank();
      outputSection("Policy Evaluation");
      output(chalk.dim("  " + "─".repeat(60)));
      output(`  Evaluated: ${evaluation.evaluated}`);
      output(`  Matched:   ${evaluation.matched}`);
      output(`  Violations: ${chalk.red(String(evaluation.violations))}`);
      output(`  Warnings:  ${chalk.yellow(String(evaluation.warnings))}`);
      output(`  Compliant: ${evaluation.compliant ? chalk.green("Yes") : chalk.red("No")}`);
      outputBlank();

      if (evaluation.results.some((r) => r.matched)) {
        outputSection("Matched Policies:");
        for (const r of evaluation.results.filter((r) => r.matched)) {
          const icon = r.violated ? chalk.red("✗") : chalk.yellow("⚠");
          output(`    ${icon} ${r.policyName} (${r.mode}) — ${r.message}`);
        }
      }
      outputBlank();
    });

  // ── enable ──────────────────────────────────────────────────────────────
  cmd
    .command("enable")
    .description("Enable a policy")
    .argument("<id>", "Policy ID")
    .option("--json", "Output as JSON")
    .action((id: string, opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;

      const engine = getEngine(ctx.projectRoot);
      const policy = engine.enable(id);

      if (!policy) {
        if (isJson) {
          outputJson({ error: "Policy not found" });
        } else {
          outputError(`Policy not found: ${id}`);
        }
        return;
      }

      if (isJson) {
        outputJson(policy as unknown as Record<string, unknown>);
      } else {
        outputSuccess(`Policy enabled: ${policy.id}`);
      }
    });

  // ── disable ─────────────────────────────────────────────────────────────
  cmd
    .command("disable")
    .description("Disable a policy")
    .argument("<id>", "Policy ID")
    .option("--json", "Output as JSON")
    .action((id: string, opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;

      const engine = getEngine(ctx.projectRoot);
      const policy = engine.disable(id);

      if (!policy) {
        if (isJson) {
          outputJson({ error: "Policy not found" });
        } else {
          outputError(`Policy not found: ${id}`);
        }
        return;
      }

      if (isJson) {
        outputJson(policy as unknown as Record<string, unknown>);
      } else {
        outputWarning(`Policy disabled: ${policy.id}`);
      }
    });

  // ── delete ──────────────────────────────────────────────────────────────
  cmd
    .command("delete")
    .description("Delete a policy")
    .argument("<id>", "Policy ID")
    .option("--json", "Output as JSON")
    .action((id: string, opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;

      const engine = getEngine(ctx.projectRoot);
      const deleted = engine.delete(id);

      if (!deleted) {
        if (isJson) {
          outputJson({ error: "Policy not found" });
        } else {
          outputError(`Policy not found: ${id}`);
        }
        return;
      }

      if (isJson) {
        outputJson({ deleted: true, id });
      } else {
        outputSuccess(`Policy deleted: ${id}`);
      }
    });

  // ── stats ───────────────────────────────────────────────────────────────
  cmd
    .command("stats")
    .description("Show policy statistics")
    .option("--json", "Output as JSON")
    .action((opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;

      const engine = getEngine(ctx.projectRoot);
      const all = engine.list();
      const enforce = engine.list({ mode: "enforce" });
      const advisory = engine.list({ mode: "advisory" });
      const enabled = all.filter((p) => p.enabled);

      const stats = {
        total: all.length,
        enabled: enabled.length,
        disabled: all.length - enabled.length,
        enforce: enforce.length,
        advisory: advisory.length,
      };

      if (isJson) {
        outputJson(stats as unknown as Record<string, unknown>);
        return;
      }

      outputBlank();
      outputSection("Policy Statistics");
      output(chalk.dim("  " + "─".repeat(40)));
      output(`  Total:     ${stats.total}`);
      output(`  Enabled:   ${chalk.green(String(stats.enabled))}`);
      output(`  Disabled:  ${chalk.gray(String(stats.disabled))}`);
      output(`  Enforce:   ${chalk.red(String(stats.enforce))}`);
      output(`  Advisory:  ${chalk.yellow(String(stats.advisory))}`);
      outputBlank();
    });

  return cmd;
}
