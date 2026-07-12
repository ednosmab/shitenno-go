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
