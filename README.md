# Nexus System

> Framework de governança de IA que cresce com seu projeto — scoring, detecção de padrões, auditoria de saúde.

Uma ferramenta CLI que analisa a complexidade do seu projeto, detecta padrões no histórico de engenharia e audita a saúde da governança. Ela se adapta ao nível do seu time (Junior / Pleno / Senior) e fornece sugestões acionáveis.

---

## Features

| Comando | Descrição | Status |
|---------|-----------|--------|
| `nexus init` | Inicializa o framework de governança no seu projeto | Estável |
| `nexus status` | Verifica saúde da governança + scoring de complexidade | Estável |
| `nexus detect` | Detecta padrões no histórico e propõe regras candidatas | Estável |
| `nexus audit` | Auditoria metacognitiva da saúde do Nexus | Estável |
| `nexus upgrade` | Atualiza nível de governança (L1 → L2 → L3) | Estável |
| `nexus validate` | Valida integridade da sessão | Estável |
| `nexus sync` | Sincroniza arquivos de governança externos | Estável |
| `nexus clean` | Limpa cache e arquivos temporários | Estável |
| `nexus assess` | Reavalia perfil de maturidade | Estável |
| `nexus doctor` | Diagnósticos e verificações de saúde | Estável |
| `nexus run` | Executa uma tarefa/script específica | Estável |
| `nexus evolve` | Sugere passos de evolução baseados na maturidade | Estável |

---

## Instalação

```bash
npm install -g nexus-system
```

Ou execute diretamente com npx:

```bash
npx nexus-system status
```

### Requisitos

- Node.js ≥ 18.0.0
- Git (recomendado, para métricas comportamentais)

---

## Início Rápido

```bash
# 1. Inicializar no seu projeto
nexus init

# 2. Verificar saúde da governança
nexus status

# 3. Detectar padrões
nexus detect

# 4. Auditar saúde da governança
nexus audit
```

---

## Comandos

### `nexus init`

Scaffolding completo do framework de governança.

```bash
nexus init              # setup interativo
nexus init -d /path     # especificar diretório alvo
nexus init --force      # forçar criação dentro do nexus-cli
```

**O que cria:**
- `opencode.json` — configuração de agentes IA (raiz do projeto)
- `nexus-system/` — diretório do framework de governança
- `nexus-profile/` — perfil do projeto com definições de áreas
- Skills, scripts, docs e templates de governança baseados no nível do time

### `nexus status`

Analisa complexidade do projeto e saúde da governança.

```bash
nexus status              # auto-detectar projeto
nexus status -d /path     # especificar diretório
nexus status --no-cache   # pular cache, recalcular
nexus status --json       # saída em formato JSON
```

**Saídas:**
- Verificações de saúde da governança (opencode.json, AGENTS.md, skills, scripts, etc.)
- Score de complexidade com métricas estáticas + comportamentais
- Detalhamento por área (contagem de arquivos, churn, superfície sensível, violações, dependências)
- Sugestões acionáveis

### `nexus detect`

Lê histórico e relatórios para detectar padrões recorrentes.

```bash
nexus detect              # auto-detectar projeto
nexus detect -d /path     # especificar diretório
nexus detect --json       # saída em formato JSON
```

**Detecta:**
- Erros recorrentes (mesma área, 3+ ocorrências)
- Decisões revertidas (padrões de rollback)
- Áreas quentes (scores consistentemente altos)

### `nexus audit`

Auditoria metacognitiva — o sistema avaliando sua própria eficácia de governança.

```bash
nexus audit              # auto-detectar projeto
nexus audit -d /path     # especificar diretório
nexus audit --json       # saída em formato JSON
```

**Audita:**
- Regras mortas (nunca mencionadas no histórico)
- Pontos de violação (alta taxa de erros)
- Documentação ausente (arquivos críticos faltando)
- Diretórios órfãos (estrutura vazia)
- Context buffer desatualizado

### `nexus upgrade`

Adicione mais capacidades de governança conforme seu projeto cresce.

```bash
nexus upgrade                    # seleção interativa de nível
nexus upgrade --capability cap   # instalar capacidade específica
nexus upgrade --accept-recommended # instalar todas as recomendadas
nexus upgrade --list             # mostrar upgrades disponíveis
```

**Níveis:**
- **L1 (Junior):** Docs + Skills + Scripts
- **L2 (Pleno):** + Governança + Context Buffer
- **L3 (Senior):** + Cognição + Contratos + Relatórios + ADRs

### `nexus validate`

Valida integridade da sessão antes de fechar.

```bash
nexus validate              # executar todas as verificações
nexus validate --fix        # tentar reparos automáticos
nexus validate --json       # saída em formato JSON
```

### `nexus sync`

Sincroniza arquivos de governança de um nexus-system externo.

```bash
nexus sync --nexus-path /path/to/nexus-system
nexus sync --dry-run        # visualizar mudanças sem aplicar
nexus sync --force          # sobrescrever sem confirmação
```

