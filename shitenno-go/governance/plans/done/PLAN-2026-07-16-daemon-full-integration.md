# Plano de Ação — Integração Total CLI ↔ Daemon

**Status:** Done
**Updated_at:** 2026-07-17T05:55:00.000Z
**Date:** 2026-07-17

**Data:** 2026-07-16
**Pré-requisito:** executar PLAN-2026-07-16-system-resilience-REVISADO.md (Fases 0-5) primeiro — em especial a Fase 2 (split de `daemon.ts`), porque todo o trabalho abaixo mexe no daemon e deve ser feito nos módulos já divididos, não no monólito.
**Escopo:** fechar os gaps de integração encontrados por auditoria direta de código, não hipotéticos.

---

## Achados que motivam este plano (verificados no código)

| # | Achado | Evidência |
|---|---|---|
| 1 | Dois file-watchers independentes e redundantes | `commands/watch.ts:13` importa `../file-watcher.js` (legado, sem error handling); `daemon.ts` importa `infrastructure/persistence/file-watcher.js` (com recovery) |
| 2 | `command.completed` publicado, zero subscribers | `cli-middleware.ts:116` publica; nenhum `subscribe("command.completed"...)` em todo o repo |
| 3 | Só 4/37 comandos são daemon-aware | `status.ts`, `briefing.ts`, `context.ts`, `daemon.ts` — os outros 33 nunca chamam `isDaemonRunning`/`queryDaemon` |
| 4 | `query_events` é snapshot, não streaming | `daemon.ts:654` retorna `state.events.slice(-limit)` sob demanda; não existe push em tempo real |

---

## FASE 6: Matar `shiten watch` e Criar `shiten daemon logs` (1 dia)

**Decisão:** em vez de manter `watch` vivo como cliente do daemon, o comando é **removido**. O daemon continua operando exatamente como hoje — sobe detached via `shiten daemon start`, libera o terminal, roda em background. O que passa a existir é um comando **novo e separado**, `shiten daemon logs`, que só se acopla ao daemon já em execução para exibir o log em tempo real. Fechar esse comando (Ctrl+C) não para o daemon — ele é um espectador, não um processo de vida do daemon.

### 6.1 Remover `shiten watch` e o watcher legado

**Apagar:**
- `src/commands/watch.ts`
- `src/file-watcher.ts` (watcher legado, sem error recovery — usado só por `watch.ts`)
- `src/__tests__/file-watcher.test.ts` (ou migrar os testes relevantes para cobrir `infrastructure/persistence/file-watcher.ts`, que é o watcher real usado pelo daemon)

**Remover registro do comando em `bin/shiten.ts`:**
```typescript
// REMOVER estas duas linhas:
import { watchCommand } from "../src/commands/watch.js";
// ...
program.addCommand(watchCommand());
```

**Confirmar que nada mais importa o watcher legado:**
```bash
grep -rln 'from "\./file-watcher.js"\|from "\.\./file-watcher.js"' src --include="*.ts" | grep -v test
```
Deve retornar vazio depois da remoção — o único watcher do sistema passa a ser `infrastructure/persistence/file-watcher.ts`, já usado pelo daemon.

**Atualizar documentação que referencia `shiten watch`:**
- `docs/handbook/02-commands/watch.md` — remover ou marcar como removido em favor de `shiten daemon logs`
- `docs/handbook/02-commands/system.md`, `docs/handbook/01-fundamentals/quick-start.md`, `docs/reference/cli.md` — remover menções a `shiten watch`
- `CHANGELOG.md` — registrar a remoção como breaking change (é remoção de comando público)
- Não mexer nos planos arquivados em `governance/plans/done/*watch*` — são histórico, não documentação viva

### 6.2 Novo comando `shiten daemon logs`

Adicionar como subcomando do grupo `daemon` já existente (`src/commands/daemon.ts`), ao lado de `start`/`stop`/`status`/`restart` — não como comando top-level novo, para não repetir o problema de comandos soltos que o plano anterior já identificou (Fase 5, redução de 37→~15 comandos).

**Ficheiro:** `src/commands/daemon.ts`

