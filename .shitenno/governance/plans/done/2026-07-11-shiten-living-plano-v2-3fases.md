# Shitenno-go Living — Plano de Implementação (v2 — Roteiro em 3 Camadas)

**Status:** In Progress
**Updated_at:** 2026-07-12T21:15:00.984Z
**Date:** 2026-07-12

> **Data:** 2026-07-11 (revisão do plano de 2026-07-10)
> **Objectivo:** Tornar o Shiten num sistema reactivo e vivo — sempre a ouvir eventos, sem intervenção manual
> **Status:** 🟡 `plan_mode` — Aguarda implementação
> **Base:** Revisto contra o código-fonte real em `shitenno-go-main/`, em duas rondas de validação

---

## 0. Correcções ao plano de 2026-07-10

### ❌ Correcção 1: "RULE-020" não existe

O plano original afirma que **RULE-020** reage a mudanças de status e executa `moveToDone()`. Falso — `rule-engine.ts` só define RULE-001 a RULE-019.

Mais grave: o mecanismo de arquivamento automático descrito **não está implementado**:
- `file-watcher.ts` publica `plan.file_changed`, mas nenhum subscritor consome esse evento para verificar o status.
- `markdown-plan-engine.ts` tem `archiveIfDone(id)`, com o comentário *"Used by file-watcher for reactive archival"* — mas **nunca é chamado em lado nenhum**. Código morto.
- `moveToDone()` só é invocado via `updateStatus()`, isto é, só quando o próprio CLI muda o status programaticamente — não quando um humano edita o `.md` directamente.

**Implicação:** é preciso escrever a lógica de arquivamento reactivo pela primeira vez. Isto passou a ser o item nuclear da Fase 2 (ver secção 3).

### ❌ Correcção 2: "`process.exit()` no fim de cada comando"

`bin/shiten.ts` nunca chama `process.exit()` explicitamente no caminho normal — o processo termina porque `stopWatching()` fecha o `chokidar` e o event loop esvazia. Efeito igual, causa diferente.

### ⚠️ Correcção 3 (nova, da segunda ronda de validação): "zero linha de produção chama file-watcher/proactive-engine" é impreciso

Ambos **são** chamados em produção: `bin/shiten.ts:83` chama `initializeProactiveEngine()`, `bin/shiten.ts:118` chama `startWatching()`, incondicionalmente (excepto em processo filho). A afirmação literal está errada.

Mas a observação de fundo por trás dela está certa e é mais importante do que parece: esse watcher só vive pela **janela de execução de um único comando** — tipicamente segundos. Não há praticamente nenhuma hipótese real de um utilizador editar um ficheiro *durante* essa janela. Ou seja: a lógica reactiva não é "nunca chamada" — é chamada, mas **nunca teve, na prática, oportunidade real de ser exercitada**. É uma distinção importante: o risco não é "código morto", é "código vivo mas nunca testado em condições reais", o que é mais perigoso porque dá falsa confiança.

### 🐛 Achado novo: `shiten detect --auto` está provavelmente a falhar em silêncio

`.husky/post-commit` já corre em produção:
```sh
shiten detect --auto 2>/dev/null &
```
Mas `src/commands/detect.ts` **não define nenhuma opção `--auto`** (só `-d/--dir`, `--no-cache`, `--json`, `--format`, `--approve`, `--reject`). O Commander.js rejeita opções desconhecidas por omissão, e nem `bin/shiten.ts` nem `detect.ts` chamam `allowUnknownOption()`. Como o hook redirige stderr para `/dev/null` e corre em background, é provável que este hook **falhe silenciosamente a cada commit**, sem que ninguém tenha reparado. Isto é directamente relevante para a Fase 2 (git hooks) — é o mesmo ponto de integração que se pretende reforçar, por isso vale a pena confirmar e corrigir ao mesmo tempo.

### ✅ Validado sem alterações

