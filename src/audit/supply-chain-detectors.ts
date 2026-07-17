/**
 * Audit module — Supply Chain detectors
 *
 * Detectors that validate SBOM existence, dependency freshness,
 * unused dependencies, lock file integrity, and audit status.
 * All analysis is deterministic — no LLM calls, no external APIs.
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { HealthIssue, SourceFileInfo } from "./types.js";

// ── 13.1 SBOM Exists ────────────────────────────────────────────────────────

export function detectSBOMExists(projectRoot: string, _files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const sbomPaths = [
    join(projectRoot, "sbom.json"),
    join(projectRoot, "bom.json"),
    join(projectRoot, "spdx.json"),
    join(projectRoot, "cyclonedx.json"),
    join(projectRoot, "docs", "sbom.json"),
  ];

  const hasSBOM = sbomPaths.some((p) => existsSync(p));

  if (!hasSBOM) {
    issues.push({
      type: "missing_sbom",
      severity: 2,
      description: "Nenhum SBOM (Software Bill of Materials) encontrado",
      location: "project root",
      recommendation: "Gerar SBOM usando CycloneDX ou SPDX para compliance e segurança.",
      confidence: 0.95,
    });
  }

  return issues;
}

// ── 13.2 SBOM Completeness ──────────────────────────────────────────────────

export function detectSBOMCompleteness(projectRoot: string, _files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const packageJsonPath = join(projectRoot, "package.json");
  const sbomPath = join(projectRoot, "sbom.json");

  if (!existsSync(packageJsonPath) || !existsSync(sbomPath)) return issues;

  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
  const sbom = JSON.parse(readFileSync(sbomPath, "utf-8"));

  const packageDeps = Object.keys(packageJson.dependencies || {});
  const sbomComponents = (sbom.components || []).map((c: { name: string }) => c.name);

  const missingInSBOM = packageDeps.filter((dep) => !sbomComponents.includes(dep));

  if (missingInSBOM.length > 0) {
    issues.push({
      type: "incomplete_sbom",
      severity: 2,
      description: `SBOM incompleto: ${missingInSBOM.length} dependências não listadas`,
      location: "sbom.json",
      recommendation: `Adicionar ao SBOM: ${missingInSBOM.slice(0, 5).join(", ")}`,
      confidence: 0.9,
    });
  }

  return issues;
}

// ── 13.3 Outdated Dependencies ──────────────────────────────────────────────

export function detectOutdatedDeps(projectRoot: string, _files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const packageJsonPath = join(projectRoot, "package.json");

  if (!existsSync(packageJsonPath)) return issues;

  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  const depsWithRanges = Object.entries(allDeps).filter(([, version]) =>
    typeof version === "string" && (version.includes("^") || version.includes("~")),
  );

  if (depsWithRanges.length > 10) {
    issues.push({
      type: "outdated_dependencies",
      severity: 1,
      description: `${depsWithRanges.length} dependências com versões range (não fixas)`,
      location: "package.json",
      recommendation: "Considerar fixar versões para reprodutibilidade, ou usar lock file confiável.",
      confidence: 0.9,
    });
  }

  return issues;
}

// ── 13.4 Unused Dependencies ────────────────────────────────────────────────

export function detectUnusedDeps(projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const packageJsonPath = join(projectRoot, "package.json");

  if (!existsSync(packageJsonPath)) return issues;

  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
  const deps = Object.keys(packageJson.dependencies || {});

  const unusedDeps: string[] = [];

  for (const dep of deps) {
    const importPatterns = [
      new RegExp(`from ['"]${dep}['"]`, "i"),
      new RegExp(`require\\(['"]${dep}['"]\\)`, "i"),
      new RegExp(`import ['"]${dep}['"]`, "i"),
    ];

    const isUsed = files.some((f) =>
      importPatterns.some((p) => p.test(f.content)),
    );

    if (!isUsed) {
      unusedDeps.push(dep);
    }
  }

  if (unusedDeps.length > 0) {
    issues.push({
      type: "unused_dependencies",
      severity: 1,
      description: `${unusedDeps.length} dependências não utilizadas detectadas`,
      location: "package.json",
      recommendation: `Remover dependências não usadas: ${unusedDeps.slice(0, 5).join(", ")}`,
      confidence: 0.75,
    });
  }

  return issues;
}

// ── 13.6 Lock File Sync ─────────────────────────────────────────────────────

export function detectLockFileSync(projectRoot: string, _files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const packageJsonPath = join(projectRoot, "package.json");
  const lockFilePath = join(projectRoot, "pnpm-lock.yaml");

  if (!existsSync(packageJsonPath) || !existsSync(lockFilePath)) return issues;

  const packageJsonStat = statSync(packageJsonPath);
  const lockFileStat = statSync(lockFilePath);

  if (packageJsonStat.mtime > lockFileStat.mtime) {
    issues.push({
      type: "lock_file_drift",
      severity: 2,
      description: "pnpm-lock.yaml está desatualizado em relação ao package.json",
      location: "pnpm-lock.yaml",
      recommendation: "Executar pnpm install para sincronizar lock file.",
      confidence: 0.95,
    });
  }

  return issues;
}

// ── 13.7 Duplicate Dependencies ─────────────────────────────────────────────

export function detectDuplicateDeps(projectRoot: string, _files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const packageJsonPath = join(projectRoot, "package.json");

  if (!existsSync(packageJsonPath)) return issues;

  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
  const deps = Object.keys(packageJson.dependencies || {});
  const devDeps = Object.keys(packageJson.devDependencies || {});

  const duplicates = deps.filter((dep) => devDeps.includes(dep));

  if (duplicates.length > 0) {
    issues.push({
      type: "duplicate_dependencies",
      severity: 1,
      description: `${duplicates.length} dependências duplicadas em dependencies e devDependencies`,
      location: "package.json",
      recommendation: `Remover de devDependencies: ${duplicates.join(", ")}`,
      confidence: 0.9,
    });
  }

  return issues;
}

// ── 13.8 Dep Audit Status ───────────────────────────────────────────────────

export function detectDepAuditStatus(projectRoot: string, _files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const auditPaths = [
    join(projectRoot, "audit.json"),
    join(projectRoot, ".npm-audit.json"),
    join(projectRoot, "docs", "AUDIT.md"),
  ];

  const hasAudit = auditPaths.some((p) => existsSync(p));

  if (!hasAudit) {
    issues.push({
      type: "unaudited_dependencies",
      severity: 1,
      description: "Nenhum relatório de auditoria de dependências encontrado",
      location: "project root",
      recommendation: "Executar pnpm audit e salvar resultado para rastreabilidade.",
      confidence: 0.95,
    });
  }

  return issues;
}
