/**
 * help-data.ts — Command help metadata for nexus help system
 *
 * Categories, descriptions, usage examples, and tips for each command.
 * Used by the custom help formatter in bin/nexus.ts.
 */

export interface CommandHelp {
  name: string;
  description: string;
  usage: string;
  examples: string[];
  tips?: string[];
}

export interface CommandCategory {
  name: string;
  description: string;
  commands: CommandHelp[];
}

export const COMMAND_CATEGORIES: CommandCategory[] = [
  {
    name: "Setup & Configuration",
    description: "Initialize and configure your Nexus project",
    commands: [
      {
        name: "init",
        description: "Initialize Nexus ecosystem with maturity-based discovery",
        usage: "nexus init [options]",
        examples: [
          "nexus init                          # Interactive setup",
          "nexus init --dir ./my-project        # Initialize specific directory",
          "nexus init --answers-file config.json # Non-interactive mode",
        ],
        tips: [
          "Run this first to set up governance in your project",
          "If already initialized, re-runs maturity questionnaire",
        ],
      },
      {
        name: "sync",
        description: "Sync governance files from nexus-system to project",
        usage: "nexus sync [options]",
        examples: [
          "nexus sync                # Sync all governance files",
          "nexus sync --dir ./app    # Sync specific project",
        ],
      },
      {
        name: "upgrade",
        description: "Add capabilities to your governance ecosystem",
        usage: "nexus upgrade [options]",
        examples: [
          "nexus upgrade                          # Show available capabilities",
          "nexus upgrade --capability architecture # Install specific capability",
          "nexus upgrade --accept-recommended     # Install all recommended",
        ],
      },
      {
        name: "clean",
        description: "Clear nexus cache and temporary files",
        usage: "nexus clean [options]",
        examples: [
          "nexus clean              # Clear all cache",
          "nexus clean --dry-run    # Preview what would be deleted",
        ],
      },
    ],
  },
  {
    name: "Status & Analysis",
    description: "Check project health, maturity, and patterns",
    commands: [
      {
        name: "status",
        description: "Check governance health status with maturity score",
        usage: "nexus status [options]",
        examples: [
          "nexus status              # Full health report",
          "nexus status --json       # JSON output",
          "nexus status --no-cache   # Skip cache, recalculate",
        ],
      },
      {
        name: "audit",
        description: "Audit governance health, knowledge graph, and issues",
        usage: "nexus audit [options]",
        examples: [
          "nexus audit               # Full audit with health score",
          "nexus audit --json        # JSON output for CI/CD",
        ],
        tips: [
          "Shows health score (0-100), issues, and knowledge graph status",
          "Run periodically to track governance health over time",
        ],
      },
      {
        name: "doctor",
        description: "Engineering mentor — identify risks and suggest improvements",
        usage: "nexus doctor [options]",
        examples: [
          "nexus doctor              # Full diagnostic report",
          "nexus doctor --json       # JSON output",
        ],
      },
      {
        name: "assess",
        description: "Re-evaluate project maturity and recommend new capabilities",
        usage: "nexus assess [options]",
        examples: [
          "nexus assess              # Interactive re-assessment",
          "nexus assess --json       # JSON output",
        ],
        tips: [
          "Run when your project has grown to discover new capabilities",
        ],
      },
      {
        name: "detect",
        description: "Detect patterns in history and propose candidate rules",
        usage: "nexus detect [options]",
        examples: [
          "nexus detect              # Analyze history for patterns",
          "nexus detect --json       # JSON output",
        ],
      },
    ],
  },
  {
    name: "Pipeline & Execution",
    description: "Run analysis pipelines and execute governance actions",
    commands: [
      {
        name: "run",
        description: "Run the full analysis pipeline (analyze → score → detect → audit → evolve)",
        usage: "nexus run [options]",
        examples: [
          "nexus run                 # Run full pipeline",
          "nexus run --json          # JSON output",
        ],
        tips: [
          "Combines all analysis stages in one command",
          "Useful for CI/CD or periodic health checks",
        ],
      },
      {
        name: "evolve",
        description: "Show evolution recommendations and manage feedback",
        usage: "nexus evolve [options]",
        examples: [
          "nexus evolve              # Show recommendations",
          "nexus evolve --json       # JSON output",
        ],
      },
      {
        name: "act",
        description: "Execute actions with idempotency guarantees",
        usage: "nexus act [options]",
        examples: [
          "nexus act create --title 'Fix auth' --action-type bugfix",
          "nexus act list            # List all actions",
        ],
      },
      {
        name: "plan",
        description: "Manage coordinated action sequences (plans)",
        usage: "nexus plan <subcommand> [options]",
        examples: [
          "nexus plan create my-plan           # Create a plan",
          "nexus plan execute <plan-id>        # Execute a plan",
          "nexus plan list                     # List all plans",
          "nexus plan show <plan-id>           # Show plan details",
        ],
      },
    ],
  },
  {
    name: "Governance",
    description: "Manage goals, decisions, and policies",
    commands: [
      {
        name: "goal",
        description: "Manage governance goals",
        usage: "nexus goal <subcommand> [options]",
        examples: [
          "nexus goal create --title 'Improve tests' --priority high",
          "nexus goal list            # List all goals",
          "nexus goal show <id>       # Show goal details",
        ],
      },
      {
        name: "decide",
        description: "Evaluate proposed actions using specialized evaluators",
        usage: "nexus decide <action> [options]",
        examples: [
          'nexus decide "upgrade auth to OAuth2"',
          'nexus decide "add rate limiting" --category security',
          "nexus decide list          # List all decisions",
        ],
        tips: [
          "Evaluates risk, impact, confidence, and goal alignment",
        ],
      },
      {
        name: "policy",
        description: "Manage and evaluate declarative governance policies",
        usage: "nexus policy <subcommand> [options]",
        examples: [
          "nexus policy list          # List all policies",
          "nexus policy evaluate      # Evaluate current state against policies",
        ],
      },
    ],
  },
  {
    name: "Reports & Dashboards",
    description: "View reports, dashboards, and digests",
    commands: [
      {
        name: "console",
        description: "Token economy console with session metrics",
        usage: "nexus console [options]",
        examples: [
          "nexus console              # Full console",
          "nexus console --days 30    # Last 30 days",
        ],
      },
      {
        name: "report",
        description: "Generate performance report for the user",
        usage: "nexus report [options]",
        examples: [
          "nexus report               # Full report",
          "nexus report --json        # JSON output",
        ],
      },
      {
        name: "digest",
        description: "Daily digest of project health and recent changes",
        usage: "nexus digest [options]",
        examples: [
          "nexus digest               # Today's digest",
          "nexus digest --json        # JSON output",
        ],
      },
      {
        name: "bench",
        description: "Benchmark token economy and Context Pipeline performance",
        usage: "nexus bench [options]",
        examples: [
          "nexus bench                # Run benchmark",
        ],
      },
    ],
  },
  {
    name: "AI Integration",
    description: "Briefings, feedback, and AI agent tools",
    commands: [
      {
        name: "briefing",
        description: "Pre-session briefing for AI agents (Context Pipeline)",
        usage: "nexus briefing [options]",
        examples: [
          "nexus briefing             # Full briefing",
          "nexus briefing --summary   # One-line summary",
          "nexus briefing --write     # Write to .nexus/BRIEFING.md",
          "nexus briefing --json      # JSON output",
        ],
        tips: [
          "Run at the start of each AI session for context",
        ],
      },
      {
        name: "feedback",
        description: "Report session outcome for the Context Pipeline feedback loop",
        usage: "nexus feedback [options]",
        examples: [
          'nexus feedback --outcome success',
          'nexus feedback --outcome failure --notes "type error in auth"',
        ],
      },
      {
        name: "profile",
        description: "View and update your user profile for personalized feedback",
        usage: "nexus profile [options]",
        examples: [
          "nexus profile              # Show current profile",
          "nexus profile --update     # Update profile interactively",
        ],
      },
      {
        name: "dashboard",
        description: "Interactive engineering dashboard with tabs, mouse, and accessibility",
        usage: "nexus dashboard [options]",
        examples: [
          "nexus dashboard            # Open interactive dashboard",
          "nexus dashboard --json     # JSON snapshot",
          "nexus dashboard --live 5   # Auto-refresh every 5s",
        ],
        tips: [
          "Navigate with arrow keys, Tab, numbers, or mouse",
          "Press 'q' to quit, 'r' to refresh",
        ],
      },
    ],
  },
  {
    name: "System",
    description: "Shell integration and system utilities",
    commands: [
      {
        name: "validate",
        description: "Validate session integrity and governance rules",
        usage: "nexus validate [options]",
        examples: [
          "nexus validate             # Validate current session",
          "nexus validate --json      # JSON output",
        ],
      },
      {
        name: "shell-init",
        description: "Output shell hooks for session tracking",
        usage: "nexus shell-init [options]",
        examples: [
          "nexus shell-init           # Show shell hooks",
          "Add to .bashrc/.zshrc: eval $(nexus shell-init)",
        ],
      },
    ],
  },
];

/**
 * Find a command by name across all categories.
 */
export function findCommand(name: string): CommandHelp | undefined {
  for (const cat of COMMAND_CATEGORIES) {
    const cmd = cat.commands.find((c) => c.name === name);
    if (cmd) return cmd;
  }
  return undefined;
}

/**
 * Get all command names.
 */
export function getAllCommandNames(): string[] {
  const names: string[] = [];
  for (const cat of COMMAND_CATEGORIES) {
    for (const cmd of cat.commands) {
      names.push(cmd.name);
    }
  }
  return names;
}
