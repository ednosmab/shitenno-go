import fse from "fs-extra";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { UserAnswers } from "./prompts.js";

const { copySync, ensureDirSync, readFileSync, writeFileSync, existsSync, readdirSync, removeSync } = fse;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEMPLATES_DIR = join(__dirname, "templates");

export interface ScaffoldResult {
  filesCreated: string[];
  directoriesCreated: string[];
  level: string;
}

function getDirectoriesForLevel(level: string): string[] {
  // L1 Base: Junior - docs + scripts + core + governance + profile
  const junior = [
    "nexus-system",
    "nexus-system/docs",
    "nexus-system/docs/skills",
    "nexus-system/scripts",
    "nexus-system/core",
    "nexus-system/core/complexity",
    "nexus-system/governance",
    "nexus-system/governance/agents",
    "nexus-system/governance/context",
    "nexus-profile",
    "nexus-system/docs/feedback",
  ];

  if (level === "junior") return junior;

  // L2 Intermediária: Pleno - governance already in junior
  const pleno = [...junior];

  if (level === "pleno") return pleno;

  // L3 Completa: Senior - + cognition + todos os sub-directórios
  return [
    ...pleno,
    "nexus-system/cognition",
    "nexus-system/cognition/context",
    "nexus-system/cognition/memory",
    "nexus-system/cognition/prompts",
    "nexus-system/cognition/prompts/executor",
    "nexus-system/cognition/prompts/planner",
    "nexus-system/cognition/prompts/reviewer",
    "nexus-system/governance/contracts",
    "nexus-system/governance/handoffs",
    "nexus-system/governance/policies",
    "nexus-system/governance/premortem",
    "nexus-system/governance/reviews",
    "nexus-system/docs/adrs",
    "nexus-system/docs/history",
    "nexus-system/docs/layers",
    "nexus-system/docs/plans",
    "nexus-system/docs/roadmaps",
    "nexus-system/docs/sdr",
    "nexus-system/reports",
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
    // Core complexity types
    { src: "core/complexity/types.ts", dest: "nexus-system/core/complexity/types.ts" },
    // Feedback template
    { src: "docs/feedback/README.md", dest: "nexus-system/docs/feedback/README.md" },
    // Agent contracts (all 4 roles)
    { src: "governance/agents/AI-CONTRACT-planner-v1.yaml", dest: "nexus-system/governance/agents/AI-CONTRACT-planner-v1.yaml" },
    { src: "governance/agents/AI-CONTRACT-executor-v1.yaml", dest: "nexus-system/governance/agents/AI-CONTRACT-executor-v1.yaml" },
    { src: "governance/agents/AI-CONTRACT-reviewer-v1.yaml", dest: "nexus-system/governance/agents/AI-CONTRACT-reviewer-v1.yaml" },
    { src: "governance/agents/AI-CONTRACT-orchestrator-v1.yaml", dest: "nexus-system/governance/agents/AI-CONTRACT-orchestrator-v1.yaml" },
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
    // Cognition
    { src: "cognition/context/CONTEXT_HIERARCHY.md", dest: "nexus-system/cognition/context/CONTEXT_HIERARCHY.md" },
    { src: "cognition/memory/MEM-operational-state-v1.json", dest: "nexus-system/cognition/memory/MEM-operational-state-v1.json" },
    { src: "cognition/prompts/executor/README.md", dest: "nexus-system/cognition/prompts/executor/README.md" },
    { src: "cognition/prompts/planner/README.md", dest: "nexus-system/cognition/prompts/planner/README.md" },
    { src: "cognition/prompts/reviewer/README.md", dest: "nexus-system/cognition/prompts/reviewer/README.md" },
    // Governance — contracts, handoffs, premortem, reviews
    { src: "governance/contracts/CONTRACTS_INDEX.md", dest: "nexus-system/governance/contracts/CONTRACTS_INDEX.md" },
    { src: "governance/handoffs/TEMPLATE.md", dest: "nexus-system/governance/handoffs/TEMPLATE.md" },
    { src: "governance/premortem/PREMORTEM.md", dest: "nexus-system/governance/premortem/PREMORTEM.md" },
    { src: "governance/reviews/SESSION_REVIEW.md", dest: "nexus-system/governance/reviews/SESSION_REVIEW.md" },
    // Docs — ADRs, SDRs, plans, session, runbooks
    { src: "docs/adrs/ADR-TEMPLATE.md", dest: "nexus-system/docs/adrs/ADR-TEMPLATE.md" },
    { src: "docs/sdr/SDR-TEMPLATE.md", dest: "nexus-system/docs/sdr/SDR-TEMPLATE.md" },
    { src: "docs/plans/TEMPLATE.md", dest: "nexus-system/docs/plans/TEMPLATE.md" },
    { src: "docs/session-template.md", dest: "nexus-system/docs/session-template.md" },
    { src: "docs/runbooks/merge.md", dest: "nexus-system/docs/runbooks/merge.md" },
    // Reports
    { src: "docs/reports/README.md", dest: "nexus-system/reports/README.md" },
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

  // Generate ProjectProfile (auto-detected from analysis)
  const profileTemplate = readFileSync(
    join(l1Dir, "nexus-profile", "_template.config.ts"),
    "utf-8"
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

  // Remove template file (user only needs the generated config)
  const templatePath = join(targetDir, "nexus-profile", "_template.config.ts");
  if (existsSync(templatePath)) {
    removeSync(templatePath);
  }

  // Add feedback/ to .gitignore (private session data, not versioned)
  const gitignorePath = join(targetDir, ".gitignore");
  let gitignoreContent = "";
  if (existsSync(gitignorePath)) {
    gitignoreContent = readFileSync(gitignorePath, "utf-8");
  }
  if (!gitignoreContent.includes("nexus-system/docs/feedback")) {
    const feedbackIgnore = "\n# Nexus System — feedback de sessão (dado privado, não versionado)\nnexus-system/docs/feedback/\n";
    writeFileSync(gitignorePath, gitignoreContent + feedbackIgnore, "utf-8");
  }

  // Copy selected skills (only if docs/skills exists)
  if (dirs.includes("nexus-system/docs/skills")) {
    const skillsDir = join(l1Dir, "docs/skills");
    const selectedSkills = selectSkills(answers.teamLevel);
    for (const skill of selectedSkills) {
      const srcPath = join(skillsDir, `${skill}.md`);
      if (!existsSync(srcPath)) continue; // skip missing template files
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

function selectSkills(level: string): string[] {
  // L1 Junior: 11 core engineering skills (genéricas puras + essenciais)
  const juniorSkills = [
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

  // L2 Pleno: + 7 intermediate skills (mistas especializadas)
  const plenoExtra = [
    "animation_protocol",
    "ci_cd_pipeline",
    "ddd_patterns",
    "responsividade",
    "state_management_protocol",
    "ui_ux_principles",
    "operacao_no_nexus",
  ];

  // L3 Senior: + 3 advanced skills (performance, security, infra)
  const seniorExtra = [
    "nextjs_performance_seo",
    "postgresql_performance",
    "security_xss_prevention",
  ];

  if (level === "junior") return juniorSkills;
  if (level === "pleno") return [...juniorSkills, ...plenoExtra];
  return [...juniorSkills, ...plenoExtra, ...seniorExtra];
}
