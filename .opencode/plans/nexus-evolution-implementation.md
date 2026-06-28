# NEXUS EVOLUTION — Plano de Implementação

> **O Nexus não é orientado por comandos. O Nexus é orientado por um modelo
> de engenharia. Os comandos são apenas interfaces para interagir com esse modelo.**

> **Status:** Backlog (aguardando implementação)
> **Ordem:** Sequencial, commit após cada objetivo
> **Referência:** `plans/NEXUS_EVOLUTION_PLAN.md`

---

## Princípios Arquiteturais

Estes princípios são permanentes e devem guiar todas as decisões desta
e futuras implementações.

### 1. Separação entre Domínio e Infraestrutura

Conceitos do domínio (Assets, Capabilities, State) ficam em `src/domain/`.
Detalhes de implementação (discovery, persistence, adapters) ficam em
`src/infrastructure/`.

**Regra:** "Estou modelando um conceito do domínio ou um detalhe da
implementação?" Se for detalhe, pertence à infraestrutura.

### 2. Regra de Dependências

```
Domain (núcleo)
   ↑
Infrastructure (aponta para o domínio)
```

**O domínio nunca depende da infraestrutura. A infraestrutura depende do domínio.**

Somente o Engineering State pode conhecer todos os módulos. Os demais
módulos permanecem independentes entre si e nunca estabelecem dependências
bidirecionais.

### 3. Crescimento Orientado por Capacidades

O Nexus cresce através da ativação de capacidades, não pela adição de
comandos. Cada capability controla suas regras, skills, templates e
métricas. O Capability Engine gerencia esse ciclo de vida.

### 4. Engines como Ponto de Extensão

A interface `Engine<TInput, TOutput>` existe para habilitar futuros engines
(Recommendation, Governance, Knowledge, Evolution). Cada engine é uma
implementação independente. Não se cria framework prematuro — cria-se
extensibilidade.

### 5. Agregados Complexos Utilizam Builders

O Engineering State é um agregado construído a partir de múltiplas fontes.
O `EngineeringStateBuilder` permite adicionar sub-estados sem modificar uma
função gigante. Cada `with*()` é independente e opcional.

### 6. Infraestrutura Nunca Contamina o Domínio

Modelos de domínio (types, interfaces) não importam módulos de infraestrutura.
Discovery, persistence e adapters são dependências que apontam para o domínio,
nunca o contrário.

### 7. Compatibilidade Retroativa

Sempre que possível, manter bridge functions e aliases para código existente.
Migrações graduais são preferíveis a quebras abruptas.

---

## Critérios de Evolução

Nenhuma nova entidade poderá ser adicionada ao Nexus sem responder
explicitamente às seguintes perguntas:

| # | Pergunta | O que valida |
|---|----------|--------------|
| 1 | Qual conceito de engenharia ela representa? | Que a entidade tem razão de existir no domínio |
| 2 | Ela pertence ao domínio ou à infraestrutura? | Que a separação é correta |
| 3 | Ela reduz ou aumenta a complexidade do modelo? | Que a entidade agrega valor |
| 4 | Ela pode evoluir sem quebrar a arquitetura existente? | Que a evolução é segura |

Somente após essas respostas a entidade deve ser implementada.

---

## Ordem de Implementação

```
Obj 3: Engineering Assets  →  Obj 2: Capabilities 1ª classe  →  Obj 1: Engineering State  →  Obj 5: Capability Engine  →  Obj 4: Pipeline Explícito
```

**Justificativa:** Assets é fundação (outros módulos referenciam ativos).
Capabilities enriquece o modelo. Engineering State consolida tudo.
Capability Engine gerencia ciclo de vida. Pipeline integra a sequência completa.

---

## Objetivo 3: Engineering Assets

**O que falta:** Não existe `EngineeringAsset` como entidade. O `Artifact`
no knowledge-graph é discovery, não model. Arquivos são tratados como arquivos,
não como ativos.

### Estrutura

#### Domínio — `src/domain/engineering-asset.ts`

