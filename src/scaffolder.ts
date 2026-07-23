/**
 * scaffolder.ts — Capability-based Scaffolding
 *
 * Substitui a instalação por níveis (L1/L2/L3) por instalação por capacidades.
 * Cada capacidade mapeia para diretórios e arquivos específicos.
 *
 * PRINCÍPIO: Instalar apenas o que agrega valor naquele momento.
 * Toda instalação é evolutiva — nada é definitivo.
 */

import fse from "fs-extra";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { UserAnswers } from "./prompts.js";
import type { Capability } from "./maturity-profile.js";
import { logger } from "./logger.js";
import { SHITENNO_DIR_NAME } from "./constants.js";
import { getCapabilityMapping } from "./capability-mapping.js";

const { copySync, ensureDirSync, readFileSync, writeFileSync, existsSync, readdirSync, removeSync } = fse;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEMPLATES_DIR = join(__dirname, "templates");

export interface ScaffoldResult {
  filesCreated: string[];
  directoriesCreated: string[];
  /** Capacidades instaladas */
  capabilities: Capability[];
  /** Legacy level para compatibilidade */
  level: string;
}



// ── Skills Selection ────────────────────────────────────────────────────────

function selectSkills(capabilities: Capability[]): string[] {
  // Core skills: always installed with knowledge
  const coreSkills = [
    "senior-engineer",
    "tdd-agent",
    "tdd_workflow",
    "clean_code_standards",
    "solid_principles",
    "architectural_integrity",
    "design_patterns",
    "error_handling_observability",
    "pnpm_management",
    "optimistic_ui",
    "codebase_hygiene_git",
  ];

  // Architecture skills
  const archSkills = [
    "ddd_patterns",
    "domain_driven_design_(ddd)",
  ];

  // Governance skills
  const govSkills = [
    "operacao_no_shitenno",
    "quick-board-enforcement",
    "system-first",
  ];

  // AI skills
  const aiSkills = [
    "animation_protocol",
    "ci_cd_pipeline",
    "responsividade",
    "state_management_protocol",
    "ui_ux_principles",
  ];

  // Advanced skills (compliance + metrics)
  const advancedSkills = [
    "nextjs_performance_seo",
    "postgresql_performance",
    "security_xss_prevention",
  ];

  const selected = [...coreSkills];

  if (capabilities.includes("architecture")) selected.push(...archSkills);
  if (capabilities.includes("governance")) selected.push(...govSkills);
  if (capabilities.includes("ai")) selected.push(...aiSkills);
  if (capabilities.includes("compliance") || capabilities.includes("metrics")) selected.push(...advancedSkills);

  return selected;
}

// ── Main Scaffolding Function ───────────────────────────────────────────────

/**
 * Cria a estrutura inicial do Shitenno num projeto.
 *
 * Gera opencode.json, shitenno/, shitenno-profile/, skills,
 * scripts e docs baseado nas capacidades seleccionadas.
 *
 * @param targetDir - Directorio onde criar a estrutura
 * @param answers - Respostas do utilizador (modelos, stack, etc.)
 * @param capabilities - Capacidades a instalar (knowledge, governance, etc.)
 * @returns Resultado com ficheiros e directórios criados
 */
export function scaffoldShitenno(
  targetDir: string,
  answers: UserAnswers,
  capabilities: Capability[]
): ScaffoldResult {
  const result: ScaffoldResult = {
    filesCreated: [],
    directoriesCreated: [],
    capabilities,
    level: "custom",
  };

  const baseDir = join(TEMPLATES_DIR, "base");
  const { allDirs, allFiles } = collectCapabilityAssets(capabilities);

  createDirectories(targetDir, allDirs, result);
  copyAndCustomizeFiles({ targetDir, baseDir, allFiles, answers, capabilities, result });
  generateOpencodeJson(targetDir, baseDir, answers, result);
  generateProfile(targetDir, baseDir, result);
  removeTemplateFile(targetDir);
  updateGitignore(targetDir);
  copySkills({ targetDir, baseDir, capabilities, allDirs, result });

  return result;
}

interface CapabilityAssets {
  allDirs: Set<string>;
  allFiles: Array<{ src: string; dest: string; customize?: boolean }>;
}

function collectCapabilityAssets(capabilities: Capability[]): CapabilityAssets {
  const allDirs = new Set<string>();
  const allFiles: Array<{ src: string; dest: string; customize?: boolean }> = [];

  for (const cap of capabilities) {
    const mapping = getCapabilityMapping(cap);
    for (const dir of mapping.directories) allDirs.add(dir);
    for (const file of mapping.files) {
      if (!allFiles.some((f) => f.dest === file.dest)) allFiles.push(file);
    }
  }

  return { allDirs, allFiles };
}

