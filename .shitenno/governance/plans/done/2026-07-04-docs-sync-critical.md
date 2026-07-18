# Plano: Actualização de Documentação Desactualizada

**Data:** 2026-07-04
**Status:** Concluído (2026-07-05)
**Prioridade:** P0 (crítico, ≤ 7d)
**Owner:** Agente IA
**Tempo estimado:** ~30 min

---

## Problema

6 ficheiros de documentação contêm informações desactualizadas que contradizem o estado real do código. O README.md (ponto de entrada principal) está particularmente desfasado — lista 13 comandos quando existem 26, e 484 testes quando são ~1056.

---

## Steps

### Step 1: Actualizar README.md (crítico)

| # | Accão | Verificação |
|---|---|---|
| 1.1 | Atualizar tabela de comandos: adicionar os 13 comandos em falta (`act`, `plan`, `goal`, `decide`, `policy`, `console`, `digest`, `bench`, `briefing`, `feedback`, `profile`, `dashboard`, `shell-init`, `docs-audit`) | `grep -c "^\|" README.md` mostra 26+ linhas de comandos |
| 1.2 | Corrigir "13 CLI commands" → "26 CLI commands" na linha ~143 | `grep "CLI commands" README.md` |
| 1.3 | Corrigir "484+ tests (31 files)" → contagem real (~1056 testes, 64 ficheiros) | `grep "tests" README.md` |

### Step 2: Corrigir referências partidas em AGENTS.md (crítico)

| # | Accão | Verificação |
|---|---|---|
| 2.1 | Remover `Requisitos_plataforma.md` da lista P0 (ficheiro não existe em nenhum lado) | `grep -c "Requisitos_plataforma" docs/AGENTS.md` = 0 |
| 2.2 | Corrigir referência `docs/plans/TEMPLATE.md` → remover ou criar o ficheiro | `grep "TEMPLATE.md" docs/AGENTS.md` |

### Step 3: Actualizar Shitenno-go_GUIDE.md (médio)

| # | Accão | Verificação |
|---|---|---|
| 3.1 | Corrigir "6 relatórios" → contagem real de `complexity-*.json` | `ls shitenno-go/reports/complexity-*.json \| wc -l` |
| 3.2 | Corrigir "15 registos de feedback" → 14 | `ls shitenno-go/feedback/records/ \| wc -l` |
| 3.3 | Adicionar `docs/audits/` e `docs/capabilities.md` à árvore de ficheiros | `grep "audits" Shitenno-go_GUIDE.md` |

### Step 4: Corrigir CONCEPTUAL_MODEL.md (médio)

| # | Accão | Verificação |
|---|---|---|
| 4.1 | Corrigir `maturity-profile.ts` → `src/maturity-profile.ts` | `grep "maturity-profile" CONCEPTUAL_MODEL.md` |
| 4.2 | Corrigir `capability-mapping.ts` → `src/capability-mapping.ts` | `grep "capability-mapping" CONCEPTUAL_MODEL.md` |
| 4.3 | Preencher date placeholder `YYYY-MM-DD` | `grep "YYYY-MM-DD" CONCEPTUAL_MODEL.md` = 0 |

### Step 5: Actualizar SYSTEM_MAP.md (menor)

| # | Accão | Verificação |
|---|---|---|
| 5.1 | Adicionar `docs/audits/` à árvore | `grep "audits" SYSTEM_MAP.md` |
| 5.2 | Adicionar `docs/capabilities.md` à árvore | `grep "capabilities" SYSTEM_MAP.md` |

### Step 6: Actualizar CHANGELOG.md (menor)

| # | Accão | Verificação |
|---|---|---|
| 6.1 | Adicionar entrada v0.2.0 com: audit levels, 33 detectors, taint analysis, 26 comandos | `grep "v0.2.0" CHANGELOG.md` |

### Step 7: Verificação final

| # | Comando | Resultado esperado |
|---|---|---|
| 7.1 | `npx tsc --noEmit` | Zero erros |
| 7.2 | `npx vitest run src/__tests__/health-auditor.test.ts` | 60/60 passam |
| 7.3 | `shiten audit --level full --json \| jq .issues \| wc -l` | ≤ 66 issues |

---

## Ficheiros a modificar

| Ficheiro | Mudança |
|---|---|
| `README.md` | Tabela comandos, contadores |
| `docs/AGENTS.md` | Remover Requisitos_plataforma, corrigir TEMPLATE.md ref |
| `shitenno-go/docs/Shitenno-go_GUIDE.md` | Contagens, árvore |
| `shitenno-go/docs/CONCEPTUAL_MODEL.md` | Paths, data |
| `shitenno-go/governance/SYSTEM_MAP.md` | Árvore |
| `CHANGELOG.md` | Nova versão |

---

## Checklist de Conclusão

- [x] README.md: 26 comandos listados
- [x] README.md: contagem de testes actualizada
- [x] AGENTS.md: Requisitos_plataforma.md removido da lista P0
- [x] AGENTS.md: referência TEMPLATE.md corrigida
- [x] GUIDE: contagens "relatórios" e "registos" correctas
- [x] GUIDE: árvore com docs/audits/ e capabilities.md
- [x] CONCEPTUAL_MODEL: paths completos para .ts files
- [x] CONCEPTUAL_MODEL: date placeholder preenchido
- [x] SYSTEM_MAP: árvore com docs/audits/ e capabilities.md
- [x] CHANGELOG: entrada v0.2.0 adicionada
- [x] TypeScript: zero erros
- [x] Testes: 60/60 passam
