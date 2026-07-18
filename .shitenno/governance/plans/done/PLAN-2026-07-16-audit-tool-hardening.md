# Plano de Ação — Endurecimento do `shiten audit` (o Próprio Mecanismo)

**Status:** Done

**Data:** 2026-07-16
**Origem:** AUDIT-2026-07-16-end-to-end-execution-report.md + investigação adicional pós-execução
**Escopo:** bugs no próprio motor de auditoria, não no projeto que ele audita. Os achados de `xss_risk` e `dep_confusion` (falso positivo por auto-referência) já têm fix descrito em PLAN-2026-07-16-security-findings-remediation.md, Achados 0 e 5 — **não duplicar aqui**, só referenciar.

---

## Achados que motivam este plano

| # | Achado | Gravidade |
|---|---|---|
| 1 | Nenhum isolamento de falha entre detectores — um detector que lança exceção derruba a auditoria inteira | Alta — robustez do produto |
| 2 | `detectHighComplexity` usa parser artesanal (regex + contagem de chaves) em vez do TypeScript Compiler API já disponível no projeto — e **atribui complexidade à função errada** (confirmado: `clearCache()`, 1 linha, reportado com complexidade 55; a real culpada é `visit()`, 207 linhas, no mesmo arquivo) | Alta — não é só impreciso, direciona remediação para o lugar errado |
| 3 | Plugin de exemplo `health-check` roda na auto-auditoria do próprio projeto, olhando `tests/` de forma não-recursiva, e relata "nenhum teste" num projeto com ~2000 testes reais em `src/__tests__/` | Média — ruído enganoso em toda execução |
| 4 | Campo `confidence` existe no schema de `HealthIssue` mas só 8 dos ~170 detectores o populam — os detectores heurísticos (mais propensos a erro, como os dos achados 1-3) reportam confiança implícita 1.0, igual aos baseados em Compiler API | Média — mistura sinal certo com sinal incerto sem diferenciação |

---

## FASE 1: Isolamento de Falha por Detector (0.5-1 dia)

**Ficheiro:** `src/health-auditor.ts`, dentro do loop de execução

**Antes:**
```typescript
for (const [name, fn] of Object.entries(detectorMap)) {
  if (activeDetectors.has(name)) {
    if (changedFiles && changedFiles.length > 0 && CROSS_FILE_ONLY_DETECTORS.has(name)) {
      continue;
    }
    issues.push(...fn());
  }
}
```

**Depois:**
```typescript
const detectorErrors: { name: string; error: string }[] = [];

for (const [name, fn] of Object.entries(detectorMap)) {
  if (!activeDetectors.has(name)) continue;
  if (changedFiles && changedFiles.length > 0 && CROSS_FILE_ONLY_DETECTORS.has(name)) continue;

  try {
    issues.push(...fn());
  } catch (err) {
    detectorErrors.push({ name, error: err instanceof Error ? err.message : String(err) });
    logger.warn("health-auditor", `Detector "${name}" failed: ${err}`);
  }
}

// Um detector quebrado vira um issue de baixa severidade sobre si mesmo,
// não uma falha silenciosa nem uma queda total da auditoria
for (const { name, error } of detectorErrors) {
  issues.push({
    type: "detector_failure",
    severity: 2,
    description: `Detector "${name}" failed to run: ${error}`,
    location: `src/audit/ (detector: ${name})`,
    recommendation: `Investigar e corrigir o detector "${name}" — resultados desta categoria podem estar incompletos nesta execução`,
    confidence: 1.0,
  });
}
```

Adicionar `"detector_failure"` a `HealthIssueType` (`src/audit/types.ts`) e expor `detectorErrors`/contagem no relatório final (`HealthAuditReport`), para que `shiten audit` mostre claramente "N detectores falharam" em vez de esconder isso dentro dos issues genéricos.

**Critério de aceite:** um teste que injeta um detector fake lançando exceção no meio de `buildDetectorMap` confirma que (a) os outros detectores continuam rodando normalmente, (b) o relatório final inclui um issue `detector_failure` visível, (c) o processo não sai com código de erro fatal por causa disso.

---

## FASE 2: Migrar `detectHighComplexity` para o TypeScript Compiler API (2-2.5 dias)

**Não reescrever do zero — reaproveitar a infraestrutura já validada em `src/audit/taint/analyzer.ts`.** O projeto já paga o custo de construir um `ts.Program` para taint analysis; o detector de complexidade pode consumir o mesmo programa em vez de duplicar o parsing.

**Ficheiro novo:** `src/audit/complexity/analyzer.ts`

