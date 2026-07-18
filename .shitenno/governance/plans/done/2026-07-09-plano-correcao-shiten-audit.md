# Plano de Correção — Shiten Audit (validação profunda + hardening)

> Gerado a partir de execução real do CLI (build → install → init → audit --level quick/standard/full/code-review)
> contra código com vulnerabilidades plantadas de propósito, mais leitura direta do código-fonte dos 45 detectores
> e do motor de taint analysis. Todo achado abaixo foi reproduzido, não inferido por leitura de código isolada.
> Referência normativa: OWASP Top 10:2025 (lançado nov/2025, final jan/2026) e CWE Top 25.

---

## Sumário executivo

O `shiten audit` tem uma arquitetura sofisticada (TS Compiler API real para taint analysis, 45 detectores,
4 níveis de profundidade) mas tem **3 classes de problema** que juntas fazem o sistema reportar segurança
falsa em código real:

1. **Postura errada por padrão** — os 12 detectores de segurança e o taint analyzer só rodam em `--level full`/`code-review`. O comando óbvio (`shiten audit`) roda em `standard` e nunca vê SQL injection, XSS, secrets, etc.
2. **Motor de taint analysis funcionalmente inerte no caminho comum** — funciona perfeitamente no caso de laboratório (variável tainted passada crua para o sink), mas **quebra assim que há concatenação de string, template literal, ou acesso a subpropriedade** (`req.query.id` em vez de `req.query`). Isso é como 90%+ do código real escreve SQL injection/command injection/path traversal — ou seja, o caso mais comum é exatamente o caso que o analisador não pega.
3. **Detectores com nome ≠ comportamento** — o mesmo padrão que já vimos nos health scores (rótulo não bate com o que é medido) se repete aqui: "unsafe deserialization" só olha `JSON.parse` (que não executa código em JS); "dependency confusion" só detecta dependência faltando no `package.json` (não tem nada a ver com o ataque real de dependency confusion).

Nenhum desses é "só um bug" isolado — são os 3 furos que, juntos, explicam por que o audit tanto grita demais
(1/100 num projeto vazio, por causa de auto-referência do scaffold) quanto grita de menos (zero avisos em código
com 10 vulnerabilidades plantadas, no nível padrão).

---

## Parte 1 — Achados novos desta sessão (evidenciados)

### 1.1 — CRÍTICO: detectores de segurança não rodam no nível padrão

**Evidência:** `src/audit/constants.ts`, `DETECTORS_BY_LEVEL.standard` não inclui nenhum dos 12
`detect*` de `engineering-detectors.ts` nem `detectTaintFlow`. Só aparecem em `full` e `code-review`.

**Reprodução:** arquivo com API key hardcoded, SQL injection por concatenação, XSS via `innerHTML`, `eval`,
MD5, HTTP inseguro, path traversal, prototype pollution, ReDoS, deserialização — `shiten audit` (padrão) não
reportou **nenhum** desses. `shiten audit --level full` reportou 9 de 10.

**Impacto:** qualquer pessoa/agente que rode o comando "óbvio" (sem saber da flag) tem falso senso de segurança.

**Correção:** promover os 12 detectores de segurança + `detectTaintFlow` para o nível `standard`. Manter
`quick` como está (rápido, só metadados). Justificativa: são regex/AST locais, não chamam rede, custo é baixo
(ver 1.6 sobre performance). Se performance for preocupação real, medir com `console.time` antes de decidir.

```ts
// src/audit/constants.ts — mover para dentro de `standard`
standard: [
  ...atuais,
  "detectHardcodedSecrets", "detectSQLInjection", "detectXSS", "detectUnsafeEval",
  "detectConsoleSecrets", "detectWeakCrypto", "detectInsecureHTTP",
  "detectPrototypePollution", "detectPathTraversal", "detectRegexDos",
  "detectUnsafeDeserialization", "detectDependencyConfusion",
  "detectTaintFlow", "detectConfigSecrets",
],
```

Adicionar ao README/help do comando uma nota clara indicando que `full`/`code-review` adicionam análise de
dependências (`npm audit`) e checagens mais caras — não que adicionam "a segurança básica".

