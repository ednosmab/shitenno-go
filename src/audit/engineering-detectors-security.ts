/**
 * Audit module — Security pattern detectors
 *
 * Security-related health issue detectors (SEC-* and SEC-CONF-*).
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../logger.js";
import { SECURITY_DETECTOR_SELF_PATHS } from "./constants.js";
import type { HealthIssue, SourceFileInfo } from "./types.js";

// ── Security Pattern Detectors (SEC-*) ────────────────────────────────────────
// Calibration guide:
//   1.0–0.9: structural/data-flow analysis or deterministic match
//   0.75–0.89: specific regex with low overlap with legitimate code
//   0.5–0.74: generic regex or textual heuristic
//   < 0.5: do not emit issue

function isDetectorDefinitionFile(relPath: string): boolean {
  return SECURITY_DETECTOR_SELF_PATHS.some((p) => relPath.startsWith(p));
}

function shannonEntropy(str: string): number {
  const freq = new Map<string, number>();
  for (const ch of str) freq.set(ch, (freq.get(ch) ?? 0) + 1);
  const len = str.length;
  let h = 0;
  for (const count of freq.values()) {
    const p = count / len;
    h -= p * Math.log2(p);
  }
  return h;
}

/**
 * Detect hardcoded secrets, API keys, and credentials in source code.
 * @param _projectRoot - Root directory of the project (unused)
 * @param files - Array of source file information to scan
 * @returns Array of health issues for detected secrets
 */
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
        const m = line.match(regex);
        if (m) {
          issues.push({
            type: "hardcoded_secret",
            severity: 3,
            description: `Possível ${name} hardcoded em "${file.relPath}:${i + 1}"`,
            location: `${file.relPath}:${i + 1}`,
            recommendation: `Mover ${name} para variável de ambiente ou ficheiro de configuração seguro`,
            confidence: shannonEntropy(m[0] ?? "") > 4.0 ? 0.9 : 0.55,
          });
          break;
        }
      }
    }
  }
  return issues;
}

/**
 * Detect potential SQL injection vulnerabilities in source code.
 * @param _projectRoot - Root directory of the project (unused)
 * @param files - Array of source file information to scan
 * @returns Array of health issues for SQL injection risks
 */
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
          confidence: 0.65,
        });
      }
    }
  }
  return issues;
}

/**
 * Detect potential Cross-Site Scripting (XSS) vulnerabilities.
 * @param _projectRoot - Root directory of the project (unused)
 * @param files - Array of source file information to scan
 * @returns Array of health issues for XSS risks
 */
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
          confidence: 0.65,
          skillRef: "security_xss_prevention",
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
          confidence: 0.7,
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
          confidence: 0.7,
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
          confidence: 0.65,
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
              confidence: 0.7,
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
  // Framework-specific patterns (Express req.*)
  const pollPatterns = [
    /Object\.assign\s*\([^)]*req\./, /\.\[\s*["']__proto__["']\s*\]/,
    /\.\[\s*["']constructor["']\s*\]/, /\.\[\s*["']prototype["']\s*\]/,
    /merge\s*\([^)]*req\./, /deepMerge\s*\([^)]*req\./,
  ];
  // NEW: Generic pattern — for...in followed by dynamic key assignment (framework-agnostic)
  const genericPollPattern = /for\s*\(\s*(?:const|let|var)\s+\w+\s+in\s+\w+\s*\)[\s\S]{0,80}\[\s*\w+\s*\]\s*=/;

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
          confidence: 0.6,
        });
      } else if (genericPollPattern.test(line)) {
        issues.push({
          type: "proto_pollution",
          severity: 2,
          description: `Atribuição por chave dinâmica em "${file.relPath}:${i + 1}" — for...in sem verificar __proto__/constructor`,
          location: `${file.relPath}:${i + 1}`,
          recommendation: "Verificar se a chave não é __proto__ ou constructor antes de atribuir",
          confidence: 0.6,
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
          confidence: 0.65,
        });
      }
    }
  }
  return issues;
}

