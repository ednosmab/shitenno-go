/**
 * Audit module — Governance rule detectors
 *
 * Rule-related and cross-document health issue detectors.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../logger.js";
import type { HealthIssue } from "./types.js";

export function detectScriptWiring(projectRoot: string, shitennoDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const pkgPath = join(projectRoot, "package.json");
  if (!existsSync(pkgPath)) return issues;

  let rootScripts: string[] = [];
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    rootScripts = Object.keys(pkg.scripts ?? {});
  } catch (err) { logger.debug("governance-detectors", "Error reading root package.json:", err); }

  const docsToScan = [
    "governance/WORKFLOW.md",
    "docs/AGENTS.md",
    "docs/session-template.md",
  ];
  const scriptRegex = /pnpm run ([a-zA-Z0-9:-]+)/g;
  const referenced = new Set<string>();

  for (const doc of docsToScan) {
    const path = join(shitennoDir, doc);
    if (!existsSync(path)) continue;
    try {
      const content = readFileSync(path, "utf-8");
      let match;
      while ((match = scriptRegex.exec(content)) !== null) {
        if (match[1]) referenced.add(match[1]);
      }
    } catch (err) { logger.debug("governance-detectors", "Error scanning doc scripts:", err); }
  }

  const missing = Array.from(referenced).filter((s) => !rootScripts.includes(s));
  if (missing.length > 0) {
    issues.push({
      type: "script_wiring",
      severity: 3,
      description: `${missing.length} script(s) referenciado(s) em docs não existem no root package.json: ${missing.join(", ")}`,
      location: "package.json",
      recommendation: `Adicionar scripts ao root package.json: ${missing.map((s) => `"${s}": "tsx shitenno/scripts/..."`).join(", ")}`,
      confidence: 0.9,
    });
  }
  return issues;
}

const TEMPLATE_PATTERNS = ["YYYY", "MM-DD", "<", "*", "[camada]"];
const SKIP_DIRS = ["governance/", "docs/", "shitenno/"];

function isTemplateRef(ref: string): boolean {
  return ref.includes("<") || ref.includes("YYYY") || ref.includes("*") || TEMPLATE_PATTERNS.some((p) => ref.includes(p));
}

function isSkippableDirRef(ref: string): boolean {
  return SKIP_DIRS.some((d) => ref.startsWith(d));
}

function checkFileRef(
  ref: string,
  file: string,
  shitennoDir: string,
  projectRoot: string,
): HealthIssue | null {
  if (!ref || isTemplateRef(ref)) return null;
  const refShitenno = join(shitennoDir, ref);
  const refRoot = join(projectRoot, ref);
  if (existsSync(refShitenno) || existsSync(refRoot)) return null;
  return {
    type: "agent_contract_ref",
    severity: 2,
    description: `Referência quebrada em "${file}": "${ref}" não existe`,
    location: `shitenno/governance/agents/${file}`,
    recommendation: `Corrigir referência "${ref}" em "${file}" ou criar o ficheiro`,
    confidence: 0.75,
  };
}

function checkDirRef(
  ref: string,
  file: string,
  shitennoDir: string,
  projectRoot: string,
): HealthIssue | null {
  if (!ref || isTemplateRef(ref) || isSkippableDirRef(ref)) return null;
  const refShitenno = join(shitennoDir, ref);
  const refRoot = join(projectRoot, ref);
  if (existsSync(refShitenno) || existsSync(refRoot)) return null;
  return {
    type: "agent_contract_ref",
    severity: 2,
    description: `Referência quebrada em "${file}": directório "${ref}" não existe`,
    location: `shitenno/governance/agents/${file}`,
    recommendation: `Criar directório "${ref}" ou corrigir referência em "${file}"`,
    confidence: 0.75,
  };
}

export function detectAgentContractRefs(shitennoDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const agentsDir = join(shitennoDir, "governance/agents");
  if (!existsSync(agentsDir)) return issues;

  const projectRoot = join(shitennoDir, "..");
  const files = readdirSync(agentsDir).filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));

  for (const file of files) {
    try {
      const content = readFileSync(join(agentsDir, file), "utf-8");

      const refRegex = /`([^`]+\.(?:md|yaml|json|ts|js))`/g;
      let match;
      while ((match = refRegex.exec(content)) !== null) {
        const issue = checkFileRef(match[1] ?? "", file, shitennoDir, projectRoot);
        if (issue) issues.push(issue);
      }

      const dirRefRegex = /\b([a-zA-Z0-9_/.-]+\/)\s*(?:\||$)/gm;
      let dirMatch;
      while ((dirMatch = dirRefRegex.exec(content)) !== null) {
        const issue = checkDirRef(dirMatch[1] ?? "", file, shitennoDir, projectRoot);
        if (issue) issues.push(issue);
      }
    } catch (err) { logger.debug("governance-detectors", "Error scanning agent contracts:", err); }
  }
  return issues;
}

export function detectBufferSchemaMismatch(shitennoDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const bufferPath = join(shitennoDir, "governance/context/context_buffer.yaml");
  const agentsPath = join(shitennoDir, "docs/AGENTS.md");
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
          location: "shitenno/governance/context/context_buffer.yaml",
          recommendation: `Adicionar secção "${section}" ao context_buffer.yaml`,
          confidence: 0.7,
        });
      }
    }
  } catch (err) { logger.debug("governance-detectors", "Error in detectBufferSchemaMismatch:", err); }
  return issues;
}

export function detectRuleTypo(shitennoDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const knownTypos: { pattern: RegExp; fix: string; file: string }[] = [
    { pattern: /REGRRA/, fix: "REGRA", file: "docs/AGENTS.md" },
    { pattern: /não-p laneado/, fix: "não-planeado", file: "docs/AGENTS.md" },
    { pattern: /\bejecutar\b/, fix: "executar", file: "docs/session-template.md" },
    { pattern: /\balterarhistóricos\b/, fix: "alterar históricos", file: "docs/session-template.md" },
  ];

  for (const typo of knownTypos) {
    const path = join(shitennoDir, typo.file);
    if (!existsSync(path)) continue;
    try {
      const content = readFileSync(path, "utf-8");
      if (typo.pattern.test(content)) {
        issues.push({
          type: "rule_typo",
          severity: 2,
          description: `Typo detectado em "${typo.file}": "${typo.pattern.source}" → "${typo.fix}"`,
          location: `shitenno/${typo.file}`,
          recommendation: `Corrigir "${typo.pattern.source}" para "${typo.fix}" em "${typo.file}"`,
          confidence: 0.65,
        });
      }
    } catch (err) { logger.debug("governance-detectors", "Error in detectRuleTypo:", err); }
  }
  return issues;
}

export function detectNumberingGap(shitennoDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];

  const foPath = join(shitennoDir, "docs/FORBIDDEN_OPERATIONS.md");
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
            location: "shitenno/docs/FORBIDDEN_OPERATIONS.md",
            recommendation: `Verificar se F-${uniqueF[i - 1]! + 1} foi removido ou renumerado`,
            confidence: 0.65,
          });
        }
      }
    } catch (err) { logger.debug("governance-detectors", "Error scanning FORBIDDEN_OPERATIONS:", err); }
  }

  return issues;
}

export function detectPhantomRuleRefs(shitennoDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];

  const foPath = join(shitennoDir, "docs/FORBIDDEN_OPERATIONS.md");
  const agentsPath = join(shitennoDir, "docs/AGENTS.md");
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
        confidence: 0.65,
      });
    }
  } catch (err) { logger.debug("governance-detectors", "Error in detectPhantomRuleRefs:", err); }

  return issues;
}

export function detectDocCountMismatch(shitennoDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const guidePath = join(shitennoDir, "docs/Shitenno_GUIDE.md");
  if (!existsSync(guidePath)) return issues;

  try {
    const content = readFileSync(guidePath, "utf-8");

    const reportMatch = content.match(/(\d+)\s+relat/);
    if (reportMatch) {
      const claimed = Number(reportMatch[1]);
      const reportsDir = join(shitennoDir, "reports");
      if (existsSync(reportsDir)) {
        const actual = readdirSync(reportsDir).filter((f) => f.endsWith(".json") && f.startsWith("complexity-")).length;
        if (actual !== claimed) {
          issues.push({
            type: "doc_count_mismatch",
            severity: 2,
            description: `GUIDE diz "${claimed} relatórios" mas existem ${actual} ficheiros complexity-*.json`,
            location: "shitenno/docs/Shitenno_GUIDE.md",
            recommendation: `Actualizar contagem de relatórios para ${actual}`,
            confidence: 0.75,
          });
        }
      }
    }

    const feedbackMatch = content.match(/(\d+)\s+registos\s+de\s+feedback/);
    if (feedbackMatch) {
      const claimed = Number(feedbackMatch[1]);
      const recordsDir = join(shitennoDir, "feedback/records");
      if (existsSync(recordsDir)) {
        const actual = readdirSync(recordsDir).filter((f) => f.endsWith(".json")).length;
        if (actual !== claimed) {
          issues.push({
            type: "doc_count_mismatch",
            severity: 2,
            description: `GUIDE diz "${claimed} registos de feedback" mas existem ${actual}`,
            location: "shitenno/docs/Shitenno_GUIDE.md",
            recommendation: `Actualizar contagem de registos para ${actual}`,
            confidence: 0.75,
          });
        }
      }
    }
  } catch (err) { logger.debug("governance-detectors", "Error in detectDocCountMismatch:", err); }
  return issues;
}

function extractP0Refs(content: string): Set<string> {
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
  return p0;
}

function compareP0Sets(
  fileA: string,
  p0A: Set<string>,
  fileB: string,
  p0B: Set<string>,
): HealthIssue | null {
  const onlyInA = [...p0A].filter((f) => !p0B.has(f));
  const onlyInB = [...p0B].filter((f) => !p0A.has(f));
  if (onlyInA.length === 0 && onlyInB.length === 0) return null;

  const parts: string[] = [];
  if (onlyInA.length > 0) parts.push(`${fileA} tem: ${onlyInA.join(", ")}`);
  if (onlyInB.length > 0) parts.push(`${fileB} tem: ${onlyInB.join(", ")}`);
  return {
    type: "cross_doc_p0_contradiction",
    severity: 2,
    description: `Hierarquia P0 inconsistente entre docs: ${parts.join("; ")}`,
    location: `shitenno/${fileA}`,
    recommendation: "Reconciliar listas P0 em todos os documentos",
    confidence: 0.65,
  };
}

export function detectCrossDocP0Contradiction(shitennoDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const files = [
    "governance/WORKFLOW.md",
    "cognition/context/CONTEXT_HIERARCHY.md",
    "docs/Shitenno_GUIDE.md",
  ];

  const p0Map = new Map<string, Set<string>>();
  for (const file of files) {
    const path = join(shitennoDir, file);
    if (!existsSync(path)) continue;
    try {
      const content = readFileSync(path, "utf-8");
      const p0 = extractP0Refs(content);
      if (p0.size > 0) p0Map.set(file, p0);
    } catch (err) { logger.debug("governance-detectors", "Error in detectCrossDocP0Contradiction:", err); }
  }

  const entries = Array.from(p0Map.entries());
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const entryA = entries[i];
      const entryB = entries[j];
      if (!entryA || !entryB) continue;
      const issue = compareP0Sets(entryA[0], entryA[1], entryB[0], entryB[1]);
      if (issue) issues.push(issue);
    }
  }
  return issues;
}

function scanFileForEmptyFiles(dir: string, files: string[], issues: HealthIssue[]): void {
  for (const file of files) {
    const filePath = join(dir, file);
    try {
      const stat = statSync(filePath);
      if (stat.isFile() && stat.size === 0) {
        issues.push({ type: "empty_data_file", severity: 1,
          description: `Ficheiro vazio (0 bytes): ${dir}/${file}`,
          location: `shitenno/${dir}/${file}`, recommendation: `Verificar se ${file} deveria ter conteúdo ou removê-lo`, confidence: 0.95 });
      }
    } catch (statErr) { logger.debug("governance-detectors", "Error checking file stat:", statErr); }
  }
}

function detectEmptyDataFilesInDir(dir: string, shitennoDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const dirPath = join(shitennoDir, dir);
  if (!existsSync(dirPath)) return issues;
  try { scanFileForEmptyFiles(dirPath, readdirSync(dirPath), issues); }
  catch (scanErr) { logger.debug("governance-detectors", "Error in detectEmptyDataFiles:", scanErr); }
  return issues;
}

export function detectEmptyDataFiles(shitennoDir: string): HealthIssue[] {
  const dirsToScan = ["telemetry", "reports", "docs/history", "governance/knowledge-graph"];
  return dirsToScan.flatMap((dir) => detectEmptyDataFilesInDir(dir, shitennoDir));
}