---

### 1.2 — CRÍTICO: taint analyzer não segue string concatenation nem template literals

**Evidência:** `src/audit/taint/analyzer.ts`, método `getSymbolName()` (linha ~164) só trata:
`AsExpression`, `ParenthesizedExpression`, `NonNullExpression`, `PropertyAccessExpression`,
`ElementAccessExpression`, symbol lookup, `Identifier`. Não trata `BinaryExpression` (`+`) nem
`TemplateExpression` (`` `${x}` ``).

**Reprodução (3 testes controlados):**

| Código | Detectado? |
|---|---|
| `const q = req.query; execSync(q);` | ✅ Sim — `command_injection` reportado corretamente |
| `const q = req.query; execSync("ls " + q);` | ❌ Não — zero achados |
| `execSync("ls " + req.query.cmd);` | ❌ Não — zero achados (dupla falha, ver 1.3) |

O caso 2 prova que a propagação por atribuição direta funciona; a concatenação é o que quebra.
Isso significa que o taint analyzer detecta perfeitamente o caso de laboratório e **erra sistematicamente**
o padrão mais comum de código real (`"SELECT * FROM x WHERE id=" + id`, `` `rm -rf ${path}` ``, etc.).

**Correção — em `getSymbolName()`, adicionar resolução recursiva para expressões compostas:**

```ts
private getSymbolName(node: ts.Node): string | undefined {
  if (ts.isAsExpression(node) || ts.isParenthesizedExpression(node) || ts.isNonNullExpression(node)) {
    return this.getSymbolName(node.expression);
  }
  // NOVO: concatenação de string — se qualquer operando é tainted, o resultado é tainted
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = this.getSymbolName(node.left);
    const right = this.getSymbolName(node.right);
    if (left && this.variableTaint.get(left)?.tainted) return left;
    if (right && this.variableTaint.get(right)?.tainted) return right;
    return undefined;
  }
  // NOVO: template literal — checar cada expressão interpolada
  if (ts.isTemplateExpression(node)) {
    for (const span of node.templateSpans) {
      const name = this.getSymbolName(span.expression);
      if (name && this.variableTaint.get(name)?.tainted) return name;
    }
    return undefined;
  }
  if (ts.isPropertyAccessExpression(node)) return this.getPropertyAccessName(node);
  if (ts.isElementAccessExpression(node)) return this.getSymbolName(node.expression);
  const symbol = this.checker.getSymbolAtLocation(node);
  if (symbol) return symbol.getName();
  if (ts.isIdentifier(node)) return node.getText();
  return undefined;
}
```

Isso precisa ser usado tanto na checagem de argumentos de sink (`node.arguments`) quanto na propagação por
`VariableDeclaration` — ambas já chamam `getSymbolName`, então o fix é centralizado num único método.
**Escrever teste de regressão específico para concatenação e template literal antes de mexer**, para não regredir
o caso que já funciona.

---

### 1.3 — ALTO: fontes de taint só reconhecem acesso à propriedade inteira, não subpropriedades

**Evidência:** `src/audit/taint/sources.ts` — todos os padrões são âncorados exatos:
`/^req\.query$/`, `/^req\.body$/`, etc. `req.query.cmd` (o padrão de código real) não bate com `^req\.query$`.

**Reprodução:** `execSync(req.query.cmd)` direto (sem variável intermediária) — zero achados, mesmo sendo
o padrão de escrita mais comum em handlers Express.

**Correção — trocar âncora exata por prefixo, em `isTaintSource()`:**

```ts
export function isTaintSource(name: string): TaintSourceDef | undefined {
  return ALL_SOURCES.find((s) => {
    if (s.pattern instanceof RegExp) {
      // Aceitar tanto o objeto inteiro (`req.query`) quanto acesso a subpropriedade (`req.query.cmd`)
      const base = s.pattern.source.replace(/^\^/, "").replace(/\$$/, "");
      return new RegExp(`^${base}(\\.\\w+)*$`).test(name);
    }
    return s.pattern === name;
  });
}
```

Testar com `req.query.cmd`, `req.body.user.name`, `req.params.id` — todos devem casar sem falsos positivos
em nomes parecidos mas não relacionados (ex.: `reqQueryLogger`).

