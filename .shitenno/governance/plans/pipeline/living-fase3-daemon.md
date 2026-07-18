# Pipeline: Shugo Living — Fase 3 (Daemon Opt-In)

**Status:** Pending
**Date:** 2026-07-11
**Plan:** 2026-07-11-shitenno-living-plano-v2-3fases
**Phase:** 3
**Owner:** ambos
**Execucoes_humano:** 0
**Execucoes_agente:** 0
**Updated_at:** 2026-07-11T00:00:00.000Z

---

## 1. Pré-requisitos

| # | Item | Estado |
|---|---|---|
| P1 | Fase 1 validada (cache cross-process estável) | pendente |
| P2 | Fase 2 validada (git hooks estáveis alguns dias) | pendente |
| P3 | Bounded collections implementadas (LIVING-004) | pendente |
| P4 | src/daemon.ts, daemon-client.ts, daemon-circuit-breaker.ts criados | pendente |
| P5 | src/commands/daemon.ts criado (start/stop/status/restart) | pendente |

## 2. Roteiro de Execução

### Para humano (passo a passo)

1. Correr `shugo daemon start` — daemon deve arrancar e ficar activo
2. Correr `shugo daemon status` — deve mostrar PID e estado "running"
3. Correr `shugo status` — deve responder via socket IPC (mais rápido)
4. Correr `shugo daemon stop` — daemon deve encerrar limpo
5. Verificar que ficheiros temporários (PID, socket) foram removidos
6. Correr `shugo daemon start` 3x seguidas com crash forçado — circuit breaker deve desistir
7. Correr `shugo daemon start` com `SHITENNO_NO_DAEMON=1` — não deve arrancar daemon
8. Correr `shugo daemon start` com `CI=true` — não deve arrancar daemon

### Para agente IA (comandos)

1. `npx vitest run src/__tests__/daemon.test.ts` — testes do lifecycle
2. `npx vitest run src/__tests__/daemon-client.test.ts` — testes do client IPC
3. `npx tsc --noEmit src/daemon.ts src/daemon-client.ts src/daemon-circuit-breaker.ts` — zero erros
4. `stat -c %a shitenno/daemon/daemon.sock` — confirmar permissão 0600
5. `grep -n "chmod.*0600" src/daemon.ts` — confirmar chmod no código
6. `grep -n "SHITENNO_NO_DAEMON" src/daemon-client.ts` — confirmar detecção de env var
7. `grep -n "CI=true" src/daemon-client.ts` — confirmar detecção de CI

## 3. Checklists de Validação

| # | Cenário | Acção | Esperado | Estado |
|---|---|---|---|---|
| C1 | Daemon arranca | `shugo daemon start` | PID gravado, estado "running" | pendente |
| C2 | Daemon responde | `shugo daemon status` | Output com PID e uptime | pendente |
| C3 | Socket permissions | `stat -c %a daemon.sock` | `0600` | pendente |
| C4 | Circuit breaker funciona | Simular N crashes consecutivos | Daemon desiste após N tentativas | pendente |
| C5 | Handshake de versão | Conectar com versão diferente | Rejeitado com erro claro | pendente |
| C6 | SHITENNO_NO_DAEMON=1 | Correr com env var | Nenhum daemon spawnado | pendente |
| C7 | CI=true | Correr com CI=true | Nenhum daemon spawnado | pendente |
| C8 | SIGTERM cleanup | Enviar SIGTERM ao daemon | PID + socket removidos | pendente |
| C9 | Memória limitada | Script de carga (X horas de eventos) | Caps de memória não ultrapassados | pendente |
| C10 | checkAndArchiveDonePlans contínuo | Modificar plano para Status: Done | Arquivado via plan.file_changed | pendente |

## 4. Comandos de Execução

```bash
npx vitest run src/__tests__/daemon.test.ts src/__tests__/daemon-client.test.ts \
  && npx tsc --noEmit src/daemon.ts src/daemon-client.ts src/daemon-circuit-breaker.ts \
  && shugo pipeline notify living-fase3-daemon --event "phase_complete"
```

## 5. Resultado

| Métrica | Valor |
|---|---|
| Total de cenários | 10 |
| Passaram | 0 |
| Falharam | 0 |
| Taxa de sucesso | 0% |
| Execuções (humano) | 0 |
| Execuções (agente) | 0 |

**Decisão:** PENDENTE

**Notas:**
