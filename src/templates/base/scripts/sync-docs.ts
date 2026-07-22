#!/usr/bin/env npx tsx
/**
 * sync-docs.ts — Documentation Sync Script (Template)
 *
 * Regenerates SYSTEM_MAP.md from the current directory structure
 * under shitenno/. Called automatically by doc-sync-hook or
 * manually via `shugo sync-docs`.
 *
 * PRINCIPLE: Documentation stays in sync with actual structure.
 *
 * This is the template version installed via `shugo init`.
 * The full-featured version lives in the shitenno-cli repo.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Config ──────────────────────────────────────────────────────────────

const ROOT = join(__dirname, "..", "..");
const SHITENNO_DIR = join(ROOT, "shitenno");
const SYSTEM_MAP_PATH = join(SHITENNO_DIR, "governance", "SYSTEM_MAP.md");
const MANDATORY_CONTEXT_PATH = join(SHITENNO_DIR, "governance", "MANDATORY_CONTEXT.md");

// ── Helpers ─────────────────────────────────────────────────────────────

function walkDir(dir: string, prefix = ""): string[] {
  const entries: string[] = [];

  if (!existsSync(dir)) return entries;

  for (const item of readdirSync(dir, { withFileTypes: true })) {
    if (item.name.startsWith(".") || item.name === "node_modules") continue;

    const relPath = prefix ? `${prefix}/${item.name}` : item.name;

    if (item.isDirectory()) {
      entries.push(`${relPath}/`);
      entries.push(...walkDir(join(dir, item.name), relPath));
    } else {
      entries.push(relPath);
    }
  }

  return entries;
}

// ── SYSTEM_MAP Regeneration ─────────────────────────────────────────────

function regenerateSystemMap(): boolean {
  if (!existsSync(SHITENNO_DIR)) {
    console.log("  ⚠ shitenno/ not found, skipping");
    return false;
  }

  if (!existsSync(SYSTEM_MAP_PATH)) {
    console.log("  ⚠ SYSTEM_MAP.md not found, skipping");
    return false;
  }

  const files = walkDir(SHITENNO_DIR);
  const tree = files
    .map((f) => `│   ${f}`)
    .join("\n");

  let content = readFileSync(SYSTEM_MAP_PATH, "utf-8");

  const startMarker = "<!-- SYNC:START -->";
  const endMarker = "<!-- SYNC:END -->";

  if (content.includes(startMarker) && content.includes(endMarker)) {
    const regex = new RegExp(
      `${startMarker}[\\s\\S]*?${endMarker}`,
      "g"
    );
    content = content.replace(
      regex,
      `${startMarker}\n\`\`\`\n${tree}\n\`\`\`\n${endMarker}`
    );
  }

  writeFileSync(SYSTEM_MAP_PATH, content, "utf-8");
  return true;
}

// ── MANDATORY_CONTEXT.md Regeneration ───────────────────────────────────

/**
 * Parse YAML entries from a manifest file under a given key.
 * Minimal parsing — only extracts id, path, mandatory, when fields.
 */
function readManifestEntries(
  manifestPath: string,
  key: string
): Array<{ id: string; path: string; mandatory?: boolean; when?: Record<string, string> }> {
  if (!existsSync(manifestPath)) return [];
  try {
    const raw = readFileSync(manifestPath, "utf-8");
    // Minimal YAML extraction: find the key block, then parse entries.
    // We use a simple regex approach since this is a template script
    // that should not depend on a YAML library.
    const lines = raw.split("\n");
    let inBlock = false;
    let indent = 0;
    const entries: Array<{ id: string; path: string; mandatory?: boolean; when?: Record<string, string> }> = [];
    let current: Record<string, string> = {};
    let currentWhen: Record<string, string> | undefined;
    let inWhen = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === `${key}:`) {
        inBlock = true;
        continue;
      }
      if (inBlock && trimmed.startsWith("- id:")) {
        // Save previous entry
        if (current.id) {
          entries.push({
            id: current.id,
            path: current.path || "",
            mandatory: current.mandatory === "true" ? true : undefined,
            when: currentWhen,
          });
        }
        current = { id: trimmed.replace("- id:", "").trim() };
        currentWhen = undefined;
        inWhen = false;
        indent = line.search(/\S/);
        continue;
      }
      if (inBlock && line.search(/\S/) <= indent && trimmed && !trimmed.startsWith("-")) {
        // Back to top-level — end of entries block
        if (current.id) {
          entries.push({
            id: current.id,
            path: current.path || "",
            mandatory: current.mandatory === "true" ? true : undefined,
            when: currentWhen,
          });
        }
        break;
      }
      if (inBlock && trimmed === "when:") {
        inWhen = true;
        currentWhen = {};
        continue;
      }
      if (inBlock && inWhen && trimmed.includes(":")) {
        const [k, ...v] = trimmed.split(":");
        if (k && v.length) currentWhen![k.trim()] = v.join(":").trim();
        continue;
      }
      if (inBlock && trimmed.includes(":")) {
        const [k, ...v] = trimmed.split(":");
        if (k && v.length) current[k.trim()] = v.join(":").trim();
        if (trimmed.startsWith("when:")) {
          inWhen = true;
          currentWhen = {};
        }
        continue;
      }
    }
    // Save last entry
    if (current.id) {
      entries.push({
        id: current.id,
        path: current.path || "",
        mandatory: current.mandatory === "true" ? true : undefined,
        when: currentWhen,
      });
    }
    return entries;
  } catch {
    return [];
  }
}

