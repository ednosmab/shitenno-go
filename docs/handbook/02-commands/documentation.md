# Documentation

Comandos para auditoria e manutenção da documentação.

---

## `nexus docs-audit`

Audite a documentação do projeto para inconsistências e problemas.

```bash
nexus docs-audit [options]
```

### Opções

| Opção | Descrição |
|---|---|
| `--json` | Saída em formato JSON |

### Exemplos

```bash
nexus docs-audit           # Auditoria completa
nexus docs-audit --json    # Saída JSON
```

### Dicas

- Verifica links quebrados, formatação inválida e inconsistências
- Execute periodicamente para manter a documentação saudável
