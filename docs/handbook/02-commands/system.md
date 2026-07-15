# System

Comandos de sistema e utilitários.

---

## `nexus validate`

Valide a configuração e integridade do projeto.

```bash
nexus validate [options]
```

### Opções

| Opção | Descrição |
|---|---|
| `--json` | Saída em formato JSON |

### Exemplos

```bash
nexus validate             # Validação completa
nexus validate --json      # Saída JSON
```

---

## `nexus shell-init`

Inicialize o shell para integração com o Nexus.

```bash
nexus shell-init [options]
```

### Opções

| Opção | Descrição |
|---|---|
| `--shell <type>` | Tipo do shell (bash, zsh, fish) |

### Exemplos

```bash
nexus shell-init           # Detectar shell automaticamente
nexus shell-init --shell zsh
```

---

## `nexus handbook`

Acesse o handbook do projeto no terminal.

```bash
nexus handbook [options]
```

### Opções

| Opção | Descrição |
|---|---|
| `--level <n>` | Filtrar por nível (1, 2, 3) |
| `--topic <name>` | Abrir tópico específico |
| `--list` | Listar todos os tópicos |
| `--print` | Imprimir conteúdo no terminal |
| `--fill` | Preencher dados semânticos do template |

### Exemplos

```bash
nexus handbook              # TUI interativo
nexus handbook --level 1    # Apenas fundamentos
nexus handbook --level 2    # Apenas comandos
nexus handbook --level 3    # Apenas arquitetura
nexus handbook --list       # Listar tópicos
nexus handbook --print      # Imprimir no terminal
nexus handbook --fill       # Preencher dados semânticos
```

---

## `nexus hooks`

Instalar ou remover git hooks do Nexus.

```bash
nexus hooks [--uninstall] [--dir <path>]
```

### Opções

| Opção | Descrição |
|---|---|
| `--uninstall` | Remover hooks do git |

### Exemplos

```bash
nexus hooks              # Instalar hooks
nexus hooks --uninstall  # Remover hooks
```

---

## `nexus daemon`

Gerir o daemon de automação em background.

```bash
nexus daemon <start|stop|status|restart>
```

### Subcomandos

| Subcomando | Descrição |
|---|---|
| `start` | Iniciar o daemon em background |
| `stop` | Parar o daemon graciosamente |
| `status` | Mostrar PID, uptime, circuit breaker |
| `restart` | Parar e reiniciar |

### O que faz

- Observa arquivos de governança para mudanças
- Auto-arquiva planos concluídos
- Expõe socket IPC para consultas de estado
- Circuit breaker: 5 crashes em 60s activa o breaker

### Exemplos

```bash
nexus daemon start       # Iniciar daemon
nexus daemon stop        # Parar daemon
nexus daemon status      # Ver estado
nexus daemon restart     # Reiniciar
```

---

## `nexus watch`

Log de eventos em tempo real para monitorização de governança.

```bash
nexus watch [--events <types>] [--dir <path>]
```

### Opções

| Opção | Descrição |
|---|---|
| `--events <types>` | Filtrar por tipo de evento (ex: `plan.*,session.*`) |

### Exemplos

```bash
nexus watch                              # Todos os eventos
nexus watch --events plan.*,daemon.*     # Filtrar eventos
```

---

## `nexus events`

Mostrar trace de execução do motor de regras.

```bash
nexus events [--last <n>] [--trigger <type>] [--json]
```

### Opções

| Opção | Descrição |
|---|---|
| `--last <n>` | Últimos N eventos (padrão: 20) |
| `--trigger <type>` | Filtrar por tipo de trigger |
| `--json` | Saída em formato JSON |

### Exemplos

```bash
nexus events                    # Últimos 20 eventos
nexus events --last 50          # Últimos 50
nexus events --trigger session  # Filtrar por session
```

---

## `nexus context`

Contexto completo do projecto para agentes AI.

```bash
nexus context [--json] [--for-agent <name>]
```

### Opções

| Opção | Descrição |
|---|---|
| `--json` | Saída em formato JSON |
| `--for-agent <name>` | Filtrar contexto para um agente |

### Exemplos

```bash
nexus context                    # Contexto completo
nexus context --for-agent plan   # Contexto para agente plan
```

---

## `nexus history`

Ver histórico de estado de engenharia com diffs opcionais.

```bash
nexus history [--from <date>] [--to <date>] [--diff] [--json]
```

### Opções

| Opção | Descrição |
|---|---|
| `--from <date>` | Data inicial (formato ISO) |
| `--to <date>` | Data final (formato ISO) |
| `--diff` | Mostrar diff entre snapshots |
| `--json` | Saída em formato JSON |

### Exemplos

```bash
nexus history                    # Listar snapshots
nexus history --diff             # Com diffs
nexus history --from 2026-07-01  # A partir de data
```

---

## `nexus reminders`

Gerir lembretes de sessão com prioridade e categoria.

```bash
nexus reminders [add|rm|clear] [options]
```

### Subcomandos

| Subcomando | Descrição |
|---|---|
| (nenhum) | Listar todos os lembretes activos |
| `add <msg>` | Adicionar lembrete |
| `rm <index>` | Remover por índice |
| `rm --message <text>` | Remover por mensagem parcial |
| `clear` | Remover todos |

### Opções (add)

| Opção | Descrição |
|---|---|
| `--priority <level>` | Prioridade: high, medium, low (padrão: medium) |
| `--category <cat>` | Categoria: bug, feature, debt, security, docs, infra |
| `--notify` | Enviar notificação desktop |

### Exemplos

```bash
nexus reminders add "Rodar audit" --priority high
nexus reminders add "Fix auth bug" --category bug
nexus reminders rm 1
nexus reminders clear
```

---

## `nexus update`

Detectar mudanças em templates e aplicar actualizações.

```bash
nexus update [--apply] [--dir <path>] [--json]
```

### Opções

| Opção | Descrição |
|---|---|
| `--apply` | Aplicar actualizações detectadas |
| `--json` | Saída em formato JSON |

### Exemplos

```bash
nexus update            # Ver mudanças pendentes
nexus update --apply    # Aplicar actualizações
```

---

## `nexus docs-audit`

Auditar ciclo de vida da documentação e propor organização.

```bash
nexus docs-audit [--apply] [--dir <path>] [--json]
```

### Opções

| Opção | Descrição |
|---|---|
| `--apply` | Aplicar movimentações propostas |
| `--json` | Saída em formato JSON |

### Exemplos

```bash
nexus docs-audit            # Dry-run: ver movimentações
nexus docs-audit --apply    # Aplicar movimentações
```
