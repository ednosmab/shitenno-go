/**
 * health-auditor.ts — Fase 3: Auditoria de Saúde do Próprio Nexus
 *
 * Metacognição: o sistema avaliando a sua própria eficácia.
 *
 * - Regra nunca mencionada em N sessões → candidata a remover ou simplificar
 * - Alta taxa de violações no histórico → candidata a reescrever ou promover a lint
 * - Detecção estrutural: pasta nova sem documentação → sinalizar lacuna
 *
 * PRINCÍPIO: Este módulo SÓ SUGERE, nunca aplica.
 * A decisão de optimizar governança é sempre manual.
 */

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { logger } from "./logger.js";
import { TaintAnalyzer } from "./audit/taint/index.js";
import type { TaintIssue } from "./audit/taint/types.js";

// ── Engineering Audit Constants ───────────────────────────────────────────────

const ORPHAN_SEVERITY_THRESHOLD = 200;
const OVERSIZED_WARNING_THRESHOLD = 1000;
const OVERSIZED_INFO_THRESHOLD = 500;
const MISSING_TEST_WARNING_THRESHOLD = 10;
const ANY_TYPE_SEVERITY_THRESHOLD = 10;

interface SourceFileInfo {
  fullPath: string;
  relPath: string;
  basename: string;
  content: string;
  lineCount: number;
}

const SOURCE_SKIP_PATTERNS = [/\.test\.ts$/, /\.bench\.ts$/, /index\.ts$/];

function collectSourceFiles(projectRoot: string): SourceFileInfo[] {
  const srcDir = join(projectRoot, "src");
  if (!existsSync(srcDir)) return [];

  const result: SourceFileInfo[] = [];
  const walk = (dir: string) => {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== "__tests__") {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".ts") && !SOURCE_SKIP_PATTERNS.some((p) => p.test(entry.name))) {
        try {
          const content = readFileSync(fullPath, "utf-8");
          const lineCount = content.split("\n").length;
          result.push({
            fullPath,
            relPath: fullPath.replace(projectRoot + "/", ""),
            basename: entry.name.replace(/\.ts$/, ""),
            content,
            lineCount,
          });
        } catch { /* skip unreadable files */ }
      }
    }
  };
  walk(srcDir);
  return result;
}

// ── Types ───────────────────────────────────────────────────────────────────

/** Nível de auditoria — controla quais detectors são executados. */
export type AuditLevel = "quick" | "standard" | "full";

/** Problema de saúde detectado no sistema. */
export interface HealthIssue {
  type:
    | "dead_rule"
    | "violation_hotspot"
    | "missing_docs"
    | "orphan_dir"
    | "stale_buffer"
    | "date_placeholder"
    | "empty_dir"
    | "broken_ref"
    | "missing_gitignore"
    | "maturity_inconsistency"
    | "adr_coverage_gap"
    | "missing_package_json"
    | "bare_word_ref"
    | "template_dir_ref"
    | "extension_mismatch"
    | "system_map_mismatch"
    | "broken_command"
    | "p0_inconsistency"
    | "triple_maturity_score"
    | "empty_stack"
    | "script_wiring"
    | "agent_contract_ref"
    | "buffer_schema_mismatch"
    | "rule_typo"
    | "numbering_gap"
    | "doc_count_mismatch"
    | "cross_doc_p0_contradiction"
    | "empty_data_file"
    | "phantom_rule_ref"
    | "test_failure"
    | "orphan_module"
    | "oversized_file"
    | "lint_error"
    | "missing_test"
    | "any_type_usage"
    | "type_error"
    | "console_log_outside_cmd"
    | "empty_catch"
    | "circular_dep"
    | "high_complexity"
    | "unused_export"
    | "dead_code"
    | "unpinned_version"
    | "missing_lock_file"
    | "lock_file_drift"
    | "phantom_dep"
    | "deprecated_package"
    // Taint analysis types
    | "tainted_input"
    | "open_redirect"
    | "ssrf"
    | "log_injection"
    | "code_injection"
    | "command_injection"
    | "path_traversal"
    | "sql_injection"
    | "xss_risk"
    // Security pattern types (SEC-*)
    | "hardcoded_secret"
    | "sql_injection"
    | "unsafe_eval"
    | "console_secret"
    | "weak_crypto"
    | "insecure_http"
    | "proto_pollution"
    | "regex_dos"
    | "unsafe_deserialize"
    | "dep_confusion";
  severity: 1 | 2 | 3;
  description: string;
  location: string;
  recommendation: string;
}

/** Sugestão de optimização de governança. */
export interface GovernanceOptimization {
  id: string;
  title: string;
  description: string;
  action:
    | "remove_rule"
    | "rewrite_rule"
    | "promote_to_lint"
    | "add_docs"
    | "fix_dates"
    | "populate_dir"
    | "fix_refs"
    | "add_gitignore"
    | "reconcile_scores"
    | "create_adr"
    | "create_package_json"
    | "fix_bare_refs"
    | "fix_template_dirs"
    | "fix_extensions"
    | "reconcile_system_map"
    | "fix_commands"
    | "reconcile_p0"
    | "fix_triple_score"
    | "fix_stack"
    | "wire_scripts"
    | "fix_contract_refs"
    | "fix_buffer_schema"
    | "fix_typos"
    | "fix_numbering"
    | "fix_doc_counts"
    | "reconcile_p0_cross_doc"
    | "fix_empty_files"
    | "fix_phantom_rule_refs"
    | "add_test"
    | "split_module"
    | "fix_lint"
    | "add_type"
    | "remove_console_log"
    | "fix_empty_catch"
    | "break_cycle"
    | "reduce_complexity"
    | "remove_unused_export"
    | "remove_dead_code"
    | "pin_version"
    | "add_lock_file"
    | "sync_lock_file"
    | "add_missing_dep"
    | "replace_deprecated"
    // Taint analysis actions
    | "sanitize_input"
    | "fix_taint_flow";
  affectedRule: string;
  evidence: string[];
}

/** Relatório completo de auditoria de saúde. */
export interface HealthAuditReport {
  auditedAt: string;
  totalRules: number;
  historyEntries: number;
  sessionsAnalyzed: number;
  issues: HealthIssue[];
  optimizations: GovernanceOptimization[];
  healthScore: number;
  summary: string;
  level: AuditLevel;
}

/** Detectors activos por nível de auditoria. */
const DETECTORS_BY_LEVEL: Record<AuditLevel, string[]> = {
  quick: [
    "detectMissingDocs",
    "detectDatePlaceholders",
    "detectMissingGitignore",
    "detectMissingPackageJson",
    "detectStaleBuffer",
    "detectMaturityInconsistency",
  ],
  standard: [
    "detectMissingDocs",
    "detectDatePlaceholders",
    "detectMissingGitignore",
    "detectMissingPackageJson",
    "detectStaleBuffer",
    "detectMaturityInconsistency",
    "detectBrokenRefs",
    "detectBrokenDirRefs",
    "detectNonBacktickFileRefs",
    "detectEmptyDirs",
    "detectOrphanDirs",
    "detectBareWordRefs",
    "detectExtensionMismatch",
    "detectReportNaming",
    "detectTemplateDirRefs",
    "detectAdrCoverage",
    "detectUnreferencedDirs",
    "detectP0Inconsistency",
    "detectViolationHotspots",
    "detectOrphanModules",
    "detectComplexityHotspots",
    "detectTestCoverageGaps",
    "detectConsoleUsage",
    "detectEmptyCatchBlocks",
    "detectHighComplexity",
    "detectUnusedExports",
    "detectDeadCodePatterns",
  ],
  full: [
    "detectMissingDocs",
    "detectDatePlaceholders",
    "detectMissingGitignore",
    "detectMissingPackageJson",
    "detectStaleBuffer",
    "detectMaturityInconsistency",
    "detectBrokenRefs",
    "detectBrokenDirRefs",
    "detectNonBacktickFileRefs",
    "detectEmptyDirs",
    "detectOrphanDirs",
    "detectBareWordRefs",
    "detectExtensionMismatch",
    "detectReportNaming",
    "detectTemplateDirRefs",
    "detectAdrCoverage",
    "detectUnreferencedDirs",
    "detectP0Inconsistency",
    "detectDeadRules",
    "detectViolationHotspots",
    "detectSystemMapMismatch",
    "detectBrokenCommands",
    "detectTripleMaturityScore",
    "detectEmptyStack",
    "detectScriptWiring",
    "detectAgentContractRefs",
    "detectBufferSchemaMismatch",
    "detectRuleTypo",
    "detectNumberingGap",
    "detectDocCountMismatch",
    "detectCrossDocP0Contradiction",
    "detectEmptyDataFiles",
    "detectPhantomRuleRefs",
    "detectOrphanModules",
    "detectComplexityHotspots",
    "detectTestCoverageGaps",
    "detectConsoleUsage",
    "detectEmptyCatchBlocks",
    "detectHighComplexity",
    "detectUnusedExports",
    "detectDeadCodePatterns",
    "detectCircularDeps",
    "detectTestHealth",
    "detectLintIssues",
    "detectTypeSafetyIssues",
    // Supply chain detectors
    "detectUnpinnedVersions",
    "detectMissingLockFile",
    "detectLockFileDrift",
    "detectPhantomDependencies",
    "detectDeprecatedPackages",
    // Taint analysis
    "detectTaintFlow",
    // Security patterns (SEC-*)
    "detectHardcodedSecrets",
    "detectSQLInjection",
    "detectXSS",
    "detectUnsafeEval",
    "detectConsoleSecrets",
    "detectWeakCrypto",
    "detectInsecureHTTP",
    "detectPrototypePollution",
    "detectPathTraversal",
    "detectRegexDos",
    "detectUnsafeDeserialization",
    "detectDependencyConfusion",
  ],
};

// ── Data Readers ─────────────────────────────────────────────────────────────

interface HistoryEntry {
  filename: string;
  date: string;
  content: string;
}

function readHistory(nexusDir: string): HistoryEntry[] {
  const historyDir = join(nexusDir, "docs", "history");
  if (!existsSync(historyDir)) return [];

  return readdirSync(historyDir)
    .filter((f) => f.endsWith(".md") && !f.startsWith("README"))
    .map((file) => {
      const content = readFileSync(join(historyDir, file), "utf-8");
      const dateMatch = file.match(/(\d{4}-\d{2}-\d{2})/);
      return { filename: file, date: dateMatch?.[1] ?? "unknown", content: content.toLowerCase() };
    });
}

function readRules(nexusDir: string): string[] {
  const agentsPath = join(nexusDir, "docs", "AGENTS.md");
  if (!existsSync(agentsPath)) return [];

  const content = readFileSync(agentsPath, "utf-8");
  const rules: string[] = [];
  // Match numbered rules: "1. **RULE NAME**: description"
  const numberedRegex = /^\d+\.\s+\*\*([^*]+)\*\*/gm;
  let match;
  while ((match = numberedRegex.exec(content)) !== null) {
    const rule = match[1];
    if (rule) rules.push(rule.trim());
  }
  return [...new Set(rules)];
}

// ── Issue Detectors ──────────────────────────────────────────────────────────

const VIOLATION_KEYWORDS = ["erro", "bug", "corrigi", "falhou", "rollback", "violação", "violated", "revert", "broken", "regression", "incidente", "problema"];

