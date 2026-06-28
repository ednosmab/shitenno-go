# Nexus System

> Um sistema que pensa sobre como você trabalha.

Nexus detecta **Knowledge Debt** — o custo invisível do conhecimento de engenharia ausente, desconectado e desatualizado — e recomenda ações para fechar esse gap.

Não é um linter. Não é CI. Não é um framework.
É um sistema de governança de conhecimento que audita a si mesmo, aprende com seu feedback e recomenda a própria evolução.

---

## O que Nexus resolve

| Sem Nexus | Com Nexus |
|-----------|-----------|
| Conhecimento documentado mas desconectado | Conhecimento grafado com relações explícitas |
| Complexidade sentida mas não medida | Complexidade pontuada com métricas estáticas + comportamentais |
| Padrões notados mas não rastreados | Padrões detectados do histórico automaticamente |
| Governança manual e inconsistente | Governança automatizada via regras |
| Agentes IA operam sem contexto | Agentes IA recebem contexto governado e hierárquico |
| Evolução ad-hoc | Evolução recomendada com base no estado |

---

## Como operar

### Inicializar

```bash
nexus init
```

Cria a estrutura de governança: `opencode.json`, `nexus-system/`, `nexus-profile/`, skills, scripts, templates.

### Verificar estado

```bash
nexus status
```

Mostra score de complexidade, saúde da governança, e sugestões acionáveis.

### Detectar padrões

```bash
nexus detect
```

Lê histórico e relatórios para identificar erros recorrentes, decisões revertidas, e áreas quentes.

### Auditar governança (metacognição)

```bash
nexus audit
```

O sistema avaliando a própria eficácia: regras mortas, hotspots de violação, docs ausentes, diretórios órfãos.

### Evoluir

```bash
nexus evolve
```

Recomendações adaptativas baseadas no perfil de maturidade do time. Cada recomendação tem dois caminhos: conforto e desafio.

### Pipeline completo

```bash
nexus run
```

Executa o pipeline de 8 estágios: Análise → Complexidade → Padrões → Knowledge Debt → Capability Engine → Engineering State → Recommendation Engine → Evolução.

### Outros comandos

| Comando | Função |
|---------|--------|
| `nexus upgrade` | Instalar capacidades de governança (5 níveis de maturidade) |
| `nexus validate` | Validar integridade da sessão |
| `nexus sync` | Sincronizar governança de um nexus externo |
| `nexus clean` | Limpar cache e temporários |
| `nexus assess` | Reavaliar perfil de maturidade |
| `nexus doctor` | Diagnósticos de saúde do sistema |

---

## Como funciona por dentro

```
Seu projeto
    │
    ▼
┌─────────────┐    ┌──────────────┐    ┌───────────────┐
│  Análise    │───▶│  Padrões     │───▶│ Knowledge     │
│  (complexi- │    │  (histórico) │    │ Debt          │
│   dade)     │    │              │    │               │
└─────────────┘    └──────────────┘    └───────────────┘
       │                  │                    │
       ▼                  ▼                    ▼
┌─────────────────────────────────────────────────────┐
│              Capability Engine                       │
│  9 capacidades × 5 níveis de maturidade              │
│  dormant → installed → configured → active → optimized│
└─────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────┐
│              Engineering State                       │
│  Fonte única de verdade: assets, entropia, saúde    │
└─────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────┐
│              Recommendation Engine                   │
│  Próxima melhor ação com confiança e justificativa  │
└─────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────┐    ┌──────────────┐
│ Auto-Evolução│───▶│  Dual-Path   │
│ (recomenda   │    │ (conforto vs │
│  a própria   │    │  desafio)    │
│  evolução)   │    │              │
└──────────────┘    └──────────────┘
```

**Mecanismos:**
- **State Machine** — governa o próprio ciclo de vida (uninitialized → discovered → assessed → governed → evolved)
- **Event Bus** — 20 tipos de eventos para comunicação entre módulos
- **Feedback Loops** — aprende com aceitação/rejeição das recomendações
- **Rule Engine** — comportamentos declarativos: novas regras sem alterar código (17 tipos de ação)
- **Plugins** — extensível via `nexus-plugins/`
- **Engineering State** — fonte única de verdade com métricas de entropia organizacional
- **Capability Engine** — avalia 9 capacidades com indicadores de maturidade
- **Recommendation Engine** — gera próxima melhor ação com score de confiança

---

## Segurança

- **Cache restrito** — `.nexus-cache.json` criado com `chmod 0o600`
- **YAML sanitizado** — inputs escapados contra injeção no rule engine
- **Sem process.exit()** — erros tratados via Commander, nunca via exit direto
- **Allowlist de scripts** — apenas scripts aprovados podem ser executados
- **Validação de regras** — schema validado antes de persistir

---

## Requisitos

- Node.js ≥ 18.0.0
- Git (recomendado, para métricas comportamentais)

## Instalação

```bash
npm install -g nexus-system
```

Ou diretamente:

```bash
npx nexus-system status
```

## Desenvolvimento

```bash
npm install
npm run dev status     # modo desenvolvimento
npm run build          # build com tsup
npm test               # 410 testes (28 arquivos)
npm run typecheck      # verificação de tipos
npm run lint           # ESLint com regras TypeScript
npm run bench          # benchmarks
```

## CI/CD

GitHub Actions configurações em `.github/workflows/`:
- **ci.yml** — typecheck + build + test em Node 18/20/22
- **release.yml** — npm publish + GitHub Release em git tags

## Licença

MIT
