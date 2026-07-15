#!/usr/bin/env npx tsx
/**
 * sync-docs.ts — Documentation Sync & Validation
 *
 * Validates documentation structure and optionally auto-fixes discrepancies.
 *
 * Design decision (2026-07-11):
 *   --fix is EXPLICIT, not default. Rationale: auto-fixing documentation
 *   without user consent can mask intentional decisions (e.g., a command
 *   deliberately omitted from README). The --fix flag makes the write
 *   operation intentional and visible. Future improvement: add a
 *   `sync:docs:fix` npm script alias for convenience.
 *
 * Flags:
 *   (none)       Validate only (read-only, exit 1 on errors)
 *   --fix        Validate + apply auto-fixes
 *   --dry-run    Validate + show what --fix would change (no writes)
 *   --quiet / -q Minimal output
 *   --verbose / -v  Detailed output
 */

import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..", "..");
const NEXUS = resolve(ROOT, "nexus-system");
const DOCS = resolve(NEXUS, "docs");
const SRC = resolve(ROOT, "src", "commands");
const SRC_TS = resolve(ROOT, "src");
const README = resolve(ROOT, "README.md");
const CHANGELOG = resolve(ROOT, "CHANGELOG.md");
const PACKAGE_JSON = resolve(ROOT, "package.json");
const SYSTEM_MAP = resolve(NEXUS, "governance", "SYSTEM_MAP.md");

// ── CLI Flags ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const QUIET = args.includes("--quiet") || args.includes("-q");
const AUTO = args.includes("--auto");
const VERBOSE = args.includes("--verbose") || args.includes("-v");
const FIX = args.includes("--fix");
const DRY_RUN = args.includes("--dry-run");

// ── Types ──────────────────────────────────────────────────────────────────

interface Discrepancy {
  type: string;
  severity: "error" | "warning";
  message: string;
  file?: string;
  fixable: boolean;
}

interface FixAction {
  file: string;
  description: string;
  apply: () => void;
}

const discrepancies: Discrepancy[] = [];
const fixActions: FixAction[] = [];

// ── Helpers ────────────────────────────────────────────────────────────────

function error(message: string, file?: string, fixable = false) {
  discrepancies.push({
    type: "validation",
    severity: "error",
    message,
    file,
    fixable,
  });
  if (!QUIET) console.error(`  ❌ ${message}`);
}

function warn(message: string, file?: string, fixable = false) {
  discrepancies.push({
    type: "validation",
    severity: "warning",
    message,
    file,
    fixable,
  });
  if (!QUIET) console.warn(`  ⚠️  ${message}`);
}

function pass(message: string) {
  if (VERBOSE || (!QUIET && !AUTO)) {
    console.log(`  ✅ ${message}`);
  }
}

function log(message: string) {
  if (!QUIET) {
    console.log(message);
  }
}

function dryLog(message: string) {
  if (DRY_RUN) {
    console.log(`  🔸 Would fix: ${message}`);
  }
}

// ── 1. Check documented directories exist ─────────────────────────────────

function checkDocumentedDirectories() {
  log("\n📁 Checking documented directories...\n");

  const documentedDirs = [
    "governance/agents/",
    "governance/context/",
    "governance/contracts/",
    "governance/handoffs/",
    "governance/knowledge-graph/",
    "governance/policies/",
    "governance/premortem/",
    "governance/reviews/",
    "governance/rules/",
    "cognition/context/",
    "cognition/memory/",
    "cognition/prompts/",
    "core/complexity/",
    "docs/adrs/",
    "docs/feedback/",
    "docs/history/",
    "docs/runbooks/",
    "docs/skills/",
    "feedback/records/",
    "reports/",
    "scripts/",
    "telemetry/",
  ];

  for (const dir of documentedDirs) {
    const fullPath = resolve(NEXUS, dir);
    if (existsSync(fullPath)) {
      pass(`Directory exists: ${dir}`);
    } else {
      warn(`Directory documented but missing: ${dir}`);
    }
  }
}

