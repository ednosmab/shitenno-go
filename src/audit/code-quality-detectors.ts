/**
 * Audit module — Code Quality Intelligence detectors
 *
 * Detectors that enforce code quality standards: JSDoc coverage,
 * unreachable code, magic numbers, deep nesting, duplicate code.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../logger.js";
import type { HealthIssue, SourceFileInfo } from "./types.js";

// ── 3.1 JSDoc Coverage ──────────────────────────────────────────────────────

export function detectJSDocCoverage(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];

  const exportRegex = /^export\s+(?:function|const|class|interface|type|enum)\s+(\w+)/gm;
  const jsdocBlockRegex = /\/\*\*[\s\S]*?\*\/\s*$/m;

  let totalExports = 0;
  let missingJSDoc = 0;
  const missingFiles: string[] = [];

  for (const file of files) {
    if (file.basename === "index") continue;
    if (file.fullPath.includes("/bin/")) continue;

    const lines = file.content.split("\n");
    let fileMissing = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const match = exportRegex.exec(line);
      if (match) {
        totalExports++;
        const prevLines = lines.slice(Math.max(0, i - 5), i).join("\n");
        if (!jsdocBlockRegex.test(prevLines)) {
          fileMissing++;
          missingJSDoc++;
        }
      }
      exportRegex.lastIndex = 0;
    }

    if (fileMissing > 0 && missingFiles.length < 5) {
      missingFiles.push(`${file.relPath} (${fileMissing} exports)`);
    }
  }

  if (missingJSDoc > 0 && totalExports > 0) {
    const pct = Math.round((1 - missingJSDoc / totalExports) * 100);
    issues.push({
      type: "missing_jsdoc",
      severity: missingJSDoc > 10 ? 2 : 1,
      description: `${missingJSDoc}/${totalExports} exports sem JSDoc (${pct}% cobertura) — DESDO §4 requer JSDoc em todas as funções exportadas`,
      location: missingFiles.join(", "),
      recommendation: "Adicionar JSDoc com @param e @returns em todas as funções exportadas.",
      confidence: 0.7,
    });
  }

  return issues;
}

// ── 3.2 Unsafe Type Assertions ──────────────────────────────────────────────

export function detectUnsafeTypeAssertions(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const skipPatterns = [/\.test\.ts$/, /\.spec\.ts$/, /__tests__/];

  let unsafeCount = 0;
  const unsafeFiles: string[] = [];

  const patterns = [
    { regex: /as\s+unknown\s+as/g, name: "as unknown as" },
    { regex: /@\s*ts-ignore/g, name: "@ts-ignore" },
    { regex: /@\s*ts-expect-error/g, name: "@ts-expect-error" },
    { regex: /as\s+any\b/g, name: "as any" },
  ];

  for (const file of files) {
    if (skipPatterns.some((p) => p.test(file.relPath))) continue;

    let fileCount = 0;
    for (const { regex } of patterns) {
      const matches = file.content.match(regex);
      if (matches) {
        fileCount += matches.length;
      }
    }

    if (fileCount > 0) {
      unsafeCount += fileCount;
      if (unsafeFiles.length < 5) {
        unsafeFiles.push(`${file.relPath} (${fileCount})`);
      }
    }
  }

  if (unsafeCount > 0) {
    issues.push({
      type: "unsafe_type_assertion",
      severity: unsafeCount > 20 ? 2 : 1,
      description: `${unsafeCount} afirmação(ões) de tipo insegura(s): ${unsafeFiles.join(", ")}`,
      location: "src/",
      recommendation: "Substituir 'as unknown as X' por type guards. Remover @ts-ignore e corrigir o problema de tipo.",
      confidence: 0.75,
    });
  }

  return issues;
}

// ── 3.3 Unreachable Code ────────────────────────────────────────────────────

export function detectUnreachableCode(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const skipPatterns = [/\.test\.ts$/, /\.spec\.ts$/, /__tests__/];

  let unreachableCount = 0;
  const unreachableLocations: string[] = [];

  for (const file of files) {
    if (skipPatterns.some((p) => p.test(file.relPath))) continue;

    const lines = file.content.split("\n");
    let afterReturn = false;
    let afterThrow = false;
    let afterBreak = false;
    let afterContinue = false;

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i]!.trim();

      if (trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) continue;

      if (afterReturn || afterThrow || afterBreak || afterContinue) {
        if (trimmed.length > 0 && !trimmed.startsWith("}") && !trimmed.startsWith("case ") && !trimmed.startsWith("default:") && !trimmed.startsWith("catch") && !trimmed.startsWith("finally")) {
          unreachableCount++;
          if (unreachableLocations.length < 5) {
            unreachableLocations.push(`${file.relPath}:${i + 1}`);
          }
          afterReturn = false;
          afterThrow = false;
          afterBreak = false;
          afterContinue = false;
        }
      }

      afterReturn = /^\s*(?:return\b|process\.exit\()/i.test(trimmed) && !trimmed.endsWith("{");
      afterThrow = /^\s*throw\b/i.test(trimmed) && !trimmed.endsWith("{");
      afterBreak = /^\s*break\b/i.test(trimmed);
      afterContinue = /^\s*continue\b/i.test(trimmed);
    }
  }

  if (unreachableCount > 0) {
    issues.push({
      type: "unreachable_code",
      severity: 2,
      description: `${unreachableCount} linha(s) inalcançável(s) detectada(s): ${unreachableLocations.join(", ")}`,
      location: unreachableLocations.join(", "),
      recommendation: "Remover código inalcançável após return/throw/break/continue.",
      confidence: 0.7,
    });
  }

  return issues;
}

// ── 3.4 Unused Imports ──────────────────────────────────────────────────────

export function detectUnusedImports(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const skipPatterns = [/\.test\.ts$/, /\.spec\.ts$/, /__tests__/];

  let unusedCount = 0;
  const unusedFiles: string[] = [];

  const importRegex = /import\s+(?:{[^}]+}|[\w*]+(?:\s*,\s*{[^}]+})?)\s+from\s+["']([^"']+)["']/g;

  for (const file of files) {
    if (skipPatterns.some((p) => p.test(file.relPath))) continue;

    let match;
    importRegex.lastIndex = 0;
    while ((match = importRegex.exec(file.content)) !== null) {
      const importClause = match[0];
      const importPath = match[1];
      if (!importPath?.startsWith(".")) continue;

      const namedImports = importClause.match(/{([^}]+)}/);
      if (!namedImports) continue;

      const importNames = namedImports[1]!.split(",").map((s) => {
        const parts = s.trim().split(/\s+as\s+/);
        return (parts.length > 1 ? parts[1] : parts[0])!.trim();
      });

      let fileUnused = 0;
      for (const name of importNames) {
        const wordBoundary = new RegExp(`\\b${name}\\b`);
        const restOfFile = file.content.slice(match.index! + importClause.length);
        if (!wordBoundary.test(restOfFile)) {
          fileUnused++;
        }
      }

      if (fileUnused > 0) {
        unusedCount += fileUnused;
        if (unusedFiles.length < 5) {
          unusedFiles.push(file.relPath);
        }
      }
    }
  }

  if (unusedCount > 0) {
    issues.push({
      type: "unused_import",
      severity: 1,
      description: `${unusedCount} import(s) não utilizado(s) em ${unusedFiles.join(", ")}`,
      location: unusedFiles.join(", "),
      recommendation: "Remover imports não utilizados para reduzir acoplamento e melhorar legibilidade.",
      confidence: 0.7,
    });
  }

  return issues;
}

// ── 3.5 Magic Numbers ───────────────────────────────────────────────────────

export function detectMagicNumbers(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const skipPatterns = [/\.test\.ts$/, /\.spec\.ts$/, /__tests__/, /constants\.ts$/];

  let magicCount = 0;
  const magicFiles: string[] = [];

  const magicRegex = /(?<!=\s*)(?<!\w)\b(\d{2,})\b(?!\s*[;:,}\]])/g;
  const allowedNumbers = new Set([0, 1, 2, 10, 100, 1000]);

  for (const file of files) {
    if (skipPatterns.some((p) => p.test(file.relPath))) continue;

    const lines = file.content.split("\n");
    let fileMagic = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (line.trim().startsWith("//") || line.trim().startsWith("*")) continue;

      let match;
      magicRegex.lastIndex = 0;
      while ((match = magicRegex.exec(line)) !== null) {
        const num = parseInt(match[1]!, 10);
        if (num > 10 && !allowedNumbers.has(num)) {
          fileMagic++;
        }
      }
    }

    if (fileMagic > 3) {
      magicCount += fileMagic;
      if (magicFiles.length < 5) {
        magicFiles.push(`${file.relPath} (${fileMagic})`);
      }
    }
  }

  if (magicCount > 0) {
    issues.push({
      type: "magic_numbers",
      severity: 1,
      description: `${magicCount} número(s) mágico(s) detectado(s) em ${magicFiles.join(", ")}`,
      location: magicFiles.join(", "),
      recommendation: "Extrair números para constantes nomeadas para melhorar legibilidade e manutenibilidade.",
      confidence: 0.6,
    });
  }

  return issues;
}

// ── 3.6 Long Parameters ────────────────────────────────────────────────────

export function detectLongParams(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const skipPatterns = [/\.test\.ts$/, /\.spec\.ts$/, /__tests__/];

  const longParamRegex = /(?:function\s+\w+|(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?(?:function|\())\s*\(([^)]{80,})\)/g;

  for (const file of files) {
    if (skipPatterns.some((p) => p.test(file.relPath))) continue;

    let match;
    longParamRegex.lastIndex = 0;
    while ((match = longParamRegex.exec(file.content)) !== null) {
      const lineNum = file.content.substring(0, match.index).split("\n").length;
      const paramCount = (match[1]!.match(/,/g) || []).length + 1;

      if (paramCount > 4) {
        issues.push({
          type: "long_params",
          severity: 1,
          description: `Função com ${paramCount} parâmetros em "${file.relPath}:${lineNum}" — Interface Segregation violada`,
          location: `${file.relPath}:${lineNum}`,
          recommendation: "Reduzir parâmetros para ≤4. Usar objeto de opções ou interface para parâmetros relacionados.",
          confidence: 0.75,
        });
      }
    }
  }

  return issues;
}

// ── 3.7 Deep Nesting ────────────────────────────────────────────────────────

export function detectDeepNesting(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const skipPatterns = [/\.test\.ts$/, /\.spec\.ts$/, /__tests__/];

  for (const file of files) {
    if (skipPatterns.some((p) => p.test(file.relPath))) continue;

    const lines = file.content.split("\n");
    let maxDepth = 0;
    let depth = 0;
    let deepLine = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      for (const ch of line) {
        if (ch === "{") {
          depth++;
          if (depth > maxDepth) {
            maxDepth = depth;
            deepLine = i + 1;
          }
        }
        if (ch === "}") depth--;
      }
    }

    if (maxDepth > 6) {
      issues.push({
        type: "deep_nesting",
        severity: maxDepth > 8 ? 2 : 1,
        description: `Aninhamento profundo em "${file.relPath}" — profundidade máxima ${maxDepth} (linha ${deepLine})`,
        location: `${file.relPath}:${deepLine}`,
        recommendation: "Extrair lógica aninhada para funções auxiliares. Usar early return para reduzir aninhamento.",
        confidence: 0.85,
      });
    }
  }

  return issues;
}

// ── 3.8 Duplicate Code Detection ────────────────────────────────────────────

export function detectDuplicateCode(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const skipPatterns = [/\.test\.ts$/, /\.spec\.ts$/, /__tests__/];

  const lineBuckets = new Map<string, { file: string; line: number }[]>();
  const MAX_BUCKETS = 5_000;

  for (const file of files) {
    if (lineBuckets.size > MAX_BUCKETS) break;
    if (skipPatterns.some((p) => p.test(file.relPath))) continue;

    const lines = file.content.split("\n");
    for (let i = 0; i < lines.length - 4; i++) {
      const block = lines.slice(i, i + 5).join("\n").trim();
      if (block.length < 50 || block.startsWith("//")) continue;

      const existing = lineBuckets.get(block);
      if (existing) {
        existing.push({ file: file.relPath, line: i + 1 });
      } else if (lineBuckets.size < MAX_BUCKETS) {
        lineBuckets.set(block, [{ file: file.relPath, line: i + 1 }]);
      }
    }
  }

  let duplicateBlocks = 0;
  const duplicateLocations: string[] = [];

  for (const [, locations] of lineBuckets) {
    if (locations.length > 1) {
      const uniqueFiles = new Set(locations.map((l) => l.file));
      if (uniqueFiles.size > 1) {
        duplicateBlocks++;
        if (duplicateLocations.length < 3) {
          duplicateLocations.push(locations.map((l) => `${l.file}:${l.line}`).join(" vs "));
        }
      }
    }
  }

  if (duplicateBlocks > 0) {
    issues.push({
      type: "duplicate_code",
      severity: duplicateBlocks > 5 ? 2 : 1,
      description: `${duplicateBlocks} bloco(s) de código duplicado(s) entre módulos`,
      location: duplicateLocations.join("; "),
      recommendation: "Extrair código duplicado para função partilhada (princípio DRY).",
      confidence: 0.65,
    });
  }

  return issues;
}

// ── 3.9 God Functions (>80 lines) ───────────────────────────────────────────

export function detectGodFunctions(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const skipPatterns = [/\.test\.ts$/, /\.spec\.ts$/, /__tests__/];

  const funcStartRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)|(?:const|let)\s+(\w+)\s*=\s*(?:async\s+)?\(/;

  for (const file of files) {
    if (skipPatterns.some((p) => p.test(file.relPath))) continue;

    const lines = file.content.split("\n");
    let braceDepth = 0;
    let funcStart = -1;
    let funcName = "";
    let inFunction = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const trimmed = line.trim();

      if (trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) continue;

      if (!inFunction) {
        const match = line.match(funcStartRegex);
        if (match) {
          funcName = match[1] ?? match[2] ?? "anonymous";
          funcStart = i;
          inFunction = true;
        }
      }

      for (const ch of line) {
        if (ch === "{") braceDepth++;
        if (ch === "}") braceDepth--;
      }

      if (inFunction && braceDepth <= 0) {
        inFunction = false;
        const funcLines = i - funcStart + 1;
        if (funcLines > 80) {
          issues.push({
            type: "god_function",
            severity: funcLines > 150 ? 2 : 1,
            description: `Função "${funcName}" em "${file.relPath}:${funcStart + 1}" tem ${funcLines} linhas — considerar dividir`,
            location: `${file.relPath}:${funcStart + 1}`,
            recommendation: `Dividir "${funcName}" em funções menores (<80 linhas cada).`,
            confidence: 0.7,
          });
        }
        funcName = "";
        funcStart = -1;
      }
    }
  }

  return issues;
}

// ── 3.10 Coverage Threshold Check ───────────────────────────────────────────

export function detectCoverageThreshold(projectRoot: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const vitestPath = join(projectRoot, "vitest.config.ts");
  if (!existsSync(vitestPath)) return issues;

  try {
    const content = readFileSync(vitestPath, "utf-8");
    const linesMatch = content.match(/lines:\s*(\d+)/);
    const functionsMatch = content.match(/functions:\s*(\d+)/);

    if (linesMatch) {
      const linesThreshold = parseInt(linesMatch[1]!, 10);
      if (linesThreshold < 70) {
        issues.push({
          type: "low_coverage_threshold",
          severity: 2,
          description: `Threshold de coverage de linhas em ${linesThreshold}% — mínimo recomendado: 70%`,
          location: "vitest.config.ts",
          recommendation: "Aumentar threshold para ≥70% para garantir cobertura mínima.",
          confidence: 0.85,
        });
      }
    }

    if (functionsMatch) {
      const functionsThreshold = parseInt(functionsMatch[1]!, 10);
      if (functionsThreshold < 80) {
        issues.push({
          type: "low_coverage_threshold",
          severity: 1,
          description: `Threshold de coverage de funções em ${functionsThreshold}% — mínimo recomendado: 80%`,
          location: "vitest.config.ts",
          recommendation: "Aumentar threshold para ≥80% para garantir cobertura de funções.",
          confidence: 0.85,
        });
      }
    }
  } catch {
    logger.debug("code-quality", "Failed to read vitest config");
  }

  return issues;
}

// ── Export all code quality detectors ────────────────────────────────────────