```typescript
import { getPaths } from "../daemon-client.js"; // expor getPaths (ou getLogPath dedicado) se ainda não for exportado
import { createReadStream, existsSync, statSync, watchFile, unwatchFile } from "node:fs";
import { readline } from "node:readline"; // ou leitura manual por chunk, ver nota abaixo

cmd.command("logs")
  .description("Attach to the running daemon and stream its log in real time")
  .option("--lines <n>", "Number of historical lines to show before following", "50")
  .action(async (opts: Record<string, unknown>) => {
    const ctx = guardNotInitialized(opts, false);
    if (!ctx) return;

    if (!isDaemonRunning(ctx.shitenDir)) {
      output(chalk.yellow("  ℹ  Daemon is not running — nothing to attach to."));
      output(chalk.gray("     Start it with: shiten daemon start"));
      return;
    }

    const logPath = getDaemonLogPath(ctx.shitenDir); // wrapper em torno de getPaths().logPath
    if (!existsSync(logPath)) {
      output(chalk.yellow(`  ℹ  Log file not found yet at ${logPath}`));
      return;
    }

    output(chalk.gray(`  Attached to daemon log (${logPath}) — Ctrl+C to detach (daemon keeps running)`));
    outputBlank();

    // Mostrar as últimas N linhas primeiro
    printTail(logPath, Number(opts.lines) || 50);

    // Seguir o arquivo em tempo real (append-only, sem rotação hoje)
    let lastSize = statSync(logPath).size;
    const stream = () => {
      const { size } = statSync(logPath);
      if (size > lastSize) {
        const rs = createReadStream(logPath, { start: lastSize, end: size });
        rs.on("data", (chunk) => process.stdout.write(colorizeLogLine(chunk.toString())));
        lastSize = size;
      } else if (size < lastSize) {
        // arquivo foi truncado/rotacionado externamente — reiniciar do começo
        lastSize = 0;
      }
    };
    watchFile(logPath, { interval: 300 }, stream);

    process.on("SIGINT", () => {
      unwatchFile(logPath, stream);
      output(chalk.gray("\n  Detached (daemon continues running in background)."));
      process.exit(0);
    });
  });
```

**Notas de implementação para o agente:**
- Não usar `chokidar` aqui — é um único arquivo append-only, `fs.watchFile` com polling curto (300ms) é suficiente e mais simples que subir uma dependência extra para isso.
- `colorizeLogLine`: função pequena que colore por nível (`[ERROR]` vermelho, `[WARN]` amarelo, `[INFO]` padrão), reaproveitando o padrão de cores já usado em `status.ts`/`daemon.ts` (chalk).
- `printTail`: helper simples que lê o arquivo inteiro (ou só os últimos ~64KB) e imprime as últimas N linhas — não precisa ser sofisticado, o log não é gigante hoje.
- **Gap relacionado, fora de escopo desta fase mas vale registrar:** `daemon.log` não tem rotação (`daemonLog` só faz `appendFileSync`, sem limite de tamanho). Isso não impede o comando `logs` de funcionar, mas é uma dívida real — se quiser, adicionar como item futuro (rotação por tamanho ou por data) num plano separado, não aqui, para não misturar escopo.

**Critério de aceite:**
- `shiten daemon start` continua subindo o daemon detached, terminal livre, sem nenhuma mudança de comportamento.
- `shiten daemon logs` com daemon ativo mostra as últimas linhas e depois segue em tempo real qualquer nova linha escrita por `daemonLog`.
- `shiten daemon logs` com daemon parado mostra mensagem clara e não trava o terminal.
- Ctrl+C em `shiten daemon logs` encerra só o comando — `shiten daemon status` logo depois confirma que o daemon continua rodando.
- `shiten watch` não existe mais (`shiten watch` retorna erro de comando desconhecido do commander, comportamento padrão).

---

## FASE 7: Fechar o Loop `command.completed` (0.5 dia)

**Objetivo:** o daemon efetivamente reage a comandos executados, em vez de o evento morrer no vazio.

### 7.1 Daemon assina `command.completed`
**Ficheiro:** `src/daemon/ipc.ts` (pós-split da Fase 2) ou `daemon.ts` se a Fase 2 ainda não rodou

```typescript
bus.subscribe("command.completed", (payload) => {
  recordEvent(state, "command.completed");
  // Ajusta o intervalo de audit adaptativo com base na atividade real do usuário
  state.lastCommandAt = new Date().toISOString();
  state.lastCommandName = payload.command ?? null;
});
```

Verificar o shape real do payload publicado em `cli-middleware.ts:116` antes de assumir os campos (`payload.command`, `payload.durationMs`, etc.) — o agente deve olhar a definição em `event-payloads.ts` para o tipo correto.

### 7.2 `query_health` reflete atividade recente
Adicionar ao case `query_health` (já enriquecido na Fase 1.4 do plano anterior):
```typescript
lastCommand: state.lastCommandName ?? null,
lastCommandAt: state.lastCommandAt ?? null,
```

**Critério de aceite:** rodar qualquer comando CLI com o daemon ativo, depois `shiten status` (ou `query_health` via socket) mostra o último comando executado.

---

## FASE 8 (opcional, futura): Streaming Real de Eventos via IPC

**Nota:** com a Fase 6 resolvida (tail do `daemon.log`), a necessidade imediata de "ver o daemon em tempo real" já está coberta sem esta fase. Esta fase só faz sentido se, no futuro, for preciso consumir eventos estruturados (tipo + payload) em vez de linhas de texto de log — por exemplo, para alimentar um dashboard ou outra automação, não para visualização humana no terminal. Tratar como backlog, não como parte obrigatória deste plano.

**Objetivo (se ativada):** substituir o polling de `query_events` por push real via o socket IPC já existente (não é preciso HTTP/SSE — o IPC já é um socket Unix).

### 8.1 Novo case `subscribe_events`
**Ficheiro:** `src/daemon/ipc.ts`