function detectDeadRules(rules: string[], history: HistoryEntry[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  if (history.length < 10) return issues;

  for (const rule of rules) {
    const ruleWords = rule.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    let mentionedCount = 0;

    for (const entry of history) {
      // Check if at least 2 significant words from the rule appear in the entry
      const matches = ruleWords.filter((w) => entry.content.includes(w));
      if (matches.length >= Math.min(2, ruleWords.length)) {
        mentionedCount++;
      }
    }

    // Rule never mentioned in 5+ sessions → candidate for removal
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

function detectViolationHotspots(history: HistoryEntry[]): HealthIssue[] {
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

function detectMissingDocs(nexusDir: string): HealthIssue[] {
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
    if (!existsSync(join(nexusDir, doc.path))) {
      issues.push({
        type: "missing_docs",
        severity: doc.critical ? 3 : 1,
        description: `Documento "${doc.path}" não encontrado`,
        location: `nexus-system/${doc.path}`,
        recommendation: `Criar "${doc.path}" — ${doc.critical ? "crítico" : "recomendado"}`,
      });
    }
  }

  return issues;
}

function detectOrphanDirs(nexusDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];

  try {
    const dirs = readdirSync(nexusDir, { withFileTypes: true }).filter((d) => d.isDirectory());
    for (const dir of dirs) {
      const dirPath = join(nexusDir, dir.name);
    let files: string[];
    try {
      files = readdirSync(dirPath);
    } catch {
      continue;
    }
    const hasOnlyReadmes = files.length <= 2 && files.every((f) => f === "README.md" || f === ".gitignore");

      if (hasOnlyReadmes && dir.name !== "scripts" && dir.name !== "reports") {
        issues.push({
          type: "orphan_dir",
          severity: 1,
          description: `Directório "${dir.name}" contém apenas README — possivelmente órfão`,
          location: `nexus-system/${dir.name}/`,
          recommendation: `Adicionar conteúdo a "${dir.name}" ou removê-lo se desnecessário`,
        });
      }
    }
  } catch {
    logger.debug("health-auditor", "Failed to analyze directories");
  }

  return issues;
}

function detectStaleBuffer(nexusDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const bufferPath = join(nexusDir, "governance", "context", "context_buffer.yaml");
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
  } catch {
    logger.debug("health-auditor", "Failed to read context buffer");
  }

  return issues;
}

// ── New Detectors (Phase 3) ─────────────────────────────────────────────────

/**
 * D1: Detecta datas placeholder (YYYY-MM-DD ou [DATE]) em documentos governance.
 */
function detectDatePlaceholders(nexusDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const docsToCheck = [
    "docs/FORBIDDEN_OPERATIONS.md",
    "docs/DESDO.md",
    "cognition/context/CONTEXT_HIERARCHY.md",
    "docs/CONCEPTUAL_MODEL.md",
    "docs/KNOWLEDGE_LIFECYCLE.md",
  ];

  for (const doc of docsToCheck) {
    const path = join(nexusDir, doc);
    if (!existsSync(path)) continue;

    try {
      const content = readFileSync(path, "utf-8");
      if (content.includes("YYYY-MM-DD") || content.includes("[DATE]")) {
        issues.push({
          type: "date_placeholder",
          severity: 2,
          description: `"${doc}" contém datas placeholder (YYYY-MM-DD ou [DATE])`,
          location: `nexus-system/${doc}`,
          recommendation: `Actualizar datas placeholder em "${doc}" para data real`,
        });
      }
    } catch {
      logger.debug("health-auditor", `Failed to read ${doc}`);
    }
  }

  return issues;
}

/**
 * D2: Detecta directórios existentes mas vazios ou sem conteúdo real (apenas templates).
 */
const PLACEHOLDER_NAMES = new Set(["TEMPLATE.md", "RULE-TEMPLATE.json", ".gitkeep", "README.md"]);

function collectEmptyDirsSync(
  dirPath: string,
  relativePath: string,
  skipDirs: Set<string>,
  results: string[],
): void {
  let entries;
  try {
    entries = readdirSync(dirPath, { withFileTypes: true });
  } catch {
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

function detectEmptyDirs(nexusDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const skipDirs = new Set(["scripts", "reports", "node_modules", ".git"]);
  const emptyDirs: string[] = [];

  try {
    collectEmptyDirsSync(nexusDir, "", skipDirs, emptyDirs);
    for (const relative of emptyDirs) {
      issues.push({
        type: "empty_dir",
        severity: 1,
        description: `Directório "${relative}" existe mas está vazio ou contém apenas templates`,
        location: `nexus-system/${relative}`,
        recommendation: `Adicionar conteúdo a "${relative}" ou remover se desnecessário`,
      });
    }
  } catch {
    logger.debug("health-auditor", "Failed to scan directories for emptiness");
  }

  return issues;
}

/**
 * D3: Detecta referências a ficheiros que não existem.
 */
function detectBrokenRefs(nexusDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const projectRoot = join(nexusDir, "..");
  const docsWithRefs = [
    "governance/WORKFLOW.md",
    "governance/SYSTEM_MAP.md",
    "docs/AGENTS.md",
    "docs/CONCEPTUAL_MODEL.md",
    "docs/capabilities.md",
  ];

  for (const doc of docsWithRefs) {
    const path = join(nexusDir, doc);
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
        const refPathNexus = join(nexusDir, ref);
        const refPathRoot = join(projectRoot, ref);
        if (!existsSync(refPathNexus) && !existsSync(refPathRoot)) {
          issues.push({
            type: "broken_ref",
            severity: 2,
            description: `Referência quebrada em "${doc}": "${ref}" não existe`,
            location: `nexus-system/${doc}`,
            recommendation: `Corrigir referência "${ref}" em "${doc}" ou criar o ficheiro`,
          });
        }
      }
    } catch {
      logger.debug("health-auditor", `Failed to scan refs in ${doc}`);
    }
  }

  return issues;
}

/**
 * D3b: Detecta referências a directórios que não existem.
 */
function detectBrokenDirRefs(nexusDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const projectRoot = join(nexusDir, "..");
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
    const path = join(nexusDir, doc);
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
        const refPathNexus = join(nexusDir, ref);
        const refPathRoot = join(projectRoot, ref);
        if (!existsSync(refPathNexus) && !existsSync(refPathRoot)) {
          issues.push({
            type: "broken_ref",
            severity: 2,
            description: `Referência quebrada em "${doc}": directório "${ref}" não existe`,
            location: `nexus-system/${doc}`,
            recommendation: `Criar directório "${ref}" ou corrigir referência em "${doc}"`,
          });
        }
      }
    } catch {
      logger.debug("health-auditor", `Failed to scan dir refs in ${doc}`);
    }
  }

  return issues;
}

/**
 * D3c: Detecta referências a ficheiros sem backticks (ex: "Leia Requisitos_plataforma.md").
 */
function detectNonBacktickFileRefs(nexusDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const projectRoot = join(nexusDir, "..");
  const docsWithRefs = [
    "docs/AGENTS.md",
    "docs/DESDO.md",
    "docs/capabilities.md",
    "cognition/context/CONTEXT_HIERARCHY.md",
  ];
  const fileRefRegex = /(?:^|[\s,:(])([a-zA-Z0-9_/.-]+\.(?:md|ts|js|yaml|json))(?=[\s,.)]|$)/gm;

  for (const doc of docsWithRefs) {
    const path = join(nexusDir, doc);
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
        const refPathAbsolute = join(nexusDir, ref);
        const refPathRoot = join(projectRoot, ref);
        if (!existsSync(refPathRelative) && !existsSync(refPathAbsolute) && !existsSync(refPathRoot)) {
          issues.push({
            type: "broken_ref",
            severity: 2,
            description: `Referência quebrada em "${doc}": "${ref}" não existe`,
            location: `nexus-system/${doc}`,
            recommendation: `Corrigir referência "${ref}" em "${doc}" ou criar o ficheiro`,
          });
        }
      }
    } catch {
      logger.debug("health-auditor", `Failed to scan non-backtick refs in ${doc}`);
    }
  }

  return issues;
}

/**
 * D4: Detecta .gitignore ausente em nexus-system.
 */
function detectMissingGitignore(nexusDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const gitignorePath = join(nexusDir, ".gitignore");

  if (!existsSync(gitignorePath)) {
    issues.push({
      type: "missing_gitignore",
      severity: 2,
      description: ".gitignore não existe em nexus-system/ — arquivos privados podem ser versionados",
      location: "nexus-system/.gitignore",
      recommendation: "Criar nexus-system/.gitignore para excluir ficheiros privados (feedback/, session-feedback/)",
    });
  }

  return issues;
}

/**
 * D4b: Detecta package.json ausente em nexus-system/.
 */
function detectMissingPackageJson(nexusDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const packagePath = join(nexusDir, "package.json");

  if (!existsSync(packagePath)) {
    const scriptsDir = join(nexusDir, "scripts");
    if (existsSync(scriptsDir)) {
      try {
        const scripts = readdirSync(scriptsDir).filter(
          (f) => f.endsWith(".ts") || f.endsWith(".js"),
        );
        if (scripts.length > 0) {
          issues.push({
            type: "missing_package_json",
            severity: 2,
            description: `package.json não existe em nexus-system/ — ${scripts.length} scripts não são executáveis via pnpm`,
            location: "nexus-system/package.json",
            recommendation:
              "Criar nexus-system/package.json com scripts para executar os TypeScript files",
          });
        }
      } catch {
        // skip
      }
    }
  }

  return issues;
}

/**
 * D5: Detecta inconsistência entre scores de maturidade em diferentes ficheiros.
 */
function detectMaturityInconsistency(nexusDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];

  const fingerprintPath = join(nexusDir, "fingerprint.json");
  const maturityPath = join(nexusDir, "maturity-profile.json");
  const briefingPath = join(nexusDir, "BRIEFING.md");

  const scores: { source: string; score: number }[] = [];

  try {
    if (existsSync(fingerprintPath)) {
      const data = JSON.parse(readFileSync(fingerprintPath, "utf-8"));
      if (typeof data.maturityScore === "number") {
        scores.push({ source: "fingerprint.json", score: data.maturityScore });
      }
    }
  } catch { /* skip */ }

  try {
    if (existsSync(maturityPath)) {
      const data = JSON.parse(readFileSync(maturityPath, "utf-8"));
      if (typeof data.overallScore === "number") {
        scores.push({ source: "maturity-profile.json", score: data.overallScore });
      }
    }
  } catch { /* skip */ }

  try {
    if (existsSync(briefingPath)) {
      const content = readFileSync(briefingPath, "utf-8");
      const scoreMatch = content.match(/Maturity:\s*(\d+)\/100/i);
      if (scoreMatch?.[1]) {
        scores.push({ source: "BRIEFING.md", score: parseInt(scoreMatch[1], 10) });
      }
    }
  } catch { /* skip */ }

  if (scores.length >= 2) {
    const uniqueScores = new Set(scores.map((s) => s.score));
    if (uniqueScores.size > 1) {
      const scoreList = scores.map((s) => `${s.source}: ${s.score}`).join(", ");
      issues.push({
        type: "maturity_inconsistency",
        severity: 2,
        description: `Scores de maturidade inconsistentes: ${scoreList}`,
        location: "nexus-system/",
        recommendation: "Reconciliar scores — todos os ficheiros devem reflectir o mesmo valor",
      });
    }
  }

  return issues;
}

/**
 * D6: Detecta decisões documentadas sem ADR associado.
 */
function detectAdrCoverage(nexusDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const adrDir = join(nexusDir, "docs", "adrs");

  if (!existsSync(adrDir)) {
    issues.push({
      type: "adr_coverage_gap",
      severity: 1,
      description: "Directório docs/adrs/ não existe — decisões arquiteturais não rastreadas",
      location: "nexus-system/docs/adrs/",
      recommendation: "Criar directório docs/adrs/ e adicionar ADRs para decisões existentes",
    });
    return issues;
  }

  try {
    const adrFiles = readdirSync(adrDir).filter(
      (f) => f.endsWith(".md") && !f.startsWith("ADR-TEMPLATE")
    );
    if (adrFiles.length === 0) {
      issues.push({
        type: "adr_coverage_gap",
        severity: 1,
        description: "Nenhum ADR encontrado em docs/adrs/ — decisões não documentadas",
        location: "nexus-system/docs/adrs/",
        recommendation: "Criar ADRs para decisões arquiteturais significativas",
      });
    }
  } catch {
    logger.debug("health-auditor", "Failed to scan ADR directory");
  }

  return issues;
}

// ── Health Score ─────────────────────────────────────────────────────────────

function calculateHealthScore(issues: HealthIssue[], totalFiles: number): number {
  const weights: Record<number, number> = { 3: 5, 2: 2, 1: 0.5 };
  const rawPenalty = issues.reduce((sum, issue) => sum + (weights[issue.severity] ?? 0), 0);
  const normalizer = Math.max(totalFiles, 10);
  const density = rawPenalty / normalizer;
  const score = 100 * Math.exp(-density * 2);
  return Math.max(0, Math.min(100, Math.round(score)));
}

// ── Optimization Proposer ────────────────────────────────────────────────────

function proposeOptimizations(issues: HealthIssue[]): GovernanceOptimization[] {
  const optimizations: GovernanceOptimization[] = [];
  let optId = 1;

  for (const issue of issues) {
    if (issue.type === "dead_rule") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Remover regra morta",
        description: issue.description,
        action: "remove_rule",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "violation_hotspot") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Reescrever ou automatizar regra",
        description: issue.description,
        action: issue.severity === 3 ? "promote_to_lint" : "rewrite_rule",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "orphan_dir") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Popular directório órfão",
        description: issue.description,
        action: "add_docs",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "date_placeholder") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Actualizar datas placeholder",
        description: issue.description,
        action: "fix_dates",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "empty_dir") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Popular directório vazio",
        description: issue.description,
        action: "populate_dir",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "broken_ref") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Corrigir referência quebrada",
        description: issue.description,
        action: "fix_refs",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "missing_gitignore") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Criar .gitignore",
        description: issue.description,
        action: "add_gitignore",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "maturity_inconsistency") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Reconciliar scores de maturidade",
        description: issue.description,
        action: "reconcile_scores",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "adr_coverage_gap") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Criar ADRs em falta",
        description: issue.description,
        action: "create_adr",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "missing_package_json") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Criar package.json",
        description: issue.description,
        action: "create_package_json",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "bare_word_ref") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Corrigir referência bare-word",
        description: issue.description,
        action: "fix_bare_refs",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "template_dir_ref") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Criar directório de template",
        description: issue.description,
        action: "fix_template_dirs",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "extension_mismatch") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Corrigir extensão de referência",
        description: issue.description,
        action: "fix_extensions",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "system_map_mismatch") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Actualizar SYSTEM_MAP.md",
        description: issue.description,
        action: "reconcile_system_map",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "broken_command") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Tornar comandos executáveis",
        description: issue.description,
        action: "fix_commands",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "p0_inconsistency") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Reconciliar listas P0",
        description: issue.description,
        action: "reconcile_p0",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "triple_maturity_score") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Reconciliar scores de maturidade (3 fontes)",
        description: issue.description,
        action: "fix_triple_score",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "empty_stack") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Preencher stack em fingerprint.json",
        description: issue.description,
        action: "fix_stack",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "script_wiring") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Adicionar script em falta ao package.json",
        description: issue.description,
        action: "wire_scripts",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "agent_contract_ref") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Corrigir referência em contrato de agente",
        description: issue.description,
        action: "fix_contract_refs",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "buffer_schema_mismatch") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Adicionar secções em falta ao buffer",
        description: issue.description,
        action: "fix_buffer_schema",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "rule_typo") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Corrigir typo em regra",
        description: issue.description,
        action: "fix_typos",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "numbering_gap") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Corrigir gap de numeração",
        description: issue.description,
        action: "fix_numbering",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "doc_count_mismatch") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Actualizar contagens na documentação",
        description: issue.description,
        action: "fix_doc_counts",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "cross_doc_p0_contradiction") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Reconciliar listas P0 entre documentos",
        description: issue.description,
        action: "reconcile_p0_cross_doc",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "empty_data_file") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Popular ficheiro de dados vazio",
        description: issue.description,
        action: "fix_empty_files",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "phantom_rule_ref") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Corrigir referência a regra inexistente",
        description: issue.description,
        action: "fix_phantom_rule_refs",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "test_failure") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Corrigir testes falhados",
        description: issue.description,
        action: "add_test",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "orphan_module") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Remover ou conectar módulo órfão",
        description: issue.description,
        action: "remove_rule",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "oversized_file") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Dividir arquivo oversized",
        description: issue.description,
        action: "split_module",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "missing_test") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Adicionar teste em falta",
        description: issue.description,
        action: "add_test",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "lint_error") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Corrigir erros ESLint",
        description: issue.description,
        action: "fix_lint",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "any_type_usage") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Substituir tipos any",
        description: issue.description,
        action: "add_type",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "type_error") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Corrigir erros de tipo TypeScript",
        description: issue.description,
        action: "add_type",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "console_log_outside_cmd") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Substituir console.log por logger",
        description: issue.description,
        action: "remove_console_log",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "empty_catch") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Adicionar tratamento de erro",
        description: issue.description,
        action: "fix_empty_catch",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "circular_dep") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Quebrar dependência circular",
        description: issue.description,
        action: "break_cycle",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "high_complexity") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Reduzir complexidade",
        description: issue.description,
        action: "reduce_complexity",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "unused_export") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Remover export não usado",
        description: issue.description,
        action: "remove_unused_export",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "dead_code") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Remover código morto",
        description: issue.description,
        action: "remove_dead_code",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "unpinned_version") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Fixar versões de dependências",
        description: issue.description,
        action: "pin_version",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "missing_lock_file") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Gerar lock file",
        description: issue.description,
        action: "add_lock_file",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "lock_file_drift") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Actualizar lock file",
        description: issue.description,
        action: "sync_lock_file",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "phantom_dep") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Adicionar dependência em falta",
        description: issue.description,
        action: "add_missing_dep",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "deprecated_package") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Substituir dependência deprecated",
        description: issue.description,
        action: "replace_deprecated",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "hardcoded_secret") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Mover secrets para variaveis de ambiente",
        description: issue.description,
        action: "fix_taint_flow",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "sql_injection") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Usar prepared statements",
        description: issue.description,
        action: "fix_taint_flow",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "xss_risk") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Sanitizar input HTML",
        description: issue.description,
        action: "sanitize_input",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "unsafe_eval") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Remover eval/Function dinamicos",
        description: issue.description,
        action: "fix_taint_flow",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "console_secret") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Remover dados sensiveis dos logs",
        description: issue.description,
        action: "remove_console_log",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "weak_crypto") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Actualizar criptografia",
        description: issue.description,
        action: "fix_taint_flow",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "insecure_http") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Migrar para HTTPS",
        description: issue.description,
        action: "fix_taint_flow",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "proto_pollution") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Validar input em merges",
        description: issue.description,
        action: "fix_taint_flow",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "regex_dos") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Simplificar regex complexos",
        description: issue.description,
        action: "fix_taint_flow",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "unsafe_deserialize") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Validar JSON com schema",
        description: issue.description,
        action: "fix_taint_flow",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "dep_confusion") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Corrigir dependencia em falta",
        description: issue.description,
        action: "add_missing_dep",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "path_traversal") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Sanitizar caminhos de ficheiro",
        description: issue.description,
        action: "fix_taint_flow",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "tainted_input") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Sanitizar input",
        description: issue.description,
        action: "sanitize_input",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "code_injection" || issue.type === "command_injection") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Corrigir fluxo de taint",
        description: issue.description,
        action: "fix_taint_flow",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "sql_injection") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Usar prepared statements",
        description: issue.description,
        action: "fix_taint_flow",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "xss_risk") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Sanitizar HTML output",
        description: issue.description,
        action: "sanitize_input",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "open_redirect") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Validar URL de redirect",
        description: issue.description,
        action: "fix_taint_flow",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "log_injection") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Sanitizar log input",
        description: issue.description,
        action: "sanitize_input",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "path_traversal") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Validar caminho",
        description: issue.description,
        action: "fix_taint_flow",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
  }

  return optimizations;
}