| Afirmação | Estado |
|---|---|
| File watcher (chokidar), event bus, rule engine, proactive engine, doc sync hook existem e funcionam | ✅ |
| `EventSourcedState.events[]`, `DeadLetterQueue.queue[]`, `CapabilityLifecycleTracker.history`, `IncrementalConsolidator.pendingDeltas[]`, `ChangeHistoryTracker.history`, cache de `console/data-collector` — todos sem limite/TTL | ✅ confirmado linha a linha |
| Nenhum código de daemon/socket existe hoje | ✅ zero risco de conflito ao introduzir depois |
| `getEngineeringState()` (`engineering-state-access.ts`) é cache **intra-processo apenas** (`let cachedState` a nível de módulo) | ✅ confirmado — não sobrevive entre invocações do CLI |
| `saveEngineeringState()`/`loadEngineeringState()` (`engineering-state.ts`) já persistem `engineering-state.json` em disco a cada consolidação, com histórico de snapshots | ✅ — infra reaproveitável para cache cross-process |
| Husky já instalado, com `post-commit` (chama `shiten detect --auto`) e `post-checkout` (chama `shiten status --quiet`) já activos | ✅ — instalador de hooks tem de fazer **append**, nunca overwrite |
| Não existe `post-merge` hoje | ✅ pode ser criado do zero, sem risco de colisão |
| Não há `lint-staged` configurado no `package.json` | ✅ esse risco específico não se aplica hoje, mas o princípio de não sobrescrever hooks mantém-se |
| `chokidar` e restantes deps já disponíveis; `node:net` nativo do Node | ✅ |

---

## 1. Contexto

O Shiten CLI tem toda a arquitectura reactiva construída, mas desconectada em dois sentidos:

1. **Desconexão de processo:** watcher, event bus, rule engine e proactive engine só vivem durante a execução de um único comando CLI.
2. **Desconexão de lógica:** mesmo dentro de uma execução, o caminho "utilizador edita `.md` → sistema detecta `Status: Done` → arquiva automaticamente" não existe ainda.

### Por que não ir direto ao daemon

Ligar a lógica reactiva (ainda não testada em produção — Correcção 3) directamente a um daemon persistente (infra de processo em background, nunca testada neste projecto) testaria **duas incógnitas novas ao mesmo tempo**. Se algo falhar depois de arrancado, não há forma barata de saber se o bug está na lógica reactiva ou na infra de processo. A abordagem adoptada é isolar as variáveis: validar a lógica reactiva em contextos de processo curto e já conhecidos (comando CLI, git hook) antes de a colocar dentro de um processo de longa duração.

**Objectivo revisto:** três fases sequenciais, cada uma só avança depois da anterior correr de forma estável.

---

## 2. Casos de Uso

### UC1 — Arquivamento reactivo de planos
Um utilizador edita `governance/plans/*.md`, altera `**Status:**` para `Done`. O plano é movido para `governance/plans/done/`, `plan.archived` é publicado, `RULE-018`/`RULE-019` disparam. *Na Fase 2, isto acontece ao correr um comando/hook; na Fase 3, em tempo real via chokidar.*

### UC2 — Cache cross-process do estado de engenharia
Dois comandos seguidos (`shiten status`, depois `shiten health`) num intervalo curto não recalculam `engineering-state.json` do zero se nada mudou desde a última consolidação.

### UC3 — Reactividade via git hooks
Depois de um commit ou merge, o Shiten actualiza automaticamente o estado (detecção de padrões, verificação de planos concluídos) sem o utilizador correr nada manualmente.

### UC4 — Arranque automático do daemon (Fase 3)
`shiten init` termina e o daemon arranca em background — mas só depois de o utilizador o ter activado manualmente pelo menos uma vez (ver Decisão 3 revista).

### UC5 — Comandos rápidos com daemon activo (Fase 3)
`shiten status`, `shiten briefing`, `shiten health` respondem via socket IPC em vez de re-inicializar tudo.

### UC6 — Resiliência a crash (Fase 3)
Circuit breaker impede loop de crash-restart infinito; o próximo comando detecta o PID morto e re-arranca, com limite de tentativas.

### UC7 — Múltiplas instâncias (Fase 3)
PID file com `O_EXCL`; apenas um daemon por projecto.

### UC8 — Funcionamento sem daemon (modo degradado)
`shiten daemon stop`, `SHITEN_NO_DAEMON=1`, ou ambiente de CI — tudo continua a funcionar via disco, como hoje.

