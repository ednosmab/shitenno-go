# Plano de Ação (Revisado) — Resiliência do Sistema Shitenno-go

**Status:** Done
**Updated_at:** 2026-07-17T05:55:00.000Z
**Date:** 2026-07-17

**Data:** 2026-07-16
**Substitui:** PLAN-2026-07-16-system-resilience.md (versão original)
**Base:** REPORT-2026-07-16-honest-project-assessment.md + auditoria de código real feita antes deste plano
**Regra para o agente:** antes de codificar qualquer item, executar a verificação indicada em "Checar antes". Vários itens do plano original propunham recriar código que já existe — cada item abaixo já veio filtrado por essa verificação, mas o agente deve confirmar de novo no momento da execução, porque o código pode ter mudado desde 2026-07-16.

---


## Checklist

- [ ] `grep -rn "watcher.on(\"error\"" src/infrastructure/persistence/file-watcher.ts` — confirmar se error recovery ainda está lá e funcional
- [ ] `grep -n "case \"query_health\"" src/daemon.ts` — confirmar assinatura de retorno atual
- [ ] `grep -rn "publish(\"session.start\"\|publish(\"session.end\"\|publish(\"plan.status_changed\"" src --include="*.ts"` (excluindo `*.test.ts`) — confirmar que continuam sem publisher real
- [ ] Rodar `npm run typecheck` e `npm test` para ter uma baseline limpa antes de começar

## O que mudou em relação ao plano original

| Item do plano original | Estado real no código | Ação neste plano revisto |
|---|---|---|
| 1.1 Publicar `plan.inconsistency_detected` | Não publicado (confirmado) | Mantido, é necessário |
| 1.2 Health check endpoint (`query_health_detailed`) | `query_health` já existe em `daemon.ts` ~linha 661 | Reduzido: enriquecer o existente, não criar do zero |
| 1.3 Error recovery no file watcher | **Já implementado** em `src/infrastructure/persistence/file-watcher.ts` (linhas 103-122): `MAX_RESTARTS=5`, backoff exponencial, publish de `watcher.error` | **Removido do plano** — não fazer, risco de duplicar/quebrar lógica existente |
| 1.4 `session.start`/`session.end` corrigidos hoje | **Falso.** Só existem em ficheiros de teste, nunca publicados em produção | Adicionado como item novo e real (ver Fase 1.3 abaixo) |
| `plan.status_changed` corrigido hoje | **Falso.** Subscrito em `proactive-engine.ts:131`, nunca publicado | Adicionado como item novo e real |
| 3.1/3.2 CLI mostra health/challenges | Backend (`query_health`, `query_challenges`) já existe; falta só o consumo em `status.ts` | Mantido, mas escopo menor (é só consumo, não criação de endpoint) |
| 4.2 Graceful degradation | Padrão daemon-first/disk-fallback já existe para briefing em `status.ts` linhas ~169-180 | Reduzido: generalizar o padrão existente, não criar do zero |
| Ordem de execução (daemon.ts editado em 4 momentos diferentes) | Risco de patches ficarem obsoletos se o split (Fase 2) rodar depois dos patches pontuais | Reordenado: split primeiro, patches depois |

**Orçamento revisado: 7-10 dias** (original estimava 9-15 dias sobre trabalho que em parte já existia).

---

## FASE 0: Verificação Pré-Execução (2h, bloqueante)

Antes de tocar em qualquer código, o agente deve confirmar o estado atual destes pontos (o código pode já ter mudado):

- [ ] `grep -rn "watcher.on(\"error\"" src/infrastructure/persistence/file-watcher.ts` — confirmar se error recovery ainda está lá e funcional
- [ ] `grep -n "case \"query_health\"" src/daemon.ts` — confirmar assinatura de retorno atual
- [ ] `grep -rn "publish(\"session.start\"\|publish(\"session.end\"\|publish(\"plan.status_changed\"" src --include="*.ts"` (excluindo `*.test.ts`) — confirmar que continuam sem publisher real
- [ ] Rodar `npm run typecheck` e `npm test` para ter uma baseline limpa antes de começar

Se qualquer verificação divergir do esperado, **parar e reportar antes de prosseguir** — não assumir que o plano está desatualizado ou que o código está errado.

---

## FASE 1: Estabilizar o Event Bus (1 dia)

### 1.1 Publicar `plan.inconsistency_detected`
**Ficheiro:** `src/daemon.ts`, função `checkInconsistencies` (~linha 820)

