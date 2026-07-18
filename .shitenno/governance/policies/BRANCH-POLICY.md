# Policy: Branch Strategy

## Purpose
Define the canonical branching model to maintain a clean, auditable history.

## Scope
All git operations in this project.

## Rules
- `main` receives only merges from `develop` via release.
- `develop` receives all feature branches via `--no-ff`.
- Feature branches are named `feat/<scope>`; fix branches named `fix/<scope>`.
- Long-lived refactor branches must reference a roadmap file in `docs/roadmaps/`.
- No direct commits to `main` or `develop` — use pull requests.
- Delete feature branches after merge.

## Enforcement
- Pre-push hooks reject pushes to `main` from local.
- CI blocks merges to `develop` that skip `--no-ff`.

## Review
- Review cycle: quarterly
- Last reviewed: 2026-07-06
