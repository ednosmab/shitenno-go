import { writeFileSync, existsSync, mkdirSync, chmodSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const HOOK_MARKER = "# nexus-managed-hook";

function findGitHooksDir(projectRoot: string): string | null {
  try {
    const dir = execSync("git rev-parse --git-path hooks", { cwd: projectRoot, encoding: "utf-8" }).trim();
    return join(projectRoot, dir);
  } catch {
    return null;
  }
}

function usesHusky(projectRoot: string): boolean {
  return existsSync(join(projectRoot, ".husky"));
}

export function installReactiveHooks(
  projectRoot: string,
  nexusBinPath: string
): { installed: string[]; skipped: string[] } {
  const installed: string[] = [];
  const skipped: string[] = [];

  const huskyDir = join(projectRoot, ".husky");
  const gitHooksDir = findGitHooksDir(projectRoot);

  const targetDir = usesHusky(projectRoot) ? huskyDir : gitHooksDir;

  if (!targetDir) return { installed: [], skipped: ["not-a-git-repo"] };
  if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true });

  for (const hookName of ["post-commit", "post-merge"] as const) {
    const hookPath = join(targetDir, hookName);
    const nexusLine = `${nexusBinPath} detect --auto 2>/dev/null &`;

    if (existsSync(hookPath)) {
      const existing = readFileSync(hookPath, "utf-8");
      if (existing.includes(HOOK_MARKER)) {
        skipped.push(`${hookName} (já instalado)`);
        continue;
      }
      writeFileSync(hookPath, `${existing}\n${HOOK_MARKER}\n${nexusLine}\n`);
    } else {
      writeFileSync(hookPath, `#!/bin/sh\n${HOOK_MARKER}\n${nexusLine}\n`);
    }
    chmodSync(hookPath, 0o755);
    installed.push(hookName);
  }
  return { installed, skipped };
}
