import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { TaintAnalyzer } from "../audit/taint/index.js";

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "nexus-taint-"));
});

afterEach(() => {
  TaintAnalyzer.clearCache();
  rmSync(tempDir, { recursive: true, force: true });
});

describe("TaintAnalyzer", () => {
  it("detects path_traversal and code_injection from process.argv", () => {
    mkdirSync(join(tempDir, "src", "commands"), { recursive: true });
    writeFileSync(join(tempDir, "src", "commands", "dummy.ts"), "# dummy");
    mkdirSync(join(tempDir, "src", "__tests__"), { recursive: true });
    writeFileSync(join(tempDir, "src", "__tests__", "dummy.test.ts"), "# dummy test");

    // Create tsconfig.json for the analyzer
    writeFileSync(
      join(tempDir, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "ESNext",
          moduleResolution: "Bundler",
          esModuleInterop: true,
          strict: true,
          skipLibCheck: true,
          noEmit: true,
        },
        include: ["src/**/*.ts"],
        exclude: ["node_modules", "__tests__", "dist"],
      })
    );

    // Create fixture: process.argv → readFileSync (path_traversal) + eval (code_injection)
    const fixtureCode = `
const userInput = process.argv[2];
const path = userInput;
import { readFileSync } from "node:fs";
readFileSync(path);
eval(userInput);
`;
    writeFileSync(join(tempDir, "src", "taint-fixture.ts"), fixtureCode);

    const analyzer = new TaintAnalyzer({ projectRoot: tempDir });
    const issues = analyzer.analyze();

    const pathTraversal = issues.filter((i) => i.type === "path_traversal");
    const codeInjection = issues.filter((i) => i.type === "code_injection");

    expect(pathTraversal.length).toBeGreaterThanOrEqual(1);
    expect(codeInjection.length).toBeGreaterThanOrEqual(1);
  });

  it("detects tainted input from process.env", () => {
    mkdirSync(join(tempDir, "src", "commands"), { recursive: true });
    writeFileSync(join(tempDir, "src", "commands", "dummy.ts"), "# dummy");
    mkdirSync(join(tempDir, "src", "__tests__"), { recursive: true });
    writeFileSync(join(tempDir, "src", "__tests__", "dummy.test.ts"), "# dummy test");

    writeFileSync(
      join(tempDir, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "ESNext",
          moduleResolution: "Bundler",
          esModuleInterop: true,
          strict: true,
          skipLibCheck: true,
          noEmit: true,
        },
        include: ["src/**/*.ts"],
        exclude: ["node_modules", "__tests__", "dist"],
      })
    );

    const fixtureCode = `
const secret = process.env.API_KEY;
eval(secret);
`;
    writeFileSync(join(tempDir, "src", "env-fixture.ts"), fixtureCode);

    const analyzer = new TaintAnalyzer({ projectRoot: tempDir });
    const issues = analyzer.analyze();

    expect(issues.length).toBeGreaterThanOrEqual(1);
    const codeInjection = issues.filter((i) => i.type === "code_injection");
    expect(codeInjection.length).toBeGreaterThanOrEqual(1);
  });

  it("reports zero issues for clean code", () => {
    mkdirSync(join(tempDir, "src", "commands"), { recursive: true });
    writeFileSync(join(tempDir, "src", "commands", "dummy.ts"), "# dummy");
    mkdirSync(join(tempDir, "src", "__tests__"), { recursive: true });
    writeFileSync(join(tempDir, "src", "__tests__", "dummy.test.ts"), "# dummy test");

    writeFileSync(
      join(tempDir, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "ESNext",
          moduleResolution: "Bundler",
          esModuleInterop: true,
          strict: true,
          skipLibCheck: true,
          noEmit: true,
        },
        include: ["src/**/*.ts"],
        exclude: ["node_modules", "__tests__", "dist"],
      })
    );

    const cleanCode = `
const x = 42;
const y = x + 1;
console.log(y);
`;
    writeFileSync(join(tempDir, "src", "clean.ts"), cleanCode);

    const analyzer = new TaintAnalyzer({ projectRoot: tempDir });
    const issues = analyzer.analyze();

    expect(issues.length).toBe(0);
  });
});