---

### 1.4 — ALTO: SSRF é um tipo morto — declarado mas nunca detectável

**Evidência:** `"ssrf"` existe em `src/audit/types.ts` e em `taint/reporter.ts` (mapeamento de label), mas
**não existe nenhum sink definido** em `src/audit/taint/sinks.ts` que produza `issueType: "ssrf"`.

**Reprodução:** `fetch(req.query.url)`, `axios.get(userUrl)` — nenhum finding, em nenhum nível.

**Contexto atualizado (OWASP Top 10:2025):** SSRF deixou de ser categoria própria e foi **absorvido em
A01 Broken Access Control** no Top 10 2025 — mas continua sendo um CWE ativo e crítico (CWE-918), e
inclusive tem taxa de exploração acima da média segundo pesquisa da comunidade. Vale a pena implementar
mesmo sem categoria dedicada no ranking novo.

**Correção — adicionar sink em `sinks.ts`:**

```ts
export const SSRF_SINKS: TaintSinkDef[] = [
  { name: "fetch", kind: "call", severity: 3, issueType: "ssrf", description: "fetch() — Requisição HTTP com URL dinâmica" },
  { name: "axios.get", kind: "call", severity: 3, issueType: "ssrf", description: "axios.get() — Requisição HTTP com URL dinâmica" },
  { name: "axios", kind: "call", severity: 3, issueType: "ssrf", description: "axios() — Requisição HTTP com URL dinâmica" },
  { name: "request", kind: "call", severity: 2, issueType: "ssrf", description: "request() — Requisição HTTP com URL dinâmica" },
  { name: "http.get", kind: "call", severity: 2, issueType: "ssrf", description: "http.get() — Requisição HTTP com URL dinâmica" },
  { name: "https.get", kind: "call", severity: 2, issueType: "ssrf", description: "https.get() — Requisição HTTP com URL dinâmica" },
];
// adicionar ao ALL_SINKS
```

---

### 1.5 — MÉDIO: 2 detectores com nome que não corresponde ao comportamento (mesmo padrão do health score)

Esse é o mesmo tipo de bug que já resolvemos nos health scores — nome promete uma coisa, mede outra.

- **`detectUnsafeDeserialization`** (linha 1114 em `engineering-detectors.ts`) só verifica `JSON.parse(...)`
  com input de `req.*`/`process.argv`/`readFile`. `JSON.parse` **não executa código** em JS — o pior caso
  é prototype pollution se o resultado for usado em merge sem sanitização (já coberto por outro detector).
  A vulnerabilidade real de "unsafe deserialization" em Node é `js-yaml.load()` (vs `.safeLoad`/schema seguro),
  `node-serialize.unserialize()`, `vm.runInNewContext` com dados não confiáveis, ou libraries como
  `serialize-javascript`/`v8.deserialize` usadas incorretamente. Nenhum desses é verificado.

  **Correção:** renomear para `detectUnvalidatedJSON` (o que ele realmente faz — falta de schema validation,
  não RCE) e criar um `detectUnsafeYamlLoad`/`detectNodeSerializeUsage` novo e real para a vulnerabilidade
  de verdade:
  ```ts
  const realDeserializationSinks = [
    /js-yaml['"]\)\.load\s*\(/, // load() sem FAILSAFE_SCHEMA é perigoso; safeLoad/loadSafe é ok
    /node-serialize['"]\)?\.unserialize\s*\(/,
    /vm\.runInNewContext\s*\(/,
    /vm\.runInThisContext\s*\(/,
  ];
  ```

- **`detectDependencyConfusion`** (linha ~1130) na verdade detecta "dependência usada mas não declarada em
  package.json" — que é um problema de higiene de projeto, não o ataque real de *dependency confusion*
  (pacote interno/privado com mesmo nome sendo shadowed por um pacote público malicioso no npm registry,
  técnica documentada por Alex Birsan em 2021 e ainda ativa — inclusive listada como vetor em
  A03:2025 Software Supply Chain Failures, categoria nova do OWASP Top 10 2025 com a **maior taxa de
  incidência** de todas as categorias).

  **Correção:** renomear o atual para `detectUndeclaredDependency` (nome fiel ao que faz), e implementar
  a detecção real de dependency confusion: comparar nomes de pacotes internos/privados (escopo `@empresa/*`
  sem `registry` privado configurado no `.npmrc`, ou presentes em `workspaces` do monorepo) contra existência
  pública no registro npm — se um pacote de escopo interno também existe publicamente e não há
  `.npmrc` fixando o registro correto para aquele escopo, é um risco real de confusion.

