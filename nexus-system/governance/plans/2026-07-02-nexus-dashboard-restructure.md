# Nexus Dashboard — Plano de Refactoracao por Camadas de Conhecimento

> **Data:** 2026-07-02
> **Estado:** AGUARDA APROVACAO
> **Escopo:** Refactoracao completa do Dashboard para 6 camadas progressivas de conhecimento

---

## 1. Contexto

O Dashboard actual e um painel de dados plano com 11 secções independentes. O utilizador pediu uma reestruturação para seguir um modelo de **6 camadas progressivas de conhecimento**, onde cada camada prepara o entendimento da próxima. O objectivo nao e mostrar dados, mas **construir entendimento**.

### Narrativa do Utilizador

> "O Dashboard nao deve apresentar informacao. Ele deve construir entendimento.
> Apresentar informacao significa listar dados.
> Construir entendimento significa organizar esses dados de maneira que o usuario consiga formar um modelo mental consistente do sistema."

### Principio Fundamental

> "Toda funcionalidade implementada no Dashboard devera responder: 'Como esta funcionalidade ajuda alguem a compreender melhor o Nexus System?'"

---

## 2. Estrutura Actual (11 secções planas)

```
Dashboard - Architecture - Knowledge - Capabilities - Engineering State -
Goals - Policies - Events - Documentation - Observability - Settings
```

**Problema:** Sem hierarquia. O utilizador nao sabe por onde comecar. Todos os conceitos aparecem no mesmo nivel.

---

## 3. Nova Estrutura (6 Camadas Progressivas)

```
Camada 1 — DESCUBRA     → O que e? Por que? Qual problema? Para quem?
Camada 2 — UTILIZE      → Instalacao, comandos, fluxos, boas praticas
Camada 3 — ENTENDA      → Conceitos: ESM, State, Capabilities, Governanca...
Camada 4 — ARQUITETURA  → Componentes, dependencias, fluxos, dominio
Camada 5 — ENGENHARIA   → Codigo, modulos, contratos, ADRs
Camada 6 — REFERENCIA   → API, tipos, esquemas, configuracoes
```

### Fluxo de Navegacao

```
Usuario abre Dashboard
  → Camada 1: "O que e o Nexus?" (contexto imediato)
    → Clica "Quero usar" → Camada 2: Comandos essenciais
      → Clica "Como funciona?" → Camada 3: Conceitos
        → Clica "Arquitetura" → Camada 4: Componentes
          → Clica "Codigo" → Camada 5: Engenharia
            → Clica "API" → Camada 6: Referencia
```

---

## 4. Detalhe por Camada

### Camada 1 — DESCUBRA (`/discover`)

**Perguntas que responde:** O que e o Nexus? Por que foi criado? Qual problema resolve? Quem deve utiliza-lo? Quais beneficios? Como comecar?

| Rota | Pagina | Conteudo |
|---|---|---|
| `/discover` | WhatIsNexus | Definicao, missao, identidade |
| `/discover/why` | WhyNexus | Problema que resolve, motivacao |
| `/discover/who` | WhoIsItFor | Perfis: developer, arquitecto, tech lead |
| `/discover/start` | GettingStarted | Primeiros passos, link para Camada 2 |

**Elementos visuais:**
- Hero com logo "N" + definicao em 1 frase
- 3 cards: Problema - Solucao - Beneficio
- CTA "Comece por aqui" → Camada 2

---

### Camada 2 — UTILIZE (`/use`)

**Perguntas que responde:** Como instalo? Como começo? Quais comandos existem? Quais boas praticas?

| Rota | Pagina | Conteudo |
|---|---|---|
| `/use` | Installation | `pnpm add -g nexus-system`, requisitos |
| `/use/first-steps` | FirstSteps | `nexus init`, primeiro projecto |
| `/use/commands` | Commands | 4 comandos essenciais: init, status, upgrade, validate |
| `/use/best-practices` | BestPractices | Convenções, dicas |

