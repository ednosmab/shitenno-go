import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../logger.js";
import type { EngineeringAsset } from "../domain/entities/engineering-state.js";

export function discoverAssets(shitennoDir: string): EngineeringAsset[] {
  const assets: EngineeringAsset[] = [];
  const now = new Date().toISOString();

  // ADRs
  const adrDir = join(shitennoDir, "docs", "adrs");
  if (existsSync(adrDir)) {
    const files = readdirSync(adrDir).filter(
      (f) => f.endsWith(".md") && !f.startsWith("ADR-TEMPLATE")
    );
    for (const file of files) {
      const content = readFileSync(join(adrDir, file), "utf-8");
      const titleMatch = content.match(/^#\s+(.+)/m);
      const statusMatch = content.match(/Estado:\s*(\w+)/i) || content.match(/Status:\s*(\w+)/i);
      assets.push({
        id: `adr-${file.replace(".md", "")}`,
        type: "adr",
        name: titleMatch?.[1] ?? file.replace(".md", "").replace(/-/g, " "),
        path: `docs/adrs/${file}`,
        description: `Architecture Decision Record: ${file}`,
        tags: ["adr", "decision", "architecture"],
        status: statusMatch?.[1]?.toLowerCase() === "deprecated" ? "archived" : "active",
        createdAt: now,
        updatedAt: now,
        contributesTo: ["architecture", "documentation"],
        dependencies: [],
      });
    }
  }

  // Skills
  const skillsDir = join(shitennoDir, "docs", "skills");
  if (existsSync(skillsDir)) {
    const files = readdirSync(skillsDir).filter((f) => f.endsWith(".md"));
    for (const file of files) {
      assets.push({
        id: `skill-${file.replace(".md", "")}`,
        type: "skill",
        name: file.replace(".md", "").replace(/_/g, " "),
        path: `docs/skills/${file}`,
        description: `Engineering skill: ${file}`,
        tags: ["skill", "engineering"],
        status: "active",
        createdAt: now,
        updatedAt: now,
        contributesTo: ["documentation", "quality"],
        dependencies: [],
      });
    }
  }

  // Contracts (AI agent contracts)
  const contractsDir = join(shitennoDir, "governance", "agents");
  if (existsSync(contractsDir)) {
    const files = readdirSync(contractsDir).filter(
      (f) => f.endsWith(".yaml") || f.endsWith(".yml")
    );
    for (const file of files) {
      assets.push({
        id: `contract-${file.replace(/\.(yaml|yml)$/, "")}`,
        type: "contract",
        name: file.replace(/\.(yaml|yml)$/, "").replace(/-/g, " "),
        path: `governance/agents/${file}`,
        description: `AI agent contract: ${file}`,
        tags: ["contract", "agent", "ai"],
        status: "active",
        createdAt: now,
        updatedAt: now,
        contributesTo: ["ai", "governance"],
        dependencies: [],
      });
    }
  }

  // Policies (from rules directory)
  const rulesDir = join(shitennoDir, "governance", "rules");
  if (existsSync(rulesDir)) {
    const files = readdirSync(rulesDir).filter(
      (f) => f.endsWith(".json") && !f.startsWith("_")
    );
    for (const file of files) {
      try {
        const content = JSON.parse(readFileSync(join(rulesDir, file), "utf-8"));
        assets.push({
          id: `policy-${content.id || file.replace(".json", "")}`,
          type: "policy",
          name: content.description || file.replace(".json", ""),
          path: `governance/rules/${file}`,
          description: `Governance rule: ${content.id || file}`,
          tags: ["policy", "rule", "governance"],
          status: content.enabled ? "active" : "draft",
          createdAt: now,
          updatedAt: now,
          contributesTo: ["governance"],
          dependencies: [],
        });
      } catch {
        logger.debug("engineering-state", "Failed to parse rule file:", file);
      }
    }
  }

  // Workflows
  const workflowPath = join(shitennoDir, "governance", "WORKFLOW.md");
  if (existsSync(workflowPath)) {
    assets.push({
      id: "workflow-main",
      type: "workflow",
      name: "Main Workflow",
      path: "governance/WORKFLOW.md",
      description: "Main session workflow",
      tags: ["workflow", "session", "governance"],
      status: "active",
      createdAt: now,
      updatedAt: now,
      contributesTo: ["governance"],
      dependencies: [],
    });
  }

  // Runbooks
  const runbooksDir = join(shitennoDir, "docs", "runbooks");
  if (existsSync(runbooksDir)) {
    const files = readdirSync(runbooksDir).filter((f) => f.endsWith(".md"));
    for (const file of files) {
      assets.push({
        id: `runbook-${file.replace(".md", "")}`,
        type: "runbook",
        name: file.replace(".md", "").replace(/-/g, " "),
        path: `docs/runbooks/${file}`,
        description: `Operational runbook: ${file}`,
        tags: ["runbook", "operations"],
        status: "active",
        createdAt: now,
        updatedAt: now,
        contributesTo: ["operations", "quality"],
        dependencies: [],
      });
    }
  }

  // Plans (markdown execution plans)
  const plansDir = join(shitennoDir, "governance", "plans");
  if (existsSync(plansDir)) {
    const files = readdirSync(plansDir).filter(
      (f) => f.endsWith(".md") && !f.startsWith("TEMPLATE")
    );
    for (const file of files) {
      assets.push({
        id: `plan-${file.replace(".md", "")}`,
        type: "plan",
        name: file.replace(".md", "").replace(/-/g, " "),
        path: `governance/plans/${file}`,
        description: `Execution plan: ${file}`,
        tags: ["plan", "execution"],
        status: "active",
        createdAt: now,
        updatedAt: now,
        contributesTo: ["architecture"],
        dependencies: [],
      });
    }
  }

  // Scripts
  const scriptsDir = join(shitennoDir, "scripts");
  if (existsSync(scriptsDir)) {
    const files = readdirSync(scriptsDir).filter(
      (f) => /\.(ts|tsx|js|jsx|vue|svelte)$/.test(f)
    );
    for (const file of files) {
      assets.push({
        id: `script-${file.replace(/\.(ts|js)$/, "")}`,
        type: "script",
        name: file.replace(/\.(ts|js)$/, "").replace(/-/g, " "),
        path: `scripts/${file}`,
        description: `Automation script: ${file}`,
        tags: ["script", "automation"],
        status: "active",
        createdAt: now,
        updatedAt: now,
        contributesTo: ["automation"],
        dependencies: [],
      });
    }
  }

  // Governance docs
  const docsDir = join(shitennoDir, "docs");
  if (existsSync(docsDir)) {
    const governanceDocNames = [
      "AGENTS.md", "FORBIDDEN_OPERATIONS.md", "DESDO.md",
      "CONCEPTUAL_MODEL.md", "KNOWLEDGE_LIFECYCLE.md", "BACKLOG.md",
    ];
    const files = readdirSync(docsDir).filter(
      (f) => f.endsWith(".md") && !f.startsWith("README")
    );
    for (const file of files) {
      const isGovernanceDoc = governanceDocNames.includes(file);
      assets.push({
        id: `doc-${file.replace(".md", "")}`,
        type: "doc",
        name: file.replace(".md", "").replace(/_/g, " "),
        path: `docs/${file}`,
        description: `Documentation: ${file}`,
        tags: ["doc", "documentation", ...(isGovernanceDoc ? ["governance"] : [])],
        status: "active",
        createdAt: now,
        updatedAt: now,
        contributesTo: isGovernanceDoc ? ["governance", "documentation"] : ["documentation"],
        dependencies: [],
      });
    }
  }

  // Templates
  const templatesDir = join(shitennoDir, "templates");
  if (existsSync(templatesDir)) {
    const files = readdirSync(templatesDir).filter(
      (f) => f.endsWith(".md") || f.endsWith(".yaml") || f.endsWith(".yml")
    );
    for (const file of files) {
      assets.push({
        id: `template-${file.replace(/\.(md|yaml|yml)$/, "")}`,
        type: "template",
        name: file.replace(/\.(md|yaml|yml)$/, "").replace(/_/g, " "),
        path: `templates/${file}`,
        description: `Template: ${file}`,
        tags: ["template"],
        status: "active",
        createdAt: now,
        updatedAt: now,
        contributesTo: ["documentation"],
        dependencies: [],
      });
    }
  }

  // Reports
  const reportsDir = join(shitennoDir, "reports");
  if (existsSync(reportsDir)) {
    const files = readdirSync(reportsDir).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      assets.push({
        id: `report-${file.replace(".json", "")}`,
        type: "report",
        name: file.replace(".json", "").replace(/-/g, " "),
        path: `reports/${file}`,
        description: `Report: ${file}`,
        tags: ["report", "metrics"],
        status: "active",
        createdAt: now,
        updatedAt: now,
        contributesTo: ["observability"],
        dependencies: [],
      });
    }
  }

  // Context (session state)
  const contextBuffer = join(shitennoDir, "governance", "context", "context_buffer.yaml");
  if (existsSync(contextBuffer)) {
    assets.push({
      id: "context-session",
      type: "context",
      name: "Session Context Buffer",
      path: "governance/context/context_buffer.yaml",
      description: "Current session context state",
      tags: ["context", "session", "state"],
      status: "active",
      createdAt: now,
      updatedAt: now,
      contributesTo: ["governance"],
      dependencies: [],
    });
  }

  // Prompts
  const cognitionDir = join(shitennoDir, "cognition", "prompts");
  if (existsSync(cognitionDir)) {
    const subDirs = readdirSync(cognitionDir, { withFileTypes: true }).filter((d) => d.isDirectory());
    for (const subDir of subDirs) {
      const promptDir = join(cognitionDir, subDir.name);
      const promptFiles = readdirSync(promptDir).filter((f) => f.endsWith(".md"));
      for (const file of promptFiles) {
        assets.push({
          id: `prompt-${subDir.name}-${file.replace(".md", "")}`,
          type: "prompt",
          name: `${subDir.name} prompt: ${file.replace(".md", "")}`,
          path: `cognition/prompts/${subDir.name}/${file}`,
          description: `AI prompt: ${subDir.name}/${file}`,
          tags: ["prompt", "ai", subDir.name],
          status: "active",
          createdAt: now,
          updatedAt: now,
          contributesTo: ["ai"],
          dependencies: [],
        });
      }
    }
  }

  return assets;
}
