# Plan: Dynamic Rule Adaptation by Project Complexity

**Status:** Done
**Date:** 2026-07-11
**Updated_at:** 2026-07-12T01:00:00.000Z
**Priority:** P0
**Owner:** AI Agent
**Estimated Time:** 4.5h

---

## Context

The Nexus System has 25+ rules in AGENTS.md, but not all rules are relevant for every project. A simple CLI tool doesn't need TDD, session invariants, or quick board rules. The system should adapt its complexity to the project's complexity.

**Current State:**
- `capabilities.md` defines capability → rule mapping (but not used for loading)
- `opencode.json` has `loading_profile` concept (minimal/lite/full)
- AGENTS.md loads ALL rules regardless of installed capabilities
- No project complexity detection exists

**Goal:** Implement dynamic rule loading where:
1. Rules are only loaded if their required capability is installed
2. Project complexity determines which capabilities are active
3. Agent sees only relevant rules for the current project

---

## Phase 1: Create Rule Registry

**File:** `nexus-system/docs/REGISTRY.md` (new)

### 1.1 Rule → Capability Mapping

| Regra | ID | Requer | Descrição |
|-------|-----|--------|-----------|
| #1 | COMMIT_PERMISSION | core | Nunca commit sem permissão |
| #2 | COMMITS_ENGLISH | core | Commits curtos em inglês |
| #3 | BOOTSTRAP_SETUP | governance | Setup proactivo |
| #4 | LEAN_FLOW | governance | Refinamento contínuo |
| #5 | TDD_STRICT | knowledge | Test-first development |
| #6 | SECURITY_VALIDATION | knowledge | Security by default |
| #7 | SENIOR_ENGINEER | knowledge | Postura sênior |
| #8 | TDD_SKILL | knowledge | Activar skill TDD |
| #9 | POST_COMMIT_CHECK | operations | Validação pós-commit |
| #10 | DEPLOY_CHECKLIST | operations | Checklist pré-deploy |
| #11 | SESSION_PRIORITY | governance | P0 primeiro na sessão |
| #12 | SESSION_INVARIANT | governance | Ritual fim de sessão |
| #13 | QUICK_BOARD | metrics | Quick board display |
| #14 | EVIDENCE_OVER_DOCS | core | Evidência > documentação |
| #15 | MEASURE_BEFORE_OPTIMIZE | core | Métricas antes de optimizar |
| #16 | BACKLOG_STATES | governance | Estados formais do backlog |
| #17 | COMPLETION_CHECKLIST | governance | Checklist de conclusão |
| #18 | PERSONALIZABLE | core | Regras específicas do projecto |
| #19 | GAP_DETECTION | core | Deteção proactiva de gaps |
| #20 | INFRA_VALIDATION | core | Validação pré-tarefa |
| #21 | AUTO_RECOMMEND | core | Recomendar capacidades |

---

## Phase 2: Create Complexity Detector

**File:** `nexus-cli/src/complexity-detector.ts` (new)

### 2.1 Detection Factors

| Factor | Simple | Medium | Complex |
|--------|--------|--------|---------|
| Ficheiros fonte | <10 | 10-50 | >50 |
| Dependências | <5 | 5-20 | >20 |
| Monorepo | Não | Não | Sim |
| Testes | Não | Sim | Sim |
| CI/CD | Não | Não | Sim |
| Multi-pacotes | Não | Não | Sim |

### 2.2 Scoring Logic

```
score ≤ 4  → simple  → capabilities: [core]
score ≤ 8  → medium  → capabilities: [core, knowledge, governance, quality]
score > 8  → complex → capabilities: [core, knowledge, governance, architecture, ai, quality, metrics, operations, compliance]
```

### 2.3 Implementation