/**
 * D8: Detecta directórios docs/ que existem mas não são referenciados em nenhum documento governance.
 */
function detectUnreferencedDirs(nexusDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const docsDir = join(nexusDir, "docs");
  if (!existsSync(docsDir)) return issues;

  const governanceFiles = [
    "governance/WORKFLOW.md",
    "governance/SYSTEM_MAP.md",
    "docs/AGENTS.md",
    "docs/DESDO.md",
    "docs/capabilities.md",
  ];

  let governanceContent = "";
  for (const doc of governanceFiles) {
    const path = join(nexusDir, doc);
    if (existsSync(path)) {
      try { governanceContent += readFileSync(path, "utf-8") + "\n"; } catch { /* skip */ }
    }
  }

  try {
    const entries = readdirSync(docsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (["skills", "adrs", "history", "runbooks", "plans"].includes(entry.name)) continue;
      const dirPattern = new RegExp(`docs/${entry.name}/|docs/${entry.name}\\b`);
      if (!dirPattern.test(governanceContent)) {
        issues.push({
          type: "orphan_dir",
          severity: 1,
          description: `Directório "docs/${entry.name}" existe mas não é referenciado em nenhum documento governance`,
          location: `nexus-system/docs/${entry.name}/`,
          recommendation: `Adicionar referência a "docs/${entry.name}" em SYSTEM_MAP.md ou remover o directório`,
        });
      }
    }
  } catch { /* skip */ }

  return issues;
}

/**
 * D9: Detecta nomes de report que violam convenções (devem seguir padrão <tipo>-<date>.json).
 */
function detectReportNaming(nexusDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const reportsDir = join(nexusDir, "reports");
  if (!existsSync(reportsDir)) return issues;

  // Accept: <tipo>-YYYY-MM-DD.json, <tipo>-<projecto>-YYYY-MM-DD.json, <tipo>-<projecto>-YYYY-MM-DD-sessionN.json
  const validPattern = /^(health|complexity|doc-lifecycle|pattern)(-[a-z0-9]+(-[a-z0-9]+)*)?-\d{4}-\d{2}-\d{2}.*\.json$/;

  try {
    const files = readdirSync(reportsDir);
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      if (file === "README.md") continue;
      if (!validPattern.test(file)) {
        issues.push({
          type: "broken_ref",
          severity: 1,
          description: `Report "${file}" não segue a convenção de nomenclatura (<tipo>-YYYY-MM-DD.json)`,
          location: `nexus-system/reports/${file}`,
          recommendation: `Renomear "${file}" para seguir o padrão <tipo>-YYYY-MM-DD.json`,
        });
      }
    }
  } catch { /* skip */ }

  return issues;
}

/**
 * D10: Detecta referências P0 obrigatórias sem backticks (bare words).
 */
function detectBareWordRefs(nexusDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const p0Files = [
    "AGENTS.md",
    "FORBIDDEN_OPERATIONS.md",
    "DESDO.md",
    "Requisitos_plataforma.md",
    "CONTEXT_HIERARCHY.md",
  ];
  const docPath = join(nexusDir, "docs/AGENTS.md");
  if (!existsSync(docPath)) return issues;

  try {
    const content = readFileSync(docPath, "utf-8");
    const p0Line = content.split("\n").find((l) => l.includes("Requisitos_plataforma"));
    if (p0Line) {
      const locations = ["docs/", "cognition/context/", "governance/", ""];
      for (const file of p0Files) {
        if (p0Line.includes(file)) {
          const found = locations.some((loc) => existsSync(join(nexusDir, loc, file)));
          if (!found) {
            issues.push({
              type: "bare_word_ref",
              severity: 3,
              description: `Referência P0 obrigatória "${file}" não existe em nenhuma localização`,
              location: "nexus-system/docs/AGENTS.md",
              recommendation: `Criar "${file}" ou remover da lista P0 em AGENTS.md`,
            });
          }
        }
      }
    }
  } catch { /* skip */ }
  return issues;
}

/**
 * D11: Detecta directórios pai de referências template que não existem.
 */
function detectTemplateDirRefs(nexusDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const docsToScan = [
    "docs/AGENTS.md",
    "docs/capabilities.md",
    "cognition/context/CONTEXT_HIERARCHY.md",
  ];
  const templateRefRegex = /`([^`\n]*<[^`\n>]+>[^`\n]*)`/g;
  // Convention directories that are branch naming patterns, not physical dirs
  const branchConventions = new Set(["feat/", "fix/", "hotfix/", "chore/", "docs/", "refactor/"]);

  for (const doc of docsToScan) {
    const path = join(nexusDir, doc);
    if (!existsSync(path)) continue;
    try {
      const content = readFileSync(path, "utf-8");
      let match;
      while ((match = templateRefRegex.exec(content)) !== null) {
        const ref = match[1];
        if (!ref) continue;
        const dirPart = ref.split(/[<]/)[0];
        if (dirPart && dirPart.includes("/") && !dirPart.startsWith("nexus-system/")) {
          // Skip branch convention directories
          if (branchConventions.has(dirPart)) continue;
          // Skip git commands and shell scripts
          if (dirPart.includes("git ") || dirPart.includes("&&")) continue;
          const dirPath = join(nexusDir, dirPart);
          if (!existsSync(dirPath)) {
            issues.push({
              type: "template_dir_ref",
              severity: 2,
              description: `Directório "${dirPart}" referenciado por template "${ref}" não existe`,
              location: `nexus-system/${doc}`,
              recommendation: `Criar directório "${dirPart}" ou corrigir referência em "${doc}"`,
            });
          }
        }
      }
    } catch { /* skip */ }
  }
  return issues;
}

/**
 * D12: Detecta referências com extensão errada (ex: .md quando é .yaml).
 */
function detectExtensionMismatch(nexusDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const projectRoot = join(nexusDir, "..");
  const KNOWN_CORRECTIONS: Record<string, string> = {
    "context_buffer.md": "context_buffer.yaml",
    "context_buffer.json": "context_buffer.yaml",
  };

  const docsToScan = [
    "docs/AGENTS.md",
    "governance/WORKFLOW.md",
    "docs/CONCEPTUAL_MODEL.md",
    "docs/capabilities.md",
    "cognition/context/CONTEXT_HIERARCHY.md",
    "governance/agents/AI-CONTRACT-reviewer-v1.yaml",
    "governance/agents/AI-CONTRACT-planner-v1.yaml",
    "governance/agents/AI-CONTRACT-orchestrator-v1.yaml",
    "governance/agents/AI-CONTRACT-executor-v1.yaml",
  ];

  const SUPPORTED_EXTENSIONS = [".md", ".ts", ".js", ".yaml", ".json", ".txt"];
  const EXTENSION_SWAP: Record<string, string> = {
    ".ts": ".json",
    ".json": ".ts",
    ".md": ".yaml",
    ".yaml": ".md",
    ".js": ".ts",
    ".txt": ".md",
  };

  for (const doc of docsToScan) {
    const path = join(nexusDir, doc);
    if (!existsSync(path)) continue;
    const docDir = dirname(path);
    try {
      const content = readFileSync(path, "utf-8");

      for (const [wrongName, correctName] of Object.entries(KNOWN_CORRECTIONS)) {
        if (content.includes(wrongName)) {
          const found =
            existsSync(join(docDir, correctName)) ||
            existsSync(join(nexusDir, "governance/context", correctName)) ||
            existsSync(join(nexusDir, correctName)) ||
            existsSync(join(projectRoot, correctName));
          if (found) {
            issues.push({
              type: "extension_mismatch",
              severity: 2,
              description: `Referência "${wrongName}" usa extensão errada — ficheiro real é "${correctName}"`,
              location: `nexus-system/${doc}`,
              recommendation: `Corrigir "${wrongName}" para "${correctName}" em "${doc}"`,
            });
          }
        }
      }

      const refRegex = /`([a-zA-Z0-9_/.-]+)(\.(?:md|ts|js|yaml|json|txt))`/g;
      let match;
      while ((match = refRegex.exec(content)) !== null) {
        const baseName = match[1] as string;
        const ext = match[2] as string;
        if (!baseName || baseName.includes("*") || baseName.includes("[") || baseName.includes("<") || baseName.includes("YYYY") || baseName.includes("MM-DD")) continue;

        const fullName = `${baseName}${ext}`;
        if (KNOWN_CORRECTIONS[fullName]) continue;

        const exactPath = join(nexusDir, fullName);
        const exactPathRoot = join(projectRoot, fullName);
        const exactPathDocDir = join(docDir, fullName);
        if (existsSync(exactPath) || existsSync(exactPathRoot) || existsSync(exactPathDocDir)) continue;

        const swappedExt = EXTENSION_SWAP[ext];
        if (!swappedExt) continue;

        const swappedName = `${baseName}${swappedExt}`;
        const swappedPathNexus = join(nexusDir, swappedName);
        const swappedPathRoot = join(projectRoot, swappedName);
        const swappedPathDocDir = join(docDir, swappedName);
        if (existsSync(swappedPathNexus) || existsSync(swappedPathRoot) || existsSync(swappedPathDocDir)) {
          issues.push({
            type: "extension_mismatch",
            severity: 2,
            description: `Referência "${fullName}" usa extensão errada — ficheiro real é "${swappedName}"`,
            location: `nexus-system/${doc}`,
            recommendation: `Corrigir "${fullName}" para "${swappedName}" em "${doc}"`,
          });
        }
      }
    } catch { /* skip */ }
  }
  return issues;
}

/**
 * D13: Detecta directórios que existem em disco mas não estão no SYSTEM_MAP.md.
 */
function detectSystemMapMismatch(nexusDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const systemMapPath = join(nexusDir, "governance/SYSTEM_MAP.md");
  if (!existsSync(systemMapPath)) return issues;

  try {
    const content = readFileSync(systemMapPath, "utf-8");
    const treeEntryRegex = /[├└]──\s+`?([^\s`]+)`?/g;
    const mapEntries = new Set<string>();
    let match;
    while ((match = treeEntryRegex.exec(content)) !== null) {
      if (match[1]) mapEntries.add(match[1].replace(/\/$/, ""));
    }

    const docsDir = join(nexusDir, "docs");
    if (existsSync(docsDir)) {
      const entries = readdirSync(docsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !mapEntries.has(entry.name)) {
          issues.push({
            type: "system_map_mismatch",
            severity: 1,
            description: `Directório "docs/${entry.name}" existe mas não está listado no SYSTEM_MAP.md`,
            location: "nexus-system/governance/SYSTEM_MAP.md",
            recommendation: `Adicionar "docs/${entry.name}" à árvore em SYSTEM_MAP.md`,
          });
        }
      }
    }
  } catch { /* skip */ }
  return issues;
}

/**
 * D14: Detecta comandos pnpm run que não podem executar sem package.json.
 */
function detectBrokenCommands(nexusDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const pkgPath = join(nexusDir, "package.json");
  if (existsSync(pkgPath)) return issues;

  const docsToScan = ["governance/WORKFLOW.md", "docs/AGENTS.md"];
  const commandRegex = /pnpm run ([a-zA-Z0-9:-]+)/g;
  const brokenCommands = new Set<string>();

  for (const doc of docsToScan) {
    const path = join(nexusDir, doc);
    if (!existsSync(path)) continue;
    try {
      const content = readFileSync(path, "utf-8");
      let match;
      while ((match = commandRegex.exec(content)) !== null) {
        if (match[1]) brokenCommands.add(match[1]);
      }
    } catch { /* skip */ }
  }

  if (brokenCommands.size > 0) {
    issues.push({
      type: "broken_command",
      severity: 2,
      description: `${brokenCommands.size} comando(s) pnpm run não executável(s) sem package.json: ${Array.from(brokenCommands).join(", ")}`,
      location: "nexus-system/",
      recommendation: "Criar nexus-system/package.json com os scripts definidos",
    });
  }
  return issues;
}

/**
 * D15: Detecta inconsistências entre listas P0 de AGENTS.md e CONTEXT_HIERARCHY.md.
 */