**Comandos documentados (apenas essenciais):**

| Comando | Proposito | Quando usar |
|---|---|---|
| `nexus init` | Instala framework no projecto | Sempre no inicio |
| `nexus status` | Verifica saude da governanca | Durante o desenvolvimento |
| `nexus upgrade` | Adiciona capacidades | Quando precisa de mais funcionalidades |
| `nexus validate` | Valida conformidade | Antes de commits importantes |

**Cada comando inclui:**
- Proposito
- Quando utilizar
- Parametros
- Exemplo pratico
- Relacao com outras funcionalidades

---

### Camada 3 — ENTENDA (`/concepts`)

**Perguntas que responde:** O que e Engineering State? O que e ESM? Como funcionam as Capabilities? Como e a governanca?

| Rota | Pagina | Conteudo |
|---|---|---|
| `/concepts` | EngineeringState | Estado explicito vs memoria |
| `/concepts/esm` | ESM | 7 Leis + 6 Principios + Ciclo |
| `/concepts/capabilities` | Capabilities | 9 capacidades, lifecycle |
| `/concepts/governance` | Governance | FORBIDDEN_OPERATIONS, workflow |
| `/concepts/architecture` | ArchitectureConcept | Visao geral arquitectonica |
| `/concepts/events` | Events | Event bus, types, fluxo |
| `/concepts/policies` | Policies | 12 regras vinculantes |
| `/concepts/knowledge` | Knowledge | Knowledge graph, lifecycle |
| `/concepts/evolution` | Evolution | Como o sistema evolui |

**Cada conceito inclui:**
- Por que existe
- Qual problema resolve
- Como participa do sistema
- Quais componentes dependem dele
- Links cruzados para conceitos relacionados

---

### Camada 4 — ARQUITETURA (`/architecture`)

**Perguntas que responde:** Quais componentes existem? Quais responsabilidades? Como dependem entre si? Como fluem os dados?

| Rota | Pagina | Conteudo |
|---|---|---|
| `/architecture` | Components | Grafo de componentes visual |
| `/architecture/responsibilities` | Responsibilities | Quem faz o que |
| `/architecture/dependencies` | Dependencies | Mapa de dependencias |
| `/architecture/flows` | Flows | Fluxos principais (init, upgrade, validate) |
| `/architecture/domain` | DomainModel | Modelo de dominio (8 conceitos) |
| `/architecture/structure` | SystemStructure | Arvore de directorios |

**Elementos visuais:**
- Diagrama de componentes (SVG interactivo)
- Grafo de dependencias
- Fluxos animados

---

### Camada 5 — ENGENHARIA (`/engineering`)

**Perguntas que responde:** Como e o codigo organizado? Quais modulos existem? Quais contratos? Quais decisoes foram tomadas?

| Rota | Pagina | Conteudo |
|---|---|---|
| `/engineering` | SourceCode | Estrutura de pastas, entry points |
| `/engineering/modules` | Modules | Organizacao de modulos |
| `/engineering/contracts` | Contracts | 4 agent contracts |
| `/engineering/interfaces` | Interfaces | Tipos e interfaces principais |
| `/engineering/adrs` | ADRs | Architecture Decision Records |
| `/engineering/governance` | TechnicalGovernance | Regras tecnicas |
| `/engineering/state` | EngineeringStateDetail | Estado actual detalhado |

---

### Camada 6 — REFERENCIA (`/reference`)

**Perguntas que responde:** Qual a API? Quais tipos? Quais esquemas? Quais configs?

| Rota | Pagina | Conteudo |
|---|---|---|
| `/reference` | API | Comandos CLI detalhados |
| `/reference/contracts` | ContractsRef | Schema dos agent contracts |
| `/reference/events` | EventsRef | Schema dos eventos |
| `/reference/types` | Types | Interfaces TypeScript |
| `/reference/config` | Configuration | opencode.json, nexus-profile |
| `/reference/schemas` | Schemas | JSON schemas |