```typescript
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type ProjectComplexity = "simple" | "medium" | "complex";

export interface ComplexityResult {
  level: ProjectComplexity;
  score: number;
  factors: string[];
  recommendedCapabilities: string[];
}

export function detectComplexity(projectRoot: string): ComplexityResult {
  let score = 0;
  const factors: string[] = [];

  // Factor 1: Number of source files
  const srcFiles = countFiles(join(projectRoot, "src"), [".ts", ".tsx", ".js", ".jsx"]);
  if (srcFiles > 50) { score += 3; factors.push(`${srcFiles} source files (>50)`); }
  else if (srcFiles > 10) { score += 2; factors.push(`${srcFiles} source files (>10)`); }
  else { score += 1; factors.push(`${srcFiles} source files (simple)`); }

  // Factor 2: Package.json dependencies
  const pkgPath = join(projectRoot, "package.json");
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    const deps = Object.keys(pkg.dependencies || {}).length;
    const devDeps = Object.keys(pkg.devDependencies || {}).length;
    if (deps + devDeps > 20) { score += 3; factors.push(`${deps + devDeps} dependencies (>20)`); }
    else if (deps + devDeps > 5) { score += 2; factors.push(`${deps + devDeps} dependencies (>5)`); }
  }

  // Factor 3: Monorepo detection
  if (existsSync(join(projectRoot, "pnpm-workspace.yaml")) ||
      existsSync(join(projectRoot, "lerna.json")) ||
      existsSync(join(projectRoot, "turbo.json"))) {
    score += 3;
    factors.push("Monorepo detected");
  }

  // Factor 4: Test setup
  if (existsSync(join(projectRoot, "jest.config.js")) ||
      existsSync(join(projectRoot, "vitest.config.ts")) ||
      existsSync(join(projectRoot, "cypress.config.ts"))) {
    score += 2;
    factors.push("Test framework detected");
  }

  // Factor 5: CI/CD
  if (existsSync(join(projectRoot, ".github", "workflows")) ||
      existsSync(join(projectRoot, ".gitlab-ci.yml"))) {
    score += 2;
    factors.push("CI/CD pipeline detected");
  }

  // Factor 6: Multiple packages/apps
  if (existsSync(join(projectRoot, "apps")) ||
      existsSync(join(projectRoot, "packages"))) {
    score += 2;
    factors.push("Multiple packages detected");
  }

  // Determine complexity level
  let level: ProjectComplexity;
  let recommendedCapabilities: string[];

  if (score <= 4) {
    level = "simple";
    recommendedCapabilities = ["core"];
  } else if (score <= 8) {
    level = "medium";
    recommendedCapabilities = ["core", "knowledge", "governance", "quality"];
  } else {
    level = "complex";
    recommendedCapabilities = ["core", "knowledge", "governance", "architecture", "ai", "quality", "metrics", "operations", "compliance"];
  }

  return { level, score, factors, recommendedCapabilities };
}

function countFiles(dir: string, extensions: string[]): number {
  if (!existsSync(dir)) return 0;
  let count = 0;
  const items = readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    if (item.isDirectory()) {
      count += countFiles(join(dir, item.name), extensions);
    } else if (extensions.some(ext => item.name.endsWith(ext))) {
      count++;
    }
  }
  return count;
}
```

---

## Phase 3: Create Adaptive Loader

**File:** `nexus-cli/src/rule-loader.ts` (new)

### 3.1 Implementation

```typescript
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { detectComplexity, type ProjectComplexity } from "./complexity-detector.js";

export interface Rule {
  id: string;
  number: number;
  requires: string[];
  content: string;
}

export function parseRules(agentsPath: string): Rule[] {
  if (!existsSync(agentsPath)) return [];

  const content = readFileSync(agentsPath, "utf-8");
  const rules: Rule[] = [];
  const ruleRegex = /^(\d+)\.\s+\*\*(.+?)\*\*[:\s]*(.*)/gm;
  let match;

  while ((match = ruleRegex.exec(content)) !== null) {
    const number = parseInt(match[1]);
    const title = match[2];
    const rest = match[3];

    const requiresMatch = rest.match(/\(requires:\s*(.+?)\)/);
    const requires = requiresMatch ? requiresMatch[1].split(",").map(r => r.trim()) : ["core"];

    rules.push({
      id: `RULE_${number}`,
      number,
      requires,
      content: match[0],
    });
  }

  return rules;
}

export function filterRulesByCapabilities(
  rules: Rule[],
  installedCapabilities: string[]
): Rule[] {
  return rules.filter(rule =>
    rule.requires.every(req => installedCapabilities.includes(req))
  );
}

export function getActiveRules(
  projectRoot: string,
  nexusDir: string
): { rules: Rule[]; complexity: ProjectComplexity; loadedCount: number; totalCount: number } {
  const complexity = detectComplexity(projectRoot);
  const agentsPath = join(nexusDir, "docs", "AGENTS.md");

  const allRules = parseRules(agentsPath);
  const activeRules = filterRulesByCapabilities(allRules, complexity.recommendedCapabilities);

  return {
    rules: activeRules,
    complexity: complexity.level,
    loadedCount: activeRules.length,
    totalCount: allRules.length,
  };
}
```