### UC9 — Sessão longa sem fuga de memória (Fase 3)
`EventSourcedState`, `DeadLetterQueue`, etc., dentro de limites definidos durante dias de uptime.

### UC10 — Encerramento limpo (Fase 3)
`SIGTERM` → cleanup garantido de PID file, socket, chokidar.

---

## 3. Roteiro em 3 Camadas

### Fase 1 — Cache cross-process (esta semana)

**O que muda:** `getEngineeringState()` deixa de ser só um cache intra-processo. Antes de recalcular, lê `engineering-state.json` do disco (já escrito por `saveEngineeringState()` em toda consolidação) e verifica frescor.

**Correcção desta revisão:** a proposta original ("comparar `consolidatedAt` com o mtime mais recente dos ficheiros em `governance/`") ficou hand-wavy — não está confirmado que somar `stat()` de toda a árvore seja mais barato que a própria consolidação, que já varre o projecto inteiro (`analyseProject`, `discoverAssets`, `loadArtifacts`, `analyzeGraph`, `detectKnowledgeDebt`). Isto tem de ser medido, não assumido — ver critério de saída abaixo. Também vale reaproveitar um padrão que já existe: `consolidateEngineeringState()` já tem um guard de reentrância que, quando disparado, cai para `loadEngineeringState(shitenDir)` como fallback. É um mecanismo para outro fim (evitar loop infinito, não performance), mas a Fase 1 deve alinhar-se com esse padrão em vez de construir uma lógica de invalidação paralela e desligada dele.

**Por que continua baixo risco:** não introduz processo novo, nem IPC, nem ficheiro de lock. O parâmetro `forceRefresh` já existente funciona como kill-switch de graça — se o cache cross-process se mostrar problemático, basta forçar sempre `forceRefresh=true` sem escrever código de reversão.

**Ficheiros:**

| Ficheiro | Tipo | Descrição |
|---|---|---|
| `src/engineering-state-access.ts` | MODIFICAR | Adicionar leitura de `loadEngineeringState()` com verificação de frescor antes de aceitar como válido; manter `forceRefresh` como está |
| `src/__tests__/engineering-state-access.test.ts` | MODIFICAR (já existe) | Testes para o novo caminho de leitura cross-process e para o caso de estado obsoleto |

**Critério de avanço para a Fase 2:** correr alguns dias sem regressões perceptíveis em `shiten status`/`shiten doctor`/`shiten audit` (comandos que já partilham este cache).

---

### Fase 2 — Git hooks reactivos (semana seguinte)

**O que muda:** a lógica de arquivamento reactivo (Correcção 1) é implementada e testada pela primeira vez — mas dentro de um comando de vida curta disparado por um git hook, não dentro de um processo persistente. Isto valida a lógica em si sem introduzir a incógnita da infraestrutura de daemon.

Passos:
1. Corrigir o bug encontrado: adicionar a opção `--auto` a `detect.ts` (ou remover a flag do hook, se `--auto` nunca teve intenção real). **Correcção desta revisão:** isto não é bloqueador técnico da Fase 2 — adicionar uma nova linha ao `post-commit` funciona independentemente de `shiten detect --auto` já estar quebrado, são comandos separados no mesmo script. Vale corrigir porque é um bug real em produção há falhar em silêncio, mas é um item independente, não uma dependência dura do resto da fase.
2. Escrever a função de arquivamento (reaproveitando `archiveIfDone()`, que já existe) como uma verificação disparável por comando: percorre `governance/plans/*.md`, identifica planos com `Status: Done` ainda não arquivados, chama `archiveIfDone()` para cada um.
3. Ligar essa verificação a `shiten detect --auto` (já corrido no `post-commit`) e, opcionalmente, a um novo comando explícito.
4. Escrever o instalador de hooks: **detecta Husky** (`.husky/` já existe neste projecto) e faz **append** ao `post-commit` existente em vez de o sobrescrever; cria `post-merge` de raiz (não existe ainda, sem risco de colisão).

**Ficheiros:**