function createDirectories(
  targetDir: string,
  allDirs: Set<string>,
  result: ScaffoldResult
): void {
  for (const dir of allDirs) {
    const fullPath = join(targetDir, dir);
    ensureDirSync(fullPath);
    result.directoriesCreated.push(dir);
  }
}

interface CopyFilesContext {
  targetDir: string;
  baseDir: string;
  allFiles: Array<{ src: string; dest: string; customize?: boolean }>;
  answers: UserAnswers;
  capabilities: Capability[];
  result: ScaffoldResult;
}

function customizeContent(raw: string, dest: string, ctx: CopyFilesContext): string {
  let content = fillPlaceholders(raw, ctx.answers);
  if (dest.includes("AGENTS.md")) content = filterAgentsMdByCapabilities(content, ctx.capabilities);
  if (dest.includes("SYSTEM_MAP.md")) content = updateSystemMapCapabilityStatus(content, ctx.capabilities);
  return content;
}

function copyAndCustomizeFiles(ctx: CopyFilesContext): void {
  for (const file of ctx.allFiles) {
    const srcPath = join(ctx.baseDir, file.src);
    const destPath = join(ctx.targetDir, file.dest);
    ensureDirSync(dirname(destPath));
    if (!existsSync(srcPath)) continue;

    if (file.customize) {
      const raw = readFileSync(srcPath, "utf-8");
      writeFileSync(destPath, customizeContent(raw, file.dest, ctx), "utf-8");
    } else {
      copySync(srcPath, destPath);
    }
    ctx.result.filesCreated.push(file.dest);
  }
}

