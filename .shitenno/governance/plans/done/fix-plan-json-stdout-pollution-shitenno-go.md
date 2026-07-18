# Plano de Correção — Logs poluindo stdout no modo `--json` (Shitenno-go)

**Status:** Done
**Updated_at:** 2026-07-15T05:52:08.568Z
**Date:** 2026-07-15

> Adaptado do plano original (testado sobre o zip `nexus-system`) para a
> nomenclatura pós-rebranding. Rodar **depois** do Passo 1 do plano de
> rebranding (`rename-shitenno-go.py` + `pnpm install` + validação de
> build), já em cima do repositório já renomeado.

## Contexto

Suíte de testes executada sobre o build pré-rebranding: **1988/2000 testes
passando**, **12 falhas**, todas com a mesma causa raiz:

```
SyntaxError: Unexpected token 'd', "[doc-sync-h"... is not valid JSON
```

Comandos afetados (nomes novos): `shiten status --json`, `shiten run --json`,
`shiten detect --json`, `shiten audit --json`, `shiten validate --json`,
`shiten bench`, `shiten console`.

## Causa raiz

`src/output.ts` documenta explicitamente o contrato de arquitetura:

```
logger.* = stderr (diagnostic/debug)
```

Mas a implementação em `src/logger.ts` viola esse contrato:

- `logger.info` usa `console.log` → escreve em **stdout**
- `logger.debug` usa `console.debug` → escreve em **stdout**
- `logger.warn`/`logger.error` já estão corretos (stderr)

Quando o `doc-sync-hook` dispara um log (`logger.info("doc-sync-hook", "Sync completed in Xms")`) durante a execução de um comando `--json`, essa linha se mistura ao payload JSON no stdout, quebrando `JSON.parse` para qualquer consumidor programático (CI, MCP client, outro processo).

Adicionalmente, a função `muteLogs()` existe no logger mas **nunca é chamada em código de produção** — só em testes. Os handlers de comando checam `options.json` mas não suprimem logs quando esse modo está ativo.

Este bug é independente do rebranding — é lógica interna, não nome de
identificador — mas os exemplos abaixo já usam os nomes pós-rename
(`shitenDir`, `SHITEN_DIR_NAME`, binário `shiten`) para não gerar conflito
quando o agente for aplicar o patch.

## Correção 1 (principal) — `src/logger.ts`

Trocar `console.log`/`console.debug` por escrita direta em `process.stderr`, alinhando a implementação ao contrato já documentado em `output.ts`.

```ts
export const logger = {
  debug(module: string, message: string, ...args: unknown[]): void {
    if (shouldLog("debug")) {
      writeStderr(formatMessage("debug", module, message), args);
    }
  },
  info(module: string, message: string, ...args: unknown[]): void {
    if (shouldLog("info")) {
      writeStderr(formatMessage("info", module, message), args);
    }
  },
  warn(module: string, message: string, ...args: unknown[]): void {
    if (shouldLog("warn")) {
      console.warn(formatMessage("warn", module, message), ...args);
    }
  },
  error(module: string, message: string, ...args: unknown[]): void {
    if (shouldLog("error")) {
      console.error(formatMessage("error", module, message), ...args);
    }
  },
};

function writeStderr(line: string, args: unknown[]): void {
  const extra = args.length ? " " + args.map(String).join(" ") : "";
  process.stderr.write(line + extra + "\n");
}
```

**Escopo:** 1 arquivo, ~10 linhas. Não exige tocar nos call-sites de
`logger.*` espalhados pelos comandos (`shitenDir`, `SHITEN_DIR_NAME` e
demais identificadores renomeados não são afetados por essa correção).

## Correção 2 — atualizar `src/__tests__/logger.test.ts`

Duas asserções hoje fixam o comportamento incorreto (`info logs to console.log`, `debug logs to console.debug`). Substituir o spy de `console.log`/`console.debug` por spy em `process.stderr.write`, e adicionar uma asserção negativa garantindo que nada vai para stdout:

```ts
let stderrSpy: ReturnType<typeof vi.spyOn>;
let stdoutSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  setLogLevel("info");
});

it("info writes to stderr", () => {
  logger.info("TestModule", "hello");
  expect(stderrSpy).toHaveBeenCalledOnce();
  expect(stderrSpy.mock.calls[0]![0]).toContain("[TestModule]");
  expect(stderrSpy.mock.calls[0]![0]).toContain("hello");
});

it("info does not write to stdout", () => {
  logger.info("TestModule", "hello");
  expect(stdoutSpy).not.toHaveBeenCalled();
});

it("debug writes to stderr when level is debug", () => {
  setLogLevel("debug");
  logger.debug("TestModule", "visible");
  expect(stderrSpy).toHaveBeenCalledOnce();
});
```

Revisar também os testes `warn logs to console.warn` e `error logs to console.error` — esses continuam válidos sem alteração, pois `console.warn`/`console.error` já escrevem em stderr.

## Correção 3 (opcional, defesa em profundidade) — comandos com `--json`

Mesmo com o logger corrigido, vale garantir que nenhum `console.log` solto de terceiros (ex. algo dentro de um subprocesso chamado pelo `doc-sync-hook`, como `sync-docs.ts`) volte a poluir o stdout no futuro. Chamar `muteLogs()` explicitamente quando `--json` está ativo:

```ts
// src/commands/status.ts, run.ts, detect.ts, audit.ts, validate.ts
import { muteLogs } from "../logger.js";

.action(async (options) => {
  const isJson = options.json === true;
  if (isJson) muteLogs();   // <-- adicionar antes de rodar a pipeline
  ...
});
```

Redundante após a Correção 1, mas protege contra regressões futuras.

## Correção 4 — teste de regressão dedicado

Adicionar em `src/__tests__/cli-integration.test.ts` um teste que force o `doc-sync-hook` a disparar durante um comando `--json` e confirme que `stdout` continua JSON puro. Ajustar o helper de execução do CLI (`runShiten`, ou o nome equivalente pós-rename do antigo `runNexus`) para apontar ao binário novo:

```ts
it("keeps stdout as pure JSON even when doc-sync-hook logs during the run", async () => {
  // cenário: BRIEFING.md staleado para forçar auto-sync durante o comando
  const { stdout, exitCode } = await runShiten("status --json", dir);
  expect(exitCode).toBe(0);
  expect(() => JSON.parse(stdout)).not.toThrow();
});
```

> Atenção: se o rename mecânico (Passo 1 do plano de rebranding) já trocou
> `runNexus` por `runShiten` via find & replace, apenas confirmar o nome
> correto do helper antes de colar o teste acima.

## Ordem de execução

1. [ ] Confirmar que o Passo 1 do plano de rebranding já rodou (rename +
       `pnpm install` + build/testes validados) — este plano assume o
       repositório já com a nomenclatura `shitenno-go`/`shiten`
2. [ ] Aplicar Correção 1 em `src/logger.ts`
3. [ ] Aplicar Correção 2 em `src/__tests__/logger.test.ts`
4. [ ] (Opcional) Aplicar Correção 3 nos 5 comandos com `--json`
5. [ ] Aplicar Correção 4 (teste de regressão)

## Validação

Rodar, nessa ordem, a partir da raiz do projeto (usando os scripts `pnpm`
já validados no Passo 1 do rebranding):

```bash
pnpm run typecheck
pnpm run build
pnpm run test
```

**Critério de sucesso:** `2000/2000` testes passando (os 12 que hoje falham com `SyntaxError: Unexpected token 'd'` devem passar), sem novas falhas introduzidas.

Validação manual complementar, com o binário já renomeado:

```bash
# simular execução em projeto inicializado e verificar stdout limpo
node dist/bin/shiten.js status --json | node -e "JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('stdout OK — JSON válido')"
```