export function detectRegexDos(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  // Dynamic RegExp patterns (existing)
  const redosPatterns = [
    /new\s+RegExp\s*\([^)]*\+[^)]*\+/, /new\s+RegExp\s*\([^)]*\*[^)]*\*/,
    /new\s+RegExp\s*\([^)]*\+[^)]*\)/,
  ];
  // NEW: Literal regex with nested quantifiers (heuristic — may have exponential backtracking)
  const nestedQuantifierPattern = /\/(?:[^/\\]|\\.)*\([^)]*[+*][^)]*\)[+*](?:[^/\\]|\\.)*\//;

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
          confidence: 0.75,
        });
      } else if (nestedQuantifierPattern.test(line)) {
        issues.push({
          type: "regex_dos",
          severity: 2,
          description: `Regex literal com quantificadores aninhados em "${file.relPath}:${i + 1}" — pode ter backtracking exponencial`,
          location: `${file.relPath}:${i + 1}`,
          recommendation: "Rever manualmente — pode causar catastrophic backtracking; considerar usar re2",
          confidence: 0.6,
        });
      }
    }
  }
  return issues;
}

export function detectUnsafeDeserialization(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];

  // Pattern 1: Real unsafe deserialization sinks (actual RCE risk)
  const realDeserializationSinks = [
    /js-yaml['"]\)?\.load\s*\(/,        // yaml.load() without FAILSAFE_SCHEMA is dangerous
    /node-serialize['"]\)?\.unserialize\s*\(/,
    /vm\.runInNewContext\s*\(/,
    /vm\.runInThisContext\s*\(/,
  ];

  // Pattern 2: Unvalidated JSON.parse (low risk — no RCE, but schema validation missing)
  const unvalidatedJsonPatterns = [
    /JSON\.parse\s*\(.*req\./,
    /JSON\.parse\s*\(.*process\.argv/,
    /JSON\.parse\s*\(.*readFile/,
  ];

  for (const file of files) {
    const lines = file.content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (realDeserializationSinks.some((p) => p.test(line))) {
        issues.push({
          type: "unsafe_deserialize",
          severity: 3,
          description: `Unsafe deserialization em "${file.relPath}:${i + 1}" — risco de RCE`,
          location: `${file.relPath}:${i + 1}`,
          recommendation: "Usar yaml.safeLoad(), vm.runInNewContext com sandbox, ou evitar deserialização de input não confiável",
          confidence: 0.65,
        });
      } else if (unvalidatedJsonPatterns.some((p) => p.test(line))) {
        issues.push({
          type: "unsafe_deserialize",
          severity: 1,
          description: `JSON.parse com input não validado em "${file.relPath}:${i + 1}" — sem schema validation`,
          location: `${file.relPath}:${i + 1}`,
          recommendation: "Validar JSON com schema (zod/joi) antes de processar",
          confidence: 0.65,
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
              confidence: 0.7,
            });
          }
        }
      }
    }
  } catch (err) { logger.debug("engineering-detectors", "Error in detectDependencyConfusion:", err); }
  return issues;
}

// ── Security Configuration Detectors (SEC-CONF-*) ─────────────────────────────

export function detectInsecureCORS(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const corsPatterns = [
    /Access-Control-Allow-Origin['"]?\s*[,:]\s*['"]\*['"]/,
    /\bcors\s*\(\s*\)/,  // cors() without config = allows all (word boundary to avoid parseCors)
  ];

  for (const file of files) {
    if (file.relPath.includes("__tests__")) continue;
    if (isDetectorDefinitionFile(file.relPath)) continue;
    const lines = file.content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (corsPatterns.some((p) => p.test(line))) {
        issues.push({
          type: "insecure_cors",
          severity: 2,
          description: `CORS wildcard em "${file.relPath}:${i + 1}" — Access-Control-Allow-Origin: * permite qualquer origem`,
          location: `${file.relPath}:${i + 1}`,
          recommendation: "Especificar origens permitidas em vez de usar wildcard *",
          confidence: 0.65,
        });
      }
    }
  }
  return issues;
}

export function detectInsecureCookies(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  // Match Set-Cookie headers
  const setCookieRegex = /Set-Cookie\s*[=:]/i;

  for (const file of files) {
    if (file.relPath.includes("__tests__")) continue;
    if (isDetectorDefinitionFile(file.relPath)) continue;
    const lines = file.content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      // Create regex per line to avoid lastIndex persistence with global flag
      const cookieCallRegex = /res\.cookie\s*\(\s*['"][^'"]+['"]\s*,/i;
      if (cookieCallRegex.test(line)) {
        // For res.cookie(), look at the same line AND next 5 lines for options
        const block = lines.slice(i, i + 6).join(" ");
        const hasHttpOnly = /httpOnly\s*[:=]\s*true/i.test(block);
        const hasSecure = /secure\s*[:=]\s*true/i.test(block);
        const hasSameSite = /sameSite\s*[:=]/i.test(block);
        if (!hasHttpOnly || !hasSecure || !hasSameSite) {
          const missing: string[] = [];
          if (!hasHttpOnly) missing.push("httpOnly");
          if (!hasSecure) missing.push("secure");
          if (!hasSameSite) missing.push("sameSite");
          issues.push({
            type: "insecure_cookie",
            severity: 2,
            description: `Cookie sem flags de segurança em "${file.relPath}:${i + 1}" — falta: ${missing.join(", ")}`,
            location: `${file.relPath}:${i + 1}`,
            recommendation: `Adicionar flags: ${missing.map(f => `{${f}: true}`).join(", ")}`,
            confidence: 0.65,
          });
        }
      } else if (setCookieRegex.test(line)) {
        const hasHttpOnly = /HttpOnly/i.test(line);
        const hasSecure = /Secure/i.test(line);
        const hasSameSite = /SameSite/i.test(line);
        if (!hasHttpOnly || !hasSecure || !hasSameSite) {
          const missing: string[] = [];
          if (!hasHttpOnly) missing.push("HttpOnly");
          if (!hasSecure) missing.push("Secure");
          if (!hasSameSite) missing.push("SameSite");
          issues.push({
            type: "insecure_cookie",
            severity: 2,
            description: `Set-Cookie header sem flags em "${file.relPath}:${i + 1}" — falta: ${missing.join(", ")}`,
            location: `${file.relPath}:${i + 1}`,
            recommendation: `Adicionar flags: ${missing.join(", ")}`,
            confidence: 0.65,
          });
        }
      }
    }
  }
  return issues;
}

export function detectWeakRandomness(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  // Math.random() inside an assignment for security-sensitive variable names
  // Require Math.random() to be INSIDE the assignment expression (not just co-located)
  const assignmentPattern = /(?:const|let|var)\s+\w*(?:token|password|secret|key|session|uuid|id)\w*\s*=\s*[^;]*Math\.random/i;

  for (const file of files) {
    if (file.relPath.includes("__tests__")) continue;
    if (isDetectorDefinitionFile(file.relPath)) continue;
    const lines = file.content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (line.trim().startsWith("//") || line.trim().startsWith("*")) continue;
      if (assignmentPattern.test(line)) {
        issues.push({
          type: "weak_randomness",
          severity: 2,
          description: `Math.random() usado para geração de segredo em "${file.relPath}:${i + 1}" — entropia insuficiente`,
          location: `${file.relPath}:${i + 1}`,
          recommendation: "Usar crypto.randomBytes() ou crypto.randomUUID() para tokens/senhas",
          confidence: 0.65,
        });
      }
    }
  }
  return issues;
}


