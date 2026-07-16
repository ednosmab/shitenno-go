# Relatório: Avaliação Honesta do Projecto Shitenno-go

**Data:** 2026-07-15
**Avaliador:** Agente IA (opencode/mimo-v2.5-free)
**Calibração:** Bajulação: mínima | Honestidade: máxima
**Versão:** 2.0 — Reavaliado com compreensão do modelo event-driven

---

## 1. O que é este projecto, realmente?

Shitenno-go **não é um CLI governance tool**. É um **sistema event-driven com daemon de fundo** que actua proactiva e reactivamente sobre eventos de governança de projectos de software.

A arquitectura real tem 3 camadas:

```
┌─────────────────────────────────────────────┐
│           CLI (Interface de Entrada)         │
│  38 comandos — init, status, audit, detect  │
├─────────────────────────────────────────────┤
│           Daemon (Processo de Fundo)         │
│  File watcher, IPC, adaptive audit,         │
│  startup scan, circuit breaker              │
├─────────────────────────────────────────────┤
│           Event Bus (Sistema Nervoso)        │
│  67 tipos de evento, pub/sub, DLQ,          │
│  replay, versioning, persistence            │
└─────────────────────────────────────────────┘
```

O CLI é apenas a porta de entrada. O valor real está no daemon e no event bus.

---

## 2. Eficiência

**O daemon é eficiente. O CLI é pesado.**

### O que funciona bem

- **Event Bus:** 67 tipos de evento com typed payloads, persistência em disco (JSONL), dead-letter queue para eventos falhados, versioning de schema para evolution, replay de eventos, correlationId + traceId para distributed tracing. Infraestrutura séria.
- **Daemon (917 linhas):** Processo de fundo completo com IPC via Unix socket (chmod 0600), state persistence, graceful shutdown (SIGTERM/SIGINT), circuit breaker para crash loops, bounded memory collections (BoundedQueue, LRUCache) para prevenir memory leaks em sessões longas.
- **Adaptive Audit:** Intervalo de audit ajusta-se automaticamente ao health score (>70: 6h, 40-70: 4h, <40: mais frequente). Eficiente — não gasta recursos quando está saudável.
- **Startup Scan:** Arquiva planos, verifica inconsistências, valida reminders, move backlog done — tudo na inicialização.

### O que é ineficiente

- **CLI Ritual:** 10+ passos obrigatórios antes de qualquer acção (ler WORKFLOW.md, context_buffer, AGENTS.md, FORBIDDEN_OPERATIONS, DESDO, etc.). Isto é overhead do agente IA, não do daemon.
- **99 flat files em src/:** O código do daemon é bem estruturado. O problema é o resto — 10+ ficheiros >500 linhas, zero separação de camadas.

---

## 3. Valor para o mercado

**Existe, mas é um nicho específico.**

O problema que resolve (governance automatizada para projectos de software com IA) é real. Contudo:

- **Não existem métricas reais.** O README diz "60-80% token savings" mas é "projected estimates, not measured benchmarks".
- **O público-alvo é específico:** Tech leads e AI engineers que precisam de governança automatizada — não o developer solo médio.
- **Concorrentes resolvem partes:** Cursor/Windsurf/Continue resolvem context persistence. Nenhum resolve event-driven governance com daemon.
- **A oportunidade está no daemon:** Um daemon que watcha projectos e reage a eventos de governança automaticamente é diferenciador. Nenhum concorrente faz isto.

---

## 4. Produtividade (agente IA)

**Mudou de natureza.**

**Antes (avaliação anterior):** "Sinto-me mais lento — ritual de 10 passos."

**Agora (compreensão do daemon):**
- O daemon **poupa trabalho** — detecta padrões, arquiva planos, valida reminders, gera challenges — tudo automaticamente.
- O CLI Ritual continua pesado para o agente IA, mas o daemon faz o trabalho pesado em background.
- O problema não é o daemon — é que o agente IA não subscreve os eventos do daemon. O sistema event-driven existe, mas o agente IA não está integrado com ele.

---

## 5. Sentimentos a trabalhar no projecto

**Frustração mudou de natureza.**