function detectP0Inconsistency(nexusDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const agentsPath = join(nexusDir, "docs/AGENTS.md");
  const contextPath = join(nexusDir, "cognition/context/CONTEXT_HIERARCHY.md");
  if (!existsSync(agentsPath) || !existsSync(contextPath)) return issues;

  try {
    const agentsContent = readFileSync(agentsPath, "utf-8");
    const contextContent = readFileSync(contextPath, "utf-8");
    const p0Files = [
      "AGENTS.md",
      "FORBIDDEN_OPERATIONS.md",
      "DESDO.md",
      "Requisitos_plataforma.md",
      "CONTEXT_HIERARCHY.md",
    ];

    const agentsP0 = new Set<string>();
    const contextP0 = new Set<string>();

    for (const file of p0Files) {
      if (agentsContent.includes(file)) agentsP0.add(file);
      if (contextContent.includes(file)) contextP0.add(file);
    }

    for (const file of agentsP0) {
      if (!contextP0.has(file)) {
        issues.push({
          type: "p0_inconsistency",
          severity: 1,
          description: `"${file}" está na lista P0 de AGENTS.md mas não na de CONTEXT_HIERARCHY.md`,
          location: "nexus-system/docs/AGENTS.md",
          recommendation: `Verificar se "${file}" deve ser P0 em ambos os documentos`,
        });
      }
    }
    for (const file of contextP0) {
      if (!agentsP0.has(file)) {
        issues.push({
          type: "p0_inconsistency",
          severity: 1,
          description: `"${file}" está na lista P0 de CONTEXT_HIERARCHY.md mas não na de AGENTS.md`,
          location: "nexus-system/cognition/context/CONTEXT_HIERARCHY.md",
          recommendation: `Verificar se "${file}" deve ser P0 em ambos os documentos`,
        });
      }
    }
  } catch { /* skip */ }
  return issues;
}

// ── Full-Level Detectors (D1-D10) ────────────────────────────────────────────

/**
 * D1: Detecta 3 scores de maturidade inconsistentes (fingerprint, profile, BRIEFING).
 */
function detectTripleMaturityScore(nexusDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const fpPath = join(nexusDir, "fingerprint.json");
  const mpPath = join(nexusDir, "maturity-profile.json");
  const briefingPath = join(nexusDir, "BRIEFING.md");

  const scores: { source: string; value: number | null }[] = [];

  if (existsSync(fpPath)) {
    try {
      const data = JSON.parse(readFileSync(fpPath, "utf-8"));
      scores.push({ source: "fingerprint.json", value: data.maturityScore ?? null });
    } catch { /* skip */ }
  }
  if (existsSync(mpPath)) {
    try {
      const data = JSON.parse(readFileSync(mpPath, "utf-8"));
      scores.push({ source: "maturity-profile.json", value: data.overallScore ?? null });
    } catch { /* skip */ }
  }
  if (existsSync(briefingPath)) {
    try {
      const content = readFileSync(briefingPath, "utf-8");
      const match = content.match(/Maturity:\s*(\d+)/);
      scores.push({ source: "BRIEFING.md", value: match ? Number(match[1]) : null });
    } catch { /* skip */ }
  }

  const valid = scores.filter((s) => s.value !== null);
  if (valid.length >= 2) {
    const values = valid.map((s) => s.value!);
    const unique = new Set(values);
    if (unique.size > 1) {
      const details = valid.map((s) => `${s.source}: ${s.value}`).join(", ");
      issues.push({
        type: "triple_maturity_score",
        severity: 3,
        description: `Scores de maturidade inconsistentes: ${details}`,
        location: "nexus-system/",
        recommendation: "Reconciliar — todos os ficheiros devem reflectir o mesmo valor",
      });
    }
  }
  return issues;
}

/**
 * D2: Detecta stack vazia no fingerprint.json.
 */
function detectEmptyStack(nexusDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const fpPath = join(nexusDir, "fingerprint.json");
  if (!existsSync(fpPath)) return issues;

  try {
    const data = JSON.parse(readFileSync(fpPath, "utf-8"));
    if (Array.isArray(data.stack) && data.stack.length === 0) {
      issues.push({
        type: "empty_stack",
        severity: 3,
        description: "fingerprint.json tem stack: [] vazio — projecto TypeScript não detectado",
        location: "nexus-system/fingerprint.json",
        recommendation: "Actualizar stack para [\"typescript\"] ou re-executar fingerprint",
      });
    }
  } catch { /* skip */ }
  return issues;
}

/**
 * D3: Detecta scripts referenciados em docs que não existem no root package.json.
 */
function detectScriptWiring(projectRoot: string, nexusDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const pkgPath = join(projectRoot, "package.json");
  if (!existsSync(pkgPath)) return issues;

  let rootScripts: string[] = [];
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    rootScripts = Object.keys(pkg.scripts ?? {});
  } catch { /* skip */ }

  const docsToScan = [
    "governance/WORKFLOW.md",
    "docs/AGENTS.md",
    "docs/session-template.md",
  ];
  const scriptRegex = /pnpm run ([a-zA-Z0-9:-]+)/g;
  const referenced = new Set<string>();

  for (const doc of docsToScan) {
    const path = join(nexusDir, doc);
    if (!existsSync(path)) continue;
    try {
      const content = readFileSync(path, "utf-8");
      let match;
      while ((match = scriptRegex.exec(content)) !== null) {
        if (match[1]) referenced.add(match[1]);
      }
    } catch { /* skip */ }
  }

  const missing = Array.from(referenced).filter((s) => !rootScripts.includes(s));
  if (missing.length > 0) {
    issues.push({
      type: "script_wiring",
      severity: 3,
      description: `${missing.length} script(s) referenciado(s) em docs não existem no root package.json: ${missing.join(", ")}`,
      location: "package.json",
      recommendation: `Adicionar scripts ao root package.json: ${missing.map((s) => `"${s}": "tsx nexus-system/scripts/..."`).join(", ")}`,
    });
  }
  return issues;
}

/**
 * D4: Detecta referências quebradas em agent contracts YAML.
 */
function detectAgentContractRefs(nexusDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const agentsDir = join(nexusDir, "governance/agents");
  if (!existsSync(agentsDir)) return issues;

  const projectRoot = join(nexusDir, "..");
  const files = readdirSync(agentsDir).filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));

  const TEMPLATE_PATTERNS = ["YYYY", "MM-DD", "<", "*", "[camada]"];
  const SKIP_DIRS = ["governance/", "docs/", "nexus-system/"];

  for (const file of files) {
    const path = join(agentsDir, file);
    try {
      const content = readFileSync(path, "utf-8");

      const refRegex = /`([^`]+\.(?:md|yaml|json|ts|js))`/g;
      let match;
      while ((match = refRegex.exec(content)) !== null) {
        const ref = match[1];
        if (!ref || ref.includes("<") || ref.includes("YYYY")) continue;
        const refNexus = join(nexusDir, ref);
        const refRoot = join(projectRoot, ref);
        if (!existsSync(refNexus) && !existsSync(refRoot)) {
          issues.push({
            type: "agent_contract_ref",
            severity: 2,
            description: `Referência quebrada em "${file}": "${ref}" não existe`,
            location: `nexus-system/governance/agents/${file}`,
            recommendation: `Corrigir referência "${ref}" em "${file}" ou criar o ficheiro`,
          });
        }
      }

      const dirRefRegex = /\b([a-zA-Z0-9_/.-]+\/)\s*(?:\||$)/gm;
      let dirMatch;
      while ((dirMatch = dirRefRegex.exec(content)) !== null) {
        const ref = dirMatch[1];
        if (!ref || ref.includes("<") || ref.includes("YYYY") || ref.includes("*")) continue;
        if (TEMPLATE_PATTERNS.some((p) => ref.includes(p))) continue;
        if (SKIP_DIRS.some((d) => ref.startsWith(d))) continue;

        const refNexus = join(nexusDir, ref);
        const refRoot = join(projectRoot, ref);
        if (!existsSync(refNexus) && !existsSync(refRoot)) {
          issues.push({
            type: "agent_contract_ref",
            severity: 2,
            description: `Referência quebrada em "${file}": directório "${ref}" não existe`,
            location: `nexus-system/governance/agents/${file}`,
            recommendation: `Criar directório "${ref}" ou corrigir referência em "${file}"`,
          });
        }
      }
    } catch { /* skip */ }
  }
  return issues;
}

/**
 * D5: Detecta seções exigidas por AGENTS.md que não existem no context_buffer.yaml.
 */
function detectBufferSchemaMismatch(nexusDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const bufferPath = join(nexusDir, "governance/context/context_buffer.yaml");
  const agentsPath = join(nexusDir, "docs/AGENTS.md");
  if (!existsSync(bufferPath) || !existsSync(agentsPath)) return issues;

  try {
    const bufferContent = readFileSync(bufferPath, "utf-8");
    const agentsContent = readFileSync(agentsPath, "utf-8");

    const requiredSections = ["blockers", "imported-tools"];
    for (const section of requiredSections) {
      const inBuffer = bufferContent.includes(section);
      const inAgents = agentsContent.includes(section);
      if (inAgents && !inBuffer) {
        issues.push({
          type: "buffer_schema_mismatch",
          severity: 2,
          description: `AGENTS.md referencia secção "${section}" mas context_buffer.yaml não a contém`,
          location: "nexus-system/governance/context/context_buffer.yaml",
          recommendation: `Adicionar secção "${section}" ao context_buffer.yaml`,
        });
      }
    }
  } catch { /* skip */ }
  return issues;
}

/**
 * D6: Detecta typos conhecidos em documentos governance.
 */
function detectRuleTypo(nexusDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const knownTypos: { pattern: RegExp; fix: string; file: string }[] = [
    { pattern: /REGRRA/, fix: "REGRA", file: "docs/AGENTS.md" },
    { pattern: /não-p laneado/, fix: "não-planeado", file: "docs/AGENTS.md" },
    { pattern: /\bejecutar\b/, fix: "executar", file: "docs/session-template.md" },
    { pattern: /\balterarhistóricos\b/, fix: "alterar históricos", file: "docs/session-template.md" },
  ];

  for (const typo of knownTypos) {
    const path = join(nexusDir, typo.file);
    if (!existsSync(path)) continue;
    try {
      const content = readFileSync(path, "utf-8");
      if (typo.pattern.test(content)) {
        issues.push({
          type: "rule_typo",
          severity: 2,
          description: `Typo detectado em "${typo.file}": "${typo.pattern.source}" → "${typo.fix}"`,
          location: `nexus-system/${typo.file}`,
          recommendation: `Corrigir "${typo.pattern.source}" para "${typo.fix}" em "${typo.file}"`,
        });
      }
    } catch { /* skip */ }
  }
  return issues;
}

/**
 * D7: Detecta saltos em numeração de regras (F-01→F-03, lettering g→i).
 */
function detectNumberingGap(nexusDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];

  // Check FORBIDDEN_OPERATIONS.md for F-XX gaps
  const foPath = join(nexusDir, "docs/FORBIDDEN_OPERATIONS.md");
  if (existsSync(foPath)) {
    try {
      const content = readFileSync(foPath, "utf-8");
      const fRefs = [...content.matchAll(/F-(\d+)/g)].map((m) => Number(m[1] ?? "0"));
      const uniqueF = [...new Set(fRefs)].sort((a, b) => a - b);
      for (let i = 1; i < uniqueF.length; i++) {
        if (uniqueF[i]! - uniqueF[i - 1]! > 1) {
          issues.push({
            type: "numbering_gap",
            severity: 2,
            description: `Gap na numeração em FORBIDDEN_OPERATIONS.md: F-${uniqueF[i - 1]} → F-${uniqueF[i]} (F-${uniqueF[i - 1]! + 1} ausente)`,
            location: "nexus-system/docs/FORBIDDEN_OPERATIONS.md",
            recommendation: `Verificar se F-${uniqueF[i - 1]! + 1} foi removido ou renumerado`,
          });
        }
      }
    } catch { /* skip */ }
  }

  // Check AGENTS.md for lettering gaps in rule #17
  const agentsPath = join(nexusDir, "docs/AGENTS.md");
  if (existsSync(agentsPath)) {
    try {
      const content = readFileSync(agentsPath, "utf-8");
      const letterMatches = [...content.matchAll(/^(\s*)\*\*([a-z])\.\*\*/gm)];
      if (letterMatches.length > 2) {
        const letters = letterMatches.map((m) => (m[2] ?? "").charCodeAt(0)).filter((c) => c > 0);
        for (let i = 1; i < letters.length; i++) {
          if (letters[i]! - letters[i - 1]! > 1) {
            const from = String.fromCharCode(letters[i - 1]!);
            const to = String.fromCharCode(letters[i]!);
            issues.push({
              type: "numbering_gap",
              severity: 2,
              description: `Gap na lettering em AGENTS.md: ${from}→${to} (letra ${String.fromCharCode(letters[i - 1]! + 1)} ausente)`,
              location: "nexus-system/docs/AGENTS.md",
              recommendation: `Verificar se a letra ${String.fromCharCode(letters[i - 1]! + 1)} foi removida ou renumerada`,
            });
          }
        }
      }
    } catch { /* skip */ }
  }

  return issues;
}

/**
 * D7b: Detecta referências a regras que não existem (G-05, F-99, etc.).
 * Extrai IDs de regras mencionados em AGENTS.md e compara com definições reais em FORBIDDEN_OPERATIONS.md.
 */
function detectPhantomRuleRefs(nexusDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];

  const foPath = join(nexusDir, "docs/FORBIDDEN_OPERATIONS.md");
  const agentsPath = join(nexusDir, "docs/AGENTS.md");
  if (!existsSync(foPath) || !existsSync(agentsPath)) return issues;

  try {
    const foContent = readFileSync(foPath, "utf-8");
    const agentsContent = readFileSync(agentsPath, "utf-8");

    const definedRules = new Set<string>();
    for (const match of foContent.matchAll(/\*\*(G-\d+|F-\d+|CONFID-\d+|DT-\d+|ENV-\d+|DB-\d+|S-\d+)\*\*/g)) {
      if (match[1]) definedRules.add(match[1]);
    }
    for (const match of foContent.matchAll(/^###?\s+([A-Z]+-\d+)/gm)) {
      if (match[1]) definedRules.add(match[1]);
    }

    const referencedRules = new Map<string, string[]>();
    const refPatterns = [
      { pattern: /\bG-(\d+)\b/g, prefix: "G-" },
      { pattern: /\bF-(\d+)\b/g, prefix: "F-" },
      { pattern: /\bCONFID-(\d+)\b/g, prefix: "CONFID-" },
      { pattern: /\bDT-(\d+)\b/g, prefix: "DT-" },
      { pattern: /\bENV-(\d+)\b/g, prefix: "ENV-" },
      { pattern: /\bDB-(\d+)\b/g, prefix: "DB-" },
    ];

    for (const { pattern, prefix } of refPatterns) {
      let match;
      while ((match = pattern.exec(agentsContent)) !== null) {
        const ruleId = `${prefix}${match[1]}`;
        if (!definedRules.has(ruleId)) {
          const existing = referencedRules.get(ruleId) ?? [];
          existing.push("docs/AGENTS.md");
          referencedRules.set(ruleId, existing);
        }
      }
    }

    for (const [ruleId, locations] of referencedRules) {
      issues.push({
        type: "phantom_rule_ref",
        severity: 3,
        description: `Referência a regra inexistente: "${ruleId}" não está definida em FORBIDDEN_OPERATIONS.md`,
        location: locations[0] ?? "docs/AGENTS.md",
        recommendation: `Criar a regra "${ruleId}" em FORBIDDEN_OPERATIONS.md ou corrigir a referência em ${locations.join(", ")}`,
      });
    }
  } catch { /* skip */ }

  return issues;
}

/**
 * D8: Detecta contagens em docs que não batem com a realidade.
 */
function detectDocCountMismatch(nexusDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const guidePath = join(nexusDir, "docs/Nexus-System_GUIDE.md");
  if (!existsSync(guidePath)) return issues;

  try {
    const content = readFileSync(guidePath, "utf-8");

    // Check "6 relatórios" claim
    const reportMatch = content.match(/(\d+)\s+relat/);
    if (reportMatch) {
      const claimed = Number(reportMatch[1]);
      const reportsDir = join(nexusDir, "reports");
      if (existsSync(reportsDir)) {
        const actual = readdirSync(reportsDir).filter((f) => f.endsWith(".json") && f.startsWith("complexity-")).length;
        if (actual !== claimed) {
          issues.push({
            type: "doc_count_mismatch",
            severity: 2,
            description: `GUIDE diz "${claimed} relatórios" mas existem ${actual} ficheiros complexity-*.json`,
            location: "nexus-system/docs/Nexus-System_GUIDE.md",
            recommendation: `Actualizar contagem de relatórios para ${actual}`,
          });
        }
      }
    }

    // Check "15 registos" claim
    const feedbackMatch = content.match(/(\d+)\s+registos\s+de\s+feedback/);
    if (feedbackMatch) {
      const claimed = Number(feedbackMatch[1]);
      const recordsDir = join(nexusDir, "feedback/records");
      if (existsSync(recordsDir)) {
        const actual = readdirSync(recordsDir).filter((f) => f.endsWith(".json")).length;
        if (actual !== claimed) {
          issues.push({
            type: "doc_count_mismatch",
            severity: 2,
            description: `GUIDE diz "${claimed} registos de feedback" mas existem ${actual}`,
            location: "nexus-system/docs/Nexus-System_GUIDE.md",
            recommendation: `Actualizar contagem de registos para ${actual}`,
          });
        }
      }
    }
  } catch { /* skip */ }
  return issues;
}

/**
 * D9: Detecta contradições na hierarquia P0 entre WORKFLOW.md, CONTEXT_HIERARCHY.md e GUIDE.
 */
function detectCrossDocP0Contradiction(nexusDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const files = [
    "governance/WORKFLOW.md",
    "cognition/context/CONTEXT_HIERARCHY.md",
    "docs/Nexus-System_GUIDE.md",
  ];

  const p0Map = new Map<string, Set<string>>();

  for (const file of files) {
    const path = join(nexusDir, file);
    if (!existsSync(path)) continue;
    try {
      const content = readFileSync(path, "utf-8");
      const p0 = new Set<string>();
      const p0Patterns = [
        /P0[:\s]+([^\n]+)/gi,
        /Level\s*0[:\s]+([^\n]+)/gi,
        /nível\s*0[:\s]+([^\n]+)/gi,
        /\[Nível\s*0:\s*P0\]\s+([^\n]+)/gi,
      ];
      for (const pattern of p0Patterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          const fileRefs = (match[1] ?? "").match(/[A-Z_]+\.md/g);
          if (fileRefs) {
            for (const ref of fileRefs) p0.add(ref);
          }
        }
      }
      if (p0.size > 0) p0Map.set(file, p0);
    } catch { /* skip */ }
  }

  const entries = Array.from(p0Map.entries());
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const entryA = entries[i];
      const entryB = entries[j];
      if (!entryA || !entryB) continue;
      const [fileA, p0A] = entryA;
      const [fileB, p0B] = entryB;
      const onlyInA = [...p0A].filter((f) => !p0B.has(f));
      const onlyInB = [...p0B].filter((f) => !p0A.has(f));
      if (onlyInA.length > 0 || onlyInB.length > 0) {
        const parts: string[] = [];
        if (onlyInA.length > 0) parts.push(`${fileA} tem: ${onlyInA.join(", ")}`);
        if (onlyInB.length > 0) parts.push(`${fileB} tem: ${onlyInB.join(", ")}`);
        issues.push({
          type: "cross_doc_p0_contradiction",
          severity: 2,
          description: `Hierarquia P0 inconsistente entre docs: ${parts.join("; ")}`,
          location: `nexus-system/${fileA}`,
          recommendation: "Reconciliar listas P0 em todos os documentos",
        });
      }
    }
  }
  return issues;
}

/**
 * D10: Detecta ficheiros de dados vazios (0 bytes).
 */
function detectEmptyDataFiles(nexusDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const dirsToScan = [
    "telemetry",
    "reports",
    "docs/history",
    "governance/knowledge-graph",
  ];

  for (const dir of dirsToScan) {
    const dirPath = join(nexusDir, dir);
    if (!existsSync(dirPath)) continue;
    try {
      const files = readdirSync(dirPath);
      for (const file of files) {
        const filePath = join(dirPath, file);
        try {
          const stat = statSync(filePath);
          if (stat.isFile() && stat.size === 0) {
            issues.push({
              type: "empty_data_file",
              severity: 1,
              description: `Ficheiro vazio (0 bytes): ${dir}/${file}`,
              location: `nexus-system/${dir}/${file}`,
              recommendation: `Verificar se ${file} deveria ter conteúdo ou removê-lo`,
            });
          }
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
  }
  return issues;
}

// ── Engineering Audit Detectors (Dimensions 1-7) ─────────────────────────────

/**
 * E1: Executa testes e reporta pass/fail.
 */
function detectTestHealth(projectRoot: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  // If vitest not installed, execSync throws ENOENT — no failure patterns in
  // output, so we skip gracefully (returns 0 issues).
  try {
    execSync("npx vitest run 2>&1", {
      cwd: projectRoot,
      encoding: "utf-8",
      timeout: 120000,
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    const output = String(e.stdout || e.stderr || e.message || "");
    // Parse summary line: "Tests 14 failed | 1001 passed | 1015 total"
    const summaryMatch = output.match(/(\d+)\s+failed/);
    const failed = summaryMatch?.[1] ? parseInt(summaryMatch[1], 10) : 0;
    if (failed > 0) {
      issues.push({
        type: "test_failure",
        severity: 3,
        description: `${failed} teste(s) falharam (vitest)`,
        location: "src/__tests__/",
        recommendation: "Corrigir testes falhados antes de commitar",
      });
    }
  }
  return issues;
}

/**
 * E2: Detecta modulos source sem imports de outros modulos.
 */
function detectOrphanModules(projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  if (files.length === 0) return issues;

  try {
    for (const file of files) {
      if (file.fullPath.includes("/commands/") || file.fullPath.includes("/console/")) continue;

      const isImported = files.some((other) => {
        if (other.fullPath === file.fullPath) return false;
        return other.content.includes(`/${file.basename}.js"`) || other.content.includes(`/${file.basename}"`) || other.content.includes(`/${file.basename}.ts"`);
      });

      if (!isImported) {
        issues.push({
          type: "orphan_module",
          severity: file.lineCount > ORPHAN_SEVERITY_THRESHOLD ? 2 : 1,
          description: `Modulo orfao: "${file.relPath}" (${file.lineCount} linhas) nao e importado por nenhum outro modulo`,
          location: file.relPath,
          recommendation: `Verificar se "${file.basename}" e necessario — remover se morto, ou adicionar imports`,
        });
      }
    }
  } catch { /* skip */ }
  return issues;
}

