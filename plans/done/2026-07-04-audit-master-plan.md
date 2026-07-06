# Plano Master: Expansão Completa do Nexus Audit

**Data:** 2026-07-04  
**Atualizado:** 2026-07-04  
**Status:** 🔄 EM PROGRESSO  
**Objetivo:** Transformar o nexus audit num sistema de auditoria completo, reutilizável, com ~160+ detectores e nível "code review" end-to-end.

---

## Visão Geral

### Estado Atual
- **50 detectores** (quick: 6, standard: 27, full: 50) — SC-5 implementados
- **3 níveis**: quick, standard, full
- **health-auditor.ts**: ~3060 linhas (monolítico)
- **Foco**: projeto Nexus (não reutilizável para outros projetos)

### Estado Alvo
- **~160+ detectores** com novo nível "code-review"
- **4 níveis**: quick, standard, full, code-review
- **Módulos divididos**: ~8-10 ficheiros
- **Reutilizável**: qualquer projeto TypeScript/JavaScript

---

## Parte 1: Arquitetura — Divisão do Monolito

### Problema
`health-auditor.ts` tem ~3060 linhas. Isto é:
- Difícil de manter
- Difícil de testar
- Difícil de reutilizar

### Solução: Divisão em módulos

```
src/audit/
├── index.ts                    # Exportações públicas
├── types.ts                    # HealthIssue, GovernanceOptimization, AuditLevel, etc.
├── constants.ts                # Thresholds, patterns, skip lists
├── shared.ts                   # collectSourceFiles(), readHistory(), readRules(), etc.
├── health-score.ts             # calculateHealthScore()
├── optimization-proposer.ts    # proposeOptimizations()
├── governance-detectors.ts     # ~33 detectores governance (Fase 1 + Fase 2 original)
├── engineering-detectors.ts    # ~12 detectores engineering (E1-E7 + P1-P5 + SC-*)
├── code-review-detectors.ts    # ~60+ detectores novos (nível code-review)
├── cache.ts                    # Cache baseado em hash de arquivos
├── health-auditor.ts           # Orquestração principal (auditHealth)
└── reporter.ts                 # Geração de relatórios
```

### Migrar imports
Atualizar `src/commands/audit.ts` e qualquer outro ficheiro que importa de `health-auditor.ts` para importar do novo caminho.

---

## Parte 2: Melhorias nos 8 Pontos Identificados

### P1: Dividir health-auditor.ts
- Extrair tipos para `types.ts`
- Extrair constantes para `constants.ts`
- Extrair funções compartilhadas para `shared.ts`
- Extrair score para `health-score.ts`
- Extrair optimizações para `optimization-proposer.ts`
- Extrair detectores governance para `governance-detectors.ts`
- Extrair detectores engineering para `engineering-detectors.ts`

### P2: Melhorar unused_export
**Problema:** ~150 issues, muitos falsos positivos em barrel files e API pública.

**Melhorias:**
- Filtrar exports de `index.ts` (barrel files)
- Filtrar exports de tipos/interfaces que são usados em assinaturas
- Filtrar exports que começam com `_` (convenção de privado)
- Agrupar por ficheiro: "3 exports não usados em src/feedback-engine.ts"

### P3: Melhorar empty_catch
**Problema:** Catch vazio após `mkdirSync`/`writeFileSync` é intencional.

**Melhorias:**
- Se `try` contém `mkdirSync` → severity 1 (INFO)
- Se `try` contém `writeFileSync` → severity 1 (INFO)
- Se `try` contém `readFileSync` → severity 2 (WARNING)
- Se `try` contém lógica de negócio → severity 2 (WARNING)

### P4: Melhorar dead_code para TODOs
**Problema:** Cada TODO vira issue individual.

**Melhorias:**
- Agrupar TODOs por ficheiro: "8 TODOs em src/feedback-engine.ts"
- Mostrar apenas os primeiros 3 por ficheiro
- Severidade baseada em idade do TODO (se git blame disponível)

### P5: Melhorar circular_deps com aliases
**Problema:** Não resolve `@/utils` → `src/utils`.

**Melhorias:**
- Ler `tsconfig.json` paths
- Ler `package.json` imports/exports
- Resolver aliases antes de construir grafo

### P6: Melhorar high_complexity com strings
**Problema:** Conta braces dentro de strings/template literals.

**Melhorias:**
- Pular linhas que são só strings
- Pular template literals
- Usar parser de AST quando disponível (TypeScript compiler API)

### P7: Paralelizar detectores que chamam execSync
**Problema:** `detectTestHealth`, `detectLintIssues`, `detectTypeSafetyIssues` bloqueiam.

**Melhorias:**
- Executar os 3 em paralelo com `Promise.all()`
- Usar `worker_threads` para isolamento
- Timeout configurável por detector

### P8: Cache baseado em hash
**Problema:** Cada execução re-executa tudo do zero.

**Melhorias:**
- Calcular hash SHA256 de cada arquivo `src/` antes da execução
- Se hash não mudou desde última execução, reusar resultados
- Cache TTL configurável (default: 5 minutos)
- Cache inválido por `nexus audit --no-cache`

---

## Parte 3: Novos Detectores (Nível "Code Review")

### Novo nível: `code-review`
O nível mais completo. Inclui **todos** os detectores de `full` + detectores adicionais de code review.

```
nexus audit --level code-review
```

**Cobertura:**
1. Tudo do nível full
2. Análise de dependências
3. Análise de segurança
4. Análise de performance
5. Análise de acessibilidade
6. Análise de documentação
7. Análise de commits
8. Análise de dependências externas
9. Análise de licenças
10. Análise de supply chain
11. Análise de resource leaks
12. Análise de API contract
13. Análise de taint analysis
14. Análise de metadata/repo
15. Análise de environment
16. Análise de commit quality

---

### 3.1 Detectores de Análise de Dependências (DEND-*)

