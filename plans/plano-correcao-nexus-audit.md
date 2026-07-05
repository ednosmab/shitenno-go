# Plano: Corrigir e evoluir o `nexus audit` (health-auditor + TaintAnalyzer)

**Data:** 2026-07-04
**Base:** review técnico + execução real (`nexus init`, `nexus audit --level full`,
fixtures isolados) + correções já aplicadas e validadas em runtime nesta sessão.
**Objetivo:** sair do estado atual (motor de segurança morto, score sem sinal,
falsos positivos altos) para um audit consistente, eficiente e com cobertura
mais ampla — sem inflar o número de "detectores" só por inflar.

---

## Estado validado nesta sessão (não é suposição — foi executado)

| Item | Como foi validado | Resultado |
|---|---|---|
| `require()` em ESM quebra `nexus init` | Rodei o CLI de verdade | Confirmado e corrigido |
| `TaintAnalyzer` nunca rodava (catch silencioso) | `tainted_input` = 0 em 637 issues reais | Confirmado e corrigido |
| Travessia pré-ordem impede detecção mesmo com motor "ligado" | Fixture `eval(process.argv[2])` | 0→1 issue depois do fix |
| Identidade de variável inconsistente (`getSymbolName` vs `getPropertyAccessName`) | Fixture `const x = process.argv; eval(x)` | 0→1 issue |
| Aresta fonte→sink comparando campo errado (`description` vs nome) | Mesmo fixture acima | Aresta nunca criada → corrigida |
| Aresta faltante em `const`/`let` com inicializador | Fixture multi-hop `argv→userInput→path→sinks` | 0/3 → 3/3 achados corretos |
| `AsExpression`/parênteses quebram resolução de símbolo | `process.env.X as string` | Não detectado → detectado após unwrap |
| `crossFile` é opção fantasma | `grep` — só declarada, nunca lida | Confirmado |
| Fontes não cobrem CLIs Commander.js (só Express/browser/WS/DB) | 0 issues no próprio repo mesmo com motor corrigido | Confirmado — gap real, não falso negativo aleatório |
| Suíte de testes estoura heap (OOM) | `npx vitest run health-auditor.test.ts` | Confirmado — cada teste sobe `ts.Program` novo sem descarte |
| `TaintAnalyzer` duplica trabalho do resto do auditor | `collectSourceFiles` já lê tudo; `TaintAnalyzer` cria um `ts.Program` próprio do zero | Duas passadas de parsing pro mesmo projeto |
| `console_secret`/`xss_risk` com alta taxa de falso positivo | Amostra manual — 20/20 falsos positivos em `console_secret` | Confirmado |
| `healthScore` satura em 0 com poucos criticals | Fórmula linear sem normalização | Confirmado — 0/100 com 55 criticals de 637 |
| `detectPathTraversal` (regex) não cobre passagem direta | Teste `SEC-09` já existente falhando | Confirmado |

---

## Fase 0 — Motor de taint funcional de ponta a ponta (já parcialmente aplicado nesta sessão)

> Estes diffs já foram testados em runtime contra fixtures reais nesta
> conversa. Aplicar no código-fonte real do repositório (a cópia usada aqui
> foi só pra validação).

### 0.1 — Destravar o import (bloqueador)
```diff
+ import { TaintAnalyzer } from "./audit/taint/index.js";
  import type { TaintIssue } from "./audit/taint/types.js";
```

```diff
  detectTaintFlow: () => {
    try {
-     const taint = require("./audit/taint/index.js") as typeof import("./audit/taint/index.js");
-     const analyzer = new taint.TaintAnalyzer({ projectRoot });
+     const analyzer = new TaintAnalyzer({ projectRoot });
```

### 0.2 — Travessia pós-ordem (achado nesta sessão — mais crítico que os bugs de identidade sozinhos)
```diff
  private visit(node: ts.Node, sourceFile: ts.SourceFile): void {
+   // Pós-ordem: filhos primeiro, para que fontes aninhadas (ex.: process.argv
+   // dentro de eval(process.argv[2]) ou dentro do inicializador de um const)
+   // já estejam registradas antes de checarmos o nó atual.
+   ts.forEachChild(node, (child) => this.visit(child, sourceFile));
+
    // 1. Detect taint sources
    if (ts.isPropertyAccessExpression(node)) {
      ...
-   // Recurse into children
-   ts.forEachChild(node, (child) => this.visit(child, sourceFile));
  }
```

**Lógica:** numa AST, o pai é visitado antes dos filhos por padrão
(`forEachChild` no fim). Qualquer checagem de "meu argumento/inicializador já
está tainted?" feita no nó pai roda antes do filho (a fonte real) ter chance
de se registrar. Mover a recursão pro início inverte isso.

