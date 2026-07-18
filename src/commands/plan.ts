/**
 * plan.ts — Plan Engine CLI Command (thin router)
 *
 * The `shugo plan` command. Manage coordinated action sequences.
 *
 * Sub-commands are extracted to src/commands/plan/*.ts for maintainability.
 */

import { Command } from "commander";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { MarkdownPlanEngine } from "../markdown-plan-engine.js";
import { validatePlanFormat, extractChecklistItems, extractStepHeadings } from "../plan-format-validator.js";
import { getEventBus } from "../event-bus.js";

// ── Sub-command imports ────────────────────────────────────────────────────

import { registerMdList } from "./plan/md-list.js";
import { registerMdShow } from "./plan/md-show.js";
import { registerMdStatus } from "./plan/md-status.js";
import { registerMdDone } from "./plan/md-done.js";
import { registerMdCreate } from "./plan/md-create.js";
import { registerMdPrepare } from "./plan/md-prepare.js";
import { registerMdLifecycle } from "./plan/md-lifecycle.js";

// ── Prepare Logic (reusable — used by CLI + event subscribers) ─────────────

export interface PrepareResult {
  step: string;
  status: string;
  detail: string;
}

/**
 * Run the full prepare sequence on a plan:
 * 1. Format header (Status, Date, Updated_at)
 * 2. Create centralized checklist from phase items
 * 3. Sync to BACKLOG.md
 * 4. Send desktop notification
 */
