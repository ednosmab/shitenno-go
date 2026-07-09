# Gap Analysis & Coverage Plan — Nexus CLI

> **Data:** 2026-07-09
> **Base:** BACKLOG.md (126 itens) + Engineering State (score 73/100) + Health Report (200+ issues)
> **Objective:** Cobrir todos os itens faltantes do BACKLOG e resolver os issues de saúde do projeto

---

## 1. Resumo Comparativo

### Estado Actual vs. Backlog

| Métrica | Estado Actual | Backlog | Gap |
|---------|---------------|---------|-----|
| **Score de Maturidade** | 73/100 | — | quality=55, automation=30, observability=35 |
| **Score de Saúde** | 70/100 | — | 200+ issues no health report |
| **Itens Done** | — | 83 | — |
| **Itens P0** | — | 0 | Nenhum pendente |
| **Itens P1** | — | 7 | Nenhum concluído neste ciclo |
| **Itens P2** | — | 16 | Maioria não iniciada |
| **Itens P3** | — | 20 | Backlog puro |
| **Planos Activos** | 2 | — | complete-architecture-plan + dashboard-restructure |
| **Orphan Modules** | 60 | — | Necessitam activação ou remoção |
| **Empty Catches** | 55+ | — | Erros silenciados em todo o código |
| **Missing Tests** | 70 módulos | — | Módulos sem teste correspondente |
| **Broken Refs** | 10 | — | Referências quebradas em docs |
| **Console.log** | 162 | — | Deveriam usar logger |
| **Unused Exports** | 70+ | — | Exports nunca importados |
| **Context Buffer** | 161 linhas | 50 máx | Buffer inchado |

---

## 2. Análise de Lacunas por Categoria

### 2.1 Backlog P1 — Não Concluído (7 itens)

| # | Item | Descrição | Estado | Esforço |
|---|------|-----------|--------|---------|
| 1 | SA4/SA10/SA11 | Clean Architecture + SOLID refactoring | Backlog | Alto (2-3 semanas) |
| 2 | A2 | OpenCode plugin (hook antes de tarefas) | Backlog | Médio (3-5 dias) |
| 3 | A3 | Cursor integration (extensão VS Code) | Backlog | Médio (3-5 dias) |
| 4 | A4 | Git hooks (`nexus hooks --install`) | Backlog | Baixo (1-2 dias) |
| 5 | A7 | Skill template (`nexus skill:create`) | Backlog | Baixo (1-2 dias) |
| 6 | A5 | Webhook de sessão | Backlog | Baixo (1 dia) |
| 7 | A6 | Context injection API (`nexus serve`) | Backlog | Médio (2-3 dias) |

### 2.2 Backlog P2 — Não Concluído (16 itens)

| # | Item | Descrição | Estado | Esforço |
|---|------|-----------|--------|---------|
| 1 | 2.1 | Aprovação de regras candidatas | Backlog | Baixo |
| 2 | 2.2b | Feedback ↔ capability-engine | Backlog | Baixo |
| 3 | 2.3b | Bench --compare histórico | Backlog | Baixo |
| 4 | 2.4 | Feedback --list | Backlog | Baixo |
| 5 | 2.7 | Differential briefing --compact | Backlog | Baixo |
| 6 | 2.12 | JSDoc nas funções novas | Backlog | Baixo |
| 7 | 2.13 | Consolidar planos de plans/ | Backlog | Médio |
| 8 | 2.14 | Documentar limitações conhecidas | Backlog | Baixo |
| 9 | 2.15 | Teste manual de onboarding | Backlog | Médio |
| 10 | 2.16 | Lazy loading de módulos pesados | Backlog | Baixo |
| 11 | 2.17 | Benchmark suite automatizada CI | Backlog | Baixo |
| 12 | D1 | Interactive tutorial | Backlog | Médio |
| 13 | D2 | Example projects | Backlog | Médio |
| 14 | DA1-4 | Usage analytics + Error tracking | Backlog | Médio |
| 15 | S1-4 | Security hardening | Backlog | Médio |
| 16 | 2.19 | Dashboard responsividade | Backlog | Baixo |

### 2.3 Issues de Saúde Não Cobertos pelo Backlog (Críticos)

| # | Issue | Severidade | Quantidade | Impacto |
|---|-------|------------|------------|---------|
| 1 | Empty catch blocks | Alta | 55+ | Erros silenciados em todo o código |
| 2 | Console.log fora de commands | Média | 162 | Logging inconsistente |
| 3 | High cyclomatic complexity | Alta | 40+ funções | Manutenibilidade degradada |
| 4 | Oversized files (>500 linhas) | Média | 14 arquivos | 3 >1000 linhas (crítico) |
| 5 | Unused exports | Baixa | 70+ | Dead code acumulado |
| 6 | Orphan modules | Média | 14 (severo) | Módulos ~4000 linhas sem uso |
| 7 | Broken refs em docs | Média | 10 | Documentação desactualizada |
| 8 | Empty directories | Baixa | 7 | Estrutura criada mas vazia |
| 9 | Extension mismatches | Média | 3 | context_buffer.md vs .yaml |
| 10 | Date placeholders | Média | 4 | Datas YYYY-MM-DD em docs |