---

## 5. Componentes a Criar

### 5.1 Logo (`components/shared/Logo.tsx`)

**Estilo:** Inspirado no terminal da imagem de referencia.

```
Quadrado 32x32px arredondado (border-radius: 8px)
Fundo: gradient linear de #00e5ff → #6c5ce7
Letra: "N" branca, bold, 16px
Usado em: Header, Sidebar, favicon
```

**Variacoes:**
- `size="sm"` — 24x24 (mobile, favicon)
- `size="md"` — 32x32 (sidebar, header)
- `size="lg"` — 48x48 (home hero)

### 5.2 Sidebar (`components/layout/Sidebar.tsx`)

**Estrutura:**
```
┌─────────────────────────┐
│  [N] Nexus Dashboard    │  ← Logo + titulo
├─────────────────────────┤
│  ◈ DESCUBRA        [▸]  │  ← Camada 1 (expansivel)
│  ◎ UTILIZE          [▸]  │  ← Camada 2 (expansivel)
│  ◆ ENTENDA          [▸]  │  ← Camada 3 (expansivel)
│  ⬡ ARQUITETURA      [▸]  │  ← Camada 4 (expansivel)
│  ▣ ENGENHARIA       [▸]  │  ← Camada 5 (expansivel)
│  ⊞ REFERENCIA       [▸]  │  ← Camada 6 (expansivel)
├─────────────────────────┤
│  ● System operational   │  ← Status
└─────────────────────────┘
```

**Comportamento:**
- Cada camada expande/collapse ao clicar
- Sub-itens indentados
- Apenas 1 camada expandida por vez
- Em mobile: overlay com backdrop blur

### 5.3 Header (`components/layout/Header.tsx`)

**Estrutura:**
```
┌──────────────────────────────────────────────────┐
│  [☰]  [N]  Camada > Sub-pagina         [● Live] │
└──────────────────────────────────────────────────┘
```

**Breadcrumb hierarquico:**
- `Descubra > O que e o Nexus`
- `Utilize > Comandos > nexus init`
- `Entenda > Engineering State`

### 5.4 BottomNav (`components/layout/BottomNav.tsx`)

**Estrutura mobile:**
```
┌──────────────────────────────────┐
│  ◈      ◎      ◆      ⬡      ▣  │
│ Desc  Util  Enten  Arq   Eng   │
└──────────────────────────────────┘
```

5 icones (Camadas 1-5). Camada 6 acessivel via menu.

### 5.5 CrossLinks (`components/shared/CrossLinks.tsx`)

**Componente que mostra links cruzados entre camadas:**
```
┌─────────────────────────────────────┐
│  Conceitos relacionados:            │
│  → Engineering State (Camada 3)     │
│  → ESM (Camada 3)                   │
│  → Componentes (Camada 4)           │
└─────────────────────────────────────┘
```

---

## 6. Ficheiros a Criar

### 6.1 Camada 1 — Descoberta (4 ficheiros)

```
src/pages/discover/
├── WhatIsNexus.tsx
├── WhyNexus.tsx
├── WhoIsItFor.tsx
└── GettingStarted.tsx
```

### 6.2 Camada 2 — Utilizacao (4 ficheiros)

```
src/pages/use/
├── Installation.tsx
├── FirstSteps.tsx
├── Commands.tsx
└── BestPractices.tsx
```

### 6.3 Camada 3 — Conceitos (9 ficheiros)

```
src/pages/concepts/
├── EngineeringState.tsx
├── ESM.tsx
├── Capabilities.tsx
├── Governance.tsx
├── ArchitectureConcept.tsx
├── Events.tsx
├── Policies.tsx
├── Knowledge.tsx
└── Evolution.tsx
```

### 6.4 Camada 4 — Arquitetura (6 ficheiros)