```typescript
import * as ts from "typescript";

interface ComplexityResult {
  functionName: string;
  line: number;
  complexity: number;
}

/** Nós de decisão que incrementam a complexidade ciclomática (McCabe). */
function isDecisionPoint(node: ts.Node): boolean {
  return (
    ts.isIfStatement(node) ||
    ts.isConditionalExpression(node) || // ternário
    ts.isCaseClause(node) ||
    ts.isForStatement(node) || ts.isForInStatement(node) || ts.isForOfStatement(node) ||
    ts.isWhileStatement(node) || ts.isDoStatement(node) ||
    ts.isCatchClause(node) ||
    (ts.isBinaryExpression(node) &&
      (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
       node.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
       node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken))
  );
}

function getFunctionName(node: ts.FunctionLikeDeclaration, sourceFile: ts.SourceFile): string {
  if (node.name && ts.isIdentifier(node.name)) return node.name.text;
  if (ts.isConstructorDeclaration(node)) return "constructor";
  // Arrow function atribuída a const/let: pegar o nome da variável
  if (ts.isArrowFunction(node) && ts.isVariableDeclaration(node.parent) && ts.isIdentifier(node.parent.name)) {
    return node.parent.name.text;
  }
  return `<anonymous@${sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1}>`;
}

export function analyzeComplexity(program: ts.Program, sourceFile: ts.SourceFile): ComplexityResult[] {
  const results: ComplexityResult[] = [];

  function visitFunction(fnNode: ts.FunctionLikeDeclaration): void {
    let complexity = 1; // baseline McCabe
    function count(node: ts.Node): void {
      if (isDecisionPoint(node)) complexity++;
      // Não descer para dentro de funções aninhadas — cada uma tem sua própria contagem
      if (node !== fnNode && ts.isFunctionLike(node)) return;
      ts.forEachChild(node, count);
    }
    count(fnNode.body ?? fnNode);

    const { line } = sourceFile.getLineAndCharacterOfPosition(fnNode.getStart());
    results.push({ functionName: getFunctionName(fnNode, sourceFile), line: line + 1, complexity });
  }

  function walk(node: ts.Node): void {
    if (ts.isFunctionLike(node) && node.body) visitFunction(node);
    ts.forEachChild(node, walk);
  }
  walk(sourceFile);

  return results;
}
```

**Ficheiro:** `src/audit/engineering-detectors-quality.ts` — trocar a implementação de `detectHighComplexity` para consumir `analyzeComplexity`:

```typescript
import { analyzeComplexity } from "./complexity/analyzer.js";
import { getOrCreateProgram } from "./taint/analyzer.js"; // expor esse helper se ainda for privado — ver nota abaixo

export function detectHighComplexity(projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const program = getOrCreateProgram(projectRoot); // reaproveita o Program já usado pelo taint analyzer

  for (const file of files) {
    if (file.relPath.includes("__tests__")) continue;
    const sourceFile = program.getSourceFile(file.absPath);
    if (!sourceFile) continue;

    for (const result of analyzeComplexity(program, sourceFile)) {
      if (result.complexity > COMPLEXITY_WARNING_THRESHOLD) {
        issues.push({
          type: "high_complexity",
          severity: result.complexity > COMPLEXITY_CRITICAL_THRESHOLD ? 3 : 2,
          description: `Alta complexidade ciclomática em "${file.relPath}:${result.line}" (${result.functionName}): complexidade ${result.complexity} (máx: ${COMPLEXITY_WARNING_THRESHOLD})`,
          location: `${file.relPath}:${result.line}`,
          recommendation: `Considerar dividir "${result.functionName}" em funções menores`,
          confidence: 1.0, // agora é medição exata via AST, não heurística
        });
      }
    }
  }
  return issues;
}
```

**Nota para o agente:** `TaintAnalyzer.programCache` (o cache estático já existente em `analyzer.ts`) deve ser exposto/reaproveitado via um helper `getOrCreateProgram(projectRoot)`, em vez de cada detector construir seu próprio `ts.Program` — isso é caro (parseia todo o projeto) e não deve ser duplicado entre `detectHighComplexity`, `TaintAnalyzer`, e qualquer detector futuro que precise de AST real. Extrair isso como uma função compartilhada em `src/audit/ts-program-cache.ts` é o refactor certo, mesmo que aumente ligeiramente o escopo desta fase.

**Critério de aceite:**
- Rodar `shiten audit --level enterprise --no-cache` no próprio projeto depois da migração: o achado antes atribuído a `clearCache` (complexidade 55) deve desaparecer de lá e aparecer corretamente em `visit()`, linha ~206.
- Teste unitário com um arquivo fixture contendo duas funções (uma trivial, uma complexa) confirma que a complexidade é atribuída à função certa.
- Nenhuma regressão nos outros achados de `high_complexity` já confirmados como reais (ex.: `commands/audit.ts:238`, complexidade 93) — o número pode mudar levemente (medição exata vs. heurística), mas a localização deve continuar correta ou melhorar.

