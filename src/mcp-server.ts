/**
 * mcp-server.ts — MCP Server for Nexus Context Pipeline
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
} from "./mcp-server-handlers.js";

import {
  handleGetBriefing,
  handleGetRiskMap,
  handleGetRules,
  handleGetEngineeringState,
  handleGetBacklog,
  handleGetPlans,
  handleSubmitFeedback,
} from "./mcp-server-handlers.js";

const TOOLS = [
  {
    name: "getBriefing",
    description:
      "Generate a pre-session briefing for the project. Includes project identity, " +
      "risk status, test coverage, context rules, dynamic rules, and recommendations.",
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
];

export function createMcpServer(projectRoot: string, nexusDir?: string): Server {
  const resolvedNexusDir = nexusDir ?? `${projectRoot}/nexus-system`;

  const server = new Server(
    { name: "nexus-mcp", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const toolArgs = (args ?? {}) as Record<string, unknown>;

    try {
      switch (name) {
        case "getBriefing":
          return handleGetBriefing(projectRoot, resolvedNexusDir, toolArgs);
        case "getRiskMap":
          return handleGetRiskMap(projectRoot, resolvedNexusDir, toolArgs);
        case "getRules":
          return handleGetRules(projectRoot, resolvedNexusDir, toolArgs);
        case "getEngineeringState":
          return handleGetEngineeringState(projectRoot, resolvedNexusDir, toolArgs);
        case "getBacklog":
          return handleGetBacklog(projectRoot, resolvedNexusDir, toolArgs);
        case "getPlans":
          return handleGetPlans(projectRoot, resolvedNexusDir, toolArgs);
        case "submitFeedback":
          return handleSubmitFeedback(projectRoot, resolvedNexusDir, toolArgs);
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

export async function startMcpServer(projectRoot: string, nexusDir?: string): Promise<void> {
  const server = createMcpServer(projectRoot, nexusDir);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
