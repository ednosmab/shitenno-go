/**
 * Audit module — Engineering detectors
 *
 * All engineering-related health issue detectors (code quality, security, supply chain).
 */

import { existsSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";
import {
  ORPHAN_SEVERITY_THRESHOLD,
  OVERSIZED_WARNING_THRESHOLD,
  OVERSIZED_INFO_THRESHOLD,
  MISSING_TEST_WARNING_THRESHOLD,
  ANY_TYPE_SEVERITY_THRESHOLD,
  COMPLEXITY_WARNING_THRESHOLD,
  COMPLEXITY_CRITICAL_THRESHOLD,
} from "./constants.js";
import type { HealthIssue, SourceFileInfo } from "./types.js";
import { logger } from "../logger.js";
import { getOrCreateProgram } from "./ts-program-cache.js";
import { analyzeComplexity } from "./complexity/analyzer.js";

// ── Engineering Audit Detectors (Dimensions 1-7) ─────────────────────────────

export function detectTestHealth(projectRoot: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const pkgPath = join(projectRoot, "package.json");
  if (!existsSync(pkgPath)) return issues;

  try {
    execSync("npx vitest run --reporter=json --bail 2>&1", {
      cwd: projectRoot,
      encoding: "utf-8",
      timeout: 15_000,
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    const output = String(e.stdout || e.stderr || e.message || "");
    const summaryMatch = output.match(/(\d+)\s+failed/);
    const failed = summaryMatch?.[1] ? parseInt(summaryMatch[1], 10) : 0;
    if (failed > 0) {
      issues.push({
        type: "test_failure",
        severity: 3,
        description: `${failed} teste(s) falharam (vitest)`,
        location: "src/__tests__/",
        recommendation: "Corrigir testes falhados antes de commitar",
        confidence: 0.95,
      });
    }
  }
  return issues;
}

export function detectOrphanModules(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  if (files.length === 0) return issues;

  try {
    // Phase 1: Extract all exports from each file
    const exportRegex = /^export\s+(?:function|const|class|interface|type|enum)\s+(\w+)/gm;
    const fileExports = new Map<string, Set<string>>(); // filePath -> Set of export names

    for (const file of files) {
      const exports = new Set<string>();
      let match;
      while ((match = exportRegex.exec(file.content)) !== null) {
        if (match[1]) exports.add(match[1]);
      }
      fileExports.set(file.fullPath, exports);
    }

    // Phase 2: Build a set of all symbols referenced across all files
    const allSymbols = new Set<string>();
    for (const file of files) {
      const wordRegex = /\b([A-Z]\w+)\b/g;
      let m;
      while ((m = wordRegex.exec(file.content)) !== null) {
        if (m[1]) allSymbols.add(m[1]);
      }
    }

    // Phase 3: For each file, check if it's imported by path OR if any export is used
    for (const file of files) {
      if (file.fullPath.includes("/commands/") || file.fullPath.includes("/console/")) continue;

      // Check 1: Is the file imported by path from another file?
      const isImportedByPath = files.some((other) => {
        if (other.fullPath === file.fullPath) return false;
        return other.content.includes(`/${file.basename}.js"`) || other.content.includes(`/${file.basename}"`) || other.content.includes(`/${file.basename}.ts"`);
      });

      // Check 2: Are any of this file's exports used by other files?
      const exports = fileExports.get(file.fullPath) ?? new Set();
      const hasUsedExports = exports.size > 0 && [...exports].some((symbol) => {
        return files.some((other) => {
          if (other.fullPath === file.fullPath) return false;
          const wordBoundary = new RegExp(`\\b${symbol}\\b`);
          return wordBoundary.test(other.content);
        });
      });

      if (!isImportedByPath && !hasUsedExports) {
        const exportCount = exports.size;
        const exportList = exportCount > 0
          ? ` (${exportCount} exports: ${[...exports].slice(0, 3).join(", ")}${exportCount > 3 ? "..." : ""})`
          : "";
        issues.push({
          type: "orphan_module",
          severity: file.lineCount > ORPHAN_SEVERITY_THRESHOLD ? 2 : 1,
          description: `Modulo orfao: "${file.relPath}" (${file.lineCount} linhas${exportList}) — nenhum import nem export usado por outro modulo`,
          location: file.relPath,
          recommendation: `Verificar se "${file.basename}" e necessario — remover se morto, ou adicionar imports para os exports usados`,
          confidence: 0.6,
        });
      }
    }
  } catch (err) { logger.debug("engineering-detectors", "Error in detectOrphanModules:", err); }
  return issues;
}

export function detectComplexityHotspots(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
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
      confidence: 0.9,
    });
  }
  return issues;
}

export function detectTestCoverageGaps(projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
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
        confidence: 0.85,
      });
    }
  } catch (err) { logger.debug("engineering-detectors", "Error in detectTestCoverageGaps:", err); }
  return issues;
}

