import inquirer from "inquirer";
import type { ProjectAnalysis } from "./analyser.js";

export interface UserAnswers {
  principalModel: string;
  executorModel: string;
  stack: string[];
  database: string;
  styling: string;
  teamLevel: "junior" | "pleno" | "senior";
}

export async function askQuestions(
  analysis: ProjectAnalysis
): Promise<UserAnswers> {
  console.log("");

  const answers = await inquirer.prompt([
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
      choices: [
        "PostgreSQL",
        "MySQL",
        "SQLite",
        "MongoDB",
        "Supabase",
        "Firebase",
        "Nenhum",
        "Outro",
      ],
    },
    {
      type: "list",
      name: "styling",
      message: "Framework de estilização:",
      choices: [
        "Tailwind CSS",
        "CSS Modules",
        "Styled Components",
        "Emotion",
        "Tamagui",
        "NativeWind",
        "Nenhum (CSS puro)",
        "Outro",
      ],
    },
    {
      type: "list",
      name: "teamLevel",
      message: "Nível da equipa (determina nível de governança):",
      choices: [
        { name: "Junior (governança mínima: docs + scripts)", value: "junior" },
        { name: "Pleno (governança intermediária: + governance)", value: "pleno" },
        { name: "Senior (governança completa: + cognition + todos os sub-directórios)", value: "senior" },
      ],
    },
  ]);

  return answers as UserAnswers;
}