---

### 1.6 — MÉDIO: `detectDependencyVulnerabilities` não funciona em projetos pnpm/yarn/bun

**Evidência:** linha 1116 de `engineering-detectors.ts`: `const lockPath = join(projectRoot, "package-lock.json"); if (!existsSync(lockPath)) return issues;` — sai silenciosamente sem checar `pnpm-lock.yaml`,
`yarn.lock` ou `bun.lockb`, apesar de o *próprio* Shiten usar pnpm (`detectMissingLockFile`, linha 965, já
sabe sobre os 4 formatos — a inconsistência é só nesse detector).

**Impacto:** projetos pnpm/yarn/bun (boa parte do ecossistema atual) nunca recebem checagem de
vulnerabilidade de dependências, mesmo em `--level full`.

**Correção:**
```ts
function detectDependencyVulnerabilities(projectRoot: string): HealthIssue[] {
  const lockFiles = [
    { file: "package-lock.json", cmd: "npm audit --json" },
    { file: "pnpm-lock.yaml", cmd: "pnpm audit --json" },
    { file: "yarn.lock", cmd: "yarn audit --json" },
    // bun ainda não tem `bun audit` estável — documentar como limitação conhecida
  ];
  const found = lockFiles.find((l) => existsSync(join(projectRoot, l.file)));
  if (!found) return [];
  try {
    const output = execSync(`${found.cmd} 2>/dev/null`, { cwd: projectRoot, encoding: "utf-8", timeout: 20000 });
    // yarn audit tem formato NDJSON diferente do npm/pnpm — normalizar antes de fazer JSON.parse
    ...
  } catch { /* audit tools retornam exit code != 0 quando há vulns — comportamento esperado */ }
}
```
`yarn audit --json` retorna NDJSON (uma linha JSON por evento), não um único objeto — o parser precisa
tratar isso separadamente do formato do npm/pnpm (que retornam um único JSON).

---

### 1.7 — BAIXO: detector de ReDoS só olha `new RegExp()` dinâmico, não regex literais

**Evidência:** `detectRegexDos` em `engineering-detectors.ts` só casa `new RegExp(...)` com certos padrões
crus de `+`/`*` dentro dos parênteses. O padrão didático clássico de ReDoS — quantificador aninhado num
regex **literal**, `/^(a+)+$/`, `/(a|a)+/`, `/(.*)+/` — não é reconhecido.

**Correção:** adicionar detecção de regex literais com quantificadores aninhados via regex sobre o próprio
texto do arquivo (aproximação heurística — detecção 100% precisa de catastrophic backtracking exigiria
um parser de regex real, fora de escopo razoável para um linter):
```ts
const nestedQuantifierPattern = /\/(?:[^/\\]|\\.)*\([^)]*[+*][^)]*\)[+*](?:[^/\\]|\\.)*\//;
```
Rotular como heurística ("pode ter backtracking exponencial — revisar manualmente"), não como certeza,
para não gerar falsos positivos em regexes legítimos com grupos aninhados que não causam ReDoS.

---

### 1.8 — BAIXO: prototype pollution só dispara com a string literal `req.`

**Evidência:** `detectPrototypePollution` exige que a linha contenha `req.` — convenção Express específica.
O padrão genérico mais comum de verdade (`for (const key in source) target[key] = source[key]` sem checar
`key === "__proto__"`) não é pego, mesmo sendo o exemplo canônico de todo material educativo sobre o tema.

**Correção:** adicionar padrão adicional, independente de framework:
```ts
/for\s*\(\s*(?:const|let|var)\s+\w+\s+in\s+\w+\s*\)[\s\S]{0,80}\[\s*\w+\s*\]\s*=/,
```
que casa "for...in seguido de atribuição por chave dinâmica" sem checar `__proto__`/`constructor` antes.