/**
 * E3: Detecta arquivos oversized (>{OVERSIZED_INFO_THRESHOLD} linhas).
 */
function detectComplexityHotspots(projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];

  const largeFiles = files.filter((f) => f.lineCount > OVERSIZED_INFO_THRESHOLD);
  largeFiles.sort((a, b) => b.lineCount - a.lineCount);

  for (const file of largeFiles) {
    issues.push({
      type: "oversized_file",
      severity: file.lineCount > OVERSIZED_WARNING_THRESHOLD ? 2 : 1,
      description: `Arquivo oversized: "${file.relPath}" tem ${file.lineCount} linhas${file.lineCount > OVERSIZED_WARNING_THRESHOLD ? " — considere dividir" : ""}`,
      location: file.relPath,
      recommendation: file.lineCount > OVERSIZED_WARNING_THRESHOLD
        ? `Dividir "${file.relPath}" em modulos menores (<${OVERSIZED_INFO_THRESHOLD} linhas cada)`
        : `Monitorar tamanho de "${file.relPath}" — considerar refatorar se crescer`,
    });
  }
  return issues;
}

/**
 * E4: Detecta modulos source sem teste correspondente.
 */
function detectTestCoverageGaps(projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const testsDir = join(projectRoot, "src", "__tests__");

  try {
    const testFiles = new Set<string>();
    if (existsSync(testsDir)) {
      for (const f of readdirSync(testsDir).filter((f) => f.endsWith(".test.ts"))) {
        testFiles.add(f.replace(/\.test\.ts$/, ""));
      }
    }

    const missingTests = files.filter((f) => {
      if (testFiles.has(f.basename)) return false;
      const realLines = f.content.split("\n").filter((l) => l.trim().length > 0 && !l.trim().startsWith("//"));
      return realLines.length >= 10;
    });

    if (missingTests.length > 0) {
      issues.push({
        type: "missing_test",
        severity: missingTests.length > MISSING_TEST_WARNING_THRESHOLD ? 2 : 1,
        description: `${missingTests.length} modulo(s) source sem teste correspondente`,
        location: "src/",
        recommendation: `Adicionar testes para: ${missingTests.slice(0, 5).map((f) => f.relPath).join(", ")}${missingTests.length > 5 ? ` (+${missingTests.length - 5} mais)` : ""}`,
      });
    }
  } catch { /* skip */ }
  return issues;
}

/**
 * E5: Executa ESLint e reporta erros/warnings.
 */
function detectLintIssues(projectRoot: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const eslintConfigs = [".eslintrc.js", ".eslintrc.json", ".eslintrc.yml", "eslint.config.js", "eslint.config.mjs"];
  if (!eslintConfigs.some((c) => existsSync(join(projectRoot, c)))) return issues;

  try {
    const output = execSync("npx eslint src/ --format=json 2>&1", {
      cwd: projectRoot,
      encoding: "utf-8",
      timeout: 60000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    // ESLint exits 0 — parse for warnings only
    try {
      const results = JSON.parse(output) as Array<{ errorCount: number; warningCount: number }>;
      let totalWarnings = 0;
      for (const r of results) { totalWarnings += r.warningCount || 0; }
      if (totalWarnings > 0) {
        issues.push({
          type: "lint_error",
          severity: 1,
          description: `ESLint encontrou ${totalWarnings} warning(s) (0 erros)`,
          location: "src/",
          recommendation: "Rever warnings ESLint — execute 'npx eslint src/' para detalhes",
        });
      }
    } catch { /* not JSON — skip */ }
  } catch (err: unknown) {
    const e = err as { stdout?: string };
    const output = String(e.stdout || "");
    try {
      const results = JSON.parse(output) as Array<{ errorCount: number; warningCount: number }>;
      let totalErrors = 0;
      let totalWarnings = 0;
      for (const r of results) {
        totalErrors += r.errorCount || 0;
        totalWarnings += r.warningCount || 0;
      }
      if (totalErrors > 0) {
        issues.push({
          type: "lint_error",
          severity: 2,
          description: `ESLint encontrou ${totalErrors} erro(s) e ${totalWarnings} warning(s)`,
          location: "src/",
          recommendation: "Corrigir erros ESLint — execute 'npx eslint src/ --fix' para correcoes automaticas",
        });
      } else if (totalWarnings > 0) {
        issues.push({
          type: "lint_error",
          severity: 1,
          description: `ESLint encontrou ${totalWarnings} warning(s) (0 erros)`,
          location: "src/",
          recommendation: "Rever warnings ESLint — execute 'npx eslint src/' para detalhes",
        });
      }
    } catch { /* not JSON — skip */ }
  }
  return issues;
}

/**
 * E6: Detecta uso de `any` e erros TypeScript.
 */
function detectTypeSafetyIssues(projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];

  let anyCount = 0;
  const anyFiles: string[] = [];

  for (const file of files) {
    const matches = file.content.match(/:\s*any\b|as\s+any\b|<any>/g);
    if (matches && matches.length > 0) {
      anyCount += matches.length;
      anyFiles.push(file.relPath);
    }
  }

  if (anyCount > 0) {
    issues.push({
      type: "any_type_usage",
      severity: anyCount > ANY_TYPE_SEVERITY_THRESHOLD ? 2 : 1,
      description: `${anyCount} uso(s) de \`any\` em ${anyFiles.length} arquivo(s) source`,
      location: anyFiles.slice(0, 3).join(", ") + (anyFiles.length > 3 ? ` (+${anyFiles.length - 3})` : ""),
      recommendation: "Substituir \`any\` por tipos adequados para melhorar type safety",
    });
  }

  try {
    execSync("npx tsc --noEmit 2>&1", {
      cwd: projectRoot,
      encoding: "utf-8",
      timeout: 60000,
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string };
    const output = String(e.stdout || e.stderr || "");
    const errorCount = (output.match(/error TS\d+:/g) || []).length;
    if (errorCount > 0) {
      issues.push({
        type: "type_error",
        severity: 2,
        description: `TypeScript compilador encontrou ${errorCount} erro(s) de tipo`,
        location: "src/",
        recommendation: "Corrigir erros de tipo TypeScript — execute 'npx tsc --noEmit' para detalhes",
      });
    }
  }

  return issues;
}

/**
 * E7: Detecta console.* fora de commands/ (log, warn, error, info, debug, trace).
 */
function detectConsoleUsage(projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];

  let consoleCount = 0;
  const consoleFiles: string[] = [];

  for (const file of files) {
    if (file.relPath.startsWith("src/commands/") || file.relPath.startsWith("src/console/")) continue;
    const matches = file.content.match(/console\.(log|warn|error|info|debug|trace)\(/g);
    if (matches) {
      consoleCount += matches.length;
      consoleFiles.push(file.relPath);
    }
  }

  if (consoleCount > 0) {
    issues.push({
      type: "console_log_outside_cmd",
      severity: 1,
      description: `${consoleCount} console.log/warn/error/debug/trace fora de commands/ — usar logger em vez de console`,
      location: consoleFiles.slice(0, 3).join(", ") + (consoleFiles.length > 3 ? ` (+${consoleFiles.length - 3})` : ""),
      recommendation: "Substituir console.log por logger do modulo logger.ts",
    });
  }

  return issues;
}

// ── Phase 3 Detectors: Code Quality ─────────────────────────────────────────

const COMPLEXITY_WARNING_THRESHOLD = 15;
const COMPLEXITY_CRITICAL_THRESHOLD = 25;

/**
 * P3.1: Detecta catch vazios que silenciam erros.
 */
function detectEmptyCatchBlocks(projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];

  for (const file of files) {
    // Match catch blocks with only whitespace, line comments, or block comments
    const emptyCatchRegex = /catch\s*(?:\([^)]*\))?\s*\{\s*(?:(?:\/\/[^\n]*|\/\*[\s\S]*?\*\/|\s)*)\}/g;
    let match;
    while ((match = emptyCatchRegex.exec(file.content)) !== null) {
      const lineNum = file.content.substring(0, match.index).split("\n").length;
      issues.push({
        type: "empty_catch",
        severity: 2,
        description: `Catch vazio em "${file.relPath}:${lineNum}" — erros estão silenciados`,
        location: `${file.relPath}:${lineNum}`,
        recommendation: `Adicionar tratamento de erro ou logger.debug no catch em ${file.relPath}:${lineNum}`,
      });
    }
  }
  return issues;
}

