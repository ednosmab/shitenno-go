# Plano de Ação — Arbitragem de Autoridade entre CLI e Daemon

**Status:** Done
**Updated_at:** 2026-07-17T06:49:03.378Z
**Date:** 2026-07-17

**Data:** 2026-07-16
**Contexto:** achado durante a discussão dos três planos anteriores — o daemon tem um motor de decisão autônomo (`rule-engine` + `proactive-engine`), o CLI tem outro (`decision-engine`, `action-engine`, `recommendation-engine`, `auto-evolution`, `feedback-loops`), e eles nunca se coordenam. Nenhum dos três planos anteriores resolve isso; este é o quarto plano, independente dos outros três.
**Objetivo:** não fundir os dois motores em um só, e não desligar nenhum dos dois — estabelecer uma regra explícita de quem tem autoridade para executar o quê, e um mecanismo simples para o daemon saber quando recuar.

---

## Evidência concreta do problema (verificada no código)

### O daemon já executa mutações reais, sozinho, sem checar nada
`src/rule-engine/validation.ts` define os tipos de ação que uma regra pode disparar:
```
update_context_buffer, create_reminder, remove_reminder, update_quick_board,
create_adr, create_skill, log_event, send_notification, trigger_assessment,
trigger_health_check, update_backlog, run_local_script, run_script,
run_shiten_command, update_file, create_file, remove_file,
update_backlog_status, archive_plan, auto_populate_next_p0
```

`run_shiten_command` significa que **uma regra rodando dentro do daemon pode invocar o próprio CLI programaticamente** — o mesmo CLI que tem seu próprio `decision-engine`/`action-engine` computando decisões sob demanda.

**Exemplo real já em produção**, `governance/rules/RULE-016.json`:
```json
{
  "trigger": "task_completed",
  "actions": [{ "type": "update_backlog_status", "params": { "toState": "em validação" } }],
  "enabled": true
}
```
Isso muda o estado de um item de backlog **automaticamente**, sem nenhuma verificação de que um usuário não está, naquele exato momento, com `shiten act` ou `shiten decide` aberto trabalhando no mesmo item.

### O ponto de dispatch não tem nenhum gate hoje
`src/rule-engine/engine.ts`, dentro de `executeRules`, o loop que roda as ações:
```typescript
for (const action of rule.actions) {
  const result = await executeAction(action, context);
  // ...
}
```
Não há checagem de "isso está sendo mexido por outra coisa agora?" em lugar nenhum antes de `executeAction`.

### O CLI tem seu próprio motor de decisão, que nunca é consultado pelo daemon
`decision-engine.ts` (`shiten decide`), `action-engine.ts` (`shiten act`), `recommendation-engine.ts`, `auto-evolution.ts`, `feedback-loops.ts` — chamados só por comandos, nunca pelo daemon. Isso está correto (não devem ser fundidos), mas confirma que existem dois centros de decisão que hoje não sabem da existência um do outro.

---

## Princípio de Design

**Não fundir os dois motores. Classificar as ações por raio de impacto e definir quem tem autoridade sobre cada nível.** Um daemon que reage automaticamente a coisas baratas e reversíveis (log, notificação, health check) é saudável. Um daemon que muda status de backlog, arquiva planos ou roda comandos do CLI **sem saber se um humano está mexendo na mesma coisa agora** é o problema real — não o fato de ele agir sozinho, mas o fato de agir sozinho **sem verificar conflito**.

---

## FASE 1: Classificar Ações por Tier (0.5 dia)

**Ficheiro:** `src/rule-engine/validation.ts` (ou onde `VALID_ACTION_TYPES` estiver após qualquer refactor)

| Tier | Ações | Regra |
|---|---|---|
| **1 — Autônomo, sem gate** | `log_event`, `send_notification`, `trigger_health_check`, `trigger_assessment`, `create_reminder`, `remove_reminder`, `update_context_buffer`, `update_quick_board` | Sempre executa. Baixo impacto, reversível, não colide com decisão humana. |
| **2 — Autônomo com checagem de conflito** | `archive_plan`, `update_backlog_status`, `update_backlog`, `create_adr`, `create_skill`, `create_file`, `auto_populate_next_p0` | Executa **se** o recurso (planId/taskId) não estiver reclamado por uma sessão CLI ativa (ver Fase 2). Se estiver reclamado, adia ou vira challenge. |
| **3 — Nunca autônomo por padrão** | `update_file`, `remove_file`, `run_local_script`, `run_script`, `run_shiten_command` | Por padrão, **nunca executa sozinho** — vira uma proposta (challenge/recomendação) que o usuário confirma via CLI. Só executa de verdade se a regra tiver `"autonomous": true` explícito (opt-in consciente, não default). |

