import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { analyseProject } from "../analyser.js";

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "nexus-analyser-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("analyseProject", () => {
  it("detects basic project properties", () => {
    const result = analyseProject(tempDir);
    expect(result.rootDir).toBe(tempDir);
    expect(result.hasGit).toBe(false);
    expect(result.hasPackageJson).toBe(false);
    expect(result.hasNexus).toBe(false);
  });

  it("detects git repository", () => {
    mkdirSync(join(tempDir, ".git"), { recursive: true });
    const result = analyseProject(tempDir);
    expect(result.hasGit).toBe(true);
  });

  it("detects package.json and counts dependencies", () => {
    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify({
        dependencies: { react: "^18.0.0", next: "^14.0.0" },
        devDependencies: { typescript: "^5.0.0" },
      })
    );
    const result = analyseProject(tempDir);
    expect(result.hasPackageJson).toBe(true);
    expect(result.dependencyCount).toBe(3);
    expect(result.stack).toContain("react");
    expect(result.stack).toContain("nextjs");
  });

  it("detects monorepo with packages/", () => {
    mkdirSync(join(tempDir, "packages", "core"), { recursive: true });
    writeFileSync(
      join(tempDir, "packages", "core", "package.json"),
      "{}"
    );
    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify({ workspaces: ["packages/*"] })
    );
    const result = analyseProject(tempDir);
    expect(result.monorepo).toBe(true);
    expect(result.packageCount).toBe(1);
  });

  it("detects monorepo with apps/", () => {
    mkdirSync(join(tempDir, "apps", "web"), { recursive: true });
    writeFileSync(
      join(tempDir, "apps", "web", "package.json"),
      "{}"
    );
    const result = analyseProject(tempDir);
    expect(result.appCount).toBe(1);
  });

  it("detects TypeScript", () => {
    writeFileSync(join(tempDir, "tsconfig.json"), "{}");
    const result = analyseProject(tempDir);
    expect(result.hasTypeScript).toBe(true);
  });

  it("detects pnpm package manager", () => {
    writeFileSync(join(tempDir, "pnpm-lock.yaml"), "");
    const result = analyseProject(tempDir);
    expect(result.packageManager).toBe("pnpm");
  });

  it("detects yarn package manager", () => {
    writeFileSync(join(tempDir, "yarn.lock"), "");
    const result = analyseProject(tempDir);
    expect(result.packageManager).toBe("yarn");
  });

  it("detects npm package manager", () => {
    writeFileSync(join(tempDir, "package-lock.json"), "");
    const result = analyseProject(tempDir);
    expect(result.packageManager).toBe("npm");
  });

  it("detects tests", () => {
    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify({ devDependencies: { vitest: "^1.0.0" } })
    );
    const result = analyseProject(tempDir);
    expect(result.hasTests).toBe(true);
  });

  it("detects linter", () => {
    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify({ devDependencies: { eslint: "^9.0.0" } })
    );
    const result = analyseProject(tempDir);
    expect(result.hasLinter).toBe(true);
  });

  it("detects CI", () => {
    mkdirSync(join(tempDir, ".github", "workflows"), { recursive: true });
    const result = analyseProject(tempDir);
    expect(result.hasCI).toBe(true);
  });

  it("counts source files", () => {
    writeFileSync(join(tempDir, "a.ts"), "");
    writeFileSync(join(tempDir, "b.tsx"), "");
    mkdirSync(join(tempDir, "sub"), { recursive: true });
    writeFileSync(join(tempDir, "sub", "c.js"), "");
    const result = analyseProject(tempDir);
    expect(result.sourceFileCount).toBe(3);
  });

  it("detects full stack (react + tailwind + zod)", () => {
    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify({
        dependencies: { react: "^18", "react-dom": "^18" },
        devDependencies: { tailwindcss: "^3", zod: "^3" },
      })
    );
    const result = analyseProject(tempDir);
    expect(result.stack).toContain("react");
    expect(result.stack).toContain("tailwindcss");
    expect(result.stack).toContain("zod");
  });
});
