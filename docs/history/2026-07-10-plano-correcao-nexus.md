# Plano de Correção Nexus — Execução e Validação

> **Data:** 2026-07-10
> **Plano original:** `nexus-system/governance/plans/PLANO-CORRECAO-NEXUS.md`
> **Estado:** ✅ Concluído (todos os 5 bugs corrigidos e validados)

---

## Resumo Executivo

O plano de correcção foi gerado a partir de validação de execução real (install → typecheck → build → test → CLI → self-audit). Todos os 5 bugs foram corrigidos, com testes de regressão adicionados e validação completa do pipeline.

| Métrica | Antes | Depois |
|---|---|---|
| `npx tsc --noEmit` | 3 erros | 0 erros ✅ |
| `npx vitest run` | 1778 testes | 1784 testes (+6 novos) ✅ |
| `nexus init --answers-file` | Crash (TypeError) | Funciona ✅ |

---

## Bugs Corrigidos

### Bug 1 — `feedback-utils.ts` não existe (CLI não sobe)

**Causa raiz:** `src/commands/feedback.ts` importava `parseUserRating` e `parseUserTags` de `../feedback-utils.js`, mas esse arquivo não existia.

**Correção:** Criado `src/feedback-utils.ts` com as funções `parseUserRating` e `parseUserTags`.

**Teste de regressão:** `src/__tests__/feedback-utils.test.ts` — 6 testes (clamping, parsing, edge cases).

---

### Bug 2 — `banner()` importado em 5 comandos mas nunca exportado

**Causa raiz:** `commands/init.ts`, `status.ts`, `audit.ts`, `detect.ts`, `validate.ts` importavam `banner` de `../formatting.js`, mas a função não existia.

**Correção:** Adicionada função `banner()` em `src/formatting.ts:99` com formatação boxed usando chalk.

**Teste de regressão:** `src/__tests__/formatting.test.ts` — 2 testes (com e sem subtitle).

---

### Bug 3 — 5 regras de governança com JSON inválido (`RULE-011` a `RULE-015`)

**Causa raiz:** Chave `params` aparecia sem aspas dentro do objecto `actions` (`{ "type": "run_nexus_command", params: { ... } }` em vez de `"params": { ... }`).

**Correção:** Substituído `params:` por `"params":` nos 5 ficheiros JSON:
- `nexus-system/governance/rules/RULE-011.json`
- `nexus-system/governance/rules/RULE-012.json`
- `nexus-system/governance/rules/RULE-013.json`
- `nexus-system/governance/rules/RULE-014.json`
- `nexus-system/governance/rules/RULE-015.json`

---

### Bug 4 — Plugins de exemplo com sintaxe TypeScript em arquivos `.js`

**Causa raiz:** Hooks usavam anotações de tipo (`input: unknown`, `as Record<...>`) dentro de arquivos `.js` puros, que o Node executa como JavaScript.

**Correção:** Removidas anotações de tipo de:
- `nexus-system/plugins/event-logger/plugin.js`
- `nexus-system/plugins/health-monitor/plugin.js`

**Teste de regressão:** `src/__tests__/plugin-examples-syntax.test.ts` — Valida que todos os plugins `.js` são módulos ES válidos.

---

### Bug 5 — `nexus init --answers-file` crasha com o `answers.json` bundlado

**Causa raiz:** `nexus-system/answers.json` só tinha o bloco `maturity`, mas a interface `UserAnswers` exige também `principalModel`, `executorModel`, `stack`, `database`, `styling`. `fillPlaceholders()` chamava `answers.stack.join(", ")` sem checar se `stack` existe.

**Correções aplicadas:**
1. Actualizado `nexus-system/answers.json` com todos os campos obrigatórios
2. Blindada `fillPlaceholders()` em `src/scaffolder.ts:317` com verificação `Array.isArray()`

**Teste de regressão:** `src/__tests__/scaffolder-answers-file.test.ts` — 6 testes (campos completos, stack vazio, campos opcionais, strings vazias).

---

## Correcções Adicionais (durante validação)

### Erros de TypeScript em `doctor.ts` e `commands.test.ts`

**Problema:** Após correcção dos 5 bugs, `npx tsc --noEmit` revelou 3 erros:
1. `doctor.ts:107` — parâmetro `nexusDir` declarado mas não utilizado
2. `commands.test.ts` — múltiplos erros de tipo (`NexusState` vs `EngineeringState`)

**Correções:**
1. Removido parâmetro `nexusDir` de `analyzeImprovements()` em `src/commands/doctor.ts`
2. Reescrito `makeState()` em `src/__tests__/commands.test.ts` para retornar `EngineeringState`
3. Adicionado `futureCapabilities` aos objectos `MaturityProfile` nos testes
4. Corrigidos objectos `EngineeringAsset` com todos os campos obrigatórios

---

## Validação Final

```bash
# Typecheck
$ npx tsc --noEmit
# (sem output = sem erros)

# Testes
$ npx vitest run
# Test Files  111 passed (111)
# Tests       1784 passed (1784)

# Smoke test
$ npx tsx bin/nexus.ts init --dir /tmp/nexus-smoke-test --answers-file nexus-system/answers.json
# ✔ Framework installed! (90+ ficheiros criados correctamente)
```

---

## Lições Aprendidas

1. **JSON inválido silencioso é perigoso:** O rule engine fazia `logger.warn` e seguia em frente. Validação estrutural (fail-fast) é preferível para ficheiros de configuração.

2. **Plugins `.js` não devem usar sintaxe TS:** Documentar explicitamente que plugins precisam ser JS puro, ou suportar `.ts` via runtime (tsx/jiti).

3. **Testes de regressão devem cobrir o caminho real de uso:** O bug do `answers.json` afectava directamente o Quick Start do README — exactamente o caminho que qualquer novo utilizador seguiaria.

4. **Type checking pós-correção é essencial:** Corrigir bugs pode revelar erros de tipo adjacentes que estavam escondidos.
