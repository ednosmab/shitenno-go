# Plano: Resolver Colisão de Nomenclatura "Health Score"

**Data:** 2026-07-04
**Status:** Pendente
**Prioridade:** P1 (importante, não crítico)
**Owner:** Agente IA
**Tempo estimado:** ~20 min

---

## Problema

Três comandos (`console`, `audit`, `doctor`) mostram "Health Score" com valores completamente diferentes para métricas distintas. Para um utilizador do CLI, ver "Health Score: 70/100" num comando e "healthScore: 0/100" noutro é confuso — é colisão de nomenclatura, não bug.

### Métricas envolvidas

| Domínio | Comando | Label actual | Cálculo | Fonte |
|---|---|---|---|---|
| Session | `nexus console` | `Health Score` | successRate×40 + cacheHitRate×30 + sessions×30 | `src/commands/console.ts:103` |
| Code | `nexus audit` | `Health Score` | 100 − Σ(severity penalties) | `src/health-auditor.ts:927` |
| Risk | `nexus doctor` | `health score` | 100 − Σ(risk-severity penalties) | `src/commands/doctor.ts:243` |

### Rename proposto

| Domínio | Label actual | Label novo |
|---|---|---|
| Session (console) | `Health Score` | **Session Score** |
| Code (audit) | `Health Score` | **Code Health** |
| Risk (doctor) | `health score` | **Risk Health** |

---

## Steps

### Step 1: Renomear "Health Score" → "Session Score" no console

| # | Ficheiro | Acção | Verificação |
|---|---|---|---|
| 1.1 | `src/commands/console.ts:108` | Trocar `"🏥 Health Score"` → `"🏥 Session Score"` | `grep "Session Score" src/commands/console.ts` |
| 1.2 | `src/console/tabs/overview.tsx:31` | Trocar `title="Health Score"` → `title="Session Score"` | `grep "Session Score" src/console/tabs/overview.tsx` |
| 1.3 | `src/doc-engine.ts:69` | Trocar `> Health Score:` → `> Session Score:` | `grep "Session Score" src/doc-engine.ts` |

### Step 2: Renomear "Health Score" → "Code Health" no audit

| # | Ficheiro | Acção | Verificação |
|---|---|---|---|
| 2.1 | `src/commands/audit.ts:207` | Trocar `"    Health Score:"` → `"    Code Health:"` | `grep "Code Health" src/commands/audit.ts` |
| 2.2 | `src/commands/audit.ts:79` | Trocar `health score:` → `code health:` no spinner | `grep "code health" src/commands/audit.ts` |

### Step 3: Renomear "health score" → "Risk Health" no doctor

| # | Ficheiro | Acção | Verificação |
|---|---|---|---|
| 3.1 | `src/commands/doctor.ts:259` | Trocar `health score:` → `risk health:` no summary | `grep "risk health" src/commands/doctor.ts` |

### Step 4: Renomear na knowledge-debt (consistência interna)

| # | Ficheiro | Acção | Verificação |
|---|---|---|---|
| 4.1 | `src/knowledge-debt.ts:136` | Trocar `Health score:` → `Debt Health:` | `grep "Debt Health" src/knowledge-debt.ts` |

### Step 5: Actualizar testes se existirem referências

| # | Ficheiro | Acção | Verificação |
|---|---|---|---|
| 5.1 | `src/__tests__/health-auditor.test.ts` | Verificar se há asserts com "Health Score" e actualizar | `grep -n "Health Score" src/__tests__/health-auditor.test.ts` |
| 5.2 | `src/__tests__/knowledge-debt.test.ts` | Verificar se há asserts com "Health score" e actualizar | `grep -n "Health score" src/__tests__/knowledge-debt.test.ts` |

### Step 6: Verificação final

| # | Comando | Resultado esperado |
|---|---|---|
| 6.1 | `npx tsc --noEmit` | Zero erros |
| 6.2 | `npx vitest run` | Todos passam |
| 6.3 | `grep -rn "Health Score" src/commands/ src/console/tabs/ src/doc-engine.ts src/knowledge-debt.ts` | Zero ocorrências (todas renomeadas) |

---

## Ficheiros a modificar

| Ficheiro | Mudança |
|---|---|
| `src/commands/console.ts` | "Health Score" → "Session Score" |
| `src/console/tabs/overview.tsx` | "Health Score" → "Session Score" |
| `src/doc-engine.ts` | "Health Score" → "Session Score" |
| `src/commands/audit.ts` | "Health Score" → "Code Health" |
| `src/commands/doctor.ts` | "health score" → "risk health" |
| `src/knowledge-debt.ts` | "Health score" → "Debt Health" |
| `src/__tests__/*.test.ts` | Actualizar asserts se necessário |

---

## Salvaguardas

- **S1:** Não alterar interfaces TypeScript (`healthScore: number`) — apenas strings de display
- **S2:** Não alterar nomes de variáveis internas — apenas labels visíveis ao utilizador
- **S3:** Não alterar telemetria/payloads — apenas output de terminal
- **S4:** Não tocar em `init.ts`, `dashboard.tsx`, `run.ts` (usam "Health Score" mas com contexto claro, sem colisão)

---

## Métricas-alvo

- **Ficheiros modificados:** 5-7 (tolerância ±2)
- **Linhas alteradas:** 8-12 (tolerância ±3)
- **Testes quebrados:** 0 (tolerância 0)

---

## Pontos de pausa G-01

- **Não há commit automático.** Após execução, pedir autorização ao utilizador antes de commitar.