```typescript
export type AssetType =
  | "adr" | "skill" | "policy" | "rule" | "prompt"
  | "context" | "template" | "checklist" | "decision"
  | "contract" | "runbook" | "workflow" | "script";

export type AssetStatus = "active" | "draft" | "archived" | "deprecated";

export interface AssetRelation {
  targetId: string;
  type: "depends_on" | "supersedes" | "extends" | "implements"
      | "references" | "generates" | "validates" | "documents";
  description?: string;
}

export interface EngineeringAsset {
  id: string;
  type: AssetType;
  name: string;
  path: string;              // apenas referência, não operação FS
  description: string;
  status: AssetStatus;
  tags: string[];
  metadata: Record<string, unknown>;
  owner?: string;            // quem é responsável pelo ativo
  confidence?: number;       // nível de confiança (0-1)
  relations: AssetRelation[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface AssetRegistry {
  assets: EngineeringAsset[];
  lastScan: string;
  totalByType: Record<AssetType, number>;
  totalByStatus: Record<AssetStatus, number>;
}
```

#### Infraestrutura — `src/infrastructure/`

```
src/infrastructure/
├── asset-discovery.ts        // descoberta de ativos (FS inicialmente)
│   ├── discoverAssets(nexusDir): EngineeringAsset[]
│   └── (futuro: discoverFromGit, discoverFromAPI, discoverFromMCP)
├── asset-repository.ts       // persistência
│   ├── loadRegistry(): AssetRegistry
│   ├── saveRegistry(): void
│   └── getAssetById(): EngineeringAsset | null
└── asset-bridge.ts           // compatibilidade com knowledge-graph
    ├── assetsToArtifacts(): Artifact[]
    └── artifactsToAssets(): EngineeringAsset[]
```

#### Funções do Domínio — `src/domain/engineering-asset.ts`

```typescript
// CRUD (operações sobre o modelo)
export function createAsset(input: CreateAssetInput): EngineeringAsset;
export function updateAsset(asset: EngineeringAsset, updates: Partial<EngineeringAsset>): EngineeringAsset;
export function archiveAsset(asset: EngineeringAsset): EngineeringAsset;
export function deprecateAsset(asset: EngineeringAsset): EngineeringAsset;

// Query (operações sobre o registry)
export function getAsset(registry: AssetRegistry, id: string): EngineeringAsset | null;
export function getAssetsByType(registry: AssetRegistry, type: AssetType): EngineeringAsset[];
export function getAssetsByStatus(registry: AssetRegistry, status: AssetStatus): EngineeringAsset[];
export function buildRegistry(assets: EngineeringAsset[]): AssetRegistry;
```

#### Atualização em `src/knowledge-graph.ts`

- `discoverArtifacts()` passa a chamar `discoverAssets()` do discovery
  e converter via `assetsToArtifacts()`
- Relação de compatibilidade mantida

#### Testes — `src/__tests__/engineering-assets.test.ts`

Testes para: CRUD, registry, discovery, lifecycle, bridge functions.

#### Commit

```
feat(assets): introduce Engineering Assets as first-class entities

Domain: src/domain/engineering-asset.ts
- EngineeringAsset with identity, state, relations, owner, confidence
- AssetRegistry for centralized asset management
- CRUD operations (create, update, archive, deprecate)

Infrastructure: src/infrastructure/
- asset-discovery.ts: filesystem-based asset discovery
- asset-repository.ts: persistence to governance/assets/registry.json
- asset-bridge.ts: compatibility with knowledge-graph Artifact type

Updated: knowledge-graph.ts to use discoverAssets() internally
```

---

## Objetivo 2: Capabilities como Entidades de Primeira Classe

**O que falta:** `CapabilityInfo` tem 5/9 propriedades. Falta state,
rules, skills, templates, metrics. Capabilities são estáticas.

### Estrutura

#### Domínio — `src/domain/capability-entity.ts`

```typescript
export type CapabilityState = "locked" | "available" | "active" | "upgrading";

export interface CapabilityRule {
  ruleId: string;
  trigger: string;
  description: string;
}

export interface CapabilitySkill {
  id: string;
  name: string;
  description: string;
  templatePath?: string;
}

export interface CapabilityMetric {
  id: string;
  name: string;
  value: number;
  unit: string;
  computedAt: string;
}

export interface CapabilityEntity extends CapabilityInfo {
  state: CapabilityState;
  activatedAt?: string;
  rules: CapabilityRule[];
  skills: CapabilitySkill[];
  templateIds: string[];
  metrics: CapabilityMetric[];
  changelog: Array<{ timestamp: string; action: string; detail: string }>;
}
```

