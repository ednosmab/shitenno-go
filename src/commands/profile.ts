/**
 * profile.ts — User Profile Management
 *
 * The `nexus profile` command. Allows users to view, set, and update
 * their profile for personalized feedback.
 *
 * Usage:
 *   nexus profile                    # Show current profile
 *   nexus profile --set              # Interactive setup
 *   nexus profile --name "Edson"     # Set name
 *   nexus profile --role "Tech Lead em Formação"  # Set role
 *   nexus profile --architecture senior  # Set architecture level
 *   nexus profile --coding pleno     # Set coding level
 *   nexus profile --leadership senior # Set leadership level
 *   nexus profile --tone mentor      # Set feedback tone
 *   nexus profile --language pt      # Set language
 *   nexus profile --code-free 95     # Set code-free percentage
 *   nexus profile --focus "visão,leadership"  # Set focus areas
 */

import { Command } from "commander";
import chalk from "chalk";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { guardNotInitialized, checkLifecycleGate } from "../shared.js";
import { outputJson } from "../formatting.js";
import {
  loadUserProfile,
  saveUserProfile,
  type UserProfile,
  type SkillLevel,
  type FeedbackTone,
} from "../feedback-engine.js";
import { getEventBus } from "../event-bus.js";

// ── Helpers ────────────────────────────────────────────────────────────────

function displayProfile(profile: UserProfile): void {
  console.log("");
  console.log(chalk.bold.cyan("  ╔══════════════════════════════════════╗"));
  console.log(chalk.bold.cyan("  ║      nexus profile — User Profile    ║"));
  console.log(chalk.bold.cyan("  ╚══════════════════════════════════════╝"));
  console.log("");
  console.log(chalk.bold("  📋 Perfil Actual"));
  console.log(`     Nome:          ${chalk.cyan(profile.name)}`);
  console.log(`     Cargo:         ${chalk.cyan(profile.role)}`);
  console.log(`     Arquitectura:  ${chalk.cyan(profile.architecture)}`);
  console.log(`     Código:        ${chalk.cyan(profile.coding)}`);
  console.log(`     Leadership:    ${chalk.cyan(profile.leadership)}`);
  console.log(`     Tom:           ${chalk.cyan(profile.tone)}`);
  console.log(`     Idioma:        ${chalk.cyan(profile.language)}`);
  console.log(`     % No-code:     ${chalk.cyan(String(profile.codeFreePercent))}%`);
  console.log(`     Áreas foco:    ${chalk.cyan(profile.focusAreas.join(", ") || "nenhuma")}`);
  console.log("");

  // Calibration preview
  const toneLabel = profile.tone === "mentor" ? "Mentor (suportivo, didático)"
    : profile.tone === "peer" ? "Peer (direto, entre pares)"
    : "Relatório (técnico, impessoal)";
  console.log(chalk.bold("  🎯 Calibragem de Feedback"));
  console.log(`     Tom:           ${toneLabel}`);
  console.log(`     No-code:       ${profile.codeFreePercent >= 80 ? "Forte (foco em visão/leadership)" : profile.codeFreePercent >= 50 ? "Moderado" : "Técnico (foco em código)"}`);
  console.log("");
  console.log(chalk.gray("  Para alterar: nexus profile --name 'Novo Nome'"));
  console.log(chalk.gray("  Para configurar interactivamente: nexus profile --set"));
  console.log("");
}

// ── Command ────────────────────────────────────────────────────────────────