### 0.3 — Unificar identidade de variável + desembrulhar `as`/parênteses
```diff
  private getSymbolName(node: ts.Node): string | undefined {
+   if (ts.isAsExpression(node) || ts.isParenthesizedExpression(node) || ts.isNonNullExpression(node)) {
+     return this.getSymbolName(node.expression);
+   }
+   if (ts.isPropertyAccessExpression(node)) {
+     return this.getPropertyAccessName(node);
+   }
+   if (ts.isElementAccessExpression(node)) {
+     return this.getSymbolName(node.expression);
+   }
    const symbol = this.checker.getSymbolAtLocation(node);
    if (symbol) return symbol.getName();
    if (ts.isIdentifier(node)) return node.getText();
    return undefined;
  }
```

E no registro da fonte (seção 1), usar a mesma chave (`fullName`) em vez de
`symbol?.getName() ?? fullName` — os dois lados da comparação precisam
concordar sobre "o que é o nome de uma variável".

### 0.4 — Corrigir a aresta fonte→sink e a aresta faltante em `const`/`let`
```diff
              isTainted = true;
-             sourceVar = varInfo.source?.description ?? argName;
+             sourceVar = argName;
```
```diff
            const sourceNode = this.graph.getNodes().find(
-             (n) => n.kind === "source" && n.variableName === sourceVar,
+             (n) => (n.kind === "source" || n.kind === "assignment") && n.variableName === sourceVar,
            );
```
E na seção de `const x = <fonte>` (hoje só cria o nó, nunca a aresta):
```diff
          this.graph.addNode(taintNode);
+         const initNode = this.graph.getNodes().find(
+           (n) => (n.kind === "source" || n.kind === "assignment") && n.variableName === initName,
+         );
+         if (initNode) {
+           this.graph.addEdge({ from: initNode.id, to: nodeId, kind: "assignment" });
+         }
```

### 0.5 — Implementar propagação por parâmetro (hoje é stub vazio)
```diff
- if (ts.isFunctionDeclaration(node) || ts.isArrowFunction(node) || ts.isMethodDeclaration(node)) {
-   for (const param of node.parameters) {
-     const paramName = param.name.getText();
-     // Check if this parameter is called with tainted data (handled in call sites)
-   }
- }
+ if (ts.isCallExpression(node)) {
+   const signature = this.checker.getResolvedSignature(node);
+   const declaration = signature?.getDeclaration();
+   if (declaration && (ts.isFunctionDeclaration(declaration) || ts.isArrowFunction(declaration) || ts.isMethodDeclaration(declaration) || ts.isFunctionExpression(declaration))) {
+     node.arguments.forEach((arg, index) => {
+       const argName = this.getSymbolName(arg);
+       const argInfo = argName ? this.variableTaint.get(argName) : undefined;
+       if (argInfo?.tainted) {
+         const param = declaration.parameters[index];
+         if (param) {
+           const paramName = param.name.getText();
+           this.variableTaint.set(paramName, { name: paramName, tainted: true, source: argInfo.source, declarations: [param] });
+         }
+       }
+     });
+   }
+ }
```

### 0.6 — Cobrir o padrão real de entrada de CLIs Commander.js (gap novo, achado ao testar contra o próprio repo)
`sources.ts` hoje só reconhece Express/Koa (`req.*`), browser, WebSocket, DB
rows, `process.argv/env`, `readFileSync`. Um projeto CLI baseado em Commander
recebe input via `.option()` + callback de `.action((opts) => ...)` — esse
padrão não existe na lista, então o motor fica cego pro próprio tipo de
projeto que audita (confirmado: 0 issues no nexus-system mesmo após todos os
fixes acima).

```diff
  // src/audit/taint/sources.ts
+ /** Commander.js CLI sources */
+ export const CLI_SOURCES: TaintSourceDef[] = [
+   { pattern: /^opts$/, kind: "parameter", description: "opts — Commander.js parsed CLI options" },
+   { pattern: /^options$/, kind: "parameter", description: "options — Commander.js parsed CLI options" },
+ ];

  export const ALL_SOURCES: TaintSourceDef[] = [
    ...HTTP_SOURCES,
    ...PROCESS_SOURCES,
    ...DOM_SOURCES,
    ...WS_SOURCES,
    ...DB_SOURCES,
    ...FS_SOURCES,
+   ...CLI_SOURCES,
  ];
```

E no analyzer, marcar como tainted o **parâmetro de callbacks passados pra
`.action(...)`** — é um caso especial de "parâmetro de função" cuja origem
não é uma chamada rastreável no código do usuário (o Commander injeta o
valor em runtime), então precisa de uma regra própria:
```typescript
// Heurística: parâmetro de uma arrow function/function expression que é o
// único argumento (ou primeiro) de uma chamada `.action(...)` é tainted por definição.
if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "action") {
  const callback = node.arguments[0];
  if (callback && (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))) {
    const param = callback.parameters[0];
    if (param) {
      const paramName = param.name.getText();
      this.variableTaint.set(paramName, {
        name: paramName, tainted: true,
        source: { pattern: /^opts$/, kind: "parameter", description: "Commander .action() callback parameter" },
        declarations: [param],
      });
    }
  }
}
```

