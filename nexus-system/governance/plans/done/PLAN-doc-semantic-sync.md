# PLANO — Doc Semantic Sync (drift semântico → reminder → AI)

**Status:** done
**Updated_at:** 2026-07-13T02:42:51.629Z
**Date:** 2026-07-13
**Escopo:** conectar `semantic-drift-detector.ts` (já existe, já testado, **não está ligado a nada**) ao `context_buffer.yaml`, para que o AI veja automaticamente na próxima sessão o que precisa escrever.

---

## 1. Diagnóstico (confirmado lendo o código, não suposição)

| Peça | Estado atual |
|---|---|
| `src/semantic-drift-detector.ts` | **Pronto e testado**, mas `grep` confirma: **nenhum arquivo fora dele próprio o importa**. Código morto. |
| `nexus-system/scripts/sync-docs.ts` | Roda no `pre-commit`. Faz checagem **estrutural** (README vs comandos reais, versão CHANGELOG vs package.json). Gera `nexus-system/reports/doc-sync-{date}.json`. **Não escreve em `context_buffer.yaml`.** |
| `context_buffer.yaml` → `reminders:` | Campo já existe e já é lido: `context-collector.ts` → `loadQuickBoard()` → `briefing.ts` → Quick Board, ordenado por prioridade. **A leitura já funciona.** |
| `src/context-buffer-writer.ts` | Tem `addImpediment()` mas **não tem `addReminder()`**. Essa é a função que falta. |

Conclusão: a arquitetura do teu agente (imagens 1-4) está correta. A peça que falta é literalmente uma função nova + uma chamada a mais no pipeline que já roda. Não é preciso inventar infraestrutura.

---

## 2. Fluxo proposto

```
git commit
   │
   ▼
.husky/pre-commit → pnpm run sync:docs --quiet   (já existe)
   │
   ▼
sync-docs.ts (checagem estrutural, já existe)
   │
   ▼
[NOVO] runSemanticDriftCheck()
   │  scanCodebase() ─── semantic-drift-detector.ts (já existe)
   │  detectDriftBatch() ─ já existe, retorna confidence > 0.3
   │
   ▼
[NOVO] addReminder() em context-buffer-writer.ts
   │  escreve em reminders: do context_buffer.yaml
   │  dedup: não repete se já existe reminder igual
   │
   ▼
Próxima sessão do agente
   │  briefing.ts já lê reminders → Quick Board (ordenado por prioridade)
   ▼
Agente vê, pergunta "quero que eu resolva isso?", usuário confirma, agente escreve a prosa
```

---

## 3. Código — Passo 1: `addReminder()` em `src/context-buffer-writer.ts`

Adicionar ao final do arquivo, espelhando o padrão de `addImpediment` (mesma seção "Impediments" mais abaixo, criar seção equivalente):

```typescript
// ── Reminders ───────────────────────────────────────────────────────────────

import type { ReminderPriority, ReminderCategory } from "./briefing.js";

export interface ReminderInput {
  message: string;
  priority: ReminderPriority;
  category: ReminderCategory;
  createdAt: string;
}

/**
 * Add a reminder to context_buffer.yaml.
 * Appends to the `reminders` array. Deduplicates by message text —
 * não escreve se já existir um reminder com a mesma mensagem (evita spam
 * a cada commit se o drift não foi resolvido ainda).
 */
export function addReminder(
  nexusDir: string,
  reminder: ReminderInput
): { success: boolean; message: string; skipped?: boolean } {
  const content = readBuffer(nexusDir);
  if (content === null) {
    return { success: false, message: "context_buffer.yaml not found" };
  }

  // Dedup: mesma mensagem já presente → não duplicar
  if (content.includes(`message: "${reminder.message}"`)) {
    return { success: true, message: "Reminder already exists, skipped", skipped: true };
  }

  const entry = `  - message: "${reminder.message}"
    priority: "${reminder.priority}"
    category: "${reminder.category}"
    createdAt: "${reminder.createdAt}"
