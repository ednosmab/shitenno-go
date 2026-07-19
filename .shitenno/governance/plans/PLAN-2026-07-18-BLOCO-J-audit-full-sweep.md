# PLAN-2026-07-18 — Bloco J: `shugo audit --full-sweep` + gate leve no daemon

**Status:** In Progress

**Depende de:** Bloco F v2 (`runAutoVerification`, `checkBuild`/`checkTests`/`checkLint` exportadas de `plan-lifecycle.ts`) e Bloco G (`.verification.json`/`last-verify.json` como artefato de referência).

**Por que dois caminhos, não um:** `shugo audit` roda tanto por pedido manual quanto automaticamente pelo daemon (`runPeriodicAudit()`, `daemon/index.ts:509`), que **já escala sozinho pro nível `"code-review"`** quando o health score cai abaixo de 40 (`getAuditLevel()`, linha 502-507), a cada 4-6h via `setInterval`. Se "code-review" disparasse `verify:all` (build + suíte de testes completa) automaticamente, o daemon rodaria isso sozinho, em background, periodicamente — o cenário de custo descontrolado que motivou toda a ressalva anterior. A costura certa desacopla **nível** de **gatilho**: nível decide quais achados aparecem, gatilho explícito (`--full-sweep`, só via CLI manual) decide se `verify:all` roda de verdade.

---

## J.1 — Detector leve: só lê o status salvo, nunca executa nada

**Novo ficheiro:** `src/audit/detectors/detect-stale-verification.ts`

```typescript
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import type { HealthIssue } from "../types.js";

export function detectStaleVerification(projectRoot: string, shitennoDir: string): HealthIssue[] {
  const statusPath = join(shitennoDir, "governance", "last-verify.json");

  if (!existsSync(statusPath)) {
    return [{
      category: "governance_integrity",
      severity: "medium",
      message: "Nenhum verify:all registrado ainda — rode 'shugo audit --level code-review --full-sweep' antes do próximo plan close.",
    }];
  }

  const status = JSON.parse(readFileSync(statusPath, "utf-8"));
  let currentHead: string;
  try {
    currentHead = execSync("git rev-parse HEAD", { cwd: projectRoot, encoding: "utf-8" }).trim();
  } catch {
    return []; // não é repo git (ex.: ambiente de teste) — não é achado de saúde, é ambiente.
  }

  const issues: HealthIssue[] = [];

  if (status.commitHash !== currentHead) {
    issues.push({
      category: "governance_integrity",
      severity: "low",
      message: `Última verificação foi no commit ${String(status.commitHash).slice(0, 7)}, HEAD atual é ${currentHead.slice(0, 7)} — pode estar desatualizada.`,
    });
  }

  if (status.passed === false) {
    issues.push({
      category: "governance_integrity",
      severity: "high",
      message: `verify:all falhou na última execução (${status.timestamp}) e ainda não foi corrigido.`,
    });
  }

  return issues;
}
```

**Ficheiro:** `src/audit/constants.ts` — registrar só nos níveis mais pesados (não em `quick`/`standard`, que o daemon usa com frequência maior e precisam continuar instantâneos):

```typescript
export const DETECTORS_BY_LEVEL: Record<AuditLevel, string[]> = {
  quick: [ /* inalterado */ ],
  standard: [ /* inalterado */ ],
  "code-review": [
    // ...detectores já existentes deste nível,
    "detectStaleVerification",
    "detectDoneIntegrity", // do Bloco G.2, se implementado junto
  ],
  enterprise: [
    // ...detectores já existentes deste nível,
    "detectStaleVerification",
    "detectDoneIntegrity",
  ],
};
```

E registrar a função no `buildDetectorMap()` (`src/audit/detector-map.ts`) no mesmo padrão dos outros detectores existentes — conferir a assinatura exata usada lá antes de adicionar, para manter a interface consistente (a maioria recebe `projectRoot`/`shitennoDir`/`sourceFiles`/etc. via closure, conferir se `detectStaleVerification` precisa da mesma injeção ou se um wrapper fino resolve).

**Critério de aceite:** `npx vitest run` inclui um teste que roda `auditHealth(root, shitennoDir, "code-review")` num diretório sem `last-verify.json` → achado `governance_integrity` aparece; com `last-verify.json` fresco e `passed: true` → nenhum achado dessa categoria.

---

## J.2 — Gatilho manual explícito: `--full-sweep`

**Ficheiro:** `src/commands/audit.ts`

```typescript
// Adicionar a opção, junto das outras já existentes:
.option("--full-sweep", "Roda verify:all (build+test+lint) antes da varredura, não só lê o status salvo — pode levar minutos")

// Dentro do .action(async (fingerprint, options) => { ... }), antes de chamar auditHealth:
if (options.fullSweep) {
  // Trava explícita: nunca deve rodar disparado por processo automatizado.
  // SHITENNO_CHILD já é setado pelo próprio CLI/daemon internamente (ver
  // cli-integration.test.ts, runShugo() seta esse env) — reaproveitar como
  // sinal de "isso não é um humano no terminal esperando", não criar flag nova.
  if (process.env.SHITENNO_CHILD === "1") {
    console.error("Erro: --full-sweep não pode ser usado por processo automatizado (daemon/CI). Rode manualmente.");
    process.exitCode = 1;
    return;
  }

  const { runAutoVerification } = await import("../plan-lifecycle.js");
  const spinner = ora("Rodando verify:all (build + test + lint) antes da varredura...").start();

  const record = runAutoVerification(ctx.shitennoDir, ctx.projectRoot, "__manual_audit_sweep__");

  writeFileSync(
    join(ctx.shitennoDir, "governance", "last-verify.json"),
    JSON.stringify(record, null, 2),
    "utf-8"
  );

  spinner[record.passed ? "succeed" : "fail"](
    record.passed ? "verify:all passou" : `verify:all falhou: ${record.checks.filter((c) => !c.passed).map((c) => c.name).join(", ")}`
  );
}

// auditHealth() roda normalmente depois — detectStaleVerification (J.1) agora
// lê o last-verify.json recém-escrito, então não reporta staleness.
```

