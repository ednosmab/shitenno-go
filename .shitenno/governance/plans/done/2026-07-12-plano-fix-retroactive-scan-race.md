# Plano — Corrigir Race Condition no Retroactive Scan (`plan-backlog-sync.ts`)

**Status:** done
**Updated_at:** 2026-07-12T21:14:01.279Z
**Date:** 2026-07-12

> **Contexto:** achado da validação de Fase 1/2 do Shiten Living. `initPlanBacklogSync()`
> corre em todo bootstrap de comando (`bin/shiten.ts:123`), só é saltado quando
> `SHITEN_CHILD` está definido (subprocessos do próprio shiten) — não protege contra
> duas invocações **independentes** do CLI a correr ao mesmo tempo (ex: `post-commit`
> dispara `shiten detect --auto &` em background enquanto o utilizador corre outro
> comando). O bloco de "retroactive scan" no fim da função é incondicional e dispara
> `import().then()` fire-and-forget por cada plano sem entrada no BACKLOG, sem lock
> nem sincronização — duas invocações concorrentes podem escrever em `BACKLOG.md` e
> nos ficheiros de plano ao mesmo tempo.

## 1. Estratégia (duas camadas independentes)

| Camada | Resolve | Custo |
|---|---|---|
| **A. Lock inter-processo** (ficheiro `.locks/plan-backlog-sync.lock`, criação atómica com flag `wx`) | Impede que duas invocações concorrentes corram o scan ao mesmo tempo | Baixo — só `fs`, sem deps novas |
| **B. Cooldown persistido** (`.cache/retroactive-scan-state.json`, TTL curto) | Reduz a frequência do scan em si — hoje corre em *todo* comando, mesmo sem nada ter mudado | Baixo |

As duas camadas são complementares: o lock evita colisão de escrita; o cooldown evita que o scan sequer tente correr a cada `shiten status`, `shiten doctor`, etc., o que já reduz drasticamente a janela de colisão e o custo (readdir + import dinâmico a cada comando).

Alternativa considerada e **rejeitada**: restringir o scan só a `shiten watch`. Resolveria a concorrência de raiz, mas perde a auto-cura para quem não usa `watch` — é uma mudança de comportamento maior do que o bug pede. Fica como opção de recuo se o lock/cooldown se mostrar insuficiente em produção.

## 2. Código sugerido

### 2.1 `src/plan-backlog-sync-lock.ts` (novo ficheiro)

Testei esta implementação isoladamente (Node puro, sem deps) simulando exactamente os
4 cenários abaixo — todos passaram: aquisição livre, aquisição concorrente bloqueada,
aquisição após release, e reclamação de lock "stale" (>30s, processo presumivelmente
morto/pendurado).

```typescript
import { writeFileSync, unlinkSync, statSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const LOCK_STALE_MS = 30_000; // lock mais velho que isto = processo dono provavelmente morto/pendurado

function lockPath(shitenDir: string): string {
  const locksDir = join(shitenDir, ".locks");
  mkdirSync(locksDir, { recursive: true });
  return join(locksDir, "plan-backlog-sync.lock");
}

/**
 * Tenta adquirir o lock do retroactive scan.
 * Atómico via flag "wx" — o SO garante que o open falha com EEXIST
 * se o ficheiro já existir, sem race entre check-then-write.
 */
export function acquireScanLock(shitenDir: string): boolean {
  const path = lockPath(shitenDir);
  const payload = JSON.stringify({ pid: process.pid, acquiredAt: new Date().toISOString() });

  try {
    writeFileSync(path, payload, { flag: "wx" });
    return true;
  } catch (err: any) {
    if (err.code !== "EEXIST") throw err;
  }

  // Lock já existe — reclamar se estiver "stale"
  try {
    const stat = statSync(path);
    if (Date.now() - stat.mtimeMs > LOCK_STALE_MS) {
      unlinkSync(path);
      writeFileSync(path, payload, { flag: "wx" });
      return true;
    }
  } catch {
    // lock desapareceu entre o statSync e agora (outro processo libertou-o) — última tentativa
    try {
      writeFileSync(path, payload, { flag: "wx" });
      return true;
    } catch {
      return false;
    }
  }

  return false;
}

export function releaseScanLock(shitenDir: string): void {
  try {
    unlinkSync(lockPath(shitenDir));
  } catch {
    // já não existe — nada a fazer
  }
}
```

### 2.2 Cooldown persistido (adicionar a `plan-backlog-sync.ts` ou ficheiro próprio)

```typescript
interface ScanState { lastScanAt: string; }

const SCAN_COOLDOWN_MS = 15_000;

function scanStatePath(shitenDir: string): string {
  const cacheDir = join(shitenDir, ".cache");
  mkdirSync(cacheDir, { recursive: true });
  return join(cacheDir, "retroactive-scan-state.json");
}

function shouldSkipScan(shitenDir: string): boolean {
  const path = scanStatePath(shitenDir);
  if (!existsSync(path)) return false;
  try {
    const state: ScanState = JSON.parse(readFileSync(path, "utf-8"));
    return Date.now() - new Date(state.lastScanAt).getTime() < SCAN_COOLDOWN_MS;
  } catch {
    return false; // estado ilegível → não bloquear o scan por isso
  }
}

function markScanRun(shitenDir: string): void {
  writeFileSync(scanStatePath(shitenDir), JSON.stringify({ lastScanAt: new Date().toISOString() }));
}
```

### 2.3 Integração em `initPlanBacklogSync` — substituir o bloco final