**Critério de aceite da Fase 0 inteira:** os 4 fixtures usados na validação
(`eval(process.argv[2])`, `let x; x = process.argv`, `const x = process.argv`,
o fixture multi-hop de 3 vulnerabilidades) continuam passando; e um fixture
novo simulando `.action((opts) => readFileSync(opts.path))` gera 1 issue.

---

## Fase 0.7 — Parar de duplicar trabalho de parsing (eficiência)

`collectSourceFiles()` já lê todos os arquivos do projeto uma vez (texto puro,
usado pelos 61 detectores regex). O `TaintAnalyzer` cria seu **próprio**
`ts.createProgram` do zero, reprocessando os mesmos arquivos como AST — dobro
de I/O e de parsing no mesmo `nexus audit`.

**Lógica de aplicabilidade:** não dá pra eliminar o `ts.Program` (os
detectores regex não precisam de AST, mas o taint analyzer precisa), então a
otimização certa não é "compartilhar tudo", é **criar o `Program` uma vez só
por execução do `audit`** e reaproveitar entre chamadas, em vez de recriar a
cada `new TaintAnalyzer()`. Hoje isso já é por execução (um `TaintAnalyzer`
por `nexus audit`), então o ganho real está em cachear o `Program` entre
execuções (`--no-cache` já existe como flag — inverter o padrão: cachear por
default, hash de `tsconfig.json` + lista de arquivos como chave de
invalidação).

```typescript
// Pseudocódigo de cache simples baseado em hash do tsconfig + mtimes
const cacheKey = hashFiles([join(projectRoot, "tsconfig.json"), ...sourceFilePaths.map(f => f + ":" + statSync(f).mtimeMs)]);
if (cache.has(cacheKey)) return cache.get(cacheKey);
```

**Critério de aceite:** rodar `nexus audit --level full` duas vezes seguidas
sem alterar nenhum arquivo — a segunda execução deve ser sensivelmente mais
rápida (medir com `time`).

---

## Fase 0.8 — Corrigir o OOM da suíte de testes (achado nesta sessão)

`npx vitest run src/__tests__/health-auditor.test.ts` estoura heap
(`FATAL ERROR: Reached heap limit`) porque cada teste `SEC-*` cria um projeto
temporário + roda `auditHealth()` completo, e cada chamada ao `TaintAnalyzer`
sobe um `ts.Program` pesado sem que nada seja liberado entre testes (GC não
alcança porque referências ficam presas em cache/closures do Vitest worker).

**Ação:** isolar os testes que instanciam `TaintAnalyzer`/`ts.Program` em
arquivos de teste separados (`--pool=forks` com `singleFork: false` já ajuda,
mas o ideal é reduzir escopo: cada teste `SEC-*` não precisa rodar
`auditHealth` completo — só a função `detect*` específica sendo testada).
Isso também deixa os testes ~5x mais rápidos (hoje 3-5s cada, a maioria do
tempo é overhead de rodar 40 outros detectores irrelevantes ao teste).

```diff
- const report = auditHealth(projectRoot, nexusDir, "full");
- const pathIssues = report.issues.filter((i) => i.type === "path_traversal");
+ const files = collectSourceFiles(projectRoot); // já existe, exportar se preciso
+ const pathIssues = detectPathTraversal(projectRoot, files); // chamar só o detector sob teste
```

**Critério de aceite:** `npx vitest run src/__tests__/health-auditor.test.ts`
roda até o fim sem OOM, com heap padrão (sem precisar de
`--max-old-space-size`).

---

## Fase 1 — `require()` no resto do código (bloqueadores adicionais)

Mesma classe de bug da Fase 0.1, em outros arquivos ESM:
`digest.ts`, `goal.ts`, `update.ts`, `engineering-state-evolved.ts`,
`doc-lifecycle-auditor.ts`, `goal-engine.ts`. Trocar cada `require()` por
`import` estático (ou `await import()` se houver ciclo real). Validar com
`grep -rn "require(" src --include="*.ts" | grep -v __tests__` retornando
vazio.

---

## Fase 2 — Fórmula de `calculateHealthScore` (consistência do sinal)

