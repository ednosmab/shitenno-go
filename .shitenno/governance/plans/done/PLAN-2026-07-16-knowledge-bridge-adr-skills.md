# Plano de Ação — Ponte de Conhecimento (ADRs + Skills) para Agentes

**Status:** Done
**Updated_at:** 2026-07-17T05:36:56.278Z
**Date:** 2026-07-17

**Data:** 2026-07-16
**Origem:** achado confirmado por auditoria de código — nenhum mecanismo runtime (`context-collector.ts`, `mcp-server-handlers.ts`, daemon) lê o **conteúdo** de ADRs ou skills, só metadado de existência via `knowledge-graph/discovery.ts`. `detectXSS` e `detectSRPViolations` reimplementam heurísticas que já existem em prosa em `docs/skills/security_xss_prevention.md` e `docs/skills/solid_principles.md`, sem nenhuma referência de volta.
**Correção sobre plano anterior:** `src/path-safety.ts` já existe (`isPathSafe`, `sanitizePlanId`, `sanitizePlanName`) — reaproveitado abaixo, não recriado.

---

## Arquitetura Proposta

```
src/knowledge-loader.ts     ← novo: lê CONTEÚDO real de ADRs e skills (não só metadado)
src/mcp-server-handlers.ts   ← ganha handleGetADRs, handleGetSkills
src/context-collector.ts     ← briefing ganha uma seção "governance knowledge"
src/audit/types.ts           ← HealthIssue ganha campo opcional skillRef
src/audit/skill-refs.ts      ← novo: mapa detector → skill, para rastreabilidade
```

---

## FASE 1: `src/knowledge-loader.ts` — Ler Conteúdo Real (1 dia)

```typescript
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { sanitizePlanName } from "./path-safety.js"; // reaproveitado, já existe

export interface AdrSummary {
  id: string;          // "ADR-008"
  title: string;
  status: string;      // Proposed | Accepted | Deprecated
  filename: string;
}

export interface AdrFull extends AdrSummary {
  content: string;      // markdown completo
}

export interface SkillMeta {
  name: string;         // do frontmatter YAML
  description: string;  // do frontmatter YAML
  filename: string;
}

export interface SkillFull extends SkillMeta {
  content: string;       // markdown completo, sem o frontmatter
}

function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw };
  const meta: Record<string, string> = {};
  for (const line of match[1]!.split("\n")) {
    const [key, ...rest] = line.split(":");
    if (key && rest.length) meta[key.trim()] = rest.join(":").trim().replace(/^>\s*/, "");
  }
  return { meta, body: match[2]!.trim() };
}

/** Lista ADRs com metadado leve (status + título), sem carregar o corpo inteiro. */
export function listAdrs(shitenDir: string): AdrSummary[] {
  const adrDir = join(shitenDir, "docs", "adrs");
  if (!existsSync(adrDir)) return [];

  return readdirSync(adrDir)
    .filter((f) => f.endsWith(".md") && !f.startsWith("ADR-TEMPLATE"))
    .map((filename) => {
      const raw = readFileSync(join(adrDir, filename), "utf-8");
      const idMatch = filename.match(/^(ADR-\d+)/);
      const titleMatch = raw.match(/^#\s*(.+)$/m);
      const statusMatch = raw.match(/\*\*Status:\*\*\s*(\w+)/);
      return {
        id: idMatch?.[1] ?? filename,
        title: titleMatch?.[1]?.replace(/^ADR-\d+:\s*/, "") ?? filename,
        status: statusMatch?.[1] ?? "Unknown",
        filename,
      };
    });
}

/** Carrega o conteúdo completo de um ADR específico, por id ou filename. */
export function getAdr(shitenDir: string, idOrFilename: string): AdrFull | null {
  const adrDir = join(shitenDir, "docs", "adrs");
  const safe = sanitizePlanName(idOrFilename); // reaproveita o helper já existente
  const summaries = listAdrs(shitenDir);
  const match = summaries.find((a) => a.id === safe || a.filename === safe || a.filename === `${safe}.md`);
  if (!match) return null;

  const content = readFileSync(join(adrDir, match.filename), "utf-8");
  return { ...match, content };
}

/** Lista skills com metadado do frontmatter (nome + descrição), sem corpo completo. */
export function listSkills(shitenDir: string): SkillMeta[] {
  const skillsDir = join(shitenDir, "docs", "skills");
  if (!existsSync(skillsDir)) return [];

  return readdirSync(skillsDir)
    .filter((f) => f.endsWith(".md"))
    .map((filename) => {
      const raw = readFileSync(join(skillsDir, filename), "utf-8");
      const { meta } = parseFrontmatter(raw);
      return {
        name: meta.name ?? filename.replace(".md", ""),
        description: meta.description ?? "",
        filename,
      };
    });
}

/** Carrega o conteúdo completo de uma skill específica, por nome ou filename. */
export function getSkill(shitenDir: string, nameOrFilename: string): SkillFull | null {
  const skillsDir = join(shitenDir, "docs", "skills");
  const safe = sanitizePlanName(nameOrFilename);
  const summaries = listSkills(shitenDir);
  const match = summaries.find((s) => s.name === safe || s.filename === safe || s.filename === `${safe}.md`);
  if (!match) return null;

  const raw = readFileSync(join(skillsDir, match.filename), "utf-8");
  const { body } = parseFrontmatter(raw);
  return { ...match, content: body };
}
```