export async function runPrepare(
  _projectRoot: string,
  shitennoDir: string,
  planId: string
): Promise<PrepareResult[]> {
  const results: PrepareResult[] = [];
  const engine = new MarkdownPlanEngine(shitennoDir);
  const plan = engine.getById(planId);
  if (!plan) return [{ step: "prepare", status: "error", detail: `Plan not found: ${planId}` }];

  // Step 1: Format header
  try {
    let content = readFileSync(plan.filePath, "utf-8");
    let updated = false;

    const hasYamlBlock = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/.test(content);

    if (!hasYamlBlock) {
      // Legacy bold-field format — same logic as before, unchanged
      if (!content.match(/\*\*Status:\*\*/)) {
        const titleLine = content.split("\n").findIndex((l) => l.startsWith("# "));
        if (titleLine !== -1) { const lines = content.split("\n"); lines.splice(titleLine + 2, 0, "", "**Status:** Pending"); content = lines.join("\n"); updated = true; }
      }
      if (!content.match(/\*\*Date:\*\*/)) {
        const statusLine = content.split("\n").findIndex((l) => l.match(/\*\*Status:\*\*/));
        if (statusLine !== -1) { const lines = content.split("\n"); lines.splice(statusLine + 1, 0, `**Date:** ${new Date().toISOString().slice(0, 10)}`); content = lines.join("\n"); updated = true; }
      }
      if (!content.match(/\*\*Updated_at:\*\*/)) {
        const lastField = content.split("\n").findIndex((l) => l.match(/^\*\*[A-Z]/));
        if (lastField !== -1) { const lines = content.split("\n"); lines.splice(lastField + 1, 0, `**Updated_at:** ${new Date().toISOString()}`); content = lines.join("\n"); updated = true; }
      }
    }
    // if hasYamlBlock === true, fields already live in the YAML block — nothing to insert.

    if (updated) { writeFileSync(plan.filePath, content, "utf-8"); results.push({ step: "format_header", status: "done", detail: "Header formatted to shugo standard" }); }
    else { results.push({ step: "format_header", status: "skip", detail: hasYamlBlock ? "YAML frontmatter present" : "Header already conformant" }); }
  } catch (error) { results.push({ step: "format_header", status: "error", detail: String(error) }); }

  // Step 1.5: Validate plan format
  try {
    const content = readFileSync(plan.filePath, "utf-8");
    const validation = validatePlanFormat(plan.filePath, content);
    for (const err of validation.errors) results.push({ step: "format_validation", status: "error", detail: err.message });
    for (const warn of validation.warnings) results.push({ step: "format_validation", status: "warn", detail: warn.message });
    if (validation.errors.length > 0 || validation.warnings.length > 0) {
      const bus = getEventBus();
      bus.publish("plan.format_warning", { planId, path: plan.filePath, errors: validation.errors, warnings: validation.warnings });
      if (validation.errors.length > 0) {
        try { const { execFileSync } = await import("node:child_process"); execFileSync("notify-send", ["Shugo Plan", `Formato inválido: ${validation.errors.map((e) => e.message).join("; ")}`, "--urgency=normal"], { stdio: "pipe", timeout: 2000 }); } catch { /* notify-send not available */ }
      }
    }
  } catch (error) { results.push({ step: "format_validation", status: "error", detail: String(error) }); }

  // Step 2: Create centralized checklist
  try {
    const content = readFileSync(plan.filePath, "utf-8");
    const lines = content.split("\n");
    const stepHeadings = extractStepHeadings(content);
    const stepItems = stepHeadings.filter((s) => s.valid).map((s) => ({ text: `Passo ${s.number} — ${s.title}`, checked: false, phase: "Passos" }));
    const checkboxItems = extractChecklistItems(content);
    const checklistItems = [...stepItems, ...checkboxItems];
    const hasCentralChecklist = content.includes("## Checklist");

    if (!hasCentralChecklist && checklistItems.length > 0) {
      const insertIndex = lines.findIndex((l, i) => i > 0 && l.startsWith("## "));
      const checklistSection = ["", "## Checklist", "", ...checklistItems.map((item) => `${item.checked ? "- [x]" : "- [ ]"} ${item.text}`), ""];
      lines.splice(insertIndex, 0, ...checklistSection);
      writeFileSync(plan.filePath, lines.join("\n"), "utf-8");
      results.push({ step: "checklist", status: "done", detail: `Created centralized checklist with ${checklistItems.length} items` });
    } else if (hasCentralChecklist) {
      results.push({ step: "checklist", status: "skip", detail: "Centralized checklist already exists" });
    } else {
      results.push({ step: "checklist", status: "skip", detail: "No checklist items found in plan" });
    }
  } catch (error) { results.push({ step: "checklist", status: "error", detail: String(error) }); }

  // Step 3: Sync to BACKLOG.md
  try {
    const backlogPath = join(shitennoDir, "docs", "BACKLOG.md");
    if (existsSync(backlogPath)) {
      let backlog = readFileSync(backlogPath, "utf-8");
      const planIdUpper = `BACKLOG-${planId.toUpperCase().replace(/-/g, "_")}`;

      if (backlog.includes(planIdUpper)) {
        const entryStart = backlog.indexOf(`### ${planIdUpper}`);
        if (entryStart !== -1) {
          const nextEntry = backlog.indexOf("\n### BACKLOG-", entryStart + 1);
          const entryBlock = backlog.substring(entryStart, nextEntry !== -1 ? nextEntry : backlog.length);
          if (!entryBlock.includes("#### Passos do Plano")) {
            const planContent = readFileSync(plan.filePath, "utf-8");
            const stepHeadings = extractStepHeadings(planContent);
            const checkboxItems = extractChecklistItems(planContent);
            const seenNumbers = new Set<string>();
            const allItems = [...stepHeadings.map((s) => ({ checked: false, text: `Passo ${s.number} — ${s.title}` })), ...checkboxItems].filter((item) => {
              const numMatch = item.text.match(/^(?:Passo|Step|Phase)\s+(\d+)/i);
              if (numMatch?.[1]) { if (seenNumbers.has(numMatch[1])) return false; seenNumbers.add(numMatch[1]); }
              return true;
            });
            if (allItems.length > 0) {
              const insertPos = entryBlock.lastIndexOf("\n\n");
              const stepsSection = ["", "#### Passos do Plano", ...allItems.map((item) => `- [${item.checked ? "x" : " "}] ${item.text}`)];
              const beforeEntry = backlog.substring(0, entryStart);
              const afterEntry = backlog.substring(nextEntry !== -1 ? nextEntry : backlog.length);
              const updatedEntry = entryBlock.substring(0, insertPos !== -1 ? insertPos : entryBlock.length) + "\n" + stepsSection.join("\n") + "\n";
              backlog = beforeEntry + updatedEntry + afterEntry;
              writeFileSync(backlogPath, backlog, "utf-8");
              results.push({ step: "backlog_sync", status: "done", detail: `Added ${allItems.length} steps to existing ${planIdUpper}` });
            } else { results.push({ step: "backlog_sync", status: "skip", detail: `Item ${planIdUpper} already in BACKLOG.md with no extractable steps` }); }
          } else { results.push({ step: "backlog_sync", status: "skip", detail: `Item ${planIdUpper} already in BACKLOG.md with steps` }); }
        } else { results.push({ step: "backlog_sync", status: "skip", detail: `Item ${planIdUpper} already in BACKLOG.md` }); }
      } else {
        const planContent = readFileSync(plan.filePath, "utf-8");
        const statusMatch = planContent.match(/\*\*Status:\*\*\s*(.+)/);
        const planStatus = statusMatch?.[1]?.trim() ?? "In Progress";
        const statusMap: Record<string, string> = { "In Progress": "em implementação", "Done": "concluído", "Paused": "pausado", "Pending": "planeado" };
        const backlogStatus = statusMap[planStatus] || "planeado";
        const checklistItems = extractChecklistItems(planContent);
        const p2Index = backlog.indexOf("## P2 —");
        const p1Index = backlog.indexOf("## P1 —");
        const insertBefore = p2Index !== -1 ? p2Index : p1Index !== -1 ? p1Index : backlog.length;

        if (insertBefore !== -1) {
          const backlogItem = ["", `### ${planIdUpper} — ${plan.title}`, "", "| Campo | Valor |", "|---|---|", `| **Status** | ${backlogStatus} |`, `| **Severidade** | Medio |`, `| **Prioridade** | P1 |`, `| **Owner** | executor |`, `| **Data** | ${new Date().toISOString().slice(0, 10)} |`, `| **Fonte** | shugo plan md prepare |`, `| **Modulos** | governance/plans/ |`, `| **Descricao** | ${plan.title} |`, `| **Correcao** | Verificar checklist no plano \`governance/plans/${planId}.md\` |`];
          if (checklistItems.length > 0) {
            backlogItem.push("", "#### Passos do Plano");
            const seenNumbers = new Set<string>();
            for (const item of checklistItems) {
              const numMatch = item.text.match(/^(?:Passo|Step|Phase)\s+(\d+)/i);
              if (numMatch?.[1]) { if (seenNumbers.has(numMatch[1])) continue; seenNumbers.add(numMatch[1]); }
              backlogItem.push(`- [${item.checked ? "x" : " "}] ${item.text}`);
            }
          }
          backlogItem.push("");
          const lines = backlog.split("\n");
          lines.splice(insertBefore, 0, ...backlogItem);
          backlog = lines.join("\n").replace(/> \*\*Última actualização:\*\*.*/, `> **Última actualização:** ${new Date().toISOString().slice(0, 10)}`);
          writeFileSync(backlogPath, backlog, "utf-8");
          const stepCount = checklistItems.length;
          results.push({ step: "backlog_sync", status: "done", detail: stepCount > 0 ? `Added ${planIdUpper} to BACKLOG.md with ${stepCount} steps` : `Added ${planIdUpper} to BACKLOG.md (no steps extracted)` });
        } else { results.push({ step: "backlog_sync", status: "error", detail: "Could not find priority section in BACKLOG.md" }); }
      }
    } else { results.push({ step: "backlog_sync", status: "skip", detail: "BACKLOG.md not found" }); }
  } catch (error) { results.push({ step: "backlog_sync", status: "error", detail: String(error) }); }

  // Step 4: Send desktop notification
  try {
    const { execFileSync } = await import("node:child_process");
    execFileSync("notify-send", ["Shugo Plan", `Plan prepared: ${plan.title}`, "--urgency=normal"], { stdio: "pipe", timeout: 2000 });
    results.push({ step: "notify", status: "done", detail: "Desktop notification sent" });
  } catch { results.push({ step: "notify", status: "skip", detail: "notify-send not available or failed" }); }

  return results;
}

// ── Command ────────────────────────────────────────────────────────────────

export function planCommand(): Command {
  const cmd = new Command("plan")
    .description("Manage coordinated action sequences (plans)")
    .option("-d, --dir <path>", "Project directory");

  registerMdList(cmd);
  registerMdShow(cmd);
  registerMdStatus(cmd);
  registerMdDone(cmd);
  registerMdCreate(cmd);
  registerMdPrepare(cmd);
  registerMdLifecycle(cmd);

  return cmd;
}
