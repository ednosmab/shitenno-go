/**
 * mcp-server.ts — MCP Server for Shugo Context Pipeline
 *
 * Thin facade — handlers split into mcp-server-handlers.ts.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
export {
  handleGetBriefing,
  handleGetRiskMap,
  handleGetRules,
  handleGetEngineeringState,
  handleGetBacklog,
  handleGetPlans,
  handleSubmitFeedback,
  handleGetADRs,
  handleGetSkills,
} from "./mcp-server-handlers.js";

import {
  handleGetBriefing,
  handleGetRiskMap,
  handleGetRules,
  handleGetEngineeringState,
  handleGetBacklog,
  handleGetPlans,
  handleSubmitFeedback,
  handleGetADRs,
  handleGetSkills,
} from "./mcp-server-handlers.js";

const TOOLS = [
  {
    name: "getBriefing",
    description:
      "Generate a pre-session briefing for the project. Includes project identity, " +
      "risk status, test coverage, context rules, dynamic rules, and recommendations. " +
      "Pass `task` (e.g. implementation, refactor) to auto-attach mandatory skills for that scope.",
    inputSchema: {
      type: "object" as const,
      properties: {
        format: {
          type: "string" as const,
          enum: ["json", "markdown", "summary"],
          description: "Output format.",
        },
        depth: {
          type: "string" as const,
          enum: ["minimal", "standard", "full"],
          description: "Briefing depth.",
        },
        task: {
          type: "string" as const,
          description: "e.g. implementation, refactor, audit, infra — used to resolve mandatory skills.",
        },
      },
    },
  },
  {
    name: "getRiskMap",
    description:
      "Generate a risk map of the project. Analyses test coverage, code churn, " +
      "file sizes, import complexity, and sensitive keywords.",
    inputSchema: {
      type: "object" as const,
      properties: {
        format: { type: "string" as const, enum: ["json", "summary"], description: "Output format." },
      },
    },
  },
  {
    name: "getRules",
    description: "Get governance rules for the project.",
    inputSchema: {
      type: "object" as const,
      properties: {
        type: { type: "string" as const, enum: ["all", "context", "dynamic", "engine"], description: "Which rules to return." },
        format: { type: "string" as const, enum: ["json", "markdown"], description: "Output format." },
      },
    },
  },
  {
    name: "getEngineeringState",
    description: "Get the current engineering state of the project.",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "getBacklog",
    description: "Get the current active tasks and backlog items.",
    inputSchema: {
      type: "object" as const,
      properties: {
        state: { type: "string" as const, description: "Optional filter by state." },
      },
    },
  },
  {
    name: "getPlans",
    description: "List active architectural plans or read a specific plan.",
    inputSchema: {
      type: "object" as const,
      properties: {
        planName: { type: "string" as const, description: "Optional plan filename." },
      },
    },
  },
  {
    name: "submitFeedback",
    description: "Submit feedback on an executed task.",
    inputSchema: {
      type: "object" as const,
      properties: {
        outcome: { type: "string" as const, enum: ["success", "failure", "partial"], description: "Outcome." },
        notes: { type: "string" as const, description: "Detailed notes." },
      },
      required: ["outcome", "notes"],
    },
  },
  {
    name: "getADRs",
    description: "List Architecture Decision Records, or get the full content of one by id (e.g. 'ADR-008')",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string" as const, description: "Optional ADR id (e.g. 'ADR-008'). If omitted, lists all ADRs." },
      },
    },
  },
  {
    name: "getSkills",
    description:
      "Get skills. Pass `name` for a specific skill, or `task`/`language`/`framework`/`layer` " +
      "to resolve which skills are mandatory or relevant for that scope of work — mandatory " +
      "skills are returned in full, others as pointers.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string" as const, description: "Specific skill name or filename." },
        task: { type: "string" as const, description: "e.g. implementation, refactor, audit, infra." },
        language: { type: "string" as const },
        framework: { type: "string" as const },
        layer: { type: "string" as const, description: "e.g. frontend, backend, daemon, cli." },
      },
    },
  },
];

export function createMcpServer(projectRoot: string, shitennoDir?: string): Server {
  const resolvedShitennoDir = shitennoDir ?? `${projectRoot}/shitenno`;

  const server = new Server(
    { name: "shitenno-mcp", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const toolArgs = (args ?? {}) as Record<string, unknown>;

    try {
      switch (name) {
        case "getBriefing":
          return await handleGetBriefing(projectRoot, resolvedShitennoDir, toolArgs);
        case "getRiskMap":
          return await handleGetRiskMap(projectRoot, resolvedShitennoDir, toolArgs);
        case "getRules":
          return await handleGetRules(projectRoot, resolvedShitennoDir, toolArgs);
        case "getEngineeringState":
          return await handleGetEngineeringState(projectRoot, resolvedShitennoDir, toolArgs);
        case "getBacklog":
          return handleGetBacklog(projectRoot, resolvedShitennoDir, toolArgs);
        case "getPlans":
          return handleGetPlans(projectRoot, resolvedShitennoDir, toolArgs);
        case "submitFeedback":
          return handleSubmitFeedback(projectRoot, resolvedShitennoDir, toolArgs);
        case "getADRs":
          return await handleGetADRs(projectRoot, resolvedShitennoDir, toolArgs);
        case "getSkills":
          return await handleGetSkills(projectRoot, resolvedShitennoDir, toolArgs);
        default:
          return {
            content: [{ type: "text", text: `Unknown tool: ${name}. Available: ${TOOLS.map((t) => t.name).join(", ")}` }],
            isError: true,
          };
      }
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error executing ${name}: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  });

  return server;
}

export async function startMcpServer(projectRoot: string, shitennoDir?: string): Promise<void> {
  const server = createMcpServer(projectRoot, shitennoDir);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