```typescript
case "subscribe_events": {
  const limit = Math.min(Number(msg.limit) || 10, MAX_EVENTS);
  sendJson(socket, { type: "events_snapshot", events: state.events.slice(-limit) });

  const relevantTypes: ShitenEventType[] = [
    "health.checked", "challenge.generated", "plan.status_changed",
    "backlog.updated", "command.completed", "watcher.error",
  ];
  const unsubs = relevantTypes.map((t) =>
    bus.subscribe(t, (payload) => {
      sendJson(socket, { type: "event", eventType: t, payload, timestamp: new Date().toISOString() });
    })
  );

  socket.on("close", () => { for (const u of unsubs) u(); });
  break;
}
```

### 8.2 Cliente CLI para consumir o stream
**Ficheiro:** `src/daemon-client.ts` — nova função `subscribeToDaemon`

```typescript
export function subscribeToDaemon(
  shitenDir: string,
  onEvent: (event: { eventType: string; payload: unknown; timestamp: string }) => void
): () => void {
  const socket = createConnection(getSocketPath(shitenDir));
  socket.write(JSON.stringify({ type: "subscribe_events", limit: 10 }) + "\n");
  let buffer = "";
  socket.on("data", (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const msg = JSON.parse(line);
      if (msg.type === "event") onEvent(msg);
    }
  });
  return () => socket.end();
}
```

Usar isto na Fase 6.2 (`streamFromDaemon`) para `shiten watch`.

**Critério de aceite:** com o daemon ativo, rodar `shiten watch` em um terminal e disparar uma mudança de plano em outro — o evento aparece no `watch` sem polling.

---

## FASE 9: Enriquecimento Daemon-Aware nos Comandos de Leitura (1.5-2 dias)

**Objetivo:** comandos de leitura pesada mostram uma linha extra de contexto vindo do daemon, sem mudar o núcleo do que já computam em disco (evitar regressão de comportamento).

**Comandos alvo (leitura/diagnóstico, onde o contexto ao vivo agrega valor):** `assess`, `audit`, `plan`, `docs-audit`, `decide`, `evolve`, `feedback`, `goal`, `report`, `history`, `reminders`, `validate`, `digest`.

**Fora de escopo (comandos de setup/ação pontual, onde daemon não agrega valor):** `init`, `update`, `upgrade`, `shell-init`, `mcp`, `clean`, `hooks`, `bench`, `console`, `run`, `scheduled-check`, `sync`, `policy`, `profile`, `handbook`, `act`, `doctor`.

### 9.1 Helper único de enriquecimento
**Ficheiro:** novo `src/daemon-context-banner.ts`

```typescript
import { queryDaemonWithFallback } from "./daemon-client.js"; // já criado na Fase 4.2 do plano anterior

export async function printDaemonBanner(shitenDir: string): Promise<void> {
  const health = await queryDaemonWithFallback(shitenDir, { type: "query_health" }, () => null);
  if (!health) return; // daemon não ativo — comando segue 100% disk-based, sem alteração
  const icon = (health.trend === "degrading") ? "🟡" : "🟢";
  output(chalk.gray(`  ${icon} daemon: score ${health.score ?? "N/A"} · último comando: ${health.lastCommand ?? "—"}`));
}
```

### 9.2 Chamar o helper nos 13 comandos-alvo
Uma linha adicionada no início de cada `action()`:
```typescript
await printDaemonBanner(ctx.shitenDir);
```

**Critério de aceite:** com daemon ativo, os 13 comandos mostram a linha de contexto; sem daemon, comportamento idêntico ao atual (a função retorna cedo e nada muda).

---

## Sequenciamento

```
Pré-requisito: PLAN-2026-07-16-system-resilience-REVISADO.md completo (Fases 0-5)

DIA 1:    Fase 6 (matar watch, criar shiten daemon logs)
DIA 2:    Fase 7 (fechar loop command.completed)
DIA 3-4:  Fase 9 (enriquecimento nos 13 comandos)

Fase 8: backlog, não entra no orçamento — só se surgir necessidade real de consumo estruturado de eventos.
```

**Total: 3-4 dias**, depois dos 7-10 dias do plano anterior.

---

## Regra para o agente

Cada "Achado" listado no topo foi confirmado por grep direto no código em 2026-07-16. Se o código mudou desde então (por exemplo, se as Fases 0-5 do plano anterior já alteraram `watch.ts` ou `daemon.ts`), reconfirmar antes de aplicar qualquer patch — não assumir que os números de linha e nomes de função continuam exatos.

---

## Métricas de Sucesso

| Métrica | Antes | Depois |
|---|---|---|
| File watchers ativos simultaneamente (daemon + watch) | 2 (redundantes, um sem recovery) | 1 (só o do daemon, com recovery) |
| Comando `shiten watch` | Existe, roda watcher próprio | Removido |
| Visibilidade em tempo real do daemon | Nenhuma (só `daemon status` pontual) | `shiten daemon logs` (tail ao vivo, não bloqueia o daemon) |
| Subscribers de `command.completed` | 0 | ≥1 (daemon) |
| Comandos daemon-aware | 4/37 | 17/37 (status, briefing, context, daemon + 13 novos) |
| Mecanismo de streaming estruturado de eventos | Nenhum | Backlog (Fase 8, opcional) |
