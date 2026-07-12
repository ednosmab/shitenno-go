# Pipeline & Execution

Comandos para executar pipelines de análise e ações de governança.

---

## `nexus run`

Execute o pipeline de análise completo (analisar → pontuar → detectar → auditar → evoluir).

```bash
nexus run [options]
```

### Opções

| Opção | Descrição |
|---|---|
| `--json` | Saída em formato JSON |

### Exemplos

```bash
nexus run                 # Pipeline completo
nexus run --json          # Saída JSON
```

### Dicas

- Combina todos os estágios de análise em um único comando
- Útil para CI/CD ou verificações de saúde periódicas

---

## `nexus evolve`

Mostre recomendações de evolução e gerencie feedback.

```bash
nexus evolve [options]
```

### Opções

| Opção | Descrição |
|---|---|
| `--json` | Saída em formato JSON |

### Exemplos

```bash
nexus evolve              # Mostrar recomendações
nexus evolve --json       # Saída JSON
```

---

## `nexus act`

Execute ações com garantias de idempotência.

```bash
nexus act [options]
```

### Subcomandos

| Comando | Descrição |
|---|---|
| `nexus act create` | Criar nova ação |
| `nexus act list` | Listar todas as ações |

### Opções

| Opção | Descrição |
|---|---|
| `--title <title>` | Título da ação |
| `--action-type <type>` | Tipo da ação (bugfix, feature, etc.) |

### Exemplos

```bash
nexus act create --title 'Fix auth' --action-type bugfix
nexus act list            # Listar todas as ações
```

---

## `nexus plan`

Gerencie sequências de ações coordenadas (planos).

```bash
nexus plan <subcommand> [options]
```

### Subcomandos

| Comando | Descrição |
|---|---|
| `nexus plan create <name>` | Criar um plano |
| `nexus plan execute <plan-id>` | Executar um plano |
| `nexus plan list` | Listar todos os planos |
| `nexus plan show <plan-id>` | Mostrar detalhes do plano |
| `nexus plan md prepare <id>` | Preparar pipeline de validação |

### Exemplos

```bash
nexus plan create my-plan           # Criar plano
nexus plan execute plan-001         # Executar plano
nexus plan list                     # Listar planos
nexus plan show plan-001            # Detalhes do plano
nexus plan md prepare plan-001      # Preparar pipeline
```
