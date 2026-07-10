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

  it("detects taint flow through string concatenation (+ operator)", () => {
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

    // String concatenation with tainted input should propagate taint
    const fixtureCode = `
const url = "https://" + req.query.domain;
fetch(url);
`;
    writeFileSync(join(tempDir, "src", "concat-fixture.ts"), fixtureCode);

    const analyzer = new TaintAnalyzer({ projectRoot: tempDir });
    const issues = analyzer.analyze();

    const ssrfIssues = issues.filter((i) => i.type === "ssrf");
    expect(ssrfIssues.length).toBeGreaterThanOrEqual(1);
  });

  it("detects taint flow through template literal", () => {
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

    // Template literal with tainted input should propagate taint
    const fixtureCode = ["const url = `https://${req.query.domain}/api`;", "fetch(url);"].join("\n");
    writeFileSync(join(tempDir, "src", "template-fixture.ts"), fixtureCode);

    const analyzer = new TaintAnalyzer({ projectRoot: tempDir });
    const issues = analyzer.analyze();

    const ssrfIssues = issues.filter((i) => i.type === "ssrf");
    expect(ssrfIssues.length).toBeGreaterThanOrEqual(1);
  });

  it("detects taint flow through subproperty access (req.query.cmd)", () => {
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

    // Subproperty access like req.query.cmd should be recognized as a taint source
    const fixtureCode = `
const cmd = req.query.cmd;
exec(cmd);
`;
    writeFileSync(join(tempDir, "src", "subprop-fixture.ts"), fixtureCode);

    const analyzer = new TaintAnalyzer({ projectRoot: tempDir });
    const issues = analyzer.analyze();

    const cmdInjection = issues.filter((i) => i.type === "command_injection");
    expect(cmdInjection.length).toBeGreaterThanOrEqual(1);
  });

  it("detects SSRF via fetch with tainted URL", () => {
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

    // Direct SSRF: req.body → fetch()
    const fixtureCode = `
const url = req.body.url;
fetch(url);
`;
    writeFileSync(join(tempDir, "src", "ssrf-fixture.ts"), fixtureCode);

    const analyzer = new TaintAnalyzer({ projectRoot: tempDir });
    const issues = analyzer.analyze();

    const ssrfIssues = issues.filter((i) => i.type === "ssrf");
    expect(ssrfIssues.length).toBeGreaterThanOrEqual(1);
    expect(ssrfIssues[0]!.sinkType).toBe("fetch");
  });

  it("detects SSRF via http.get with tainted URL", () => {
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
const target = req.body.target;
http.get(target);
`;
    writeFileSync(join(tempDir, "src", "ssrf-http-fixture.ts"), fixtureCode);

    const analyzer = new TaintAnalyzer({ projectRoot: tempDir });
    const issues = analyzer.analyze();

    const ssrfIssues = issues.filter((i) => i.type === "ssrf");
    expect(ssrfIssues.length).toBeGreaterThanOrEqual(1);
  });

  it("detects SSRF via undici with tainted URL", () => {
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
const target = req.body.url;
undici.fetch(target);
`;
    writeFileSync(join(tempDir, "src", "ssrf-undici-fixture.ts"), fixtureCode);

    const analyzer = new TaintAnalyzer({ projectRoot: tempDir });
    const issues = analyzer.analyze();

    const ssrfIssues = issues.filter((i) => i.type === "ssrf");
    expect(ssrfIssues.length).toBeGreaterThanOrEqual(1);
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
