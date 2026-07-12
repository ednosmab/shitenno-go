# O que é Nexus

> Uma explicação simples do que o Nexus faz e por que ele existe.

---

## O problema

Toda equipe de engenharia acumula conhecimento: decisões de arquitetura, padrões de código, runbooks, habilidades. Mas esse conhecimento:

- **Vive isolado** — cada documento é uma ilha
- **Decai silenciosamente** — ninguém verifica se ainda é válido
- **Falta contexto** — não se sabe quando usar ou por que existe
- **Não compõe** — conhecimento não gera mais conhecimento

Isso cria **Knowledge Debt** — o custo invisível de conhecimento documentado mas desconectado.

---

## O que é Nexus

O **Nexus System** é um framework de governança para desenvolvimento de software assistido por IA.

Ele:

- **Analisa** a complexidade do seu projeto
- **Detecta** padrões no histórico de engenharia
- **Audita** a saúde da governança
- **Recomenda** ações baseadas em evidências
- **Adapta** o nível de detalhe ao seu perfil

O Nexus **não é**:

- Um framework de documentação
- Um framework de IA
- Um CLI genérico

O verdadeiro domínio é: **gestão da evolução de produto através de conhecimento, governança e automação.**

---

## Para quem serve

| Tamanho de equipe | Perfil | O que Nexus resolve |
|---|---|---|
| **Solo** | Developer trabalhando sozinho que perde contexto entre sessões | Preserva estado para retomar sem reler tudo |
| **2-5 pessoas** | Pequena equipe onde conhecimento vive na cabeça de uma pessoa | Torna conhecimento tácito explícito e verificável |
| **5-15 pessoas** | Equipe em crescimento onde onboarding é doloroso | Novos membros entram em horas, não semanas |
| **Times com AI** | Equipes onde agentes AI operam sem contexto de governança | Agentes recebem contexto governado e hierárquico |

---

## Os 3 camadas operacionais

```
┌─────────────────────────────────────────┐
│  Governance Layer                       │
│  "Como trabalhamos"                     │
│  Rules, Workflows, Contracts            │
├─────────────────────────────────────────┤
│  Knowledge Layer                        │
│  "O que sabemos"                        │
│  ADRs, Skills, Runbooks, Scripts        │
├─────────────────────────────────────────┤
│  Analysis Layer                         │
│  "O que medimos"                        │
│  Scoring, Patterns, Health, Debt        │
└─────────────────────────────────────────┘
```

---

## Os 6 princípios imutáveis

1. **Código é Consequência de Conhecimento** — bem escrito vem de bem entendido
2. **Arquitetura é Consequência de Domínio** — não de frameworks
3. **Capabilities Evoluem antes de Features** — habilidades primeiro, funcionalidades depois
4. **AI Amplifica Boa Engenharia** — não substitui, amplifica
5. **Toda Decisão Gera Conhecimento** — cada escolha é uma semente
6. **Estado de Engenharia é Mais Importante que Estado de Código** — o que sabemos importa mais que o que escrevemos

---

## Como funciona (visão geral)

```
Seu Projeto
    │
    ▼
┌─────────┐    ┌─────────┐    ┌─────────┐
│  INIT   │───▶│ ANALYSE │───▶│  SCORE  │
└─────────┘    └─────────┘    └─────────┘
                                  │
                                  ▼
┌─────────┐    ┌─────────┐    ┌─────────┐
│ EVOLVE  │◀───│  AUDIT  │◀───│ DETECT  │
└─────────┘    └─────────┘    └─────────┘
```

1. **Init** — Instala governança no projeto
2. **Analyse** — Detecta stack, packages, maturidade
3. **Score** — Calcula score de saúde (0-100)
4. **Detect** — Encontra padrões no histórico
5. **Audit** — Verifica integridade da governança
6. **Evolve** — Recomenda próximas ações

---

## Próximo passo

→ [Instalação](installation.md)
