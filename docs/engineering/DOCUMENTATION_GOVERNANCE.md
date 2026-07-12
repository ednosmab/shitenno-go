# Documentation Governance

> Official governance rules for all documentation maintained by the Nexus project.

## Documentation Principles

1. Documentation is a first-class deliverable.
2. Every architectural change updates documentation.
3. Documentation evolves incrementally.
4. Avoid duplicated knowledge.
5. Prefer a single canonical source.
6. Documentation must be navigable to be useful.
7. Documentation without an audience is documentation without a purpose.

## Documentation Domains

| Domain | Purpose |
|--------|---------|
| architecture | System design |
| domain | Business knowledge |
| implementation | Technical implementation |
| engineering | Development process |
| evolution | Future roadmap |
| philosophy | Engineering principles |
| adr | Architecture Decision Records |
| reference | Reference material |
| product | Scaffolded template docs |

## Documentation Lifecycle

| State | Description |
|-------|-------------|
| Draft | Under development, not yet authoritative |
| Active | Current and maintained |
| Deprecated | Superseded by another document |
| Historical | No longer current, preserved for archival |
| Archived | Frozen, not maintained |

## Canonical Sources

| Subject | Canonical Document |
|---------|-------------------|
| Domain glossary | docs/domain/ubiquitous-language.md |
| Engineering principles | docs/handbook/philosophy/principles.md |
| Module validation | docs/architecture/validation-matrix.md |
| Active work | nexus-system/docs/BACKLOG.md |

## Quality Gates

Documentation changes shall not be merged unless:

- [ ] Navigation is valid (README exists, links resolve)
- [ ] References are valid (no broken links)
- [ ] Document category is defined
- [ ] Lifecycle is declared
- [ ] Duplicated content is avoided
- [ ] Language is consistent (English)

## Language Policy

- **Canonical language:** English
- **Legacy content:** Portuguese remains valid until modified
- **Code:** Always English

---

*Last updated: 2026-06-29*
