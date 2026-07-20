# PLAN-2026-07-19 — Bloco L: Reforço do Gate — Fechando os Últimos Caminhos de Bypass

**Status:** Done
**Updated_at:** 2026-07-20T02:44:56.142Z
**Date:** 2026-07-19
**Origem:** auditoria do zip pós-implementação de F/H/I/K. Reforça especificamente os dois caminhos de bypass encontrados na última revisão: `archivePlan`/`removePlan` (revisão interativa) e `task-completion-pipeline.ts` (conclusão de tarefa).
**Método de verificação:** leitura de `plan-lifecycle.ts`, `task-completion.ts`, `task-completion-pipeline.ts`, `close-session.ts` — grep sistemático por todo chamador de `updateStatus(id, "done")` no repositório inteiro, não só nos arquivos que os blocos anteriores já tinham tocado.

---

## Narrativa — por que isso aconteceu, mesmo com tanto cuidado nos blocos anteriores

Vale entender o padrão antes de ir pro código, porque ele vai se repetir se não for nomeado.

Cada bloco (F, I, K) foi correto **no arquivo em que ele mexeu**. O Bloco F desenhou o gate em `plan-lifecycle.ts`. O Bloco I corrigiu `checkBuild`/`checkTests`/`checkLint` pra serem agnósticos de stack — também em `plan-lifecycle.ts`. O Bloco K fechou concorrência entre daemon e `close-session.ts`. Todos esses arquivos, hoje, estão coerentes entre si.

O problema é que **o sistema já tinha, antes de qualquer um desses blocos existir, outras duas implementações independentes da mesma ideia** — `archivePlan`/`removePlan` (usadas pela revisão interativa via CLI) e `checkTestPass`/`checkLintPass` dentro de `task-completion.ts` (usadas pelo pipeline de conclusão de tarefa). Nenhum bloco tocou nelas, porque nenhuma conversa até agora perguntou "quem mais, no projeto inteiro, escreve `Status: done`?" — cada rodada perguntou "como eu conserto o daemon" ou "como eu conserto o checkpoint de sessão", e cada resposta foi certa pra pergunta feita.

Isso é o padrão a reforçar, não só o código: **toda vez que uma regra de negócio importante existe em mais de um lugar do código, ela vai divergir com o tempo**, porque cada fix futuro vai naturalmente mexer só no lugar que está sendo discutido naquele momento. A correção de código abaixo fecha os dois caminhos encontrados. A correção de processo (L.4) é o que impede a próxima versão desse mesmo bug aparecer num quinto lugar que ninguém pensou em perguntar ainda.

Achei também, nesta auditoria, um risco pior do que "bypass silencioso": `checkTestPass` em `task-completion.ts` roda `pnpm run test --recursive --if-present --filter=core`. A flag `--if-present` do pnpm **não falha se o script não existir** — ela só pula silenciosamente. Isso significa que, num projeto de terceiro sem essa estrutura exata de monorepo, esse gate pode reportar "tests: passed" **sem ter rodado teste nenhum**. Não é um gate que bloqueia demais (como o bug do Bloco I.1) nem um gate que nunca roda (como os caminhos de `archivePlan`) — é um gate que **finge ter verificado**. Esse é o mais perigoso dos três, porque não gera nenhum sintoma visível pra alguém notar que algo está errado.

---

## L.1 — Unificar `task-completion.ts` para usar as funções já corrigidas de `plan-lifecycle.ts`

**Ficheiro:** `src/task-completion.ts`

```typescript
// Antes (linhas ~48-70) — implementação própria, hardcoded, com --if-present perigoso:
function checkTestPass(projectRoot: string, execFn: typeof execSync): CompletionGate {
  try {
    execFn("pnpm run test --recursive --if-present --filter=core 2>/dev/null | tail -1", {
      cwd: projectRoot, timeout: 120000, stdio: "pipe",
    });
    return { name: "tests", passed: true, message: "All tests pass" };
  } catch {
    return { name: "tests", passed: false, message: "Tests failed or not executed" };
  }
}

function checkLintPass(projectRoot: string, execFn: typeof execSync): CompletionGate {
  // ... mesma estrutura hardcoded em pnpm
}

// Depois — delega pra mesma função que o Bloco F/I já corrigiram e testaram:
import { checkTests, checkBuild, checkLint } from "./plan-lifecycle.js";

function checkTestPass(projectRoot: string): CompletionGate {
  const result = checkTests(projectRoot);
  return { name: "tests", passed: result.passed, message: result.message };
}

function checkLintPass(projectRoot: string): CompletionGate {
  const result = checkLint(projectRoot);
  return { name: "lint", passed: result.passed, message: result.message };
}
```

