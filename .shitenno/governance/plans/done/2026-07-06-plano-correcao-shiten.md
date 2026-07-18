# Plano de Correção — Shitenno-go (sessão 2026-07-06)

**Origem:** auditoria de continuação sobre o zip `shitenno-go-main`, feita rodando o código de verdade (build, testes, `shiten init`/`audit`/`clean` em projetos reais), não apenas lendo diffs.
**Como usar este documento:** cada item tem status verificado, causa raiz, e o fix exato (ou a decisão que falta tomar). Trate "✅ verificado" como fato testado nesta sessão — não precisa refazer a investigação, só aplicar. Trate "⚠️ não verificado" como algo que precisa ser investigado antes de mexer, não como bug confirmado.

---

## 0. Regra de honestidade a manter (herdada da sessão anterior, reforçada nesta)

- Não confirme um fix rodando só `tsc`/lint — rode o comando/teste real.
- Não presuma que um arquivo existe porque o mapping/template diz que existe — `existsSync` real, sempre.
- Dois bugs novos desta sessão (itens 1 e 2 abaixo) só apareceram porque testei `shiten init` em projeto limpo e depois rodei `audit` no próprio repo — leitura de código não teria pego nenhum dos dois.

---

## 1. [PRIORIDADE ALTA] `docs/BACKLOG.md` nunca era criado — **já corrigido nesta sessão**

**Status:** ✅ Corrigido e testado nesta sessão. Só precisa ser levado pro seu branch/commit.

**Causa raiz:** `src/capability-mapping.ts` tinha:
```ts
{ src: "shitenno-go/docs/BACKLOG.md", dest: "docs/BACKLOG.md" },
```
O `src` real do template é `docs/BACKLOG.md` (sem prefixo `shitenno-go/`), e o `dest` correto (o path que `rule-engine.ts` de fato lê via `join(context.shitenDir, "docs", "BACKLOG.md")`) é `shitenno-go/docs/BACKLOG.md`. Como o `scaffolder.ts` faz `if (!existsSync(srcPath)) continue;` (skip silencioso), o arquivo nunca era copiado — em nenhum projeto, mesmo sob a capability `core` (sempre instalada).

**Fix aplicado:**
```ts
{ src: "docs/BACKLOG.md", dest: "shitenno-go/docs/BACKLOG.md" },
```

**Verificação a repetir:** `shiten init` num diretório limpo → `find . -iname BACKLOG.md` deve achar `shitenno-go/docs/BACKLOG.md`.

---

## 2. [PRIORIDADE ALTA] Falso positivo de XSS no próprio detector — **já corrigido nesta sessão**

**Status:** ✅ Corrigido e testado nesta sessão.

**Causa raiz:** `SECURITY_DETECTOR_SELF_PATHS` (`src/audit/constants.ts`) listava `src/health-auditor.ts` e `src/audit/taint/`, mas **não** `src/audit/engineering-detectors.ts` — o arquivo que contém os próprios padrões regex de XSS. Rodando `shiten audit --level full --json` no próprio repo, `engineering-detectors.ts:623-624` se autoacusava de `xss_risk`.

**Fix aplicado:**
```ts
export const SECURITY_DETECTOR_SELF_PATHS = [
  "src/health-auditor.ts",
  "src/audit/taint/",
  "src/audit/engineering-detectors.ts",
];
```

**Verificação a repetir:** rodar `shiten audit --level full --json --no-cache` no próprio repo, checar que não há `console_secret`/`xss_risk` apontando pra `src/audit/`.

---

## 3. [PRIORIDADE MÉDIA] Teste quebrado + resíduo morto do comando `sync` removido

**Status:** ⚠️ Confirmado quebrado, não corrigido ainda.

**O que aconteceu:** em algum momento o comando `sync` foi removido inteiramente do CLI (não está mais em `bin/shiten.ts`, não aparece em `--help`). Mas ficaram 2 resíduos:

1. `src/constants.ts` → `COMMAND_GATES` ainda tem `sync: "governed"` (entrada morta, comando não existe mais).
2. `src/__tests__/cli-integration.test.ts:133` ainda faz `expect(stdout).toContain("sync")` contra o `--help` — **este teste falha hoje** (`1 failed | 1193 passed` na suíte completa).

**Fix sugerido:**
- Remover a linha `expect(stdout).toContain("sync")` do teste (ou trocar por um comando que ainda existe, se a intenção do teste era só checar "tem uma lista razoável de comandos").
- Remover `sync: "governed"` de `COMMAND_GATES` em `src/constants.ts`.
- Confirmar que `docs/help-data.ts` não lista `sync` em lugar nenhum (só `clean`, que é real).

**Verificação:** `npx vitest run` → suíte inteira deve passar 100% (hoje: 1193/1194).

---

## 4. [DECISÃO DE DESIGN NECESSÁRIA] Ações do Rule Engine dependem de arquivos que só existem em tiers avançados

**Status:** ⚠️ Investigado nesta sessão, correção não aplicada — depende de decisão sua.

**O problema:** as 10 regras default do Rule Engine (`src/rule-engine.ts`) são sempre instaladas, em qualquer tier de capability. Mas algumas ações dependem de arquivos/pastas que só são criados por capabilities que **não** são sempre instaladas:

| Ação | Arquivo-alvo | Capability que cria o arquivo | Sempre instalada? |
|---|---|---|---|
| `log_event` (RULE-001, 006, 008, 009) | `shitenno-go/docs/history/` | `metrics` | ❌ Não |
| `create_reminder` (RULE-006, 007, 010) | `governance/context/context_buffer.yaml` | `governance` | ❌ Não |
| `update_backlog` (RULE-005, 010) | `shitenno-go/docs/BACKLOG.md` | `core` (ver item 1) | ✅ Sim (após fix) |

Resultado: num projeto que só tem `core` + `knowledge` instalados (ex.: perfil `junior-solo`), a maioria das ações falha silenciosamente (`existsSync` retorna falso, ação retorna `{success: false}`, e nada quebra visivelmente — mas nada acontece de fato).

**Duas saídas possíveis, escolher uma:**
- **(A)** Mover `docs/history/` e `context_buffer.yaml` pra dentro da capability `core` (sempre existem, regras sempre funcionam desde o dia 1).
- **(B)** Gatear as próprias regras por tier — regras que dependem de `metrics`/`governance` só são instaladas/ativadas se a capability correspondente estiver presente (mais fiel à filosofia de "capacidades progressivas" do projeto, mas mais trabalho).

**Recomendação técnica (não é decisão sua, é fato):** (A) é o fix de menor esforço e resolve o sintoma imediato. (B) é mais alinhado com a arquitetura declarada do projeto (capabilities progressivas), mas exige adicionar um campo `requiredCapability` em cada regra e checar isso em `initializeRules`/`loadRules`.

**Ação concreta enquanto a decisão não é tomada:** pelo menos fazer `log_event`/`create_reminder` criarem o diretório/arquivo-alvo com `mkdirSync(..., {recursive:true})` se não existir, em vez de falhar — isso destrava sem exigir decidir entre (A)/(B) agora.

---

## 5. [DESIGN + LIMPEZA] Event Bus — 10 de 34 eventos declarados nunca são publicados

**Status:** ✅ Recalculado do zero nesta sessão (número diferente do "17 sem assinante" do resumo anterior — são métricas diferentes: isso aqui é falta de *publisher*, não de *subscriber*).

**Eventos declarados em `ShitenEventType` (`src/event-bus.ts`) sem nenhum `.publish(...)` em lugar nenhum do código:**
- `score.calculated`
- `debt.detected`
- `capability.unlocked`
- `engineering_state.consolidated`
- `knowledge_debt.detected`
- `recommendation.accepted`
- `recommendation.rejected`
- `governance.policy_applied`
- `asset.archived`
- `entropy.calculated`