---

### 1.9 — BAIXO: sem detector para command injection via template literal em `exec`

Coberto pela correção de 1.2 (o taint analyzer, uma vez consertado, cobre isso via sink `exec`/`execSync`).
Não precisa de detector regex separado — é o mesmo motor, só precisa parar de quebrar em template literals.

---

### 1.10 — Falha silenciosa: `catch { return [] }` sem log no wrapper do taint analyzer

**Evidência:** `src/health-auditor.ts`, dentro do `detectorMap.detectTaintFlow`:
```ts
detectTaintFlow: () => {
  try {
    const analyzer = new TaintAnalyzer({ projectRoot });
    return analyzer.analyze().map(...);
  } catch {
    return [] as HealthIssue[];   // <-- engole qualquer erro, sem aviso
  }
},
```
Se o `TaintAnalyzer` falhar por qualquer motivo (tsconfig ausente, erro de parse, etc.), o usuário recebe
"nenhum problema de segurança encontrado" — indistinguível de "de fato não há problemas". É uma falha
silenciosa perigosa por natureza: o pior tipo de bug num scanner de segurança é aquele que finge sucesso.

**Correção:**
```ts
} catch (err) {
  console.warn(chalk.yellow(`  ⚠ Taint analysis falhou: ${err instanceof Error ? err.message : String(err)}`));
  return [{
    type: "tainted_input", severity: 2,
    description: "Taint analysis não pôde ser executada — resultados de segurança incompletos",
    location: "taint-analyzer", recommendation: "Rodar com --debug para ver o erro completo",
  }] as HealthIssue[];
}
```
Nunca falhar silenciosamente em uma ferramenta de segurança — reportar o próprio erro como finding.

---

## Parte 1.11 — CRÍTICO (novo, validado em carga): `detectDependencyVulnerabilities` nunca reporta nada, em nenhum projeto real

**Contexto do teste:** projeto sintético de 367 arquivos / 20 módulos, com dependências reais instaladas
via `npm install` (142 pacotes). `npm audit --json` standalone confirma uma vulnerabilidade real e atual:
`uuid` (CVSS 7.5, CWE-787/1285, "Missing buffer bounds check"). `shiten audit --level full` e `--level
code-review` rodaram sem erro, mas **nenhum dos dois reportou essa vulnerabilidade** — nem nenhuma outra
de dependência, em nenhum nível.

**Causa raiz:** `node:child_process.execSync` lança exceção em exit code != 0, e `npm audit` retorna
exit code 1 sempre que encontra qualquer vulnerabilidade (comportamento documentado e intencional do npm,
para permitir `npm audit && deploy` falhar em CI). O código em `src/audit/engineering-detectors.ts` até
tem um comentário reconhecendo isso:

```ts
} catch { /* npm audit returns non-zero on vulns, that's expected */ }
```

Mas o `catch` descarta o erro inteiro em vez de ler `error.stdout`, que é exatamente onde o JSON com
as vulnerabilidades está — Node captura stdout do processo filho no objeto de erro mesmo quando ele sai
com código != 0. Reproduzido isolado:

```
$ node -e "execSync('npm audit --json', {cwd: projectRoot})"
THREW: Command failed: npm audit --json
stdout: {"vulnerabilities": {"uuid": {"severity": "moderate", ...}}}   <- os dados estao aqui
status: 1
```

Isso significa que este detector nunca funcionou para o caso que importa. Só "funciona" quando `npm audit`
sai com código 0 — exatamente quando não há nada para reportar. Em qualquer projeto real com pelo menos
uma vulnerabilidade conhecida (a maioria com >100 dependências tem pelo menos uma), o detector
silenciosamente retorna `[]`. Provavelmente o achado mais grave desta rodada: uma ferramenta de segurança
cujo único modo de falha é engolir exatamente o dado que deveria reportar.

