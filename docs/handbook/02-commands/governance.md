# Governance

Comandos para gerenciar metas, decisões e políticas.

---

## `nexus goal`

Gerencie metas de governança.

```bash
nexus goal <subcommand> [options]
```

### Subcomandos

| Comando | Descrição |
|---|---|
| `nexus goal create` | Criar nova meta |
| `nexus goal list` | Listar todas as metas |
| `nexus goal show <id>` | Mostrar detalhes da meta |

### Opções

| Opção | Descrição |
|---|---|
| `--title <title>` | Título da meta |
| `--priority <level>` | Prioridade (high, medium, low) |

### Exemplos

```bash
nexus goal create --title 'Improve tests' --priority high
nexus goal list            # Listar metas
nexus goal show goal-001   # Detalhes da meta
```

---

## `nexus decide`

Avalie ações propostas usando avaliadores especializados.

```bash
nexus decide <action> [options]
```

### Opções

| Opção | Descrição |
|---|---|
| `--category <cat>` | Categoria da decisão |

### Exemplos

```bash
nexus decide "upgrade auth to OAuth2"
nexus decide "add rate limiting" --category security
nexus decide list          # Listar todas as decisões
```

### Dicas

- Avalia risco, impacto, confiança e alinhamento com metas

---

## `nexus policy`

Gerencie e avalie políticas de governança declarativas.

```bash
nexus policy <subcommand> [options]
```

### Subcomandos

| Comando | Descrição |
|---|---|
| `nexus policy list` | Listar todas as políticas |
| `nexus policy evaluate` | Avaliar estado atual contra políticas |

### Exemplos

```bash
nexus policy list          # Listar políticas
nexus policy evaluate      # Avaliar políticas
```