```typescript
function checkInconsistencies(shitenDir: string): { checked: number; inconsistencies: number; planIds: string[] } {
  const inferenceEngine = new InferenceEngine(shitenDir);
  const allInferences = inferenceEngine.inferAllPlans();
  const inconsistent = allInferences.filter((inf) => inf.inferredStatus === "inconsistent");
  const planIds = inconsistent.map((inf) => inf.id);

  if (inconsistent.length > 0) {
    logger.warn("daemon", `Found ${inconsistent.length} inconsistent plan(s): ${planIds.join(", ")}`);

    const bus = getEventBus();
    for (const inf of inconsistent) {
      bus.publish("plan.inconsistency_detected", {
        planId: inf.id,
        message: `Plan "${inf.title}" has status="${inf.rawStatus}" but inferred="${inf.inferredStatus}"`,
      });
    }
  }

  return { checked: allInferences.length, inconsistencies: inconsistent.length, planIds };
}
```

**Critério de aceite:** teste que dispara uma inconsistência de plano e verifica que o subscriber em `daemon.ts:458` recebe o evento.

### 1.2 Publicar `session.start` / `session.end` de facto
**Checar antes:** onde a sessão CLI/daemon começa e termina hoje (candidatos: `session-tracker.ts`, `session-context.ts`, `close-session.ts`). Estes ficheiros hoje só manipulam `session.startedAt`/`session.endedAt` como dados, sem publicar eventos.

**Ação:** no ponto onde uma sessão é criada/encerrada (ex.: `session-tracker.ts`), publicar:

```typescript
bus.publish("session.start", { sessionId, projectRoot });
// ...
bus.publish("session.end", { sessionId, duration, outcome });
```

**Critério de aceite:** `daemon.ts` (que já subscreve estes eventos) passa a receber e registar sessões reais, não só em testes.

### 1.3 Publicar `plan.status_changed` de facto
**Ficheiro provável:** onde o status de um plano é alterado (procurar por `rawStatus`, `inferredStatus`, ou lógica de mudança de estado de planos — possivelmente `markdown-plan-engine.ts` ou o comando `plan.ts`).

**Ação:** publicar o evento no ponto de mudança de status, com payload compatível com `PlanStatusChangedPayload` (já definido em `event-payloads.ts:397`).

**Critério de aceite:** `proactive-engine.ts:131` (`onPlanStatusChanged`) recebe o evento em cenário real, não só em teste.

### 1.4 Enriquecer `query_health` (não criar `query_health_detailed`)
**Ficheiro:** `src/daemon.ts`, case `"query_health"` (~linha 661)

Adicionar campos ao payload existente em vez de criar um novo case:

```typescript
case "query_health": {
  const prev = state.health;
  let trend: "stable" | "improving" | "degrading" | "unknown" = "unknown";
  if (prev) {
    trend = prev.score >= 70 ? "stable" : prev.score >= 40 ? "degrading" : "unknown";
  }
  const uptimeSeconds = Math.round((Date.now() - startedAt) / 1000);
  sendJson(socket, {
    type: "health",
    score: state.health?.score ?? null,
    checkedAt: state.health?.checkedAt ?? null,
    trend,
    uptimeSeconds,
    pid: process.pid,
    activeSessions: state.sessions.filter((s) => !s.endedAt).length,
  });
  break;
}
```

**Critério de aceite:** resposta de `query_health` inclui os campos novos sem quebrar consumidores existentes (checar se algum código já espera só `{score, checkedAt, trend}`).

---

## FASE 2: Desfragmentar God Modules (3-4 dias)

**Fazer esta fase antes de qualquer outro patch pontual em `daemon.ts` ou `commands/audit.ts`**, para que os patches das Fases 1, 3 e 4 sejam aplicados nos módulos já divididos, não no ficheiro monolítico.

### 2.1 Split `daemon.ts` (985 linhas → módulos)

```
src/daemon/
├── index.ts          ← runDaemon() + shutdown, entry point (~200 linhas)
├── ipc.ts             ← handleMessage + sendJson + todos os "case query_*" (~350 linhas)
├── state.ts           ← DaemonState + createDaemonState + persistState + loadState (~150 linhas)
└── startup-scan.ts    ← checkInconsistencies + validateReminders + moveCompletedBacklogToDone (~280 linhas)

src/daemon.ts          ← re-export: export { runDaemon } from "./daemon/index.js"
```

**Critério de aceite:** `npm run typecheck` e `npm test` passam sem alteração de comportamento; nenhum import externo quebra (checar quem importa de `src/daemon.ts` hoje).

### 2.2 Split `commands/audit.ts` (750 linhas → módulos)

```
src/commands/audit/
├── index.ts     ← definição do comando (~100 linhas)
├── runner.ts    ← execução do audit (~300 linhas)
└── reporter.ts  ← formatação de output (~350 linhas)

src/commands/audit.ts ← re-export
```

**Critério de aceite:** mesmo output de `shiten audit` antes/depois do split, validado por snapshot test.

### 2.3 `AuditContext` para IO centralizado dos detectores
Criar `src/audit/audit-context.ts` com leitura única de `package.json`, `tsconfig.json`, lista de source files, flags de git/CI — e passar isto para os ~177 detectores em vez de cada um fazer IO próprio.

