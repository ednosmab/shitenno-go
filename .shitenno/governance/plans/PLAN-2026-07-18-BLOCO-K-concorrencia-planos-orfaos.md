# PLAN-2026-07-18 — Bloco K: Concorrência Entre Processos + Planos Órfãos em `check`

**Status:** check
**Updated_at:** 2026-07-19T05:00:00.000Z
**Date:** 2026-07-18
**Origem:** dois edge cases identificados diretamente pelo usuário na revisão do Bloco J.4 — nenhum dos Blocos F/H/I/J cobria (1) dois processos diferentes (daemon + checkpoint de fim de sessão) tentando verificar o mesmo plano ao mesmo tempo, e (2) um plano ficar preso em `check` além da sessão atual sem ninguém verificar, se nem o daemon nem o checkpoint de fim de sessão rodarem.
**Método de verificação:** leitura de `src/daemon/index.ts` (padrão de lock já existente via `pidPath`, sequência de startup scan) e `src/daemon/startup-scan.ts`.

## Os dois problemas, em termos simples

1. **Concorrência entre processos:** o lock do Bloco J.4 (`verificationInFlight`) só existe *dentro* do processo do daemon. Mas existe um segundo processo que também pode disparar verificação — o checkpoint de fim de sessão (Bloco F.4), que roda como script separado. Se o daemon estiver verificando um plano exatamente quando a sessão fecha, os dois processos podem tentar escrever no mesmo `.verification.json` ao mesmo tempo, sem nenhum saber da existência do outro.
2. **Plano órfão:** se nem o daemon estiver rodando (desligado, nunca foi iniciado) nem o checkpoint de fim de sessão for executado (terminal fechado sem o ritual normal, crash), um plano em `check` fica esquecido indefinidamente — nada dispara a verificação até que algo mais mexa naquele arquivo, o que pode nunca acontecer sozinho.

---

## K.1 — Lock de arquivo entre processos

O código já tem o padrão certo pra copiar: `daemon/index.ts` (linha ~147-169) já usa um arquivo `daemon.pid` — grava o PID do processo ao iniciar, e checa na próxima inicialização se aquele PID ainda está vivo antes de decidir se é seguro continuar. Vamos aplicar exatamente esse padrão pra verificação de plano.

**Novo ficheiro:** `src/verification-lock.ts`

```typescript
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

interface LockInfo {
  pid: number;
  startedAt: string;
}

function lockPath(shitennoDir: string): string {
  return join(shitennoDir, "governance", "plans", ".verification.lock");
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0); // sinal 0 não mata, só testa se o processo existe
    return true;
  } catch {
    return false;
  }
}

/**
 * Tenta adquirir o lock. Retorna true se conseguiu (pode prosseguir com a
 * verificação); false se outro processo já está verificando agora.
 * Lock travado por um processo morto (crash) é destravado automaticamente.
 */
export function acquireVerificationLock(shitennoDir: string): boolean {
  const path = lockPath(shitennoDir);

  if (existsSync(path)) {
    try {
      const info: LockInfo = JSON.parse(readFileSync(path, "utf-8"));
      if (isProcessAlive(info.pid)) {
        return false; // outro processo (daemon OU close-session) está verificando de verdade agora
      }
      // processo do lock não existe mais — lock órfão de um crash, seguro remover
    } catch {
      // lock corrompido/ilegível — trata como órfão, remove e segue
    }
  }

  writeFileSync(path, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }, null, 2), "utf-8");
  return true;
}

export function releaseVerificationLock(shitennoDir: string): void {
  const path = lockPath(shitennoDir);
  try {
    if (existsSync(path)) {
      const info: LockInfo = JSON.parse(readFileSync(path, "utf-8"));
      if (info.pid === process.pid) unlinkSync(path); // só remove o lock que este processo criou
    }
  } catch {
    // se der erro lendo, não arrisca apagar lock de outro processo
  }
}
```

**Uso no daemon (`daemon/index.ts`, dentro de `verifyAllPendingPlans` do Bloco J.4):**

```typescript
import { acquireVerificationLock, releaseVerificationLock } from "../verification-lock.js";

async function verifyAllPendingPlans(): Promise<void> {
  if (verificationInFlight) {
    pendingReVerification = true;
    return verificationInFlight;
  }

  verificationInFlight = (async () => {
    if (!acquireVerificationLock(shitennoDir)) {
      daemonLog(logPath, "INFO", "Verificação já em andamento em outro processo (ex: close-session) — pulando esta rodada");
      return;
    }
    try {
      do {
        pendingReVerification = false;
        // ... resto igual ao Bloco J.4 (loop de runAutoVerification + checkAndArchiveDonePlans)
      } while (pendingReVerification);
    } finally {
      releaseVerificationLock(shitennoDir);
    }
  })();

  await verificationInFlight;
  verificationInFlight = null;
}
```

