/**
 * Audit module — Architecture Validation detectors
 *
 * Detectors that validate Clean Architecture layers, SRP violations,
 * dependency inversion, and module coupling.
 */

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../logger.js";
import type { HealthIssue, SourceFileInfo } from "./types.js";

// ── 4.1 Clean Architecture Layers ───────────────────────────────────────────

export function detectCleanArchitectureLayers(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];

  const commandsDir = "src/commands/";
  const domainPatterns = [/repository/i, /service/i, /usecase/i, /interactor/i, /entity/i, /valueobject/i];

  for (const file of files) {
    if (!file.relPath.startsWith(commandsDir)) continue;

    for (const pattern of domainPatterns) {
      if (pattern.test(file.basename)) {
        issues.push({
          type: "layer_violation",
          severity: 2,
          description: `Lógica de domínio "${file.basename}" em commands/ — deve ficar em domain/ ou infrastructure/`,
          location: file.relPath,
          recommendation: "Mover lógica de domínio para camada separada (Clean Architecture).",
          confidence: 0.65,
        });
        break;
      }
    }
  }

  return issues;
}

// ── 4.2 SRP Violations (God Modules) ────────────────────────────────────────

export function detectSRPViolations(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const skipPatterns = [/\.test\.ts$/, /\.spec\.ts$/, /__tests__/];

  for (const file of files) {
    if (skipPatterns.some((p) => p.test(file.relPath))) continue;

    const lines = file.content.split("\n");
    const exportedFunctions = new Set<string>();
    const exportRegex = /^export\s+(?:async\s+)?function\s+(\w+)/gm;
    const funcRegex = /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/gm;

    for (const line of lines) {
      const match = exportRegex.exec(line);
      if (match?.[1]) exportedFunctions.add(match[1]);
      exportRegex.lastIndex = 0;
    }

    const allFunctions = new Set<string>();
    for (const line of lines) {
      const match = funcRegex.exec(line);
      if (match?.[1]) allFunctions.add(match[1]);
      funcRegex.lastIndex = 0;
    }

    const funcCount = Math.max(exportedFunctions.size, allFunctions.size);

    const uniqueResponsibilities = new Set<string>();
    for (const fn of allFunctions) {
      const prefix = fn.replace(/[A-Z].*$/, "").toLowerCase();
      uniqueResponsibilities.add(prefix);
    }

    const importCount = (file.content.match(/from\s+["']\.\.?\//g) ?? []).length;

    const isOversized = file.lineCount > 500;
    const hasTooManyExports = funcCount > 8;
    const hasHighCoupling = importCount > 20;
    const hasManyResponsibilities = uniqueResponsibilities.size > 3;

    if (isOversized || hasTooManyExports || (hasHighCoupling && hasManyResponsibilities)) {
      const severity = file.lineCount > 1000 || funcCount > 15 ? 2 : 1;
      const parts: string[] = [];
      if (isOversized) parts.push(`${file.lineCount} linhas`);
      if (hasTooManyExports) parts.push(`${funcCount} funções`);
      if (hasHighCoupling) parts.push(`${importCount} imports relativos`);
      if (hasManyResponsibilities) parts.push(`${uniqueResponsibilities.size} responsabilidades`);

      issues.push({
        type: "srp_violation",
        severity,
        description: `"${file.basename}" — ${parts.join(", ")} — módulo multifuncional`,
        location: file.relPath,
        recommendation: "Dividir módulo em módulos menores com responsabilidade única.",
        confidence: 0.65,
        skillRef: "solid-principles",
      });
    }
  }

  return issues;
}

// ── 4.3 Dependency Inversion Violations ─────────────────────────────────────

export function detectDependencyInversion(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const skipPatterns = [/\.test\.ts$/, /\.spec\.ts$/, /__tests__/];

  for (const file of files) {
    if (skipPatterns.some((p) => p.test(file.relPath))) continue;
    if (file.relPath.startsWith("src/commands/")) continue;

    const lines = file.content.split("\n");
    let violations = 0;

    for (const line of lines) {
      if (line.trim().startsWith("//") || line.trim().startsWith("*")) continue;

      if (line.includes("import") && line.includes("from")) {
        const isInterface = /types|interfaces|contracts|\.d\.ts/.test(line);
        const isConcrete = /concrete|implementation|\.ts["']/.test(line) && !isInterface;

        if (isConcrete && line.includes("./") && !line.includes("node:")) {
          violations++;
        }
      }
    }

    if (violations > 3) {
      issues.push({
        type: "dip_violation",
        severity: 1,
        description: `"${file.basename}" tem ${violations} imports de implementações concretas — DIP violado`,
        location: file.relPath,
        recommendation: "Depender de abstrações (interfaces/types) em vez de implementações concretas.",
        confidence: 0.65,
      });
    }
  }

  return issues;
}

// ── 4.4 Barrel File Cycles ──────────────────────────────────────────────────

export function detectBarrelFileCycles(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const indexFiles = files.filter((f) => f.basename === "index");

  for (const indexFile of indexFiles) {
    const reExportRegex = /export\s+\*\s+from\s+["']([^"']+)["']/g;
    let match;
    const exports: string[] = [];

    while ((match = reExportRegex.exec(indexFile.content)) !== null) {
      if (match[1]) exports.push(match[1]);
    }

    if (exports.length > 5) {
      const reExportsFromSameDir = exports.filter((e) => e.startsWith("./"));
      if (reExportsFromSameDir.length > 3) {
        issues.push({
          type: "barrel_file_bloat",
          severity: 1,
          description: `Barrel file "${indexFile.relPath}" re-exporta ${reExportsFromSameDir.length} módulos — potencial cycle risk`,
          location: indexFile.relPath,
          recommendation: "Limitar barrel files a <5 exports. Usar imports directos quando possível.",
          confidence: 0.65,
        });
      }
    }
  }

  return issues;
}

// ── 4.5 Module Coupling Score ───────────────────────────────────────────────

export function detectModuleCoupling(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const skipPatterns = [/\.test\.ts$/, /\.spec\.ts$/, /__tests__/];

  const importRegex = /import\s+.*?\s+from\s+["'](\.[^"']+)["']/g;

  const coupling = new Map<string, { afferent: Set<string>; efferent: Set<string> }>();
  const MAX_FILES = 200;

  for (const file of files) {
    if (coupling.size > MAX_FILES) break;
    if (skipPatterns.some((p) => p.test(file.relPath))) continue;

    const fileKey = file.basename;
    if (!coupling.has(fileKey)) {
      coupling.set(fileKey, { afferent: new Set(), efferent: new Set() });
    }

    let match;
    importRegex.lastIndex = 0;
    while ((match = importRegex.exec(file.content)) !== null) {
      const dep = match[1]?.split("/").pop()?.replace(/\.js$/, "") ?? "";
      if (dep && dep !== fileKey) {
        coupling.get(fileKey)!.efferent.add(dep);
        if (!coupling.has(dep)) {
          coupling.set(dep, { afferent: new Set(), efferent: new Set() });
        }
        coupling.get(dep)!.afferent.add(fileKey);
      }
    }
  }

  const hubs: { name: string; connections: number }[] = [];
  for (const [name, { afferent, efferent }] of coupling) {
    const total = afferent.size + efferent.size;
    if (total > 15) {
      hubs.push({ name, connections: total });
    }
  }

  hubs.sort((a, b) => b.connections - a.connections);

  if (hubs.length > 0) {
    const hubList = hubs.slice(0, 5).map((h) => `${h.name} (${h.connections} conexões)`).join(", ");
    issues.push({
      type: "high_coupling",
      severity: 2,
      description: `${hubs.length} módulo(s) com acoplamento elevado: ${hubList}`,
      location: "src/",
      recommendation: "Reduzir acoplamento: extrair interfaces, usar DI, limitar imports a ≤5 por módulo.",
      confidence: 0.65,
    });
  }

  return issues;
}

// ── 4.6 Import Consistency ──────────────────────────────────────────────────

export function detectImportConsistency(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const skipPatterns = [/\.test\.ts$/, /\.spec\.ts$/, /__tests__/];

  for (const file of files) {
    if (skipPatterns.some((p) => p.test(file.relPath))) continue;

    const lines = file.content.split("\n");
    let lastBuiltIn = -1;
    let lastExternal = -1;
    let lastInternal = -1;
    let violations = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (!line.includes("import") || !line.includes("from")) continue;

      const isBuiltIn = line.includes("node:");
      const isExternal = !isBuiltIn && !line.includes("./") && !line.includes("../");

      if (isBuiltIn) {
        lastBuiltIn = i;
      } else if (isExternal) {
        lastExternal = i;
      } else {
        lastInternal = i;
      }

      if (lastInternal > 0 && (lastBuiltIn > lastInternal || lastExternal > lastInternal)) {
        violations++;
      }
    }

    if (violations > 2) {
      issues.push({
        type: "import_order_violation",
        severity: 1,
        description: `"${file.basename}" tem ${violations} imports fora da ordem conveniente (builtins → external → internal)`,
        location: file.relPath,
        recommendation: "Ordem: 1) node:* 2) packages externos 3) módulos internos (./).",
        confidence: 0.65,
      });
    }
  }

  return issues;
}

// ── 4.7 Test Structure Validation ───────────────────────────────────────────

export function detectTestStructure(projectRoot: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const testsDir = join(projectRoot, "src", "__tests__");
  if (!existsSync(testsDir)) return issues;

  try {
    const testFiles = readdirSync(testsDir).filter((f) => f.endsWith(".test.ts"));
    const srcDir = join(projectRoot, "src");
    const srcDirs = readdirSync(srcDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .filter((d) => d !== "__tests__" && d !== "templates");

    const flatTestCount = testFiles.filter((f) => {
      const baseName = f.replace(/\.test\.ts$/, "");
      return srcDirs.some((d) => existsSync(join(srcDir, d, `${baseName}.ts`)));
    }).length;

    if (flatTestCount > 10) {
      issues.push({
        type: "flat_test_structure",
        severity: 1,
        description: `${flatTestCount} test(es) em __tests__/ flat que testam módulos em subdirectorios — considerar espelhar estrutura`,
        location: "src/__tests__/",
        recommendation: "Reorganizar: src/__tests__/commands/, src/__tests__/audit/, etc.",
        confidence: 0.95,
      });
    }
  } catch {
    logger.debug("architecture", "Failed to scan test structure");
  }

  return issues;
}

// ── Export all architecture detectors ────────────────────────────────────────