| ID | Detector | Issue Type | O que detecta | Severidade |
|---|---|---|---|---|
| DEND-01 | `detectDependencyHealth` | `outdated_dep` | Dependências desatualizadas (usa `npm outdated`) | 2 |
| DEND-02 | `detectUnusedDependencies` | `unused_dep` | Dependências em package.json nunca importadas | 2 |
| DEND-03 | `detectMissingPeerDeps` | `missing_peer` | Peer dependencies em falta | 2 |
| DEND-04 | `detectDuplicateDeps` | `duplicate_dep` | Dependências duplicadas (dev vs prod) | 1 |
| DEND-05 | `detectSecurityAudit` | `vuln_dep` | Dependências com vulnerabilidades (`npm audit`) | 3 |
| DEND-06 | `detectDeprecatedAPIs` | `deprecated_api` | Uso de APIs deprecated em dependências | 1 |
| DEND-07 | `detectBundleSizeImpact` | `bundle_impact` | Pacotes >500KB no bundle | 1 |

---

### 3.2 Detectores de Segurança (SEC-*)

| ID | Detector | Issue Type | O que detecta | Severidade |
|---|---|---|---|---|
| SEC-01 | `detectHardcodedSecrets` | `hardcoded_secret` | Chaves/tokens hardcoded em código | 3 |
| SEC-02 | `detectSQLInjection` | `sql_injection` | Concatenação em queries SQL | 3 |
| SEC-03 | `detectXSS` | `xss_risk` | innerHTML dangerouslySetInnerHTML | 3 |
| SEC-04 | `detectUnsafeEval` | `unsafe_eval` | Uso de `eval()`, `Function()`, `new Function()` | 3 |
| SEC-05 | `detectConsoleSecrets` | `console_secret` | Logs com dados sensíveis (password, token, key) | 3 |
| SEC-06 | `detectWeakCrypto` | `weak_crypto` | Uso de MD5, SHA1 para senhas | 2 |
| SEC-07 | `detectInsecureHTTP` | `insecure_http` | URLs http:// em produção | 2 |
| SEC-08 | `detectPrototypePollution` | `proto_pollution` | Object.assign com input do utilizador | 3 |
| SEC-09 | `detectPathTraversal` | `path_traversal` | Caminhos com `../` não sanitizados | 3 |
| SEC-10 | `detectRegexDos` | `regex_dos` | Regex complexos sem timeout | 2 |
| SEC-11 | `detectUnsafeDeserialization` | `unsafe_deserialize` | JSON.parse com input não validado | 2 |
| SEC-12 | `detectDependencyConfusion` | `dep_confusion` | Imports de pacotes que não existem no registry | 2 |

---

### 3.3 Detectores de Performance (PERF-*)

| ID | Detector | Issue Type | O que detecta | Severidade |
|---|---|---|---|---|
| PERF-01 | `detectSyncIOInAsync` | `sync_io` | `readFileSync`/`writeFileSync` em contexto async | 2 |
| PERF-02 | `detectLargePayloads` | `large_payload` | JSON.parse/stringify de objetos >1MB | 1 |
| PERF-03 | `detectUnnecessaryReExports` | `re_export` | Barrel files com >20 exports | 1 |
| PERF-04 | `detectDeepNesting` | `deep_nesting` | Código com >5 níveis de indentação | 1 |
| PERF-05 | `detectLongFunctionArgs` | `long_args` | Funções com >5 parâmetros | 1 |
| PERF-06 | `detectDuplicateImports` | `dup_import` | Mismo símbolo importado 2x | 1 |
| PERF-07 | `detectUnusedImports` | `unused_import` | Imports nunca usados no ficheiro | 1 |
| PERF-08 | `detectHeavyDynamicImports` | `heavy_import` | `require()` dentro de loops | 2 |
| PERF-09 | `detectMemoryLeak` | `memory_leak` | addEventListener sem removeEventListener | 2 |
| PERF-10 | `detectInefficientRegex` | `inefficient_regex` | Regex com backtracking catastrofico | 2 |

---

### 3.4 Detectores de Acessibilidade (A11Y-*)

| ID | Detector | Issue Type | O que detecta | Severidade |
|---|---|---|---|---|
| A11Y-01 | `detectMissingAltText` | `missing_alt` | Imagens sem atributo alt | 2 |
| A11Y-02 | `detectMissingAriaLabels` | `missing_aria` | Inputs sem aria-label | 2 |
| A11Y-03 | `detectColorContrast` | `low_contrast` | Cores com contraste <4.5:1 | 2 |
| A11Y-04 | `detectMissingFormLabels` | `missing_label` | Inputs sem <label> ou aria-labelledby | 2 |
| A11Y-05 | `detectKeyboardNavigation` | `no_keyboard` | onClick sem onKeyDown equivalente | 1 |
| A11Y-06 | `detectMissingLang` | `missing_lang` | HTML sem atributo lang | 2 |
| A11Y-07 | `detectHeadingOrder` | `heading_skip` | Heading levels saltados (h1 → h3) | 1 |

---

### 3.5 Detectores de Documentação (DOC-*)

| ID | Detector | Issue Type | O que detecta | Severidade |
|---|---|---|---|---|
| DOC-01 | `detectMissingJSDoc` | `missing_jsdoc` | Funções exportadas sem JSDoc | 1 |
| DOC-02 | `detectMissingReturnTypes` | `missing_return_type` | Funções sem return type annotation | 1 |
| DOC-03 | `detectOutdatedREADME` | `outdated_readme` | README.md >30 dias sem atualização | 1 |
| DOC-04 | `detectMissingCHANGELOG` | `missing_changelog` | Sem CHANGELOG.md ou último entry >30 dias | 1 |
| DOC-05 | `detectMissingLicense` | `missing_license` | Sem LICENSE ou license inválido | 2 |
| DOC-06 | `detectBrokenExamples` | `broken_example` | Exemplos no README com código que não compila | 1 |
| DOC-07 | `detectMissingTypes` | `missing_types` | `any` em exports públicos | 2 |
| DOC-08 | `detectMissingExamples` | `missing_examples` | Funções públicas sem @example no JSDoc | 1 |