**Correção:**
```ts
try {
  const output = execSync("npm audit --json 2>/dev/null", { cwd: projectRoot, encoding: "utf-8", timeout: 15000 });
  return parseNpmAuditOutput(output);
} catch (err) {
  // npm/pnpm/yarn audit saem com código != 0 quando ENCONTRAM vulnerabilidades — caso normal, não falha.
  // O JSON real está em err.stdout.
  const stdout = (err as { stdout?: string }).stdout;
  if (stdout) {
    try { return parseNpmAuditOutput(stdout); } catch { /* JSON realmente malformado, aí sim ignorar */ }
  }
  return [];
}
```
Mesmo padrão deve valer quando `pnpm audit`/`yarn audit` forem adicionados (item 1.6) — os três têm o
mesmo comportamento de exit code.

**Teste de regressão obrigatório:** fixture com pacote de versão vulnerável conhecida travada no lockfile,
assertando que o detector retorna >=1 issue. O teste atual provavelmente só cobre o caminho sem
vulnerabilidade — por isso sobreviveu aos 1679 testes existentes.

---

## Parte 5 — Validação de carga e performance

**Setup:** 367 arquivos `.ts` reais (20 módulos tipo SaaS: auth, billing, orders, payments, shipping etc.),
142 dependências npm reais instaladas, 46 vulnerabilidades plantadas espalhadas pelos módulos.

| Nível | Tempo | Observação |
|---|---|---|
| `quick` | 1.3s | OK |
| `standard` | 1.7s | OK |
| `full` | 6.2s | OK — inclui taint analyzer (TS Compiler API) sobre 367 arquivos |
| `code-review` | 5.8s | OK — mais checagens que `full`, tempo comparável |

**Memória:** pico de ~255MB de RSS em `code-review` (o nível mais pesado, que instancia o `ts.Program`
completo para taint analysis). Sem crash, sem timeout, sem erro não tratado em nenhum nível — a
infraestrutura de execução é sólida. Para projetos na casa de milhares de arquivos, esperar crescimento
não-linear de memória nessa etapa (a API do TypeScript carrega info de tipo de todo o programa) — vale
medir de novo depois do hardening do taint analyzer (1.2), que provavelmente aumenta o trabalho por nó.

**Validação de detecção em escala (confirma os achados da Parte 1 com números, não só teste isolado):**

| Vulnerabilidade plantada | Detectado (code-review) |
|---|---|
| SQL injection (regex, 6 arquivos) | 6/6 ✅ |
| XSS (regex, 6 arquivos) | 6/6 ✅ |
| Secrets hardcoded (regex, 9 arquivos × 2 cada) | 18/18 ✅ |
| SSRF via taint (10 arquivos) | 1/10 ❌ — confirma 1.4 em escala |
| Command injection via taint + concatenação (15 arquivos) | 1/15 ❌ — confirma 1.2 em escala |
| Dependência real vulnerável (`uuid`, CVSS 7.5) | 0/1 ❌ — achado novo, ver 1.11 |

Detectores baseados em regex direto (SQL injection, XSS, secrets) se saem perfeitamente até em escala. Os
que dependem do taint analyzer (SSRF, command injection via concatenação) confirmam a falha sistemática já
diagnosticada — agora com significância estatística. E o detector de dependências vulneráveis provou ser
100% inerte mesmo com uma CVE real e atual na árvore de dependências do teste.

---

## Parte 2 — Cobertura vs. OWASP Top 10:2025 (pesquisado hoje)

O OWASP Top 10:2025 (lançado formalmente em jan/2026) mudou bastante desde 2021: A02 Security
Misconfiguration subiu para #2, entraram A03 Software Supply Chain Failures e A10 Mishandling of
Exceptional Conditions como categorias novas, e SSRF foi absorvido em A01 Broken Access Control.