```typescript
export const ACTION_TIER: Record<ActionType, 1 | 2 | 3> = {
  log_event: 1, send_notification: 1, trigger_health_check: 1, trigger_assessment: 1,
  create_reminder: 1, remove_reminder: 1, update_context_buffer: 1, update_quick_board: 1,
  archive_plan: 2, update_backlog_status: 2, update_backlog: 2, create_adr: 2,
  create_skill: 2, create_file: 2, auto_populate_next_p0: 2,
  update_file: 3, remove_file: 3, run_local_script: 3, run_script: 3, run_shiten_command: 3,
};
```

**Critério de aceite:** todo `ActionType` existente tem um tier atribuído (teste que falha se um tipo novo for adicionado a `VALID_ACTION_TYPES` sem entrar em `ACTION_TIER` — evita esquecimento futuro).

---

## FASE 2: Mecanismo de "Reclamar Recurso" (1 dia)

**Reaproveitar `LRUCache` com TTL, já existente em `src/daemon-resources.ts`** — não criar estrutura nova.

### 2.1 Estado do daemon ganha um cache de recursos reclamados
**Ficheiro:** `src/daemon.ts` (ou `daemon/state.ts` pós-split)

```typescript
import { LRUCache } from "./daemon-resources.js";

// TTL curto (ex.: 5min) — se o CLI travar sem liberar, o claim expira sozinho
const claimedResources = new LRUCache<string, { sessionId: string; claimedAt: string }>(200, 5 * 60_000);

function isResourceClaimed(resourceId: string): boolean {
  return claimedResources.has(resourceId);
}
```

### 2.2 Novos eventos: `resource.claimed` / `resource.released`
**Ficheiro:** `src/event-bus.ts` (adicionar aos tipos existentes) e `src/event-payloads.ts`

```typescript
| "resource.claimed"
| "resource.released"
```
```typescript
interface ResourceClaimedPayload { resourceId: string; resourceType: "plan" | "task"; sessionId: string; }
interface ResourceReleasedPayload { resourceId: string; sessionId: string; }
```

Daemon assina os dois:
```typescript
bus.subscribe("resource.claimed", (p) => claimedResources.set(p.resourceId, { sessionId: p.sessionId, claimedAt: new Date().toISOString() }));
bus.subscribe("resource.released", (p) => claimedResources.delete(p.resourceId));
```

### 2.3 CLI publica claim/release em torno de mutações reais
**Ficheiros:** `action-engine.ts` (`shiten act`), `decision-engine.ts` (`shiten decide`), qualquer ponto de `plan-engine.ts` que mude status de plano

```typescript
const bus = getEventBus();
bus.publish("resource.claimed", { resourceId: planId, resourceType: "plan", sessionId });
try {
  // ...lógica existente de act/decide que já muda o plano...
} finally {
  bus.publish("resource.released", { resourceId: planId, sessionId });
}
```

**Nota para o agente:** isso depende de `session.start`/`session.end` já estarem publicados de fato (Fase 1.2/1.3 do PLAN-2026-07-16-system-resilience-REVISADO.md) para que `sessionId` exista de forma consistente — confirmar que aquele plano já rodou antes de começar este.

**Critério de aceite:** rodar `shiten act` num plano, e enquanto ele está em execução, disparar (via teste) um trigger que faria o rule-engine tentar `archive_plan` no mesmo plano — a ação deve ser adiada, não executada.

---

## FASE 3: Gate no Dispatch do Rule Engine (0.5-1 dia)

**Ficheiro:** `src/rule-engine/engine.ts`, dentro de `executeRules`