#### Infraestrutura — `src/infrastructure/`

```
src/infrastructure/
├── capability-repository.ts    // persistência
│   ├── load(): CapabilityEntity[]
│   ├── save(): void
│   └── Persistence: governance/capabilities.json
├── capability-lifecycle.ts     // regras de negócio
│   ├── canActivate(): boolean
│   ├── canUpgrade(): boolean
│   ├── validateDependencies(): boolean
│   └── registerCapabilityRules(): void
└── capability-store.ts         // FACHADA (API pública)
    ├── loadCapabilities()
    ├── saveCapabilities()
    ├── getCapability()
    ├── activateCapability()
    ├── deactivateCapability()
    └── upgradeCapability()
```

#### Regras de Lifecycle — `src/infrastructure/capability-lifecycle.ts`

```typescript
export function canActivate(cap: CapabilityEntity, maturityScore: number): boolean;
export function canUpgrade(cap: CapabilityEntity, maturityScore: number): boolean;
export function validateDependencies(cap: Capability, installed: Capability[]): boolean;
export function registerCapabilityRules(cap: CapabilityEntity, nexusDir: string): void;
```

#### Atualização em `src/maturity-profile.ts`

- `detectInstalledCapabilities()` retorna `CapabilityEntity[]` com
  state = "active" para capabilities detectadas no filesystem

#### Testes — `src/__tests__/capability-store.test.ts`

Testes para: CRUD, activation, lifecycle rules, repository persistence.

#### Commit

```
feat(capabilities): promote capabilities to first-class entities

Domain: src/domain/capability-entity.ts
- CapabilityEntity with state, rules, skills, templates, metrics
- Capability lifecycle states: locked → available → active → upgrading

Infrastructure: src/infrastructure/
- capability-repository.ts: persistence to governance/capabilities.json
- capability-lifecycle.ts: activation/upgrade/deactivation rules
- capability-store.ts: public facade over repository and lifecycle

Updated: maturity-profile.ts to return CapabilityEntity from detection
```

---

## Objetivo 1: Engineering State

**O que falta:** `NexusState` existe em state-manager mas não é o centro.
Módulos produzem relatórios independentes. Pipeline não alimenta estado canônico.

### Estrutura

#### Domínio — `src/domain/engineering-state.ts`

```typescript
export interface MaturityState {
  overallScore: number;
  dimensions: MaturityDimensions;
  level: "junior" | "pleno" | "senior";
}

export interface ComplexityState {
  score: number;
  level: "junior" | "pleno" | "senior";
  areaScores: AreaScore[];
}

export interface AssetsState {
  total: number;
  byType: Record<AssetType, number>;
  byStatus: Record<AssetStatus, number>;
  healthScore: number;
}

export interface CapabilitiesState {
  installed: Capability[];
  active: Capability[];
  available: Capability[];
  recommended: Capability[];
}

export interface KnowledgeState {
  debt: { totalGaps: number; healthScore: number } | null;
  graph: { totalArtifacts: number; totalRelations: number; healthScore: number };
  adrs: number;
  skills: number;
}

export interface GovernanceState {
  rulesActive: number;
  rulesTotal: number;
  policiesCompliant: boolean;
}

export interface AIReadinessState {
  score: number;  // 0-100
  factors: string[];
}

export interface EntropyState {
  score: number;  // 0-100 (100 = baixa entropia)
  signals: string[];
}

export interface EngineeringState {
  projectId: string;
  projectName: string;
  computedAt: string;
  maturity: MaturityState | null;
  complexity: ComplexityState | null;
  assets: AssetsState;
  capabilities: CapabilitiesState;
  knowledge: KnowledgeState;
  governance: GovernanceState;
  aiReadiness: AIReadinessState;
  entropy: EntropyState;
  summary: string;
}

export function stateToText(state: EngineeringState): string;
```

#### Infraestrutura — `src/infrastructure/`