function generateOpencodeJson(
  targetDir: string,
  baseDir: string,
  answers: UserAnswers,
  result: ScaffoldResult
): void {
  const opencodeTemplate = readFileSync(join(baseDir, "opencode.json"), "utf-8");
  const opencodeContent = opencodeTemplate
    .replace(/\[modelo-principal\]/g, answers.principalModel.replace(/^opencode\//, ""))
    .replace(/\[modelo-executor\]/g, answers.executorModel.replace(/^opencode\//, ""));
  writeFileSync(join(targetDir, "opencode.json"), opencodeContent, "utf-8");
  result.filesCreated.push("opencode.json");
}

function generateProfile(
  targetDir: string,
  baseDir: string,
  result: ScaffoldResult
): void {
  const profileTemplate = readFileSync(
    join(baseDir, SHITENNO_DIR_NAME, "profile", "_template.config.ts"), "utf-8"
  );
  const dirName = targetDir.split(/[/\\]/).pop() || "my-project";
  const projectName = dirName.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  const areas = detectAreas(targetDir);
  const areasStr = areas.map((a) => `    "${a}",`).join("\n");
  const profileContent = profileTemplate
    .replace(/\[PROJECT_NAME\]/g, projectName)
    .replace(/areas: \[.*?\]/s, `areas: [\n${areasStr}\n  ]`);
  const profilePath = join(targetDir, SHITENNO_DIR_NAME, "profile", `${projectName}.config.ts`);
  writeFileSync(profilePath, profileContent, "utf-8");
  result.filesCreated.push(`${SHITENNO_DIR_NAME}/profile/${projectName}.config.ts`);
}

function removeTemplateFile(targetDir: string): void {
  const templatePath = join(targetDir, SHITENNO_DIR_NAME, "profile", "_template.config.ts");
  if (existsSync(templatePath)) removeSync(templatePath);
}

function updateGitignore(targetDir: string): void {
  const gitignorePath = join(targetDir, ".gitignore");
  let gitignoreContent = "";
  if (existsSync(gitignorePath)) gitignoreContent = readFileSync(gitignorePath, "utf-8");

  const entries: Array<{ pattern: string; comment: string }> = [
    { pattern: `${SHITENNO_DIR_NAME}/.cache/`, comment: "Shitenno — runtime cache" },
    { pattern: `${SHITENNO_DIR_NAME}/daemon/`, comment: "Shitenno — daemon state (pid, sock, log, state)" },
    { pattern: `${SHITENNO_DIR_NAME}/telemetry/`, comment: "Shitenno — session telemetry" },
    { pattern: `${SHITENNO_DIR_NAME}/feedback/records/`, comment: "Shitenno — session feedback records" },
    { pattern: `${SHITENNO_DIR_NAME}/feedback/summary.json`, comment: "Shitenno — feedback summary" },
    { pattern: `${SHITENNO_DIR_NAME}/governance/executions/`, comment: "Shitenno — execution logs" },
    { pattern: `${SHITENNO_DIR_NAME}/governance/context/checkpoints/`, comment: "Shitenno — context checkpoints" },
    { pattern: `${SHITENNO_DIR_NAME}/governance/context/context_buffer.yaml`, comment: "Shitenno — context buffer (auto-generated)" },
    { pattern: `${SHITENNO_DIR_NAME}/docs/generated/`, comment: "Shitenno — generated docs" },
    { pattern: `${SHITENNO_DIR_NAME}/docs/feedback/`, comment: "Shitenno — session feedback (private)" },
  ];

  let appended = false;
  for (const entry of entries) {
    if (!gitignoreContent.includes(entry.pattern)) {
      gitignoreContent += `\n# ${entry.comment}\n${entry.pattern}\n`;
      appended = true;
    }
  }

  if (appended) {
    writeFileSync(gitignorePath, gitignoreContent, "utf-8");
  }
}

interface CopySkillsContext {
  targetDir: string;
  baseDir: string;
  capabilities: Capability[];
  allDirs: Set<string>;
  result: ScaffoldResult;
}

function copySkills(ctx: CopySkillsContext): void {
  if (!ctx.capabilities.includes("knowledge") || !ctx.allDirs.has(`${SHITENNO_DIR_NAME}/docs/skills`)) return;
  const skillsDir = join(ctx.baseDir, "docs/skills");
  const selectedSkills = selectSkills(ctx.capabilities);
  for (const skill of selectedSkills) {
    const srcPath = join(skillsDir, `${skill}.md`);
    if (!existsSync(srcPath)) continue;
    const destPath = join(ctx.targetDir, SHITENNO_DIR_NAME, "docs", "skills", `${skill}.md`);
    copySync(srcPath, destPath);
    ctx.result.filesCreated.push(`${SHITENNO_DIR_NAME}/docs/skills/${skill}.md`);
  }
}

// ── AGENTS.md Conditional Sections ────────────────────────────────────────────

/**
 * Remove seções de capacidades não instaladas do AGENTS.md.
 *
 * O template contém marcadores HTML como:
 *   <!-- CAPABILITY: governance --> ... <!-- /CAPABILITY -->
 *
 * Se a capacidade não está instalada, toda a seção é removida.
 */
function filterAgentsMdByCapabilities(
  content: string,
  installedCapabilities: Capability[]
): string {
  // Match <!-- CAPABILITY: xxx --> ... <!-- /CAPABILITY --> blocks
  const capabilityBlockRegex = /<!-- CAPABILITY: (\w+) -->[\s\S]*?<!-- \/CAPABILITY -->/g;

  return content.replace(capabilityBlockRegex, (match, capability: string) => {
    if (installedCapabilities.includes(capability as Capability)) {
      // Keep the block but remove the comment markers
      return match
        .replace(/<!-- CAPABILITY: \w+ -->\n?/, "")
        .replace(/<!-- \/CAPABILITY -->\n?$/, "");
    }
    // Remove entire block for uninstalled capabilities
    return "";
  });
}

// ── SYSTEM_MAP.md Capability Status ─────────────────────────────────────────

/**
 * Available capability definitions with metadata.
 */
const CAPABILITY_DEFS: Array<{ id: string; name: string; description: string } > = [
  { id: "core", name: "core", description: "Fundação básica (docs, scripts, opencode.json)" },
  { id: "knowledge", name: "knowledge", description: "Skills, AGENTS.md regras, documentação" },
  { id: "governance", name: "governance", description: "Workflows, context buffer, handoffs" },
  { id: "architecture", name: "architecture", description: "ADRs, SDRs, planos, session templates" },
  { id: "ai", name: "ai", description: "Contratos de agentes, cognition, prompts" },
  { id: "quality", name: "quality", description: "Scripts de validação, sync-docs" },
  { id: "metrics", name: "metrics", description: "Relatórios, histórico" },
  { id: "operations", name: "operations", description: "Runbooks, close-session, premortem" },
  { id: "compliance", name: "compliance", description: "Premortem reviews, session reviews" },
];

/**
 * Update the capability status table in SYSTEM_MAP.md.
 *
 * The template contains markers:
 *   <!-- CAPABILITY_STATUS --> ... <!-- /CAPABILITY_STATUS -->
 *
 * Within those markers, each row is replaced with the actual status:
 *   ✅ = installed, 📋 = available, 🔮 = future
 */
export function updateSystemMapCapabilityStatus(
  content: string,
  installedCapabilities: Capability[]
): string {
  // Match the CAPABILITY_STATUS block
  const blockRegex = /<!-- CAPABILITY_STATUS -->[\s\S]*?<!-- \/CAPABILITY_STATUS -->/;

  const newRows = CAPABILITY_DEFS.map((cap) => {
    const isInstalled = installedCapabilities.includes(cap.id as Capability);
    const icon = isInstalled ? "✅" : "📋";
    const status = isInstalled ? "instalado" : "disponível";
    return `| \`${cap.name}\` | ${icon} ${status} | ${cap.description} |`;
  });

  const newBlock = [
    "<!-- CAPABILITY_STATUS -->",
    "As capacidades instaladas neste projecto determinam quais secções do AGENTS.md",
    "estão activas. Execute `shugo upgrade --list` para ver todas as capacidades.",
    "",
    "| Capacidade | Estado | Descrição |",
    "|---|---|---|",
    ...newRows,
    "<!-- /CAPABILITY_STATUS -->",
  ].join("\n");

  return content.replace(blockRegex, newBlock);
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function fillPlaceholders(content: string, answers: UserAnswers): string {
  const stackStr = Array.isArray(answers.stack) && answers.stack.length > 0
    ? answers.stack.join(", ")
    : "a definir";
  const dbStr = answers.database || "a definir";
  const stylingStr = answers.styling || "a definir";

  return content
    .replace(/\[PERSONALIZAR: linguagens, frameworks e tecnologias usados\]/g, stackStr)
    .replace(/\[PERSONALIZAR: regras de estilização do projecto\]/g, `Usar apenas ${stylingStr} para estilização`)
    .replace(/\[PERSONALIZAR: SGBD e convenções usados\]/g, dbStr)
    .replace(/\[PERSONALIZAR: biblioteca de validação usada\]/g, "Validação de dados na camada de entrada")
    .replace(/\[PERSONALIZAR: referência ao roadmap do projecto, se existir\]/g, "[Adicionar referência ao roadmap se existir]")
    .replace(/\[PERSONALIZAR: regras específicas de ambiente de teste e deploy, se aplicável\]/g, "[Adicionar regras de ambiente se aplicável]")
    .replace(/\[PERSONALIZAR: regras específicas do design system do projecto[\s\S]*?\]/g, `[Adicionar regras do design system: ${stylingStr}]`)
    .replace(/\[PERSONALIZAR: ex: T-shaped\]/g, "T-shaped")
    .replace(/\[PERSONALIZAR: ex: senior\]/g, answers.maturity?.usedShitennoBefore ? "senior" : "pleno")
    .replace(/\[PERSONALIZAR: ex: junior-pleno\]/g, "pleno")
    .replace(/\[PERSONALIZAR: ex: peer \(par a par\)\]/g, "peer")
    .replace(/\[PERSONALIZAR: ex: mentor \(explicativo\)\]/g, answers.maturity?.isFirstProject ? "mentor" : "peer")
    .replace(/\[PERSONALIZAR: ex: calibrado por camada\]/g, "calibrado por camada")
    .replace(/opencode\/\[modelo-principal\]/g, `opencode/${(answers.principalModel || "model").replace(/^opencode\//, "")}`)
    .replace(/opencode\/\[modelo-executor\]/g, `opencode/${(answers.executorModel || "model").replace(/^opencode\//, "")}`)
    .replace(/\[PERSONALIZAR: comando de testes\]/g, "pnpm run test");
}

function detectAreas(targetDir: string): string[] {
  const candidates = ["src", "packages", "apps"];
  const areas: string[] = [];

  for (const base of candidates) {
    const basePath = join(targetDir, base);
    if (!existsSync(basePath)) continue;

    try {
      const entries = readdirSync(basePath, { withFileTypes: true });
      const subdirs = entries.filter((e) => e.isDirectory() && !e.name.startsWith("."));

      if (subdirs.length === 0) {
        areas.push(base);
      } else {
        for (const dir of subdirs) {
          areas.push(`${base}/${dir.name}`);
        }
      }
    } catch {
      logger.debug("scaffolder", "Inaccessible directory skipped:", base);
    }
  }

  return areas.length > 0 ? areas : ["src"];
}