`;

  const remindersRegex = /^reminders:\s*\n/m;
  const match = remindersRegex.exec(content);

  if (match) {
    const insertPos = match.index + match[0].length;
    const updated = content.slice(0, insertPos) + entry + content.slice(insertPos);
    writeBuffer(nexusDir, updated);
    return { success: true, message: `Reminder added: ${reminder.message}` };
  }

  // reminders section não existe — cria no início do arquivo
  const updated = "reminders:\n" + entry + "\n" + content;
  writeBuffer(nexusDir, updated);
  return { success: true, message: `Reminder added (new section): ${reminder.message}` };
}

/**
 * Remove reminders that match a category once resolved.
 * Chamar depois que o agente escrever a doc, para não ficar reminder órfão.
 */
export function clearRemindersByCategory(
  nexusDir: string,
  category: ReminderCategory
): { success: boolean; removed: number } {
  const content = readBuffer(nexusDir);
  if (content === null) return { success: false, removed: 0 };

  const remindersRegex = /^reminders:\s*\n((?:\s+- [\s\S]*?\n)*?)(?=\n|\S)/m;
  const match = remindersRegex.exec(content);
  if (!match?.[1]) return { success: true, removed: 0 };

  const block = match[1];
  const entries = block.split(/(?=^\s+- )/m).filter(e => e.trim().length > 0);
  const kept = entries.filter(e => !e.includes(`category: "${category}"`));
  const removed = entries.length - kept.length;

  if (removed === 0) return { success: true, removed: 0 };

  const newBlock = kept.length > 0 ? kept.join("") : "";
  const updated = content.replace(remindersRegex, `reminders:\n${newBlock}\n`);
  writeBuffer(nexusDir, updated);
  return { success: true, removed };
}
```

**Ponto de atenção:** `clearRemindersByCategory` usa regex mais frágil que `addReminder` — antes de aplicar, escrever um teste específico em `src/__tests__/context-buffer-writer.test.ts` cobrindo: reminders vazio, reminders com 1 item, reminders com múltiplos itens de categorias diferentes. Não aplicar sem esse teste passando.

---

## 4. Código — Passo 2: conectar o detector ao writer

Novo arquivo `src/doc-semantic-sync.ts`:

```typescript
/**
 * doc-semantic-sync.ts — Bridge between semantic-drift-detector and context_buffer.yaml
 *
 * PRINCIPLE: detecção é determinística e barata (roda em todo commit).
 * Escrita de prosa é cara e fica para o AI, sob demanda, na próxima sessão.
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, extname } from "node:path";
import { scanCodebase, detectDriftBatch, type DriftResult } from "./semantic-drift-detector.js";
import { addReminder } from "./context-buffer-writer.js";

function loadDocsForDrift(docsDir: string): Array<{ path: string; content: string; type: string; age?: number }> {
  if (!existsSync(docsDir)) return [];
  const files = readdirSync(docsDir, { recursive: true })
    .filter((f): f is string => typeof f === "string" && extname(f) === ".md");

  return files.map(f => {
    const fullPath = join(docsDir, f);
    const content = readFileSync(fullPath, "utf-8");
    const type = f.includes("adr") ? "adr" : f.includes("runbook") ? "runbook" : "doc";
    return { path: f, content, type };
  });
}

function severityToPriority(confidence: number): "high" | "medium" | "low" {
  if (confidence >= 0.7) return "high";
  if (confidence >= 0.5) return "medium";
  return "low";
}

function formatReminder(result: DriftResult): string {
  const preview = result.missingKeywords.slice(0, 3).join(", ");
  return `Doc desatualizada: ${result.document} — ${result.reason} (${preview})`;
}

export interface SemanticSyncOptions {
  projectRoot: string;
  nexusDir: string;
  docsDir?: string; // default: {projectRoot}/docs
  minConfidence?: number; // default: 0.3 (mesmo threshold do detectDriftBatch)
}

export interface SemanticSyncResult {
  scanned: number;
  driftFound: number;
  remindersWritten: number;
  remindersSkipped: number;
}

/**
 * Roda a detecção de drift semântico e escreve reminders para os casos
 * com confiança suficiente. Idempotente: reminders duplicados são
 * pulados por addReminder().
 */
export function runSemanticDocSync(options: SemanticSyncOptions): SemanticSyncResult {
  const { projectRoot, nexusDir, docsDir = join(projectRoot, "docs") } = options;

  const facts = scanCodebase(projectRoot);
  const docs = loadDocsForDrift(docsDir);
  const driftResults = detectDriftBatch(docs, facts);

  let written = 0;
  let skipped = 0;

  for (const result of driftResults) {
    const outcome = addReminder(nexusDir, {
      message: formatReminder(result),
      priority: severityToPriority(result.confidence),
      category: "docs",
      createdAt: new Date().toISOString(),
    });
    if (outcome.skipped) skipped++;
    else if (outcome.success) written++;
  }

  return {
    scanned: docs.length,
    driftFound: driftResults.length,
    remindersWritten: written,
    remindersSkipped: skipped,
  };
}
```

