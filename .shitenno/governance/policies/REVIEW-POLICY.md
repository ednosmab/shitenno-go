# Policy: Code Review

## Purpose
Maintain code quality, consistency, and knowledge sharing through peer review.

## Scope
All pull requests and merge requests in this project.

## Rules
- Every merge to `develop` requires at least one approval.
- Review checklist: (a) tests pass, (b) lint passes, (c) no secrets, (d) follows project conventions.
- Architectural changes require an ADR before review.
- Review feedback must be actionable — no vague comments.
- Author must address all review comments before merge.

## Enforcement
- GitHub branch protection enforces required reviews on `develop`.
- CI checks that review checklist items are satisfied.

## Review
- Review cycle: quarterly
- Last reviewed: 2026-07-06