```diff
- function calculateHealthScore(issues: HealthIssue[]): number {
-   let score = 100;
-   for (const issue of issues) {
-     if (issue.severity === 3) score -= 20;
-     else if (issue.severity === 2) score -= 10;
-     else score -= 3;
-   }
-   return Math.max(0, Math.min(100, score));
- }
+ function calculateHealthScore(issues: HealthIssue[], totalFiles: number): number {
+   const weights = { 3: 5, 2: 2, 1: 0.5 };
+   const rawPenalty = issues.reduce((sum, i) => sum + weights[i.severity], 0);
+   const normalizer = Math.max(totalFiles, 10);
+   const density = rawPenalty / normalizer;
+   const score = 100 * Math.exp(-density * 2);
+   return Math.max(0, Math.min(100, Math.round(score)));
+ }
```

Calibrar as constantes com 3-5 projetos de referência reais antes de fixar;
documentar a decisão num ADR.

---

## Fase 3 — Reduzir falsos positivos (acurácia)

### 3.1 `console_secret` — regex sem boundary
```diff
  const sensitivePatterns = [
-   /console\.(log|info|warn|error|debug)\s*\(.*(?:password|token|secret|key|credential)/i,
+   /console\.(log|info|warn|error|debug)\s*\(.*\b(?:password|api[_-]?key|access[_-]?token|auth[_-]?token|secret|credential)s?\b/i,
    /console\.(log|info|warn|error|debug)\s*\(.*(?:req\.headers|req\.cookies)/i,
  ];
```
Nunca usar `key`/`token` sozinhos — só combinados (`api_key`, `access_token`).

### 3.2 Detectores de segurança auto-detectando os próprios arquivos de definição
```typescript
const SECURITY_DETECTOR_SELF_PATHS = ["src/health-auditor.ts", "src/audit/taint/"];
function isDetectorDefinitionFile(relPath: string): boolean {
  return SECURITY_DETECTOR_SELF_PATHS.some((p) => relPath.startsWith(p));
}
```

Adicionar `if (isDetectorDefinitionFile(file.relPath)) continue;` em todo
detector `SEC-*` que escaneia texto/regex.

---

## Fase 4 — Fechar gap do `detectPathTraversal` (regex raso, complementa o taint)

```diff
  const traversalPatterns = [
    /readFile(?:Sync)?\s*\([^)]*\+/, /writeFile(?:Sync)?\s*\([^)]*\+/,
    ...
+   /readFile(?:Sync)?\s*\([^)]*\breq\.(query|params|body)\b/,
+   /writeFile(?:Sync)?\s*\([^)]*\breq\.(query|params|body)\b/,
  ];
```

---

## Fase 5 — Expandir cobertura com novos detectores (crescer os "63" com critério)

Só adicionar detector novo se ele cobrir uma classe de problema que **nenhum
dos 63 atuais** cobre — não duplicar sinal. Candidatos com maior retorno,
nesta ordem:

1. **Dependências vulneráveis** — rodar `npm audit --json` (ou equivalente)
   e integrar como um detector nativo (`dependency_vulnerability`), em vez de
   depender do usuário rodar separado.
2. **Licenças incompatíveis** — checar `license` de cada dependência em
   `node_modules/*/package.json` contra uma allowlist configurável.
3. **Segredos em arquivos de config versionados** (`.env` commitado,
   `credentials.json` no git) — hoje `console_secret` só olha `console.log`;
   segredo em arquivo de config nunca logado é mais comum e mais grave.
4. **Cross-file taint** (implementar de verdade o `crossFile` hoje fantasma)
   — depende de resolver imports/exports via `this.checker`, é o item mais
   caro desta fase; fazer por último.

Cada detector novo deve vir com: teste unitário próprio isolado (não via
`auditHealth` completo, pra não repetir o problema da Fase 0.8), e entrada na
tabela `issueCounts`/`totalRules` documentada no `README`.

---

## Ordem de execução recomendada

1. **Fase 0** (0.1 → 0.2 → 0.3 → 0.4 → 0.5 → 0.6) — motor de taint correto e
   com cobertura CLI real.
2. **Fase 0.8** (corrigir OOM dos testes) — necessário pra validar tudo o
   resto com confiança, sem depender de `--max-old-space-size`.
3. **Fase 0.7** (cache do Program) — eficiência, sem depender de nada além
   da Fase 0.
4. **Fase 1** (require() no resto do código).
5. **Fase 3** (reduzir ruído) antes da Fase 2 (calibrar score com dado mais
   limpo).
6. **Fase 2** (fórmula de score).
7. **Fase 4** (gap pontual do path traversal regex).
8. **Fase 5** (novos detectores) — só depois de tudo acima estabilizado;
   é crescimento, não correção.

Critério de aceite geral: rodar `nexus audit --level full --json` no próprio
nexus-system antes e depois de cada fase, comparando `healthScore`,
`issueCounts.total`, `issueCounts.tainted_input` (deve sair de 0 pra >0 assim
que a Fase 0.6 entrar) e tempo de execução (deve cair com a Fase 0.7).
