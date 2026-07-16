# BACKLOG — Shitenno-go

> **Priorizacao:** P0 (imediato, ≤ 7d), P1 (curto prazo, ≤ 30d), P2 (medio prazo, ≤ 90d), P3 (baixa prioridade, sem SLA).
>
> **Status:** `Backlog` | `In Progress` | `Paused [REVISIT: YYYY-MM-DD]` | `Done`
>
> **Severidade:** Critico | Alto | Medio | Baixo
>
> **Owner:** Agente que assume o item. Itens sem owner sao `unassigned`.
>
> **Ultima atualizacao:** 2026-07-11 — adição de 7 items Shiten Living (LIVING-001 a LIVING-006 + BUG-001)

---

## P0 — Imediato (≤ 7 dias)

### SA3 Governanca 0%

| Campo | Valor |
|---|---|---|
| **Status** | Done — 2026-07-06 |
| **Severidade** | Critico |
| **Prioridade** | P0 |
| **Owner** | executor |
| **Data** | 2026-06-30 |
| **Fonte** | shiten assess --json (dimension: governance = 15 → 100) |
| **Modulos** | src/maturity-profile.ts, governance/policies/ |
| **Descricao** | Dimensao Governance do score de maturidade esta em 0%. Nenhuma pratica de governanca formalizada no codigo. |
| **Correcao** | Auto-detect de artefactos + policies + answers.json. Score subiu de 15 para 100. |

### LIVING-001 Fase 1 — Cache cross-process

| Campo | Valor |
|---|---|
| **Status** | Done — 2026-07-13 |
| **Severidade** | Alto |
| **Prioridade** | P0 |
| **Owner** | executor |
| **Data** | 2026-07-11 |
| **Fonte** | Plano Shiten Living v2 (secção 3, Fase 1) |
| **Modulos** | src/engineering-state-access.ts, src/__tests__/engineering-state-access.test.ts, src/__tests__/benchmarks.bench.ts |
| **Descricao** | Modificar `getEngineeringState()` para ler `engineering-state.json` do disco com verificação de frescor antes de recalcular. Manter `forceRefresh` como kill-switch. Adicionar benchmark novo (consolidação fria vs cache cross-process) nos 3 tamanhos de fixture. |
| **Correcao** | Steps 1.1-1.8 completos: `isDiskCacheFresh()` + `hasFileChangedSince()` + 3-level cache + 7 testes + benchmarks (3 fixtures). Dogfooding (1.9-1.10) depende de uso real multi-dia. |

### BUG-001 Corrigir `shiten detect --auto`

| Campo | Valor |
|---|---|
| **Status** | Done — 2026-07-11 |
| **Severidade** | Medio |
| **Prioridade** | P0 |
| **Owner** | executor |
| **Data** | 2026-07-11 |
| **Fonte** | Plano Shiten Living v2 (secção 0, achado novo) |
| **Modulos** | src/commands/detect.ts, .husky/post-commit |
| **Descricao** | `.husky/post-commit` executa `shiten detect --auto 2>/dev/null &` mas `detect.ts` não define opção `--auto`. Commander.js rejeita opção desconhecida. Hook falha silenciosamente a cada commit (stderr redirigido para /dev/null). |
| **Correcao** | Opção `--auto` adicionada a `detect.ts` — modo non-interactive que suprime banner e spinner. Testes OK. |

---

## P1 — Curto prazo (≤ 30 dias)

### SA4 Arquitetura 15%

| Campo | Valor |
|---|---|
| **Status** | Backlog [REVISIT: 2026-07-13 — piorou: 99 ficheiros flat, era 46] |
| **Severidade** | Alto |
| **Prioridade** | P1 |
| **Owner** | unassigned |
| **Data** | 2026-06-30 |
| **Fonte** | shiten assess --json (dimension: architecture = 15) |
| **Modulos** | src/ (global) |
| **Descricao** | Dimensao Architecture do score de maturidade esta em 15%. 99 arquivos flat em src/ (era 46), sem camadas, sem bounded contexts. Subpastas existentes (audit/, commands/, console/, handbook/) sao feature-based, nao Clean Architecture. |
| **Correcao** | Reestruturar em domain/infrastructure/commands/interfaces. Adicionar abstracoes. 10 ficheiros >500 linhas (rule-engine.ts = 1307 linhas). |

### SA5 Documentacao 10%

| Campo | Valor |
|---|---|
| **Status** | Done — 2026-07-13 |
| **Severidade** | Alto |
| **Prioridade** | P1 |
| **Owner** | executor |
| **Data** | 2026-06-30 |
| **Fonte** | shiten assess --json (dimension: documentation = 10) |
| **Modulos** | src/, docs/ |
| **Descricao** | Dimensao Documentation do score de maturidade esta em 10%. Docs internos fracos, sem ADRs, sem session templates. |
| **Correcao** | 5 ADRs + template criados (ADR-001 a ADR-006). Session template existe (87 linhas). 22 docs em docs/, 6 regras, 17 skills. |

### SA7 Baixa densidade de relacoes no knowledge graph

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Alto |
| **Prioridade** | P1 |
| **Owner** | unassigned |
| **Data** | 2026-06-30 |
| **Fonte** | shiten audit --json (knowledgeGraph.suggestions) |
| **Modulos** | shitenno-go/ |
| **Descricao** | Relacao baixa entre artifacts (24 relacoes para 26 artifacts). Sugestao: adicionar mais conexoes. |
| **Correcao** | Mapear dependencias entre modulos e criar relacoes no knowledge graph. |

### SA8 context_buffer.yaml nao encontrado

| Campo | Valor |
|---|---|
| **Status** | Done — 2026-07-13 |
| **Severidade** | Alto |
| **Prioridade** | P1 |
| **Owner** | executor |
| **Data** | 2026-06-30 |
| **Fonte** | shiten status --json (context_buffer.yaml = warn) |
| **Modulos** | shitenno-go/governance/context/ |
| **Descricao** | Arquivo context_buffer.yaml nao encontrado. Necessario para buffer de contexto entre sessoes. |
| **Correcao** | Ficheiro criado e activo — 525 linhas com reminders, session state, impediments, technical_debt. |

### SA9 Nenhum agent contract configurado

| Campo | Valor |
|---|---|
| **Status** | Done — 2026-07-13 |
| **Severidade** | Alto |
| **Prioridade** | P1 |
| **Owner** | executor |
| **Data** | 2026-06-30 |
| **Fonte** | shiten status --json (agent contracts = warn) |
| **Modulos** | shitenno-go/governance/agents/ |
| **Descricao** | Nenhum agent contract encontrado. Necessario para definir papeis e responsabilidades de agents IA. |
| **Correcao** | 4 contratos criados: planner-v1, executor-v1, reviewer-v1, orchestrator-v1 + CONTRACTS_INDEX.md. |

### SA10 Clean Architecture violado

| Campo | Valor |
|---|---|
| **Status** | Backlog [REVISIT: 2026-07-13 — piorou: zero separação de camadas] |
| **Severidade** | Alto |
| **Prioridade** | P1 |
| **Owner** | unassigned |
| **Data** | 2026-06-30 |
| **Fonte** | Analise manual |
| **Modulos** | src/ (99 arquivos flat) |
| **Descricao** | 99 arquivos flat em src/, sem separacao de camadas. Domain logic misturado com infrastructure. Commands importam implementacoes concretas. Zero pattern DI (except context-collector.ts). |
| **Correcao** | Reestruturar: src/domain/, src/infrastructure/, src/commands/, src/interfaces/. Extrair abstracoes. Adicionar DI. |

### SA11 SOLID violado

| Campo | Valor |
|---|---|
| **Status** | Backlog [REVISIT: 2026-07-13 — piorou: 10 ficheiros >500 linhas] |
| **Severidade** | Alto |
| **Prioridade** | P1 |
| **Owner** | unassigned |
| **Data** | 2026-06-30 |
| **Fonte** | Analise manual |
| **Modulos** | src/ (global) |
| **Descricao** | God modules: rule-engine.ts (1307 linhas), scorer.ts (947), engineering-state.ts (908), feedback-engine.ts (756). 10 ficheiros >500 linhas. Sem dependency injection (except context-collector.ts). Interface Segregation violada (ShitenState com 60+ campos). |
| **Correcao** | Dividir modules grandes. Adicionar DI. Criar interfaces menores. |

