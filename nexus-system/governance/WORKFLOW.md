# WORKFLOW — Fluxo de Sessão

> **Versão:** 1.0
> **Data:** 2026-07-01
> **Autoridade:** Tech Lead Humano
> **Aplicável a:** Todos os agentes IA

---

## Princípio Fundamental

> **Toda sessão começa com leitura e termina com validação. Nenhuma escrita sem contexto.**

---

## 1. Entrada Obrigatória

Ao receber qualquer tarefa, o agente DEVE executar os 4 passos na ordem exacta:

```
PASSO 1: DIAGNÓSTICO E LEITURA PREGUIÇOSA
  │  → Ler este ficheiro (WORKFLOW.md) — SEMPRE PRIMEIRO
  │  → Ler governance/context/context_buffer.yaml
  │  → Ler docs/AGENTS.md (P0)
  │  → Ler docs/FORBIDDEN_OPERATIONS.md (P0)
  │  → Ler docs/DESDO.md (P0)
  │  → Identificar tipo: FEATURE | BUG | REFACTOR | DOCUMENTATION | PLANNING
  ▼
PASSO 2: ACTUALIZAÇÃO DA MEMÓRIA RAM
  │  → Actualizar context_buffer.yaml
  │  → Registar tarefa em execução
  │  → Registar documentos carregados
  ▼
PASSO 3: EXECUÇÃO CIRÚRGICA
  │  → Escrever código apenas na pasta permitida
  │  → Se erro → parar, documentar no buffer, corrigir
  ▼
PASSO 4: CONSOLIDAÇÃO E PURGA
     → Marcar [x] no plano
     → Limpar impedimentos do buffer
     → Executar validate-session
     → Executar close-session (quando autorizado)
```

---

## 2. Tipos de Operação

### 2.1 FEATURE (Nova Funcionalidade)

1. Determinar tipo via WORKFLOW.md
2. Ler context_buffer.yaml → estado actual
3. Executar premortem-check → o que pode quebrar?
4. Criar plano em `governance/plans/`
5. Actualizar buffer com tarefa em execução
6. Implementar código cirurgicamente
7. Executar testes e lint
8. Executar `pnpm run validate:session`
9. Aguardar autorização para commit
10. Executar `pnpm run close:session`

### 2.2 BUG (Correcção)

1. Identificar como BUG via WORKFLOW.md
2. Ler context_buffer.yaml → estado actual
3. Reproduzir erro / identificar causa raiz
4. Documentar erro no buffer (seção `Impedimentos`)
5. Corrigir código cirurgicamente
6. Executar testes
7. Actualizar buffer e encerrar

### 2.3 REFACTOR (Reestruturação)

1. Identificar como REFACTOR via WORKFLOW.md
2. Ler ADRs relacionadas
3. Executar premortem-check → verificar impacto
4. Executar refactoração conforme plano
5. Executar testes e lint
6. Validar e encerrar

### 2.4 DOCUMENTATION (Documentação)

1. Identificar como DOCUMENTATION via WORKFLOW.md
2. Ler documentos afectados
3. Escrever/actualizar documentação
4. Verificar referências cruzadas
5. Validar e encerrar

### 2.5 PLANNING (Planeamento)

1. Identificar como PLANNING via WORKFLOW.md
2. Ler contexto completo (P0 + P1)
3. Gerar plano atómico em `governance/plans/`
4. Apresentar ao utilizador para aprovação
5. Aguardar autorização antes de executar

### 2.6 Formato de Planos Markdown

**Regra:** Planos ativos NÃO devem conter checkboxes (`- [ ]` ou `- [x]`). O rastreamento de progresso é feito exclusivamente pelo campo `**Status:**` no frontmatter.

**Status válidos:** `andamento`, `parado`, `done`

**Fluxo:**
1. Criar plano com `**Status:** andamento`
2. Atualizar `**Status:**` conforme progresso
3. Ao concluir: `**Status:** done` + mover para `done/`

**Exemplo:**
```markdown
**Status:** andamento
...
### Step 1: Nome
- **Ficheiro:** path
- **Acção:** descrição
- **Verificação:** comando
```

---

## 3. Hierarquia de Leitura

