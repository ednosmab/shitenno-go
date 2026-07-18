# Plano de Ação — Rotação e Controle de Tamanho do `daemon.log`

**Status:** Done
**Updated_at:** 2026-07-17T05:55:00.000Z
**Date:** 2026-07-17

**Data:** 2026-07-16
**Contexto:** achado durante o desenho de `shiten daemon logs` (PLAN-2026-07-16-daemon-full-integration.md, Fase 6) — `daemonLog()` em `src/daemon.ts` grava via `appendFileSync` sem nenhum limite de tamanho, rotação ou retenção.
**Escopo:** só o arquivo `daemon.log`. Não confundir com `BoundedQueue`/`LRUCache` em `src/daemon-resources.ts` — aquelas estruturas já limitam coleções em memória (ex.: `state.events`); este plano resolve o arquivo em disco, que é um problema separado e não coberto por elas.

---


## Checklist

- [ ] Rodar o daemon com `SHITEN_DAEMON_LOG_MAX_BYTES=1024` (valor baixo, só para teste) e gerar >1KB de log — confirmar que `daemon.log.1` aparece e `daemon.log` reinicia vazio.
- [ ] Gerar rotações suficientes para exceder `SHITEN_DAEMON_LOG_MAX_FILES` (ex. =2) e confirmar que nunca existem mais que 2 arquivos `.log.N` simultâneos.
- [ ] Reiniciar o daemon (`daemon stop` + `daemon start`) com um `daemon.log` já grande (>maxBytes) e confirmar que a primeira escrita pós-restart já dispara rotação corretamente (valida o `initLogByteCounter`).
- [ ] `shiten daemon logs` rodando durante uma rotação continua funcionando sem crashar e sem duplicar linhas.
- [ ] `npm run typecheck` e `npm test` passam sem quebrar nada em `daemon.ts` ou seus testes relacionados.
- [ ] Documentar as duas env vars novas (`SHITEN_DAEMON_LOG_MAX_BYTES`, `SHITEN_DAEMON_LOG_MAX_FILES`) em `docs/reference/cli.md` ou onde as outras env vars do daemon (`SHITEN_DAEMON_LOG`, `SHITEN_NO_DAEMON`) já estão documentadas.

## Diagnóstico confirmado no código

- **Ficheiro:** `src/daemon.ts`, função `daemonLog` (~linha 78)
- **Comportamento atual:**
```typescript
function daemonLog(logPath: string, level: string, msg: string): void {
  const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${msg}\n`;
  try {
    appendFileSync(logPath, line, "utf-8");
  } catch {
    logger.debug("daemon", `Failed to write log: ${msg}`);
  }
}
```
- **41 pontos de chamada** só em `daemon.ts`, sem limite de tamanho, sem rotação, sem retenção.
- `appendFileSync` abre o arquivo pelo *path* a cada chamada (não mantém um file descriptor persistente) — isso significa que **renomear o arquivo entre chamadas é seguro**: a próxima escrita cria um arquivo novo no mesmo path automaticamente. Isso simplifica a rotação (não precisa reabrir handle, não precisa lidar com fd obsoleto).
- Path do log é configurável via `SHITEN_DAEMON_LOG` (env var) ou default `shitenDir/daemon/daemon.log` — a rotação precisa respeitar essa configuração.
- **Compatibilidade com `shiten daemon logs`:** o comando `logs` (plano de integração, Fase 6.2) já trata o caso de o arquivo diminuir de tamanho (`size < lastSize` → reinicia leitura do zero). Rotação por rename cai exatamente nesse caso, então os dois planos são compatíveis sem trabalho extra.

---

## Decisão de Design

**Rotação por tamanho, com contador em memória (não `statSync` a cada log).**

Alternativas descartadas e por quê:
- **Rotação por tempo (diária):** mais previsível, mas o volume de log do daemon depende de atividade (comandos rodados, eventos, audits), não do relógio — um dia parado gera log vazio, um dia de uso intenso pode estourar disco antes da rotação diária rodar. Tamanho é a métrica certa aqui.
- **`statSync` a cada chamada de `daemonLog`:** funciona, mas é uma syscall extra em 41 pontos de chamada que podem ocorrer em rajada (ex.: durante um audit). Um contador incremental em memória (soma do `line.length` a cada escrita) é praticamente grátis e evita I/O extra.
- **Bibliotecas externas de rotação (`winston`, `pino` com transporte de rotação):** trocaria a dependência zero-lib atual por uma dependência nova só para isto. Dado que a lógica necessária é pequena (~40 linhas), implementar localmente é mais simples e mais fácil de auditar.

---

## FASE ÚNICA: Implementar Rotação (0.5-1 dia)

### 1. Configuração
**Ficheiro:** `src/daemon.ts`, próximo a `getPaths` (ou `daemon/state.ts` se a Fase 2 do plano de resiliência já rodou)

```typescript
const DEFAULT_MAX_LOG_BYTES = 5 * 1024 * 1024; // 5MB
const DEFAULT_MAX_ROTATED_FILES = 3;

function getLogRotationConfig(): { maxBytes: number; maxFiles: number } {
  const maxBytes = Number(process.env["SHITEN_DAEMON_LOG_MAX_BYTES"]) || DEFAULT_MAX_LOG_BYTES;
  const maxFiles = Number(process.env["SHITEN_DAEMON_LOG_MAX_FILES"]) || DEFAULT_MAX_ROTATED_FILES;
  return { maxBytes, maxFiles };
}
```

### 2. Contador de tamanho em memória, inicializado no boot do daemon
**Ficheiro:** mesmo módulo de `daemonLog`

```typescript
let currentLogBytes = 0;

