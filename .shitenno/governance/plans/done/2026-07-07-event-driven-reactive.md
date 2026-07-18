# Plano: Shitenno-go — Modelo Híbrido Request-Driven + Event-Driven

**Status:** Done
**Data:** 2026-07-07
**Autor:** AI Agent (planner)
**Objetivo:** Transformar o sistema num pipeline híbrido onde request-initia e event-reakt

---

## Princípio Arquitectural

```
UTILIZADOR ──comando──► CLI (request-driven)
                            │
                            ├──► Command executa lógica
                            ├──► Command publica evento específico (event-driven)
                            │         │
                            │         ▼
                            │    Rule Engine reage
                            │    Task Pipeline coordena
                            │    File Watcher detecta mudanças
                            │
                            └──► Middleware publica "command.completed" (telemetria)
```

**Request-driven** = o utilizador inicia acções via comandos
**Event-driven** = cada acção publica eventos que disparam comportamentos reactivos

---

## Fase 1: Corrigir Session Tracking (Fundação)

**Porquê:** Sem sessões com dados reais, não há telemetria fiável.

### Step 1.1: Corrigir race condition no Session Tracker

**Ficheiro:** `src/session-tracker.ts`

- Substituir `overwriteSessions()` (read-all + write-all) por append-only para `trackCommand()` e `trackFeedback()`
- Usar cache em memoria com invalidação por timestamp para reads
- Adicionar campo `lastActivityAt` ao `SessionRecord`

**Verificação:** `pnpm run test` no session-tracker.test.ts

### Step 1.2: Corrigir duration no bin/shiten.ts

**Ficheiro:** `bin/shiten.ts`

- Remover `duration: 0` hardcoded (linha 283)
- Calcular duração real em `endSession()` a partir de `startedAt` → `endedAt`
- Publicar `session.end` com duration real

**Verificação:** Após `shiten status`, `sessions.jsonl` tem `duration > 0`

### Step 1.3: Activar trackFeedback

**Ficheiro:** `src/commands/feedback.ts`

- Chamar `trackFeedback()` quando utilizador submete feedback
- Publicar `recommendation.accepted` ou `recommendation.rejected`

**Verificação:** `sessions.jsonl` com `feedbackGiven` actualizado

---

## Fase 2: Separar Eventos de Telemetria de Eventos de Comando

**Porquê:** O middleware publica `analysis.complete` com dados placeholder para TODOS os comandos, criando ruído.

### Step 2.1: Renomear evento do middleware para `command.completed`

**Ficheiros:** `src/cli-middleware.ts`, `src/event-bus.ts`, `src/event-payloads.ts`

- Trocar `analysis.complete` por `command.completed` no `postAction` hook
- Payload: `{ command, projectRoot, timestamp, duration }` — telemetria pura
- Medir `duration` real (preAction timestamp → postAction timestamp)
- Adicionar `"command.completed"` ao `ShitenEventType`
- Criar `CommandCompletedPayload` em `event-payloads.ts`

### Step 2.2: Padronizar payload de `analysis.complete`

**Ficheiro:** `src/commands/status.ts`

- Alinhar payload com `AnalysisCompletePayload` de `event-payloads.ts`
- Usar campos: `{ projectId, maturityScore, dimensions, recommendations }`

### Step 2.3: Adicionar eventos ao comando init

**Ficheiro:** `src/commands/init.ts`

- Importar `getEventBus`
- Publicar `asset.created` para cada ficheiro scaffolding
- Publicar `capability.installed` quando capabilities são instaladas
- Publicar `maturity.changed` com score inicial calculado
- Publicar `validation.completed` com resultado da validação pós-init

**Verificação:** `shiten init` gera eventos em `events-*.jsonl`

---

## Fase 3: Alimentar Event Bus com Eventos Significativos

**Porquê:** Os comandos publicam alguns eventos, mas com payloads incompletos ou inconsistentes.

### Step 3.1: Enriquecer eventos existentes

| Comando | Evento | Campos a adicionar |
|---|---|---|
| `audit` | `health.checked` | `status: "healthy"\|"degraded"\|"critical"` |
| `validate` | `validation.completed` | `passed: boolean`, `issues: string[]` |
| `detect` | `pattern.detected` | `patternType`, `confidence` |
| `assess` | `maturity.changed` | `previousScore`, `newScore`, `delta` |
| `upgrade` | `capability.installed` | `capabilityName`, `version` |

### Step 3.2: Adicionar eventos ao pipeline

**Ficheiro:** `src/pipeline.ts`

- Após cada estágio, publicar evento específico:
  - `pattern_detected` após pattern_detection
  - `knowledge_debt.detected` após knowledge_debt
  - `engineering_state.consolidated` após engineering_state

**Verificação:** `shiten run` gera múltiplos eventos específicos

---

## Fase 4: Activar o Rule Engine com Triggers Reais

**Porquê:** As 10 regras default existem mas nunca executam.

### Step 4.1: Alinhar payloads com condições das regras

| Regra | Trigger | Condição | Campo necessário |
|---|---|---|---|
| RULE-003 | `validation_fail` | `failCount > 3` | `failCount` em `validation.completed` |
| RULE-004 | `maturity_change` | `delta > 10` | `delta` em `maturity.changed` |
| RULE-005 | `knowledge_debt_detected` | `gapCount > 0` | `gapCount` em `knowledge_debt.detected` |
| RULE-006 | `pattern_detected` | `patternCount > 0` | `patterns` em `pattern.detected` |
| RULE-007 | `session_start` | `healthScore < 50` | `healthScore` em `session.start` |
| RULE-010 | `session_start` | `knowledgeDebt > 5` | `knowledgeDebt` em `session.start` |