---

### 3.6 Detectores de Git (GIT-*)

| ID | Detector | Issue Type | O que detecta | Severidade |
|---|---|---|---|---|
| GIT-01 | `detectLargeCommits` | `large_commit` | Commits >500 linhas | 1 |
| GIT-02 | `detectForcePushes` | `force_push` | Force pushes nos últimos 30 dias | 2 |
| GIT-03 | `detectEmptyCommits` | `empty_commit` | Commits sem alterações de código | 1 |
| GIT-04 | `detectCommitMessageFormat` | `bad_commit_msg` | Mensagens de commit <10 caracteres | 1 |
| GIT-05 | `detectBranchHygiene` | `stale_branch` | Branches >30 dias sem merge | 1 |
| GIT-06 | `detectGitignoreCompleteness` | `incomplete_gitignore` | Ficheiros que deveriam estar no .gitignore | 1 |
| GIT-07 | `detectUncommittedChanges` | `uncommitted` | Alterações não commitadas antes de push | 1 |

---

### 3.7 Detectores de Configuração (CONF-*)

| ID | Detector | Issue Type | O que detecta | Severidade |
|---|---|---|---|---|
| CONF-01 | `detectTsConfigStrict` | `tsconfig_not_strict` | tsconfig.json sem strict: true | 1 |
| CONF-02 | `detectESLintConfig` | `missing_eslint` | Sem configuração ESLint | 2 |
| CONF-03 | `detectPrettierConfig` | `missing_prettier` | Sem configuração Prettier | 1 |
| CONF-04 | `detectEditorConfig` | `missing_editorconfig` | Sem .editorconfig | 1 |
| CONF-05 | `detectCIConfig` | `missing_ci` | Sem pipeline CI/CD | 2 |
| CONF-06 | `detectNodeVersion` | `wrong_node_version` | .nvmrc ou engines incompatível | 1 |
| CONF-07 | `detectPackageManager` | `missing_package_manager` | Sem packageManager em package.json | 1 |
| CONF-08 | `detectEnvExample` | `missing_env_example` | Sem .env.example quando .env existe | 1 |
| CONF-09 | `detectDockerConfig` | `missing_dockerignore` | Sem .dockerignore quando Dockerfile existe | 1 |
| CONF-10 | `detectGitHubActions` | `outdated_actions` | GitHub Actions com versões desatualizadas | 1 |

---

### 3.8 Detectores de Testing (TEST-*)

| ID | Detector | Issue Type | O que detecta | Severidade |
|---|---|---|---|---|
| TEST-01 | `detectFlakyTests` | `flaky_test` | Testes que passam/falham alternadamente | 2 |
| TEST-02 | `detectSlowTests` | `slow_test` | Testes >5 segundos | 1 |
| TEST-03 | `detectTestIsolation` | `test_isolation` | Testes que dependem de outros testes | 2 |
| TEST-04 | `detectMissingTestDescribe` | `missing_describe` | Testes sem describe() wrapper | 1 |
| TEST-05 | `detectTestNaming` | `bad_test_name` | Testes com nomes <10 caracteres | 1 |
| TEST-06 | `detectSnapshotOutdated` | `outdated_snapshot` | Snapshots desatualizados | 1 |
| TEST-07 | `detectTestCoverageConfig` | `missing_coverage` | Sem configuração de cobertura | 1 |
| TEST-08 | `detectE2EComplete` | `missing_e2e` | Features sem testes E2E | 1 |

---

### 3.9 Detectores de API (API-*)

| ID | Detector | Issue Type | O que detecta | Severidade |
|---|---|---|---|---|
| API-01 | `detectAPIBreaking` | `breaking_change` | Alterações em exports públicos sem semver | 2 |
| API-02 | `detectMissingVersion` | `missing_version` | Sem versão em package.json | 2 |
| API-03 | `detectInvalidSemver` | `invalid_semver` | Versão não segue semver | 2 |
| API-04 | `detectMissingMain` | `missing_main` | Sem main/module em package.json | 2 |
| API-05 | `detectMissingTypes` | `missing_types_field` | Sem types no package.json | 1 |
| API-06 | `detectMissingExports` | `missing_exports` | Sem exports no package.json | 1 |

---

### 3.10 Detectores de Code Quality (CQ-*)

| ID | Detector | Issue Type | O que detecta | Severidade |
|---|---|---|---|---|
| CQ-01 | `detectMagicNumbers` | `magic_number` | Números hardcoded sem constante nomeada | 1 |
| CQ-02 | `detectDeepElse` | `deep_else` | Else-if >3 níveis | 1 |
| CQ-03 | `detectDuplicateCode` | `duplicate_code` | Blocos de código >10 linhas duplicados | 1 |
| CQ-04 | `detectLongLines` | `long_line` | Linhas >120 caracteres | 1 |
| CQ-05 | `detectInconsistentNaming` | `bad_naming` | Variáveis com nomes <3 caracteres | 1 |
| CQ-06 | `detectMagicStrings` | `magic_string` | Strings hardcoded repetidas >3x | 1 |
| CQ-07 | `detectComplexConditionals` | `complex_condition` | Condicionais com >3 operadores | 1 |
| CQ-08 | `detectStarExports` | `star_export` | `export * from` — polui namespace | 1 |
| CQ-09 | `detectNonNullAssertion` | `non_null` | Uso de `!` (non-null assertion) | 1 |
| CQ-10 | `detectTypeAssertions` | `type_assertion` | Uso de `as` para cast de tipos | 1 |
| CQ-11 | `detectVoidReturn` | `void_return` | Funções que retornam void implicitamente | 1 |
| CQ-12 | `detectNestedTernary` | `nested_ternary` | Ternários aninhados | 1 |

---

### 3.11 Detectores de Monorepo (MONO-*)

