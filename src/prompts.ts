/**
 * prompts.ts — Questionário de Descoberta de Maturidade
 *
 * Substitui a seleção simples de nível (L1/L2/L3) por um questionário
 * multi-categoria que permite ao Nexus construir um perfil de maturidade.
 *
 * PRINCÍPIO: O usuário responde perguntas — o Nexus determina a configuração.
 */

import inquirer from "inquirer";
import chalk from "chalk";
import type { ProjectAnalysis } from "./analyser.js";
import type { MaturityAnswers } from "./maturity-profile.js";

export interface UserAnswers {
  principalModel: string;
  executorModel: string;
  stack: string[];
  database: string;
  styling: string;
  maturity: MaturityAnswers;
  /** Capacidades selecionadas pelo usuário (override do perfil) */
  selectedCapabilities?: string[];
  /** Whether to register nexus-mcp in .mcp.json */
  enableMcpRegistration?: boolean;
  /** User profile for personalized feedback */
  userProfile?: {
    name: string;
    role: string;
    architecture: "junior" | "pleno" | "senior";
    coding: "junior" | "pleno" | "senior";
    leadership: "junior" | "pleno" | "senior";
    tone: "mentor" | "peer" | "relatorio";
    language: "pt" | "en";
    codeFreePercent: number;
    focusAreas: string[];
  };
}

/**
 * Questionário de descoberta de maturidade.
 * Cada pergunta contribui para uma dimensão do perfil.
 */