export function profileCommand(): Command {
  const cmd = new Command("profile")
    .description("View and update your user profile for personalized feedback")
    .option("-d, --dir <path>", "Project directory")
    .option("--set", "Interactive profile setup")
    .option("--name <name>", "Set user name")
    .option("--role <role>", "Set role description")
    .option("--architecture <level>", "Set architecture skill level (junior/pleno/senior)")
    .option("--coding <level>", "Set coding skill level (junior/pleno/senior)")
    .option("--leadership <level>", "Set leadership skill level (junior/pleno/senior)")
    .option("--tone <tone>", "Set feedback tone (mentor/peer/relatorio)")
    .option("--language <lang>", "Set language (pt/en)")
    .option("--code-free <percent>", "Set code-free percentage (0-100)")
    .option("--focus <areas>", "Set focus areas (comma-separated)")
    .option("--json", "Output as JSON")
    .action(async function (this: Command, options: Record<string, unknown>) {
      const isJson = options.json === true;

      const ctx = guardNotInitialized(options, isJson);
      if (!ctx) return;

      if (!checkLifecycleGate("profile", ctx.projectRoot, ctx.nexusDir, isJson)) {
        return;
      }

      const profile = loadUserProfile(ctx.nexusDir);
      let updated = false;

      // ── Interactive setup ────────────────────────────────────────
      if (options.set) {
        if (isJson) {
          outputJson({
            error: "interactive_not_supported",
            message: "Interactive setup not supported with --json. Use individual flags.",
          });
          return;
        }

        console.log("");
        console.log(chalk.bold.cyan("  ╔══════════════════════════════════════╗"));
        console.log(chalk.bold.cyan("  ║   nexus profile — Setup Interactivo  ║"));
        console.log(chalk.bold.cyan("  ╚══════════════════════════════════════╝"));
        console.log("");
        console.log(chalk.gray("  Pressiona Enter para manter o valor actual."));
        console.log("");

        const readline = await import("node:readline");
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        const ask = (question: string, current: string): Promise<string> => {
          return new Promise((resolve) => {
            rl.question(`  ${question} (${chalk.gray(current)}): `, (answer) => {
              resolve(answer.trim() || current);
            });
          });
        };

        profile.name = await ask("Nome", profile.name);
        profile.role = await ask("Cargo", profile.role);
        profile.architecture = await ask("Arquitectura (junior/pleno/senior)", profile.architecture) as SkillLevel;
        profile.coding = await ask("Código (junior/pleno/senior)", profile.coding) as SkillLevel;
        profile.leadership = await ask("Leadership (junior/pleno/senior)", profile.leadership) as SkillLevel;
        profile.tone = await ask("Tom (mentor/peer/relatorio)", profile.tone) as FeedbackTone;
        profile.language = await ask("Idioma (pt/en)", profile.language) as "pt" | "en";
        profile.codeFreePercent = parseInt(await ask("% No-code (0-100)", String(profile.codeFreePercent)), 10);
        profile.focusAreas = (await ask("Áreas foco (vírgula-separado)", profile.focusAreas.join(", ")))
          .split(",")
          .map((a: string) => a.trim())
          .filter(Boolean);

        rl.close();
        updated = true;
      }

      // ── Individual flags ─────────────────────────────────────────
      if (options.name) {
        profile.name = String(options.name);
        updated = true;
      }
      if (options.role) {
        profile.role = String(options.role);
        updated = true;
      }
      if (options.architecture) {
        const val = String(options.architecture) as SkillLevel;
        if (!["junior", "pleno", "senior"].includes(val)) {
          if (isJson) {
            outputJson({ error: "invalid_level", message: "Level must be junior, pleno, or senior" });
          } else {
            console.log(chalk.red("  ✘ Level must be junior, pleno, or senior"));
          }
          return;
        }
        profile.architecture = val;
        updated = true;
      }
      if (options.coding) {
        const val = String(options.coding) as SkillLevel;
        if (!["junior", "pleno", "senior"].includes(val)) {
          if (isJson) {
            outputJson({ error: "invalid_level", message: "Level must be junior, pleno, or senior" });
          } else {
            console.log(chalk.red("  ✘ Level must be junior, pleno, or senior"));
          }
          return;
        }
        profile.coding = val;
        updated = true;
      }
      if (options.leadership) {
        const val = String(options.leadership) as SkillLevel;
        if (!["junior", "pleno", "senior"].includes(val)) {
          if (isJson) {
            outputJson({ error: "invalid_level", message: "Level must be junior, pleno, or senior" });
          } else {
            console.log(chalk.red("  ✘ Level must be junior, pleno, or senior"));
          }
          return;
        }
        profile.leadership = val;
        updated = true;
      }
      if (options.tone) {
        const val = String(options.tone) as FeedbackTone;
        if (!["mentor", "peer", "relatorio"].includes(val)) {
          if (isJson) {
            outputJson({ error: "invalid_tone", message: "Tone must be mentor, peer, or relatorio" });
          } else {
            console.log(chalk.red("  ✘ Tone must be mentor, peer, or relatorio"));
          }
          return;
        }
        profile.tone = val;
        updated = true;
      }
      if (options.language) {
        const val = String(options.language) as "pt" | "en";
        if (!["pt", "en"].includes(val)) {
          if (isJson) {
            outputJson({ error: "invalid_language", message: "Language must be pt or en" });
          } else {
            console.log(chalk.red("  ✘ Language must be pt or en"));
          }
          return;
        }
        profile.language = val;
        updated = true;
      }
      if (options["code-free"]) {
        const val = parseInt(String(options["code-free"]), 10);
        if (isNaN(val) || val < 0 || val > 100) {
          if (isJson) {
            outputJson({ error: "invalid_percent", message: "Code-free must be 0-100" });
          } else {
            console.log(chalk.red("  ✘ Code-free must be 0-100"));
          }
          return;
        }
        profile.codeFreePercent = val;
        updated = true;
      }
      if (options.focus) {
        profile.focusAreas = String(options.focus)
          .split(",")
          .map((a: string) => a.trim())
          .filter(Boolean);
        updated = true;
      }

      // ── Save if updated ──────────────────────────────────────────
      if (updated) {
        saveUserProfile(ctx.nexusDir, profile);

        if (isJson) {
          outputJson({ type: "profile_updated", ...profile });
        } else {
          console.log(chalk.green("  ✔ Perfil actualizado com sucesso."));
          displayProfile(profile);
        }

        getEventBus().publish("analysis.complete", {
          type: "profile_updated",
          profile: { name: profile.name, role: profile.role },
        });
        return;
      }

      // ── Display current profile ──────────────────────────────────
      if (isJson) {
        outputJson({ type: "profile", ...profile });
      } else {
        displayProfile(profile);
      }
    });

  return cmd;
}