**Uso no checkpoint de fim de sessão (`close-session.ts`, dentro de `checkPlanLifecycle`, Bloco F.4):**

```typescript
import { acquireVerificationLock, releaseVerificationLock } from '../verification-lock.js'; // ajustar path relativo real

async function checkPlanLifecycle() {
  try {
    const shitennoDir = resolve(ROOT, '.shitenno');

    if (!acquireVerificationLock(shitennoDir)) {
      warn('PLAN_LIFECYCLE', 'Verificação já em andamento pelo daemon — pulando, o daemon vai concluir sozinho');
      return;
    }

    try {
      // ... resto igual ao Bloco F.4 (detectActivePlans + runAutoVerification pra cada plano em check)
    } finally {
      releaseVerificationLock(shitennoDir);
    }
  } catch {
    warn('PLAN_LIFECYCLE', 'Plan lifecycle module not available — run pnpm build first');
  }
}
```

**Critério de aceite:** iniciar uma verificação manualmente (simular travando um teste por alguns segundos) e, enquanto ela roda, disparar o checkpoint de fim de sessão em paralelo → o segundo processo detecta o lock, loga que está pulando, e não escreve no mesmo `.verification.json`. Matar o processo do daemon no meio de uma verificação (`kill -9`) e rodar de novo → o lock órfão é detectado e removido automaticamente, não trava o sistema pra sempre.

---

## K.2 — Varredura de planos órfãos ao iniciar o daemon

O daemon já tem exatamente o lugar certo pra isso: o bloco de "Initial Startup Scan" (`daemon/index.ts`, dentro do `setImmediate`, ~linha 260-290) já roda `checkAndArchiveDonePlans` e `checkInconsistencies` uma vez ao ligar. Só falta adicionar um terceiro passo: varrer por planos esquecidos em `check`.

```typescript
// daemon/index.ts, dentro do mesmo bloco setImmediate do startup scan, como passo adicional:

// 4. Verificar planos órfãos em "check" (sessão anterior fechou sem rodar o pipeline)
try {
  const engine = new MarkdownPlanEngine(shitennoDir);
  const orphanedCheck = engine.listAll().filter((p) => p.isActive && p.status === "check");
  if (orphanedCheck.length > 0) {
    daemonLog(logPath, "WARN", `Startup scan: ${orphanedCheck.length} plano(s) órfão(s) em 'check' — rodando verificação agora`);
    await verifyAllPendingPlans(); // mesma função do Bloco J.4/K.1, já cobre lock e loop
  }
  recordEvent(state, "startup_scan.verify_orphaned_check");
} catch (err) {
  daemonLog(logPath, "ERROR", `Startup scan: verificação de planos órfãos falhou: ${err}`);
}
```

Isso fecha o cenário que você descreveu: sessão fecha sem passar pelo `close-session.ts` (crash, terminal fechado bruscamente) e o daemon também não estava rodando naquele momento — na próxima vez que o daemon subir (próxima sessão, ou reinício manual), esse passo pega o plano esquecido antes de qualquer outra coisa acontecer.

**Nota:** isso ainda depende de o daemon ser iniciado em algum momento. Se o usuário nunca mais roda `shugo daemon start` nem fecha sessão pelo ritual normal, o plano fica órfão de fato — não existe camada de segurança 100% automática pra esse caso extremo sem depender de *algum* processo rodar em algum momento. É por isso que o Bloco F.5 (reminder de prioridade que aparece no briefing) continua importante como rede de segurança final: mesmo que a verificação em si demore a rodar, o humano é avisado na próxima vez que abrir uma sessão, de um jeito ou de outro.

**Critério de aceite:** deixar um plano em `check` propositalmente, desligar o daemon, encerrar a sessão sem rodar `close-session.ts` (simulando um fechamento brusco) → na próxima vez que `shugo daemon start` rodar, o log mostra `Startup scan: 1 plano(s) órfão(s) em 'check'` e a verificação roda antes de qualquer outro evento ser processado.

---

## Ordem de execução recomendada

1. **K.1** — pré-requisito para K.2 (a varredura de startup usa `verifyAllPendingPlans`, que precisa já ter o lock).
2. **K.2** — depende de K.1 e do Bloco J.4 já implementados.

Depois de cada item: `npm run build && npx vitest run`.

## Critério de aceite geral do Bloco K

- Dois processos (daemon + close-session) nunca escrevem no mesmo `.verification.json` ao mesmo tempo — um sempre detecta o lock do outro e pula.
- Lock de processo morto (crash) nunca trava o sistema permanentemente — é detectado e removido na tentativa seguinte.
- Plano esquecido em `check` por uma sessão inteira sem daemon rodando é pego automaticamente na próxima vez que o daemon iniciar, antes de qualquer outro evento.
