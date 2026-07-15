import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Artifact, Relation } from "./types.js";

export function discoverArtifacts(nexusDir: string): Artifact[] {
  const artifacts: Artifact[] = [];
  const now = new Date().toISOString();

  const adrDir = join(nexusDir, "docs", "adrs");
  if (existsSync(adrDir)) {
    const files = readdirSync(adrDir).filter(
      (f) => f.endsWith(".md") && !f.startsWith("ADR-TEMPLATE")
    );
    for (const file of files) {
      artifacts.push({
        id: `adr-${file.replace(".md", "")}`,
        type: "adr",
        name: file.replace(".md", "").replace(/-/g, " "),
        path: `docs/adrs/${file}`,
        description: `Architecture Decision Record: ${file}`,
        tags: ["adr", "decision"],
        createdAt: now,
        updatedAt: now,
        status: "active",
      });
    }
  }

  const skillsDir = join(nexusDir, "docs", "skills");
  if (existsSync(skillsDir)) {
    const files = readdirSync(skillsDir).filter((f) => f.endsWith(".md"));
    for (const file of files) {
      artifacts.push({
        id: `skill-${file.replace(".md", "")}`,
        type: "skill",
        name: file.replace(".md", "").replace(/_/g, " "),
        path: `docs/skills/${file}`,
        description: `Engineering skill: ${file}`,
        tags: ["skill", "engineering"],
        createdAt: now,
        updatedAt: now,
        status: "active",
      });
    }
  }

  const contractsDir = join(nexusDir, "governance", "agents");
  if (existsSync(contractsDir)) {
    const files = readdirSync(contractsDir).filter(
      (f) => f.endsWith(".yaml") || f.endsWith(".yml")
    );
    for (const file of files) {
      artifacts.push({
        id: `contract-${file.replace(/\.(yaml|yml)$/, "")}`,
        type: "contract",
        name: file.replace(/\.(yaml|yml)$/, "").replace(/-/g, " "),
        path: `governance/agents/${file}`,
        description: `AI agent contract: ${file}`,
        tags: ["contract", "agent"],
        createdAt: now,
        updatedAt: now,
        status: "active",
      });
    }
  }

  const workflowPath = join(nexusDir, "governance", "WORKFLOW.md");
  if (existsSync(workflowPath)) {
    artifacts.push({
      id: "workflow-main",
      type: "workflow",
      name: "Main Workflow",
      path: "governance/WORKFLOW.md",
      description: "Main session workflow",
      tags: ["workflow", "session"],
      createdAt: now,
      updatedAt: now,
      status: "active",
    });
  }

  const runbooksDir = join(nexusDir, "docs", "runbooks");
  if (existsSync(runbooksDir)) {
    const files = readdirSync(runbooksDir).filter((f) => f.endsWith(".md"));
    for (const file of files) {
      artifacts.push({
        id: `runbook-${file.replace(".md", "")}`,
        type: "runbook",
        name: file.replace(".md", "").replace(/-/g, " "),
        path: `docs/runbooks/${file}`,
        description: `Operational runbook: ${file}`,
        tags: ["runbook", "operations"],
        createdAt: now,
        updatedAt: now,
        status: "active",
      });
    }
  }

  const plansDir = join(nexusDir, "governance", "plans");
  if (existsSync(plansDir)) {
    const files = readdirSync(plansDir).filter(
      (f) => f.endsWith(".md") && !f.startsWith("TEMPLATE")
    );
    for (const file of files) {
      artifacts.push({
        id: `plan-${file.replace(".md", "")}`,
        type: "plan",
        name: file.replace(".md", "").replace(/-/g, " "),
        path: `governance/plans/${file}`,
        description: `Execution plan: ${file}`,
        tags: ["plan", "execution"],
        createdAt: now,
        updatedAt: now,
        status: "active",
      });
    }
  }

  const scriptsDir = join(nexusDir, "scripts");
  if (existsSync(scriptsDir)) {
    const files = readdirSync(scriptsDir).filter(
      (f) => f.endsWith(".ts") || f.endsWith(".js")
    );
    for (const file of files) {
      artifacts.push({
        id: `script-${file.replace(/\.(ts|js)$/, "")}`,
        type: "script",
        name: file.replace(/\.(ts|js)$/, "").replace(/-/g, " "),
        path: `scripts/${file}`,
        description: `Automation script: ${file}`,
        tags: ["script", "automation"],
        createdAt: now,
        updatedAt: now,
        status: "active",
      });
    }
  }

  const docsDir = join(nexusDir, "docs");
  if (existsSync(docsDir)) {
    const files = readdirSync(docsDir).filter(
      (f) => f.endsWith(".md") && !f.startsWith("README")
    );
    for (const file of files) {
      artifacts.push({
        id: `doc-${file.replace(".md", "")}`,
        type: "doc",
        name: file.replace(".md", "").replace(/_/g, " "),
        path: `docs/${file}`,
        description: `Documentation: ${file}`,
        tags: ["doc", "documentation"],
        createdAt: now,
        updatedAt: now,
        status: "active",
      });
    }
  }

  return artifacts;
}

export function discoverRelations(artifacts: Artifact[]): Relation[] {
  const relations: Relation[] = [];
  const now = new Date().toISOString();

  for (const artifact of artifacts) {
    if (artifact.type === "adr") {
      const relatedSkills = artifacts.filter(
        (a) => a.type === "skill" && a.name.toLowerCase().includes(artifact.name.split(" ").slice(0, 2).join(" ").toLowerCase())
      );
      for (const skill of relatedSkills) {
        relations.push({
          source: artifact.id,
          target: skill.id,
          type: "generates",
          description: `ADR generates skill`,
          createdAt: now,
        });
      }
    }

    if (artifact.type === "skill") {
      const relatedContracts = artifacts.filter(
        (a) => a.type === "contract"
      );
      for (const contract of relatedContracts) {
        relations.push({
          source: artifact.id,
          target: contract.id,
          type: "uses",
          description: `Skill uses contract`,
          createdAt: now,
        });
      }
    }

    if (artifact.type === "contract") {
      const relatedScripts = artifacts.filter(
        (a) => a.type === "script"
      );
      for (const script of relatedScripts) {
        relations.push({
          source: artifact.id,
          target: script.id,
          type: "executes",
          description: `Contract executes script`,
          createdAt: now,
        });
      }
    }

    if (artifact.type === "workflow") {
      const relatedAdrs = artifacts.filter(
        (a) => a.type === "adr"
      );
      for (const adr of relatedAdrs) {
        relations.push({
          source: artifact.id,
          target: adr.id,
          type: "references",
          description: `Workflow references ADR`,
          createdAt: now,
        });
      }
    }

    if (artifact.type === "doc") {
      const relatedCode = artifacts.filter(
        (a) => a.type === "code" || a.type === "script"
      );
      for (const code of relatedCode) {
        relations.push({
          source: artifact.id,
          target: code.id,
          type: "documents",
          description: `Doc documents code`,
          createdAt: now,
        });
      }
    }
  }

  return relations;
}