**Nota sobre o `planId` fictício:** `runAutoVerification` (Bloco F.2) foi desenhado pra um plano real, com `updateStatus`/`moveToDone` no final. Usar `"__manual_audit_sweep__"` aqui é só pra reaproveitar `checkBuild`/`checkTests`/`checkLint` sem acionar a parte de mover arquivo de plano — **conferir que `runAutoVerification` não tenta chamar `engine.getById("__manual_audit_sweep__")` e falhar por plano inexistente**. Se acoplado demais ao conceito de plano, a alternativa mais limpa é extrair só os três `check*` e montar o `VerificationRecord` aqui diretamente, sem passar pela função pensada pra fechamento de plano:

```typescript
// Alternativa mais desacoplada, se runAutoVerification resistir a rodar sem plano real:
import { checkBuild, checkTests, checkLint } from "../plan-lifecycle.js";

const checks = [checkBuild(ctx.projectRoot), checkTests(ctx.projectRoot), checkLint(ctx.projectRoot)];
const passed = checks.every((c) => c.passed);
const commitHash = execSync("git rev-parse HEAD", { cwd: ctx.projectRoot, encoding: "utf-8" }).trim();
const record = { commitHash, checks, passed, timestamp: new Date().toISOString() };
```

**Critério de aceite manual:** `shugo audit --level code-review --full-sweep` num projeto com teste quebrado de propósito → mostra spinner de build/test, falha visivelmente, escreve `last-verify.json` com `passed: false`, e a varredura de audit em seguida mostra o achado de `detectStaleVerification`/severidade `high` pra esse mesmo problema — no mesmo relatório, uma única invocação.

---

## J.3 — Teste que impede o daemon de herdar o caminho pesado por engano

**Novo ficheiro:** `src/__tests__/daemon-audit-guard.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("daemon never triggers the heavy verify:all path", () => {
  it("runPeriodicAudit does not call runAutoVerification, checkBuild, checkTests or checkLint directly", () => {
    const daemonSource = readFileSync(join(process.cwd(), "src", "daemon", "index.ts"), "utf-8");

    // Localizar só o corpo de runPeriodicAudit, não o arquivo inteiro — o
    // daemon pode legitimamente importar essas funções em outro contexto
    // (ex.: se algum dia expuser um comando remoto "daemon verify"); o que
    // não pode é o TIMER PERIÓDICO chamar isso sozinho.
    const fnStart = daemonSource.indexOf("function runPeriodicAudit");
    const fnEnd = daemonSource.indexOf("\n  }", fnStart);
    const fnBody = daemonSource.slice(fnStart, fnEnd);

    expect(fnBody).not.toMatch(/runAutoVerification|checkBuild\(|checkTests\(|checkLint\(/);
    expect(fnBody).not.toMatch(/--full-sweep|fullSweep/);
  });

  it("auditHealth is called with fullSweep-equivalent behavior disabled inside the daemon", () => {
    const daemonSource = readFileSync(join(process.cwd(), "src", "daemon", "index.ts"), "utf-8");
    // auditHealth() em si nunca recebeu esse conceito (é síncrona, sem opção
    // de rodar verify) — esse teste é uma trava de regressão para o dia em
    // que alguém decidir "acoplar" os dois: se a assinatura de auditHealth()
    // ganhar um 5º parâmetro relacionado a sweep, este teste força revisão
    // explícita de por que o daemon está ou não passando ele.
    expect(daemonSource).toMatch(/auditHealth\(shitennoDir, shitennoDir, level\)/);
  });
});
```

**Critério de aceite:** este teste falha imediatamente se algum refactor futuro (bem-intencionado: "já que estamos rodando code-review, deixa eu também disparar o verify aqui") reintroduzir o acoplamento — é a rede de segurança que substitui "lembrar disso na hora do code review humano".

---

## Ordem de execução deste bloco

1. J.1 (detector leve) — zero risco, pode entrar em produção imediatamente.
2. J.3 (teste de guarda) — escrever **antes** de J.2, não depois — é o teste que vai forçar J.2 a nascer já com a trava `SHITENNO_CHILD` certa, em vez de adicionar a trava depois de já ter sido esquecida uma vez.
3. J.2 (flag manual) — por último, já protegido pelo teste de J.3.

Depois: `npm run build && npx vitest run`, e um teste manual de fumaça — deixar o daemon rodando por um ciclo completo de `getAuditIntervalMs()` (ou forçar via variável de ambiente, se existir hook de teste pra isso) e confirmar no `daemon.log` que nenhuma linha menciona build/test rodando fora de uma invocação manual explícita.
