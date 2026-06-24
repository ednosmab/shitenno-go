import fse from "fs-extra";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { UserAnswers } from "./prompts.js";

const { copySync, ensureDirSync, readFileSync, writeFileSync, existsSync } = fse;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEMPLATES_DIR = join(__dirname, "templates");

export interface ScaffoldResult {
  filesCreated: string[];
  directoriesCreated: string[];
  level: string;
}

function getDirectoriesForLevel(level: string): string[] {
  // L1 Base: Junior - docs + scripts
  const junior = [
    "nexus-system",
    "nexus-system/docs",
    "nexus-system/docs/skills",
    "nexus-system/scripts",
  ];

  if (level === "junior") return junior;

  // L2 Intermediária: Pleno - + governance
  const pleno = [
    ...junior,
    "nexus-system/governance",
    "nexus-system/governance/context",
    "nexus-system/governance/agents",
  ];

  if (level === "pleno") return pleno;

  // L3 Completa: Senior - + cognition + todos os sub-directórios
  return [
    ...pleno,
    "nexus-system/cognition",
    "nexus-system/cognition/context",
    "nexus-system/cognition/memory",
    "nexus-system/cognition/prompts",
    "nexus-system/governance/contracts",
    "nexus-system/governance/handoffs",
    "nexus-system/governance/policies",
    "nexus-system/governance/premortem",
    "nexus-system/governance/reviews",
    "nexus-system/docs/adrs",
    "nexus-system/docs/feedback",
    "nexus-system/docs/history",
    "nexus-system/docs/layers",
    "nexus-system/docs/plans",
    "nexus-system/docs/roadmaps",
    "nexus-system/docs/sdr",
  ];
}

function getFilesForLevel(level: string): Array<{ src: string; dest: string; customize?: boolean }> {
  // Base files for all levels
  const baseFiles: Array<{ src: string; dest: string; customize?: boolean }> = [
    { src: "docs/AGENTS.md", dest: "nexus-system/docs/AGENTS.md", customize: true },
    { src: "docs/opencode-context.md", dest: "nexus-system/docs/opencode-context.md", customize: true },
    { src: "docs/Nexus-System_GUIDE.md", dest: "nexus-system/docs/Nexus-System_GUIDE.md", customize: true },
    { src: "scripts/validate-session.ts", dest: "nexus-system/scripts/validate-session.ts" },
    { src: "scripts/close-session.ts", dest: "nexus-system/scripts/close-session.ts" },
    { src: "scripts/premortem-check.ts", dest: "nexus-system/scripts/premortem-check.ts" },
  ];

  if (level === "junior") return baseFiles;

  // Pleno adds governance files
  const plenoFiles = [
    ...baseFiles,
    { src: "governance/context/context_buffer.yaml", dest: "nexus-system/governance/context/context_buffer.yaml" },
  ];

  if (level === "pleno") return plenoFiles;

  // Senior adds all files
  return [
    ...plenoFiles,
    { src: "cognition/context/CONTEXT_HIERARCHY.md", dest: "nexus-system/cognition/context/CONTEXT_HIERARCHY.md" },
    { src: "cognition/memory/MEM-operational-state-v1.json", dest: "nexus-system/cognition/memory/MEM-operational-state-v1.json" },
  ];
}