### Step 4.2: Implementar acções que são no-ops

**Ficheiro:** `src/rule-engine.ts`

- `trigger_assessment`: Executar `shiten assess` via `execSync` com `SHITEN_CHILD=1`
- `trigger_health_check`: Executar `shiten doctor` via `execSync` com `SHITEN_CHILD=1`

### Step 4.3: Criar 5 regras reais

**Directório:** `shitenno-go/governance/rules/`

1. **RULE-011**: `health.checked` + `status=critical` → executar `audit` + criar reminder
2. **RULE-012**: `maturity.changed` + `delta > 5` → actualizar `context_buffer.yaml`
3. **RULE-013**: `knowledge_debt.detected` + `gapCount > 3` → criar item no BACKLOG
4. **RULE-014**: `validation.completed` + `passed=false` → criar reminder
5. **RULE-015**: `session.end` → verificar planos activos e emitir aviso

**Verificação:** Logs mostram `executeRules()` a executar

---

## Fase 5: Integrar File Watcher no Fluxo Normal

### Step 5.1: Garantir cleanup do watcher

**Ficheiro:** `bin/shiten.ts`

- Adicionar `process.on('exit', stopWatching)`
- Adicionar `process.on('SIGINT', stopWatching)`

### Step 5.2: Validar integração com Rule Engine

- Modificar `governance/rules/*.json` → rule engine re-avalia

**Verificação:** Log do rule engine mostra re-evaluation

---

## Fase 6: Activar Task Pipeline

### Step 6.1: Inicializar task pipeline no bootstrap

**Ficheiro:** `bin/shiten.ts`

- Importar e chamar `initializeTaskPipeline({ projectRoot, shitenDir })`
- Guardar função de cleanup

### Step 6.2: Validar integração

- `shiten validate` → `validation.completed` → task pipeline processa
- `context_buffer.yaml` actualizado

---

## Fase 7: Plugin Funcional (Prova de Conceito)

### Step 7.1: Criar plugin "health-monitor"

**Directório:** `shitenno-go/plugins/health-monitor/plugin.js`

- Hook `post-analysis`: log de análise completada
- Hook `custom-check`: verificação de saúde adicional

### Step 7.2: Criar plugin "event-logger"

**Directório:** `shitenno-go/plugins/event-logger/plugin.js`

- Hook `custom-metric`: registar métricas de cada comando
- Output: `shitenno-go/telemetry/plugin-metrics.jsonl`

**Verificação:** Comandos geram dados em `plugin-metrics.jsonl`

---

## Fase 8: Validação e Limpeza

### Step 8.1: Limpar sessões legacy
- Manter últimas 10 sessões válidas em `sessions.jsonl`

### Step 8.2: Executar suite completa
```bash
pnpm run test && pnpm run lint && pnpm run build
```

### Step 8.3: Actualizar documentação
- `BACKLOG.md`: mover itens resolvidos
- `context_buffer.yaml`: estado final

### Step 8.4: Teste end-to-end
1. `shiten init` → eventos publicados
2. `shiten status` → `analysis.complete` + `command.completed`
3. `shiten audit` → `health.checked` + regras executadas
4. `shiten validate` → `validation.completed` + task pipeline
5. Modificar ficheiro → file watcher detecta
6. `sessions.jsonl` com dados reais
7. `events-*.jsonl` com variedade de eventos

---

## Mapa de Ficheiros

| Ficheiro | Fase | Mudança |
|---|---|---|
| `src/session-tracker.ts` | 1 | Race condition fix, append-only |
| `bin/shiten.ts` | 1,5,6 | Duration, watcher cleanup, task pipeline init |
| `src/cli-middleware.ts` | 2 | `command.completed` em vez de `analysis.complete` |
| `src/event-bus.ts` | 2 | Adicionar `command.completed` type |
| `src/event-payloads.ts` | 2 | Adicionar `CommandCompletedPayload` |
| `src/commands/init.ts` | 2 | Publicar eventos |
| `src/commands/status.ts` | 2 | Padronizar payload |
| `src/commands/feedback.ts` | 1 | Activar trackFeedback |
| `src/commands/audit.ts` | 3 | Enriquecer health.checked |
| `src/commands/validate.ts` | 3 | Enriquecer validation.completed |
| `src/commands/detect.ts` | 3 | Enriquecer pattern.detected |
| `src/pipeline.ts` | 3 | Eventos por estágio |
| `src/rule-engine.ts` | 4 | Acções reais, regras novas |
| `shitenno-go/governance/rules/` | 4 | 5 regras novas |
| `shitenno-go/plugins/` | 7 | 2 plugins |

---

## Ordem de Execução

```
Fase 1 (Session) ──► Fase 2 (Separar eventos) ──► Fase 3 (Enriquecer)
                                                        │
                                                        ▼
Fase 7 (Plugins) ◄── Fase 6 (Task Pipeline) ◄── Fase 4 (Rule Engine) ◄── Fase 5 (Watcher)
                                                        │
                                                        ▼
                                                  Fase 8 (Validação)
```

---

*Plano criado: 2026-07-07 | Última actualização: 2026-07-07*