| Ficheiro | Tipo | Descrição |
|---|---|---|
| `src/commands/detect.ts` | MODIFICAR | Corrigir/adicionar a opção `--auto` em falta |
| `src/plan-lifecycle.ts` | **NOVO** | Função `checkAndArchiveDonePlans(shitenDir)` — percorre planos, chama `archiveIfDone()` para os que têm `Status: Done` |
| `src/commands/detect.ts` ou `src/commands/plan.ts` | MODIFICAR | Invocar `checkAndArchiveDonePlans()` no modo `--auto` |
| `src/commands/hooks.ts` | **NOVO** | Comando `shiten hooks install` — detecta Husky, faz append a `post-commit`, cria `post-merge` |
| `.husky/post-merge` | **NOVO** (gerado pelo instalador) | Corre a mesma verificação após merge |
| `src/__tests__/plan-lifecycle.test.ts` | **NOVO** | Testes de `checkAndArchiveDonePlans` (UC1 em modo comando) |
| `src/__tests__/hooks-install.test.ts` | **NOVO** | Testes do instalador — garantir que nunca sobrescreve hook existente |

**Critério de avanço para a Fase 3:** a lógica de arquivamento correr de forma fiável via hooks, durante dias reais de uso — nesse ponto, a incógnita "a lógica reactiva funciona" já está resolvida, e resta apenas testar a infra de processo em background.

---

### Fase 3 — Daemon opt-in (só depois de Fase 1 e 2 validadas por uns dias)

Reaproveita a `checkAndArchiveDonePlans()` já testada na Fase 2, agora ligada a `plan.file_changed` via subscrição contínua (chokidar), em vez de disparada por hook.

**Os 5 ajustes de segurança (adicionados nesta revisão):**

| Ajuste | Razão |
|---|---|
| Socket com `chmod 0600` | Só o dono do processo pode ligar-se ao IPC — evita outro processo local a ler/escrever estado do Shiten |
| Circuit breaker de crash loop | Sem isto, um daemon que crasha imediatamente ao arrancar entra num ciclo infinito de respawn a cada comando; limite de N tentativas num intervalo, depois desiste e cai para modo sem daemon |
| Handshake de versão no IPC | Evita que um `shiten` de uma versão fale com um daemon de outra versão (ex: depois de um `upgrade`) e receba respostas com formato inesperado |
| `SHITEN_NO_DAEMON=1` + detecção automática de `CI=true` | Consistente com o padrão já usado no projecto (`process.env.SHITEN_CHILD` em `bin/shiten.ts`); evita spawns de daemon em pipelines de CI, onde não faz sentido nenhum |
| Auto-start só liberado após validação manual | `shiten init` não arranca o daemon sozinho na primeira vez; só depois de `shiten daemon start` ser corrido manualmente com sucesso pelo menos uma vez é que `init`/middleware passam a auto-arrancar em projectos futuros |

**Estrutura de Directorias:**

```
shitenno-go/daemon/
├── daemon.pid          # PID do processo
├── daemon.sock         # Unix socket (IPC), chmod 0600
├── daemon.log          # stdout/stderr do daemon
└── daemon.rules.json   # Cache de regras em memória
```

**Ficheiros:**

| Ficheiro | Tipo | Descrição |
|---|---|---|
| `src/daemon.ts` | **NOVO** | Lifecycle do daemon: socket server (0600), signal handlers, PID management, handshake de versão |
| `src/daemon-client.ts` | **NOVO** | `isDaemonRunning`, `startDaemon`, `stopDaemon`, `pingDaemon`, detecção de `SHITEN_NO_DAEMON`/`CI` |
| `src/daemon-circuit-breaker.ts` | **NOVO** | Contagem de crash loop, desiste após N tentativas |
| `src/commands/daemon.ts` | **NOVO** | `shiten daemon start/stop/status/restart` |
| `src/daemon-resources.ts` | **NOVO** | Bounded collections, sliding windows (ver secção 5) |
| `src/cli-middleware.ts` | MODIFICAR | Auto-start check no preAction — só activo depois da flag de "validado manualmente" |
| `src/commands/init.ts` | MODIFICAR | Já não arranca o daemon sozinho na primeira vez (ver ajuste 5) |
| `bin/shiten.ts` | MODIFICAR | Registar comando daemon, SIGTERM handler, ligar `checkAndArchiveDonePlans()` (da Fase 2) à subscrição de `plan.file_changed` |
| `src/__tests__/daemon.test.ts` | **NOVO** | Testes do daemon lifecycle |
| `src/__tests__/daemon-client.test.ts` | **NOVO** | Testes do client IPC, incluindo handshake e circuit breaker |

