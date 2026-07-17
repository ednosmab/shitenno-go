/**
 * Audit module — Supply chain and new detectors
 *
 * Supply chain (SC-*) and newly added detectors.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { logger } from "../logger.js";
import { safeJsonParseValidated, isRecord } from "../validation.js";
import { BLOCKED_LICENSES } from "./constants.js";
import type { HealthIssue, SourceFileInfo } from "./types.js";

// ── Supply Chain Detectors (SC-*) ──────────────────────────────────────────

export function detectUnpinnedVersions(projectRoot: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const pkgPath = join(projectRoot, "package.json");
  if (!existsSync(pkgPath)) return issues;

  try {
    const pkg = safeJsonParseValidated(readFileSync(pkgPath, "utf-8"), isRecord, "supply:detectUnpinnedVersions");
    if (!pkg) return issues;
    const allDeps: Record<string, string> = {
      ...((pkg as Record<string, unknown>).dependencies as Record<string, string> ?? {}),
      ...((pkg as Record<string, unknown>).devDependencies as Record<string, string> ?? {}),
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
        confidence: 0.9,
      });
    }
  } catch (err) { logger.debug("engineering-detectors", "Error in detectUnpinnedVersions:", err); }
  return issues;
}

export function detectMissingLockFile(projectRoot: string): HealthIssue[] {
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
      confidence: 0.95,
    });
  }
  return issues;
}

export function detectLockFileDrift(projectRoot: string): HealthIssue[] {
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
            confidence: 0.95,
          });
        }
      }
    }
  } catch (err) { logger.debug("engineering-detectors", "Error in detectLockFileDrift:", err); }
  return issues;
}

export function detectPhantomDependencies(projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const pkgPath = join(projectRoot, "package.json");
  if (!existsSync(pkgPath)) return issues;

  try {
    const pkg = safeJsonParseValidated(readFileSync(pkgPath, "utf-8"), isRecord, "supply:detectPhantomDependencies");
    if (!pkg) return issues;
    const declaredDeps = new Set([
      ...Object.keys((pkg as Record<string, unknown>).dependencies ?? {}),
      ...Object.keys((pkg as Record<string, unknown>).devDependencies ?? {}),
      ...Object.keys((pkg as Record<string, unknown>).peerDependencies ?? {}),
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
        confidence: 0.75,
      });
    }
  } catch (err) { logger.debug("engineering-detectors", "Error in detectPhantomDependencies:", err); }
  return issues;
}

export function detectDeprecatedPackages(projectRoot: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const pkgPath = join(projectRoot, "package.json");
  if (!existsSync(pkgPath)) return issues;

  try {
    const pkg = safeJsonParseValidated(readFileSync(pkgPath, "utf-8"), isRecord, "supply:detectDeprecatedPackages");
    if (!pkg) return issues;
    const allDeps = {
      ...((pkg as Record<string, unknown>).dependencies as Record<string, unknown> ?? {}),
      ...((pkg as Record<string, unknown>).devDependencies as Record<string, unknown> ?? {}),
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
        confidence: 0.9,
      });
    }
  } catch (err) { logger.debug("engineering-detectors", "Error in detectDeprecatedPackages:", err); }
  return issues;
}

// ── New detectors (Fase 5) ───────────────────────────────────────────────────

function parseNpmAuditOutput(output: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  try {
    // Try npm/pnpm format first (single JSON object)
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
        confidence: 0.9,
      });
    }
  } catch {
    // Fallback: yarn audit returns NDJSON (one JSON object per line)
    const seen = new Set<string>();
    for (const line of output.split("\n")) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        if (entry.type === "auditAdvisory" && entry.data?.advisory) {
          const adv = entry.data.advisory;
          const name = adv.module_name ?? "unknown";
          if (seen.has(name)) continue;
          seen.add(name);
          const severity = adv.severity === "critical" || adv.severity === "high" ? 3
            : adv.severity === "moderate" ? 2 : 1;
          issues.push({
            type: "dependency_vulnerability",
            severity: severity as 1 | 2 | 3,
            description: `Dependência "${name}" possui vulnerabilidade (${adv.severity}): ${adv.title ?? ""}`,
            location: "yarn.lock",
            recommendation: `Rodar "yarn audit fix" ou atualizar ${name} para versão segura`,
            confidence: 0.9,
          });
        }
      } catch { /* skip malformed lines */ }
    }
  }
  return issues;
}

export function detectDependencyVulnerabilities(projectRoot: string): HealthIssue[] {
  const issues: HealthIssue[] = [];

  // Support npm, pnpm, and yarn lock files
  const lockFiles = [
    { file: "package-lock.json", cmd: "npm audit --json" },
    { file: "pnpm-lock.yaml", cmd: "pnpm audit --json" },
    { file: "yarn.lock", cmd: "yarn audit --json" },
  ];
  const found = lockFiles.find((l) => existsSync(join(projectRoot, l.file)));
  if (!found) return issues;

  try {
    const output = execSync(`${found.cmd} 2>/dev/null`, {
      cwd: projectRoot,
      encoding: "utf-8",
      timeout: 20000,
    });
    return parseNpmAuditOutput(output);
  } catch (err) {
    // npm/pnpm/yarn audit exit with code != 0 when vulnerabilities are found — this is expected.
    // The real JSON output is captured in err.stdout by Node.js.
    const stdout = (err as { stdout?: string }).stdout;
    if (stdout) {
      try { return parseNpmAuditOutput(stdout); } catch { /* JSON really malformed, ignore */ }
    }
    return [];
  }
}

export function detectIncompatibleLicenses(projectRoot: string): HealthIssue[] {
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
        const pkgRaw = safeJsonParseValidated(readFileSync(pkgJsonPath, "utf-8"), isRecord, `supply:license:${entry.name}`);
        if (!pkgRaw) continue;
        const pkg = pkgRaw as Record<string, unknown>;
        const licenseField = pkg.license;
        const license = typeof licenseField === "string" ? licenseField
          : typeof licenseField === "object" && licenseField !== null ? (licenseField as Record<string, unknown>).type as string : "";
        if (BLOCKED_LICENSES.some((bl) => license.includes(bl))) {
          issues.push({
            type: "incompatible_license",
            severity: 2,
            description: `Dependência "${entry.name}" usa licença ${license} — potencialmente incompatível com uso comercial`,
            location: `node_modules/${entry.name}/package.json`,
            recommendation: `Verificar compatibilidade da licença ${license} ou buscar alternativa`,
            confidence: 0.9,
          });
        }
      } catch (parseErr) { logger.debug("engineering-detectors", "Error reading package.json for license:", parseErr); }
    }
  } catch (err) { logger.debug("engineering-detectors", "Error in detectIncompatibleLicenses:", err); }
  return issues;
}

export function detectConfigSecrets(projectRoot: string): HealthIssue[] {
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
              confidence: 0.75,
            });
            break;
          }
        }
      }
    } catch (readErr) { logger.debug("engineering-detectors", "Error reading config file:", readErr); }
  }
  return issues;
}


