# Primeiros Passos

> Guia rápido para começar a usar o Nexus em 5 minutos.

---

## Visão geral

O fluxo básico do Nexus é:

```
init → status → detect → briefing → trabalhar → feedback
```

Vamos passar por cada etapa.

---

## Passo 1: Inicializar o projeto

```bash
nexus init
```

O que acontece:

1. **Análise do projeto** — Nexus detecta stack, packages, estrutura
2. **Questionário de maturidade** — Perguntas sobre práticas de engenharia
3. **Cálculo do perfil** — Score de 0-100 em 7 dimensões
4. **Instalação de capabilities** — Módulos recomendados para seu projeto
5. **Criação de estrutura** — Pasta `nexus-system/` com arquivos de governança

Saída esperada:

```
🔍 Analisando projeto...
  Stack: typescript
  Packages: 3
  Source files: 47

📊 Perfil de Maturidade
  Arquitetura:  ████████░░ 80%
  Governança:   ██████░░░░ 60%
  Qualidade:    ███████░░░ 70%
  Automação:    ████░░░░░░ 40%
  AI:           ██░░░░░░░░ 20%
  Documentação: █████░░░░░ 50%
  Observabilidade: ███░░░░░░░ 30%

  Overall: 50/100

✅ Nexus inicializado com sucesso!
```

---

## Passo 2: Verificar saúde do projeto

```bash
nexus status
```

Mostra:

- **Governance Health** — Status dos arquivos de governança
- **Maturity Profile** — Score atual e dimensões
- **Complexity Analysis** — Métricas de complexidade do projeto
- **Capability Engine** — Capabilities instaladas e recomendadas

Saída esperada:

```
📋 Governance Health
  opencode.json        ✅
  AGENTS.md            ✅ (22 regras)
  skills/              ✅ (5 arquivos)
  governance/          ✅
  context_buffer.yaml  ⚠️  Seção current_task vazia
  scripts/             ✅ (3 scripts)
  agent contracts      ✅ (4 contratos)

📊 Maturity: 50/100
🔧 Capabilities: 5 instaladas, 3 recomendadas
```

---

## Passo 3: Detectar padrões

```bash
nexus detect
```

Analisa o histórico do projeto e encontra:

- **Padrões recorrentes** — Erros que se repetem
- **Decisões revertidas** — Mudanças que foram desfeitas
- **Áreas quentes** — Arquivos que mudam frequentemente

Saída esperada:

```
🔍 Análise de Padrões

  Histórico analisado: 156 entradas
  Relatórios analisados: 12

  Padrões Detectados:
    🔴 recurring_error — Erro de tipo em auth.ts (severidade: 4)
    🟡 hot_area — src/api/ muda 3x por semana (severidade: 2)

  Regras Candidatas:
    RC-001: Evitar tipagem implícita em módulos de autenticação
    RC-002: Criar testes automatizados para src/api/
```

---

## Passo 4: Gerar briefing (para AI)

```bash
nexus briefing
```

Gera um briefing pré-sessão para agentes AI:

```
📋 Briefing — 2026-07-11

Identidade do Projeto
  Domínio: monorepo
  Escala: medium
  Stack: react
  Maturidade: 73/100

Status de Risco
  Geral: critical
  Áreas críticas: src, apps

Cobertura de Testes
  Áreas sem testes: 5

Recomendações
  1. Endereçar áreas críticas: src, apps
  2. Melhorar cobertura de testes em 5 áreas
```

---

## Passo 5: Trabalhar no projeto

Agora trabalhe normalmente. O Nexus observa em segundo plano:

- **File watcher** — Detecta mudanças em arquivos
- **Rule engine** — Reage a eventos (ex: novo arquivo de plano)
- **Session tracker** — Registra início e fim de sessões

---

## Passo 6: Fechar o feedback

Ao terminar uma sessão de trabalho:

```bash
# Se deu tudo certo
nexus feedback --outcome success

# Se teve problemas
nexus feedback --outcome failure --notes "erro de tipagem em auth.ts"

# Se ficou parcial
nexus feedback --outcome partial --areas "auth,dashboard"
```

Isso alimenta o **Context Pipeline** e melhora recomendações futuras.

---

## Fluxo diário recomendado

```bash
# Início do dia
nexus briefing          # Ver contexto do projeto
nexus status            # Ver saúde

# Durante o trabalho
nexus detect            # Ver padrões (opcional)

# Fim do dia
nexus feedback --outcome success  # Fechar sessão
```

---

## Comandos úteis para memorizar

| Comando | O que faz | Quando usar |
|---|---|---|
| `nexus init` | Inicializa governança | Primeira vez no projeto |
| `nexus status` | Mostra saúde do projeto | Diariamente |
| `nexus detect` | Detecta padrões | Semanalmente |
| `nexus briefing` | Gera briefing para AI | Início de sessão AI |
| `nexus feedback` | Fecha loop de feedback | Fim de sessão |
| `nexus audit` | Auditoria completa | Mensalmente |
| `nexus doctor` | Diagnóstico de riscos | Quando há dúvidas |

---

## Próximo passo

→ [Conceitos](concepts.md) — Entenda maturidade, capabilities e governance