```
src/pages/architecture/
├── Components.tsx
├── Responsibilities.tsx
├── Dependencies.tsx
├── Flows.tsx
├── DomainModel.tsx
└── SystemStructure.tsx
```

### 6.5 Camada 5 — Engenharia (7 ficheiros)

```
src/pages/engineering/
├── SourceCode.tsx
├── Modules.tsx
├── Contracts.tsx
├── Interfaces.tsx
├── ADRs.tsx
├── TechnicalGovernance.tsx
└── EngineeringStateDetail.tsx
```

### 6.6 Camada 6 — Referencia (6 ficheiros)

```
src/pages/reference/
├── API.tsx
├── ContractsRef.tsx
├── EventsRef.tsx
├── Types.tsx
├── Configuration.tsx
└── Schemas.tsx
```

**Total: 36 ficheiros de paginas + 1 Logo + 1 CrossLinks = 38 ficheiros novos**

---

## 7. Ficheiros a Modificar

| Ficheiro | Mudanca |
|---|---|
| `App.tsx` | Novas 36 rotas + imports das 6 camadas |
| `Sidebar.tsx` | Reescrever com 6 camadas expansiveis |
| `Header.tsx` | Adicionar Logo + breadcrumb hierarquico |
| `BottomNav.tsx` | 6 icones de camada |
| `globals.css` | Estilos de camadas + logo + breadcrumb + cross-links |
| `index.html` | Favicon SVG "N" |

---

## 8. Ficheiros a Remover (11 paginas antigas)

| Ficheiro | Substituido por |
|---|---|
| `pages/DashboardPage.tsx` | Camada 1 (Discover) |
| `pages/ArchitecturePage.tsx` | Camada 4 (Architecture) |
| `pages/KnowledgePage.tsx` | Camada 3 (Concepts) |
| `pages/CapabilitiesPage.tsx` | Camada 3 (Concepts) |
| `pages/EngineeringPage.tsx` | Camada 5 (Engineering) |
| `pages/GoalsPage.tsx` | Camada 3 (Concepts) |
| `pages/PoliciesPage.tsx` | Camada 3 (Concepts) |
| `pages/EventsPage.tsx` | Camada 3 (Concepts) |
| `pages/DocumentationPage.tsx` | Camada 6 (Reference) |
| `pages/ObservabilityPage.tsx` | Camada 3 + 5 |
| `pages/SettingsPage.tsx` | Camada 6 (Reference) |

---

## 9. Estilo Visual

### Cores (inspirado no terminal)

```
Fundo:       #0a0a0f (surface-0)
Superficie:  #111118 (surface-1)
Hover:       #1a1a24 (surface-2)
Accent:      #00e5ff (cyan) — cor principal
Sucesso:     #00ff41 (verde neon)
Aviso:       #ffaa00
Erro:        #ff3d71
Texto:       #f0f0f5 (primary)
Secundario:  #9494a8
Muted:       #5c5c72
```

### Logo "N"

```
Tamanho: 32x32px (md), 24x24px (sm), 48x48px (lg)
Forma: Quadrado arredondado (border-radius: 8px)
Fundo: Linear gradient #00e5ff → #6c5ce7
Letra: "N" branca, font-weight 700, font-size 16px
Sombra: 0 2px 8px rgba(0, 229, 255, 0.3)
```

### Breadcrumb

```
Formato: Camada > Sub-pagina
Estilo: text-xs, text-text-secondary
Separador: ">" em text-text-muted
Ultimo item: text-text-primary font-medium
```

### Camadas no Sidebar

```
Cabecalho da camada: flex, items-center, gap-2
Icone: text-xs opacity-70
Nome: text-sm font-medium
Seta: text-xs text-text-muted (rotaciona ao expandir)
Sub-itens: pl-8, text-xs, text-text-secondary
Expansao: max-height transition, ease-out
```

---

## 10. Conteudo das Paginas (Resumo)

### Camada 1 — O que e o Nexus