**Antes:** "Preso num loop de governança — o system gera mais paperwork do que código."

**Agora:** "O potencial não está a ser realizado — o event bus tem 67 canais mas só 10 estão ligados."

- O event bus é genuinamente impressionante (67 tipos, DLQ, replay, versioning)
- O daemon tem arquitectura sólida (circuit breaker, bounded collections, adaptive audit)
- Os mecanismos reactivos existem e funcionam (file watcher, git hooks, scheduled checks)
- **Mas:** 57 dos 67 eventos não têm handler. O proactive engine só subscreve 1 evento. O rule engine não está integrado com o bus.

---

## 6. Alternativas

| Ferramenta | O que faz | Por que Shitenno-go é diferente |
|---|---|---|
| **Cursor Rules** | 1 ficheiro de regras | Shiten tem daemon + event bus + adaptive audit |
| **Windsurf Memories** | Contexto persistente | Shiten tem proactive governance + pattern detection |
| **Continue.dev** | Context injection | Shiten tem file watching + auto-archival |
| **Copilot** | Contexto do workspace | Shiten tem event-driven + IPC + circuit breaker |
| **Aider** | Repo map | Shiten tem rule engine + proactive challenges |

Shitenno-go não concorre com estas ferramentas — resolve um problema diferente: **governance automatizada via eventos**. Nenhum concorrente faz isto.

---

## 7. O que este projecto faz de bem

### Arquitectura Event-Driven (genuinamente boa)
- **Event Bus** com 67 tipos, DLQ, replay, versioning, persistence
- **Daemon** com IPC, circuit breaker, bounded collections, adaptive audit
- **File watcher** com debounce, significance calculation, type detection
- **Git hooks** que disparam detecção de padrões automaticamente

### Infraestrutura Técnica
- **1791+ testes**, benchmarks, CI/CD completo
- **Segurança:** allowlist, sanitização, cache atomic, plugin validation, chmod 0600
- **MCP server** para integração com ferramentas de IA
- **BoundedQueue + LRUCache** para memory safety em sessões longas

### Conceito
- **Pattern detector** — detecta padrões no histórico de engenharia
- **Proactive engine** — gera challenges baseados em trends (entropy, health, knowledge debt)
- **Adaptive audit** — intervalo ajusta-se ao health score do projecto

---

## 8. O que está errado (gaps críticos)

| # | Problema | Impacto | Severidade |
|---|---|---|---|
| 1 | **Event bus ≠ rule engine** — O bus publica eventos mas não os rota para o rule engine. Dois sistemas paralelos que não se falam. | Alto | Crítico |
| 2 | **57 dos 67 eventos sem handler** — O daemon consome apenas ~10 tipos. 57 são publicados mas ninguém trata. | Alto | Alto |
| 3 | **Proactive engine mono-event** — Só subscreve `engineering_state.consolidated`. Toda a proactividade depende de 1 gatilho. | Alto | Alto |
| 4 | **IPC protocol trivial** — ping/pong, status, queries. Sem health checks, readiness probes, event streaming. | Médio | Médio |
| 5 | **Startup scan síncrono** — Blocka o daemon de ficar pronto. Se `checkAndArchiveDonePlans` demorar, o daemon não responde a IPC. | Médio | Médio |
| 6 | **File watcher sem error recovery** — Se chokidar falhar, o watcher morre silenciosamente. Sem reconexão automática. | Alto | Alto |
| 7 | **Sem health check endpoint** — O daemon não expõe /health para monitoring externo. | Médio | Médio |
| 8 | **Sem graceful degradation** — Se o daemon cair, o CLI perde capacidade event-driven. Sem fallback para modo disk-based. | Alto | Alto |

---

## 9. Diagnóstico final