| ID | Detector | Issue Type | O que detecta | Severidade |
|---|---|---|---|---|
| MONO-01 | `detectCircularWorkspace` | `circular_workspace` | Packages que importam uns dos outros circularmente | 3 |
| MONO-02 | `detectInconsistentVersions` | `version_mismatch` | Versões diferentes do mesmo pacote em packages | 2 |
| MONO-03 | `detectMissingWorkspace` | `missing_workspace` | Ficheiros que deveriam ser shared | 1 |
| MONO-04 | `detectBuildOrder` | `bad_build_order` | Scripts de build com dependências erradas | 2 |

---

### 3.12 Detectores de Licenças (LIC-*)

| ID | Detector | Issue Type | O que detecta | Severidade |
|---|---|---|---|---|
| LIC-01 | `detectLicenseCompliance` | `restricted_license` | Dependências com licença GPL/AGPL/SSPL (restrições) | 3 |
| LIC-02 | `detectMissingLicenseField` | `missing_license_field` | package.json sem campo `license` | 2 |
| LIC-03 | `detectLicenseConflicts` | `license_conflict` | Misto de licenças MIT + GPL no mesmo projeto | 3 |
| LIC-04 | `detectLicenseFile` | `missing_license_file` | Ausência de LICENSE na raiz do projeto | 2 |

**Detalhes técnicos:**
- Lê `package.json` de cada dependência via `node_modules/<pkg>/package.json`
- Parseia campos `license`, `licenses`, e ficheiros LICENSE
- Mantém lista de licenças restritivas: GPL-2.0, GPL-3.0, AGPL-3.0, SSPL, EUPL, CPAL
- Licenças permissivas: MIT, ISC, BSD-2-Clause, BSD-3-Clause, Apache-2.0
- Verifica conflitos: se projeto é MIT mas dependência é GPL → issue CRITICAL

---

### 3.13 Detectores de Supply Chain (SC-*) — ✅ IMPLEMENTADO

| ID | Detector | Issue Type | O que detecta | Severidade | Status |
|---|---|---|---|---|---|
| SC-01 | `detectUnpinnedVersions` | `unpinned_version` | Dependências com versão `*`, `latest`, `>`, `>=` | 2 | ✅ |
| SC-02 | `detectMissingLockFile` | `missing_lock_file` | Ausência de package-lock.json/pnpm-lock.yaml/yarn.lock/bun.lockb | 3 | ✅ |
| SC-03 | `detectLockFileDrift` | `lock_file_drift` | package.json modificado depois do último install | 2 | ✅ |
| SC-04 | `detectPhantomDependencies` | `phantom_dep` | Dependências usadas mas não declaradas no package.json | 2 | ✅ |
| SC-05 | `detectDeprecatedPackages` | `deprecated_package` | Dependências marcadas como deprecated | 2 | ✅ |

**Detalhes técnicos:**
- `detectUnpinnedVersions`: Apenas `*`, `latest`, `>`, `>=` são flagged. `^` e `~` são ranges semver padrão e não são flagged.
- `detectMissingLockFile`: Verifica 4 formatos: package-lock.json, pnpm-lock.yaml, yarn.lock, bun.lockb
- `detectLockFileDrift`: Compara mtime do lock file vs package.json usando `statSync` importado
- `detectPhantomDependencies`: Suporta `node:` prefix (NODE_BUILTINS Set com loop), ESM imports e `require()` calls, lastIndex reset por ficheiro
- `detectDeprecatedPackages`: Lista hardcoded de 8 pacotes conhecidos (request, tslint, etc.). Chamadas `npm view` removidas por performance.

---

### 3.14 Detectores de Resource Leaks (RL-*)

| ID | Detector | Issue Type | O que detecta | Severidade |
|---|---|---|---|---|
| RL-01 | `detectUnclosedStreams` | `unclosed_stream` | `createReadStream`/`createWriteStream` sem `.close()` ou `pipeline()` | 2 |
| RL-02 | `detectUnclosedConnections` | `unclosed_connection` | Conexões DB/HTTP sem `finally` block | 2 |
| RL-03 | `detectMissingCleanup` | `missing_cleanup` | `beforeAll`/`beforeEach` sem `afterAll`/`afterEach` | 1 |
| RL-04 | `detectPromiseLeak` | `promise_leak` | Promises criadas mas nunca `await`ed ou `.catch()`ed | 2 |
| RL-05 | `detectEventListenerLeak` | `event_listener_leak` | `addEventListener`/`.on()` sem `removeEventListener`/`.off()` | 2 |

**Detalhes técnicos:**
- `detectUnclosedStreams`: Procura `createReadStream`, `createWriteStream` e verifica se há `.close()`, `.pipe()`, ou `pipeline()` no mesmo escopo
- `detectUnclosedConnections`: Procura padrões como `pool.connect()` ou `http.request()` sem `finally { conn.release() }`
- `detectMissingCleanup`: Em ficheiros `.test.ts`, verifica se `beforeAll`/`beforeEach` têm correspondente `afterAll`/`afterEach`
- `detectPromiseLeak`: Procura `new Promise(` ou funções async que retornam promise sem `.catch()` ou `try/catch`
- `detectEventListenerLeak`: Procura `.on(` ou `addEventListener(` e verifica se há `.off(` ou `removeEventListener(` correspondente

---

### 3.15 Detectores de API Contract (CONTRACT-*)

| ID | Detector | Issue Type | O que detecta | Severidade |
|---|---|---|---|---|
| CONTRACT-01 | `detectPublicAPISafety` | `unsafe_public_api` | Funções públicas com `any` no retorno | 2 |
| CONTRACT-02 | `detectReturnConsistency` | `inconsistent_return` | Funções que retornam tipos diferentes em branches | 2 |
| CONTRACT-03 | `detectInputValidation` | `missing_input_validation` | Funções públicas sem validação de input | 1 |
| CONTRACT-04 | `detectErrorSwallowing` | `error_swallowing` | Catch blocks que retornam `undefined` em vez de throw | 2 |