### LIVING-002 Fase 2 — Git hooks reactivos

| Campo | Valor |
|---|---|
| **Status** | Done — 2026-07-12 |
| **Severidade** | Alto |
| **Prioridade** | P1 |
| **Owner** | unassigned |
| **Data** | 2026-07-11 |
| **Fonte** | Plano Shiten Living v2 (secção 3, Fase 2) |
| **Depende** | LIVING-001 (validação algunos dias), BUG-001 (corrigir --auto) |
| **Modulos** | src/git-hooks-installer.ts (NOVO), src/plan-lifecycle.ts, src/commands/detect.ts, src/commands/scheduled-check.ts, .husky/post-commit, .husky/post-merge (NOVO) |
| **Descricao** | Criar `checkAndArchiveDonePlans()` que percorre `governance/plans/*.md`, identifica planos com `Status: Done` ainda não arquivados, chama `archiveIfDone()`. Ligar ao modo `--auto` do `detect`. Criar instalador Husky (append a post-commit, cria post-merge). |
| **Correcao** | Reaproveitar `archiveIfDone()` existente. Instalador deve fazer append, nunca overwrite. Testes: idempotência, nunca sobrescrever hook existente, cenário e2e completo. |

### LIVING-003 Fase 3 — Daemon opt-in

| Campo | Valor |
|---|---|
| **Status** | Done — 2026-07-12 |
| **Severidade** | Alto |
| **Prioridade** | P1 |
| **Owner** | unassigned |
| **Data** | 2026-07-11 |
| **Fonte** | Plano Shiten Living v2 (secção 3, Fase 3) |
| **Depende** | LIVING-001 + LIVING-002 (validação alguns dias) |
| **Modulos** | src/daemon.ts (NOVO), src/daemon-client.ts (NOVO), src/daemon-circuit-breaker.ts (NOVO), src/commands/daemon.ts (NOVO), src/daemon-resources.ts (NOVO), src/cli-middleware.ts, src/commands/init.ts, bin/shiten.ts |
| **Descricao** | Daemon opt-in com socket IPC (chmod 0600), handshake de versão, circuit breaker de crash loop, `SHITEN_NO_DAEMON=1` + `CI=true`, auto-start só após validação manual. Reaproveita `checkAndArchiveDonePlans()` da Fase 2 em modo contínuo via chokidar. |
| **Correcao** | 5 ajustes de segurança obrigatórios. Estrutura: daemon.pid, daemon.sock, daemon.log, daemon.rules.json em `shitenno-go/daemon/`. |

### LIVING-004 Problemas de memória — Bounded collections

| Campo | Valor |
|---|---|
| **Status** | Done — 2026-07-12 |
| **Severidade** | Alto |
| **Prioridade** | P1 |
| **Owner** | unassigned |
| **Data** | 2026-07-11 |
| **Fonte** | Plano Shiten Living v2 (secção 5) |
| **Depende** | LIVING-003 (durante/implementação do daemon) |
| **Modulos** | src/engineering-state-evolved.ts, src/advanced-infrastructure.ts, src/capability-engine.ts, src/event-replay.ts, src/incremental-consolidator.ts, src/doc-sync-significance.ts, console/data-collector |
| **Descricao** | Limitar collections em memória: sliding window 10K eventos (`EventSourcedState`), cap 500 (`DeadLetterQueue`), últimas 50 transições (`CapabilityLifecycleTracker`), cap 10K + LRU (`EventReplayer`), auto-drain (`IncrementalConsolidator`), TTL 1h (`ChangeHistoryTracker`), LRU + TTL (`data-collector`). |
| **Correcao** | Implementar caps, sliding windows e TTLs antes/durante Fase 3. Previne fuga de memória em sessões longas do daemon. |

### LIVING-005 Pipeline de validação por fases

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Prioridade** | P1 |
| **Owner** | unassigned |
| **Data** | 2026-07-11 |
| **Fonte** | Plano Shiten Living v2 (secção 4) |
| **Depende** | Acompanha cada fase |
| **Modulos** | src/__tests__/benchmarks.bench.ts, tests/e2e/validate.sh |
| **Descricao** | Gate comum (testes+lint limpos, e2e sem regressão) + critérios específicos por fase. Benchmark novo Fase 1, cenário e2e Fase 2, script de carga Fase 3. Dogfooding no próprio repo. |
| **Correcao** | Reaproveitar infra existente (pnpm test, pnpm bench, e2e/validate.sh). Sem ganho mensurável no benchmark → Fase 1 não avança. |

### LIVING-007 Sistema de Pipelines de Validação

| Campo | Valor |
|---|---|
| **Status** | In Progress — 2026-07-11 (template + pipelines criados, plan prepare implementado, plan.created event + RULE-020 adicionados) |
| **Severidade** | Medio |
| **Prioridade** | P1 |
| **Owner** | executor |
| **Data** | 2026-07-11 |
| **Fonte** | Shiten Living — necessidade de validação padronizada por fase |
| **Modulos** | event-bus.ts, file-watcher.ts, commands/plan.ts, rule-engine.ts, governance/plans/pipeline/ |
| **Descricao** | Comandos independentes (plan prepare, pipeline exec/notify/status) encadeáveis via shell. Evento plan.created + RULE-020 para trigger automático. Templates de pipeline por fase com contadores humano/agente. Notificação desktop por fase. |
| **Correcao** | Implementado: plan.created event, RULE-020, plan md prepare, 4 pipelines, template. Futuro: shiten pipeline run/exec/notify/list/status, backbone sync. |

### NEW-001 Runtime validation shitenno-go/profile/

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Prioridade** | P1 |
| **Owner** | unassigned |
| **Data** | 2026-07-06 |
| **Fonte** | Feedback de sessao — erro cryptico se shiten init nao foi feito |
| **Modulos** | src/scorer.ts, src/scaffolder.ts |
| **Descricao** | Nao existe validacao em runtime para existencia de `shitenno-go/profile/` antes de tentar ler o ficheiro de config. Se o projecto ainda nao fez `shiten init`, o utilizador ve erro críptico em vez de mensagem amigavel. |
| **Correcao** | Adicionar verificacao de existencia do directorio e mensagem de erro amigavel antes de ler config. |