```typescript
for (const action of rule.actions) {
  const tier = ACTION_TIER[action.type];

  if (tier === 2 && context.isResourceClaimed?.(getResourceIdFromAction(action))) {
    results.push({
      ruleId: rule.id, success: false,
      message: `Deferred: resource claimed by active CLI session`,
      actionsExecuted, duration: Date.now() - startTime,
    });
    // Publicar um challenge em vez de silenciosamente sumir com a ação
    bus.publish("challenge.generated", {
      severity: "low",
      message: `Rule ${rule.id} deferred "${action.type}" — resource is in active use`,
    });
    continue;
  }

  if (tier === 3 && !rule.autonomous) {
    bus.publish("challenge.generated", {
      severity: "medium",
      message: `Rule ${rule.id} proposes "${action.type}" — run 'shiten act' to review and confirm`,
    });
    continue; // não executa — só propõe
  }

  const result = await executeAction(action, context);
  // ...
}
```

`context.isResourceClaimed` é passado de fora (do daemon) para o `RuleContext` — o `rule-engine` em si continua puro/testável sem depender diretamente do daemon.

**Critério de aceite:**
- Uma regra Tier 3 sem `"autonomous": true` nunca executa `update_file`/`remove_file`/`run_shiten_command` diretamente — sempre vira `challenge.generated`.
- Uma regra Tier 2 sobre um recurso reclamado é adiada e visível como challenge, não falha silenciosamente.
- Regras Tier 1 continuam executando exatamente como hoje, sem regressão.

---

## FASE 4: Atualizar Schema e Regras Existentes (0.5 dia)

### 4.1 Schema de regra ganha campo opcional `autonomous`
**Ficheiro:** `governance/rules/RULE-TEMPLATE.json` e validação em `rule-engine/validation.ts`

```json
{
  "id": "RULE-XXX",
  "autonomous": false,
  "...": "..."
}
```
Default `false` quando ausente — **opt-in explícito**, nunca implícito, para ações Tier 3.

### 4.2 Auditar regras existentes que usam ações Tier 2/3
```bash
grep -l '"type": "update_file"\|"type": "remove_file"\|"type": "run_shiten_command"\|"type": "run_script"\|"type": "run_local_script"' shitenno-go/governance/rules/*.json
```
Para cada uma encontrada: decidir conscientemente se `autonomous: true` é realmente pretendido (documentar o motivo no próprio arquivo da regra) ou se deve virar proposta (deixar `autonomous` ausente/false).

**Critério de aceite:** nenhuma regra Tier 3 tem execução autônoma "por acidente" — toda ocorrência de `autonomous: true` tem uma justificativa explícita registrada.

---

## Sequenciamento e Dependências

```
Depende de: PLAN-2026-07-16-system-resilience-REVISADO.md, Fase 1.2/1.3
            (session.start/session.end publicados de fato — sem isso, sessionId não existe pra "reclamar" nada)

DIA 1:   Fase 1 (classificar tiers)
DIA 2:   Fase 2 (mecanismo de claim, reusando LRUCache existente)
DIA 3:   Fase 3 (gate no dispatch)
DIA 3.5: Fase 4 (schema + auditoria das regras existentes)
```

**Total: ~3.5-4 dias.** Pode rodar em paralelo ao PLAN-2026-07-16-daemon-full-integration.md (Fases 6-9), já que mexem em partes diferentes do sistema (aquele é CLI↔daemon *comunicação*, este é *autoridade*) — só não pode rodar antes de Fase 1.2/1.3 do plano de resiliência.

---

## Fora de Escopo (deliberadamente)

- **Lock distribuído/multi-máquina:** o daemon é local, single-host — um `LRUCache` em memória com TTL é suficiente. Não introduzir Redis ou similar para isto.
- **Fundir os dois motores de decisão num só:** rejeitado por design — CLI decide coisas que exigem julgamento humano (`decide`, `act`), daemon reage a coisas baratas e óbvias. A fronteira certa é de autoridade, não de código.
- **Desativar o daemon.rule-engine:** ele continua rodando exatamente como hoje para ações Tier 1; o gate só entra em cena para Tier 2/3.

---

## Métricas de Sucesso

| Métrica | Antes | Depois |
|---|---|---|
| Ações Tier 3 executáveis sem confirmação humana | Todas (`update_file`, `run_shiten_command`, etc.) | Nenhuma, exceto opt-in explícito por regra |
| Checagem de conflito antes de mutação autônoma (Tier 2) | Nenhuma | Via `claimedResources` (TTL 5min) |
| Visibilidade de ações adiadas/propostas | Nenhuma (silenciosas ou executadas sem aviso) | Sempre via `challenge.generated` |
| Regras com execução autônoma de alto impacto | Não rastreado | Auditado e justificado explicitamente |