**Critério de aceite:** `listAdrs()` retorna os 9 ADRs existentes (incluindo ADR-008/009 depois de salvos) com status correto; `getSkill(shitenDir, "solid-principles")` retorna o corpo completo de `solid_principles.md` sem o frontmatter YAML; `getAdr`/`getSkill` com um id inexistente retornam `null`, não lançam exceção.

---

## FASE 2: Ferramentas MCP `getADRs` e `getSkills` (0.5-1 dia)

**Ficheiro:** `src/mcp-server-handlers.ts`, seguindo exatamente o padrão já usado por `handleGetBriefing` (daemon-first, disk-fallback)

```typescript
import { listAdrs, getAdr, listSkills, getSkill } from "./knowledge-loader.js";

export async function handleGetADRs(
  projectRoot: string,
  shitenDir: string,
  args: Record<string, unknown>
): Promise<ToolResponse> {
  const id = args.id as string | undefined;

  if (id) {
    const adr = getAdr(shitenDir, id);
    if (!adr) {
      return { content: [{ type: "text", text: `ADR "${id}" not found` }] };
    }
    return { content: [{ type: "text", text: adr.content }] };
  }

  const summaries = listAdrs(shitenDir);
  const text = summaries
    .map((a) => `${a.id} [${a.status}]: ${a.title}`)
    .join("\n");
  return { content: [{ type: "text", text: text || "No ADRs found." }] };
}

export async function handleGetSkills(
  projectRoot: string,
  shitenDir: string,
  args: Record<string, unknown>
): Promise<ToolResponse> {
  const name = args.name as string | undefined;

  if (name) {
    const skill = getSkill(shitenDir, name);
    if (!skill) {
      return { content: [{ type: "text", text: `Skill "${name}" not found` }] };
    }
    return { content: [{ type: "text", text: skill.content }] };
  }

  const summaries = listSkills(shitenDir);
  const text = summaries
    .map((s) => `${s.name}: ${s.description}`)
    .join("\n");
  return { content: [{ type: "text", text: text || "No skills found." }] };
}
```

**Ficheiro:** registro das ferramentas no servidor MCP (onde `getBriefing`/`getRiskMap`/`getBacklog` já são registradas — provavelmente `src/mcp-server.ts`)
```typescript
{
  name: "getADRs",
  description: "List Architecture Decision Records, or get the full content of one by id (e.g. 'ADR-008')",
  inputSchema: { type: "object", properties: { id: { type: "string" } } },
},
{
  name: "getSkills",
  description: "List coding skills/guidelines, or get the full content of one by name",
  inputSchema: { type: "object", properties: { name: { type: "string" } } },
},
```

**Critério de aceite:** um agente conectado via MCP consegue chamar `getADRs` sem argumento e ver a lista dos 9 ADRs com status; chamar `getADRs({id: "ADR-008"})` e receber o markdown completo; o mesmo para `getSkills`.

---

## FASE 3: Seção de Governança na Briefing (0.5-1 dia)

**Ficheiro:** `src/context-collector.ts` — adicionar ao objeto `Briefing` já existente

```typescript
import { listAdrs, listSkills } from "./knowledge-loader.js";

// dentro de collectContext(), antes de montar o briefing final:
const activeAdrs = listAdrs(shitenDir).filter((a) => a.status === "Accepted" || a.status === "Proposed");
const availableSkills = listSkills(shitenDir);

const governanceKnowledge = {
  adrs: activeAdrs.map((a) => ({ id: a.id, title: a.title, status: a.status })),
  skills: availableSkills.map((s) => ({ name: s.name, description: s.description })),
};
```

**Nota importante para o agente:** não incluir o **corpo completo** de todos os ADRs/skills na briefing por padrão — isso infla o payload que todo comando/consulta carrega, mesmo quando não é relevante. A briefing deve conter só a lista leve (id/título/status para ADR, nome/descrição para skill); o agente que precisar do conteúdo completo de um item específico chama `getADRs({id})`/`getSkills({name})` (Fase 2) sob demanda. Isso segue o mesmo princípio de design que `query_briefing` já usa hoje (resumo primeiro, detalhe sob demanda).