export function detectLintIssues(projectRoot: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const eslintConfigs = [".eslintrc.js", ".eslintrc.json", ".eslintrc.yml", "eslint.config.js", "eslint.config.mjs"];
  if (!eslintConfigs.some((c) => existsSync(join(projectRoot, c)))) return issues;

  try {
    const output = execSync("npx eslint src/ --format=json 2>&1", {
      cwd: projectRoot,
      encoding: "utf-8",
      timeout: 15_000,
      stdio: ["pipe", "pipe", "pipe"],
    });
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
          confidence: 0.95,
        });
      }
    } catch (parseErr) { logger.debug("engineering-detectors", "ESLint output not JSON:", parseErr); }
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
          confidence: 0.95,
        });
      } else if (totalWarnings > 0) {
        issues.push({
          type: "lint_error",
          severity: 1,
          description: `ESLint encontrou ${totalWarnings} warning(s) (0 erros)`,
          location: "src/",
          recommendation: "Rever warnings ESLint — execute 'npx eslint src/' para detalhes",
          confidence: 0.95,
        });
      }
    } catch (parseErr) { logger.debug("engineering-detectors", "ESLint error output not JSON:", parseErr); }
  }
  return issues;
}

export function detectTypeSafetyIssues(projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
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
      confidence: 0.8,
    });
  }

  const tsconfigPath = join(projectRoot, "tsconfig.json");
  if (!existsSync(tsconfigPath)) return issues;

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
        confidence: 0.8,
      });
    }
  }

  return issues;
}

export function detectConsoleUsage(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
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
      confidence: 0.7,
    });
  }

  return issues;
}

export function detectEmptyCatchBlocks(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];

  for (const file of files) {
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
        confidence: 0.75,
      });
    }
  }
  return issues;
}

export function detectHighComplexity(projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];

  try {
    const program = getOrCreateProgram(projectRoot);

    for (const file of files) {
      if (file.relPath.includes("__tests__")) continue;
      const sourceFile = program.getSourceFile(file.fullPath);
      if (!sourceFile) continue;

      for (const result of analyzeComplexity(program, sourceFile)) {
        if (result.complexity > COMPLEXITY_WARNING_THRESHOLD) {
          issues.push({
            type: "high_complexity",
            severity: result.complexity > COMPLEXITY_CRITICAL_THRESHOLD ? 3 : 2,
            description: `Alta complexidade ciclomática em "${file.relPath}:${result.line}" (${result.functionName}): complexidade ${result.complexity} (máx: ${COMPLEXITY_WARNING_THRESHOLD})`,
            location: `${file.relPath}:${result.line}`,
            recommendation: `Considerar dividir "${result.functionName}" em funções menores`,
            confidence: 1.0,
          });
        }
      }
    }
  } catch (err) {
    logger.debug("engineering-detectors", "Error in detectHighComplexity:", err);
  }

  return issues;
}

export function detectCircularDeps(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  if (files.length === 0) return issues;

  const importGraph = new Map<string, Set<string>>();
  const importRegex = /(?:from|import)\s+["']([^"']+)["']/g;

  const pathToKey = (p: string) => p.replace(/\.ts$/, "").replace(/\.js$/, "").replace(/\/\.\//g, "/");

  for (const file of files) {
    const deps = new Set<string>();
    let match;
    while ((match = importRegex.exec(file.content)) !== null) {
      const spec = match[1];
      if (!spec) continue;
      if (spec.startsWith(".") || spec.startsWith("/")) {
        const dirOfCurrentFile = file.relPath.split("/").slice(0, -1).join("/");
        const resolved = pathToKey(dirOfCurrentFile + "/" + spec.replace(/\.js$/, ""));
        if (resolved && resolved !== pathToKey(file.relPath)) {
          deps.add(resolved);
        }
      }
    }
    importGraph.set(pathToKey(file.relPath), deps);
  }

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
      location: cycle.join(", "),
      recommendation: `Extrair interface comum ou usar injeção de dependência para quebrar o ciclo entre ${cycle.join(", ")}`,
      confidence: 0.8,
    });
  }

  return issues;
}

export function detectUnusedExports(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  if (files.length === 0) return issues;

  const exportRegex = /^export\s+(?:function|const|class|interface|type|enum)\s+(\w+)/gm;

  for (const file of files) {
    if (file.basename === "index" || file.fullPath.includes("/bin/")) continue;

    const exports: string[] = [];
    let match;
    while ((match = exportRegex.exec(file.content)) !== null) {
      if (match[1]) exports.push(match[1]);
    }

    for (const symbol of exports) {
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
          confidence: 0.65,
        });
      }
    }
  }
  return issues;
}

export function detectDeadCodePatterns(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const CONTROL_FLOW_KEYWORDS = new Set(["if", "for", "while", "switch", "try", "catch", "else"]);
  const methodDeclRegex = /(\w+)\s*\([^)]*\)\s*\{\s*\}/g;

  for (const file of files) {
    const lines = file.content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i]!.trim();
      if (trimmed.startsWith("// @ts-ignore") || trimmed.startsWith("// @ts-expect-error")) {
        issues.push({
          type: "dead_code",
          severity: 1,
          description: `Type safety bypass em "${file.relPath}:${i + 1}" — ${trimmed.split(" ").slice(0, 3).join(" ")}`,
          location: `${file.relPath}:${i + 1}`,
          recommendation: `Remover "${trimmed.split(" ").slice(0, 2).join(" ")}" e corrigir o problema de tipo subjacente`,
          confidence: 0.6,
        });
      }
    }

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
        confidence: 0.6,
      });
    }
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
        confidence: 0.6,
      });
    }

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
          confidence: 0.6,
        });
        todoCount++;
      }
    }
  }
  return issues;
}


