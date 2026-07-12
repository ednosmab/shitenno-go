# Status & Analysis

Comandos para verificar saúde do projeto, maturidade e padrões.

---

## `nexus status`

Verifica o status de saúde da governança com pontuação de maturidade.

```bash
nexus status [options]
```

### Opções

| Opção | Descrição |
|---|---|
| `--json` | Saída em formato JSON |
| `--no-cache` | Ignorar cache, recalcular |

### Exemplos

```bash
nexus status              # Relatório completo
nexus status --json       # Saída JSON
nexus status --no-cache   # Recalcular tudo
```

### Dicas

- Mostra pontuação de saúde (0-100), problemas e status do knowledge graph
- Execute periodicamente para acompanhar a saúde da governança ao longo do tempo

---

## `nexus audit`

Audite a saúde da governança, knowledge graph e problemas.

```bash
nexus audit [options]
```

### Opções

| Opção | Descrição |
|---|---|
| `--json` | Saída em formato JSON para CI/CD |

### Exemplos

```bash
nexus audit               # Auditoria completa com pontuação
nexus audit --json        # Saída JSON
```

---

## `nexus doctor`

Mentor de engenharia — identifique riscos e sugira melhorias.

```bash
nexus doctor [options]
```

### Opções

| Opção | Descrição |
|---|---|
| `--json` | Saída em formato JSON |

### Exemplos

```bash
nexus doctor              # Relatório diagnóstico completo
nexus doctor --json       # Saída JSON
```

---

## `nexus assess`

Reavalie a maturidade do projeto e recomende novas capacidades.

```bash
nexus assess [options]
```

### Opções

| Opção | Descrição |
|---|---|
| `--json` | Saída em formato JSON |

### Exemplos

```bash
nexus assess              # Reavaliação interativa
nexus assess --json       # Saída JSON
```

### Dicas

- Execute quando o projeto cresceu para descobrir novas capacidades

---

## `nexus detect`

Detecte padrões no histórico e proponha regras candidatas.

```bash
nexus detect [options]
```

### Opções

| Opção | Descrição |
|---|---|
| `--json` | Saída em formato JSON |

### Exemplos

```bash
nexus detect              # Analisar histórico
nexus detect --json       # Saída JSON
```