// ── 2. Check undocumented directories exist ───────────────────────────────

function checkUndocumentedDirectories() {
  log("\n🔍 Checking for undocumented directories...\n");

  const nexusDirs = readdirSync(NEXUS).filter((f) => {
    try {
      return statSync(join(NEXUS, f)).isDirectory();
    } catch {
      return false;
    }
  });

  const documentedInGuide = [
    "cognition",
    "core",
    "docs",
    "feedback",
    "governance",
    "reports",
    "scripts",
    "session-feedback",
    "telemetry",
  ];

  for (const dir of nexusDirs) {
    if (!documentedInGuide.includes(dir)) {
      warn(`Directory exists but not documented in GUIDE: ${dir}/`);
    }
  }
}

// ── 3. Check CLI commands documented vs implemented ───────────────────────

function getImplementedCommands(): string[] {
  if (!existsSync(SRC)) return [];
  return readdirSync(SRC)
    .filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"))
    .map((f) => f.replace(/\.(ts|tsx)$/, ""));
}

function checkCLICommands() {
  log("\n🔧 Checking CLI commands...\n");

  const implemented = getImplementedCommands();
  if (implemented.length === 0) {
    warn("src/commands/ directory not found — skipping CLI check");
    return;
  }

  const guide = existsSync(README) ? readFileSync(README, "utf-8") : "";

  const documented = implemented.filter((cmd) =>
    guide.includes(`nexus ${cmd}`)
  );
  const undocumented = implemented.filter(
    (cmd) => !guide.includes(`nexus ${cmd}`)
  );

  pass(`${documented.length}/${implemented.length} commands documented in README`);

  if (undocumented.length > 0) {
    for (const cmd of undocumented) {
      warn(`Command implemented but not documented: nexus ${cmd}`, undefined, false);
    }
  }

  // Check if README command count matches actual count
  if (existsSync(README)) {
    const readmeContent = readFileSync(README, "utf-8");
    const countMatch = readmeContent.match(/## All Commands \((\d+)\)/);
    if (countMatch) {
      const readmeCount = parseInt(countMatch[1], 10);
      const actualCount = implemented.length;
      if (readmeCount !== actualCount) {
        const readmePath = "README.md";
        fixActions.push({
          file: readmePath,
          description: `Update command count in README: ${readmeCount} → ${actualCount}`,
          apply: () => {
            const content = readFileSync(README, "utf-8");
            const updated = content.replace(
              /## All Commands \(\d+\)/,
              `## All Commands (${actualCount})`
            );
            writeFileSync(README, updated, "utf-8");
          },
        });
        if (DRY_RUN) {
          dryLog(`README command count: ${readmeCount} → ${actualCount}`);
        } else if (FIX) {
          fixActions[fixActions.length - 1].apply();
          pass(`Fixed: README command count updated to ${actualCount}`);
        } else {
          error(
            `README command count mismatch: ${readmeCount} stated, ${actualCount} actual`,
            readmePath,
            true
          );
        }
      } else {
        pass(`README command count matches: ${readmeCount}`);
      }
    }
  }
}

// ── 4. Check skills count ─────────────────────────────────────────────────

function checkSkillsCount() {
  log("\n📚 Checking skills...\n");

  const skillsDir = resolve(DOCS, "skills");
  if (!existsSync(skillsDir)) {
    warn("docs/skills/ directory not found");
    return;
  }

  const skills = readdirSync(skillsDir).filter((f) => f.endsWith(".md"));
  const readmeContent = existsSync(README) ? readFileSync(README, "utf-8") : "";

  const countMatch = readmeContent.match(/(\d+)\s*Competências\s*de\s*Engenharia/);
  const documentedCount = countMatch ? parseInt(countMatch[1], 10) : 0;

  if (documentedCount > 0) {
    if (skills.length === documentedCount) {
      pass(`Skills count matches: ${skills.length}`);
    } else {
      warn(`Skills count mismatch: ${skills.length} exist, ${documentedCount} documented`);
    }
  } else {
    pass(`Skills found: ${skills.length} (no count in README to compare)`);
  }
}

// ── 5. Check for broken references ────────────────────────────────────────

function checkBrokenReferences() {
  log("\n🔗 Checking for broken references...\n");

  const filesToCheck = [README, SYSTEM_MAP, resolve(DOCS, "AGENTS.md")].filter(
    (f) => existsSync(f)
  );

  let brokenCount = 0;

  for (const filePath of filesToCheck) {
    const content = readFileSync(filePath, "utf-8");
    const pathRefs = content.match(/`([^`]+\.(?:md|ts|json|yaml))`/g) || [];
    const uniquePaths = [...new Set(pathRefs.map((r) => r.replace(/`/g, "")))];

    for (const ref of uniquePaths) {
      if (ref.includes("*") || ref.includes("<") || ref.includes("[")) continue;

      const fullPath = resolve(NEXUS, ref);
      if (!existsSync(fullPath)) {
        const parentRef = ref.split("/").slice(0, -1).join("/");
        const parentPath = resolve(NEXUS, parentRef);
        if (!existsSync(parentPath)) {
          warn(`Broken reference in ${filePath}: ${ref}`);
          brokenCount++;
        }
      }
    }
  }

  if (brokenCount === 0) {
    pass("No broken references found");
  }
}