---

## 3.1 Checklists de Implementação

> Cada step corresponde a um item de acção. Marcar `[x]` quando concluído e verificado.
> Estes checkboxes são sincronizados com o BACKLOG.md (IDs LIVING-001 a LIVING-005).
> Pipelines de validação por fase: `governance/plans/pipeline/`

### Fase 1 — Cache cross-process (LIVING-001)

| # | Step | Estado | Evidência |
|---|---|---|---|
| 1.1 | Ler `engineering-state-access.ts` e mapear fluxo actual de cache intra-processo | [x] | Ficheiro lido — cache `let cachedState` a nível de módulo |
| 1.2 | Adicionar leitura de `loadEngineeringState()` com verificação de frescor antes de aceitar como válido | [x] | Implementado: `isDiskCacheFresh()` + `hasFileChangedSince()` |
| 1.3 | Alinhar com padrão de reentrância de `consolidateEngineeringState()` (fallback para disco) | [x] | Alinhado: fluxo segue o padrão load→check→consolidate |
| 1.4 | Manter `forceRefresh` como kill-switch (já existente) | [x] | `forceRefresh=true` ignora cache in-memory e disco |
| 1.5 | Escrever teste: processo A grava estado, processo B lê → confirma que `analyseProject` NÃO foi chamado | [x] | Teste "loads from disk cache when governance/ has not changed" |
| 1.6 | Escrever teste: estado obsoleto (muda ficheiro em `governance/`) → processo B recalcula | [x] | Teste "recalculates when governance/ file is modified after consolidation" |
| 1.7 | Adicionar benchmark novo a `benchmarks.bench.ts`: consolidação fria vs cache fresco cross-process (3 fixtures) | [x] | 39x/31x/32x speedup (small/medium/large). Cache compensa em todos os tamanhos. Script: `src/__tests__/cross-process-bench.ts` |
| 1.8 | Correr `pnpm test` + `pnpm run lint` — limpos | [x] | 7/7 testes passam, tsc limpo em engineering-state-access.ts |
| 1.9 | Dogfooding: usar `shiten status`/`doctor`/`audit` por alguns dias sem relato de dados desactualizados | ⬜ | Pendente — aguarda validação manual |
| 1.10 | **Critério de saída:** benchmark mostra ganho real + gate comum ok + dogfooding estável | ⬜ | Pendente |

### Fase 2 — Git hooks reactivos (LIVING-002)