Isso remove o parâmetro `execFn` de ambas (não é mais necessário injetar comando customizado — `checkTests`/`checkLint` já resolvem o runner certo via `analyseProject`). Os testes existentes de `task-completion.ts` que mockam `execFn` para essas duas funções precisam ser atualizados para mockar `checkTests`/`checkLint` de `plan-lifecycle.ts` em vez disso — não é perda de cobertura, é mudança de onde o mock aponta.

**Critério de aceite:** rodar `validateCompletionGate` num projeto fake sem `pnpm-lock.yaml`, com `package.json` tendo `scripts.test` apontando pra um teste que falha de propósito → gate `tests` reporta `passed: false` de verdade, em vez de passar silenciosamente por causa do `--if-present`.

---

## L.2 — `archivePlan`/`removePlan` precisam gravar o `.verification.json`, não só mudar o status

**Ficheiro:** `src/plan-lifecycle.ts`

A revisão interativa (`runLifecycleReview`) já roda `runValidationWithProgress` — que chama `checkBuild`/`checkTests`/`checkLint` de verdade — **antes** de chamar `archivePlan`. O problema não é falta de verificação aqui, é que o resultado dessa verificação é jogado fora em vez de virar `.verification.json`. Isso causa dois problemas: (1) o pre-commit do Bloco F.6 vai bloquear um plano que **de fato** passou nos testes, só porque o sidecar não foi escrito; (2) a regra do `AGENTS.md` ("nunca escreva `done` diretamente") é violada pelo próprio código-fonte do sistema, não só por um agente desavisado.

```typescript
// Antes:
export function archivePlan(shitennoDir: string, planId: string): void {
  const engine = new MarkdownPlanEngine(shitennoDir);
  engine.updateStatus(planId, "done");
}

export function removePlan(shitennoDir: string, planId: string): void {
  const engine = new MarkdownPlanEngine(shitennoDir);
  engine.updateStatus(planId, "done");
}

// Depois — recebe o resultado da validação já rodada e grava a prova antes de mudar o status:
export function archivePlan(shitennoDir: string, planId: string, validation?: ValidationResult): void {
  const engine = new MarkdownPlanEngine(shitennoDir);

  if (validation) {
    const plansDir = join(shitennoDir, "governance", "plans");
    let commitHash = "unknown";
    try {
      commitHash = execSync("git rev-parse HEAD", { cwd: shitennoDir, encoding: "utf-8", timeout: 5000 }).trim();
    } catch { /* not a git repo */ }

    writeFileSync(
      join(plansDir, `${planId}.verification.json`),
      JSON.stringify(
        { planId, commitHash, checks: validation.checks, passed: validation.valid, timestamp: new Date().toISOString() },
        null, 2
      ),
      "utf-8"
    );
  }

  engine.updateStatus(planId, "done");
}

export function removePlan(shitennoDir: string, planId: string, validation?: ValidationResult): void {
  archivePlan(shitennoDir, planId, validation); // mesmo contrato — "remove" também é "done" no fluxo atual
}
```

**Nos dois call sites de `runLifecycleReview` (linhas ~355 e ~400), passar o resultado já calculado:**

```typescript
// Antes: archivePlan(shitennoDir, inf.id);
// Depois:
archivePlan(shitennoDir, inf.id, validation); // `validation` já existe no escopo, vem de runValidationWithProgress logo acima
```

**Nota:** o parâmetro `validation` é opcional de propósito — se algum chamador futuro invocar `archivePlan` sem ter rodado verificação nenhuma antes, o comportamento continua sendo "grava done sem sidecar", que o pre-commit vai pegar como bloqueio. Isso é intencional: melhor bloquear um caminho não auditado do que deixá-lo passar silenciosamente. L.4 abaixo é o que evita esse caso surgir sem ninguém perceber.

**Critério de aceite:** rodar `shugo plan md lifecycle` num plano que passa em todos os checks, escolher `[A]` → o plano vai pra `done/` **com** `.verification.json` ao lado, e o pre-commit não bloqueia o commit seguinte.

---

## L.3 — `task-completion-pipeline.ts` precisa do mesmo tratamento

**Ficheiro:** `src/task-completion-pipeline.ts`, linha ~191

```typescript
// Antes:
if (planId) {
  planArchived = archivePlan(projectRoot, planId);
  // ...
}

// Depois — reaproveita os gates que L.1 já corrigiu, monta um ValidationResult equivalente:
if (planId) {
  const validationResult: ValidationResult = {
    valid: gates.passed,
    checks: gates.gates.map((g) => ({ name: g.name.toUpperCase(), passed: g.passed, message: g.message })),
  };
  planArchived = archivePlan(shitennoDir, planId, validationResult);
  // ...
}
```

Como `gates` (de `validateCompletionGate`, já corrigido em L.1) só chega até aqui se `gates.passed === true` (linha ~127 já retorna cedo se `!gates.passed`), o `.verification.json` gravado aqui vai sempre refletir `passed: true` de verdade — coerente com o resto do sistema.

