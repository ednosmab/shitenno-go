import { existsSync, readFileSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

export interface CompletionGate {
  name: string;
  passed: boolean;
  message: string;
}

export interface CompletionResult {
  taskId: string;
  passed: boolean;
  gates: CompletionGate[];
}

export interface CompletionGateOptions {
  projectRoot: string;
  nexusDir: string;
  affectedFiles?: string[];
  taskId: string;
  /** Optional exec function override (for testing) */
  execFn?: typeof execSync;
}

export function validateCompletionGate(
  options: CompletionGateOptions
): CompletionResult {
  const execFn = options.execFn ?? execSync;
  const gates: CompletionGate[] = [];

  gates.push(checkTestPass(options.projectRoot, execFn));
  gates.push(checkLintPass(options.projectRoot, execFn));
  gates.push(checkDocumentationUpdated(options.projectRoot, options.nexusDir, execFn, options.affectedFiles));
  gates.push(checkBacklogUpdated(options.nexusDir, options.taskId));
  gates.push(checkPlanStatus(options.nexusDir, options.taskId));

  const allPassed = gates.every((g) => g.passed);

  return {
    taskId: options.taskId,
    passed: allPassed,
    gates,
  };
}

function checkTestPass(projectRoot: string, execFn: typeof execSync): CompletionGate {
  try {
    execFn("pnpm run test --recursive --if-present --filter=core 2>/dev/null | tail -1", {
      cwd: projectRoot,
      timeout: 120000,
      stdio: "pipe",
    });
    return { name: "tests", passed: true, message: "All tests pass" };
  } catch {
    return { name: "tests", passed: false, message: "Tests failed or not executed" };
  }
}

function checkLintPass(projectRoot: string, execFn: typeof execSync): CompletionGate {
  try {
    execFn("pnpm run lint 2>/dev/null", {
      cwd: projectRoot,
      timeout: 60000,
      stdio: "pipe",
    });
    return { name: "lint", passed: true, message: "Lint passes" };
  } catch {
    return { name: "lint", passed: false, message: "Lint failed or not run" };
  }
}

function checkDocumentationUpdated(
  projectRoot: string,
  _nexusDir: string,
  execFn: typeof execSync,
  affectedFiles?: string[]
): CompletionGate {
  if (!affectedFiles || affectedFiles.length === 0) {
    return {
      name: "documentation",
      passed: true,
      message: "No affected files specified — skipping documentation check",
    };
  }

  try {
    const diffOutput = execFn("git diff --name-only --diff-filter=M 2>/dev/null", {
      cwd: projectRoot,
      timeout: 10000,
      encoding: "utf-8",
    });

    const stagedOutput = execFn("git diff --cached --name-only 2>/dev/null", {
      cwd: projectRoot,
      timeout: 10000,
      encoding: "utf-8",
    });

    const modifiedFiles = [
      ...diffOutput.trim().split("\n").filter(Boolean),
      ...stagedOutput.trim().split("\n").filter(Boolean),
    ];

    const docFiles = affectedFiles.filter(
      (f) => f.endsWith(".md") || f.includes("docs/") || f.includes("README")
    );

    if (docFiles.length === 0) {
      return {
        name: "documentation",
        passed: true,
        message: "No documentation files affected — skipping",
      };
    }

    const modifiedDocFiles = docFiles.filter((f) =>
      modifiedFiles.some((m) => m.includes(f) || f.includes(m))
    );

    if (modifiedDocFiles.length >= docFiles.length) {
      return {
        name: "documentation",
        passed: true,
        message: `All ${docFiles.length} documentation file(s) updated`,
      };
    }

    const missing = docFiles.filter(
      (f) => !modifiedFiles.some((m) => m.includes(f) || f.includes(m))
    );

    return {
      name: "documentation",
      passed: false,
      message: `Documentation not updated: ${missing.join(", ")}`,
    };
  } catch {
    return {
      name: "documentation",
      passed: true,
      message: "Could not check documentation (no git history) — skipping",
    };
  }
}

function checkBacklogUpdated(nexusDir: string, taskId: string): CompletionGate {
  const backlogPaths = [
    join(nexusDir, "docs", "BACKLOG.md"),
    join(nexusDir, "..", "nexus-system", "docs", "BACKLOG.md"),
  ];

  for (const path of backlogPaths) {
    if (existsSync(path)) {
      const content = readFileSync(path, "utf-8");
      const pattern = `### ${taskId}`;
      const idx = content.indexOf(pattern);
      if (idx === -1) continue;

      const section = content.slice(idx, idx + 200);
      if (section.includes("Done") || section.includes("concluído") || section.includes("concluido")) {
        return {
          name: "backlog",
          passed: true,
          message: `Task ${taskId} marked as Done in BACKLOG.md`,
        };
      }
      return {
        name: "backlog",
        passed: false,
        message: `Task ${taskId} found but not marked as Done in BACKLOG.md`,
      };
    }
  }

  return {
    name: "backlog",
    passed: true,
    message: "No BACKLOG.md found — skipping",
  };
}

function checkPlanStatus(nexusDir: string, taskId: string): CompletionGate {
  const plansDir = join(nexusDir, "governance", "plans");
  if (!existsSync(plansDir)) {
    return {
      name: "plan_status",
      passed: true,
      message: "No plans directory found — skipping",
    };
  }

  try {
    const files = readdirSync(plansDir).filter(
      (f: string) => f.endsWith(".md") && !f.startsWith("TEMPLATE")
    );

    const matchingPlan = files.find((f: string) => {
      const id = f.replace(".md", "").toLowerCase();
      return id.includes(taskId.toLowerCase()) || taskId.toLowerCase().includes(id);
    });

    if (!matchingPlan) {
      return {
        name: "plan_status",
        passed: true,
        message: `No active plan found for task ${taskId} — skipping`,
      };
    }

    const planPath = join(plansDir, matchingPlan);
    const content = readFileSync(planPath, "utf-8");

    const statusMatch = content.match(/\*\*Status:\*\*\s*(.+)/i);
    if (!statusMatch) {
      return {
        name: "plan_status",
        passed: false,
        message: `Plan ${matchingPlan} has no status field`,
      };
    }

    const statusValue = statusMatch[1] || "";
    const status = statusValue.trim().toLowerCase();
    if (status === "done" || status === "concluído" || status === "concluido") {
      return {
        name: "plan_status",
        passed: true,
        message: `Plan ${matchingPlan} status is "${statusValue.trim()}"`,
      };
    }

    return {
      name: "plan_status",
      passed: false,
      message: `Plan ${matchingPlan} status is "${statusValue.trim()}" — run "nexus plan md done ${matchingPlan.replace(".md", "")}" to archive`,
    };
  } catch {
    return {
      name: "plan_status",
      passed: true,
      message: "Could not check plan status — skipping",
    };
  }
}