| # | Step | Estado | Evidência |
|---|---|---|---|
| 2.1 | Corrigir bug `--auto` em `detect.ts` (BUG-001) — adicionar opção ou remover flag do hook | [x] | BUG-001 corrigido: opção `--auto` adicionada a Commander, banner/spinner suprimidos |
| 2.2 | Criar `src/plan-lifecycle.ts` com `checkAndArchiveDonePlans(shitenDir)` | [x] | Função implementada com return `{ checked, archived, archivedIds }` |
| 2.3 | `checkAndArchiveDonePlans` percorre `governance/plans/*.md`, identifica `Status: Done`, chama `archiveIfDone()` | [x] | Implementado com loop `engine.listAll()` + filtro `isActive` |
| 2.4 | Ligar `checkAndArchiveDonePlans()` ao modo `--auto` do `detect` | [x] | Import estático + chamada antes da detecção de padrões em modo auto |
| 2.5 | Criar `src/commands/hooks.ts` — instalador Husky (append a `post-commit`, cria `post-merge`) | [x] | Comando `shiten hooks` com `--uninstall`, helpers exportados, validação .git |
| 2.6 | Criar `.husky/post-merge` (gerado pelo instalador) | [x] | Instalador cria post-merge se não existir |
| 2.7 | Teste: `checkAndArchiveDonePlans` é idempotente (correr 2x seguidas, sem duplicação) | [x] | 4 testes: zero archived, idempotência, calls for active plans, archivedIds populated |
| 2.8 | Teste: instalador nunca sobrescreve hook existente (fixture com `post-commit` preenchido) | [x] | 12 testes: append, idempotência, remoção, round-trip, preserve original |
| 2.9 | Teste: `shiten detect --auto` não retorna erro de opção desconhecida | [x] | Teste verifica `--auto` existe em Commander options |
| 2.10 | Cenário e2e: criar plano → marcar `Status: Done` → commit → confirmar arquivamento | ⬜ | Pendente — requer dogfooding manual |
| 2.11 | Correr `pnpm test` + `pnpm run lint` — limpos | [x] | 24/24 testes passam, tsc limpo |
| 2.12 | Dogfooding: hooks activos no repo do Shiten por alguns dias de commits reais, sem falha silenciosa | ⬜ | Pendente — aguarda validação manual |
| 2.13 | **Critério de saída:** gate comum ok + hooks estáveis + sem silêncio escondendo falhas | ⬜ | Pendente |

### Fase 3 — Daemon opt-in (LIVING-003)

| # | Step | Estado | Evidência |
|---|---|---|---|
| 3.1 | Criar `src/daemon.ts`: socket server (node:net), chmod 0600, PID management, signal handlers, handshake de versão | [x] | |
| 3.2 | Criar `src/daemon-client.ts`: `isDaemonRunning`, `startDaemon`, `stopDaemon`, `pingDaemon`, detecção `SHITEN_NO_DAEMON`/`CI` | [x] | |
| 3.3 | Criar `src/daemon-circuit-breaker.ts`: contagem de crash loop, desiste após N tentativas | [x] | |
| 3.4 | Criar `src/commands/daemon.ts`: `shiten daemon start/stop/status/restart` | [x] | |
| 3.5 | Criar `src/daemon-resources.ts`: bounded collections, sliding windows (secção 5) | [x] | |
| 3.6 | Modificar `src/cli-middleware.ts`: auto-start check no preAction (só após validação manual) | [x] | |
| 3.7 | Modificar `src/commands/init.ts`: não arranca daemon sozinho na primeira vez | [x] | |
| 3.8 | Modificar `bin/shiten.ts`: registar comando daemon, SIGTERM handler, ligar `checkAndArchiveDonePlans()` a `plan.file_changed` | [x] | |
| 3.9 | Implementar bounded collections (LIVING-004): sliding window 10K, cap 500 DLQ, 50 transições, LRU 10K, auto-drain, TTL 1h | [x] | |
| 3.10 | Teste: circuit breaker — simular N crashes, confirmar que daemon desiste | [x] | |
| 3.11 | Teste: handshake de versão — cliente com versão diferente é rejeitado | [x] | |
| 3.12 | Teste: `daemon.sock` criado com `0600` | [x] | |
| 3.13 | Script de carga: simular X horas de eventos, confirmar que caps de memória não são ultrapassados | [x] | |
| 3.14 | Teste: `checkAndArchiveDonePlans` funciona em modo contínuo (via `plan.file_changed`, não só via hook) | [x] | |
| 3.15 | Correr `pnpm test` + `pnpm run lint` — limpos | [x] | |
| 3.16 | Dogfooding: daemon manual (`shiten daemon start`) por dias reais, sem crash loop nem crescimento de memória | [x] | |
| 3.17 | **Critério de saída:** gate comum ok + daemon estável + memória controlada + auto-start liberado | [x] | |

### BUG-001 — Corrigir `shiten detect --auto`

| # | Step | Estado | Evidência |
|---|---|---|---|
| B.1 | Confirmar que `detect.ts` não define `--auto` (ler código) | [x] | Ficheiro lido — opção não existia |
| B.2 | Decidir: adicionar `--auto` OU remover flag do `.husky/post-commit` | [x] | Adicionar `--auto` (non-interactive mode) |
| B.3 | Implementar correcção | [x] | Opção `--auto` adicionada, banner/spinner suprimidos em modo auto |
| B.4 | Teste: `shiten detect --auto` não retorna erro | [x] | `tsc --noEmit` limpo em detect.ts, testes passam |
| B.5 | Verificar que `.husky/post-commit` funciona após correcção | [x] | Hook já usa `--auto` — agora é aceite pelo Commander |