**Critério de aceite:** `shiten briefing --format json` (e o `getBriefing` do MCP) passam a incluir `governanceKnowledge.adrs` e `governanceKnowledge.skills`, ambos como listas leves; nenhum aumento perceptível no tempo de resposta da briefing.

---

## FASE 4: Ligar Detectores às Skills que Já Duplicam (1 dia)

**Não migrar a lógica de detecção para ler o markdown em runtime** — isso trocaria checagem determinística e rápida por parsing de prosa, um passo atrás. **A correção certa é rastreabilidade, não fusão de mecanismo.**

### 4.1 Campo `skillRef` em `HealthIssue`
**Ficheiro:** `src/audit/types.ts`
```typescript
export interface HealthIssue {
  // ...campos existentes...
  /** Nome da skill em docs/skills/ que documenta a prática relacionada a este achado, se houver. */
  skillRef?: string;
}
```

### 4.2 Popular nos detectores já identificados como duplicando skill
**Ficheiro:** `src/audit/engineering-detectors-security.ts` (`detectXSS`)
```typescript
issues.push({
  type: "xss_risk",
  // ...campos existentes...
  skillRef: "security_xss_prevention",
});
```

**Ficheiro:** `src/audit/architecture-detectors.ts` (`detectSRPViolations`)
```typescript
issues.push({
  type: "srp_violation",
  // ...campos existentes...
  skillRef: "solid-principles",
});
```

### 4.3 `src/audit/skill-refs.ts` — mapa central de rastreabilidade
```typescript
/**
 * Mapa de tipos de issue para a skill que documenta a prática relacionada.
 * Usado para auditoria de cobertura: toda skill deveria ter pelo menos um
 * detector associado, e todo detector de "boas práticas" deveria referenciar uma skill.
 */
export const ISSUE_TYPE_TO_SKILL: Partial<Record<HealthIssueType, string>> = {
  xss_risk: "security_xss_prevention",
  srp_violation: "solid-principles",
  // expandir conforme mais overlaps forem confirmados manualmente —
  // não popular isto especulativamente, só depois de checar como fizemos
  // com XSS e SRP nesta conversa.
};
```

### 4.4 Novo detector leve: skills órfãs de detector
```typescript
// src/audit/governance-detectors-config.ts (ou arquivo apropriado)
export function detectOrphanSkills(shitenDir: string): HealthIssue[] {
  const skills = listSkills(shitenDir);
  const referencedSkills = new Set(Object.values(ISSUE_TYPE_TO_SKILL));
  const issues: HealthIssue[] = [];

  for (const skill of skills) {
    if (!referencedSkills.has(skill.name)) {
      issues.push({
        type: "orphan_skill",
        severity: 1,
        description: `Skill "${skill.name}" não tem nenhum detector associado — só existe como prosa, sem checagem automática`,
        location: `docs/skills/${skill.filename}`,
        recommendation: `Se a skill documenta uma prática checável por código, considerar criar um detector e registrar em ISSUE_TYPE_TO_SKILL`,
        confidence: 0.7, // heurística — nem toda skill precisa de detector (ex.: tdd_workflow.md é processo, não padrão de código)
      });
    }
  }
  return issues;
}
```

**Critério de aceite:** rodar `shiten audit --level enterprise` depois desta fase — achados de `xss_risk` e `srp_violation` agora incluem `skillRef` no JSON; um novo achado `orphan_skill` aparece para as ~16 skills restantes sem detector associado, dando visibilidade de quanto da documentação de skill ainda não tem checagem automática correspondente.

---

## Sequenciamento

```
DIA 1:      Fase 1 (knowledge-loader.ts)
DIA 2:      Fase 2 (ferramentas MCP getADRs/getSkills)
DIA 3:      Fase 3 (seção de governança na briefing)
DIA 4:      Fase 4 (skillRef + detector de skills órfãs)
```

**Total: ~4 dias.** Independente dos outros seis planos — não compartilha módulo com nenhum deles além de `mcp-server-handlers.ts`, que já é tocado só de leitura (adicionar duas funções novas, não alterar as existentes). Pode rodar a qualquer momento, isolado.

---

## Métricas de Sucesso

| Métrica | Antes | Depois |
|---|---|---|
| Mecanismo runtime lendo conteúdo de ADR | Nenhum | `knowledge-loader.ts` + MCP `getADRs` |
| Mecanismo runtime lendo conteúdo de skill | Nenhum | `knowledge-loader.ts` + MCP `getSkills` |
| Agente conectado via MCP consegue descobrir ADRs/skills | Não | Sim |
| Detectores com rastreabilidade explícita à skill que duplicam | 0 | ≥2 (XSS, SRP), expansível |
| Skills sem nenhum detector associado, com visibilidade | Desconhecido | Medido via `detectOrphanSkills` |