**Nota de tipo:** `archivePlan` retornava `void` antes; o código em `task-completion-pipeline.ts` já trata o retorno como `boolean` (`planArchived = archivePlan(...)`, linha 191, e depois `if (planArchived)`). Isso já era uma inconsistência de tipo pré-existente ao Bloco L (provavelmente um bug de type-check que o `tsc` deveria acusar) — ajustar `archivePlan` pra retornar `boolean` (`true` se conseguiu, `false` se o plano não foi encontrado ou falhou ao escrever) resolve os dois problemas ao mesmo tempo:

```typescript
export function archivePlan(shitennoDir: string, planId: string, validation?: ValidationResult): boolean {
  try {
    const engine = new MarkdownPlanEngine(shitennoDir);
    if (validation) { /* ... grava sidecar, igual acima ... */ }
    engine.updateStatus(planId, "done");
    return true;
  } catch {
    return false;
  }
}
```

**Critério de aceite:** `npx tsc --noEmit` limpo (o mismatch de tipo `void` vs `boolean` deixa de existir); rodar o pipeline de conclusão de tarefa num projeto de teste → `.verification.json` aparece ao lado do plano arquivado.

---

## L.4 — Rede de segurança de processo: impedir um quinto caminho de bypass no futuro

Reaproveitar `scripts/verify-done-plans.ts` (já existe, já roda no pre-commit) pra também flagrar a causa raiz, não só o sintoma:

```typescript
// scripts/verify-done-plans.ts — adicionar esta checagem extra, antes da checagem de sidecar já existente:

import { execSync } from "node:child_process";

function checkForDirectDoneWrites(): boolean {
  // Procura updateStatus(..., "done") fora de plan-lifecycle.ts — qualquer ocorrência
  // nova é um sinal de que alguém reintroduziu um caminho de bypass.
  try {
    const output = execSync(
      `grep -rn 'updateStatus([^,]*,\\s*["\\']done["\\']' src --include="*.ts" | grep -v "src/plan-lifecycle.ts" | grep -v "__tests__"`,
      { encoding: "utf-8" }
    );
    if (output.trim()) {
      console.error("❌ Chamada direta a updateStatus(..., \"done\") fora de plan-lifecycle.ts:");
      console.error(output);
      console.error("Toda escrita de 'done' deve passar por runAutoVerification ou por archivePlan/removePlan com um ValidationResult.");
      return false;
    }
    return true;
  } catch {
    return true; // grep sem match retorna exit code 1 — não é erro, é sinal de "nada encontrado" (bom)
  }
}

// No fluxo principal do script, antes de retornar:
if (!checkForDirectDoneWrites()) {
  failed = true;
}
```

Isso não impede alguém de *decidir* criar um novo caminho — impede que ele passe despercebido. Se um agente (IA ou humano) adicionar um quarto lugar que escreve `done` diretamente no futuro, o pre-commit já vai apontar o arquivo e a linha, no mesmo commit que introduziu o problema, não meses depois numa auditoria manual como esta.

**Critério de aceite:** adicionar propositalmente uma chamada `engine.updateStatus(id, "done")` num arquivo novo qualquer fora de `plan-lifecycle.ts` → `git commit` bloqueia e aponta exatamente o arquivo/linha ofensor.

---

## Ordem de execução recomendada

1. **L.1** — mais urgente: é o único dos três achados que é um falso-positivo silencioso (gate finge validar), não só um falso-bloqueio.
2. **L.2** — depende de L.1 só indiretamente (nenhuma dependência real de código, mas faz sentido revisar `checkBuild`/`checkTests`/`checkLint` já corrigidos antes de confiar no resultado que `L.2` vai persistir).
3. **L.3** — depende de L.1 (usa os gates corrigidos) e reaproveita o mesmo padrão de L.2.
4. **L.4** — por último, como rede de segurança sobre tudo que já foi corrigido — e o que vai proteger contra o próximo achado desse tipo, que ainda não apareceu.

Depois de cada item: `npm run build && npx vitest run`.

## Critério de aceite geral do Bloco L

- Grep por `updateStatus(` no projeto inteiro mostra exatamente **um** chamador de `"done"` fora de `plan-lifecycle.ts`: o próprio `archivePlan`/`removePlan`, e mesmo esses só com `.verification.json` gravado.
- Os três caminhos que hoje levam a `done` — daemon (`runAutoVerification`), checkpoint de fim de sessão (`close-session.ts` → `runAutoVerification`), revisão interativa (`runLifecycleReview` → `archivePlan` com validação) e pipeline de conclusão de tarefa (`task-completion-pipeline.ts` → `archivePlan` com validação) — todos produzem `.verification.json` com o mesmo formato, nenhum é uma implementação paralela.
- Nenhum projeto de terceiro sem `pnpm`/estrutura de monorepo específica consegue mais receber um "tests: passed" sem ter rodado teste nenhum.