### `nexus clean`

Limpa cache e arquivos temporários.

```bash
nexus clean                # limpar cache
nexus clean --all          # limpar cache + relatórios
```

### `nexus assess`

Reavalia o perfil de maturidade do projeto.

```bash
nexus assess               # reavaliar maturidade
nexus assess -d /path      # especificar diretório
```

### `nexus doctor`

Executa diagnósticos de saúde do sistema.

```bash
nexus doctor               # executar diagnósticos
nexus doctor --json        # saída em formato JSON
```

### `nexus run`

Executa uma tarefa ou script específico.

```bash
nexus run <task>           # executar tarefa
```

### `nexus evolve`

Sugere passos de evolução baseados no perfil de maturidade atual.

```bash
nexus evolve               # sugestões interativas
nexus evolve --json        # saída em formato JSON
```

---

## Arquitetura

```
nexus-cli/
├── bin/nexus.ts              # Ponto de entrada CLI (Commander.js)
├── src/
│   ├── analyser.ts           # Análise de projeto & detecção de stack
│   ├── scorer.ts             # Engine de scoring de complexidade
│   ├── pattern-detector.ts   # Extração de padrões
│   ├── health-auditor.ts     # Auditoria de saúde da governança
│   ├── rule-engine.ts        # Engine de regras declarativas
│   ├── plugin-system.ts      # Sistema de extensibilidade
│   ├── event-bus.ts          # Sistema pub/sub
│   ├── cache.ts              # Cache em disco com checksums SHA256
│   ├── scaffolder.ts         # Scaffolding de projetos
│   ├── prompts.ts            # Prompts interativos (inquirer)
│   ├── logger.ts             # Logging centralizado
│   ├── constants.ts          # Constantes compartilhadas
│   ├── errors.ts             # Erros tipados
│   ├── utils.ts              # Utilitários compartilhados
│   ├── shared.ts             # Infraestrutura compartilhada CLI
│   ├── commands/             # Implementações dos comandos CLI
│   ├── templates/            # Template files para scaffolding
│   └── __tests__/            # Testes unitários + integração
├── docs/architecture/        # Documentação de arquitetura
└── nexus-plugins/            # Plugins de extensibilidade
```

### Performance

O engine de scoring utiliza várias otimizações:

- **Batch git log** — Chamada única `git log` para todas as áreas (vs N chamadas separadas)
- **Scoring paralelo por área** — `Promise.all` com interleaving no event loop
- **Cache compartilhado de arquivos** — `FileContentCache` evita leituras repetidas
- **Pré-leitura do histórico** — Passada única sobre o histórico para todas as áreas

### Cache

Resultados são cacheados em `.nexus-cache.json` na raiz do projeto. O cache é invalidado quando:
- `git HEAD` muda (qualquer commit)
- `package.json` é modificado
- `opencode.json` é modificado
- `nexus-profile/` ou `nexus-system/` mudam

Cache hit: **<1ms** vs 15-106ms sem cache.

---

## Configuração

### `opencode.json` (Raiz do Projeto)

```json
{
  "model": "mimo-v2.5-free",
  "agent": {
    "plan": { "role": "planner", "model": "mimo-v2.5-free" },
    "build": { "role": "executor", "model": "deepseek-v4-flash-free" },
    "review": { "role": "auditor", "model": "mimo-v2.5-free" }
  }
}
```

### `nexus-profile/` (Perfil do Projeto)

Gerado automaticamente durante `nexus init`. Define:
- Nome do projeto
- Áreas de código fonte para monitorar
- Palavras-chave sensíveis
- Janela de churn (dias)
- Pesos de scoring

---

## Desenvolvimento

```bash
# Instalar dependências
npm install

# Modo desenvolvimento
npm run dev status

# Build
npm run build

# Testes
npm test

# Type check
npm run typecheck

# Lint
npm run lint

# Benchmarks
npm run bench
```

---

## Testes

- **278+ testes** em 18 arquivos de teste
- **Testes de integração CLI** (end-to-end)
- **Benchmarks de performance** para engines de scoring, detecção e auditoria

```bash
npm test              # executar todos
npm run test:watch    # modo watch
npm run bench         # executar benchmarks
```

---

## Segurança

O Nexus System implementa as seguintes medidas de segurança:

- **Allowlist de scripts** — Apenas comandos pré-aprovados podem ser executados via regras
- **Validação de IDs** — Rule IDs são restritos a caracteres alfanuméricos, hífens e underscores
- **Sanitização de regex** — Padrões são validados contra complexidade excessiva
- **Proteção contra prototype pollution** — Acesso a `__proto__`, `constructor` é bloqueado
- **Validação de plugins** — Hooks e nomes são validados antes do registro
- **Cache atômico** — Escrita via temp file + rename previne corrupção

---

## Licença

MIT
