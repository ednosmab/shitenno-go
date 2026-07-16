/**
 * Audit module — Governance detectors
 *
 * All governance-related health issue detectors.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { logger } from "../logger.js";
import { VIOLATION_KEYWORDS, PLACEHOLDER_NAMES } from "./constants.js";
import type { HealthIssue, HistoryEntry } from "./types.js";

/**
 * Detect rules that exist in documentation but have no evidence of enforcement in history.
 * @param rules - List of rule names from governance documents
 * @param history - Historical session entries to check for rule enforcement
 * @returns Array of health issues for rules without enforcement evidence
 */
export function detectDeadRules(rules: string[], history: HistoryEntry[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  if (history.length < 10) return issues;

  for (const rule of rules) {
    const ruleWords = rule.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    let mentionedCount = 0;

    for (const entry of history) {
      const matches = ruleWords.filter((w) => entry.content.includes(w));
      if (matches.length >= Math.min(2, ruleWords.length)) {
        mentionedCount++;
      }
    }

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

/**
 * Detect areas with high concentration of violations in history.
 * @param history - Historical session entries to analyze
 * @returns Array of health issues for violation hotspots
 */
export function detectViolationHotspots(history: HistoryEntry[]): HealthIssue[] {
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

/**
 * Detect missing documentation files in the shiten directory.
 * @param shitenDir - Path to the shiten system directory
 * @returns Array of health issues for missing documentation
 */
export function detectMissingDocs(shitenDir: string): HealthIssue[] {
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
    if (!existsSync(join(shitenDir, doc.path))) {
      issues.push({
        type: "missing_docs",
        severity: doc.critical ? 3 : 1,
        description: `Documento "${doc.path}" não encontrado`,
        location: `shitenno-go/${doc.path}`,
        recommendation: `Criar "${doc.path}" — ${doc.critical ? "crítico" : "recomendado"}`,
      });
    }
  }

  return issues;
}

/**
 * Detect orphan directories that exist but are not referenced anywhere.
 * @param shitenDir - Path to the shiten system directory
 * @returns Array of health issues for orphan directories
 */
export function detectOrphanDirs(shitenDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];

  try {
    const dirs = readdirSync(shitenDir, { withFileTypes: true }).filter((d) => d.isDirectory());
    for (const dir of dirs) {
      const dirPath = join(shitenDir, dir.name);
    let files: string[];
    try {
      files = readdirSync(dirPath);
    } catch (err) {
      logger.debug("governance-detectors", "Cannot read directory:", err);
      continue;
    }
    const hasOnlyReadmes = files.length <= 2 && files.every((f) => f === "README.md" || f === ".gitignore");

      if (hasOnlyReadmes && dir.name !== "scripts" && dir.name !== "reports") {
        issues.push({
          type: "orphan_dir",
          severity: 1,
          description: `Directório "${dir.name}" contém apenas README — possivelmente órfão`,
          location: `shitenno-go/${dir.name}/`,
          recommendation: `Adicionar conteúdo a "${dir.name}" ou removê-lo se desnecessário`,
        });
      }
    }
  } catch (err) {
    logger.debug("governance-detectors", "Error in detectOrphanDirs:", err);
  }

  return issues;
}

/**
 * Detect stale context buffer that hasn't been updated recently.
 * @param shitenDir - Path to the shiten system directory
 * @returns Array of health issues for stale buffers
 */
export function detectStaleBuffer(shitenDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const bufferPath = join(shitenDir, "governance", "context", "context_buffer.yaml");
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
  } catch (err) {
    logger.debug("governance-detectors", "Error reading context buffer:", err);
  }

  return issues;
}

export function detectDatePlaceholders(shitenDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const docsToCheck = [
    "docs/FORBIDDEN_OPERATIONS.md",
    "docs/DESDO.md",
    "cognition/context/CONTEXT_HIERARCHY.md",
    "docs/CONCEPTUAL_MODEL.md",
    "docs/KNOWLEDGE_LIFECYCLE.md",
  ];

  for (const doc of docsToCheck) {
    const path = join(shitenDir, doc);
    if (!existsSync(path)) continue;

    try {
      const content = readFileSync(path, "utf-8");
      if (content.includes("YYYY-MM-DD") || content.includes("[DATE]")) {
        issues.push({
          type: "date_placeholder",
          severity: 2,
          description: `"${doc}" contém datas placeholder (YYYY-MM-DD ou [DATE])`,
          location: `shitenno-go/${doc}`,
          recommendation: `Actualizar datas placeholder em "${doc}" para data real`,
        });
      }
    } catch (err) {
      logger.debug("governance-detectors", `Error reading ${doc}:`, err);
    }
  }

  return issues;
}

function collectEmptyDirsSync(
  dirPath: string,
  relativePath: string,
  skipDirs: Set<string>,
  results: string[],
): void {
  let entries;
  try {
    entries = readdirSync(dirPath, { withFileTypes: true });
  } catch (err) {
    logger.debug("governance-detectors", "Cannot scan directory:", err);
    return;
  }

  const realEntries = entries.filter((e) => !PLACEHOLDER_NAMES.has(e.name));

  if (realEntries.length === 0 && relativePath !== "") {
    results.push(relativePath);
  }

  for (const entry of entries) {
    if (entry.isDirectory() && !skipDirs.has(entry.name)) {
      const childRelative = relativePath ? `${relativePath}/${entry.name}` : entry.name;
      collectEmptyDirsSync(join(dirPath, entry.name), childRelative, skipDirs, results);
    }
  }
}

export function detectEmptyDirs(shitenDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const skipDirs = new Set(["scripts", "reports", "node_modules", ".git"]);
  const emptyDirs: string[] = [];

  try {
    collectEmptyDirsSync(shitenDir, "", skipDirs, emptyDirs);
    for (const relative of emptyDirs) {
      issues.push({
        type: "empty_dir",
        severity: 1,
        description: `Directório "${relative}" existe mas está vazio ou contém apenas templates`,
        location: `shitenno-go/${relative}`,
        recommendation: `Adicionar conteúdo a "${relative}" ou remover se desnecessário`,
      });
    }
  } catch (err) {
    logger.debug("governance-detectors", "Error in detectEmptyDirs:", err);
  }

  return issues;
}

export function detectBrokenRefs(shitenDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const projectRoot = join(shitenDir, "..");
  const docsWithRefs = [
    "governance/WORKFLOW.md",
    "governance/SYSTEM_MAP.md",
    "docs/AGENTS.md",
    "docs/CONCEPTUAL_MODEL.md",
    "docs/capabilities.md",
  ];

  for (const doc of docsWithRefs) {
    const path = join(shitenDir, doc);
    if (!existsSync(path)) continue;

    try {
      const content = readFileSync(path, "utf-8");
      const refRegex = /`([a-zA-Z0-9_/.-]+\.(?:md|ts|js|yaml|json|txt))`/g;
      let match;
      while ((match = refRegex.exec(content)) !== null) {
        const ref = match[1];
        if (
          !ref ||
          ref.includes("*") ||
          ref.includes("[") ||
          ref.includes("<") ||
          ref.includes("YYYY") ||
          ref.includes("MM-DD")
        ) continue;
        const refPathShiten = join(shitenDir, ref);
        const refPathRoot = join(projectRoot, ref);
        if (!existsSync(refPathShiten) && !existsSync(refPathRoot)) {
          issues.push({
            type: "broken_ref",
            severity: 2,
            description: `Referência quebrada em "${doc}": "${ref}" não existe`,
            location: `shitenno-go/${doc}`,
            recommendation: `Corrigir referência "${ref}" em "${doc}" ou criar o ficheiro`,
          });
        }
      }
    } catch (err) {
      logger.debug("governance-detectors", `Error scanning refs in ${doc}:`, err);
    }
  }

  return issues;
}

export function detectBrokenDirRefs(shitenDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const projectRoot = join(shitenDir, "..");
  const docsWithRefs = [
    "governance/WORKFLOW.md",
    "governance/SYSTEM_MAP.md",
    "docs/AGENTS.md",
    "docs/DESDO.md",
    "docs/FORBIDDEN_OPERATIONS.md",
    "docs/capabilities.md",
    "cognition/context/CONTEXT_HIERARCHY.md",
  ];
  const dirRefRegex = /`([a-zA-Z0-9_/.-]+\/)`/g;

  for (const doc of docsWithRefs) {
    const path = join(shitenDir, doc);
    if (!existsSync(path)) continue;

    try {
      const content = readFileSync(path, "utf-8");
      let match;
      while ((match = dirRefRegex.exec(content)) !== null) {
        const ref = match[1];
        if (
          !ref ||
          ref.includes("*") ||
          ref.includes("<") ||
          ref.includes("YYYY")
        ) continue;
        const refPathShiten = join(shitenDir, ref);
        const refPathRoot = join(projectRoot, ref);
        if (!existsSync(refPathShiten) && !existsSync(refPathRoot)) {
          issues.push({
            type: "broken_ref",
            severity: 2,
            description: `Referência quebrada em "${doc}": directório "${ref}" não existe`,
            location: `shitenno-go/${doc}`,
            recommendation: `Criar directório "${ref}" ou corrigir referência em "${doc}"`,
          });
        }
      }
    } catch (err) {
      logger.debug("governance-detectors", `Error scanning dir refs in ${doc}:`, err);
    }
  }

  return issues;
}

export function detectNonBacktickFileRefs(shitenDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const projectRoot = join(shitenDir, "..");
  const docsWithRefs = [
    "docs/AGENTS.md",
    "docs/DESDO.md",
    "docs/capabilities.md",
    "cognition/context/CONTEXT_HIERARCHY.md",
  ];
  const fileRefRegex = /(?:^|[\s,:(])([a-zA-Z0-9_/.-]+\.(?:md|ts|js|yaml|json))(?=[\s,.)]|$)/gm;

  for (const doc of docsWithRefs) {
    const path = join(shitenDir, doc);
    if (!existsSync(path)) continue;

    const docDir = dirname(path);

    try {
      const content = readFileSync(path, "utf-8");
      const backtickRefs = new Set<string>();
      const backtickRegex = /`([a-zA-Z0-9_/.-]+\.(?:md|ts|js|yaml|json))`/g;
      let m;
      while ((m = backtickRegex.exec(content)) !== null) {
        if (m[1]) backtickRefs.add(m[1]);
      }

      let match;
      while ((match = fileRefRegex.exec(content)) !== null) {
        const ref = match[1];
        if (
          !ref ||
          ref.includes("*") ||
          ref.includes("<") ||
          ref.includes("[") ||
          ref.includes("YYYY") ||
          ref.includes("MM-DD") ||
          backtickRefs.has(ref)
        ) continue;
        const refPathRelative = join(docDir, ref);
        const refPathAbsolute = join(shitenDir, ref);
        const refPathRoot = join(projectRoot, ref);
        if (!existsSync(refPathRelative) && !existsSync(refPathAbsolute) && !existsSync(refPathRoot)) {
          issues.push({
            type: "broken_ref",
            severity: 2,
            description: `Referência quebrada em "${doc}": "${ref}" não existe`,
            location: `shitenno-go/${doc}`,
            recommendation: `Corrigir referência "${ref}" em "${doc}" ou criar o ficheiro`,
          });
        }
      }
    } catch (err) {
      logger.debug("governance-detectors", `Error scanning non-backtick refs in ${doc}:`, err);
    }
  }

  return issues;
}

export function detectMissingGitignore(shitenDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const gitignorePath = join(shitenDir, ".gitignore");

  if (!existsSync(gitignorePath)) {
    issues.push({
      type: "missing_gitignore",
      severity: 2,
      description: ".gitignore não existe em shitenno-go/ — arquivos privados podem ser versionados",
      location: "shitenno-go/.gitignore",
      recommendation: "Criar shitenno-go/.gitignore para excluir ficheiros privados (feedback/, session-feedback/)",
    });
  }

  return issues;
}

export function detectMissingPackageJson(shitenDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const packagePath = join(shitenDir, "package.json");

  if (!existsSync(packagePath)) {
    const scriptsDir = join(shitenDir, "scripts");
    if (existsSync(scriptsDir)) {
      try {
        const scripts = readdirSync(scriptsDir).filter(
          (f) => /\.(ts|tsx|js|jsx|vue|svelte)$/.test(f),
        );
        if (scripts.length > 0) {
          issues.push({
            type: "missing_package_json",
            severity: 2,
            description: `package.json não existe em shitenno-go/ — ${scripts.length} scripts não são executáveis via pnpm`,
            location: "shitenno-go/package.json",
            recommendation:
              "Criar shitenno-go/package.json com scripts para executar os TypeScript files",
          });
        }
      } catch (_err) {
        logger.debug("governance-detectors", "Error reading package.json:", _err);
      }
    }
  }

  return issues;
}

export function detectMaturityInconsistency(shitenDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];

  const fingerprintPath = join(shitenDir, "fingerprint.json");
  const maturityPath = join(shitenDir, "maturity-profile.json");
  const briefingPath = join(shitenDir, "BRIEFING.md");

  const scores: { source: string; score: number }[] = [];

  try {
    if (existsSync(fingerprintPath)) {
      const data = JSON.parse(readFileSync(fingerprintPath, "utf-8"));
      if (typeof data.maturityScore === "number") {
        scores.push({ source: "fingerprint.json", score: data.maturityScore });
      }
    }
  } catch (err) { logger.debug("governance-detectors", "Error reading fingerprint.json:", err); }

  try {
    if (existsSync(maturityPath)) {
      const data = JSON.parse(readFileSync(maturityPath, "utf-8"));
      if (typeof data.overallScore === "number") {
        scores.push({ source: "maturity-profile.json", score: data.overallScore });
      }
    }
  } catch (err) { logger.debug("governance-detectors", "Error reading maturity-profile.json:", err); }

  try {
    if (existsSync(briefingPath)) {
      const content = readFileSync(briefingPath, "utf-8");
      const scoreMatch = content.match(/Maturity:\s*(\d+)\/100/i);
      if (scoreMatch?.[1]) {
        scores.push({ source: "BRIEFING.md", score: parseInt(scoreMatch[1], 10) });
      }
    }
  } catch (err) { logger.debug("governance-detectors", "Error reading BRIEFING.md:", err); }

  if (scores.length >= 2) {
    const uniqueScores = new Set(scores.map((s) => s.score));
    if (uniqueScores.size > 1) {
      const scoreList = scores.map((s) => `${s.source}: ${s.score}`).join(", ");
      issues.push({
        type: "maturity_inconsistency",
        severity: 2,
        description: `Scores de maturidade inconsistentes: ${scoreList}`,
        location: "shitenno-go/",
        recommendation: "Reconciliar scores — todos os ficheiros devem reflectir o mesmo valor",
      });
    }
  }

  return issues;
}


