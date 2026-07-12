# AI Integration

Comandos para integração com agentes AI e workflows.

---

## `nexus briefing`

Gere um briefing pré-sessão para agentes AI.

```bash
nexus briefing [options]
```

### Opções

| Opção | Descrição |
|---|---|
| `--json` | Saída em formato JSON |

### Exemplos

```bash
nexus briefing             # Briefing completo
nexus briefing --json      # Saída JSON
```

### Dicas

- Execute no início de cada sessão de chat com agentes AI
- Fornece contexto do projeto, riscos e regras ativas

---

## `nexus feedback`

Registre feedback de sessão para melhoria contínua.

```bash
nexus feedback [options]
```

### Opções

| Opção | Descrição |
|---|---|
| `--outcome <type>` | Resultado da sessão (success, failure, partial) |
| `--notes <text>` | Notas adicionais |
| `--areas <list>` | Áreas afetadas |

### Exemplos

```bash
nexus feedback --outcome success
nexus feedback --outcome failure --notes "Build failed"
nexus feedback --outcome partial --areas "auth,dashboard"
```

---

## `nexus profile`

Gerencie o perfil do usuário para calibrar respostas.

```bash
nexus profile [options]
```

### Opções

| Opção | Descrição |
|---|---|
| `--json` | Saída em formato JSON |

### Exemplos

```bash
nexus profile              # Ver perfil atual
nexus profile --json       # Saída JSON
```

---

## `nexus dashboard`

Dashboard interativo com visão geral do projeto.

```bash
nexus dashboard [options]
```

### Opções

| Opção | Descrição |
|---|---|
| `--json` | Saída em formato JSON |

### Exemplos

```bash
nexus dashboard            # Dashboard completo
nexus dashboard --json     # Saída JSON
```

---

## `nexus reminders`

Gerencie lembretes para o usuário.

```bash
nexus reminders [options]
```

### Subcomandos

| Comando | Descrição |
|---|---|
| `nexus reminders list` | Listar lembretes |
| `nexus reminders add` | Adicionar lembrete |
| `nexus reminders remove <id>` | Remover lembrete |

### Exemplos

```bash
nexus reminders list       # Listar lembretes
nexus reminders add "Revisar handbook" --priority medium
nexus reminders remove reminder-001
```
