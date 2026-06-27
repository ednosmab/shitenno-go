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
import { getCapabilityMapping, type CapabilityMapping } from "./capability-mapping.js";

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
  ];

  // Governance skills
  const govSkills = [
    "operacao_no_nexus",
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

export function scaffoldNexusSystem(
  targetDir: string,
  answers: UserAnswers,
  capabilities: Capability[]
): ScaffoldResult {
  const result: ScaffoldResult = {
    filesCreated: [],
    directoriesCreated: [],
    capabilities,
    level: "custom", // legacy compatibility
  };

  const l1Dir = join(TEMPLATES_DIR, "l1");

  // Merge all directories and files from selected capabilities
  const allDirs = new Set<string>();
  const allFiles: Array<{ src: string; dest: string; customize?: boolean }> = [];

  for (const cap of capabilities) {
    const mapping = getCapabilityMapping(cap);
    for (const dir of mapping.directories) {
      allDirs.add(dir);
    }
    for (const file of mapping.files) {
      // Avoid duplicates
      if (!allFiles.some((f) => f.dest === file.dest)) {
        allFiles.push(file);
      }
    }
  }

  // Create directories
  for (const dir of allDirs) {
    const fullPath = join(targetDir, dir);
    ensureDirSync(fullPath);
    result.directoriesCreated.push(dir);
  }

  // Copy and customize files
  for (const file of allFiles) {
    const srcPath = join(l1Dir, file.src);
    const destPath = join(targetDir, file.dest);

    ensureDirSync(dirname(destPath));

    if (!existsSync(srcPath)) continue; // skip missing templates

    if (file.customize) {
      let content = readFileSync(srcPath, "utf-8");
      content = fillPlaceholders(content, answers);
      writeFileSync(destPath, content, "utf-8");
    } else {
      copySync(srcPath, destPath);
    }

    result.filesCreated.push(file.dest);
  }

  // Generate opencode.json at PROJECT ROOT (always)
  const opencodeTemplate = readFileSync(join(l1Dir, "opencode.json"), "utf-8");
  const opencodeContent = opencodeTemplate
    .replace(/\[modelo-principal\]/g, answers.principalModel.replace(/^opencode\//, ""))
    .replace(/\[modelo-executor\]/g, answers.executorModel.replace(/^opencode\//, ""));
  writeFileSync(join(targetDir, "opencode.json"), opencodeContent, "utf-8");
  result.filesCreated.push("opencode.json");

  // Generate ProjectProfile
  const profileTemplate = readFileSync(
    join(l1Dir, "nexus-profile", "_template.config.ts"), "utf-8"
  );
  const dirName = targetDir.split(/[/\\]/).pop() || "my-project";
  const projectName = dirName.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  const areas = detectAreas(targetDir);
  const areasStr = areas.map((a) => `    "${a}",`).join("\n");
  const profileContent = profileTemplate
    .replace(/\[PROJECT_NAME\]/g, projectName)
    .replace(/areas: \[.*?\]/s, `areas: [\n${areasStr}\n  ]`);
  const profilePath = join(targetDir, "nexus-profile", `${projectName}.config.ts`);
  writeFileSync(profilePath, profileContent, "utf-8");
  result.filesCreated.push(`nexus-profile/${projectName}.config.ts`);

  // Remove template file
  const templatePath = join(targetDir, "nexus-profile", "_template.config.ts");
  if (existsSync(templatePath)) {
    removeSync(templatePath);
  }

  // Add feedback/ to .gitignore
  const gitignorePath = join(targetDir, ".gitignore");
  let gitignoreContent = "";
  if (existsSync(gitignorePath)) {
    gitignoreContent = readFileSync(gitignorePath, "utf-8");
  }
  if (!gitignoreContent.includes("nexus-system/docs/feedback")) {
    const feedbackIgnore = "\n# Nexus System — feedback de sessão (dado privado, não versionado)\nnexus-system/docs/feedback/\n";
    writeFileSync(gitignorePath, gitignoreContent + feedbackIgnore, "utf-8");
  }

  // Copy selected skills (only if knowledge capability is installed)
  if (capabilities.includes("knowledge") && allDirs.has("nexus-system/docs/skills")) {
    const skillsDir = join(l1Dir, "docs/skills");
    const selectedSkills = selectSkills(capabilities);
    for (const skill of selectedSkills) {
      const srcPath = join(skillsDir, `${skill}.md`);
      if (!existsSync(srcPath)) continue;
      const destPath = join(targetDir, "nexus-system", "docs", "skills", `${skill}.md`);
      copySync(srcPath, destPath);
      result.filesCreated.push(`nexus-system/docs/skills/${skill}.md`);
    }
  }

  return result;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function fillPlaceholders(content: string, answers: UserAnswers): string {
  const stackStr = answers.stack.join(", ") || "a definir";
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
    .replace(/\[PERSONALIZAR: ex: senior\]/g, answers.maturity?.usedNexusBefore ? "senior" : "pleno")
    .replace(/\[PERSONALIZAR: ex: junior-pleno\]/g, "pleno")
    .replace(/\[PERSONALIZAR: ex: peer \(par a par\)\]/g, "peer")
    .replace(/\[PERSONALIZAR: ex: mentor \(explicativo\)\]/g, answers.maturity?.isFirstProject ? "mentor" : "peer")
    .replace(/\[PERSONALIZAR: ex: calibrado por camada\]/g, "calibrado por camada")
    .replace(/opencode\/\[modelo-principal\]/g, `opencode/${answers.principalModel.replace(/^opencode\//, "")}`)
    .replace(/opencode\/\[modelo-executor\]/g, `opencode/${answers.executorModel.replace(/^opencode\//, "")}`)
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
      // skip inaccessible dirs
    }
  }

  return areas.length > 0 ? areas : ["src"];
}