```
[Nível 0: P0] governance/WORKFLOW.md           ← SEMPRE PRIMEIRO
       │
       ▼
[Nível 1: P0] docs/AGENTS.md                  ← Regras Globais
[Nível 1: P0] docs/FORBIDDEN_OPERATIONS.md    ← Regras Vinculantes
[Nível 1: P0] docs/DESDO.md                   ← Diretrizes
       │
       ▼
[Nível 2: P1] governance/context/
             context_buffer.yaml               ← Estado Actual
       │
       ▼
[Nível 3: P2] Código e configuração           ← Escrita Cirúrgica
       │
       ▼
[Nível 4: P3] docs/skills/                    ← Competências operacionais
       │
       ▼
[Nível 5: P4] docs/history/                   ← Auditoria (Sob Demanda)
```

**Regra:** O agente nunca decide o que ler. A hierarquia P0→P4 determina a ordem.

---

## 4. Scripts de Validação

| Script | Comando | Quando Usar |
|---|---|---|
| **validate-session** | `pnpm run validate:session` | Antes de encerrar sessão |
| **close-session** | `pnpm run close:session` | No encerramento (após autorização) |
| **premortem-check** | `pnpm run premortem:check` | Antes de features complexas |

### 4.1 validate-session

Verifica integridade da sessão:
- Tarefa activa no buffer
- ADRs criados quando necessário
- Config opencode.json consistente
- Contratos de agentes presentes
- Buffer com secções obrigatórias

### 4.2 close-session

Checklist de encerramento:
- Working tree limpo (sem alterações por commitar)
- Testes executados
- Buffer actualizado
- Backlog actualizado
- Último commit registado
- Build verificado

### 4.3 premortem-check

Análise de riscos prévia:
- Identificar áreas sensíveis afectadas
- Verificar dependências circulares
- Validar conformidade com FORBIDDEN_OPERATIONS

---

## 5. Regras de Transição

### 5.1 Feature → Develop

1. Working tree limpo
2. Testes verdes
3. `pnpm run validate:session` passa
4. Autorização explícita do utilizador
5. `git commit` com mensagem Conventional Commits
6. `pnpm run close:session`

### 5.2 Bug → Hotfix

1. Causa raiz identificada
2. Correcção implementada
3. Testes verdes
4. Autorização explícita do utilizador
5. `git commit` com mensagem Conventional Commits

### 5.3 Refactor → Branch dedicada

1. ADR criada (se decisão arquitectural)
2. Plano aprovado
3. Testes verdes após refactor
4. Autorização explícita do utilizador
5. `git commit` com mensagem Conventional Commits

---

## 6. Pontos de Pausa (Gates)

### G-01: Commit Authorization

**Antes de QUALQUER `git commit`:**
- Parar execução
- Solicitar autorização explícita do utilizador
- Aguardar confirmação
- Só então executar commit

**Excepção:** Nenhuma. Esta regra é absoluta.

### G-02: Scope Creep

**Se o agente detectar necessidade de alteração fora do escopo:**
- Parar execução
- Documentar no buffer (seção `technical_debt`)
- Solicitar autorização para expandir escopo
- Aguardar aprovação antes de avançar

---

## 7. Formato do Context Buffer

O `governance/context/context_buffer.yaml` DEVE conter:

```yaml
session:
  id: "<session-id>"
  started_at: "<ISO-date>"
  status: "in_progress" | "completed"

current_task:
  id: "<task-id>"
  description: "<brief-description>"
  status: "in_progress"
  started_at: "<ISO-date>"

documents_loaded:
  - path: "<document-path>"
    loaded_at: "<ISO-date>"

impediments: []
  # - description: "<impediment>"
  #   detected_at: "<ISO-date>"
  #   status: "open" | "resolved"

technical_debt: []
  # - description: "<debt>"
  #   file: "<path>"
  #   priority: "P1" | "P2"

model_assignments: {}
  # planner: "<model-name>"
  # executor: "<model-name>"
  # reviewer: "<model-name>"
```

---

## 8. Referências

- `docs/AGENTS.md` — Regras do time (P0)
- `docs/FORBIDDEN_OPERATIONS.md` — Regras vinculantes (P0)
- `docs/DESDO.md` — Diretrizes de engenharia (P0)
- `governance/SYSTEM_MAP.md` — Mapa centralizado
- `governance/context/context_buffer.yaml` — Estado activo (RAM)
- `docs/Nexus-System_GUIDE.md` — Guia completo do sistema