// ── 6. Regenerate SYSTEM_MAP directory tree ───────────────────────────────

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

function checkSystemMap() {
  log("\n🗺️  Checking SYSTEM_MAP.md...\n");

  if (!existsSync(SYSTEM_MAP)) {
    warn("SYSTEM_MAP.md not found — skipping");
    return;
  }

  const content = readFileSync(SYSTEM_MAP, "utf-8");
  const startMarker = "<!-- SYNC:START -->";
  const endMarker = "<!-- SYNC:END -->";

  if (!content.includes(startMarker) || !content.includes(endMarker)) {
    warn("SYSTEM_MAP.md missing SYNC markers — cannot auto-regenerate");
    return;
  }

  const files = walkDir(NEXUS);
  const tree = files.map((f) => `│   ${f}`).join("\n");

  const newBlock = `${startMarker}\n\`\`\`\n${tree}\n\`\`\`\n${endMarker}`;

  const regex = new RegExp(
    `${startMarker}[\\s\\S]*?${endMarker}`,
    "g"
  );
  const expected = content.replace(regex, newBlock);

  if (expected === content) {
    pass("SYSTEM_MAP.md tree is up to date");
    return;
  }

  fixActions.push({
    file: "nexus-system/governance/SYSTEM_MAP.md",
    description: "Regenerate directory tree in SYSTEM_MAP.md",
    apply: () => {
      writeFileSync(SYSTEM_MAP, expected, "utf-8");
    },
  });

  if (DRY_RUN) {
    dryLog("SYSTEM_MAP.md directory tree regeneration");
  } else if (FIX) {
    fixActions[fixActions.length - 1].apply();
    pass("Fixed: SYSTEM_MAP.md tree regenerated");
  } else {
    error("SYSTEM_MAP.md directory tree is outdated", "nexus-system/governance/SYSTEM_MAP.md", true);
  }
}

// ── 7. Check README statistics ────────────────────────────────────────────