```
src/infrastructure/
├── engineering-state-builder.ts   // builder pattern
│   ├── class EngineeringStateBuilder
│   │   ├── withMaturity(): this
│   │   ├── withComplexity(): this
│   │   ├── withAssets(): this
│   │   ├── withCapabilities(): this
│   │   ├── withKnowledge(): this
│   │   ├── withGovernance(): this
│   │   ├── withAIReadiness(): this
│   │   ├── withEntropy(): this
│   │   ├── reset(): this           // reutilização em testes/pipelines
│   │   └── build(): EngineeringState
│   └── Factory: createDefaultBuilder()
├── state-persistence.ts           // persistência
│   ├── save(): void
│   └── load(): EngineeringState | null
└── state-manager.ts               // compatibilidade
    └── consolidateState() → delega ao Builder
```

#### Builder — `src/infrastructure/engineering-state-builder.ts`

```typescript
export function createDefaultBuilder(
  projectRoot: string,
  nexusDir: string
): EngineeringStateBuilder;

// Uso:
const state = createDefaultBuilder(projectRoot, nexusDir)
  .withMaturity()
  .withComplexity()
  .withAssets()
  .withCapabilities()
  .withKnowledge()
  .withGovernance()
  .withAIReadiness()
  .withEntropy()
  .build();

// Reutilização:
builder.reset()
  .withMaturity()
  .build();
```

#### Atualização em `src/state-manager.ts`

- `consolidateState()` passa a delegar ao `EngineeringStateBuilder`
- `NexusState` vira alias de `EngineeringState`
- Manter compatibilidade com auto-evolution.ts

#### Evento — `event-bus.ts`

Novo evento: `engineering-state.updated`

#### Testes — `src/__tests__/engineering-state.test.ts`

Testes para: builder pattern, sub-states, persistence, compatibility.

#### Commit

```
feat(state): consolidate Engineering State as canonical source of truth

Domain: src/domain/engineering-state.ts
- EngineeringState with 8 sub-states (maturity, complexity, assets,
  capabilities, knowledge, governance, AI readiness, entropy)
- Each sub-state is an independent interface for future separation

Infrastructure: src/infrastructure/
- engineering-state-builder.ts: Builder pattern with reset() for reuse
- state-persistence.ts: save/load to telemetry/engineering-state.json
- state-manager.ts: delegates to Builder, maintains compatibility

Event: engineering-state.updated published on state computation
```

---

## Objetivo 5: Capability Engine

**O que falta:** Módulo inteiro não existe. Nada registra capabilities
dinamicamente, avalia maturidade, ativa políticas/regras ou calcula evolução.

### Estrutura

#### Domínio — `src/domain/engine.ts` (interface genérica)

```typescript
export interface Engine<TInput, TOutput> {
  readonly name: string;
  readonly version: string;
  execute(input: TInput): TOutput | Promise<TOutput>;
}

export type EngineResult<T> = {
  engine: string;
  version: string;
  executedAt: string;
  data: T;
};
```

#### Domínio — `src/domain/capability-engine.ts`

```typescript
export interface CapabilityEngineInput {
  projectRoot: string;
  nexusDir: string;
}

export interface CapabilityEvaluation {
  capability: Capability;
  currentState: CapabilityState;
  maturityRequired: number;
  maturityCurrent: number;
  dependenciesMet: boolean;
  blockers: string[];
  nextAction: "activate" | "upgrade" | "wait" | "lock";
}

export interface CapabilityEngineOutput {
  evaluations: CapabilityEvaluation[];
  activations: Capability[];
  upgrades: Capability[];
  locked: Capability[];
  rulesActivated: number;
  summary: string;
}

export function createCapabilityEngine():
  Engine<CapabilityEngineInput, CapabilityEngineOutput>;
```

#### Implementação — `src/infrastructure/capability-engine-impl.ts`

```typescript
export function createCapabilityEngine(): Engine<...> {
  return {
    name: "capability-engine",
    version: "1.0.0",

    async execute(input) {
      // 1. Carregar Engineering State via Builder
      // 2. Para cada capability: verificar maturidade, dependências
      // 3. Decidir: activate, upgrade, wait, lock
      // 4. Se ativar: registrar regras via capability-lifecycle
      // 5. Publicar eventos
      // 6. Retornar resultado
    },
  };
}
```

#### Integrar com Event Bus

Novos eventos:
- `capability.activated`
- `capability.deactivated`
- `capability.upgraded`

