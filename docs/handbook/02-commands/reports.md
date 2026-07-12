# Reports & Dashboards

Comandos para visualizar relatórios, dashboards e resumos.

---

## `nexus console`

Console de economia de tokens com métricas de sessão.

```bash
nexus console [options]
```

### Opções

| Opção | Descrição |
|---|---|
| `--days <n>` | Últimos N dias |

### Exemplos

```bash
nexus console              # Console completo
nexus console --days 30    # Últimos 30 dias
```

---

## `nexus report`

Gere um relatório de desempenho para o usuário.

```bash
nexus report [options]
```

### Opções

| Opção | Descrição |
|---|---|
| `--json` | Saída em formato JSON |

### Exemplos

```bash
nexus report               # Relatório completo
nexus report --json        # Saída JSON
```

---

## `nexus digest`

Resumo diário da saúde do projeto e mudanças recentes.

```bash
nexus digest [options]
```

### Opções

| Opção | Descrição |
|---|---|
| `--json` | Saída em formato JSON |

### Exemplos

```bash
nexus digest               # Digest de hoje
nexus digest --json        # Saída JSON
```

---

## `nexus bench`

Execute benchmarks de performance do sistema.

```bash
nexus bench [options]
```

### Opções

| Opção | Descrição |
|---|---|
| `--json` | Saída em formato JSON |

### Exemplos

```bash
nexus bench                # Benchmark completo
nexus bench --json         # Saída JSON
```
