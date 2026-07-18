# Plano: Feedback do Utilizador + Shiten Update com Change Detection

**Data:** 2026-07-04
**Prioridade:** P1
**Tempo estimado:** ~2-3h (ambos os features)

---

## Problema

1. **Feedback:** O `shiten feedback` só regista o outcome do agente. O utilizador não pode avaliar a sessão (rating, comentário).
2. **Update:** Não existe `shiten update`. O `shiten upgrade` só adiciona capabilities novas, nunca actualiza existentes. Não há detecção de mudanças no CLI.

---

## PARTE 1: Feedback do Utilizador

### Schema Proposto
```typescript
{
  userRating?: 1 | 2 | 3 | 4 | 5;
  userComment?: string;
  userTags?: string[];
}
```

### Steps

| # | Accão | Ficheiro | Verificação |
|---|---|---|---|
| 1.1 | Adicionar campos ao schema `SessionFeedbackRecord` | `src/session-feedback.ts` | `grep "userRating" src/session-feedback.ts` |
| 1.2 | Adicionar flags `--user-rating`, `--user-comment`, `--user-tags` | `src/commands/feedback.ts` | `shiten feedback --help` mostra novos flags |
| 1.3 | Actualizar `recordOutcome()` para aceitar user feedback | `src/session-feedback.ts` | Testes passam |
| 1.4 | Actualizar output do `--summary` para mostrar rating médio | `src/commands/feedback.ts` | `shiten feedback --summary` mostra avg rating |
| 1.5 | Adicionar testes | `src/__tests__/session-feedback.test.ts` | Testes passam |

---

## PARTE 2: Shiten Update com Change Detection

### Mecanismo: Manifest File

`shitenno-go/manifest.json` regista:
- Versão do CLI aquando do install/upgrade
- Timestamp da instalação
- Hashes SHA-256 de cada template copiado

### Novo Comando
```
shiten update                    # Detecta mudanças, mostra diff
shiten update --apply            # Aplica actualizações
shiten update --dry-run          # Mostra o que mudaria sem aplicar
shiten update --backup           # Cria backup antes de sobrescrever
```

### Steps

| # | Accão | Ficheiro | Verificação |
|---|---|---|---|
| 2.1 | Criar tipo `Manifest` e funções `readManifest`/`writeManifest` | `src/manifest.ts` | `grep "Manifest" src/manifest.ts` |
| 2.2 | Integrar manifest no `init` | `src/commands/init.ts` | `manifest.json` existe após init |
| 2.3 | Integrar manifest no `upgrade` | `src/commands/upgrade.ts` | Manifest actualizado |
| 2.4 | Criar comando `shiten update` | `src/commands/update.ts` | `shiten update --dry-run` mostra diff |
| 2.5 | Registar comando no `bin/shiten.ts` | `bin/shiten.ts` | `shiten --help` mostra update |
| 2.6 | Adicionar testes | `src/__tests__/update.test.ts` | Testes passam |

---

## Checklist de Conclusão

- [ ] `shiten feedback --user-rating 4` grava correctamente
- [ ] `shiten feedback --summary` mostra rating médio
- [ ] `shitenno-go/manifest.json` criado após init
- [ ] `shiten update --dry-run` detecta mudanças
- [ ] `shiten update --apply` aplica actualizações
- [ ] TypeScript compila sem erros
- [ ] Testes passam