**Detalhes técnicos:**
- `detectPublicAPISafety`: Analisa funções exportadas e verifica se tipo de retorno contém `any`
- `detectReturnConsistency`: Para funções com `if/else` retorna, verifica se todos os branches retornam o mesmo tipo
- `detectInputValidation`: Funções exportadas que recebem parâmetros sem verificação de null/undefined antes de usar
- `detectErrorSwallowing`: Catch blocks que retornam `undefined`, `null`, ou valor vazio em vez de re-throw

---

### 3.16 Detectores de Taint Analysis (TAINT-*)

| ID | Detector | Issue Type | O que detecta | Severidade |
|---|---|---|---|---|
| TAINT-01 | `detectUnsanitizedInput` | `tainted_input` | Input do utilizador chega a `eval()`, `exec()`, SQL | 3 |
| TAINT-02 | `detectOpenRedirect` | `open_redirect` | Redirect para URL não validada | 3 |
| TAINT-03 | `detectSSRF` | `ssrf` | Fetch/request para URL controlada pelo utilizador | 3 |
| TAINT-04 | `detectLogInjection` | `log_injection` | Input do utilizador em `logger.info()` pode falsificar logs | 2 |

**Detalhes técnicos:**
- Sources: `req.query`, `req.body`, `req.params`, `process.argv`, `process.env`, `window.location`
- Sinks: `eval()`, `Function()`, `child_process.exec()`, `fs.readFile()` com path dinâmico, SQL queries
- Sanitizers: `parseInt()`, `Number()`, validação com zod/joi/ajv, `path.resolve()` com prefix check
- Fluxo simplificado: procura patterns de source → sink no mesmo ficheiro (sem cross-file)
- Não é taint analysis completa como CodeQL — é detecção baseada em patterns

---

### 3.17 Detectores de Repository Metadata (REPO-*)

| ID | Detector | Issue Type | O que detecta | Severidade |
|---|---|---|---|---|
| REPO-01 | `detectMissingCODEOWNERS` | `missing_codeowners` | Sem arquivo CODEOWNERS para review assignments | 1 |
| REPO-02 | `detectMissingIssueTemplates` | `missing_issue_templates` | Sem .github/ISSUE_TEMPLATE | 1 |
| REPO-03 | `detectMissingPRTemplate` | `missing_pr_template` | Sem .github/PULL_REQUEST_TEMPLATE.md | 1 |
| REPO-04 | `detectDangerousPermissions` | `dangerous_permissions` | GitHub Actions com `permissions: contents: write` em PRs públicos | 2 |

**Detalhes técnicos:**
- Verifica `.github/CODEOWNERS`, `.github/ISSUE_TEMPLATE/`, `.github/PULL_REQUEST_TEMPLATE.md`
- Analisa `*.yml` em `.github/workflows/` para permissões perigosas
- Detecta `permissions: write` em workflows que são triggered por `pull_request`
- Detecta `pull_request_target` com checkout de PR code (vulnerabilidade conhecida)

---

### 3.18 Detectores de Environment Config (ENV-*)

| ID | Detector | Issue Type | O que detecta | Severidade |
|---|---|---|---|---|
| ENV-01 | `detectCommittedEnv` | `committed_env` | Ficheiros .env commitados no repositório | 3 |
| ENV-02 | `detectHardcodedURLs` | `hardcoded_url` | URLs/IPs hardcoded que deveriam ser variáveis de ambiente | 1 |
| ENV-03 | `detectMissingEnvValidation` | `missing_env_validation` | process.env usado sem validação/definição de schema | 2 |
| ENV-04 | `detectInsecureEnvDefaults` | `insecure_defaults` | Valores padrão inseguros para variáveis sensíveis | 2 |

**Detalhes técnicos:**
- `detectCommittedEnv`: Verifica se `.env` existe e se está no `.gitignore`
- `detectHardcodedURLs`: Procura padrões `http://`, `https://`, `\d+\.\d+\.\d+\.\d+` em código fonte (não em testes)
- `detectMissingEnvValidation`: Procura `process.env.X` sem `process.env.X ?? defaultValue` ou schema validation
- `detectInsecureEnvDefaults`: Detecta `process.env.PASSWORD || "password"` ou padrões similares

---

### 3.19 Detectores de Commit Quality (COMMIT-*)

| ID | Detector | Issue Type | O que detecta | Severidade |
|---|---|---|---|---|
| COMMIT-01 | `detectConventionalCommits` | `bad_commit_format` | Mensagens que não seguem `type(scope): message` | 1 |
| COMMIT-02 | `detectCommitSize` | `oversized_commit` | Commits >500 linhas alteradas | 1 |
| COMMIT-03 | `detectSecretsInHistory` | `secret_in_history` | Possíveis secrets em mensagem de commit | 2 |
| COMMIT-04 | `detectCommitMessageLength` | `short_commit_msg` | Mensagens <10 caracteres | 1 |

**Detalhes técnicos:**
- `detectConventionalCommits`: Valida formato `type(scope): description` com types: feat, fix, docs, style, refactor, test, chore, perf, ci, build, revert
- `detectCommitSize`: `git diff --stat HEAD~1` e verifica linhas adicionadas/removidas
- `detectSecretsInHistory`: Procura padrões de secrets em mensagens de commit: `password=`, `token=`, `key=`, `secret=`
- `detectCommitMessageLength`: Mensagens de commit com menos de 10 caracteres

---

### 3.20 Detectores de Meta-Security (META-*)

| ID | Detector | Issue Type | O que detecta | Severidade |
|---|---|---|---|---|
| META-01 | `detectSuspiciousScripts` | `suspicious_script` | Scripts preinstall/postinstall suspeitos em package.json | 3 |
| META-02 | `detectTyposquatting` | `typosquatting` | Dependências com nomes parecidos com pacotes populares | 3 |
| META-03 | `detectMissingIntegrity` | `missing_integrity` | Scripts sem verificação de integridade | 2 |

**Detalhes técnicos:**
- `detectSuspiciousScripts`: Verifica `preinstall`, `postinstall`, `prepare` scripts em package.json por padrões suspeitos (download, exec, curl, wget)
- `detectTyposquatting`: Lista de pacotes populares e verifica se dependências têm nomes muito similares (distância de Levenshtein <= 2)
- `detectMissingIntegrity`: Scripts que executam código externo sem verificação de hash