---

## Phase 4: Update AGENTS.md with Capability Markers

**File:** `nexus-system/docs/AGENTS.md`

Add metadata header and capability markers:

```markdown
# 🛠️ AGENTS.md - REGRAS DO TIME DE ENGENHARIA DE IA

<!-- METADATA
version: 2.0
complexity_adaptive: true
loading_profiles:
  simple: [core]
  medium: [core, knowledge, governance, quality]
  complex: [core, knowledge, governance, architecture, ai, quality, metrics, operations, compliance]
-->

<!-- CAPABILITY: core -->
## 📐 ARQUITETURA E PADRÕES DO REPOSITÓRIO (OBRIGATÓRIO)
...existing content...
<!-- /CAPABILITY: core -->

<!-- CAPABILITY: governance -->
## 🛑 REGRAS CRUCIAIS DE WORKFLOW E GIT (LEI ABSOLUTA)
...existing content...
<!-- /CAPABILITY: governance -->
```

---

## Phase 5: Update opencode.json

**File:** `opencode.json`

Add dynamic loading configuration:

```json
{
  "nexus": {
    "loading_profile": "auto",
    "complexity_detection": true,
    "capability_filtering": true
  }
}
```

---

## Phase 6: Add CLI Command

**File:** `nexus-cli/src/commands/assess.ts` (modify)

Add complexity detection subcommand:

```bash
nexus assess complexity
# Output:
#   Project Complexity Analysis
#   ────────────────────────────
#   Level:     simple
#   Score:     3
#   Factors:
#     • 5 source files (simple)
#   Recommended Capabilities:
#     ✅ core
```

---

## Phase 7: Update Briefing

**File:** `nexus-cli/src/commands/briefing.ts` (modify)

Show active rules count:

```
Rules loaded:
  Complexity: simple
  Active: 8/25 rules
  ℹ️  Simple project — only core rules active
```

---

## Verification Plan

| Test | Description | Expected |
|------|-------------|----------|
| 1 | Simple project detection | level=simple, capabilities=[core] |
| 2 | Medium project detection | level=medium, capabilities=[core,knowledge,governance,quality] |
| 3 | Complex project detection | level=complex, capabilities=[all] |
| 4 | Rule filtering | Shows "8/25 rules" for simple project |
| 5 | Manual override | loading_profile=full shows all rules |

---

## Estimativa de Esforço

| Fase | Ficheiros | Linhas | Tempo |
|------|-----------|--------|-------|
| 1. Rule Registry | REGISTRY.md | ~50 | 0.5h |
| 2. Complexity Detector | complexity-detector.ts | ~100 | 1.5h |
| 3. Adaptive Loader | rule-loader.ts | ~80 | 1h |
| 4. AGENTS.md Update | AGENTS.md | ~30 | 0.5h |
| 5. opencode.json | opencode.json | ~10 | 0.25h |
| 6. CLI Command | assess.ts | ~40 | 0.5h |
| 7. Briefing Update | briefing.ts | ~20 | 0.25h |
| **Total** | **7** | **~330** | **4.5h** |

---

## Checklist

- [ ] Phase 1: Create rule registry
- [ ] Phase 2: Create complexity detector
- [ ] Phase 3: Create adaptive loader
- [ ] Phase 4: Update AGENTS.md with capability markers
- [ ] Phase 5: Update opencode.json configuration
- [ ] Phase 6: Add CLI command for complexity detection
- [ ] Phase 7: Update briefing to show active rules
- [ ] Test all verification scenarios