```
O Nexus e um framework de governanca para desenvolvimento
de software assistido por IA.

Ele transforma conhecimento tacito em estado explicito,
verificavel e operacional.

Principio Fundamental:
A engenharia nao deve depender da memoria.
Deve depender de estado explicito.

O que o Nexus faz:
- Governanca automatizada
- Scoring de complexidade
- Deteccao de padroes
- Health auditing
- Gestao de capabilities
- Evolucao adaptativa

Para quem e:
- Developers que trabalham com IA
- Tech Leads que precisam de governanca
- Arquitectos que querem preservar decisoes
- Mantenedores que precisam de estado explicito
```

### Camada 2 — Comandos Essenciais

```
nexus init
Instala o framework no projecto.
Detecta stack, gera profile, cria estrutura.

nexus status
Verifica saude da governanca.
Mostra: capabilities, maturidade, health.

nexus upgrade
Adiciona capacidades ao projecto.
--capability <name> ou --accept-recommended

nexus validate
Valida conformidade do projecto.
Verifica: regras, tipos, estrutura.
```

### Camada 3 — Engineering State

```
Engineering State

O que e:
Estado explicito e verificavel da engenharia.
Nao depende de memoria humana.

Por que existe:
Software degrada quando decisoes, contexto e
conhecimento deixam de ser preservados.

7 Leis Fundamentais:
1. Estado acima da Memoria
2. Conhecimento deve ser Operacional
3. Evidencia prevalece sobre documentacao
4. Evolucao preserva Engenharia
5. Governanca e Adaptativa
6. Todo Processo deve ser Verificavel
7. Engenharia e um Sistema Vivo

Componentes:
- context_buffer.yaml (RAM)
- docs/history/ (ROM)
- maturity-profile.json
- engineering-state/
```

---

## 11. Fases de Implementacao

| Fase | Escopo | Ficheiros |
|---|---|---|
| **1** | Logo + Sidebar + Header + BottomNav | 4 modificados, 1 criado |
| **2** | Camada 1 (Descoberta) | 4 paginas novas |
| **3** | Camada 2 (Utilizacao) | 4 paginas novas |
| **4** | Camada 3 (Conceitos) | 9 paginas novas |
| **5** | Camada 4 (Arquitetura) | 6 paginas novas |
| **6** | Camada 5 (Engenharia) | 7 paginas novas |
| **7** | Camada 6 (Referencia) | 6 paginas novas |
| **8** | CrossLinks + Polish + Remover antigas | Cleanup |

---

## 12. Comando para Iniciar

```bash
cd apps/nexus-dashboard && pnpm dev
```

---

## 13. Criterios de Conclusao

- Sidebar mostra 6 camadas expansiveis
- Header mostra Logo "N" + breadcrumb hierarquico
- Camada 1-6 funcionais com conteudo real
- CrossLinks entre conceitos funcionam
- Mobile: hamburger menu + bottom nav
- Breadcrumb actualiza ao navegar
- Favicon "N" no browser
- TypeScript zero erros
- Build passa sem erros
- Paginas antigas removidas
- Conteudo deriva das fontes oficiais (living documentation)

---

## 14. Referencias

- `docs/CONCEPTUAL_MODEL.md` — Modelo conceptual (Camada 3)
- `docs/KNOWLEDGE_LIFECYCLE.md` — Ciclo de vida (Camada 3)
- `docs/Nexus-System_GUIDE.md` — Guia completo (Camadas 1-4)
- `governance/WORKFLOW.md` — Fluxo de sessao (Camada 2)
- `governance/SYSTEM_MAP.md` — Mapa do sistema (Camada 4)
- `FORBIDDEN_OPERATIONS.md` — Regras vinculantes (Camada 3)
- `DESDO.md` — Diretrizes de engenharia (Camada 5)
- `Engineering_State_Method_v0.1.txt` — ESM (Camada 3)
- `image.png` — Referencia visual do terminal