export async function askQuestions(
  analysis: ProjectAnalysis
): Promise<UserAnswers> {
  console.log("");

  // ── Bloco 1: Configuração IA ──
  console.log(chalk.bold.cyan("  ╭──────────────────────────────────────╮"));
  console.log(chalk.bold.cyan("  │   🤖  Configuração IA               │"));
  console.log(chalk.bold.cyan("  ╰──────────────────────────────────────╯"));
  console.log("");

  const aiConfig = await inquirer.prompt([
    {
      type: "input",
      name: "principalModel",
      message: "Modelo de IA principal (para planning/review):",
      default: "opencode/mimo-v2.5-free",
    },
    {
      type: "input",
      name: "executorModel",
      message: "Modelo de IA para build/executor:",
      default: "opencode/deepseek-v4-flash-free",
    },
  ]);

  // ── Bloco 2: Stack Tecnológica ──
  console.log("");
  console.log(chalk.bold.cyan("  ╭──────────────────────────────────────╮"));
  console.log(chalk.bold.cyan("  │   📦  Stack Tecnológica              │"));
  console.log(chalk.bold.cyan("  ╰──────────────────────────────────────╯"));
  console.log("");

  const stackConfig = await inquirer.prompt([
    {
      type: "checkbox",
      name: "stack",
      message: "Stack tecnológica detectada:",
      choices: [
        { name: "React", value: "react", checked: analysis.stack.includes("react") },
        { name: "Next.js", value: "nextjs", checked: analysis.stack.includes("nextjs") },
        { name: "Vue", value: "vue", checked: analysis.stack.includes("vue") },
        { name: "Nuxt", value: "nuxt", checked: analysis.stack.includes("nuxt") },
        { name: "Svelte", value: "svelte", checked: analysis.stack.includes("svelte") },
        { name: "Expo", value: "expo", checked: analysis.stack.includes("expo") },
        { name: "React Native", value: "react-native", checked: analysis.stack.includes("react-native") },
        { name: "Angular", value: "angular", checked: analysis.stack.includes("angular") },
        { name: "TypeScript", value: "typescript", checked: analysis.hasTypeScript },
        { name: "Vite", value: "vite", checked: analysis.stack.includes("vite") },
        { name: "Tailwind CSS", value: "tailwindcss", checked: analysis.stack.includes("tailwindcss") },
        { name: "Outro", value: "other" },
      ],
    },
    {
      type: "list",
      name: "database",
      message: "SGBD / banco de dados:",
      choices: ["PostgreSQL", "MySQL", "SQLite", "MongoDB", "Supabase", "Firebase", "Nenhum", "Outro"],
    },
    {
      type: "list",
      name: "styling",
      message: "Framework de estilização:",
      choices: ["Tailwind CSS", "CSS Modules", "Styled Components", "Emotion", "Tamagui", "NativeWind", "Nenhum (CSS puro)", "Outro"],
    },
  ]);

  // ── Bloco 3: Experiência ──
  console.log("");
  console.log(chalk.bold.cyan("  ╭──────────────────────────────────────╮"));
  console.log(chalk.bold.cyan("  │   👤  Experiência                    │"));
  console.log(chalk.bold.cyan("  ╰──────────────────────────────────────╯"));
  console.log("");

  const experience = await inquirer.prompt([
    {
      type: "confirm",
      name: "usedNexusBefore",
      message: "Já utilizou o Nexus anteriormente?",
      default: false,
    },
    {
      type: "confirm",
      name: "isFirstProject",
      message: "É seu primeiro projeto utilizando o Nexus?",
      default: false,
    },
  ]);

  // ── Bloco 4: Projeto ──
  console.log("");
  console.log(chalk.bold.cyan("  ╭──────────────────────────────────────╮"));
  console.log(chalk.bold.cyan("  │   📁  Projeto                        │"));
  console.log(chalk.bold.cyan("  ╰──────────────────────────────────────╯"));
  console.log("");

  const projectInfo = await inquirer.prompt([
    {
      type: "list",
      name: "projectAge",
      message: "Idade do projeto:",
      choices: [
        { name: "Novo (menos de 1 mês)", value: "new" },
        { name: "Poucos meses (1-6 meses)", value: "few_months" },
        { name: "Estabelecido (6-18 meses)", value: "established" },
        { name: "Maduro (mais de 18 meses)", value: "mature" },
      ],
    },
    {
      type: "list",
      name: "teamSize",
      message: "Tamanho da equipa:",
      choices: [
        { name: "Solo (só eu)", value: "solo" },
        { name: "Pequena (2-3 pessoas)", value: "small" },
        { name: "Média (4-8 pessoas)", value: "medium" },
        { name: "Grande (9+ pessoas)", value: "large" },
      ],
    },
    {
      type: "confirm",
      name: "hasDedicatedTeam",
      message: "Existe equipe dedicada ao projeto?",
      default: false,
    },
  ]);

  // ── Bloco 5: Arquitetura ──
  console.log("");
  console.log(chalk.bold.cyan("  ╭──────────────────────────────────────╮"));
  console.log(chalk.bold.cyan("  │   🏗️   Arquitetura                   │"));
  console.log(chalk.bold.cyan("  ╰──────────────────────────────────────╯"));
  console.log("");

  const architecture = await inquirer.prompt([
    {
      type: "confirm",
      name: "hasArchitectureDocs",
      message: "Existe documentação arquitetural?",
      default: false,
    },
    {
      type: "confirm",
      name: "hasADRs",
      message: "Existem Architecture Decision Records (ADRs)?",
      default: false,
    },
    {
      type: "confirm",
      name: "hasTechnicalReviews",
      message: "Há revisão técnica regular?",
      default: false,
    },
  ]);

  // ── Bloco 6: Qualidade ──
  console.log("");
  console.log(chalk.bold.cyan("  ╭──────────────────────────────────────╮"));
  console.log(chalk.bold.cyan("  │   ✅  Qualidade                      │"));
  console.log(chalk.bold.cyan("  ╰──────────────────────────────────────╯"));
  console.log("");

  // Auto-detect CI/CD from analysis
  const quality = await inquirer.prompt([
    {
      type: "confirm",
      name: "hasCICD",
      message: "Existe CI/CD configurado?",
      default: analysis.hasCI,
    },
    {
      type: "confirm",
      name: "hasAutomatedTests",
      message: "Existem testes automatizados?",
      default: analysis.hasTests,
    },
    {
      type: "confirm",
      name: "hasValidationPipeline",
      message: "Existe pipeline de validação?",
      default: false,
    },
  ]);

  // ── Bloco 7: IA ──
  console.log("");
  console.log(chalk.bold.cyan("  ╭──────────────────────────────────────╮"));
  console.log(chalk.bold.cyan("  │   🧠  Inteligência Artificial         │"));
  console.log(chalk.bold.cyan("  ╰──────────────────────────────────────╯"));
  console.log("");

  const aiUsage = await inquirer.prompt([
    {
      type: "confirm",
      name: "intendsToUseAI",
      message: "Pretende utilizar IA durante o desenvolvimento?",
      default: true,
    },
    {
      type: "confirm",
      name: "aiWillImplement",
      message: "A IA participará da implementação?",
      default: true,
    },
    {
      type: "confirm",
      name: "requiresHumanReview",
      message: "Haverá revisão humana obrigatória?",
      default: true,
    },
  ]);

  // ── Bloco 8: Governança ──
  console.log("");
  console.log(chalk.bold.cyan("  ╭──────────────────────────────────────╮"));
  console.log(chalk.bold.cyan("  │   📋  Governança                     │"));
  console.log(chalk.bold.cyan("  ╰──────────────────────────────────────╯"));
  console.log("");

  const governance = await inquirer.prompt([
    {
      type: "confirm",
      name: "hasDefinedPatterns",
      message: "Existem padrões definidos?",
      default: false,
    },
    {
      type: "confirm",
      name: "hasReviewProcess",
      message: "Existe processo de revisão?",
      default: false,
    },
    {
      type: "confirm",
      name: "hasDecisionControl",
      message: "Existe controle de decisões?",
      default: false,
    },
  ]);

  // ── Bloco 9: Perfil do Usuário ──
  console.log("");
  console.log(chalk.bold.cyan("  ╭──────────────────────────────────────╮"));
  console.log(chalk.bold.cyan("  │   👤  Perfil do Usuário              │"));
  console.log(chalk.bold.cyan("  ╰──────────────────────────────────────╯"));
  console.log("");
  console.log(chalk.gray("  Para feedback personalizado. Pode configurar depois com 'nexus profile'."));
  console.log("");

  const userProfile = await inquirer.prompt([
    {
      type: "input",
      name: "name",
      message: "O teu nome:",
      default: "Developer",
    },
    {
      type: "list",
      name: "role",
      message: "O teu cargo/role:",
      choices: [
        { name: "Tech Lead em Formação", value: "Tech Lead em Formação" },
        { name: "Senior Developer", value: "Senior Developer" },
        { name: "Junior Developer", value: "Junior Developer" },
        { name: "Pleno Developer", value: "Pleno Developer" },
        { name: "Architect", value: "Architect" },
        { name: "Engineering Manager", value: "Engineering Manager" },
        { name: "Outro", value: "Outro" },
      ],
    },
    {
      type: "list",
      name: "architecture",
      message: "Nível de Arquitectura:",
      choices: [
        { name: "Júnior — ainda a aprender padrões", value: "junior" },
        { name: "Pleno — conhece bem os fundamentos", value: "pleno" },
        { name: "Sênior — domina system design", value: "senior" },
      ],
    },
    {
      type: "list",
      name: "coding",
      message: "Nível de Código:",
      choices: [
        { name: "Júnior — ainda a aprender", value: "junior" },
        { name: "Pleno — escreve bem", value: "pleno" },
        { name: "Sênior — domina padrões e optimização", value: "senior" },
      ],
    },
    {
      type: "list",
      name: "leadership",
      message: "Nível de Leadership:",
      choices: [
        { name: "Júnior — foco em execução", value: "junior" },
        { name: "Pleno — começa a guiar", value: "pleno" },
        { name: "Sênior — guia o time", value: "senior" },
      ],
    },
    {
      type: "list",
      name: "tone",
      message: "Tom de feedback preferido:",
      choices: [
        { name: "Mentor — suportivo, didático, encorajador", value: "mentor" },
        { name: "Peer — directo, entre pares", value: "peer" },
        { name: "Relatório — técnico, impessoal", value: "relatorio" },
      ],
    },
    {
      type: "list",
      name: "language",
      message: "Idioma do feedback:",
      choices: [
        { name: "Português", value: "pt" },
        { name: "English", value: "en" },
      ],
    },
    {
      type: "input",
      name: "codeFreePercent",
      message: "Percentagem de feedback no-code (0-100):",
      default: "50",
      validate: (value: string) => {
        const num = parseInt(value, 10);
        if (isNaN(num) || num < 0 || num > 100) return "Deve ser um número entre 0 e 100";
        return true;
      },
    },
    {
      type: "input",
      name: "focusAreas",
      message: "Áreas de foco (vírgula-separado, ex: visão,leadership):",
      default: "",
    },
  ]);

  // ── Bloco 10: MCP Server ──
  console.log("");
  console.log(chalk.bold.cyan("  ╭──────────────────────────────────────╮"));
  console.log(chalk.bold.cyan("  │   🔌  MCP Server                     │"));
  console.log(chalk.bold.cyan("  ╰──────────────────────────────────────╯"));
  console.log("");
  console.log(chalk.gray("  Regista o nexus-mcp em .mcp.json para AI agents (Claude Code, Cursor, etc.)."));
  console.log("");

  const mcpConfig = await inquirer.prompt([
    {
      type: "confirm",
      name: "enableMcpRegistration",
      message: "Registar servidor MCP (.mcp.json)?",
      default: true,
    },
  ]);

  return {
    principalModel: aiConfig.principalModel,
    executorModel: aiConfig.executorModel,
    stack: stackConfig.stack,
    database: stackConfig.database,
    styling: stackConfig.styling,
    enableMcpRegistration: mcpConfig.enableMcpRegistration,
    maturity: {
      ...experience,
      ...projectInfo,
      ...architecture,
      ...quality,
      ...aiUsage,
      ...governance,
    },
    userProfile: {
      name: userProfile.name,
      role: userProfile.role,
      architecture: userProfile.architecture as "junior" | "pleno" | "senior",
      coding: userProfile.coding as "junior" | "pleno" | "senior",
      leadership: userProfile.leadership as "junior" | "pleno" | "senior",
      tone: userProfile.tone as "mentor" | "peer" | "relatorio",
      language: userProfile.language as "pt" | "en",
      codeFreePercent: parseInt(userProfile.codeFreePercent, 10),
      focusAreas: userProfile.focusAreas
        ? userProfile.focusAreas.split(",").map((a: string) => a.trim()).filter(Boolean)
        : [],
    },
  };
}
