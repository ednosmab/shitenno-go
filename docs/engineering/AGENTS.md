# AI Agent Rules

> Rules for AI agents working on the Nexus CLI codebase.

## Repository Structure

```
nexus-cli/
├── src/              # Source code
│   ├── commands/     # CLI commands (13 commands)
│   ├── __tests__/    # Test suite
│   └── templates/    # Scaffold templates
├── docs/             # Documentation
├── plans/            # Historical plans (archived)
└── package.json
```

## Code Rules

1. **English only** — All code, variable names, comments, and commit messages in English
2. **No `any` types** — Use proper TypeScript types
3. **No `console.log`** — Use the centralized logger
4. **No domain logic in CLI** — Commands delegate to modules
5. **TDD required** — Write tests before implementation

## Documentation Rules

1. **Follow governance** — Read `docs/engineering/DOCUMENTATION_GOVERNANCE.md`
2. **Update docs with code** — Documentation evolves with implementation
3. **Use canonical sources** — Don't duplicate, reference
4. **Declare lifecycle** — Every document must have a status

## Architecture Rules

1. **Follow design principles** — Read `docs/architecture/design-principles.md`
2. **Respect invariants** — Domain doesn't depend on infrastructure
3. **Use event bus** — For inter-module communication
4. **Create ADRs** — For architectural decisions

## Context Loading

| Task Type | Load |
|-----------|------|
| Bug fix | Architecture: affected module + design-principles.md |
| Feature | Philosophy: principles.md + Architecture: affected module |
| Refactor | Architecture: command-architecture.md + affected module |
| Documentation | INDEX.md + affected area README |

## Forbidden Operations

- Never commit without authorization
- Never modify tests to make them pass
- Never bypass type-check or lint
- Never add `// @ts-ignore` without justification
- Never commit secrets or keys

---

*Last updated: 2026-06-29*