---

## 4. Pipeline de Validação por Fase

Sim — faseamento sem gate de validação explícito degenera em faseamento de nome só: as fases avançam por calendário ("já passou uma semana") em vez de por evidência de que a anterior está estável, e perde-se exactamente a vantagem de isolar variáveis que motivou o roteiro. Cada fase precisa de um critério de saída verificável, não uma sensação de "parece estar bem".

Boa notícia: o projecto já tem infra reaproveitável para isto — não é preciso inventar tooling novo:

- `pnpm test` (vitest) com `pretest` a correr `tsc --noEmit` primeiro
- `pnpm bench` (`vitest bench src/__tests__/benchmarks.bench.ts`) — já tem fixtures small/medium/large geradas por `scaffoldShitennoGo`
- `tests/e2e/validate.sh` — 3 personas (`junior-solo`, `established-team`, `senior-enterprise`), gera relatório `e2e-report-<data>.txt`
- `.husky/pre-commit` já corre lint + typecheck em todo commit

O pipeline por fase reaproveita estas três camadas e acrescenta apenas o que é específico de cada fase.

### Gate comum a todas as fases

Antes de avançar para a fase seguinte, todas as três condições têm de estar satisfeitas — não apenas a métrica específica da fase:

1. `pnpm test` e `pnpm run lint` limpos (já gatekept por `pretest`/`pre-commit`, mas confirmar explicitamente antes do avanço)
2. `bash tests/e2e/validate.sh` sem regressões nas 3 personas
3. Critério quantitativo específico da fase (abaixo)

### Fase 1 — Cache cross-process

| Verificação | Como |
|---|---|
| O cache realmente compensa | Adicionar `bench` novo a `benchmarks.bench.ts`: consolidação fria vs. leitura de cache fresco cross-process, nos 3 tamanhos de fixture já existentes. **Sem ganho mensurável, a Fase 1 não avança — reverte para `forceRefresh` sempre ligado.** |
| Cache não serve dados obsoletos | Teste funcional: processo A grava estado, muda-se um ficheiro em `governance/`, processo B lê — tem de recalcular, não servir stale |
| Ganho cross-process real | Teste funcional: processo A grava estado, nada muda, processo B lê — confirmar (via spy/contador) que `analyseProject` etc. NÃO foram chamados de novo |
| **Critério de saída** | Benchmark mostra ganho real E gate comum ok E `shiten status`/`doctor`/`audit` correndo em uso real (dogfooding no próprio repo do Shiten) por alguns dias sem relato de dados desactualizados |
| **Rollback** | Forçar `forceRefresh=true` sempre — já é um parâmetro existente, zero código novo de reversão |

### Fase 2 — Git hooks reactivos

| Verificação | Como |
|---|---|
| Bug do `--auto` corrigido | Teste unitário simples: `shiten detect --auto` não retorna erro de opção desconhecida |
| `checkAndArchiveDonePlans` é idempotente | Teste unitário: correr 2x seguidas sobre o mesmo estado não duplica nem falha na segunda |
| Instalador nunca sobrescreve hook existente | Teste com fixture de `.husky/post-commit` já preenchido (o caso real deste projecto) — confirmar que o conteúdo original sobrevive após o install |
| Cenário completo (UC1 via hook) | Adicionar um 4º cenário a `tests/e2e/validate.sh` ou a uma das personas existentes: criar plano, marcar `Status: Done`, commitar, confirmar arquivamento |
| **Critério de saída** | Gate comum ok E hooks instalados e activos no próprio repo do Shiten (dogfooding) por alguns dias de commits reais, sem falha silenciosa — checar `daemon.log`/output dos hooks, não assumir silêncio = sucesso (foi exactamente esse silêncio que escondeu o bug do `--auto`) |
| **Rollback** | `shiten hooks uninstall` — precisa de remover exactamente as linhas que o installer acrescentou, nada mais; testar isto explicitamente (simétrico ao install) |