### 2.4 Gaps de Dimensão de Maturidade

| Dimensão | Score Actual | Target | Gap | Causa |
|----------|-------------|--------|-----|-------|
| **quality** | 55 | 80+ | -25 | 70 módulos sem teste, catches vazios |
| **automation** | 30 | 60+ | -30 | CI sem benchmarks, sem auto-fix |
| **observability** | 35 | 60+ | -25 | 162 console.log, sem structured logging |
| **architecture** | 90 | 95+ | -5 | 3 oversized files, orphan modules |
| **governance** | 100 | 100 | 0 | ✅ Completo |
| **ai** | 100 | 100 | 0 | ✅ Completo |
| **documentation** | 100 | 100 | 0 | ✅ Completo |

---

## 3. Plano de Cobertura — Fases

### Fase 0: Quick Wins (1-2 dias) — Saúde do Código

> **Objectivo:** Resolver os issues mais críticos de saúde que bloqueiam outras melhorias.

| # | Acção | Arquivos | Esforço | Impacto |
|---|-------|----------|---------|---------|
| 0.1 | Podar context_buffer.yaml (161→50 linhas) | context_buffer.yaml | 30min | Saúde |
| 0.2 | Actualizar 4 datas placeholder nos docs | FORBIDDEN, DESDO, KNOWLEDGE, HIERARCHY | 20min | Limpeza |
| 0.3 | Corrigir 10 broken refs em docs | AGENTS, CONCEPTUAL, capabilities, etc. | 40min | Limpeza |
| 0.4 | Corrigir 3 extension mismatches (.md→.yaml) | 3 agent contracts | 15min | Limpeza |
| 0.5 | Remover empty directories ou adicionar README | 7 dirs | 20min | Limpeza |
| 0.6 | Corrigir report naming (complexity---) | 1 ficheiro | 5min | Limpeza |

### Fase 1: Quality Push (3-5 dias) — Testes e Error Handling

> **Objectivo:** Elevar quality score de 55→70+ cobrindo os 70 módulos sem teste e resolvendo catches vazios.

| # | Acção | Arquivos | Esforço | Impacto |
|---|-------|----------|---------|---------|
| 1.1 | Adicionar logger.debug() em 55+ catches vazios | ~30 arquivos src/ | 4h | quality +5 |
| 1.2 | Criar testes para módulos críticos (top 20) | engineering-state, rule-engine, etc. | 2-3 dias | quality +10 |
| 1.3 | Substituir 162 console.log por logger | ~30 arquivos src/ | 2h | observability +5 |
| 1.4 | Remover unused exports (70+) | ~20 arquivos src/ | 2h | Limpeza |
| 1.5 | Activar ou remover 14 orphan modules | 14 arquivos | 1 dia | Arquitetura +5 |

### Fase 2: Architecture Refactoring (5-7 dias) — Oversized Files

> **Objectivo:** Resolver os 3 arquivos >1000 linhas e reduzir complexidade ciclomática.

| # | Acção | Arquivos | Esforço | Impacto |
|---|-------|----------|---------|---------|
| 2.1 | Dividir governance-detectors.ts (1399→3x450) | audit/governance-detectors.ts | 1-2 dias | architecture +5 |
| 2.2 | Dividir engineering-detectors.ts (1246→3x400) | audit/engineering-detectors.ts | 1-2 dias | architecture +5 |
| 2.3 | Dividir rule-engine.ts (1237→3x400) | rule-engine.ts | 1 dia | architecture +3 |
| 2.4 | Refactor optimization-proposer.ts (cc:63) | audit/optimization-proposer.ts | 1 dia | quality +3 |
| 2.5 | Refactor act.ts (cc:35), goal.ts (cc:47) | commands/act.ts, goal.ts | 1 dia | quality +3 |
| 2.6 | Refactor plan.ts (cc:66), audit.ts (cc:69) | commands/plan.ts, audit.ts | 1 dia | quality +3 |

### Fase 3: Automation & CI (3-5 dias) — Score 30→50

> **Objectivo:** Elevar automation de 30 para 50+ com CI improvements.

| # | Acção | Arquivos | Esforço | Impacto |
|---|-------|----------|---------|---------|
| 3.1 | Adicionar `pnpm bench` ao CI | .github/workflows/ci.yml | 1h | automation +5 |
| 3.2 | Adicionar `pnpm audit --audit-level=high` ao CI | CI workflow | 30min | Segurança |
| 3.3 | Implementar nexus hooks --install | src/commands/hooks.ts | 2 dias | automation +10 |
| 3.4 | Implementar nexus detect --approve/--reject | src/commands/detect.ts | 1 dia | automation +5 |
| 3.5 | Nexus bench --compare | src/commands/bench.ts | 1 dia | Observabilidade |
| 3.6 | Nexus feedback --list | src/commands/feedback.ts | 2h | DX |