function regenerateMandatoryContext(): boolean {
  if (!existsSync(SHITENNO_DIR)) return false;

  const rules = readManifestEntries(
    join(SHITENNO_DIR, "governance", "rule-manifest.yaml"),
    "rules"
  );
  const skills = readManifestEntries(
    join(SHITENNO_DIR, "governance", "skill-manifest.yaml"),
    "skills"
  );

  // Only unconditional mandatory (mandatory + no `when`)
  const unconditionalRules = rules.filter((r) => r.mandatory && !r.when);
  const unconditionalSkills = skills.filter((s) => s.mandatory && !s.when);

  if (unconditionalRules.length === 0 && unconditionalSkills.length === 0) {
    if (existsSync(MANDATORY_CONTEXT_PATH)) {
      writeFileSync(MANDATORY_CONTEXT_PATH, "<!-- No unconditional mandatory entries found -->\n", "utf-8");
    }
    return false;
  }

  const sections: string[] = [
    "# MANDATORY CONTEXT — Always-Applicable Rules & Skills",
    "",
    "> **Generated file.** Do not edit manually. Re-generated by `shugo sync`.",
    "> This file concatenates every rule and skill that is mandatory with no `when`",
    "> condition — i.e., applies to literally every session.",
    "> Task-scoped mandatory entries are resolved at runtime via MCP `getSkills`.",
    "",
  ];

  if (unconditionalRules.length > 0) {
    sections.push("## Mandatory Rules (always active)", "");
    for (const rule of unconditionalRules) {
      const contentPath = join(SHITENNO_DIR, rule.path);
      if (existsSync(contentPath)) {
        const content = readFileSync(contentPath, "utf-8");
        sections.push(`### ${rule.id}`, "", content.trim(), "");
      } else {
        sections.push(`### ${rule.id}`, "", `> ⚠️ File not found: \`${rule.path}\``, "");
      }
    }
  }

  if (unconditionalSkills.length > 0) {
    sections.push("## Mandatory Skills (always active)", "");
    for (const skill of unconditionalSkills) {
      const contentPath = join(SHITENNO_DIR, skill.path);
      if (existsSync(contentPath)) {
        const content = readFileSync(contentPath, "utf-8");
        sections.push(`### ${skill.id}`, "", content.trim(), "");
      } else {
        sections.push(`### ${skill.id}`, "", `> ⚠️ File not found: \`${skill.path}\``, "");
      }
    }
  }

  writeFileSync(MANDATORY_CONTEXT_PATH, sections.join("\n"), "utf-8");
  return true;
}

// ── Main ────────────────────────────────────────────────────────────────

function main(): void {
  const quiet = process.argv.includes("--quiet");

  if (!quiet) {
    console.log("\n📄 sync-docs — Regenerating documentation...\n");
  }

  const updated = regenerateSystemMap();

  if (updated && !quiet) {
    console.log("  ✔ SYSTEM_MAP.md updated");
  }

  // Phase 4: Generate MANDATORY_CONTEXT.md from manifests
  const mandatoryUpdated = regenerateMandatoryContext();
  if (mandatoryUpdated && !quiet) {
    console.log("  ✔ MANDATORY_CONTEXT.md updated");
  }

  if (!quiet) {
    console.log("\n✅ Documentation sync complete\n");
  }
}

main();