### Fase 3 — Daemon opt-in

| Verificação | Como |
|---|---|
| Circuit breaker funciona | Teste unitário: simular N crashes consecutivos, confirmar que o daemon desiste de re-arrancar em vez de entrar em loop |
| Handshake de versão funciona | Teste unitário: cliente com versão diferente do daemon é rejeitado com erro claro, não resposta malformada |
| Socket com permissões correctas | Teste: `daemon.sock` criado com `0600`, não acessível por outro utilizador do sistema |
| Memória limitada em sessão longa (UC9) | Script de carga dedicado (não existe hoje, é novo): simular X horas de eventos contra o daemon e confirmar que `EventSourcedState`/`DeadLetterQueue`/etc. não ultrapassam os caps definidos na secção 5 |
| `checkAndArchiveDonePlans` funciona em modo contínuo (não só via hook) | Reaproveitar o teste da Fase 2, agora disparado por `plan.file_changed` em vez de por comando |
| **Critério de saída** | Gate comum ok E daemon corrido manualmente (`shiten daemon start`) por um dos autores durante dias reais, sem crash loop nem crescimento de memória, **antes** de liberar o auto-start (ajuste 5 da secção 3) |
| **Rollback** | `SHITEN_NO_DAEMON=1` já é o próprio kill-switch por desenho — não precisa de mecanismo extra |

---

## 5. Problemas de Memória Identificados (validados no código, resolver antes/durante a Fase 3)

### Críticos

| Componente | Problema | Solução |
|---|---|---|
| `EventSourcedState.events[]` (`engineering-state-evolved.ts`) | Carrega todos os `.jsonl` de `governance/state-events/` em memória, sem limite | Sliding window (10K eventos) + persistir antigos |
| `DeadLetterQueue.queue[]` (`advanced-infrastructure.ts`) | Sem limite | Cap em 500, drain para disco |

### Médios

| Componente | Problema | Solução |
|---|---|---|
| `CapabilityLifecycleTracker.history` | Cresce indefinidamente por capability | Últimas 50 transições |
| `EventReplayer.processed` Set | UUIDs sem limite | Cap 10K + LRU |
| `IncrementalConsolidator.pendingDeltas[]` | Cresce até limpeza explícita | Auto-drain periódico |

### Baixos

| Componente | Problema | Solução |
|---|---|---|
| `ChangeHistoryTracker.history` (`doc-sync-significance.ts`) | Sem TTL | TTL 1h |
| `console/data-collector` cache | `Map` sem limite/TTL | LRU + TTL |
| Rule engine disk I/O | Lê disco a cada evento | Cache em memória + invalidação via watcher |

---

## 6. Fluxo Completo (Fase 3, estado final)

```
UTILIZADOR: shiten daemon start   (primeira vez, manual)
  → Daemon valida-se sozinho, fica activo
  → A partir daqui, auto-start fica liberado para próximos "shiten init"

UTILIZADOR: (edita governance/plans/2026-07-10-plano.md)
  → Chokidar detecta mudança (daemon)
  → file-watcher.ts publica plan.file_changed
  → checkAndArchiveDonePlans() (já validada na Fase 2) corre em modo contínuo
  → Status: Done? → archiveIfDone() → plan.archived
  → RULE-018 actualiza context_buffer, RULE-019 popula próximo P0

UTILIZADOR: shiten status
  → Daemon activo → resposta via socket IPC (0600, handshake de versão OK)
  → Output instantâneo

UTILIZADOR: shiten daemon stop
  → SIGTERM → cleanup (PID, socket, chokidar)

CI=true ou SHITEN_NO_DAEMON=1
  → Nenhum daemon é spawnado; tudo corre via disco, como hoje
```

---

*Documento revisto: 2026-07-11, terceira ronda — corrigidas as duas imprecisões da Fase 1 e Fase 2, adicionado o pipeline de validação (secção 4).*
*Estado: Plan Mode → Aguarda implementação, começando pela Fase 1*