---

### 3.21 Detectores de CI/CD Pipeline (CI-*)

| ID | Detector | Issue Type | O que detecta | Severidade |
|---|---|---|---|---|
| CI-01 | `detectCISecretExposure` | `ci_secret_exposure` | Secrets expostos em workflows (echo, print) | 3 |
| CI-02 | `detectUnpinnedCIActions` | `unpinned_action` | GitHub Actions sem version pinning (usa `@main`) | 2 |
| CI-03 | `detectCIRiskyTriggers` | `risky_trigger` | Workflows triggered por eventos perigosos (workflow_dispatch sem branch protection) | 2 |

**Detalhes técnicos:**
- `detectCISecretExposure`: Procura `echo ${{ secrets.` ou `print` em workflows — embora GitHub ofusque, patterns indicam más práticas
- `detectUnpinnedCIActions`: Actions como `uses: actions/checkout@main` em vez de `@v4` — risco de supply chain
- `detectCIRiskyTriggers`: `workflow_dispatch` sem branch protection, `pull_request_target` com checkout

---

### 3.22 Detectores de Access Control (ACCESS-*)

| ID | Detector | Issue Type | O que detecta | Severidade |
|---|---|---|---|---|
| ACCESS-01 | `detectMissingAuthGuard` | `missing_auth_guard` | Rotas API sem middleware de autenticação | 3 |
| ACCESS-02 | `detectPrivilegeEscalation` | `privilege_escalation` | Uso de `as any` em operações de permissão | 2 |
| ACCESS-03 | `detectMissingRateLimit` | `missing_rate_limit` | Endpoints públicos sem rate limiting | 2 |

**Detalhes técnicos:**
- `detectMissingAuthGuard`: Procura padrões de rotas (Express/Fastify) sem middleware de auth
- `detectPrivilegeEscalation`: Uso de `as any` ou `@ts-ignore` em código que manipula permissões/roles
- `detectMissingRateLimit`: Endpoints públicos (GET/POST) sem rate limit middleware

---

## Parte 4: Resumo de Todos os Detectores

### Contagem por Categoria

| Categoria | ID Prefix | Detectores | Status |
|---|---|---|---|
| **Governance** | (diversos) | 33 | ✅ Implementado |
| **Engineering Audit** | E1-E7 | 7 | ✅ Implementado |
| **Code Quality (existing)** | P1-P5 | 5 | ✅ Implementado |
| **Supply Chain** | SC-* | 5 | ✅ Implementado |
| **Dependency Analysis** | DEND-* | 7 | 📋 Planeado |
| **Security** | SEC-* | 12 | 📋 Planeado |
| **Performance** | PERF-* | 10 | 📋 Planeado |
| **Accessibility** | A11Y-* | 7 | 📋 Planeado |
| **Documentation** | DOC-* | 8 | 📋 Planeado |
| **Git** | GIT-* | 7 | 📋 Planeado |
| **Configuration** | CONF-* | 10 | 📋 Planeado |
| **Testing** | TEST-* | 8 | 📋 Planeado |
| **API** | API-* | 6 | 📋 Planeado |
| **Code Quality (new)** | CQ-* | 12 | 📋 Planeado |
| **Monorepo** | MONO-* | 4 | 📋 Planeado |
| **Licenses** | LIC-* | 4 | 📋 Planeado |
| **Resource Leaks** | RL-* | 5 | 📋 Planeado |
| **API Contract** | CONTRACT-* | 4 | 📋 Planeado |
| **Taint Analysis** | TAINT-* | 4 | 📋 Planeado |
| **Repository Metadata** | REPO-* | 4 | 📋 Planeado |
| **Environment Config** | ENV-* | 4 | 📋 Planeado |
| **Commit Quality** | COMMIT-* | 4 | 📋 Planeado |
| **Meta-Security** | META-* | 3 | 📋 Planeado |
| **CI/CD Pipeline** | CI-* | 3 | 📋 Planeado |
| **Access Control** | ACCESS-* | 3 | 📋 Planeado |
| **TOTAL** | | **~166** | **50 implementados** |

---

## Parte 5: Novo Nível "Code Review"

### O que é
O nível `code-review` é o mais completo. Executa **todos** os detectores + análise end-to-end do projeto.

### Activação
```bash
nexus audit --level code-review
# ou
nexus audit --code-review
```

### Cobertura Total