**Consequência direta:** `RULE-005` ("Update backlog when knowledge debt is detected", trigger `knowledge_debt_detected`) depende de `debt.detected` ou `knowledge_debt.detected` — nenhum dos dois é publicado. **A regra nunca dispara.**

**Ação sugerida (precisa de decisão sua, não é diff pronto):** para cada um dos 10 eventos acima, decidir:
- **Implementar o publisher real** (ex.: `debt.detected` deveria ser publicado por onde quer que o cálculo de knowledge debt aconteça — provavelmente `knowledge-graph.ts` ou o comando `goal`/`digest`), ou
- **Remover o evento** de `ShitenEventType` e de qualquer regra/mapeamento que dependa dele, se não fizer mais sentido.

Sugiro priorizar `debt.detected`/`knowledge_debt.detected` (destrava `RULE-005`) e `capability.unlocked` (parece central pra narrativa de "capacidades progressivas" do projeto). Os demais podem ser avaliados com menos urgência.

---

## 6. [REVALIDAR ANTES DE MEXER] Itens que a sessão anterior listou como não revalidados e que eu não confirmei nesta rodada

Não investiguei estes agora — não presuma que estão OK nem que estão quebrados, cheque primeiro:

- Fases 8–12 do "Plano 2": teclado no dashboard (parcialmente confirmado quebrado em sessão anterior — aba Commands sem `useInput`), `goal delete`, nomenclatura duplicada de "Health Score", path do Capability Engine (`docs/adr/` vs `docs/adrs/`), rótulo de estimativa no Token Economy.
- Fase 15 do "Plano 3": publish-readiness (`private: false` no `package.json`, checklist de publicação npm).
- Fase 19 do "Plano 4": `npm audit fix` — o `npm audit` que rodei mostrou 1 vulnerabilidade *low* (esbuild, dev-only); confirmar se ainda é essa ou se mudou.

---

## 7. Confirmado funcionando nesta sessão (não precisa de ação, só registro)

- `npm run lint` → limpo.
- `npx tsc --noEmit` → limpo.
- `npx vitest run` (suíte completa, **sem** `--max-old-space-size`) → roda sem OOM. Causa raiz do OOM anterior (recriação de `ts.Program` a cada teste) foi resolvida de verdade via `TaintAnalyzer.programCache` (cache estático por `tsconfig` hash + mtimes dos arquivos), não só contornada pelo `--max-old-space-size=8192` no CI (que também está lá, como segunda camada de segurança).
- Gate de lifecycle do comando `clean` — testei rodando `shiten clean` num projeto em estado `assessed` (deveria exigir `governed`) → bloqueou corretamente.
- Detector `path_traversal` existe e está implementado (`engineering-detectors.ts`).
- `console_secret` sem falsos positivos (testado no próprio repo).
- Plano 6 da sessão anterior (3 diffs: `update.ts` `__dirname`, `analyzer.ts` `varName`, fórmula de health score) — todos aplicados e re-testados nesta sessão.
- Fase 13/14 (doc-sync-hook removido do bootstrap one-shot, Rule Engine com 10 regras reais persistidas) — confirmado por execução real (`shiten init` + inspeção de `governance/rules/*.json`).

---

## 8. Ordem sugerida de execução pro agente

1. Aplicar item 3 (teste quebrado + resíduo `sync`) — 5 minutos, sem ambiguidade.
2. Aplicar o mitigador do item 4 (criar dir/arquivo-alvo sob demanda nas actions) — destrava o Rule Engine sem esperar decisão de design.
3. Trazer a decisão do item 4 (A vs B) e do item 5 (quais eventos implementar vs remover) de volta pra mim antes de implementar — são decisões de arquitetura, não bugs óbvios.
4. Revalidar item 6 com o mesmo método desta sessão (rodar de verdade, não só ler).

Extritamente após a conclusão desse plano e o sucesso total em todos os testes, deve marcá-lo como done e mover para o diretório done. 