### Fase 4: AI Agent Integration (5-7 dias) — P1 Items

> **Objectivo:** Implementar os 4 itens P1 de integração com agentes IA.

| # | Acção | Arquivos | Esforço | Impacto |
|---|-------|----------|---------|---------|
| 4.1 | OpenCode plugin (A2) | src/plugins/opencode/ | 3 dias | AI +10 |
| 4.2 | Cursor integration (A3) | src/plugins/cursor/ | 2 dias | AI +5 |
| 4.3 | Skill template (A7) | src/commands/skill-create.ts | 1 dia | DX |
| 4.4 | Webhook de sessão (A5) | src/commands/briefing.ts | 1 dia | Integração |

### Fase 5: Documentation & DX (3-5 dias)

> **Objectivo:** Completar docs pendentes e melhorar developer experience.

| # | Acção | Arquivos | Esforço | Impacto |
|---|-------|----------|---------|---------|
| 5.1 | Consolidar planos (2.13) | plans/ | 2h | Limpeza |
| 5.2 | JSDoc nas funções novas (2.12) | 8 arquivos | 1 dia | Docs |
| 5.3 | Nexus feedback --list (2.4) | feedback.ts | 2h | DX |
| 5.4 | Nexus bench --compare (2.3b) | bench.ts | 1 dia | DX |
| 5.5 | Interactive tutorial (D1) | src/commands/tutorial.ts | 2 dias | DX |
| 5.6 | Lazy loading (2.16) | context-collector.ts | 1 dia | Performance |

### Fase 6: Security Hardening (3-5 dias)

> **Objectivo:** Implementar segurança conforme items S1-S4 do backlog.

| # | Acção | Arquivos | Esforço | Impacto |
|---|-------|----------|---------|---------|
| 6.1 | Dependency auditing no CI | CI workflow | 30min | Segurança |
| 6.2 | Secret scanning (gitleaks) | CI workflow | 1h | Segurança |
| 6.3 | SBOM generation (syft) | CI workflow | 2h | Supply chain |
| 6.4 | Pen test audit interno | audit/ | 2 dias | Segurança |
| 6.5 | License conflict detection | audit/compliance-detectors.ts | 1 dia | Compliance |

---

## 4. Mapa de Prioridades

```
Fase 0 ──▶ Fase 1 ──▶ Fase 2 ──▶ Fase 3 ──▶ Fase 4 ──▶ Fase 5 ──▶ Fase 6
Quick      Quality    Arch       CI/CD      AI Agent   Docs/DX   Security
Wins       Push       Refactor   Automation Integration
(1-2d)     (3-5d)     (5-7d)     (3-5d)     (5-7d)     (3-5d)     (3-5d)
```

**Esforço total estimado:** 23-36 dias de trabalho

---

## 5. Progresso Esperado por Dimensão

| Dimensão | Antes | Depois Fase 1 | Depois Fase 3 | Depois Fase 6 |
|----------|-------|---------------|---------------|---------------|
| quality | 55 | 70 | 72 | 75 |
| automation | 30 | 32 | 50 | 55 |
| observability | 35 | 42 | 48 | 55 |
| architecture | 90 | 92 | 95 | 95 |
| overall | 73 | 80 | 85 | 88 |

---

## 6. Dependências entre Fases

- **Fase 0** → Independent (pode começar imediatamente)
- **Fase 1** → Depende de Fase 0 (clean state antes de adicionar testes)
- **Fase 2** → Depende de Fase 1 (refactor com cobertura de testes)
- **Fase 3** → Depende de Fase 1 (CI com testes a passar)
- **Fase 4** → Independent de Fases 2-3
- **Fase 5** → Independent de Fases 2-3
- **Fase 6** → Depende de Fase 3 (CI pipeline completa)

---

## 7. Itens NÃO Cobertos (Decisão Pendente)

Estes itens do BACKLOG requerem decisão do utilizador antes de implementar:

| # | Item | Razão da Pendência |
|---|------|---------------------|
| 1 | SA4/SA10/SA11 Clean Architecture | Refactoring massivo — impacta toda a base de código |
| 2 | D2 Example projects (Next.js, Express, lib) | Requer decisões sobre templates |
| 3 | DA1-4 Analytics/Error tracking | Requer decisão sobre infraestrutura |
| 4 | 2.15 Onboarding test (5 min) | Requer participação de utilizador real |
| 5 | 3.36 Decidir nome do produto | Decisão estratégica pendente |
| 6 | I1-I3 Internationalization | Requer framework i18n selection |

---

*Plano gerado automaticamente em 2026-07-09*
*BASE: BACKLOG.md + engineering-state.json + health-2026-07-09.json*