O bloco actual dispara `import().then()` por plano sem juntar as promises nem
libertar nada. A versão corrigida junta-as num array e só liberta o lock quando
todas terminam (`Promise.allSettled`), para que um segundo processo que espere pelo
lock não arranque antes das escritas do primeiro terminarem.

```typescript
  // Retroactive scan: process plans that exist but have no BACKLOG entry
  const plansDir = join(shitenDir, "governance", "plans");

  if (existsSync(plansDir) && !shouldSkipScan(shitenDir) && acquireScanLock(shitenDir)) {
    markScanRun(shitenDir);
    const scanPromises: Promise<void>[] = [];

    const backlogPath = join(shitenDir, "docs", "BACKLOG.md");
    const backlog = existsSync(backlogPath) ? readFileSync(backlogPath, "utf-8") : "";

    const planFiles = readdirSync(plansDir).filter(
      (f) =>
        f.endsWith(".md") &&
        !f.startsWith("TEMPLATE") &&
        !f.startsWith("README") &&
        !f.includes("/done/") &&
        !f.includes("/reference/")
    );

    for (const file of planFiles) {
      const planId = file.replace(".md", "");
      const planIdUpper = `BACKLOG-${planId.toUpperCase().replace(/-/g, "_")}`;
      const hasBacklogEntry = backlog.includes(planIdUpper);
      const hasStepsSection = backlog.includes("#### Passos do Plano");

      if (!hasBacklogEntry || (hasBacklogEntry && !hasStepsSection)) {
        const reason = !hasBacklogEntry ? "no BACKLOG entry" : "no steps section";
        logger.info("plan-backlog-sync", `Retroactive scan: processing ${planId} (${reason})`);

        const p = import("./commands/plan.js")
          .then(({ runPrepare }) => runPrepare(projectRoot, shitenDir, planId))
          .then((results) => {
            const done = results.filter((r) => r.status === "done").length;
            const errors = results.filter((r) => r.status === "error").length;
            logger.info("plan-backlog-sync", `Retroactive prepare ${planId}: ${done} done, ${errors} errors`);
            bus.publish("backlog.updated", { planId, stepsCount: done, errorCount: errors, source: "retroactive_scan" });
            if (errors > 0) {
              addImpediment(shitenDir, {
                description: `Retroactive sync failed for ${planId}: ${errors} errors`,
                priority: "high",
                createdAt: new Date().toISOString(),
                category: "plan_sync",
              });
            }
          })
          .catch((err) => {
            logger.error("plan-backlog-sync", `Retroactive prepare failed for ${planId}: ${err}`);
            addImpediment(shitenDir, {
              description: `Retroactive prepare crashed for ${planId}: ${String(err)}`,
              priority: "high",
              createdAt: new Date().toISOString(),
              category: "plan_sync",
            });
          });

        scanPromises.push(p);
      }
    }

    Promise.allSettled(scanPromises).finally(() => releaseScanLock(shitenDir));
  } else if (existsSync(plansDir)) {
    logger.debug("plan-backlog-sync", "Retroactive scan skipped (cooldown activo ou lock detido por outro processo)");
  }
```

Nota: se nenhum ficheiro precisar de processamento, `scanPromises` fica vazio e o
lock é libertado quase de imediato — comportamento correcto.

## 3. Testes a adicionar

1. **Unit — `plan-backlog-sync-lock.test.ts`** (funções puras, sem depender do
   singleton `syncInitialized`): adquirir quando livre → `true`; adquirir quando
   já detido e fresco → `false`; adquirir após `release` → `true`; lock com mtime
   forjado >30s → reclamado (`true`). Reproduzi estes 4 casos manualmente neste
   ambiente (sem vitest disponível) e todos passaram — dá confiança alta na lógica
   antes de portar para o suite real.
2. **Unit — cooldown**: `shouldSkipScan` retorna `true` logo a seguir a
   `markScanRun`; retorna `false` depois de simular o relógio a avançar (ou usar
   TTL pequeno + `setTimeout` no teste).
3. **Integração (recomendado, prioridade menor)**: usar `child_process.spawn` para
   lançar dois processos `shiten` reais contra o mesmo `shitenDir` fixture quase em
   simultâneo e verificar que `BACKLOG.md` não fica corrompido e que cada plano só
   é processado uma vez no total. Mais lento e sensível a timing — não bloqueante
   para fechar este item, mas fecha a lacuna que os unit tests não cobrem (a
   concorrência *entre processos* de facto).

## 4. Critério de saída (reaproveitando o pipeline já desenhado)

- `pnpm test` (inclui os novos unit tests do lock/cooldown) + `pnpm lint` a passar.
- Teste manual: correr `shiten status` duas vezes em rápida sucessão num projecto
  com planos pendentes de sync — confirmar no log que a segunda chamada regista
  "skipped (cooldown activo ou lock detido por outro processo)" em vez de repetir
  o scan.
- Sem regressão no comportamento actual de sync single-process (testes existentes
  de `plan-backlog-sync.test.ts`, se existirem, continuam a passar).

## 5. Nível de confiança

- Lógica do lock e do cooldown: **validada por execução real** neste ambiente
  (Node puro, 4 cenários, todos passaram) — alta confiança.
- Integração no bloco de `initPlanBacklogSync`: **não corrida** contra o código
  real (precisaria de `runPrepare`/`commands/plan.js`, com mais deps transitivas
  do que valeria a pena mockar aqui) — revista por leitura e consistente com o
  padrão já usado no ficheiro, mas por confirmar com `pnpm test` no ambiente do
  seu agente antes de merge.
