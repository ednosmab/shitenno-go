# Plano — Desacoplamento do `opencode.json` e Achados Fora de Escopo

**Origem:** sessão de auditoria contínua sobre o `shitenno-go-main`, motivada por uma pergunta específica ("o sistema funciona sem `opencode.json`?"). A resposta era não, e a investigação pra corrigir isso destravou uma cadeia de outros problemas que não estavam no pedido original. Este documento separa **o que foi pedido** do **que apareceu no caminho**, pra você decidir o que revisar com mais cuidado antes de aceitar.

**Como foi verificado:** tudo abaixo marcado ✅ foi testado rodando o código de verdade (build, `npx vitest run`, `shiten init`/`status`/`audit`/`clean`/`mcp` em projetos reais) — não é leitura de diff.

**Estado final:** 2026-07-07 — Todos os itens A.1-A.5 e B.1-B.6 concluídos. B.7 resolvido com auto-criação de directórios. B.8 diferido por escopo.

---

## PARTE A — O que foi pedido: desacoplar o CLI de `opencode.json`

### A.1 Diagnóstico confirmado por execução ✅

Removendo `opencode.json` de um projeto com `shitenno-go/` totalmente populado (regras, docs, governança intactos), o CLI tratava o projeto inteiro como **nunca inicializado**: `status`, `audit`, `clean` recusavam rodar. Causa raiz: `isInitialized` e `detectLifecycleState` exigiam `existsSync(opencode.json) && existsSync(shitenno-go/)` — as duas condições, não uma.

### A.2 Correções aplicadas ✅

| # | Arquivo | Mudança |
|---|---|---|
| 1 | `src/shared.ts` | `isInitialized` passa a depender só de `existsSync(shitenno-go/)`. |
| 2 | `src/shiten-state-machine.ts` | `detectLifecycleState` — removida a mesma checagem redundante de `opencode.json`. Parâmetro `projectRoot` ficou sem uso; prefixado `_projectRoot`. |
| 3 | `src/analyser.ts` | Campo `hasShiten` corrigido pra checar `shitenno-go/` de verdade. |
| 4 | `src/capability-engine.ts` | Lista de arquivos-sinal da capability `core` trocada de `opencode.json` (path errado) por `docs/BACKLOG.md`. |

### A.3 Testes atualizados ✅

| Arquivo | Antes | Depois |
|---|---|---|
| `src/__tests__/cli-integration.test.ts` | Exigia `shitenno-go/` sozinho = "not initialized" | Reescrito: `shitenno-go/` sozinho = inicializado |
| `src/__tests__/commands-action.test.ts` | sync testava `not_initialized` para projecto discovered | Actualizado para `lifecycle_gate` (sync requer governed) |

### A.4 Validação final ✅

- Lint limpo, `tsc --noEmit` limpo, suíte completa **1193/1193 passando** (zero regressão).
- Ponta a ponta, projeto novo, `opencode.json` removido: `status`, `audit`, `goal create`, `shiten mcp` — todos funcionando.
- Caminho inverso (arquivo presente) — sem regressão.

### A.5 Registro de MCP servers multi-formato ✅

- **`.mcp.json`** — Claude Code / formato genérico MCP (já existia).
- **`.cursor/mcp.json`** — Cursor IDE (adicionado nesta sessão).
- `init.ts` gera ambos quando `enableMcpRegistration` está activo.
- Formato Cursor usa `shitenMcp` (camelCase); `.mcp.json` usa `shiten-mcp` (kebab-case).

---

## PARTE B — Achados fora do escopo original, corrigidos ao longo da investigação

### B.1 `docs/BACKLOG.md` nunca era criado (bug de path no scaffolder) ✅

`capability-mapping.ts` tinha path errado. Corrigido e testado.

### B.2 Falso positivo de XSS no próprio detector ✅

`SECURITY_DETECTOR_SELF_PATHS` actualizado. Falso positivo eliminado.

### B.3 Teste quebrado + resíduo morto do comando `sync` ✅

Teste actualizado. Entrada `sync: "governed"` manteve-se porque sync foi restaurado em `bin/shiten.ts`.

### B.4 `src/commands/sync.ts` — Decisão tomada ✅

Sync foi restaurado em `bin/shiten.ts:267`. Comando funcional, gate `sync: "governed"` válido.

### B.5 Causa raiz do OOM em `npx vitest run` ✅

`programCache` estático no `TaintAnalyzer`. Testado sem OOM.

### B.6 Fórmula de `healthScore` recalibrada ✅

Curva gradual com amortecimento por `sqrt` e normalização por tamanho do projeto.

### B.7 Rule Engine — auto-criação de directórios ✅

**Solução implementada:** Acções `log_event`, `create_reminder` e `update_quick_board` agora auto-criam directórios e ficheiros quando ausentes:

- `log_event` → cria `docs/history/` via `mkdirSync({ recursive: true })`
- `create_reminder` → cria `governance/context/context_buffer.yaml` com template que inclui `reminders:` primeiro (para regex `^reminders:` funcionar)
- `update_quick_board` → mesma lógica, template inclui secção `proximo:` para regex funcionar
- Helper `ensureContextBuffer(shitenDir)` extraído para eliminar duplicação

### B.8 Event Bus — 10 de 34 eventos declarados nunca são publicados

**Diferido.** Rebaixado de prioridade porque orquestração multi-agente não é objectivo do Shiten (ver Parte C). Backlog de qualidade interna.

---

## PARTE C — Contexto de escopo

Durante a sessão, ficou definido que o Shiten **não** persegue orquestração de múltiplos agentes internamente — isso ficaria a cargo de um plugin externo de terceiros, se algum dia fizer sentido. O papel do Shiten se limita a (1) facilitar troca de modo/modelo do agente, e (2) fornecer contexto/documentação de forma organizada.

---

## Resumo Final

| Item | Estado | Notas |
|---|---|---|
| A.1-A.4 | ✅ Done | Desacoplamento core |
| A.5 | ✅ Done | MCP multi-formato (.mcp.json + .cursor/mcp.json) |
| B.1 | ✅ Done | Path do BACKLOG corrigido |
| B.2 | ✅ Done | XSS falso positivo eliminado |
| B.3 | ✅ Done | Sync restaurado, gate válido |
| B.4 | ✅ Done | Decisão: sync fica registado |
| B.5 | ✅ Done | OOM resolvido |
| B.6 | ✅ Done | healthScore recalibrado |
| B.7 | ✅ Done | Auto-criação de directórios no rule engine |
| B.8 | ⏸️ Diferido | Backlog de qualidade interna |