**Ficheiros candidatos à mesma migração, fora do escopo desta fase mas registrados como próximo passo:** qualquer outro detector em `engineering-detectors-quality.ts` que hoje use `branchRegex`/parsing manual de linha (`detectDeepNesting`, `detectGodFunction`, `detectLongParams` — verificar cada um antes de assumir que têm o mesmo problema).

---

## FASE 3: Corrigir o Plugin de Exemplo `health-check` (0.5 dia)

**Duas opções, escolher uma:**

**Opção A (recomendada) — tornar a busca de testes correta e configurável, já que o plugin é um exemplo real usado por projetos scaffolded via `shiten init`:**
```typescript
// src/templates/base/plugins/health-check/plugin.ts
function findTestFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const entries = readdirSync(dir, { withFileTypes: true });
  let results: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== "node_modules") {
      results = results.concat(findTestFiles(full));
    } else if (entry.isFile() && (entry.name.endsWith(".test.ts") || entry.name.endsWith(".test.js"))) {
      results.push(full);
    }
  }
  return results;
}

// Checar as convenções mais comuns, não só "tests/" na raiz
const candidateDirs = ["tests", "test", "src/__tests__", "src"];
const testFiles = candidateDirs.flatMap((d) => findTestFiles(join(projectRoot, d)));
if (testFiles.length === 0) {
  issues.push("No test files found — consider adding tests");
}
```

**Opção B — não rodar o plugin de exemplo durante a auto-auditoria do repositório do Shitenno-go em si**, já que ele é um template para projetos-filhos, não parte do produto principal. Adicionar um marcador (`shitenno-go/.shiten-plugins-disabled` ou similar) ou excluir `src/templates/` do carregamento de plugins quando `shitenDir` aponta para o próprio repositório do Shitenno.

**Recomendação:** Opção A é mais valiosa — corrige o plugin para todo mundo que o usa via `shiten init`, não só para a auto-auditoria. Opção B é um band-aid só para este projeto.

**Critério de aceite:** rodar `shiten audit` no próprio projeto depois do fix — a mensagem "No test files found" não aparece mais, dado que `src/__tests__/` tem ~2000 arquivos de teste reais.

---

## FASE 4: Popular `confidence` de Forma Consistente (0.5-1 dia)

Estabelecer uma convenção simples e aplicá-la:

| Método de detecção | `confidence` |
|---|---|
| TypeScript Compiler API (AST real) | `1.0` |
| Parsing estruturado (JSON/YAML válido) | `0.9` |
| Regex/heurística de texto sobre código-fonte | `0.6-0.7` |
| Heurística sobre nomes/convenções (ex.: "arquivo termina em `-supply.ts`, deve ser dependência") | `0.5` |

Aplicar retroativamente aos detectores que hoje não populam `confidence` (a maioria) — começando pelos que já se mostraram propensos a falso positivo nesta auditoria (`detectXSS`, o detector de `dep_confusion`, e qualquer outro ainda baseado em regex de string).

**Critério de aceite:** `shiten audit --level enterprise` reporta `confidence` em pelo menos 80% dos issues gerados (hoje é ~8 detectores de ~170). O comando de output (`commands/audit.ts`) já pode, opcionalmente, ordenar ou destacar achados de baixa confiança separadamente — não obrigatório nesta fase, mas registrar como melhoria natural de UX depois.

---

## Sequenciamento

```
DIA 1:      Fase 1 (isolamento de falha por detector)
DIA 2-4.5:  Fase 2 (migração do detector de complexidade para Compiler API)
DIA 5:      Fase 3 (fix do plugin de exemplo health-check)
DIA 5.5-6.5: Fase 4 (popular confidence)
```

**Total: ~6.5 dias.** Independente dos outros seis planos — não compartilha módulos com nenhum deles (mexe só em `health-auditor.ts`, `audit/engineering-detectors-quality.ts`, `audit/complexity/`, `templates/base/plugins/health-check/`). Pode rodar em paralelo a qualquer outro plano já desenhado, incluindo o de remediação de segurança (que cobre XSS/dep_confusion, arquivos diferentes).

---

## Métricas de Sucesso

| Métrica | Antes | Depois |
|---|---|---|
| Detector com exceção derruba a auditoria inteira | Sim | Não — vira `detector_failure`, severidade 2 |
| `detectHighComplexity` usa Compiler API | Não (regex/brace-counting) | Sim, reaproveitando `ts.Program` do taint analyzer |
| Atribuição de complexidade ao arquivo/linha corretos | Confirmado incorreto em pelo menos 1 caso | Corrigido, com teste de regressão |
| Plugin de exemplo relatando "0 testes" num projeto com ~2000 | Sim | Não |
| Detectores com `confidence` populado | ~8/170 | ≥80% |
