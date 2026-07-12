# MCP Server

O servidor MCP (Model Context Protocol) permite que agentes AI acessem o contexto do projeto em tempo real.

---

## Visão Geral

O MCP Server expõe o estado do projeto para agentes AI, fornecendo acesso a:
- Arquivos do projeto
- Estado de governança
- Regras e políticas
- Métricas e scores

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  AI Agent   │────▶│  MCP Server │────▶│   Nexus     │
│  (Claude)   │     │             │     │  (Projeto)  │
└─────────────┘     └─────────────┘     └─────────────┘
```

---

## Configuração

### Instalação

```bash
nexus mcp install
```

### Iniciar Servidor

```bash
nexus mcp
```

### Configuração no Claude Desktop

Adicione ao `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "nexus": {
      "command": "nexus",
      "args": ["mcp"]
    }
  }
}
```

---

## Recursos Expostos

| Recurso | Descrição |
|---|---|
| `nexus://status` | Status de saúde do projeto |
| `nexus://rules` | Regras ativas |
| `nexus://plans` | Planos disponíveis |
| `nexus://context` | Buffer de contexto |

---

## Uso com Agentes AI

### Claude Desktop

1. Instale o servidor: `nexus mcp install`
2. Configure no Claude Desktop
3. Reinicie o Claude
4. O agente terá acesso ao contexto do projeto

### Copilot / Outros Agentes

O servidor MCP segue o protocolo padrão e pode ser integrado com qualquer agente que suporte MCP.

---

## Arquitetura

```
src/
├── mcp-server.ts         # Implementação do servidor MCP
├── mcp/
│   ├── resources.ts      # Recursos expostos
│   └── tools.ts          # Ferramentas disponíveis
└── __tests__/
    └── mcp-server.test.ts # Testes
```
