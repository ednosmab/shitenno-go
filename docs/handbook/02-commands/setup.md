# Setup & Configuration

Comandos para inicializar e configurar o projeto Nexus.

---

## `nexus init`

Inicializa o ecossistema Nexus com descoberta baseada em maturidade.

```bash
nexus init [options]
```

### Opções

| Opção | Descrição |
|---|---|
| `--dir <path>` | Diretório específico para inicializar |
| `--answers-file <file>` | Modo não-interativo com respostas pré-definidas |

### Exemplos

```bash
nexus init                          # Setup interativo
nexus init --dir ./my-project       # Diretório específico
nexus init --answers-file config.json  # Modo não-interativo
```

### Dicas

- Execute este comando primeiro para configurar governança no projeto
- Se já inicializado, re-executa o questionário de maturidade

---

## `nexus mcp`

Servidor MCP para agentes AI — inicie o servidor ou instale globalmente.

```bash
nexus mcp [options] [command]
```

### Subcomandos

| Comando | Descrição |
|---|---|
| `nexus mcp` | Inicia o servidor MCP |
| `nexus mcp install` | Instala o servidor MCP Filesystem |
| `nexus mcp install --check` | Verifica status da instalação |
| `nexus mcp install --upgrade` | Atualiza para a versão mais recente |

### Opções

| Opção | Descrição |
|---|---|
| `--project-root <path>` | Raiz do projeto (padrão: diretório atual) |

### Exemplos

```bash
nexus mcp                    # Iniciar servidor
nexus mcp --project-root .   # Raiz específica
nexus mcp install            # Instalar servidor
nexus mcp install --check    # Verificar instalação
nexus mcp install --upgrade  # Atualizar
```

### Dicas

- Conecte seu agente AI a este servidor para contexto ao vivo do projeto
- Execute `nexus mcp install` uma vez para corrigir timeouts do MCP

---

## `nexus upgrade`

Adicione capacidades ao ecossistema de governança.

```bash
nexus upgrade [options]
```

### Opções

| Opção | Descrição |
|---|---|
| `--capability <name>` | Instalar capacidade específica |
| `--accept-recommended` | Instalar todas as recomendadas |

### Exemplos

```bash
nexus upgrade                          # Mostrar capacidades disponíveis
nexus upgrade --capability architecture # Instalar capacidade específica
nexus upgrade --accept-recommended     # Instalar todas recomendadas
```

---

## `nexus clean`

Limpe o cache e arquivos temporários do Nexus.

```bash
nexus clean [options]
```

### Opções

| Opção | Descrição |
|---|---|
| `--dry-run` | Pré-visualização do que seria deletado |

### Exemplos

```bash
nexus clean              # Limpar todo cache
nexus clean --dry-run    # Pré-visualizar limpeza
```
