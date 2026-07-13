import { describe, it, expect } from "vitest";
import { extractKeywords, detectDrift, detectDriftBatch, scanCodebase, type CodebaseFacts } from "../semantic-drift-detector.js";

// ── Helpers ────────────────────────────────────────────────────────────────

const MOCK_FACTS: CodebaseFacts = {
  dependencies: ["react", "typescript", "vitest", "express"],
  imports: ["react", "express", "node:fs"],
  cliCommands: ["serve", "build", "test", "lint"],
  configKeys: ["PORT", "HOST", "DATABASE_URL"],
};

function extractDependencies(content: string): { dependencies: string[] } {
  const deps = content.match(/(?:"|')(?:@?[\w-]+\/)?[\w-]+(?:"|')/g) ?? [];
  return { dependencies: deps.map(d => d.replace(/["']/g, "")) };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("extractKeywords", () => {
  it("extracts technical keywords from content", () => {
    const result = extractKeywords("We use React and TypeScript for the frontend");
    expect(result.technical).toContain("react");
    expect(result.technical).toContain("typescript");
  });

  it("extracts command references", () => {
    const result = extractKeywords("Run `nexus serve` to start the server");
    expect(result.commands).toContain("nexus serve");
  });

  it("extracts dependency references in quotes", () => {
    const result = extractDependencies('Install "express" or "fastify"');
    expect(result.dependencies).toContain("express");
    expect(result.dependencies).toContain("fastify");
  });

  it("extracts config keys (UPPERCASE)", () => {
    const result = extractKeywords("Set DATABASE_URL and PORT in .env");
    expect(result.configRefs).toContain("DATABASE_URL");
    expect(result.configRefs).toContain("PORT");
  });

  it("handles empty content gracefully", () => {
    const result = extractKeywords("");
    expect(result.technical).toHaveLength(0);
    expect(result.commands).toHaveLength(0);
    expect(result.dependencies).toHaveLength(0);
    expect(result.configRefs).toHaveLength(0);
  });
});

describe("detectDrift", () => {
  it("detects drift when dependency is missing from codebase", () => {
    const result = detectDrift(
      { content: 'We use PostgreSQL as our database', type: "doc" },
      MOCK_FACTS
    );
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.missingKeywords.length).toBeGreaterThan(0);
  });

  it("does not flag drift when dependency exists", () => {
    const result = detectDrift(
      { content: 'We use React for the UI', type: "doc" },
      MOCK_FACTS
    );
    expect(result.confidence).toBe(0);
    expect(result.missingKeywords).toHaveLength(0);
  });

  it("detects drift when CLI command is missing", () => {
    const result = detectDrift(
      { content: 'Run `nexus deploy` to deploy', type: "doc" },
      MOCK_FACTS
    );
    expect(result.confidence).toBeGreaterThan(0);
  });

  it("does not flag existing CLI command", () => {
    const result = detectDrift(
      { content: 'Run `nexus serve` to start', type: "doc" },
      MOCK_FACTS
    );
    expect(result.confidence).toBe(0);
  });

  it("boosts confidence for runbooks", () => {
    const runbook = detectDrift(
      { content: 'Deploy using `nexus deploy`', type: "runbook" },
      MOCK_FACTS
    );
    const doc = detectDrift(
      { content: 'Deploy using `nexus deploy`', type: "doc" },
      MOCK_FACTS
    );
    expect(runbook.confidence).toBeGreaterThan(doc.confidence);
  });

  it("reduces confidence for old ADRs (historical)", () => {
    const oldAdr = detectDrift(
      { content: 'We use PostgreSQL', type: "adr", age: 400 },
      MOCK_FACTS
    );
    const newAdr = detectDrift(
      { content: 'We use PostgreSQL', type: "adr", age: 30 },
      MOCK_FACTS
    );
    expect(oldAdr.confidence).toBeLessThan(newAdr.confidence);
  });

  it("clamps confidence between 0 and 1", () => {
    const result = detectDrift(
      {
        content: 'We use PostgreSQL, MongoDB, Redis, Docker, Kubernetes, and many other things',
        type: "runbook",
        age: 10
      },
      { dependencies: [], imports: [], cliCommands: [], configKeys: [] }
    );
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
  });
});

describe("detectDriftBatch", () => {
  it("returns only documents with confidence > 0.3", () => {
    const docs = [
      { path: "docs/adr-001.md", content: "We use React", type: "adr", age: 30 },
      { path: "docs/runbook.md", content: "We use PostgreSQL", type: "runbook" },
    ];
    const results = detectDriftBatch(docs, MOCK_FACTS);
    expect(results.length).toBeGreaterThanOrEqual(1);
    for (const r of results) {
      expect(r.confidence).toBeGreaterThan(0.3);
    }
  });

  it("returns empty array when no significant drift", () => {
    const docs = [
      { path: "docs/adr-001.md", content: "We use React for UI", type: "adr", age: 30 },
    ];
    const results = detectDriftBatch(docs, MOCK_FACTS);
    expect(results).toHaveLength(0);
  });
});

describe("scanCodebase", () => {
  it("returns a CodebaseFacts object", () => {
    const facts = scanCodebase("/media/edson-ubuntu/Data2/projeto-formação_tech/nexus-cli");
    expect(facts).toHaveProperty("dependencies");
    expect(facts).toHaveProperty("imports");
    expect(facts).toHaveProperty("cliCommands");
    expect(facts).toHaveProperty("configKeys");
    expect(Array.isArray(facts.dependencies)).toBe(true);
  });
});