| Categoria OWASP 2025 | Cobertura atual do Shiten | Ação |
|---|---|---|
| A01 Broken Access Control (+ SSRF) | Parcial — path traversal sim, SSRF não (ver 1.4) | Implementar sink SSRF |
| A02 Security Misconfiguration | Fraca — só HTTP inseguro e secrets em config | Adicionar: CORS wildcard (`Access-Control-Allow-Origin: *`), cookies sem `httpOnly`/`secure`/`sameSite`, debug flags em produção (`NODE_ENV` checks ausentes) |
| A03 Software Supply Chain Failures (nova, maior taxa de incidência) | Parcial — `detectDependencyVulnerabilities` (só npm), licenças | Corrigir 1.6 (pnpm/yarn), implementar dependency confusion real (1.5) |
| A04 Cryptographic Failures | Boa — MD5/SHA1 cobertos | Adicionar: uso de `Math.random()` para tokens/senhas (fonte de entropia fraca) |
| A05 Injection | Boa em teoria, quebrada na prática (ver 1.2/1.3) | Consertar taint analyzer |
| A06 Insecure Design | Fora de escopo de análise estática | — |
| A07 Identification & Authentication Failures | Não coberto | Fora do escopo atual do detector set; considerar para fase futura |
| A08 (antiga) Software/Data Integrity Failures | Parcial — unsafe deserialize mal rotulado (1.5) | Renomear + detector real |
| A09 Security Logging & Alerting Failures | Não coberto | Detector novo: `console.log`/`logger` de dados sensíveis já existe (`detectConsoleSecrets`) — falta checar ausência de logging em blocos de auth/erro |
| A10 Mishandling of Exceptional Conditions (nova) | Parcial — `detectEmptyCatchBlocks` já existe | Expandir para: catch que só faz `console.log` e continua (fail-open), catch que vaza stack trace pro cliente |

**Novo detector sugerido — CORS/cookies (A02):**
```ts
function detectInsecureCORS(files: SourceFileInfo[]): HealthIssue[] {
  const patterns = [
    /Access-Control-Allow-Origin['"]?\s*[,:]\s*['"]\*['"]/,
    /cors\s*\(\s*\)/, // cors() sem config = permite tudo
  ];
  // ...
}
function detectInsecureCookies(files: SourceFileInfo[]): HealthIssue[] {
  // cookie set sem httpOnly/secure/sameSite explícitos
}
```

---

## Parte 3 — O "bloqueio" da pasta `shitenno-go` (single source of truth do nome)

**Achado:** a string literal `"shitenno-go"` está hardcoded em **51 ocorrências, 29 arquivos**
(`src/utils.ts`, `src/shared.ts`, `src/scaffolder.ts`, `bin/shiten.ts`, e mais 25). Não existe hoje nenhuma
constante única. Se o produto for renomeado, é find-and-replace manual em 29 arquivos, com risco real de
esquecer um lugar (e o próprio `shitenno-go/` é usado como sentinela de detecção de projeto — ver `utils.ts`
linha 80 — então um esquecimento aqui quebra a detecção do projeto inteiro, não é cosmético).

### Correção proposta — 2 camadas

**Camada 1 — constante única (obrigatória):**
```ts
// src/constants.ts
/** Nome do diretório de metadados do Shiten. Única fonte de verdade — nunca hardcode a string. */
export const SHITEN_DIR_NAME = "shitenno-go";
```
Depois, substituir as 51 ocorrências por `SHITEN_DIR_NAME` (a maioria é `join(projectRoot, "shitenno-go")` →
`join(projectRoot, SHITEN_DIR_NAME)`). É um refactor mecânico, mas tem que ser feito com testes rodando a
cada arquivo — 29 arquivos é superfície grande o suficiente para quebrar algo se feito tudo de uma vez.
Sugiro: um PR por área (comandos / core / templates), rodando `vitest run` a cada bloco.

**Camada 2 — trava contra regressão (o "bloqueio" que você pediu):**
Depois da Camada 1, adicionar uma regra de lint que **proíbe** a string literal `"shitenno-go"` fora de
`src/constants.ts` e dos arquivos de teste, para que ninguém reintroduza o hardcode no futuro (nem um
humano nem um agente de IA gerando código):

```js
// eslint.config.js — adicionar regra
{
  files: ["src/**/*.ts"],
  ignores: ["src/constants.ts", "src/**/__tests__/**"],
  rules: {
    "no-restricted-syntax": ["error", {
      selector: "Literal[value='shitenno-go']",
      message: "Use SHITEN_DIR_NAME de src/constants.ts em vez de hardcodear 'shitenno-go'.",
    }],
  },
},
```
Isso transforma `pnpm lint` (que já roda limpo e com `--max-warnings=0`) na trava real: qualquer PR ou
commit de agente que reintroduza a string literal quebra o CI imediatamente. É a forma mais robusta de
"bloqueio" — não depende de disciplina, é estrutural.

