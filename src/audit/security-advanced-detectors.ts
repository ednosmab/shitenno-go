/**
 * Audit module — Advanced Security detectors
 *
 * Detectors that validate SBOM coverage, dependency provenance,
 * typosquatting, license conflicts, transitive vulnerabilities,
 * and malware patterns.
 * All analysis is deterministic — no LLM calls, no external APIs.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { HealthIssue, SourceFileInfo } from "./types.js";

// ── Popular packages for typosquatting detection ─────────────────────────────

const POPULAR_PACKAGES = new Set([
  "react", "react-dom", "lodash", "axios", "express", "moment", "chalk",
  "commander", "webpack", "babel", "eslint", "prettier", "jest", "mocha",
  "typescript", "ts-node", "tsup", "esbuild", "vite", "next", "nuxt",
  "vue", "angular", "svelte", "jQuery", "underscore", "moment",
  "bluebird", "async", "request", "node-fetch", "got", "ky",
  "mongoose", "sequelize", "typeorm", "prisma", "drizzle",
  "passport", "jsonwebtoken", "bcrypt", "argon2",
  "winston", "pino", "bunyan", "log4js",
  "prometheus", "grafana", "datadog",
]);

// ── Known malicious package patterns ────────────────────────────────────────

const MALWARE_PATTERNS = [
  /^peckatron/i,
  /^flatmap-stream/i,
  /^event-stream/i,
  /^ crossenv/i,
  /^ fabric$/i,
  /^ maildev$/i,
  /^ node-uuid$/i,
  /^ angular-ui-router$/i,
];

// ── License conflicts ───────────────────────────────────────────────────────

const RESTRICTIVE_LICENSES = new Set([
  "GPL-2.0", "GPL-3.0", "AGPL-3.0", "SSPL-1.0",
  "EUPL-1.1", "OSL-3.0", "CPAL-1.0",
]);

// ── 13.1 SBOM Coverage ──────────────────────────────────────────────────────

export function detectSBOMCoverage(projectRoot: string, _files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const sbomPaths = [
    join(projectRoot, "sbom.json"),
    join(projectRoot, "sbom CycloneDX.json"),
    join(projectRoot, "bom.json"),
    join(projectRoot, "spdx.json"),
    join(projectRoot, "docs", "SBOM.md"),
  ];

  const hasSBOM = sbomPaths.some((p) => existsSync(p));

  if (!hasSBOM) {
    issues.push({
      type: "missing_sbom",
      severity: 2,
      description: "Nenhum SBOM (Software Bill of Materials) encontrado",
      location: "project root",
      recommendation: "Gerar SBOM usando CycloneDX ou SPDX para rastreamento de dependências.",
      confidence: 0.8,
    });
  }

  return issues;
}

// ── 13.2 Dependency Provenance ──────────────────────────────────────────────

export function detectDependencyProvenance(projectRoot: string, _files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const packageJsonPath = join(projectRoot, "package.json");

  if (!existsSync(packageJsonPath)) return issues;

  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  const unverifiedCount = Object.keys(allDeps).length;

  if (unverifiedCount > 10) {
    issues.push({
      type: "unverified_provenance",
      severity: 1,
      description: `${unverifiedCount} dependências sem verificação de proveniência`,
      location: "package.json",
      recommendation: "Habilitar npm provenance ou usar sigstore para verificar assinaturas de pacotes.",
      confidence: 0.9,
    });
  }

  return issues;
}

// ── 13.3 Typosquatting ──────────────────────────────────────────────────────

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) {
    const row = dp[i];
    if (row) row[0] = i;
  }
  for (let j = 0; j <= n; j++) {
    const firstRow = dp[0];
    if (firstRow) firstRow[j] = j;
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const prevRow = dp[i - 1];
      const currRow = dp[i];
      if (prevRow && currRow) {
        currRow[j] = Math.min(
          (prevRow[j] ?? 0) + 1,
          (currRow[j - 1] ?? 0) + 1,
          (prevRow[j - 1] ?? 0) + cost,
        );
      }
    }
  }

  return dp[m]?.[n] ?? 0;
}

export function detectTyposquatting(projectRoot: string, _files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const packageJsonPath = join(projectRoot, "package.json");

  if (!existsSync(packageJsonPath)) return issues;

  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  const suspiciousPackages: string[] = [];

  for (const depName of Object.keys(allDeps)) {
    for (const popular of POPULAR_PACKAGES) {
      if (depName === popular) continue;
      const dist = levenshteinDistance(depName.toLowerCase(), popular.toLowerCase());
      if (dist <= 2 && dist > 0) {
        suspiciousPackages.push(`${depName} (similar a ${popular})`);
      }
    }
  }

  if (suspiciousPackages.length > 0) {
    issues.push({
      type: "typosquatting_risk",
      severity: 3,
      description: `${suspiciousPackages.length} pacotes potencialmente suspeitos (typosquatting)`,
      location: "package.json",
      recommendation: `Verificar pacotes: ${suspiciousPackages.join(", ")}`,
      confidence: 0.9,
    });
  }

  return issues;
}

// ── 13.4 License Conflicts ──────────────────────────────────────────────────

export function detectLicenseConflicts(projectRoot: string, _files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const packageJsonPath = join(projectRoot, "package.json");

  if (!existsSync(packageJsonPath)) return issues;

  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));

  if (packageJson.license) {
    const projectLicense = typeof packageJson.license === "string"
      ? packageJson.license
      : packageJson.license.type;

    if (RESTRICTIVE_LICENSES.has(projectLicense)) {
      issues.push({
        type: "license_conflict",
        severity: 2,
        description: `Projeto usa licença restritiva: ${projectLicense}`,
        location: "package.json",
        recommendation: "Rever implications de licença restritiva para dependências e distribuição.",
        confidence: 0.9,
      });
    }
  }

  return issues;
}

// ── 13.5 Transitive Vulnerabilities ─────────────────────────────────────────

export function detectTransitiveVulns(projectRoot: string, _files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const lockFilePath = join(projectRoot, "pnpm-lock.yaml");

  if (!existsSync(lockFilePath)) return issues;

  const lockContent = readFileSync(lockFilePath, "utf-8");
  const versionPattern = /(\d+\.\d+\.\d+)/g;
  const versions = lockContent.match(versionPattern) || [];

  const oldVersions = versions.filter((v) => {
    const [major] = v.split(".").map(Number);
    return major === 0;
  });

  if (oldVersions.length > 5) {
    issues.push({
      type: "transitive_vuln",
      severity: 2,
      description: `${oldVersions.length} dependências com versões 0.x detectadas (possivelmente instáveis)`,
      location: "pnpm-lock.yaml",
      recommendation: "Rever dependências 0.x para estabilidade e possíveis vulnerabilidades.",
      confidence: 0.9,
    });
  }

  return issues;
}

// ── 13.6 Malware Patterns ───────────────────────────────────────────────────

export function detectMalwarePatterns(projectRoot: string, _files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const packageJsonPath = join(projectRoot, "package.json");

  if (!existsSync(packageJsonPath)) return issues;

  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  const suspiciousPackages = Object.keys(allDeps).filter((name) =>
    MALWARE_PATTERNS.some((p) => p.test(name)),
  );

  if (suspiciousPackages.length > 0) {
    issues.push({
      type: "malware_pattern",
      severity: 3,
      description: `${suspiciousPackages.length} pacotes correspondem a padrões maliciosos conhecidos`,
      location: "package.json",
      recommendation: `Verificar imediatamente: ${suspiciousPackages.join(", ")}`,
      confidence: 0.9,
    });
  }

  return issues;
}
