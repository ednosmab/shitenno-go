# Configuration Reference

> How to configure the Nexus CLI.

## opencode.json

The main configuration file, located at the project root.

```json
{
  "name": "my-project",
  "version": "1.0.0",
  "nexus": {
    "version": "0.1.0",
    "initialized": true
  }
}
```

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Project name |
| `version` | string | Yes | Project version |
| `nexus.version` | string | Yes | Nexus version used |
| `nexus.initialized` | boolean | Yes | Whether Nexus is initialized |

---

## nexus-system/ Directory

The governance directory created by `nexus init`.

```
nexus-system/
├── docs/              # Documentation
├── governance/        # Governance structure
├── cognition/         # AI context
├── reports/           # Generated reports
├── maturity-profile.json
└── complexity-report.json
```

---

## Loading Profiles

Control how much context AI agents load.

| Profile | P0 | P1 | P2 | P3 | P4 | Tokens |
|---------|----|----|----|----|----|----|
| **minimal** | ✓ | ✓ | — | — | — | ~2K |
| **lite** | ✓ | ✓ | ✓ | — | — | ~8K |
| **full** | ✓ | ✓ | ✓ | ✓ | ✓ | ~25K |

### When to Use

| Profile | Use Case |
|---------|----------|
| **minimal** | Quick questions, status checks |
| **lite** | Feature implementation, bug fixes |
| **full** | Architecture decisions, complex debugging |

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXUS_HOME` | Nexus home directory | `~/.nexus` |
| `NEXUS_PLUGINS` | Plugin directory | `nexus-plugins/` |
| `NEXUS_LOG_LEVEL` | Log level | `info` |

---

## Configuration Precedence

1. CLI flags (`--dir`, `--json`)
2. Environment variables
3. `opencode.json`
4. Defaults

---

*Last updated: 2026-06-29*