**Se quiser ir além:** tornar o próprio nome configurável via `shitenno-go/config.json` (ex.: campo
`"metaDirName"`), permitindo rebrand sem sequer precisar recompilar — mas isso é bem mais invasivo
(afeta a detecção de projeto em `utils.ts`, que hoje procura literalmente por essa pasta para saber se o
projeto já foi inicializado). Recomendo fazer isso só se o rebrand for uma certeza próxima; caso contrário,
a Camada 1+2 já resolve o risco real sem esse custo.

---

## Parte 4 — Outras melhorias que valem a pena incluir

1. **Timeout consistente em todo `execSync`**: `detectDependencyVulnerabilities` usa 15s; se adicionarmos
   `pnpm audit`/`yarn audit` (mais lentos, batem em registro), subir para 20-25s e adicionar um flag
   `--skip-dep-audit` para CI que já roda isso separadamente.
2. **Cache do resultado de `npm/pnpm/yarn audit`**: esses comandos batem em rede; hoje `--level full` já
   pula cache (linha 51 de `commands/audit.ts`) — mas especificamente para a checagem de dependências,
   vale cachear por 24h independente do nível, porque vulnerabilidades de dependência não mudam a cada
   `shiten audit` chamado no mesmo dia.
3. **Testes de regressão para cada achado acima**: cada correção da Parte 1 precisa de um teste que
   reproduza exatamente o caso que falhou aqui (concatenação, subpropriedade, SSRF, cookies inseguros, etc.)
   — sem isso, é fácil a próxima refatoração trazer a regressão de volta silenciosamente, e isso já é o
   segundo motor de segurança do projeto (o primeiro foi o próprio audit engine) que "parece funcionar" mas
   não funciona no caso comum. Testar contra padrões de laboratório não é suficiente.
4. **Modo "explicar por que 1/100"**: já que os detectores de governança auditam a própria pasta
   `shitenno-go/` (não o código do usuário), adicionar uma seção no output do audit que separa
   claramente "saúde da sua documentação Shiten" de "saúde do seu código" — hoje os dois número aparecem
   juntos sob "Code Health", o que reproduz exatamente o problema de rótulo ambíguo que já resolvemos
   para os 3 health scores diferentes. Mesmo bug, lugar novo.

---

## Ordem de execução recomendada

```
Fase 1 (mais crítico, menor esforço)
  1.1 promover detectores de segurança para `standard`
  1.11 ler error.stdout do npm/pnpm/yarn audit em vez de descartar (detector de dependência vulnerável
       está 100% inerte hoje — prioridade máxima, achado validado com CVE real em teste de carga)
  1.10 parar de engolir erro do taint analyzer silenciosamente
  → rodar full suite, confirmar 1679+ testes passam

Fase 2 (o motor de verdade)
  1.2 taint analyzer: concatenação + template literal
  1.3 taint sources: subpropriedade
  1.4 SSRF sink
  → escrever testes de regressão ANTES de cada fix, rodar suite a cada um

Fase 3 (rótulos e gaps menores)
  1.5 renomear + implementar deserialization/dep-confusion reais
  1.6 pnpm/yarn/bun no dependency vuln check
  1.7 ReDoS literal
  1.8 prototype pollution genérico
  Parte 2: CORS, cookies, Math.random, logging em auth/erro

Fase 4 (arquitetura)
  Parte 3: SHITEN_DIR_NAME + regra de lint de bloqueio
  Parte 4.4: separar "saúde da doc" de "saúde do código" no output do audit

Critério de conclusão: rodar os mesmos 3 arquivos de teste desta sessão
(vulnerable.ts, taint-test.ts, taint-test2/3.ts) com `shiten audit` no nível padrão e confirmar que
TODAS as 10+ vulnerabilidades plantadas aparecem, sem nenhum falso positivo em clean.ts.
```
