/**
 * Audit module — Engineering detectors
 *
 * All engineering-related health issue detectors (code quality, security, supply chain).
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
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
  SECURITY_DETECTOR_SELF_PATHS,
  BLOCKED_LICENSES,
} from "./constants.js";
import type { HealthIssue, SourceFileInfo } from "./types.js";

// ── Engineering Audit Detectors (Dimensions 1-7) ─────────────────────────────

function detectTestHealth(projectRoot: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
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

function detectOrphanModules(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
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

function detectComplexityHotspots(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
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

function detectConsoleUsage(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
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

function detectEmptyCatchBlocks(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
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
      });
    }
  }
  return issues;
}

function detectHighComplexity(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const branchRegex = /\b(if|else if|switch|case|for|while|do|catch|\?|&&|\|\|)\b/g;

  for (const file of files) {
    const lines = file.content.split("\n");

    let braceDepth = 0;
    let funcStart = -1;
    let funcName = "";
    let inFunction = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const trimmed = line.trim();

      if (trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) {
        continue;
      }

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

      for (const ch of line) {
        if (ch === "{") braceDepth++;
        if (ch === "}") braceDepth--;
      }

      if (inFunction && braceDepth <= 0) {
        inFunction = false;
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

function detectCircularDeps(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  if (files.length === 0) return issues;

  const importGraph = new Map<string, Set<string>>();
  const importRegex = /(?:from|import)\s+["']([^"']+)["']/g;

  for (const file of files) {
    const deps = new Set<string>();
    let match;
    while ((match = importRegex.exec(file.content)) !== null) {
      const spec = match[1];
      if (!spec) continue;
      if (spec.startsWith(".") || spec.startsWith("/")) {
        const resolved = spec.replace(/\.js$/, "");
        const depBasename = resolved.split("/").pop() || resolved;
        if (depBasename && depBasename !== file.basename) {
          deps.add(depBasename);
        }
      }
    }
    importGraph.set(file.basename, deps);
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
      location: cycle.map((c) => `src/${c}.ts`).join(", "),
      recommendation: `Extrair interface comum ou usar injeção de dependência para quebrar o ciclo entre ${cycle.join(", ")}`,
    });
  }

  return issues;
}

function detectUnusedExports(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
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
        });
      }
    }
  }
  return issues;
}

function detectDeadCodePatterns(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
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
        });
        todoCount++;
      }
    }
  }
  return issues;
}

// ── Security Pattern Detectors (SEC-*) ────────────────────────────────────────

function isDetectorDefinitionFile(relPath: string): boolean {
  return SECURITY_DETECTOR_SELF_PATHS.some((p) => relPath.startsWith(p));
}

export function detectHardcodedSecrets(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
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

export function detectSQLInjection(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
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

export function detectXSS(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
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

export function detectUnsafeEval(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const evalPatterns = [
    /eval\s*\(/, /new\s+Function\s*\(/, /setTimeout\s*\(\s*["']/,
    /setInterval\s*\(\s*["']/, /Function\s*\(\s*["']/,
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

export function detectConsoleSecrets(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
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

export function detectWeakCrypto(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
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

export function detectInsecureHTTP(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
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

export function detectPrototypePollution(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
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

export function detectPathTraversal(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
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

export function detectRegexDos(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
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

export function detectUnsafeDeserialization(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
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

export function detectDependencyConfusion(projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
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

function detectLockFileDrift(projectRoot: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const pkgPath = join(projectRoot, "package.json");
  if (!existsSync(pkgPath)) return issues;

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
    ]);

    const NODE_BUILTINS = new Set([
      "fs", "path", "os", "child_process", "util", "events", "stream", "http", "https",
      "url", "crypto", "assert", "buffer", "zlib", "net", "tls", "dns", "readline",
      "worker_threads", "perf_hooks", "v8", "vm", "module", "constants", "querystring",
      "string_decoder", "timers", "tty", "punycode", "domain", "cluster", "dgram",
      "dns/promises", "fs/promises", "path/posix", "path/win32",
    ]);
    for (const builtin of [...NODE_BUILTINS]) {
      NODE_BUILTINS.add(`node:${builtin}`);
    }

    const importRegex = /(?:from|import)\s+["']([^"'\.\/][^"']*)["']/g;
    const requireRegex = /require\s*\(\s*["']([^"'\.\/][^"']*)["']\s*\)/g;
    const usedPackages = new Map<string, string>();

    for (const file of files) {
      let match;
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

// ── New detectors (Fase 5) ───────────────────────────────────────────────────

function detectDependencyVulnerabilities(projectRoot: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const lockPath = join(projectRoot, "package-lock.json");
  if (!existsSync(lockPath)) return issues;

  try {
    const output = execSync("npm audit --json 2>/dev/null", {
      cwd: projectRoot,
      encoding: "utf-8",
      timeout: 15000,
    });
    const audit = JSON.parse(output);
    const vulns = audit.vulnerabilities ?? {};

    for (const [name, info] of Object.entries(vulns)) {
      const v = info as { severity?: string; via?: Array<{ title?: string; url?: string }> };
      if (!v.severity) continue;
      const severity = v.severity === "critical" || v.severity === "high" ? 3
        : v.severity === "moderate" ? 2 : 1;
      const via = v.via?.filter((x: { title?: string }) => x.title).map((x: { title?: string }) => x.title).join(", ") ?? "";
      issues.push({
        type: "dependency_vulnerability",
        severity: severity as 1 | 2 | 3,
        description: `Dependência "${name}" possui vulnerabilidade (${v.severity}): ${via}`,
        location: "package-lock.json",
        recommendation: `Rodar "npm audit fix" ou atualizar ${name} para versão segura`,
      });
    }
  } catch { /* npm audit returns non-zero on vulns, that's expected */ }
  return issues;
}