**Critério de aceite:** medir tempo de `shiten audit --level enterprise` antes/depois — deve reduzir por eliminar leituras de disco duplicadas.

---

## FASE 3: Ligar CLI ↔ Daemon (1-1.5 dia)

O backend (`query_health`, `query_challenges`) já existe — este trabalho é só sobre o CLI consumir o que já está lá.

### 3.1 `status.ts` mostra health do daemon
```typescript
import { queryDaemon, isDaemonRunning } from "../daemon-client.js";

if (isDaemonRunning(ctx.shitenDir)) {
  const health = await queryDaemon(ctx.shitenDir, { type: "query_health" });
  if (health) {
    output(chalk.bold("  🔍 Daemon Health:"));
    output(`    Score: ${health.score ?? "N/A"}  Trend: ${health.trend}`);
    output(`    Uptime: ${Math.round((health.uptimeSeconds ?? 0) / 60)}min`);
  }
}
```

### 3.2 `status.ts` mostra challenges pendentes
```typescript
if (isDaemonRunning(ctx.shitenDir)) {
  const result = await queryDaemon(ctx.shitenDir, { type: "query_challenges" });
  if (result?.challenges?.length) {
    output(chalk.bold("  🎯 Pending Challenges:"));
    for (const c of result.challenges.slice(0, 5)) {
      output(`    ${c.severity === "high" ? "🔴" : c.severity === "medium" ? "🟡" : "🔵"} ${c.message}`);
    }
  }
}
```

**Critério de aceite:** `shiten status` com daemon rodando mostra health + challenges reais; sem daemon, não quebra (só omite a secção).

---

## FASE 4: Tornar o Daemon Resiliente (1.5-2 dias)

(Excluído: error recovery do file watcher — já existe, ver Fase 0.)

### 4.1 Async startup scan
No `daemon/index.ts` (pós-split da Fase 2), mover o startup scan síncrono para `setImmediate`, publicando `daemon.ready` ao terminar. Mesma lógica já detalhada no plano original — mantida sem alteração porque é um gap real.

### 4.2 Generalizar o padrão de graceful degradation já existente
Hoje `status.ts` já faz daemon-first/disk-fallback só para `query_briefing`. Extrair esse padrão para um helper reutilizável:

```typescript
// src/daemon-client.ts
export async function queryDaemonWithFallback<T>(
  shitenDir: string,
  message: IpcMessage,
  fallback: () => T
): Promise<T> {
  try {
    if (!isDaemonRunning(shitenDir)) return fallback();
    const response = await queryDaemon(shitenDir, message);
    return (response as T) ?? fallback();
  } catch {
    return fallback();
  }
}
```

Aplicar este helper também para health e challenges (Fase 3.1/3.2), não só para briefing.

### 4.3 Daemon restart automático
Mantido como no plano original (`daemon-restart.ts` com `MAX_RESTARTS`, spawn detached). É um gap real — não existe hoje.

---

## FASE 5: Simplificar a UX (1.5-2 dias)

Mantida como no plano original, sem alterações — é a parte mais sólida e não teve nenhuma alegação contraditada pelo código:

- 5.1 Modo interativo (`shiten` sem argumentos)
- 5.2 Output padrão só critical+warning, `--verbose` para info
- 5.3 Agrupar 37 comandos em ~15

---

## Sequenciamento Correto

```
DIA 1:  Fase 0 (verificação) + Fase 1 completa (event bus)
DIA 2-4: Fase 2 (split daemon.ts, audit.ts, AuditContext) — nesta ordem, antes de qualquer patch pontual adicional
DIA 5:  Fase 3 (CLI ↔ Daemon)
DIA 6-7: Fase 4 (resiliência do daemon)
DIA 8-9: Fase 5 (UX)
DIA 10: Buffer para testes de regressão e ajustes
```

**Regra de ouro para o agente:** se em qualquer fase um item deste plano contradisser o que o código realmente mostra, parar e reportar a divergência antes de codificar — não assumir que o plano está certo por padrão.

---

## Métricas de Sucesso (mesmas do plano original, mantidas)

| Métrica | Antes | Depois |
|---|---|---|
| Eventos subscritos sem publisher real | 3 (`plan.status_changed`, `plan.inconsistency_detected`, `session.start/end`) | 0 |
| Ficheiros >400 linhas | 36 | <15 |
| Comandos CLI | 37 | ~15 |
| `daemon.ts` maior ficheiro | 985 linhas | dividido em 4 módulos <350 linhas cada |
| CLI consome health/challenges do daemon | Não | Sim |
| Daemon restart automático | Não existe | Funcional |
| Startup scan bloqueante | Sim (síncrono) | Não (async) |

---

*Revisão baseada em auditoria direta do código-fonte, não apenas no relatório original.*