function initLogByteCounter(logPath: string): void {
  try {
    currentLogBytes = existsSync(logPath) ? statSync(logPath).size : 0;
  } catch {
    currentLogBytes = 0;
  }
}
```

Chamar `initLogByteCounter(logPath)` uma vez, no início de `runDaemon` (onde hoje já se chama `daemonLog(logPath, "INFO", "Shiten Daemon vX starting...")`), **antes** da primeira escrita — assim um restart do daemon não perde a contagem do que já existe no arquivo.

### 3. Rotação por rename, disparada dentro de `daemonLog`
```typescript
function rotateLogIfNeeded(logPath: string): void {
  const { maxBytes, maxFiles } = getLogRotationConfig();
  if (currentLogBytes < maxBytes) return;

  try {
    // Desloca .{n-1} -> .{n}, do mais antigo pro mais novo, para não sobrescrever nada por engano
    for (let i = maxFiles - 1; i >= 1; i--) {
      const src = `${logPath}.${i}`;
      const dst = `${logPath}.${i + 1}`;
      if (existsSync(src)) {
        if (i === maxFiles - 1 && existsSync(dst)) unlinkSync(dst); // não deixar acumular além do limite
        renameSync(src, dst);
      }
    }
    renameSync(logPath, `${logPath}.1`);
    currentLogBytes = 0;
  } catch (err) {
    // Rotação falhou (ex.: permissão) — não travar o daemon por causa disso, só logar via stderr
    logger.debug("daemon", `Log rotation failed: ${err}`);
  }
}

function daemonLog(logPath: string, level: string, msg: string): void {
  const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${msg}\n`;
  try {
    rotateLogIfNeeded(logPath);
    appendFileSync(logPath, line, "utf-8");
    currentLogBytes += Buffer.byteLength(line, "utf-8");
  } catch {
    logger.debug("daemon", `Failed to write log: ${msg}`);
  }
}
```

**Nota sobre imports:** `renameSync`, `unlinkSync`, `statSync`, `existsSync` precisam ser adicionados ao import de `node:fs` já existente em `daemon.ts` (hoje só importa `appendFileSync` e, em outro ponto, `readFileSync`).

### 4. Limpeza de rotacionados antigos além do limite configurado
Já coberto pelo loop acima (`if (i === maxFiles - 1 && existsSync(dst)) unlinkSync(dst)`), mas adicionar um teste explícito que gera >`maxFiles` rotações e confirma que o total de arquivos `daemon.log*` nunca excede `maxFiles + 1` (o `.log` ativo + N rotacionados).

### 5. Compatibilidade com `shiten daemon logs`
Nenhuma mudança necessária no comando `logs` (Fase 6 do plano de integração) — ele já trata `size < lastSize` como sinal de reinício de leitura, que é exatamente o que acontece quando `daemon.log` é renomeado para `.1` e um arquivo novo e vazio assume o path original.

---

## Critérios de Aceite

- [ ] Rodar o daemon com `SHITEN_DAEMON_LOG_MAX_BYTES=1024` (valor baixo, só para teste) e gerar >1KB de log — confirmar que `daemon.log.1` aparece e `daemon.log` reinicia vazio.
- [ ] Gerar rotações suficientes para exceder `SHITEN_DAEMON_LOG_MAX_FILES` (ex. =2) e confirmar que nunca existem mais que 2 arquivos `.log.N` simultâneos.
- [ ] Reiniciar o daemon (`daemon stop` + `daemon start`) com um `daemon.log` já grande (>maxBytes) e confirmar que a primeira escrita pós-restart já dispara rotação corretamente (valida o `initLogByteCounter`).
- [ ] `shiten daemon logs` rodando durante uma rotação continua funcionando sem crashar e sem duplicar linhas.
- [ ] `npm run typecheck` e `npm test` passam sem quebrar nada em `daemon.ts` ou seus testes relacionados.
- [ ] Documentar as duas env vars novas (`SHITEN_DAEMON_LOG_MAX_BYTES`, `SHITEN_DAEMON_LOG_MAX_FILES`) em `docs/reference/cli.md` ou onde as outras env vars do daemon (`SHITEN_DAEMON_LOG`, `SHITEN_NO_DAEMON`) já estão documentadas.

---

## Fora de Escopo (deliberadamente)

- **Compressão dos arquivos rotacionados (gzip):** economiza disco, mas adiciona complexidade (I/O assíncrono, dependência ou uso de `zlib`) para um ganho marginal dado que já há limite de tamanho total (`maxBytes × maxFiles`, ex.: 5MB × 3 = 15MB no pior caso). Considerar só se o limite total ainda for grande demais na prática.
- **Envio para sistema de log externo (syslog, journald, agregador):** fora do princípio atual do projeto ("o daemon é opt-in, roda local"). Se isso vier a ser necessário, é um plano à parte, não uma extensão deste.
- **Rotação do `daemon-state.json`** (estado persistido, não log) — arquivo diferente, com seu próprio ciclo de vida via `persistState`/`loadState`; não teve evidência de crescimento descontrolado até agora e não faz parte deste plano.

---

## Ordem de Execução Recomendada

Este plano é independente e pode rodar **antes, durante ou depois** dos outros dois planos (resiliência e integração total) — não há dependência de código entre eles, só uma dependência lógica com a Fase 6 do plano de integração (o comando `shiten daemon logs`), já verificada como compatível acima. Se quiser sequenciar tudo junto, a ordem mais segura é:

```
1. PLAN-2026-07-16-system-resilience-REVISADO.md (Fases 0-5, inclui split de daemon.ts)
2. Este plano (rotação de log) — mais fácil de aplicar já no daemon.ts dividido
3. PLAN-2026-07-16-daemon-full-integration.md (Fases 6-9)
```

Mas nenhuma etapa deste plano exige que os outros já tenham rodado.