```
┌─────────────────────────────────────────────────────────────┐
│                    CODE REVIEW LEVEL                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. GOVERNANCE (33 detectores)                    ✅        │
│     └─ Documentação, estrutura, referências, consistência   │
│                                                             │
│  2. ENGINEERING (12 detectores)                   ✅        │
│     └─ Código fonte, testes, lint, tipos                    │
│                                                             │
│  3. CODE QUALITY (17 detectores)                            │
│     └─ Padrões, complexidade, código morto                  │
│                                                             │
│  4. DEPENDENCIES (7 detectores)                             │
│     └─ Saúde, segurança, tamanhos                           │
│                                                             │
│  5. SECURITY (12 detectores)                                │
│     └─ Vulnerabilidades, padrões inseguros                  │
│                                                             │
│  6. PERFORMANCE (10 detectores)                             │
│     └─ Sync I/O, payloads, imports                          │
│                                                             │
│  7. ACCESSIBILITY (7 detectores)                            │
│     └─ ARIA, labels, contraste                              │
│                                                             │
│  8. DOCUMENTATION (8 detectores)                            │
│     └─ JSDoc, README, CHANGELOG                             │
│                                                             │
│  9. GIT (7 detectores)                                      │
│     └─ Commits, branches, gitignore                         │
│                                                             │
│ 10. CONFIGURATION (10 detectores)                           │
│     └─ tsconfig, eslint, CI/CD                              │
│                                                             │
│ 11. TESTING (8 detectores)                                  │
│     └─ Flaky, isolamento, cobertura                         │
│                                                             │
│ 12. API (6 detectores)                                      │
│     └─ Semver, exports, types                               │
│                                                             │
│ 13. MONOREPO (4 detectores)                                 │
│     └─ Cyclic, versões, build order                         │
│                                                             │
│ 14. LICENSES (4 detectores)                                 │
│     └─ GPL/AGPL compliance, conflitos                       │
│                                                             │
│ 15. SUPPLY CHAIN (5 detectores)                   ✅        │
│     └─ Unpinned, lock file, phantom deps, deprecated        │
│                                                             │
│ 16. RESOURCE LEAKS (5 detectores)                           │
│     └─ Streams, connections, event listeners                 │
│                                                             │
│ 17. API CONTRACT (4 detectores)                             │
│     └─ Public API safety, input validation                  │
│                                                             │
│ 18. TAINT ANALYSIS (4 detectores)                           │
│     └─ Unsanitized input, open redirect, SSRF               │
│                                                             │
│ 19. REPOSITORY METADATA (4 detectores)                      │
│     └─ CODEOWNERS, issue templates, permissions             │
│                                                             │
│ 20. ENVIRONMENT CONFIG (4 detectores)                       │
│     └─ .env committed, hardcoded URLs, validation           │
│                                                             │
│ 21. COMMIT QUALITY (4 detectores)                           │
│     └─ Conventional commits, size, secrets                  │
│                                                             │
│ 22. META-SECURITY (3 detectores)                            │
│     └─ Suspicious scripts, typosquatting                    │
│                                                             │
│ 23. CI/CD PIPELINE (3 detectores)                           │
│     └─ Secret exposure, unpinned actions                    │
│                                                             │
│ 24. ACCESS CONTROL (3 detectores)                           │
│     └─ Auth guards, rate limiting                           │
│                                                             │
│  TOTAL: ~166 detectores (50 implementados)                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Parte 6: Detecção Adaptativa por Tipo de Projeto

### Princípio
O nexus-system deve servir para **outros projetos**. Os detectores devem ser adaptativos.

### Detecção automática do stack

```typescript
interface ProjectProfile {
  language: "typescript" | "javascript" | "both";
  framework: "react" | "vue" | "angular" | "node" | "deno" | "bun" | "none";
  monorepo: boolean;
  hasTests: boolean;
  hasCI: boolean;
  hasDocker: boolean;
  hasAPI: boolean;
  packageManager: "npm" | "pnpm" | "yarn" | "bun";
}
```

### Activar detectores relevantes

| Stack | Detectores activos |
|---|---|
| **React/Vue/Angular** | Todos + A11Y-* |
| **Node.js/Deno/Bun** | Todos - A11Y-* |
| **Monorepo** | Todos + MONO-* |
| **Sem testes** | Todos - TEST-* (mas reportar "missing tests") |
| **Sem CI** | Todos - GIT-*, CI-* (mas reportar "missing CI") |
| **Sem API** | Todos - API-*, CONTRACT-*, ACCESS-* |
| **CLI tool** | Todos - A11Y-*, API-*, ACCESS-* |

### Adaptação automática

```typescript
function getActiveDetectors(profile: ProjectProfile): string[] {
  const base = [...DETECTORS_BY_LEVEL["code-review"]];
  
  // Desactivar detectores irrelevantes
  if (!profile.hasTests) base.filter(d => !d.startsWith("TEST-"));
  if (!profile.monorepo) base.filter(d => !d.startsWith("MONO-"));
  if (profile.framework === "none") base.filter(d => !d.startsWith("A11Y-"));
  if (!profile.hasCI) base.filter(d => !d.startsWith("CI-") && !d.startsWith("GIT-"));
  if (!profile.hasAPI) base.filter(d => !d.startsWith("API-") && !d.startsWith("CONTRACT-") && !d.startsWith("ACCESS-"));
  
  return base;
}
```

---

## Parte 7: Cache Inteligente

### Hash-based cache

```typescript
interface AuditCache {
  timestamp: string;
  fileHashes: Map<string, string>; // path → SHA256
  results: Map<string, HealthIssue[]>; // detector → issues
  level: AuditLevel;
}
```

### Estratégia

1. **Antes de executar**: calcular hash de todos os arquivos `src/`
2. **Comparar com cache**: se hash não mudou → reusar resultados
3. **Invalidar por detector**: se só mudou `package.json`, re-executar apenas `detectDependencies*`
4. **TTL**: cache expira após 5 minutos (configurável)
5. **Force**: `nexus audit --no-cache` ignora cache

### Armazenamento

```
nexus-system/
├── .audit-cache/
│   ├── manifest.json          # hashes dos arquivos
│   ├── governance.json        # cache dos detectores governance
│   ├── engineering.json       # cache dos detectores engineering
│   └── code-review.json       # cache dos detectores code-review
```

---

## Parte 8: Execução Paralela

### Problema actual
Detectores que chamam `execSync` bloqueiam: `detectTestHealth`, `detectLintIssues`, `detectTypeSafetyIssues`, `detectDependencyHealth`, `detectSecurityAudit`.

### Solução
Executar detectores independentes em paralelo:

```typescript
const parallelDetectors = [
  detectTestHealth(projectRoot),
  detectLintIssues(projectRoot),
  detectTypeSafetyIssues(projectRoot, sourceFiles),
  detectDependencyHealth(projectRoot),
  detectSecurityAudit(projectRoot),
];

