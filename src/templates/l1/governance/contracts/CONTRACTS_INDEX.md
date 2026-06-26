# Índice de Contratos de IA (AI Governance)

Este índice mapeia os contratos operacionais que regulam as permissões, responsabilidades, ferramentas e fluxos de handoff para cada agente inteligente atuante no monorepo.

---

## Contratos Ativos

| Nome do Agente | Função | Arquivo de Contrato | Versão | Status |
|---|---|---|---|---|
| **Planner** | Planejamento & Arquitetura | [AI-CONTRACT-planner-v1.yaml](../agents/AI-CONTRACT-planner-v1.yaml) | v1.0 | ✅ Ativo |
| **Executor** | Escrita & Codificação | [AI-CONTRACT-executor-v1.yaml](../agents/AI-CONTRACT-executor-v1.yaml) | v1.0 | ✅ Ativo |
| **Reviewer** | Testes & Qualidade | [AI-CONTRACT-reviewer-v1.yaml](../agents/AI-CONTRACT-reviewer-v1.yaml) | v1.0 | ✅ Ativo |
| **Orchestrator** | Gestão de Estados & Auditoria | [AI-CONTRACT-orchestrator-v1.yaml](../agents/AI-CONTRACT-orchestrator-v1.yaml) | v1.0 | ✅ Ativo |

---

## Diretrizes de Governança

1. **Modificações proibidas:** Os contratos só podem ser modificados mediante a criação de um novo ADR aprovado pelo usuário detalhando as novas permissões ou ferramentas necessárias.
2. **Auditoria de Boundaries:** O Orquestrador validará se as ferramentas acionadas pelo agente ativo em execução condizem estritamente com as ferramentas permitidas em seu contrato.