### NEW-002 Investigar feedback pessoal do agente

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Prioridade** | P1 |
| **Owner** | unassigned |
| **Data** | 2026-07-06 |
| **Fonte** | Feedback de sessao — feedback pessoal nunca e executado automaticamente |
| **Modulos** | opencode.json, docs/rules/feedback-protocol.md, docs/skills/quick-board-enforcement.md |
| **Descricao** | O protocolo de feedback em AGENTS.md (regra #17) exige que o agente gere e apresente feedback pessoal ao utilizador no fim de sessao. No entanto, este feedback nunca e executado automaticamente. Investigar: (1) e a skill `quick-board-enforcement.md` que bloqueia? (2) e o `loading_profile` lite que nao carrega a regra #17? (3) e o `opencode.json` que nao activa o modo review no fim de sessao? |
| **Correcao** | Documentar causa raiz e corrigir. Possivelmente: adicionar regra #17 ao loading profile lite, ou criar skill especifica para feedback de sessao. |

### G1 Landing page

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Alto |
| **Prioridade** | P1 |
| **Owner** | unassigned |
| **Descricao** | Site one-page com proposta de valor, demonstracao visual, CTA para waitlist. Deve comunicar: (1) O problema (context loss entre sessoes), (2) A solucao (briefing dinamico), (3) O resultado (60-80% menos tokens). |
| **Correcao** | Criar `docs/landing/` com copy, wireframe e assets. Ferramenta: Astro, Next.js, ou HTML statico. |

### G2 Waitlist / early access

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Alto |
| **Prioridade** | P1 |
| **Owner** | unassigned |
| **Descricao** | Formulario de captura de emails para early access. Validar demanda antes de investir em monetizacao. |
| **Correcao** | Integrar com Resend, Loops, ou Buttondown. Meta: 100 emails antes de lancar. |

### G3 Definicao de personas

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Alto |
| **Prioridade** | P1 |
| **Owner** | unassigned |
| **Descricao** | Quem e o usuario? (1) Tech Lead que quer governance, (2) Dev Solo que quer produtividade, (3) AI Engineer que quer context para agentes. Cada persona tem dor diferente. |
| **Correcao** | Criar `docs/personas.md` com 3 personas detalhadas: nome, dor, fluxo, tom de voz, objecoes. |

### G5 Pricing model concreto

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Alto |
| **Prioridade** | P1 |
| **Owner** | unassigned |
| **Descricao** | Definir tiers: Free (CLI basico), Starter ($29/mo), Team ($99/mo), Enterprise (custom). Cada tier com features claras. |
| **Correcao** | Criar `docs/pricing.md` com tabela de features por tier, justificativa de precos, comparacao com concorrentes. |

### M1 Sistema de license key

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Alto |
| **Prioridade** | P1 |
| **Owner** | unassigned |
| **Descricao** | Chave de ativação por projeto. Formato: `NXS-XXXX-XXXX-XXXX`. Validacao offline com grace period. |
| **Correcao** | Criar `src/license.ts` com: generate(), validate(), deactivate(). Usar SHA-256 para assinatura. |

### M2 Tier enforcement

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Alto |
| **Prioridade** | P1 |
| **Owner** | unassigned |
| **Descricao** | Limitar features por tier. Free: init, status, detect. Starter: todos. Team: + dashboard, bench. Enterprise: + SSO, compliance. |
| **Correcao** | Criar `src/tier-gate.ts`. Modificar `bin/shiten.ts` para verificar tier antes de executar comandos restritos. |

### M3 Usage tracking

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Alto |
| **Prioridade** | P1 |
| **Owner** | unassigned |
| **Descricao** | Rastrear comandos executos para billing. Metricas: comandos/mes, briefings gerados, feedback records. |
| **Correcao** | Extender `session-tracker.ts` para gravar `usage.jsonl` com timestamps e tipo de comando. |



### A2 OpenCode plugin

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Alto |
| **Prioridade** | P1 |
| **Owner** | unassigned |
| **Descricao** | Hook automatico antes de cada tarefa no OpenCode. Injeta briefing no contexto do agente. |
| **Correcao** | Criar plugin OpenCode que chama `shiten briefing --summary` antes de cada tarefa e injeta no system prompt. |

### A7 Skill template para shitenno-cli

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Prioridade** | P1 |
| **Owner** | unassigned |
| **Descricao** | shitenno-cli precisa prover um template para criar novas skills. Template deve definir: frontmatter obrigatorio, estrutura de secoes, e validacao. |
| **Correcao** | Criar `src/templates/base/skills/SKILL_TEMPLATE.md` com frontmatter + secoes padrao. Adicionar comando `skill:create`. |

### S2 Dependency auditing

| Campo | Valor |
|---|---|
| **Status** | Done — 2026-07-10 |
| **Severidade** | Alto |
| **Prioridade** | P1 |
| **Owner** | executor |
| **Descricao** | `npm audit` automatico no CI. Bloquear builds com vulnerabilidades criticas. |
| **Correcao** | Adicionar step `pnpm audit --audit-level=high` ao CI. |

---

## P2 — Medio prazo (≤ 90 dias)

### LIVING-006 Mecanismo sync plano→backlog

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Data** | 2026-07-11 |
| **Fonte** | Observação durante planeamento do Shiten Living |
| **Modulos** | src/commands/ (novo comando ou extensão de `plan`) |
| **Descricao** | O Shiten system não tem mecanismo para transformar automaticamente items de implementação de um plano (`governance/plans/*.md`) em checklists no backlog que se actualizam de acordo com a implementação por item. Actualmente, a sincronização é manual. |
| **Correcao** | Criar comando `shiten plan sync` que: (1) lê checkboxes do plano, (2) cria/actualiza items correspondentes no BACKLOG.md, (3) sincroniza estados (`[x]` → `Done`, `[ ]` → `Backlog`). Considerar webhook ou watcher para actualização em tempo real. |

### 2.1 Aprovacao de regras candidatas

| Campo | Valor |
|---|---|
| **Status** | Done — 2026-07-10 |
| **Severidade** | Medio |
| **Prioridade** | P2 |
| **Owner** | executor |
| **Arquivos** | `src/pattern-detector.ts` (CandidateRule), `src/commands/detect.ts` |
| **Descricao** | `detectPatterns()` gera `candidateRules` com status "proposed" mas nao existe mecanismo para aprovar/rejeitar. |
| **Correcao** | Criar `shiten detect --approve RULE-001` e `shiten detect --reject RULE-001`. |

### 2.2 Feedback do utilizador (user rating + comment)

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Arquivos** | `src/session-feedback.ts`, `src/commands/feedback.ts` |
| **Descricao** | O `shiten feedback` so regista outcome do agente. O utilizador nao pode avaliar a sessao. |
| **Correcao** | Adicionar campos `userRating`, `userComment`, `userTags` ao schema e flags CLI correspondentes. |

### 2.2 Feedback ↔ capability-engine

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Baixo |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Arquivos** | `src/capability-engine.ts`, `src/session-feedback.ts` |
| **Descricao** | O capability-engine recomenda instalacoes mas nao aprende com falhas. |
| **Correcao** | No `evaluateCapabilities()`, consultar `failureHotspots` do feedback. |

### 2.3 shiten bench --compare historico

| Campo | Valor |
|---|---|
| **Status** | Done — 2026-07-10 |
| **Severidade** | Baixo |
| **Prioridade** | P2 |
| **Owner** | executor |
| **Arquivo** | `src/commands/bench.ts` |
| **Descricao** | Benchmark mostra resultados atuais mas nao compara com execucoes anteriores. |
| **Correcao** | Salvar resultado em `shitenno-go/reports/bench-YYYY-MM-DD.json`. Adicionar `--compare`. |

### 2.4 shiten feedback --list

| Campo | Valor |
|---|---|
| **Status** | Done — 2026-07-10 |
| **Severidade** | Baixo |
| **Prioridade** | P2 |
| **Owner** | executor |
| **Arquivo** | `src/commands/feedback.ts` |
| **Descricao** | Nao existe forma de ver os registros de feedback sem usar `--summary`. |
| **Correcao** | Adicionar `--list` que mostra ultimos 10 registros formatados. |

### 2.5 Desacoplar context-collector de pattern-detector

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Arquivo** | `src/context-collector.ts` |
| **Descricao** | `context-collector.ts` importa `pattern-detector.ts` e `session-feedback.ts`, aumentando o acoplamento. |
| **Correcao** | Mover `enrichBriefingWithPatterns()` para modulo separado ou injetar via `ContextDeps`. |

### 2.6 Type BriefingDepth como tipo proprio

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Baixo |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Arquivo** | `src/briefing.ts`, `src/token-optimizer.ts` |
| **Descricao** | `BriefingDepth` e definido em `token-optimizer.ts` mas re-exportado. briefing.ts usa `string` no display. |
| **Correcao** | Usar `BriefingDepth` como tipo do parametro `depth` em `displayBriefingByDepth()`. |

### 2.7 Usar differentialBriefing no --diff

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Baixo |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Arquivos** | `src/commands/briefing.ts`, `src/token-optimizer.ts` |
| **Descricao** | `differentialBriefing()` e mais compacto que `generateDiff()`. O `--diff` usa `generateDiff()` verboso. |
| **Correcao** | Oferecer `--diff --compact` que usa `differentialBriefing()`. |

### 2.8 Validacao de schema nos records lidos

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Arquivos** | `src/session-feedback.ts`, `src/session-tracker.ts` |
| **Descricao** | Records lidos de JSONL nao tem validacao de schema. |
| **Correcao** | Adicionar validacao minima: verificar campos obrigatorios apos parse. |

### 2.9 Extrair modulo shared de display

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Baixo |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Arquivos** | Todos os commands/ com `console.log` com chalk |
| **Descricao** | ~90 chamadas `console.log` com chalk repetidas em 18 arquivos de comando. |
| **Correcao** | Extrair funcoes `banner()`, `section()`, `kv()` para `src/formatting.ts`. |

### 2.10 Atualizar AGENTS.md template

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Arquivo** | `src/templates/base/docs/AGENTS.md` |
| **Descricao** | O template menciona poucos comandos mas nao bench, dashboard, detect, doctor. |
| **Correcao** | Adicionar secoes para: bench, dashboard, detect, doctor, profile option. |

### 2.11 Linkar ROI.md no README

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Baixo |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Arquivos** | `README.md`, `docs/ROI.md` |
| **Descricao** | `docs/ROI.md` foi criado mas nao e referenciado do README.md. |
| **Correcao** | Adicionar link na secao Token Economy do README. |

### 2.12 JSDoc nas funcoes novas

| Campo | Valor |
|---|---|
| **Status** | Done — 2026-07-10 (parcial) |
| **Severidade** | Baixo |
| **Prioridade** | P2 |
| **Owner** | executor |
| **Arquivos** | 8 funcoes exportadas/novas sem JSDoc |
| **Descricao** | Funcoes como `enrichBriefingWithPatterns`, `getFeedbackForSession`, etc. sem JSDoc. |
| **Correcao** | Adicionar JSDoc com `@param`, `@returns`, e `@example`. |

### 2.13 Consolidar planos de plans/

| Campo | Valor |
|---|---|
| **Status** | Done — 2026-07-10 |
| **Severidade** | Medio |
| **Prioridade** | P2 |
| **Owner** | executor |
| **Diretorio** | `plans/` (11 arquivos) |
| **Descricao** | 11 arquivos de plano com massiva sobreposicao. |
| **Correcao** | Consolidar em 3 documentos: (a) Plano atual, (b) Historico, (c) Roadmap futuro. |

### 2.14 Documentar limitacoes conhecidas

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Baixo |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Arquivo** | `docs/` |
| **Descricao** | Nao existe documentacao de limitacoes conhecidas. |
| **Correcao** | Criar `docs/KNOWN_LIMITATIONS.md`. |

### 2.15 Teste manual de onboarding (5 minutos)

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Data** | 2026-07-03 |
| **Arquivos** | `docs/tests/onboarding-5min-test.md`, README.md |
| **Descricao** | Validar que pessoa sem contexto consegue correr `shiten init` e entender o output sem perguntar nada. |
| **Correcao** | Seguir protocolo em `docs/tests/onboarding-5min-test.md` com participante real. |

### 2.15 Cache intermediario no collectContext

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Arquivo** | `src/context-collector.ts` |
| **Descricao** | `collectContext()` executa todas as etapas toda vez que e chamado. |
| **Correcao** | Adicionar cache em memoria com TTL de 60s. |

### 2.16 Lazy loading de modulos pesados

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Baixo |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Arquivo** | `src/context-collector.ts` |
| **Descricao** | Todas as importacoes sao estaticas no topo do arquivo. |
| **Correcao** | Usar dynamic imports para modulos que so sao necessarios em branches especificos. |

### 2.17 Benchmark suite automatizada CI

| Campo | Valor |
|---|---|
| **Status** | Done — 2026-07-10 |
| **Severidade** | Baixo |
| **Prioridade** | P2 |
| **Owner** | executor |
| **Arquivos** | `.github/workflows/ci.yml`, `src/__tests__/benchmarks.bench.ts` |
| **Descricao** | O benchmark existe mas nao roda no CI. |
| **Correcao** | Adicionar step `pnpm bench` ao CI com threshold de regressao. |

### 2.18 Dashboard: cliques do mouse nas abas nao funcionam

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Data** | 2026-07-02 |
| **Modulos** | `src/console/components/tab-bar.tsx`, `src/console/index.tsx` |
| **Descricao** | As abas do dashboard interativo nao respondem a cliques do mouse. |
| **Correcao** | Verificar se `MouseProvider` esta correto no root do Ink. |

### 2.19 Dashboard: responsividade do layout

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Baixo |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Data** | 2026-07-02 |
| **Modulos** | `src/console/tabs/*.tsx`, `src/console/components/*.tsx` |
| **Descricao** | O dashboard so e visualizado corretamente com a tela maximizada. |
| **Correcao** | Implementar breakpoints dinamicos baseados no tamanho do terminal. |

### G4 Analise competitiva

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Descricao** | Mapear Credo AI, Modulos, Govern365, Packmind. |
| **Correcao** | Criar `docs/competitive-analysis.md` com matriz de features. |

### G6 Case studies

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Descricao** | 3 casos de uso reais com metricas antes/depois. |
| **Correcao** | Criar `docs/case-studies/` com 3 estudos. |

### M4 Trial mechanism

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Descricao** | 14 dias de tier superior automaticamente apos `shiten init`. |
| **Correcao** | Adicionar campo `trialEndsAt` no `shitenno-go/config.json`. |

### M5 Payment integration

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Descricao** | Stripe ou Paddle para cobranca recorrente. |
| **Correcao** | Criar `src/commands/subscribe.ts` que abre checkout URL. |

### M6 License server

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Descricao** | API central para validar licenses, verificar tier, registrar uso. |
| **Correcao** | Criar `server/` com Express/Fastify. |

### A3 Cursor integration

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Descricao** | Extensao para Cursor IDE que mostra briefing no sidebar. |
| **Correcao** | Criar extensao VS Code que le `.shiten/BRIEFING.md`. |

### A4 Git hooks

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Descricao** | Pre-commit: auto-briefing. Pre-push: validation. Post-commit: feedback automatico. |
| **Correcao** | Criar `shiten hooks --install` que configura git hooks via `core.hooksPath`. |

### D1 Interactive tutorial

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Descricao** | `shiten tutorial` — guided tour interativo com exemplos reais. |
| **Correcao** | Criar `src/commands/tutorial.ts` com 7 passos. |

### D2 Example projects

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Descricao** | 3 templates: web-app, API, library. Cada um com governance pre-configurada. |
| **Correcao** | Criar `examples/` com 3 diretorios. |

### DA1 Usage analytics

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Descricao** | Quais comandos sao mais usados, horarios de pico, taxa de sucesso. |
| **Correcao** | Dashboard `shiten analytics` que le `usage.jsonl`. |

### DA2 Error tracking

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Descricao** | Relatorio automatico de erros: tipo, frequencia, contexto. |
| **Correcao** | Criar `src/error-tracker.ts`. |

### S1 Penetration testing

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Descricao** | Teste de seguranca no CLI: injection, path traversal, command injection. |
| **Correcao** | Contratar pentest ou usar ferramentas (Snyk, npm audit). |

### S3 Secret scanning

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Medio |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Descricao** | Detectar keys/tokens no output do CLI. |
| **Correcao** | Usar `gitleaks` ou `trufflehog` no CI. |

### SA12 Knowledge graph nao inicializado

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Baixo |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Data** | 2026-06-30 |
| **Fonte** | shiten doctor --json |
| **Modulos** | shitenno-go/ |
| **Descricao** | Knowledge graph nao inicializado. |
| **Correcao** | Executar `shiten audit` para popular knowledge graph. |

### SA13 Falta ADRs

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Baixo |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Data** | 2026-06-30 |
| **Modulos** | shitenno-go/docs/adrs/ |
| **Descricao** | Nenhuma ADR criada. Decisoes arquiteturais nao documentadas. |
| **Correcao** | Criar ADRs para decisoes principais. |

### SA15 DDD nao aplicado

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Baixo |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Data** | 2026-06-30 |
| **Modulos** | src/ (global) |
| **Descricao** | Domain-Driven Design nao aplicado. Sem bounded contexts. |
| **Correcao** | Definir bounded contexts (feedback, maturity, knowledge). |

### SA16 TDD nao aplicado

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Baixo |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Data** | 2026-06-30 |
| **Modulos** | src/ (global) |
| **Descricao** | Testes escritos depois do codigo, nao antes. |
| **Correcao** | Adotar workflow TDD: red → green → refactor. |

### SA17 Commander state persistence

| Campo | Valor |
|---|---|
| **Status** | Backlog |
| **Severidade** | Baixo |
| **Prioridade** | P2 |
| **Owner** | unassigned |
| **Data** | 2026-06-30 |
| **Modulos** | bin/shiten.ts |
| **Descricao** | Commander singleton retém _optionValues entre chamadas .parse(). |
| **Correcao** | Converter syncCommand para factory function. |

---

## P3 — Baixa prioridade (sem SLA)

| # | Item | Severidade | Descricao |
|---|---|---|---|
| 3.1 | Migrar console.log para logger centralizado | Baixo | 90+ chamadas console.log diretas nos commands |
| 3.2 | Dashboard web para scores historicos | Baixo | Visualizacao web dos dados de benchmark/feedback |
| 3.3 | Suportar monorepos com workspaces | Medio | pnpm/yarn workspaces, deteccao automatica |
| 3.4 | Integrar com GitHub API | Baixo | Churn real baseado em PR reviews, issues abertas |
| 3.5 | Plugin system para skills customizadas | Baixo | Allow third-party plugins via hook system |
| 3.6 | shiten dashboard --live | Baixo | Watch mode com atualizacao periodica |
| 3.7 | Publicar npm package | Alto | Definir scope, registry, permissoes |
| 3.8 | Suportar projectos sem Git | Medio | Fallback para metricas estaticas apenas |
| 3.9 | Shell completion (bash/zsh/fish) | Baixo | Auto-complete para comandos e opcoes |
| 3.10 | shiten --quiet / --no-color | Baixo | Modo scriptavel para CI/CD |
| 3.11 | shiten init --dry-run | Baixo | Preview do que seria criado sem criar |
| 3.12 | shiten upgrade --dry-run | Baixo | Preview do que seria instalado sem instalar |
| 3.13 | shiten audit --fix | Medio | Auto-fix para problemas de governance detectados |
| 3.14 | Changelog automatico | Baixo | Gerar CHANGELOG.md a partir de commit messages |
| 3.15 | Version bumping automatizado | Baixo | Semver automatico baseado em conventional commits |
| 3.16 | Metrics export (Prometheus/OpenTelemetry) | Baixo | Exportar metricas de uso para observabilidade |
| 3.17 | Structured logging | Baixo | JSON logs em vez de console.log para parsing |
| 3.18 | Plugin versioning e dependency resolution | Baixo | Versao minima de plugins, dependencias entre plugins |
| 3.19 | shiten detect --approve/--reject | Medio | Aprovar ou rejeitar regras candidatas do pattern-detector |
| 3.20 | shiten feedback --outcome failure auto-link | Baixo | Ao reportar falha, sugerir areas baseado no pattern-detector |
| 3.21 | Briefing --profile no briefingToMarkdown | Baixo | Gerar markdown com profundidade adaptativa |
| 3.22 | HealthBar compartilhado | Baixo | dashboard.ts duplica healthBar de formatting.ts |
| 3.23 | Colorblind-friendly mode | Baixo | Usar icons/texto em vez de apenas cores |
| 3.24 | Event history query API | Baixo | Consultar historico de eventos do event-bus |
| 3.25 | shiten bench --save / --load | Baixo | Salvar/carregar benchmarks para comparacao offline |
| 3.26 | shiten status --fix | Baixo | Auto-fix para problemas de governance (como doctor) |
| 3.27 | Briefing cache com TTL configuravel | Baixo | Permitir configurar tempo de vida do cache |
| 3.28 | Briefing --watch | Baixo | Regenerar briefing automaticamente a cada N segundos |
| 3.29 | Session-tracker com append-only | Medio | session-tracker usa read-all-write-all — migrar para append-only |
| 3.30 | Validacao de schema com zod/io-ts | Baixo | Validar todos os tipos de record lidos de disco |
| 3.31 | shiten detect --format markdown | Baixo | Saida markdown para detect (atualmente so text/json) |
| 3.32 | Briefing cache com compressao | Baixo | Comprimir cache JSON para reduzir tamanho em disco |
| 3.33 | Feedback com campo `briefingProfile` | Baixo | Registrar qual profile (minimal/standard/full) foi usado |
| 3.34 | shiten dashboard --export csv | Baixo | Exportar dados do dashboard em CSV |
| 3.35 | Plugin sandboxing | Baixo | Isolar plugins em workers para seguranca |
| 3.36 | Decidir nome do produto | Baixo | Shiten Gaude, Prism, Codex, ou outro |
| 3.37 | Refinamento do logo | Baixo | Vetorizacao, variações, assets finais |
| 3.38 | Optimizar economia de tokens na abertura de sessao | Baixo | Reduzir consumo actual de 12% por sessao |
| 3.39 | M7 Offline license | Baixo | Modo offline com grace period de 30 dias |
| 3.40 | E1 SSO/SAML | Medio | Autenticacao empresarial via SAML 2.0 ou OIDC |
| 3.41 | E2 Compliance exports | Medio | Relatorios para SOC 2, ISO 42001, EU AI Act |
| 3.42 | E3 Audit trail | Medio | Log imutavel de todas as operacoes |
| 3.43 | E4 Role-based access | Baixo | Admin, Operator, Viewer por projeto |
| 3.44 | E5 Private deployment | Baixo | Self-hosted sem dependencia de npm registry |
| 3.45 | A5 Webhook de sessao | Baixo | POST briefing result para API externa |
| 3.46 | A6 Context injection API | Baixo | Endpoint REST para briefing sob demanda |
| 3.47 | D3 Migration guide | Baixo | Como migrar de outros tools para Shiten |
| 3.48 | D4 API documentation | Baixo | Referencia completa das funcoes internas |
| 3.49 | D5 SDK/library mode | Baixo | Uso como biblioteca Node.js, nao CLI |
| 3.50 | D6 Video walkthrough | Baixo | 5min demo no YouTube |
| 3.51 | DA3 User behavior analysis | Baixo | Fluxo tipico de uso |
| 3.52 | DA4 A/B testing framework | Baixo | Testar variacoes de briefing |
| 3.53 | S4 Supply chain security | Baixo | SLSA compliance, provenance, SBOM |
| 3.54 | I1 Multi-language support | Baixo | pt-BR, en, es |
| 3.55 | I2 Locale detection | Baixo | Detectar idioma do sistema automaticamente |
| 3.56 | I3 Translation management | Baixo | i18n framework (i18next ou similar) |
| 3.57 | G7 Product Hunt launch | Baixo | Preparar materiais para Product Hunt |
| 3.58 | LIVING-008 Semantic Entropy Drift | Medio | Calcular entropia de forma semantica (deriva de conteudo vs realidade do sistema) em vez de mtime via IA/correlation-engine |

---

## Resumo por Prioridade (Itens Activos)

| Prioridade | Itens | Tema Principal |
|---|---|---|
| **P0** | 3 | Governanca 0%, Cache cross-process, Bug detect --auto |
| **P1** | 23 | Arquitetura, docs, seguranca, monetizacao, AI integration, Shiten Living (fases 2-3, memoria, pipeline, pipelines de validação) |
| **P2** | 32 | Features, DX, analytics, enterprise, auto-analise, sync plano→backlog |
| **P3** | 57 | Nice-to-have, ecosystem, observability, i18n |
| **Total Activo** | **115** | |
| **Completed** | 67+ | Ver secção Completed Items abaixo |

---

## Completed Items

> Itens concluidos movidos de BACKLOG.md. Referencia historica.

### Done — Tabela Resumo

| Item | Severidade | Resolucao |
|---|---|---|
| Renomear "shiten-governance" → "shitenno-go" | Critico | package.json, init.ts, audit.ts |
| Executar Plano Estrategico (10 pilares) | Alto | conceptual model, knowledge lifecycle, capabilities, etc. |
| Comando `evolve` com dual-path | Alto | src/commands/evolve.ts |
| Comando `run` (pipeline) | Alto | src/commands/run.ts |
| Auto-evolution com feedback | Alto | src/auto-evolution.ts |
| Dual-path presenter | Alto | src/dual-path-presenter.ts |
| Challenge generator | Alto | src/challenge-generator.ts |
| Growth profile | Alto | src/growth-profile.ts |
| Event bus com 10 tipos novos | Alto | src/event-bus.ts |
| Seguranca no rule-engine | Critico | Allowlist em execSync, sanitizacao |
| Atomic writes no cache | Medio | writeCache() usa tmp + renameSync |
| Coverage configurado com thresholds | Alto | vitest.config.ts com @vitest/coverage-v8 |
| Context Pipeline completo | Alto | collectContext(), briefing-cache, session-feedback |
| Comando `feedback` | Alto | shiten feedback --outcome success/failure/partial |
| Comando `bench` | Medio | shiten bench — token benchmark automatizado |
| Comando `dashboard` | Medio | shiten dashboard — token economy metrics |
| Token optimizer | Medio | suggestDepth, compressedSummary, differentialBriefing |
| P0 0.1: Remover auto-feedback briefing | Alto | Removido recordOutcome() automatico |
| P0 0.2: Padrao redundante eliminado | Alto | enrichBriefingWithPatterns() aceita patternReport opcional |
| P0 0.3: Dead code briefing.ts | Medio | Removido displayBriefing() |
| P0 0.4: Dead code dashboard.ts | Baixo | Removido trendArrow() |
| P0 0.5: Simplificar getLatestFeedback | Baixo | Refatorado para records.at(-1) ?? null |
| 1.12 Coverage gap: comandos CLI | Alto | 36 novos testes (580 total) |
| Auto-backlog feature | Alto | shiten audit --auto-backlog |
| AUDIT-EXPANSION | Alto | Expandir audit coverage 79% → ~93% |
| SA1 | Critico | governance/WORKFLOW.md criado |
| SA6 | Alto | Artefactos orfaos conectados via SYSTEM_MAP.md |
| BACKLOG-0.7 | Critico | Actualizar documentacao desactualizada (6 ficheiros) |
| SA2 | Critico | Resolvido import de node:fs em digest.ts |
| AUDIT-CLEANUP-01 a 05 | Baixo | Varias limpezas de codigo |
| DESOPLAMENTO A.1-A.4 | Critico | Desacoplamento de opencode.json |
| DESOPLAMENTO A.5 | Alto | MCP multi-formato |
| DESOPLAMENTO B.1-B.7 | Alto | Varias correccoes de estabilidade |
| MCP-SERVER | Alto | Servidor MCP com 3 tools |
| SA3 | Critico | Governance 0% resolvido |
| SA5 | Alto | 4 ADRs criados |
| SA8 | Alto | context_buffer.yaml movido para core |
| SA9 | Alto | 4 agent contracts |
| 2.5 | Medio | context-collector desacoplado |
| 2.2a | Medio | Feedback CLI flags + testes |
| 2.10 | Medio | AGENTS.md template actualizado |
| 2.18 | Medio | Dashboard cliques do mouse funcionais |
| 3.5 | Baixo | Plugin system com hooks |
| 3.29 | Medio | Session-tracker append-only |
| 2.1 | Medio | shiten detect --approve/--reject |
| 2.3 | Baixo | shiten bench --compare |
| 2.4 | Baixo | shiten feedback --list |
| 2.12 | Baixo | JSDoc nas funcoes novas (parcial) |
| 2.13 | Medio | Consolidar planos |
| 2.17 | Baixo | Benchmark suite automatizada CI |
| S2 | Alto | Dependency auditing no CI |
| A1 MCP server | Alto | Adicionadas 4 ferramentas (getEngineeringState, getBacklog, getPlans, submitFeedback) e integrado com o lifecycle |

### Plano de Correção Auditoria Completa — Done (2026-07-10)

| Fase | Descricao |
|---|---|
| Fase 1 — Segurança | 8 items: allowlist, sanitizacao, ReDoS, prototype pollution, plugins |
| Fase 0 — Quick Wins | Referencias partidas, READMEs, extensoes |
| Fase 1.1 — Empty Catches | 52 catch blocks → logger.debug |
| Fase 1.3 — console.log → logger | Analise: output CLI intencional, biblioteca ja usa logger |
| Fase 1.5 — Orphan Modules | Detector reescrito para verificar exports reais |
| Fase 2 — Qualidade | Constantes consolidadas (VIOLATION_KEYWORDS, COMMAND_GATES) |
| Fase 3 — Infraestrutura | ESLint, tsconfig, .gitignore, cache atomic, event limits |
| Fase 4 — CI/CD | lint/test/coverage jobs, npm audit, pinned SHAs, version verification |
| Fase 5 — README | 32 comandos, arquitectura, seguranca documentados |

---
*Ultima atualizacao: 2026-07-10 — Fase 0-3, 5-6 do gap analysis plan concluidas*



### BACKLOG-2026_07_02_SHITEN_DASHBOARD_RESTRUCTURE — Shitenno-go Dashboard — Plano de Refactoracao por Camadas de Conhecimento

| Campo | Valor |
|---|---|
| **Status** | planeado (0% — 0/0) |
| **Severidade** | Medio |
| **Prioridade** | P1 |
| **Owner** | executor |
| **Data** | 2026-07-12 |
| **Fonte** | shiten plan md prepare |
| **Modulos** | governance/plans/ |
| **Descricao** | Shitenno-go Dashboard — Plano de Refactoracao por Camadas de Conhecimento |
| **Correcao** | Verificar checklist no plano `governance/plans/2026-07-02-shitenno-dashboard-restructure.md` |


### BACKLOG-2026_07_11_SHITEN_LIVING_PLANO_V2_3FASES — Shitenno-go Living — Plano de Implementação (v2 — Roteiro em 3 Camadas)

| Campo | Valor |
|---|---|
| **Status** | planeado (0% — 0/0) |
| **Severidade** | Medio |
| **Prioridade** | P1 |
| **Owner** | executor |
| **Data** | 2026-07-12 |
| **Fonte** | shiten plan md prepare |
| **Modulos** | governance/plans/ |
| **Descricao** | Shitenno-go Living — Plano de Implementação (v2 — Roteiro em 3 Camadas) |
| **Correcao** | Verificar checklist no plano `governance/plans/2026-07-11-shiten-living-plano-v2-3fases.md` |


### BACKLOG-2026_07_12_PLANO_FIX_RETROACTIVE_SCAN_RACE — Plano — Corrigir Race Condition no Retroactive Scan (`plan-backlog-sync.ts`)

| Campo | Valor |
|---|---|
| **Status** | concluído |
| **Severidade** | Medio |
| **Prioridade** | P1 |
| **Owner** | executor |
| **Data** | 2026-07-12 |
| **Fonte** | shiten plan md prepare |
| **Modulos** | governance/plans/ |
| **Descricao** | Plano — Corrigir Race Condition no Retroactive Scan (`plan-backlog-sync.ts`) |
| **Correcao** | Verificar checklist no plano `governance/plans/2026-07-12-plano-fix-retroactive-scan-race.md` |


### BACKLOG-2026_07_12_BACKLOG_BATCH_RESOLVER — Plano — Resolver Backlog em Lote (Itens sem Dependência Humana)

| Campo | Valor |
|---|---|
| **Status** | concluído |
| **Severidade** | Medio |
| **Prioridade** | P1 |
| **Owner** | executor |
| **Data** | 2026-07-12 |
| **Fonte** | shiten plan md prepare |
| **Modulos** | governance/plans/ |
| **Descricao** | Plano — Resolver Backlog em Lote (Itens sem Dependência Humana) |
| **Correcao** | Verificar checklist no plano `governance/plans/2026-07-12-backlog-batch-resolver.md` |

#### Passos do Plano
- [ ] `pnpm lint` passa sem erros
- [ ] `pnpm test` passa (1898+ testes)
- [ ] BACKLOG.md actualizado com novos Done items
- [ ] Commit + push para origin
- [ ] `pnpm lint` passa sem erros
- [ ] `pnpm test` passa (1898+ testes)
- [ ] BACKLOG.md actualizado com novos Done items
- [ ] Commit + push para origin


### BACKLOG-2026_07_12_PLANO_CORRECAO_WATCH_LOOP_E_FASE2 — Plano de Correção — Loop do `shiten watch` + Finalizar Fase 2 (LIVING-002)

| Campo | Valor |
|---|---|
| **Status** | planeado (0% — 0/8) |
| **Severidade** | Medio |
| **Prioridade** | P1 |
| **Owner** | executor |
| **Data** | 2026-07-12 |
| **Fonte** | shiten plan md prepare |
| **Modulos** | governance/plans/ |
| **Descricao** | Plano de Correção — Loop do `shiten watch` + Finalizar Fase 2 (LIVING-002) |
| **Correcao** | Verificar checklist no plano `governance/plans/2026-07-12-plano-correcao-watch-loop-e-fase2.md` |

#### Passos do Plano
- [ ] Os 2 testes novos acima passam.
- [ ] `pnpm test` completo continua em verde (sem regressão nos testes existentes de
- [ ] Teste manual: `shiten watch` rodando, editar um plano real com conteúdo que dispara sync — confirmar
- [ ] `installReactiveHooks()` implementado, testado (5 testes acima passando).
- [ ] `shiten init` chama o instalador automaticamente — testar em projeto novo: `.git/hooks/post-commit`
- [ ] `scheduledCheck()` implementado e testado (simular drift alto, confirmar evento publicado; simular
- [ ] `pnpm run lint && npx tsc --noEmit && pnpm run build && npx vitest run` — tudo verde.
- [ ] Atualizar `shitenno-go/docs/BACKLOG.md` — mudar `LIVING-002` de `Status: Backlog` para
- [ ] Os 2 testes novos acima passam.
- [ ] `pnpm test` completo continua em verde (sem regressão nos testes existentes de
- [ ] Teste manual: `shiten watch` rodando, editar um plano real com conteúdo que dispara sync — confirmar
- [ ] `installReactiveHooks()` implementado, testado (5 testes acima passando).
- [ ] `shiten init` chama o instalador automaticamente — testar em projeto novo: `.git/hooks/post-commit`
- [ ] `scheduledCheck()` implementado e testado (simular drift alto, confirmar evento publicado; simular
- [ ] `pnpm run lint && npx tsc --noEmit && pnpm run build && npx vitest run` — tudo verde.
- [ ] Atualizar `shitenno-go/docs/BACKLOG.md` — mudar `LIVING-002` de `Status: Backlog` para


### BACKLOG-2026_07_13_PLANO_BUG002_ENTROPIA — Plano Consolidado — Shiten Living: BUG-002 (fim-a-fim), Redesenho da Entropia, Item Futuro

| Campo | Valor |
|---|---|
| **Status** | planeado (0% — 0/0) |
| **Severidade** | Medio |
| **Prioridade** | P1 |
| **Owner** | executor |
| **Data** | 2026-07-12 |
| **Fonte** | shiten plan md prepare |
| **Modulos** | governance/plans/ |
| **Descricao** | Plano Consolidado — Shiten Living: BUG-002 (fim-a-fim), Redesenho da Entropia, Item Futuro |
| **Correcao** | Verificar checklist no plano `governance/plans/2026-07-13-plano-bug002-entropia.md` |


### BACKLOG-2026_07_12_MIGRAR_CONSOLE_LOG_PARA_LOGGER — Plano — Migrar console.log para Logger Centralizado (3.1)

| Campo | Valor |
|---|---|
| **Status** | em implementação (33% — 2/6) |
| **Severidade** | Medio |
| **Prioridade** | P1 |
| **Owner** | executor |
| **Data** | 2026-07-12 |
| **Fonte** | shiten plan md prepare |
| **Modulos** | governance/plans/ |
| **Descricao** | Plano — Migrar console.log para Logger Centralizado (3.1) |
| **Correcao** | Verificar checklist no plano `governance/plans/2026-07-12-migrar-console-log-para-logger.md` |

#### Passos do Plano
- [ ] Migrar comandos (ordenados por complexidade crescente)
- [ ] Run lint + tests
- [ ] Atualizar BACKLOG.md (3.1 → Done)
- [ ] Commit + push


### BACKLOG-PLAN_DOC_SEMANTIC_SYNC — PLANO — Doc Semantic Sync (drift semântico → reminder → AI)

| Campo | Valor |
|---|---|
| **Status** | planeado (0% — 0/0) |
| **Severidade** | Medio |
| **Prioridade** | P1 |
| **Owner** | executor |
| **Data** | 2026-07-13 |
| **Fonte** | shiten plan md prepare |
| **Modulos** | governance/plans/ |
| **Descricao** | PLANO — Doc Semantic Sync (drift semântico → reminder → AI) |
| **Correcao** | Verificar checklist no plano `governance/plans/PLAN-doc-semantic-sync.md` |


### BACKLOG-2026_07_13_REFACTOR_ESTRUTURAL_SA4_SA10_SA11 — Plano de Refactor Estrutural — SA4 / SA10 / SA11

| Campo | Valor |
|---|---|
| **Status** | em implementação |
| **Severidade** | Medio |
| **Prioridade** | P1 |
| **Owner** | executor |
| **Data** | 2026-07-13 |
| **Fonte** | shiten plan md prepare |
| **Modulos** | governance/plans/ |
| **Descricao** | Plano de Refactor Estrutural — SA4 / SA10 / SA11 |
| **Correcao** | Verificar checklist no plano `governance/plans/2026-07-13-refactor-estrutural-sa4-sa10-sa11.md` |

#### Passos do Plano
- [ ] `pnpm run lint` — limpo
- [ ] `pnpm test` — todos passam
- [ ] `pnpm run build` — OK
- [ ] `wc -l src/*.ts` — nenhum > 400
- [ ] `find src/ -maxdepth 1 -name "*.ts" | wc -l` — < 30
- [ ] `ls -d src/domain/ src/infrastructure/ src/shared/` — existem
- [ ] Backlog SA4/SA10/SA11 actualizado
- [ ] `pnpm run lint` — limpo
- [ ] `pnpm test` — todos passam
- [ ] `pnpm run build` — OK
- [ ] `wc -l src/*.ts` — nenhum > 400
- [ ] `find src/ -maxdepth 1 -name "*.ts" | wc -l` — < 30
- [ ] `ls -d src/domain/ src/infrastructure/ src/shared/` — existem
- [ ] Backlog SA4/SA10/SA11 actualizado


### BACKLOG-PLANO_MONETIZACAO_SHITEN — Plano de Monetização — shitenno-go (Free + Token Mensal)

| Campo | Valor |
|---|---|
| **Status** | em implementação |
| **Severidade** | Medio |
| **Prioridade** | P1 |
| **Owner** | executor |
| **Data** | 2026-07-13 |
| **Fonte** | shiten plan md prepare |
| **Modulos** | governance/plans/ |
| **Descricao** | Plano de Monetização — shitenno-go (Free + Token Mensal) |
| **Correcao** | Verificar checklist no plano `governance/plans/PLANO-MONETIZACAO-SHITEN.md` |

#### Passos do Plano
- [ ] `PUBLIC_JWK` real (não o placeholder) commitado em `src/license.ts`
- [ ] `PRIVATE_JWK` **fora** do repositório (só no Cloudflare, via `wrangler secret`)
- [ ] Worker deployado e testado manualmente (`curl` no `/refresh` com uma key de teste)
- [ ] Payment Link do Stripe testado em modo teste (Stripe tem test mode com cartão `4242 4242 4242 4242`)
- [ ] `shiten license activate <key>` testado ponta a ponta em modo teste
- [ ] `PUBLIC_JWK` real (não o placeholder) commitado em `src/license.ts`
- [ ] `PRIVATE_JWK` **fora** do repositório (só no Cloudflare, via `wrangler secret`)
- [ ] Worker deployado e testado manualmente (`curl` no `/refresh` com uma key de teste)
- [ ] Payment Link do Stripe testado em modo teste (Stripe tem test mode com cartão `4242 4242 4242 4242`)
- [ ] `shiten license activate <key>` testado ponta a ponta em modo teste


### BACKLOG-PLAN_MONETTIZATION_IMPLEMENTATION — Plano de Implementação — Monetização Shiten CLI

| Campo | Valor |
|---|---|
| **Status** | planeado |
| **Severidade** | Medio |
| **Prioridade** | P1 |
| **Owner** | executor |
| **Data** | 2026-07-14 |
| **Fonte** | shiten plan md prepare |
| **Modulos** | governance/plans/ |
| **Descricao** | Plano de Implementação — Monetização Shiten CLI |
| **Correcao** | Verificar checklist no plano `governance/plans/PLAN-monettization-implementation.md` |

#### Passos do Plano
- [ ] Criar `src/license.ts`
- [ ] Adicionar `jose` ao `package.json`
- [ ] Criar `src/__tests__/license.test.ts`
- [ ] Modificar `src/cli-middleware.ts`
- [ ] Criar `src/commands/license.ts`
- [ ] Modificar `bin/shiten.ts`
- [ ] Criar `src/__tests__/license.test.ts`
- [ ] Criar `src/__tests__/license-gate.test.ts`
- [ ] Actualizar `README.md`
- [ ] Criar `docs/handbook/02-commands/license.md`
- [ ] Actualizar `docs/reference/cli.md`

| Address critical knowledge debt (3+ gaps detected) | 🟡 Médio | Backlog | 2026-07-15 | unassigned |
| Address critical knowledge debt (3+ gaps detected) | 🟡 Médio | Backlog | 2026-07-15 | unassigned |
| Address critical knowledge debt (3+ gaps detected) | 🟡 Médio | Backlog | 2026-07-15 | unassigned |

### BACKLOG-2026_07_15_MONOLITH_REFACTOR_PREVENTION — Plano: Monolith Refactor + Architectural Prevention

| Campo | Valor |
|---|---|
| **Status** | planeado |
| **Severidade** | Medio |
| **Prioridade** | P1 |
| **Owner** | executor |
| **Data** | 2026-07-15 |
| **Fonte** | shiten plan md prepare |
| **Modulos** | governance/plans/ |
| **Descricao** | Plano: Monolith Refactor + Architectural Prevention |
| **Correcao** | Verificar checklist no plano `governance/plans/2026-07-15-monolith-refactor-prevention.md` |

#### Passos do Plano
- [ ] ADR-007 criado e aceite
- [ ] ESLint config actualizado (5 regras novas)
- [ ] pre-commit hook actualizado (file size gate)
- [ ] validate:architecture criado e registado em package.json
- [ ] FORBIDDEN_OPERATIONS.md actualizado (F-06)
- [ ] DESDO.md actualizado (limites de tamanho)
- [ ] clean_code_standards.md actualizado (limites de tamanho)
- [ ] sync-docs.ts refactored (655 → ~50 linhas)
- [ ] 10 validators criados em validators/
- [ ] plan.ts refactored (945 → ~80 linhas)
- [ ] 15 sub-comandos criados em plan/
- [ ] optimization-proposer.ts refactored (630 → decomposta)
- [ ] upgrade.ts refactored (501 → ~80 linhas)
- [ ] 3 módulos criados em upgrade/
- [ ] CI workflow actualizado (architecture validation step)
- [ ] pnpm run lint — 0 erros
- [ ] pnpm run typecheck — 0 erros
- [ ] pnpm run test — todos passam
- [ ] pnpm run validate:architecture — 0 violações
- [ ] pnpm run sync:docs — warnings apenas
- [ ] pnpm run validate:session — passa
- [ ] Nenhum ficheiro em src/ >300 linhas (excluindo __tests__, templates)
- [ ] Commit feito com mensagem correcta
- [ ] Push para feat/monolith-refactor


### BACKLOG-PLANO_MELHORIA_MECANISMO_CONTEXTO — Plano: Melhorar o Mecanismo de Medição de Contexto (P0-P4)

| Campo | Valor |
|---|---|
| **Status** | Done |
| **Severidade** | Medio |
| **Prioridade** | P1 |
| **Owner** | executor |
| **Data** | 2026-07-15 |
| **Fonte** | shiten plan md prepare |
| **Modulos** | governance/plans/ |
| **Descricao** | Plano: Melhorar o Mecanismo de Medição de Contexto (P0-P4) |
| **Correcao** | Verificar checklist no plano `governance/plans/plano-melhoria-mecanismo-contexto.md` |


### BACKLOG-2026_07_15_DAEMON_STARTUP_SCAN — Daemon Startup Scan — Funções Proativas

| Campo | Valor |
|---|---|
| **Status** | planeado |
| **Severidade** | Medio |
| **Prioridade** | P1 |
| **Owner** | executor |
| **Data** | 2026-07-15 |
| **Fonte** | shiten plan md prepare |
| **Modulos** | governance/plans/ |
| **Descricao** | Daemon Startup Scan — Funções Proativas |
| **Correcao** | Verificar checklist no plano `governance/plans/2026-07-15-daemon-startup-scan.md` |

#### Passos do Plano
- [ ] FASE 1: Adicionar startup scan no daemon.ts
- [ ] FASE 2.1: Criar `checkInconsistencies()`
- [ ] FASE 2.2: Criar `validateReminders()`
- [ ] FASE 2.3: Criar `moveCompletedBacklogToDone()`
- [ ] FASE 3: Adicionar novos subscribers reactivos
- [ ] FASE 4: Implementar auditoria periódica adaptativa
- [ ] Testar: daemon arranca e executa scan inicial
- [ ] Testar: reminders stale são removidos
- [ ] Testar: backlog items concluídos são movidos
- [ ] Testar: auditoria periódica adjusta intervalo


### BACKLOG-HANDOFF_AGENTE — Handoff para o agente — shitenno-go

| Campo | Valor |
|---|---|
| **Status** | em implementação |
| **Severidade** | Medio |
| **Prioridade** | P1 |
| **Owner** | executor |
| **Data** | 2026-07-16 |
| **Fonte** | shiten plan md prepare |
| **Modulos** | governance/plans/ |
| **Descricao** | Handoff para o agente — shitenno-go |
| **Correcao** | Verificar checklist no plano `governance/plans/handoff-agente.md` |


### BACKLOG-PLANO_DAEMON_KERNEL — Plano: transformar o daemon no kernel do shitenno-go

| Campo | Valor |
|---|---|
| **Status** | em implementação |
| **Severidade** | Medio |
| **Prioridade** | P1 |
| **Owner** | executor |
| **Data** | 2026-07-16 |
| **Fonte** | shiten plan md prepare |
| **Modulos** | governance/plans/ |
| **Descricao** | Plano: transformar o daemon no kernel do shitenno-go |
| **Correcao** | Verificar checklist no plano `governance/plans/plano-daemon-kernel.md` |


### BACKLOG-MIGRACAO_YAML_FRONTMATTER — Plano: migrar o formato de status dos planos para frontmatter YAML

| Campo | Valor |
|---|---|
| **Status** | em implementação |
| **Severidade** | Medio |
| **Prioridade** | P1 |
| **Owner** | executor |
| **Data** | 2026-07-16 |
| **Fonte** | shiten plan md prepare |
| **Modulos** | governance/plans/ |
| **Descricao** | Plano: migrar o formato de status dos planos para frontmatter YAML |
| **Correcao** | Verificar checklist no plano `governance/plans/migracao-yaml-frontmatter.md` |

#### Passos do Plano
- [ ] Passo 1 — TBD

### BACKLOG-AUDIT_IMPROVEMENT_PLAN_2026_07_16 — Plano de Melhorias pós-Auditoria Enterprise

| Campo | Valor |
|---|---|
| **Status** | planeado |
| **Severidade** | Alto |
| **Prioridade** | P0 |
| **Owner** | executor |
| **Data** | 2026-07-16 |
| **Fonte** | shiten audit enterprise (score 59/100) |
| **Modulos** | governance/plans/ |
| **Descricao** | Plano de melhorias baseado na auditoria enterprise: 35 críticos, 169 avisos, 659 info |
| **Correcao** | Verificar checklist no plano `governance/plans/2026-07-16-audit-improvement-plan.md` |

#### Passos do Plano
- [ ] Fase 1: Corrigir path_traversal, circular_dep, xss_risk, sql_injection (6+2+2+1 = 11 críticos)
- [ ] Fase 2: Decompor high_complexity (49), god_functions (36), deep_nesting (30)
- [ ] Fase 3: Eliminar empty_catch (55), dead_code (10), unused_exports (399)
- [ ] Fase 4: Corrigir broken_refs (23), dead_rules (18), system_map_mismatch (8)
- [ ] Fase 5: Adicionar schema validation para JSON.parse (67)
- [ ] Fase 6: Adicionar testes para 147 módulos sem cobertura
- [ ] Score enterprise >80/100