#### Integrar com `src/commands/doctor.ts`

O doctor passa a usar o Capability Engine para avaliar capabilities.

#### Testes — `src/__tests__/capability-engine.test.ts`

Testes para: execute, activate, deactivate, rule registration.

#### Commit

```
feat(capability-engine): create Capability Engine for lifecycle management

Domain:
- src/domain/engine.ts: generic Engine<TInput, TOutput> interface
- src/domain/capability-engine.ts: input/output types

Infrastructure:
- src/infrastructure/capability-engine-impl.ts: implementation
- Uses EngineeringStateBuilder for maturity checks
- Uses capability-lifecycle for rule registration

Updated: commands/doctor.ts to use Capability Engine
Updated: event-bus.ts with capability.activated/deactivated/upgraded
```

---

## Objetivo 4: Pipeline Explícito

**O que falta:** `Pipeline` class existe mas nunca é montada. Comandos
chamam módulos diretamente.

### Estrutura

#### Domínio — `src/domain/engineering-pipeline.ts`

```typescript
export function createEngineeringPipeline(): Pipeline;
```

#### Pipeline Completa

```
[Observation]  ← placeholder para futura inclusão
    ↓
Analysis       ← analyseProject()
    ↓
Pattern Detection  ← detectPatterns()
    ↓
Knowledge Debt     ← detectKnowledgeDebt()
    ↓
Capability Eval    ← CapabilityEngine.execute()
    ↓
Engineering State  ← EngineeringStateBuilder.build()
    ↓
Recommendations    ← analyzeEvolution()
```

#### Atualização em `src/pipeline.ts`

- Tipar `PipelineContext` com campos específicos (não `unknown`)
- Adicionar: `engineResult`, `engineeringState`, `debtReport`

#### Atualização em `src/commands/run.ts`

`nexus run` passa a usar a pipeline completa.

#### Novo Comando — `src/commands/state.ts`

`nexus state` — roda a pipeline e mostra o Engineering State.

#### Atualização em `src/commands/evolve.ts`

`nexus evolve` usa a pipeline para obter estado atualizado.

#### Testes — `src/__tests__/engineering-pipeline.test.ts`

Testes de integração da pipeline completa.

#### Commit

```
feat(pipeline): wire explicit engineering pipeline

Domain: src/domain/engineering-pipeline.ts
- Full pipeline: observation → analysis → pattern → debt →
  capability → state → recommendations
- Placeholder for future Observation stage

Updated: pipeline.ts with typed PipelineContext
Updated: commands/run.ts to use engineering pipeline
Updated: commands/evolve.ts to use pipeline for fresh state
New command: nexus state (shows canonical engineering state)
```

---

## Resumo dos Commits

| # | Objetivo | Domínio | Infraestrutura | Testes |
|---|----------|---------|----------------|--------|
| 1 | Engineering Assets | `domain/engineering-asset.ts` | `infrastructure/asset-*.ts` | `engineering-assets.test.ts` |
| 2 | Capabilities 1ª classe | `domain/capability-entity.ts` | `infrastructure/capability-*.ts` | `capability-store.test.ts` |
| 3 | Engineering State | `domain/engineering-state.ts` | `infrastructure/engineering-state-builder.ts` | `engineering-state.test.ts` |
| 4 | Capability Engine | `domain/engine.ts`, `domain/capability-engine.ts` | `infrastructure/capability-engine-impl.ts` | `capability-engine.test.ts` |
| 5 | Pipeline Explícito | `domain/engineering-pipeline.ts` | `pipeline.ts` | `engineering-pipeline.test.ts` |

---

## Critérios de Aceitação (após todos os 5)

- [ ] Engineering State é a principal fonte de verdade
- [ ] Capabilities controlam a evolução do framework
- [ ] O Nexus cresce por capacidades e não por comandos
- [ ] A IA trabalha orientada pelo estado da engenharia
- [ ] O sistema recomenda continuamente a próxima melhor ação
- [ ] A organização evolui automaticamente conforme a complexidade
- [ ] Todos os testes existentes continuam passando
- [ ] Typecheck sem erros
- [ ] Nenhuma dependência bidirecional entre módulos de domínio
- [ ] O domínio nunca depende da infraestrutura
