# Enterprise Audit Plan — Shitenno-go

> **Objetivo:** Nível `enterprise` com ~140 detectores (99 atuais + ~41 novos)
> **Metodologia:** Domínios → Controles → Verificações → Evidências → Métricas → Pontuação
> **Backward Compat:** `full` mantém 99 detectores, `enterprise` é opt-in

---

## Hierarquia de Níveis

```
quick (6)        →  Governança básica
standard (27)    →  + Engenharia
full (99)        →  + Segurança, git, código, arquitetura
enterprise (140) →  + Produto, dados, performance, resiliência, observabilidade, operação, compliance, custos, evolução
```

---

## Fase 1: Fundação (Detectores P1 — 4 módulos, ~22 detectores)

### 1.1 product-detectors.ts — Estratégia, Visão e Requisitos

| Detector | Domínio | Descrição | Verificação |
|---|---|---|---|
| `detectVisionAlignment` | #1 | Verifica se README/BACKLOG refletem a visão do produto | Analisa BRIEFING.md, BACKLOG.md, README.md para coerência |
| `detectRoadmapConsistency` | #1 | Detecta roadmap desatualizado ou contraditório | Verifica existência, datas, alinhamento com BACKLOG |
| `detectKPICoverage` | #1 | Verifica existência de métricas de produto | Procura por KPIs, métricas, dashboards documentados |
| `detectOrphanRequirements` | #2 | Requisitos sem rastreabilidade para código/teste | Cruza referências em docs com imports/exports |
| `detectRequirementTraceability` | #2 | Verifica traceabilidade requisito→código→teste | Analisa se cada feature doc tem correspondente no código |
| `detectAmbiguityPatterns` | #2 | Detecta linguagem ambígua em documentação | Procura por "deve talvez", "possivelmente", "quando possível" |

### 1.2 data-architecture-detectors.ts — Arquitetura de Dados e Persistência

| Detector | Domínio | Descrição | Verificação |
|---|---|---|---|
| `detectSchemaConsistency` | #5 | Verifica consistência entre schemas doc e código | Compara schema definitions com type definitions |
| `detectDataOwnership` | #5 | Detecta dados sem ownership definido | Verifica se schemas têm campos de responsabilidade |
| `detectMissingMigrations` | #11 | Detecta alterações de schema sem migration | Compara migrations com alterações em schemas |
| `detectIndexCoverage` | #11 | Verifica se queries frequentes têm índices | Analisa queries no código vs índices definidos |

### 1.3 reliability-detectors.ts — Resiliência, Confiabilidade, Concorrência

| Detector | Domínio | Descrição | Verificação |
|---|---|---|---|
| `detectCircuitBreaker` | #17 | Verifica uso de circuit breaker em chamadas externas | Procura por padrões de circuit breaker |
| `detectRetryPolicy` | #17 | Detecta chamadas externas sem retry | Analisa chamadas HTTP/DB sem retry |
| `detectTimeoutConfig` | #17 | Verifica se chamadas externas têm timeout | Procura por timeout em fetch, HTTP, DB |
| `detectHealthChecks` | #18 | Verifica existência de health check endpoints | Procura por /health, /ready, /alive |
| `detectGracefulDegradation` | #18 | Detecta falhas sem degradação graciosa | Analisa catch blocks para fallback patterns |
| `detectRaceConditions` | #19 | Detecta padrões suscetíveis a race conditions | Procura por shared state sem sincronização |
| `detectDeadlockRisk` | #19 | Identifica padrões de deadlock potencial | Analisa locks aninhados, transações concorrentes |

### 1.4 performance-detectors.ts — Performance e Escalabilidade

| Detector | Domínio | Descrição | Verificação |
|---|---|---|---|
| `detectNPlusOne` | #15 | Detecta padrões N+1 em queries | Procura por loops com queries internas |
| `detectMissingCaching` | #15 | Verifica se endpoints pesados têm cache | Analisa endpoints sem headers de cache |
| `detectStatefulServices` | #16 | Identifica serviços stateful que impedem scaling | Procura por estado em memória compartilhada |
| `detectMissingRateLimiting` | #16 | Verifica rate limiting em endpoints públicos | Procura por rate limit middleware |
| `detectMissingTimeouts` | #15 | Detecta chamadas HTTP sem timeout configurado | Verifica fetch/axios sem timeout |

---

## Fase 2: Observabilidade e Operação (Detectores P1/P2 — 2 módulos, ~8 detectores)

### 2.1 observability-detectors.ts

| Detector | Domínio | Descrição |
|---|---|---|
| `detectMissingTracing` | #21 | Verifica distributed tracing |
| `detectLogStructure` | #21 | Verifica logs estruturados (JSON) |
| `detectAlertCoverage` | #21 | Verifica alertas para métricas críticas |
| `detectMetricEndpoints` | #21 | Verifica métricas expostas (/metrics) |

### 2.2 operations-detectors.ts

| Detector | Domínio | Descrição |
|---|---|---|
| `detectPipelineGaps` | #22 | Verifica CI/CD pipeline completo |
| `detectRollbackCapability` | #22 | Verifica mecanismo de rollback |
| `detectMissingRunbooks` | #23 | Verifica existência de runbooks |
| `detectMonitoringGaps` | #23 | Verifica monitoring de serviços críticos |

---

## Fase 3: Compliance e Custos (Detectores P2 — 2 módulos, ~7 detectores)

### 3.1 compliance-detectors.ts

| Detector | Domínio | Descrição |
|---|---|---|
| `detectLGPDCompliance` | #14 | Verifica elementos LGPD/GDPR |
| `detectDataRetention` | #14 | Verifica política de retenção |
| `detectConsentTracking` | #14 | Verifica rastreamento de consentimento |
| `detectSecretsInConfig` | #13 | Detecta segredos em configs |

### 3.2 cost-detectors.ts

| Detector | Domínio | Descrição |
|---|---|---|
| `detectUnusedResources` | #29 | Detecta recursos cloud não utilizados |
| `detectHealthTrend` | #30 | Analisa tendência de saúde |
| `detectDebtAccumulation` | #31 | Verifica se dívida técnica está crescendo |

---

## Fase 4: Evolução e Visão (Detectores P1 — 1 módulo, ~6 detectores)

### 4.1 evolution-detectors.ts

| Detector | Domínio | Descrição |
|---|---|---|
| `detectRiskMatrix` | #32 | Gera matriz de riscos |
| `detectCriticalPathRisks` | #32 | Identifica riscos no caminho crítico |
| `detectMaturityByDomain` | #33 | Mede maturidade por domínio |
| `detectDocImplementationGap` | #34 | Detecta gaps docs vs implementação |
| `detectArchitectureDrift` | #34 | Detecta drift da arquitetura |
| `detectChangeCost` | #35 | Estima custo de mudanças |

---

## Resumo

| Fase | Módulos | Detectores | Domínios |
|---|---|---|---|
| Fase 1 | 4 | ~22 | #1,2,5,11,15,16,17,18,19 |
| Fase 2 | 2 | ~8 | #21,22,23 |
| Fase 3 | 2 | ~7 | #13,14,29,30,31 |
| Fase 4 | 1 | ~6 | #32,33,34,35 |
| **Total** | **9** | **~43** | **24 novos domínios** |