const parallelResults = await Promise.allSettled(parallelDetectors);
```

### Timeout por detector
```typescript
const DETECTOR_TIMEOUTS: Record<string, number> = {
  detectTestHealth: 120_000,      // 2 minutos
  detectLintIssues: 60_000,       // 1 minuto
  detectTypeSafetyIssues: 60_000, // 1 minuto
  detectDependencyHealth: 30_000, // 30 segundos
  detectSecurityAudit: 30_000,    // 30 segundos
};
```

---

## Parte 9: Ordem de Implementação

### Fase A: Arquitetura (dias 1-2)
1. Criar directório `src/audit/`
2. Extrair tipos para `types.ts`
3. Extrair constantes para `constants.ts`
4. Extrair funções compartilhadas para `shared.ts`
5. Extrair score para `health-score.ts`
6. Extrair optimizações para `optimization-proposer.ts`
7. Extrair detectores governance para `governance-detectors.ts`
8. Extrair detectores engineering para `engineering-detectors.ts`
9. Actualizar `health-auditor.ts` para importar dos novos módulos
10. Actualizar `audit.ts` para importar do novo caminho
11. Typecheck + testes + build

### Fase B: Melhorias nos 8 pontos (dia 3)
1. Melhorar `unused_export` (filtrar barrel files)
2. Melhorar `empty_catch` (distinguir intencional)
3. Melhorar `dead_code` para TODOs (agrupar por ficheiro)
4. Melhorar `circular_deps` (resolver aliases)
5. Melhorar `high_complexity` (ignorar strings)
6. Paralelizar detectores execSync
7. Implementar cache baseado em hash
8. Typecheck + testes + build

### Fase C: Novos detectores — Supply Chain + Licenças (dia 4)
1. ✅ SC-01 a SC-05 (já implementados)
2. Adicionar detectores LIC-* (licenças)
3. Typecheck + testes + build

### Fase D: Novos detectores — Security + Meta (dia 5)
1. Adicionar detectores SEC-* (segurança)
2. Adicionar detectores META-* (meta-security)
3. Adicionar detectores TAINT-* (taint analysis simplificado)
4. Typecheck + testes + build

### Fase E: Novos detectores — Dependencies + Resource Leaks (dia 6)
1. Adicionar detectores DEND-* (dependências)
2. Adicionar detectores RL-* (resource leaks)
3. Adicionar detectores CONTRACT-* (API contract)
4. Typecheck + testes + build

### Fase F: Novos detectores — Performance + Config (dia 7)
1. Adicionar detectores PERF-* (performance)
2. Adicionar detectores CONF-* (configuração)
3. Adicionar detectores ENV-* (environment)
4. Typecheck + testes + build

### Fase G: Novos detectores — Git + CI + Commit (dia 8)
1. Adicionar detectores GIT-* (git)
2. Adicionar detectores CI-* (CI/CD)
3. Adicionar detectores COMMIT-* (commit quality)
4. Adicionar detectores REPO-* (repository metadata)
5. Typecheck + testes + build

### Fase H: Novos detectores — A11Y + Doc + Test + API + CQ + Mono (dia 9)
1. Adicionar detectores A11Y-* (acessibilidade)
2. Adicionar detectores DOC-* (documentação)
3. Adicionar detectores TEST-* (testes)
4. Adicionar detectores API-* (API)
5. Adicionar detectores CQ-* (code quality)
6. Adicionar detectores MONO-* (monorepo)
7. Adicionar detectores ACCESS-* (access control)
8. Typecheck + testes + build

### Fase I: Cache + Paralelismo (dia 10)
1. Implementar cache baseado em hash
2. Implementar execução paralela
3. Adicionar timeouts configuráveis
4. Typecheck + testes + build

### Fase J: Integração Final (dia 11)
1. Actualizar `audit.ts` para novo nível code-review
2. Actualizar display para novo formato
3. Actualizar JSON output
4. Implementar detecção adaptativa de stack
5. Actualizar testes
6. Actualizar documentação
7. Typecheck + testes + build + code review

---

## Resumo do Impacto

| Métrica | Antes | Depois |
|---|---|---|
| **Detectores** | 45 | ~166 |
| **Implementados** | 45 | 50 (+5 SC) |
| **Níveis** | 3 (quick/standard/full) | 4 (+code-review) |
| **Ficheiros** | 1 (3060 linhas) | ~10 (~400 linhas cada) |
| **Reutilizável** | Não | Sim (qualquer projeto TS/JS) |
| **Cache** | Não | Sim (hash-based) |
| **Paralelo** | Não | Sim (Promise.all) |
| **Adaptativo** | Não | Sim (por stack/project type) |
| **Segurança** | Não | Sim (12+4+3+3 detectores) |
| **Performance** | Não | Sim (10 detectores) |
| **Acessibilidade** | Não | Sim (7 detectores) |
| **Git** | Parcial | Completo (7+4+3 detectores) |
| **Supply Chain** | Não | Sim (5 detectores) ✅ |
| **Licenças** | Não | Sim (4 detectores) |
| **Resource Leaks** | Não | Sim (5 detectores) |
| **Taint Analysis** | Não | Sim (4 detectores) |

---

## Prioridades de Implementação

### P0 (Imprescindível)
1. Dividir health-auditor.ts
2. Adicionar nível code-review
3. Detectores de segurança (SEC-*)
4. Cache inteligente

### P1 (Muito importante)
5. ✅ Detectores de supply chain (SC-*) — IMPLEMENTADO
6. Detectores de dependências (DEND-*)
7. Melhorar detectores existentes (8 pontos)
8. Execução paralela
9. Detecção adaptativa

### P2 (Importante)
10. Detectores de licenças (LIC-*)
11. Detectores de resource leaks (RL-*)
12. Detectores de API contract (CONTRACT-*)
13. Detectores de performance (PERF-*)
14. Detectores de configuração (CONF-*)

### P3 (Desejável)
15. Detectores de taint analysis (TAINT-*)
16. Detectores de repository metadata (REPO-*)
17. Detectores de environment config (ENV-*)
18. Detectores de commit quality (COMMIT-*)
19. Detectores de meta-security (META-*)
20. Detectores de CI/CD (CI-*)

### P4 (Completeness)
21. Detectores de acessibilidade (A11Y-*)
22. Detectores de documentação (DOC-*)
23. Detectores de testing (TEST-*)
24. Detectores de API (API-*)
25. Detectores de code quality (CQ-*)
26. Detectores de monorepo (MONO-*)
27. Detectores de access control (ACCESS-*)
