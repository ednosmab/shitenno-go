# Policy: Commit Conventions

## Purpose
Ensure every commit message is informative, searchable, and machine-parseable.

## Scope
All commits in this repository.

## Rules
- Messages must follow Conventional Commits: `type(scope): description`.
- Types allowed: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `style`.
- Scope must reference the module (e.g., `assess`, `evolve`, `feedback`).
- Description must be in English, imperative mood, ≤ 72 chars.
- No secrets, tokens, or credentials in messages or diffs.

## Enforcement
- CI runs `commitlint` on every PR.
- Pre-commit hook scans for secret patterns.

## Review
- Review cycle: quarterly
- Last reviewed: 2026-07-06