---

## 5. Código — Passo 3: plugar no `sync-docs.ts` existente

No final do `nexus-system/scripts/sync-docs.ts`, dentro da função `main()` (ou equivalente, próximo de `generateReport()`), adicionar:

```typescript
// Depois de generateReport(), antes do process.exit:
import { runSemanticDocSync } from "../../src/doc-semantic-sync.js";

const semanticResult = runSemanticDocSync({
  projectRoot: ROOT,
  nexusDir: NEXUS,
});

if (!QUIET && semanticResult.driftFound > 0) {
  log(
    `\n🧠 Drift semântico: ${semanticResult.driftFound} doc(s) desalinhado(s). ` +
    `${semanticResult.remindersWritten} reminder(s) novo(s) escrito(s) em context_buffer.yaml.`
  );
}
```

**Isso não muda o exit code do pre-commit.** O sync estrutural continua bloqueando/avisando como já faz; o semântico só registra, nunca bloqueia commit — é informativo, para a próxima sessão do agente.

---

## 6. Critério de saída (como validar que funcionou, sem "achismo")

1. **Teste unitário novo** — `src/__tests__/doc-semantic-sync.test.ts`: mockar `scanCodebase`/`detectDriftBatch` retornando 1 resultado com confidence 0.8, chamar `runSemanticDocSync`, verificar que `context_buffer.yaml` de teste recebeu 1 reminder com `priority: "high"`.
2. **Teste de dedup** — rodar `runSemanticDocSync` duas vezes seguidas com o mesmo drift → segunda chamada deve retornar `remindersSkipped: 1`, `remindersWritten: 0`.
3. **Teste manual end-to-end**: alterar um comando em `src/commands/`, sem atualizar a doc correspondente em `docs/`, rodar `git commit` → conferir que `context_buffer.yaml` ganhou uma entrada nova em `reminders:`.
4. **Teste de leitura**: abrir uma sessão nova do agente depois do passo 3 → confirmar que o reminder aparece no Quick Board (via `briefing.ts`), ordenado por prioridade.
5. `pnpm run typecheck` e `pnpm run lint` passando com os arquivos novos.

Só considerar "pronto" quando os 5 itens acima passarem — não antes.

---

## 7. Riscos e limites (para não vender isso como mais do que é)

- **Não é chamada automática do agente.** Confirma o que a própria análise do teu agente (imagem 4) já concluiu: o AI só age dentro de uma sessão de chat iniciada por você. Isso aqui **prepara o terreno** (reminder visível na próxima sessão) — não dispara o agente sozinho entre sessões.
- **Falsos positivos são esperados.** `semantic-drift-detector.ts` usa fuzzy match por keyword — pode marcar drift em doc que na verdade está certa (ex: menciona uma dependência antiga de propósito, em ADR histórico). Por isso o reminder é só um **aviso**, nunca um auto-fix.
- **Cooldown implícito pelo dedup**, mas não há expiração — um reminder não resolvido fica para sempre até `clearRemindersByCategory` ser chamado (o agente deveria chamar isso depois de escrever a doc). Vale adicionar isso como follow-up: o agente, ao resolver um reminder de categoria `docs`, chama `clearRemindersByCategory(nexusDir, "docs")` no fim da tarefa.

---

## 8. Ordem de aplicação recomendada (para o agente executor)

1. `addReminder` + `clearRemindersByCategory` em `context-buffer-writer.ts` + testes
2. `doc-semantic-sync.ts` novo + testes
3. Hook em `sync-docs.ts`
4. Teste manual end-to-end (item 6.3)
5. Só então: considerar extensão futura para o `file-watcher.ts` (modo daemon), se quiser detecção em tempo real e não só no commit — **não fazer isso na primeira rodada**, validar o fluxo de commit primeiro.
