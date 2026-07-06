/**
 * Audit module — Governance detectors
 *
 * All governance-related health issue detectors.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { logger } from "../logger.js";
import { VIOLATION_KEYWORDS, PLACEHOLDER_NAMES } from "./constants.js";
import type { HealthIssue, HistoryEntry } from "./types.js";

function detectDeadRules(rules: string[], history: HistoryEntry[]): HealthIssue[] {
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

function detectReportNaming(nexusDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const reportsDir = join(nexusDir, "reports");
  if (!existsSync(reportsDir)) return issues;

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

function detectTemplateDirRefs(nexusDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const docsToScan = [
    "docs/AGENTS.md",
    "docs/capabilities.md",
    "cognition/context/CONTEXT_HIERARCHY.md",
  ];
  const templateRefRegex = /`([^`\n]*<[^`\n>]+>[^`\n]*)`/g;
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
          if (branchConventions.has(dirPart)) continue;
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
        recommendation: 'Actualizar stack para ["typescript"] ou re-executar fingerprint',
      });
    }
  } catch { /* skip */ }
  return issues;
}

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

function detectNumberingGap(nexusDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];

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

function detectDocCountMismatch(nexusDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const guidePath = join(nexusDir, "docs/Nexus-System_GUIDE.md");
  if (!existsSync(guidePath)) return issues;

  try {
    const content = readFileSync(guidePath, "utf-8");

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

// ── Export all governance detectors ───────────────────────────────────────────

export {
  detectDeadRules,
  detectViolationHotspots,
  detectMissingDocs,
  detectOrphanDirs,
  detectStaleBuffer,
  detectDatePlaceholders,
  detectEmptyDirs,
  detectBrokenRefs,
  detectBrokenDirRefs,
  detectNonBacktickFileRefs,
  detectMissingGitignore,
  detectMissingPackageJson,
  detectMaturityInconsistency,
  detectAdrCoverage,
  detectUnreferencedDirs,
  detectReportNaming,
  detectBareWordRefs,
  detectTemplateDirRefs,
  detectExtensionMismatch,
  detectSystemMapMismatch,
  detectBrokenCommands,
  detectP0Inconsistency,
  detectTripleMaturityScore,
  detectEmptyStack,
  detectScriptWiring,
  detectAgentContractRefs,
  detectBufferSchemaMismatch,
  detectRuleTypo,
  detectNumberingGap,
  detectPhantomRuleRefs,
  detectDocCountMismatch,
  detectCrossDocP0Contradiction,
  detectEmptyDataFiles,
};