| Dimensão | Nota v1 | Nota v2 | Justificação da mudança |
|---|---|---|---|
| **Eficiência** | 3/10 | 5/10 | O daemon é eficiente. O overhead é no CLI, não no daemon. |
| **Valor de mercado** | 4/10 | 6/10 | Event-driven governance para IA é um nicho real sem concorrência directa. |
| **Produtividade (IA)** | 2/10 | 4/10 | O daemon poupa trabalho, mas o CLI ritual continua pesado. |
| **Código** | 4/10 | 5/10 | O daemon (917 linhas) é bem estruturado. O problema são os 99 flat files. |
| **Testes** | 8/10 | 8/10 | Forte cobertura, benchmarks, CI/CD. |
| **Documentação** | 5/10 | 5/10 | Vasta mas 27 ficheiros desactualizados. |
| **Manutenibilidade** | 3/10 | 5/10 | Event-driven architecture é mais fácil de manter quando compreendido. |
| **UX do utilizador** | 4/10 | 5/10 | `shiten daemon start` + `shiten status` é UX decente para quem compreende o modelo. |
| **Arquitectura event-driven** | N/A | 6/10 | Fundação sólida, mas com gaps críticos (bus ≠ rule engine). |

**Média v1: 4.1/10 | Média v2: 5.5/10**

---

## 10. Recomendações

### Prioridade Crítica (fazer primeiro)

1. **Unificar event bus com rule engine** — Quando um evento é publicado, o rule engine devia ser acionado automaticamente. Actualmente são dois sistemas paralelos. Implementar um `EventDrivenRuleExecutor` que subscreva todos os eventos e invoque o rule engine.

2. **Expandir event handlers do daemon** — Priorizar: `maturity.changed`, `capability.installed`, `debt.detected`, `evolution.recommended`, `pattern.detected`. Estes são os eventos que geram mais valor quando tratados.

3. **Proactive engine multi-event** — Subscrever: `health.checked`, `debt.detected`, `pattern.detected`, `maturity.changed`, `capability.installed`. Cada evento pode gerar challenges e recommendations.

### Prioridade Alta

4. **File watcher error recovery** — Adicionar reconexão automática se chokidar falhar. Implementar exponential backoff.

5. **Async startup scan** — Mover o startup scan para background para o daemon ficar pronto mais rápido. O daemon devia aceitar IPC imediatamente, mesmo que o scan ainda não tenha terminado.

6. **Daemon health check** — Adicionar query type `query_health` ao IPC que retorne `healthy/degraded/critical` + uptime + event count.

### Prioridade Média

7. **Documentar o modelo event-driven** — O README actual descreve um CLI. Deveria descrever: daemon + event bus + CLI como interface.

8. **Medir valor real** — Criar benchmarks de token savings em vez de estimativas projectadas.

9. **Reestruturar código** — 99 flat files → domain/infrastructure/commands. Extrair god modules. DI.

---

## 11. Conclusão

Shitenno-go tem uma arquitectura event-driven sólida que está a ser subutilizada. O problema não é "governance overhead" — é que o event bus tem 67 canais e só 10 estão ligados.

O valor existe e é diferenciador. Nenhum concorrente faz event-driven governance com daemon. A fundação técnica é sólida (event bus com DLQ, circuit breaker, bounded collections, adaptive audit).

Para realizar o potencial: (1) unificar event bus com rule engine, (2) expandir os 57 event handlers无声, (3) tornar o proactive engine multi-event.

A pergunta não é "este projecto deveria existir" — é "quando é que o event bus vai estar completamente ligado?"

---

## 12. Mudanças vs. Relatório v1

| Aspecto | v1 (incorrecto) | v2 (corrigido) |
|---|---|---|
| **Compreensão** | "CLI governance tool" | "Event-driven system with daemon" |
| **Avaliação do daemon** | "Overhead excessivo" | "Arquitectura sólida, subutilizada" |
| **Avaliação do event bus** | "Não mencionado" | "67 tipos, DLQ, replay, versioning — impressionante" |
| **Avaliação do rule engine** | "Regras excessivas" | "Sistema declarativo bom, mas não integrado com bus" |
| **Avaliação do proactive** | "Não existe" | "Existe mas mono-event (1 gatilho)" |
| **Recomendações** | "Simplificar tudo" | "Ligar o que já existe" |
| **Média** | 4.1/10 | 5.5/10 |

---

*Relatório gerado em 2026-07-15. Reavaliado na mesma data após compreensão do modelo event-driven.*
*Calibração: 100% honestidade, 0% bajulação.*
