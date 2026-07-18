# Plano: shiten init + audit para projectos activos

## Objectivo
Quando `shiten init` detecta que o projecto já está inicializado, o sistema deve:
1. **Detectar** se é um projecto novo (só framework instalado) vs activo (tem código implementado)
2. **Se activo**: correr `auditHealth()` e exibir resultado num mini-dashboard
3. **Se novo**: mostrar flow normal de re-avaliação de maturidade

## Lógica de Detecção: Novo vs Activo

Usar sinais combinados (não apenas `sourceFileCount` que varia por ecossistema):

| Sinal | Novo/Starter | Activo |
|---|---|---|
| `sourceFileCount` | < 10 | >= 10 |
| Git commits totais | 0 | >= 1 |

**Decisão:** `isStarterProject = sourceFileCount < 10 && totalCommits < 2`

## Ficheiros a Modificar

### 1. `src/analyser.ts` — Adicionar contagem de commits
- Adicionar campo `totalCommits: number` ao `ProjectAnalysis`
- Implementar `countTotalCommits(projectRoot: string): number`
  - Comando: `git rev-list --count HEAD 2>/dev/null`
  - Fallback: 0 se git não disponível

### 2. `src/commands/init.ts` — Integrar audit no path de projecto existente
- Importar `auditHealth` de `../health-auditor.js`
- Importar `discoverArtifacts`, `discoverRelations`, `analyzeGraph` de `../knowledge-graph.js`
- No branch de projecto existente (linha 127-196):
  - Após `displayCapabilities(profile)`
  - Verificar `isStarterProject(analysis)`
  - **Se starter:** mostrar sugestão "Quando tiveres código, corre `shiten audit`"
  - **Se activo:** chamar `auditHealth()` e exibir mini-dashboard

### 3. Nova função `displayMiniDashboard()` em `src/commands/init.ts`
Secções do mini-dashboard:
- Health Score com barra visual
- Rules count
- Issues resumidos (critical/warning/info)
- Knowledge Graph: artifacts, relations, health, orphans
- Top issues list
- Sugestão de próximo comando

## Steps Atómicos

### Step 1: Adicionar `totalCommits` ao `ProjectAnalysis`
- Ficheiro: `src/analyser.ts`
- Adicionar campo `totalCommits: number` à interface
- Implementar `countTotalCommits()` usando `git rev-list --count HEAD`
- Adicionar chamada em `analyseProject()`

### Step 2: Criar função `isStarterProject()`
- Ficheiro: `src/commands/init.ts`
- Lógica: `analysis.sourceFileCount < 10 && analysis.totalCommits < 2`

### Step 3: Criar função `displayMiniDashboard()`
- Ficheiro: `src/commands/init.ts`
- Recebe: `auditReport: HealthAuditReport`, `graphAnalysis: GraphAnalysis`
- Exibe: health score com barra, issues resumidos, knowledge graph status

### Step 4: Integrar no path de projecto existente
- Ficheiro: `src/commands/init.ts`
- Após `displayCapabilities(profile)`:
  - Se `isStarterProject(analysis)` → mostrar "Run `shiten audit` when ready"
  - Se activo → chamar `auditHealth()`, `analyzeGraph()`, `displayMiniDashboard()`

### Step 5: Adicionar testes
- Testar `countTotalCommits()` com mocks de git
- Testar `isStarterProject()` com diferentes cenários
- Testar `displayMiniDashboard()` output

## Salvaguardas
- Se `auditHealth()` falhar, mostrar mensagem amigável
- Se git não disponível, `totalCommits = 0` (tratar como starter)
- Não quebrar flow existente de re-avaliação de maturidade