function detectIncompatibleLicenses(projectRoot: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const nodeModules = join(projectRoot, "node_modules");
  if (!existsSync(nodeModules)) return issues;

  try {
    const entries = readdirSync(nodeModules, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      const pkgJsonPath = join(nodeModules, entry.name, "package.json");
      if (!existsSync(pkgJsonPath)) continue;
      try {
        const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf-8"));
        const license = typeof pkg.license === "string" ? pkg.license
          : typeof pkg.license === "object" ? pkg.license.type : "";
        if (BLOCKED_LICENSES.some((bl) => license.includes(bl))) {
          issues.push({
            type: "incompatible_license",
            severity: 2,
            description: `Dependência "${entry.name}" usa licença ${license} — potencialmente incompatível com uso comercial`,
            location: `node_modules/${entry.name}/package.json`,
            recommendation: `Verificar compatibilidade da licença ${license} ou buscar alternativa`,
          });
        }
      } catch { /* skip malformed package.json */ }
    }
  } catch { /* skip */ }
  return issues;
}

function detectConfigSecrets(projectRoot: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const SECRET_PATTERNS = [
    { regex: /(?:password|passwd|pwd)\s*[=:]\s*\S+/i, name: "password" },
    { regex: /(?:api[_-]?key|apikey)\s*[=:]\s*\S+/i, name: "API key" },
    { regex: /(?:secret|token)\s*[=:]\s*\S+/i, name: "secret/token" },
    { regex: /(?:private[_-]?key)\s*[=:]\s*\S+/i, name: "private key" },
  ];
  const CONFIG_FILES = [".env", ".env.local", ".env.production", "credentials.json", "secrets.json", ".npmrc"];

  for (const fileName of CONFIG_FILES) {
    const filePath = join(projectRoot, fileName);
    if (!existsSync(filePath)) continue;
    const gitignorePath = join(projectRoot, ".gitignore");
    if (existsSync(gitignorePath)) {
      const gitignore = readFileSync(gitignorePath, "utf-8");
      if (gitignore.split("\n").some((line) => line.trim() === fileName || line.trim() === `/${fileName}`)) {
        continue;
      }
    }
    try {
      const content = readFileSync(filePath, "utf-8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        if (line.trim().startsWith("#") || !line.trim()) continue;
        for (const { regex, name } of SECRET_PATTERNS) {
          if (regex.test(line)) {
            issues.push({
              type: "config_secret",
              severity: 3,
              description: `Possível ${name} em "${fileName}:${i + 1}" — arquivo de config versionado contém segredo`,
              location: `${fileName}:${i + 1}`,
              recommendation: `Mover segredo para variável de ambiente ou .env gitignored; adicionar ${fileName} ao .gitignore`,
            });
            break;
          }
        }
      }
    } catch { /* skip unreadable files */ }
  }
  return issues;
}

// ── Export all engineering detectors ──────────────────────────────────────────

export {
  detectTestHealth,
  detectOrphanModules,
  detectComplexityHotspots,
  detectTestCoverageGaps,
  detectLintIssues,
  detectTypeSafetyIssues,
  detectConsoleUsage,
  detectEmptyCatchBlocks,
  detectHighComplexity,
  detectCircularDeps,
  detectUnusedExports,
  detectDeadCodePatterns,
  detectUnpinnedVersions,
  detectMissingLockFile,
  detectLockFileDrift,
  detectPhantomDependencies,
  detectDeprecatedPackages,
  detectDependencyVulnerabilities,
  detectIncompatibleLicenses,
  detectConfigSecrets,
};