export function scaffoldNexusSystem(
  targetDir: string,
  answers: UserAnswers
): ScaffoldResult {
  const result: ScaffoldResult = {
    filesCreated: [],
    directoriesCreated: [],
    level: answers.teamLevel,
  };

  const l1Dir = join(TEMPLATES_DIR, "l1");

  // Get directories and files based on team level
  const dirs = getDirectoriesForLevel(answers.teamLevel);
  const filesToCopy = getFilesForLevel(answers.teamLevel);

  // Create directories
  for (const dir of dirs) {
    const fullPath = join(targetDir, dir);
    ensureDirSync(fullPath);
    result.directoriesCreated.push(dir);
  }

  // Copy and customize files
  for (const file of filesToCopy) {
    const srcPath = join(l1Dir, file.src);
    const destPath = join(targetDir, file.dest);

    // Ensure parent directory exists
    ensureDirSync(dirname(destPath));

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
  const opencodeTemplate = readFileSync(
    join(l1Dir, "opencode.json"),
    "utf-8"
  );
  const opencodeContent = opencodeTemplate
    .replace(/\[modelo-principal\]/g, answers.principalModel.replace(/^opencode\//, ""))
    .replace(/\[modelo-executor\]/g, answers.executorModel.replace(/^opencode\//, ""));
  writeFileSync(join(targetDir, "opencode.json"), opencodeContent, "utf-8");
  result.filesCreated.push("opencode.json");

  // Copy selected skills (only if docs/skills exists)
  if (dirs.includes("nexus-system/docs/skills")) {
    const skillsDir = join(l1Dir, "docs/skills");
    const selectedSkills = selectSkills(answers);
    for (const skill of selectedSkills) {
      const srcPath = join(skillsDir, `${skill}.md`);
      const destPath = join(targetDir, "nexus-system", "docs", "skills", `${skill}.md`);
      copySync(srcPath, destPath);
      result.filesCreated.push(`nexus-system/docs/skills/${skill}.md`);
    }
  }

  return result;
}

function fillPlaceholders(content: string, answers: UserAnswers): string {
  const stackStr = answers.stack.join(", ") || "a definir";
  const dbStr = answers.database || "a definir";
  const stylingStr = answers.styling || "a definir";

  return content
    .replace(
      /\[PERSONALIZAR: linguagens, frameworks e tecnologias usados\]/g,
      stackStr
    )
    .replace(
      /\[PERSONALIZAR: regras de estilização do projecto\]/g,
      `Usar apenas ${stylingStr} para estilização`
    )
    .replace(
      /\[PERSONALIZAR: SGBD e convenções usados\]/g,
      dbStr
    )
    .replace(
      /\[PERSONALIZAR: biblioteca de validação usada\]/g,
      "Validação de dados na camada de entrada"
    )
    .replace(
      /\[PERSONALIZAR: referência ao roadmap do projecto, se existir\]/g,
      "[Adicionar referência ao roadmap se existir]"
    )
    .replace(
      /\[PERSONALIZAR: regras específicas de ambiente de teste e deploy, se aplicável\]/g,
      "[Adicionar regras de ambiente se aplicável]"
    )
    .replace(
      /\[PERSONALIZAR: regras específicas do design system do projecto[\s\S]*?\]/g,
      `[Adicionar regras do design system: ${stylingStr}]`
    )
    .replace(
      /\[PERSONALIZAR: ex: T-shaped\]/g,
      "T-shaped"
    )
    .replace(
      /\[PERSONALIZAR: ex: senior\]/g,
      answers.teamLevel === "junior" ? "pleno" : answers.teamLevel
    )
    .replace(
      /\[PERSONALIZAR: ex: junior-pleno\]/g,
      answers.teamLevel
    )
    .replace(
      /\[PERSONALIZAR: ex: peer \(par a par\)\]/g,
      "peer"
    )
    .replace(
      /\[PERSONALIZAR: ex: mentor \(explicativo\)\]/g,
      answers.teamLevel === "junior" ? "mentor" : "peer"
    )
    .replace(
      /\[PERSONALIZAR: ex: calibrado por camada\]/g,
      "calibrado por camada"
    )
    .replace(
      /opencode\/\[modelo-principal\]/g,
      `opencode/${answers.principalModel.replace(/^opencode\//, "")}`
    )
    .replace(
      /opencode\/\[modelo-executor\]/g,
      `opencode/${answers.executorModel.replace(/^opencode\//, "")}`
    );
}

function selectSkills(answers: UserAnswers): string[] {
  // Base skills always included
  const skills = [
    "senior-engineer",
    "tdd_workflow",
    "clean_code_standards",
    "solid_principles",
    "architectural_integrity",
    "design_patterns",
    "error_handling_observability",
    "pnpm_management",
    "optimistic_ui",
  ];

  return skills;
}