/**
 * P3.2: Detecta alta complexidade ciclomática por função.
 */
function detectHighComplexity(projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const branchRegex = /\b(if|else if|switch|case|for|while|do|catch|\?|&&|\|\|)\b/g;

  for (const file of files) {
    const lines = file.content.split("\n");

    // Find function boundaries by tracking braces
    let braceDepth = 0;
    let funcStart = -1;
    let funcName = "";
    let inFunction = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const trimmed = line.trim();

      // Skip comments
      if (trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) {
        // Still count braces in comments? No, skip.
        continue;
      }

      // Detect function start: function keyword, arrow function, or method signature
      if (!inFunction) {
        const funcMatch = line.match(/\b(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
        const arrowMatch = line.match(/(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(/);
        const methodMatch = line.match(/^\s*(?:public|private|protected|static)?\s*(?:async\s+)?(\w+)\s*\(/);
        const getterSetterMatch = line.match(/^\s*(?:get|set)\s+(\w+)\s*\(/);
        const constructorMatch = line.match(/^\s*constructor\s*\(/);
        if (funcMatch) {
          funcName = funcMatch[1]!;
          funcStart = i;
          inFunction = true;
        } else if (arrowMatch) {
          funcName = arrowMatch[1]!;
          funcStart = i;
          inFunction = true;
        } else if (getterSetterMatch) {
          funcName = getterSetterMatch[1]!;
          funcStart = i;
          inFunction = true;
        } else if (constructorMatch) {
          funcName = "constructor";
          funcStart = i;
          inFunction = true;
        } else if (methodMatch) {
          funcName = methodMatch[1]!;
          funcStart = i;
          inFunction = true;
        }
      }

      // Count braces
      for (const ch of line) {
        if (ch === "{") braceDepth++;
        if (ch === "}") braceDepth--;
      }

      // If we're in a function and brace depth returns to 0, function ended
      if (inFunction && braceDepth <= 0) {
        inFunction = false;
        // Count complexity for this function block
        const funcLines = lines.slice(funcStart, i + 1);
        let branches = 0;
        for (const fl of funcLines) {
          const flTrimmed = fl.trim();
          if (flTrimmed.startsWith("//") || flTrimmed.startsWith("/*") || flTrimmed.startsWith("*")) continue;
          const matches = fl.match(branchRegex);
          if (matches) branches += matches.length;
        }
        const complexity = 1 + branches;
        if (complexity > COMPLEXITY_WARNING_THRESHOLD) {
          issues.push({
            type: "high_complexity",
            severity: complexity > COMPLEXITY_CRITICAL_THRESHOLD ? 3 : 2,
            description: `Alta complexidade ciclomática em "${file.relPath}:${funcStart + 1}" (${funcName}): complexidade ${complexity} (máx: ${COMPLEXITY_WARNING_THRESHOLD})`,
            location: `${file.relPath}:${funcStart + 1}`,
            recommendation: `Dividir "${funcName}" em lógica mais simples — complexidade ${complexity} > ${COMPLEXITY_WARNING_THRESHOLD}`,
          });
        }
        funcName = "";
        funcStart = -1;
      }
    }
  }
  return issues;
}

/**
 * P3.3: Detecta dependências circulares entre módulos.
 */
function detectCircularDeps(projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  if (files.length === 0) return issues;

  // Build import graph: file basename → set of basenames it imports
  const importGraph = new Map<string, Set<string>>();
  // Match both relative (./foo, ../foo) and bare specifiers ("foo")
  const importRegex = /(?:from|import)\s+["']([^"']+)["']/g;

  for (const file of files) {
    const deps = new Set<string>();
    let match;
    while ((match = importRegex.exec(file.content)) !== null) {
      const spec = match[1];
      if (!spec) continue;
      // Only track relative imports (skip node_modules, builtins)
      if (spec.startsWith(".") || spec.startsWith("/")) {
        // Resolve relative path to basename
        const resolved = spec.replace(/\.js$/, "");
        const depBasename = resolved.split("/").pop() || resolved;
        if (depBasename && depBasename !== file.basename) {
          deps.add(depBasename);
        }
      }
    }
    importGraph.set(file.basename, deps);
  }

  // DFS cycle detection
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const cycles: string[][] = [];

  function dfs(node: string, path: string[]): void {
    if (inStack.has(node)) {
      const cycleStart = path.indexOf(node);
      if (cycleStart !== -1) {
        cycles.push([...path.slice(cycleStart), node]);
      }
      return;
    }
    if (visited.has(node)) return;

    visited.add(node);
    inStack.add(node);
    path.push(node);

    const deps = importGraph.get(node);
    if (deps) {
      for (const dep of deps) {
        if (importGraph.has(dep)) {
          dfs(dep, path);
        }
      }
    }

    path.pop();
    inStack.delete(node);
  }

  for (const node of importGraph.keys()) {
    dfs(node, []);
  }

  // Deduplicate cycles
  const seenCycles = new Set<string>();
  for (const cycle of cycles) {
    const key = [...cycle].sort().join("->");
    if (seenCycles.has(key)) continue;
    seenCycles.add(key);

    const cyclePath = cycle.join(" → ");
    issues.push({
      type: "circular_dep",
      severity: 3,
      description: `Dependência circular detectada: ${cyclePath}`,
      location: cycle.map((c) => `src/${c}.ts`).join(", "),
      recommendation: `Extrair interface comum ou usar injeção de dependência para quebrar o ciclo entre ${cycle.join(", ")}`,
    });
  }

  return issues;
}

/**
 * P3.4: Detecta exports que nunca são importados por outros módulos.
 */
function detectUnusedExports(projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  if (files.length === 0) return issues;

  const exportRegex = /^export\s+(?:function|const|class|interface|type|enum)\s+(\w+)/gm;

  for (const file of files) {
    // Skip barrel/entry files
    if (file.basename === "index" || file.fullPath.includes("/bin/")) continue;

    const exports: string[] = [];
    let match;
    while ((match = exportRegex.exec(file.content)) !== null) {
      if (match[1]) exports.push(match[1]);
    }

    for (const symbol of exports) {
      // Check if any other file imports this symbol (word-boundary match)
      const isImported = files.some((other) => {
        if (other.fullPath === file.fullPath) return false;
        const wordBoundary = new RegExp(`\\b${symbol}\\b`);
        return wordBoundary.test(other.content);
      });

      if (!isImported) {
        issues.push({
          type: "unused_export",
          severity: 1,
          description: `Export não usado: "${symbol}" em "${file.relPath}" — nunca é importado por outro módulo`,
          location: file.relPath,
          recommendation: `Remover export "${symbol}" de "${file.relPath}" ou adicionar import no módulo que o utiliza`,
        });
      }
    }
  }
  return issues;
}

/**
 * P3.5: Detecta padrões de código morto: código inalcançável, funções vazias, @ts-ignore.
 */
function detectDeadCodePatterns(projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const CONTROL_FLOW_KEYWORDS = new Set(["if", "for", "while", "switch", "try", "catch", "else"]);
  const methodDeclRegex = /(\w+)\s*\([^)]*\)\s*\{\s*\}/g;

  for (const file of files) {
    const lines = file.content.split("\n");

    // 1. Detect @ts-ignore and @ts-expect-error
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i]!.trim();
      if (trimmed.startsWith("// @ts-ignore") || trimmed.startsWith("// @ts-expect-error")) {
        issues.push({
          type: "dead_code",
          severity: 1,
          description: `Type safety bypass em "${file.relPath}:${i + 1}" — ${trimmed.split(" ").slice(0, 3).join(" ")}`,
          location: `${file.relPath}:${i + 1}`,
          recommendation: `Remover "${trimmed.split(" ").slice(0, 2).join(" ")}" e corrigir o problema de tipo subjacente`,
        });
      }
    }

    // 2. Detect empty function/method bodies
    const emptyFuncRegex = /(?:function\s+\w+|\(\)\s*=>|=>)\s*\{\s*\}/g;
    let emptyMatch;
    while ((emptyMatch = emptyFuncRegex.exec(file.content)) !== null) {
      const lineNum = file.content.substring(0, emptyMatch.index).split("\n").length;
      issues.push({
        type: "dead_code",
        severity: 1,
        description: `Função vazia em "${file.relPath}:${lineNum}" — corpo sem implementação`,
        location: `${file.relPath}:${lineNum}`,
        recommendation: `Implementar a função em ${file.relPath}:${lineNum} ou removê-la se desnecessária`,
      });
    }
    // Also detect empty class methods: methodName(params) {}
    let methodMatch;
    while ((methodMatch = methodDeclRegex.exec(file.content)) !== null) {
      const name = methodMatch[1];
      if (!name || CONTROL_FLOW_KEYWORDS.has(name)) continue;
      const lineNum = file.content.substring(0, methodMatch.index).split("\n").length;
      issues.push({
        type: "dead_code",
        severity: 1,
        description: `Método vazio em "${file.relPath}:${lineNum}" — corpo sem implementação`,
        location: `${file.relPath}:${lineNum}`,
        recommendation: `Implementar o método em ${file.relPath}:${lineNum} ou removê-lo se desnecessário`,
      });
    }

    // 3. Detect TODO/FIXME/HACK comments (limit to 5 per file to reduce noise)
    let todoCount = 0;
    const maxTodosPerFile = 5;
    for (let i = 0; i < lines.length; i++) {
      if (todoCount >= maxTodosPerFile) break;
      const trimmed = lines[i]!.trim();
      const todoMatch = trimmed.match(/(?:TODO|FIXME|HACK|XXX)[:\s]*(.*)/);
      if (todoMatch) {
        issues.push({
          type: "dead_code",
          severity: 1,
          description: `Código pendente em "${file.relPath}:${i + 1}" — ${todoMatch[0].slice(0, 60)}`,
          location: `${file.relPath}:${i + 1}`,
          recommendation: `Resolver o TODO/FIXME em ${file.relPath}:${i + 1} ou removê-lo se já resolvido`,
        });
        todoCount++;
      }
    }
  }
  return issues;
}


// ── Security Pattern Detectors (SEC-*) ────────────────────────────────────────

const SECURITY_DETECTOR_SELF_PATHS = ["src/health-auditor.ts", "src/audit/taint/"];

function isDetectorDefinitionFile(relPath: string): boolean {
  return SECURITY_DETECTOR_SELF_PATHS.some((p) => relPath.startsWith(p));
}

/**
 * SEC-01: Detecta chaves/tokens hardcoded em código.
 */
function detectHardcodedSecrets(projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const secretPatterns = [
    { regex: /(?:password|passwd|pwd)\s*[=:]\s*["'][^"']{3,}["']/gi, name: "password" },
    { regex: /(?:api[_-]?key|apikey)\s*[=:]\s*["'][^"']{8,}["']/gi, name: "API key" },
    { regex: /(?:secret|token)\s*[=:]\s*["'][A-Za-z0-9_\-\.]{16,}["']/gi, name: "secret/token" },
    { regex: /(?:private[_-]?key)\s*[=:]\s*["'][^"']{16,}["']/gi, name: "private key" },
    { regex: /(?:aws[_-]?access[_-]?key[_-]?id)\s*[=:]\s*["'][A-Z0-9]{16,}["']/gi, name: "AWS key" },
    { regex: /(?:bearer)\s+[A-Za-z0-9_\-\.]{20,}/gi, name: "bearer token" },
  ];

  const skipPatterns = [/\.test\.ts$/, /\.spec\.ts$/, /__tests__/];

  for (const file of files) {
    if (skipPatterns.some((p) => p.test(file.relPath))) continue;
    if (isDetectorDefinitionFile(file.relPath)) continue;
    const lines = file.content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (line.trim().startsWith("//") || line.trim().startsWith("*")) continue;
      for (const { regex, name } of secretPatterns) {
        if (regex.test(line)) {
          issues.push({
            type: "hardcoded_secret",
            severity: 3,
            description: `Possível ${name} hardcoded em "${file.relPath}:${i + 1}"`,
            location: `${file.relPath}:${i + 1}`,
            recommendation: `Mover ${name} para variável de ambiente ou ficheiro de configuração seguro`,
          });
          break;
        }
      }
    }
  }
  return issues;
}

/**
 * SEC-02: Detecta concatenação em queries SQL.
 */
function detectSQLInjection(projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const sqlPatterns = [
    /\.query\s*\(\s*[`"'].*\$\{/, /\.execute\s*\(\s*[`"'].*\$\{/,
    /\.raw\s*\(\s*[`"'].*\$\{/, /SELECT\s+.*\+\s*[a-zA-Z]/i,
    /INSERT\s+INTO.*\+\s*[a-zA-Z]/i, /UPDATE\s+.*\+\s*[a-zA-Z]/i,
    /DELETE\s+FROM.*\+\s*[a-zA-Z]/i,
  ];

  for (const file of files) {
    const lines = file.content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (sqlPatterns.some((p) => p.test(line))) {
        issues.push({
          type: "sql_injection",
          severity: 3,
          description: `Possível SQL injection em "${file.relPath}:${i + 1}" — query construída com concatenação/template literal`,
          location: `${file.relPath}:${i + 1}`,
          recommendation: "Usar prepared statements ou parameterized queries em vez de concatenação",
        });
      }
    }
  }
  return issues;
}

/**
 * SEC-03: Detecta padrões XSS.
 */
function detectXSS(projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const xssPatterns = [
    /\.innerHTML\s*[=+]/, /dangerouslySetInnerHTML/, /document\.write\s*\(/,
    /\.outerHTML\s*[=+]/, /insertAdjacentHTML/, /eval\s*\(.*innerHTML/,
  ];

  for (const file of files) {
    if (file.relPath.includes("__tests__")) continue;
    if (isDetectorDefinitionFile(file.relPath)) continue;
    const lines = file.content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (xssPatterns.some((p) => p.test(line))) {
        issues.push({
          type: "xss_risk",
          severity: 3,
          description: `Possível XSS em "${file.relPath}:${i + 1}" — inserção directa de HTML`,
          location: `${file.relPath}:${i + 1}`,
          recommendation: "Sanitizar input antes de inserir HTML, ou usar framework com escaping automático",
        });
      }
    }
  }
  return issues;
}

/**
 * SEC-04: Detecta uso de eval() e Function().
 */
function detectUnsafeEval(projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const evalPatterns = [
    /eval\s*\(/, /new\s+Function\s*\(/, /setTimeout\s*\(\s*["']/,
    /setInterval\s*\(\s*["']/, /Function\s*\(\s*["']/,
    /setInterval\s*\(\s*["']/, /Function\s*\(\s*["']/,
  ];

  for (const file of files) {
    if (file.relPath.includes("__tests__")) continue;
    if (isDetectorDefinitionFile(file.relPath)) continue;
    const lines = file.content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (evalPatterns.some((p) => p.test(line))) {
        issues.push({
          type: "unsafe_eval",
          severity: 3,
          description: `eval/Function dinâmico em "${file.relPath}:${i + 1}" — risco de code injection`,
          location: `${file.relPath}:${i + 1}`,
          recommendation: "Evitar eval/Function dinâmicos — usar alternativas seguras como JSON.parse()",
        });
      }
    }
  }
  return issues;
}

/**
 * SEC-05: Detecta dados sensíveis em console.log.
 */
function detectConsoleSecrets(projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const sensitivePatterns = [
    /console\.(log|info|warn|error|debug)\s*\(.*\b(?:password|api[_-]?key|access[_-]?token|auth[_-]?token|secret|credential)s?\b/i,
    /console\.(log|info|warn|error|debug)\s*\(.*(?:req\.headers|req\.cookies)/i,
  ];
  const falsePositiveContext = /\b(estimated|saved|monthly|total|context|window|token)\w*\s*[\.\[]?\s*tokens?\b/i;

  for (const file of files) {
    if (file.relPath.includes("__tests__")) continue;
    if (isDetectorDefinitionFile(file.relPath)) continue;
    const lines = file.content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (sensitivePatterns.some((p) => p.test(line)) && !falsePositiveContext.test(line)) {
        issues.push({
          type: "console_secret",
          severity: 3,
          description: `Dados sensíveis em console em "${file.relPath}:${i + 1}" — pode expor credenciais em logs`,
          location: `${file.relPath}:${i + 1}`,
          recommendation: "Remover console.log com dados sensíveis ou mascarar valores antes de logar",
        });
      }
    }
  }
  return issues;
}

/**
 * SEC-06: Detecta uso de criptografia fraca.
 */
function detectWeakCrypto(projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const weakPatterns = [
    /\.createHash\s*\(\s*["'](?:md5|sha1)["']\)/i,
    /\.createCipher(?!iv)\s*\(/i, /\.createDecipher(?!iv)\s*\(/i,
    /crypto\.createCipheriv\s*\([^)]*[^"']md5/i,
  ];

  for (const file of files) {
    const lines = file.content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (weakPatterns.some((p) => p.test(line))) {
        issues.push({
          type: "weak_crypto",
          severity: 2,
          description: `Criptografia fraca em "${file.relPath}:${i + 1}" — MD5/SHA1 ou createCipher`,
          location: `${file.relPath}:${i + 1}`,
          recommendation: "Usar algoritmos modernos: SHA-256+, AES-256-GCM em vez de MD5/SHA1",
        });
      }
    }
  }
  return issues;
}

/**
 * SEC-07: Detecta URLs http:// em código de produção.
 */
function detectInsecureHTTP(projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const httpPattern = /["']http:\/\/[^"']{5,}["']/g;
  const skipFiles = [/\.test\.ts$/, /\.spec\.ts$/, /README/, /CHANGELOG/];

  for (const file of files) {
    if (skipFiles.some((p) => p.test(file.relPath))) continue;
    const lines = file.content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (line.trim().startsWith("//")) continue;
      const matches = line.match(httpPattern);
      if (matches) {
        for (const url of matches) {
          if (!url.includes('http://localhost') && !url.includes('http://127.0.0.1') && !url.includes('http://0.0.0.0')) {
            issues.push({
              type: "insecure_http",
              severity: 2,
              description: `URL HTTP insegura em "${file.relPath}:${i + 1}": ${url}`,
              location: `${file.relPath}:${i + 1}`,
              recommendation: "Usar HTTPS em vez de HTTP para URLs de produção",
            });
          }
        }
      }
    }
  }
  return issues;
}

/**
 * SEC-08: Detecta prototype pollution.
 */
function detectPrototypePollution(projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const pollPatterns = [
    /Object\.assign\s*\([^)]*req\./, /\.\[\s*["']__proto__["']\s*\]/,
    /\.\[\s*["']constructor["']\s*\]/, /\.\[\s*["']prototype["']\s*\]/,
    /merge\s*\([^)]*req\./, /deepMerge\s*\([^)]*req\./,
  ];

  for (const file of files) {
    const lines = file.content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (pollPatterns.some((p) => p.test(line))) {
        issues.push({
          type: "proto_pollution",
          severity: 3,
          description: `Possível prototype pollution em "${file.relPath}:${i + 1}"`,
          location: `${file.relPath}:${i + 1}`,
          recommendation: "Validar/chavear input antes de Object.assign — nunca usar input directo em merge",
        });
      }
    }
  }
  return issues;
}

/**
 * SEC-09: Detecta path traversal.
 */
function detectPathTraversal(projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const traversalPatterns = [
    /readFile(?:Sync)?\s*\([^)]*\+/, /writeFile(?:Sync)?\s*\([^)]*\+/,
    /readFile(?:Sync)?\s*\([^)]*\$\{/, /writeFile(?:Sync)?\s*\([^)]*\$\{/,
    /createReadStream\s*\([^)]*\+/, /unlink(?:Sync)?\s*\([^)]*\+/,
    /path\.join\s*\([^)]*req\./, /path\.resolve\s*\([^)]*req\./,
    /readFile(?:Sync)?\s*\([^)]*\breq\.(query|params|body)\b/,
    /writeFile(?:Sync)?\s*\([^)]*\breq\.(query|params|body)\b/,
    /unlink(?:Sync)?\s*\([^)]*\breq\.(query|params|body)\b/,
    /createReadStream\s*\([^)]*\breq\.(query|params|body)\b/,
  ];

  for (const file of files) {
    if (file.relPath.includes("__tests__")) continue;
    if (isDetectorDefinitionFile(file.relPath)) continue;
    const lines = file.content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (traversalPatterns.some((p) => p.test(line))) {
        issues.push({
          type: "path_traversal",
          severity: 3,
          description: `Possível path traversal em "${file.relPath}:${i + 1}" — caminho dinâmico sem validação`,
          location: `${file.relPath}:${i + 1}`,
          recommendation: "Validar e sanitizar caminhos — usar path.resolve com prefixo seguro",
        });
      }
    }
  }
  return issues;
}

/**
 * SEC-10: Detecta regex com risco de ReDoS.
 */
function detectRegexDos(projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const redosPatterns = [
    /new\s+RegExp\s*\([^)]*\+[^)]*\+/, /new\s+RegExp\s*\([^)]*\*[^)]*\*/,
    /new\s+RegExp\s*\([^)]*\+[^)]*\)/,
  ];

  for (const file of files) {
    const lines = file.content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (redosPatterns.some((p) => p.test(line))) {
        issues.push({
          type: "regex_dos",
          severity: 2,
          description: `Regex potencialmente vulnerable a ReDoS em "${file.relPath}:${i + 1}"`,
          location: `${file.relPath}:${i + 1}`,
          recommendation: "Simplificar regex ou usar libraries como re2 — evitar backtracking complexo",
        });
      }
    }
  }
  return issues;
}

/**
 * SEC-11: Detecta JSON.parse sem validação.
 */
function detectUnsafeDeserialization(projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const deserPatterns = [
    /JSON\.parse\s*\(.*req\./,
    /JSON\.parse\s*\(.*process\.argv/, /JSON\.parse\s*\(.*readFile/,
  ];

  for (const file of files) {
    const lines = file.content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (deserPatterns.some((p) => p.test(line))) {
        issues.push({
          type: "unsafe_deserialize",
          severity: 2,
          description: `JSON.parse com input não validado em "${file.relPath}:${i + 1}"`,
          location: `${file.relPath}:${i + 1}`,
          recommendation: "Validar JSON com schema (zod/joi) antes de processar",
        });
      }
    }
  }
  return issues;
}

/**
 * SEC-12: Detecta imports de pacotes inexistentes (dependency confusion).
 */
function detectDependencyConfusion(projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const pkgPath = join(projectRoot, "package.json");
  if (!existsSync(pkgPath)) return issues;

  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    const declaredDeps = new Set([
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.devDependencies ?? {}),
    ]);

    const importRegex = /(?:from|import)\s+["']([^"'./][^"']*)["']/g;
    const NODE_BUILTINS = new Set(["fs", "path", "os", "child_process", "util", "events", "stream", "http", "https", "url", "crypto", "assert", "buffer", "zlib", "net", "tls", "dns", "readline", "worker_threads", "perf_hooks", "v8", "vm", "module", "constants"]);
    for (const b of [...NODE_BUILTINS]) NODE_BUILTINS.add("node:" + b);

    for (const file of files) {
      let match;
      importRegex.lastIndex = 0;
      while ((match = importRegex.exec(file.content)) !== null) {
        const spec = match[1];
        if (!spec) continue;
        const pkgName = spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0];
        if (pkgName && !NODE_BUILTINS.has(pkgName) && !NODE_BUILTINS.has(spec) && !declaredDeps.has(pkgName)) {
          // Check if package exists in node_modules
          const nmPath = join(projectRoot, "node_modules", pkgName);
          if (!existsSync(nmPath)) {
            issues.push({
              type: "dep_confusion",
              severity: 2,
              description: `Dependência "${pkgName}" importada em "${file.relPath}" mas não existe em node_modules nem em package.json`,
              location: file.relPath,
              recommendation: `Adicionar "${pkgName}" ao package.json ou verificar se o nome está correcto`,
            });
          }
        }
      }
    }
  } catch { /* skip */ }
  return issues;
}


// ── Supply Chain Detectors (SC-*) ──────────────────────────────────────────

/**
 * SC-01: Detecta dependências com versões não fixadas (* ou latest).
 */
function detectUnpinnedVersions(projectRoot: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const pkgPath = join(projectRoot, "package.json");
  if (!existsSync(pkgPath)) return issues;

  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    const allDeps: Record<string, string> = {
      ...(pkg.dependencies ?? {}),
      ...(pkg.devDependencies ?? {}),
    };

    const unpinned: string[] = [];
    for (const [name, version] of Object.entries(allDeps)) {
      // Only flag truly unpinned: *, latest, >, >=. Standard semver ranges (^, ~) are intentional.
      if (version === "*" || version === "latest" || version === ">" || version === ">=") {
        unpinned.push(`${name}@${version}`);
      }
    }

    if (unpinned.length > 0) {
      issues.push({
        type: "unpinned_version",
        severity: 2,
        description: `${unpinned.length} dependência(s) com versão não fixada: ${unpinned.slice(0, 5).join(", ")}${unpinned.length > 5 ? ` (+${unpinned.length - 5})` : ""}`,
        location: "package.json",
        recommendation: "Fixar versões em package.json para evitar actualizações inesperadas",
      });
    }
  } catch { /* skip */ }
  return issues;
}

/**
 * SC-02: Detecta ausência de lock file.
 */
function detectMissingLockFile(projectRoot: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const pkgPath = join(projectRoot, "package.json");
  if (!existsSync(pkgPath)) return issues;

  const lockFiles = [
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "bun.lockb",
  ];

  const hasLockFile = lockFiles.some((f) => existsSync(join(projectRoot, f)));
  if (!hasLockFile) {
    issues.push({
      type: "missing_lock_file",
      severity: 3,
      description: "Nenhum lock file encontrado (package-lock.json, pnpm-lock.yaml, yarn.lock, bun.lockb)",
      location: "package.json",
      recommendation: "Executar 'npm install' ou 'pnpm install' para gerar o lock file — garante builds reproduzíveis",
    });
  }
  return issues;
}

/**
 * SC-03: Detecta drift entre package.json e lock file.
 */
function detectLockFileDrift(projectRoot: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const pkgPath = join(projectRoot, "package.json");
  if (!existsSync(pkgPath)) return issues;

  // Check if lock file is newer than package.json
  const lockFiles = [
    { lock: "package-lock.json", manager: "npm" },
    { lock: "pnpm-lock.yaml", manager: "pnpm" },
    { lock: "yarn.lock", manager: "yarn" },
  ];

  try {
    const pkgStat = statSync(pkgPath);
    for (const { lock } of lockFiles) {
      const lockPath = join(projectRoot, lock);
      if (existsSync(lockPath)) {
        const lockStat = statSync(lockPath);
        if (lockStat.mtimeMs < pkgStat.mtimeMs) {
          issues.push({
            type: "lock_file_drift",
            severity: 2,
            description: `${lock} está desactualizado — package.json foi modificado depois do último 'install'`,
            location: lock,
            recommendation: `Executar 'npm install' ou 'pnpm install' para actualizar o lock file`,
          });
        }
      }
    }
  } catch { /* skip */ }
  return issues;
}

/**
 * SC-04: Detecta dependências usadas mas não declaradas (phantom deps).
 */
function detectPhantomDependencies(projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const pkgPath = join(projectRoot, "package.json");
  if (!existsSync(pkgPath)) return issues;

  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    const declaredDeps = new Set([
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.devDependencies ?? {}),
      ...Object.keys(pkg.peerDependencies ?? {}),
      ...Object.keys(pkg.peerDependencies ?? {}),
    ]);

    // Node builtins (both bare and node: prefix)
    const NODE_BUILTINS = new Set([
      "fs", "path", "os", "child_process", "util", "events", "stream", "http", "https",
      "url", "crypto", "assert", "buffer", "zlib", "net", "tls", "dns", "readline",
      "worker_threads", "perf_hooks", "v8", "vm", "module", "constants", "querystring",
      "string_decoder", "timers", "tty", "punycode", "domain", "cluster", "dgram",
      "dns/promises", "fs/promises", "path/posix", "path/win32",
    ]);
    // Also add node: prefix variants
    for (const builtin of [...NODE_BUILTINS]) {
      NODE_BUILTINS.add(`node:${builtin}`);
    }

    // Match both ESM imports (from 'pkg') and require() calls (require('pkg'))
    const importRegex = /(?:from|import)\s+["']([^"'\.\/][^"']*)["']/g;
    const requireRegex = /require\s*\(\s*["']([^"'\.\/][^"']*)["']\s*\)/g;
    const usedPackages = new Map<string, string>(); // package -> first file that uses it

    for (const file of files) {
      let match;
      // Reset lastIndex for each file (regex has 'g' flag)
      importRegex.lastIndex = 0;
      while ((match = importRegex.exec(file.content)) !== null) {
        const spec = match[1];
        if (!spec) continue;
        const pkgName = spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0];
        if (pkgName && !NODE_BUILTINS.has(pkgName) && !NODE_BUILTINS.has(spec) && !declaredDeps.has(pkgName) && !usedPackages.has(pkgName)) {
          usedPackages.set(pkgName, file.relPath);
        }
      }
      requireRegex.lastIndex = 0;
      while ((match = requireRegex.exec(file.content)) !== null) {
        const spec = match[1];
        if (!spec) continue;
        const pkgName = spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0];
        if (pkgName && !NODE_BUILTINS.has(pkgName) && !NODE_BUILTINS.has(spec) && !declaredDeps.has(pkgName) && !usedPackages.has(pkgName)) {
          usedPackages.set(pkgName, file.relPath);
        }
      }
    }

    if (usedPackages.size > 0) {
      const phantomList = Array.from(usedPackages.entries()).map(([pkg, file]) => `${pkg} (usado em ${file})`);
      issues.push({
        type: "phantom_dep",
        severity: 2,
        description: `${usedPackages.size} dependência(s) usada(s) mas não declarada(s): ${phantomList.slice(0, 5).join(", ")}${phantomList.length > 5 ? ` (+${phantomList.length - 5})` : ""}`,
        location: "package.json",
        recommendation: `Adicionar ao package.json: ${Array.from(usedPackages.keys()).slice(0, 3).join(", ")}`,
      });
    }
  } catch { /* skip */ }
  return issues;
}

/**
 * SC-05: Detecta dependências deprecated no npm.
 * Static analysis only (hardcoded list) - npm registry calls removed for performance.
 */
function detectDeprecatedPackages(projectRoot: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const pkgPath = join(projectRoot, "package.json");
  if (!existsSync(pkgPath)) return issues;

  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    const allDeps = {
      ...(pkg.dependencies ?? {}),
      ...(pkg.devDependencies ?? {}),
    };

    // Check for known deprecated packages
    const KNOWN_DEPRECATED: Record<string, string> = {
      "request": "Use node-fetch, axios, ou got em vez de request",
      "tslint": "Usar ESLint com @typescript-eslint em vez de tslint",
      "node-uuid": "Usar crypto.randomUUID() ou uuid package",
      "nomnom": "Usar commander ou yargs em vez de nomnom",
      "natives": "Removido — não necessário em Node.js moderno",
      "left-pad": "Usar String.prototype.padStart() em vez de left-pad",
      "istanbul": "Usar nyc ou c8 em vez de istanbul",
      "es5-ext": "Usar nativos ES6+ em vez de es5-ext",
    };

    const deprecated: string[] = [];
    for (const name of Object.keys(allDeps)) {
      if (KNOWN_DEPRECATED[name]) {
        deprecated.push(`${name} → ${KNOWN_DEPRECATED[name]}`);
      }
    }

    if (deprecated.length > 0) {
      issues.push({
        type: "deprecated_package",
        severity: 2,
        description: `${deprecated.length} dependência(s) deprecated: ${deprecated.slice(0, 3).join(", ")}${deprecated.length > 3 ? ` (+${deprecated.length - 3})` : ""}`,
        location: "package.json",
        recommendation: `Substituir dependências deprecated: ${deprecated.slice(0, 2).join("; ")}`,
      });
    }
  } catch { /* skip */ }
  return issues;
}

// ── Remove issues duplicadas por (type, description, location).
function deduplicateIssues(issues: HealthIssue[]): HealthIssue[] {
  const seen = new Map<string, HealthIssue>();
  for (const issue of issues) {
    const key = `${issue.type}|${issue.description}|${issue.location}`;
    if (!seen.has(key)) {
      seen.set(key, issue);
    }
  }
  return Array.from(seen.values());
}

// ── Main Audit Function ──────────────────────────────────────────────────────

/**
 * Executa auditoria de saúde do sistema Nexus.
 * SÓ SUGERE — nunca aplica optimizações.
 */
export function auditHealth(
  projectRoot: string,
  nexusDir: string,
  level: AuditLevel = "standard"
): HealthAuditReport {
  const history = readHistory(nexusDir);
  const rules = readRules(nexusDir);
  const activeDetectors = new Set(DETECTORS_BY_LEVEL[level]);

  // Collect source files once — shared across all engineering detectors
  const sourceFiles = collectSourceFiles(projectRoot);

  // Detector registry: name → function
  const detectorMap: Record<string, () => HealthIssue[]> = {
    detectDeadRules: () => detectDeadRules(rules, history),
    detectViolationHotspots: () => detectViolationHotspots(history),
    detectMissingDocs: () => detectMissingDocs(nexusDir),
    detectOrphanDirs: () => detectOrphanDirs(nexusDir),
    detectStaleBuffer: () => detectStaleBuffer(nexusDir),
    detectDatePlaceholders: () => detectDatePlaceholders(nexusDir),
    detectEmptyDirs: () => detectEmptyDirs(nexusDir),
    detectBrokenRefs: () => detectBrokenRefs(nexusDir),
    detectBrokenDirRefs: () => detectBrokenDirRefs(nexusDir),
    detectNonBacktickFileRefs: () => detectNonBacktickFileRefs(nexusDir),
    detectMissingGitignore: () => detectMissingGitignore(nexusDir),
    detectMaturityInconsistency: () => detectMaturityInconsistency(nexusDir),
    detectAdrCoverage: () => detectAdrCoverage(nexusDir),
    detectMissingPackageJson: () => detectMissingPackageJson(nexusDir),
    detectUnreferencedDirs: () => detectUnreferencedDirs(nexusDir),
    detectReportNaming: () => detectReportNaming(nexusDir),
    detectBareWordRefs: () => detectBareWordRefs(nexusDir),
    detectTemplateDirRefs: () => detectTemplateDirRefs(nexusDir),
    detectExtensionMismatch: () => detectExtensionMismatch(nexusDir),
    detectSystemMapMismatch: () => detectSystemMapMismatch(nexusDir),
    detectBrokenCommands: () => detectBrokenCommands(nexusDir),
    detectP0Inconsistency: () => detectP0Inconsistency(nexusDir),
    // Full-level detectors
    detectTripleMaturityScore: () => detectTripleMaturityScore(nexusDir),
    detectEmptyStack: () => detectEmptyStack(nexusDir),
    detectScriptWiring: () => detectScriptWiring(projectRoot, nexusDir),
    detectAgentContractRefs: () => detectAgentContractRefs(nexusDir),
    detectBufferSchemaMismatch: () => detectBufferSchemaMismatch(nexusDir),
    detectRuleTypo: () => detectRuleTypo(nexusDir),
    detectNumberingGap: () => detectNumberingGap(nexusDir),
    detectDocCountMismatch: () => detectDocCountMismatch(nexusDir),
    detectCrossDocP0Contradiction: () => detectCrossDocP0Contradiction(nexusDir),
    detectEmptyDataFiles: () => detectEmptyDataFiles(nexusDir),
    detectPhantomRuleRefs: () => detectPhantomRuleRefs(nexusDir),
    // Engineering audit detectors (Dimensions 1-7) — use shared sourceFiles
    detectOrphanModules: () => detectOrphanModules(projectRoot, sourceFiles),
    detectComplexityHotspots: () => detectComplexityHotspots(projectRoot, sourceFiles),
    detectTestCoverageGaps: () => detectTestCoverageGaps(projectRoot, sourceFiles),
    detectConsoleUsage: () => detectConsoleUsage(projectRoot, sourceFiles),
    detectEmptyCatchBlocks: () => detectEmptyCatchBlocks(projectRoot, sourceFiles),
    detectHighComplexity: () => detectHighComplexity(projectRoot, sourceFiles),
    detectCircularDeps: () => detectCircularDeps(projectRoot, sourceFiles),
    detectUnusedExports: () => detectUnusedExports(projectRoot, sourceFiles),
    detectDeadCodePatterns: () => detectDeadCodePatterns(projectRoot, sourceFiles),
    detectTestHealth: () => detectTestHealth(projectRoot),
    detectLintIssues: () => detectLintIssues(projectRoot),
    detectTypeSafetyIssues: () => detectTypeSafetyIssues(projectRoot, sourceFiles),
    // Supply chain detectors
    detectUnpinnedVersions: () => detectUnpinnedVersions(projectRoot),
    detectMissingLockFile: () => detectMissingLockFile(projectRoot),
    detectLockFileDrift: () => detectLockFileDrift(projectRoot),
    detectPhantomDependencies: () => detectPhantomDependencies(projectRoot, sourceFiles),
    detectDeprecatedPackages: () => detectDeprecatedPackages(projectRoot),
    // Security pattern detectors (SEC-*)
    detectHardcodedSecrets: () => detectHardcodedSecrets(projectRoot, sourceFiles),
    detectSQLInjection: () => detectSQLInjection(projectRoot, sourceFiles),
    detectXSS: () => detectXSS(projectRoot, sourceFiles),
    detectUnsafeEval: () => detectUnsafeEval(projectRoot, sourceFiles),
    detectConsoleSecrets: () => detectConsoleSecrets(projectRoot, sourceFiles),
    detectWeakCrypto: () => detectWeakCrypto(projectRoot, sourceFiles),
    detectInsecureHTTP: () => detectInsecureHTTP(projectRoot, sourceFiles),
    detectPrototypePollution: () => detectPrototypePollution(projectRoot, sourceFiles),
    detectPathTraversal: () => detectPathTraversal(projectRoot, sourceFiles),
    detectRegexDos: () => detectRegexDos(projectRoot, sourceFiles),
    detectUnsafeDeserialization: () => detectUnsafeDeserialization(projectRoot, sourceFiles),
    detectDependencyConfusion: () => detectDependencyConfusion(projectRoot, sourceFiles),
    // Taint analysis detector
    detectTaintFlow: () => {
      try {
        const analyzer = new TaintAnalyzer({ projectRoot });
        const taintIssues = analyzer.analyze();
        return taintIssues.map((ti: TaintIssue) => ({
          type: ("tainted_input" as const),
          severity: ti.severity,
          description: ti.description,
          location: ti.location,
          recommendation: ti.recommendation,
        }));
      } catch {
        return [] as HealthIssue[];
      }
    },
  };

  const issues: HealthIssue[] = [];
  for (const [name, fn] of Object.entries(detectorMap)) {
    if (activeDetectors.has(name)) {
      issues.push(...fn());
    }
  }

  const deduped = deduplicateIssues(issues);
  const healthScore = calculateHealthScore(deduped, sourceFiles.length);
  const optimizations = proposeOptimizations(deduped);

  const critical = deduped.filter((i) => i.severity === 3).length;
  const warnings = deduped.filter((i) => i.severity === 2).length;
  const info = deduped.filter((i) => i.severity === 1).length;

  const parts: string[] = [];
  parts.push(`Score de saúde: ${healthScore}/100`);
  parts.push(`Nível: ${level} (${activeDetectors.size} detectors).`);
  parts.push(`${rules.length} regras, ${history.length} sessões analisadas.`);
  if (critical > 0) parts.push(`${critical} crítico(s).`);
  if (warnings > 0) parts.push(`${warnings} aviso(s).`);
  if (info > 0) parts.push(`${info} info.`);
  if (optimizations.length > 0) parts.push(`${optimizations.length} optimização(ões) proposta(s).`);

  return {
    auditedAt: new Date().toISOString(),
    totalRules: rules.length,
    historyEntries: history.length,
    sessionsAnalyzed: history.length,
    issues: deduped,
    optimizations,
    healthScore,
    summary: parts.join(" "),
    level,
  };
}

// ── Report Writer ────────────────────────────────────────────────────────────

/**
 * Grava relatório de saúde em nexus-system/reports/.
 *
 * @param nexusDir - Directorio do nexus-system
 * @param report - Relatório de auditoria de saúde
 * @returns Nome do ficheiro criado ou null se reports/ não existir
 */
export function writeHealthReport(nexusDir: string, report: HealthAuditReport): string | null {
  const reportsDir = join(nexusDir, "reports");
  if (!existsSync(reportsDir)) return null;

  const date = new Date().toISOString().slice(0, 10);
  const filename = `health-${date}.json`;
  const filepath = join(reportsDir, filename);

  try {
    writeFileSync(filepath, JSON.stringify(report, null, 2), "utf-8");
    return filename;
  } catch {
    return null;
  }
}