function checkREADMEStatistics() {
  log("\n📊 Checking README statistics...\n");

  if (!existsSync(README)) {
    warn("README.md not found — skipping statistics check");
    return;
  }

  const readmeContent = readFileSync(README, "utf-8");

  // Count source files
  const srcFiles = readdirSync(SRC_TS, { recursive: true }).filter(
    (f) => typeof f === "string" && (f.endsWith(".ts") || f.endsWith(".tsx"))
  ).length;

  // Count test files
  const testDir = resolve(SRC_TS, "__tests__");
  const testFiles = existsSync(testDir)
    ? readdirSync(testDir, { recursive: true }).filter(
        (f) => typeof f === "string" && f.endsWith(".test.ts")
      ).length
    : 0;

  // Check "Key Statistics" table
  const statsMatch = readmeContent.match(
    /\| CLI Commands \| (\d+) \|[\s\S]*?\| Test Files \| (\d+) \|/
  );
  if (statsMatch) {
    const [, oldCmdCount, oldTestCount] = statsMatch;
    const implemented = getImplementedCommands();
    const actualCmdCount = implemented.length;
    const actualTestCount = testFiles;

    let needsFix = false;
    let newContent = readmeContent;

    if (parseInt(oldCmdCount, 10) !== actualCmdCount) {
      needsFix = true;
      newContent = newContent.replace(
        /\| CLI Commands \| (\d+) \|/,
        `| CLI Commands | ${actualCmdCount} |`
      );
    }

    if (parseInt(oldTestCount, 10) !== actualTestCount) {
      needsFix = true;
      newContent = newContent.replace(
        /\| Test Files \| (\d+) \|/,
        `| Test Files | ${actualTestCount} |`
      );
    }

    if (needsFix) {
      fixActions.push({
        file: "README.md",
        description: `Update Key Statistics: commands ${oldCmdCount}→${actualCmdCount}, tests ${oldTestCount}→${actualTestCount}`,
        apply: () => {
          writeFileSync(README, newContent, "utf-8");
        },
      });

      if (DRY_RUN) {
        dryLog(
          `README Key Statistics: commands ${oldCmdCount}→${actualCmdCount}, tests ${oldTestCount}→${actualTestCount}`
        );
      } else if (FIX) {
        fixActions[fixActions.length - 1].apply();
        pass("Fixed: README statistics updated");
      } else {
        error(
          `README statistics outdated: commands ${oldCmdCount}→${actualCmdCount}, tests ${oldTestCount}→${actualTestCount}`,
          "README.md",
          true
        );
      }
    } else {
      pass("README statistics are up to date");
    }
  }
}

// ── 8. Check version consistency ──────────────────────────────────────────

function checkVersionConsistency() {
  log("\n🏷️  Checking version consistency...\n");

  if (!existsSync(PACKAGE_JSON) || !existsSync(CHANGELOG)) {
    warn("package.json or CHANGELOG.md not found — skipping");
    return;
  }

  const pkg = JSON.parse(readFileSync(PACKAGE_JSON, "utf-8"));
  const pkgVersion = pkg.version;

  const changelogContent = readFileSync(CHANGELOG, "utf-8");
  const changelogMatch = changelogContent.match(/## \[(\d+\.\d+\.\d+)\]/);
  const changelogVersion = changelogMatch ? changelogMatch[1] : null;

  if (changelogVersion && changelogVersion !== pkgVersion) {
    warn(
      `Version mismatch: CHANGELOG says ${changelogVersion}, package.json says ${pkgVersion}`,
      "CHANGELOG.md",
      false
    );
  } else if (changelogVersion) {
    pass(`Version consistent: ${pkgVersion}`);
  } else {
    warn("Could not parse version from CHANGELOG.md");
  }
}

// ── 9. Check script references in WORKFLOW.md ─────────────────────────────

function checkScriptReferences() {
  log("\n📜 Checking script references in WORKFLOW.md...\n");

  const workflowPath = resolve(NEXUS, "governance", "WORKFLOW.md");
  if (!existsSync(workflowPath)) {
    warn("WORKFLOW.md not found — skipping");
    return;
  }

  if (!existsSync(PACKAGE_JSON)) {
    warn("package.json not found — skipping");
    return;
  }

  const workflowContent = readFileSync(workflowPath, "utf-8");
  const pkg = JSON.parse(readFileSync(PACKAGE_JSON, "utf-8"));
  const registeredScripts = Object.keys(pkg.scripts || {});

  // Find all pnpm run <script> references in WORKFLOW.md
  const scriptRefs = workflowContent.match(/pnpm run (\S+)/g) || [];
  const uniqueScripts = [...new Set(scriptRefs)].map((r) =>
    r.replace("pnpm run ", "")
  );

  let brokenCount = 0;

  for (const script of uniqueScripts) {
    // Skip if it's a nexus command (not an npm script)
    if (script.startsWith("nexus ")) continue;
    // Skip scripts with flags (e.g., sync:docs --fix)
    const scriptName = script.split(" ")[0];
    if (!registeredScripts.includes(scriptName)) {
      warn(
        `Script referenced in WORKFLOW.md but not in package.json: ${scriptName}`,
        "governance/WORKFLOW.md",
        false
      );
      brokenCount++;
    }
  }

  if (brokenCount === 0) {
    pass(`All ${uniqueScripts.length} script references in WORKFLOW.md are registered`);
  }
}

// ── 10. Generate report ───────────────────────────────────────────────────

function generateReport() {
  const report = {
    generated_at: new Date().toISOString(),
    mode: DRY_RUN ? "dry-run" : FIX ? "fix" : AUTO ? "auto" : "validate",
    total_discrepancies: discrepancies.length,
    errors: discrepancies.filter((d) => d.severity === "error").length,
    warnings: discrepancies.filter((d) => d.severity === "warning").length,
    fixable: discrepancies.filter((d) => d.fixable).length,
    fix_actions_applied: FIX ? fixActions.length : 0,
    discrepancies,
  };

  const reportsDir = resolve(NEXUS, "reports");
  if (!existsSync(reportsDir)) {
    mkdirSync(reportsDir, { recursive: true });
  }

  const date = new Date().toISOString().split("T")[0];
  const reportPath = resolve(reportsDir, `doc-sync-${date}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  log(`\n📄 Report saved to: ${reportPath}`);
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const modeLabel = DRY_RUN
    ? "DRY RUN"
    : FIX
      ? "VALIDATE + FIX"
      : "VALIDATE ONLY";

  log(`\n🔄 SYNC DOCS — ${modeLabel}\n`);

  checkDocumentedDirectories();
  checkUndocumentedDirectories();
  checkCLICommands();
  checkSkillsCount();
  checkBrokenReferences();
  checkSystemMap();
  checkREADMEStatistics();
  checkVersionConsistency();
  checkScriptReferences();

  const errors = discrepancies.filter((d) => d.severity === "error").length;
  const warnings = discrepancies.filter((d) => d.severity === "warning").length;
  const fixable = discrepancies.filter((d) => d.fixable).length;

  if (DRY_RUN) {
    log(`\n📊 Dry run: ${fixActions.length} fixes would be applied`);
  } else if (FIX) {
    log(`\n📊 Applied ${fixActions.length} fixes`);
  }

  log(`\n📊 Summary: ${errors} errors, ${warnings} warnings (${fixable} fixable)`);

  generateReport();

  // ── Semantic drift check ──────────────────────────────────────────────────
  try {
    const { runSemanticDocSync } = await import("../../src/doc-semantic-sync.js");
    const semanticResult = runSemanticDocSync({
      projectRoot: ROOT,
      nexusDir: NEXUS,
    });

    if (!QUIET && semanticResult.driftFound > 0) {
      log(
        `\n🧠 Drift semântico: ${semanticResult.driftFound} doc(s) desalinhado(s). ` +
        `${semanticResult.remindersWritten} reminder(s) novo(s) escrito(s) em context_buffer.yaml.`
      );
    }
  } catch {
    // Semantic sync is non-critical — don't block on errors
    if (VERBOSE) {
      log("\n⚠️  Semantic drift check skipped (module not available)");
    }
  }

  if (errors > 0 && !FIX) {
    log("\n❌ Documentation sync failed — run with --fix to auto-fix");
    process.exit(1);
  } else if (errors > 0 && FIX) {
    log("\n⚠️  Some issues require manual intervention");
    process.exit(1);
  } else if (warnings > 0) {
    log("\n⚠️  Documentation sync passed with warnings\n");
    process.exit(0);
  } else {
    log("\n✅ Documentation fully synced\n");
    process.exit(0);
  }
}

main();
