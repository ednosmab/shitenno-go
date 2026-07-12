# PLAN-HANDBOOK-SYNC — Sincronização Semântica do Handbook

**Status:** done
**Updated_at:** 2026-07-12T00:30:00.000Z
**Date:** 2026-07-11

> **Data:** 2026-07-11
> **Objectivo:** Automatizar a sincronização do handbook com dados reais do código, mantendo a filosofia como decisão humana
> **Status:** ✅ `done` — Cancelado. Passos 1, 2 e 4 implementados; passos 3, 5 e 6 descontinuados por decisão do utilizador.

---


## Checklist

- [ ] Passo 1 — Skill `handbook-fill`
- [ ] Passo 2 — RULE-HB-001
- [ ] Passo 3 — Template base do handbook
- [ ] Passo 4 — Quick Board update
- [ ] Passo 5 — Integração `nexus handbook fill`
- [ ] Passo 6 — Testes
- [ ] Passo 1 — Skill handbook-fill
- [ ] Passo 2 — RULE-HB-001
- [ ] Passo 3 — Template base
- [ ] Passo 4 — Quick Board
- [ ] Passo 5 — nexus handbook fill
- [ ] Passo 6 — Testes

## 1. Contexto

O handbook é a documentação de utilizador do Nexus. Tem duas camadas de conteúdo:

1. **Filosófica** (humano): visão, princípios, posicionamento — nunca auto-preencher
2. **Semântica** (AI): dados reais do código — comandos, capabilities, versões, schemas

O sistema actual (`sync-docs.ts`) trata do nível lexical (contagens, links, versões). Falta o nível semântico (AI lê código, preenche estruturas).

### Fluxo colaborativo

```
Código.fonte → AI (preenche semântica) → Template → Handbook final → Humano (edita filosofia)
```

---

## 2. Componentes a criar

| # | Componente | Path | Descrição |
|---|-----------|------|-----------|
| 1 | **Skill `handbook-fill`** | `nexus-system/docs/skills/handbook-fill.md` | Protocolo para AI preencher dados semânticos |
| 2 | **RULE-HB-001** | `nexus-system/governance/rules/RULE-HB-001.json` | Regra que dispara no session_start |
| 3 | **Template base** | `docs/handbook/handbook.template.md` | Template com marcadores SEMANTIC/PHILOSOPHY |
| 4 | **Quick Board update** | `nexus-system/docs/skills/quick-board-enforcement.md` | Adicionar secção handbook |
| 5 | **`nexus handbook fill`** | `src/commands/handbook.ts` | Extensão do command para escrever handbook |

---

## 3. Plano de implementação

### Passo 1: Skill `handbook-fill`

**Ficheiro:** `nexus-system/docs/skills/handbook-fill.md`

**Conteúdo:**
- Descrição do propósito
- Protocolo passo-a-passo
- Tipos de marcador SEMANTIC suportados
- Exemplo de template preenchido

### Passo 2: RULE-HB-001

**Ficheiro:** `nexus-system/governance/rules/RULE-HB-001.json`

**Trigger:** `session_start`
**Condição:** `glob('docs/handbook/*.template.md').length > 0`
**Acções:**
1. Notificar AI para carregar skill
2. Criar reminder para utilizador

### Passo 3: Template base do handbook

**Ficheiro:** `docs/handbook/handbook.template.md`

**Marcadores suportados:**
- `<!-- SEMANTIC:count <glob> -->` — Conta ficheiros
- `<!-- SEMANTIC:list <glob> | categorize <source> -->` — Lista e categoriza
- `<!-- SEMANTIC:version -->` — Lê versão do package.json
- `<!-- SEMANTIC:validate <file>:<claim> -->` — Valida afirmação
- `<!-- SEMANTIC:json <interface> -->` — Extrai schema JSON
- `<!-- SEMANTIC:glob <pattern> -->` — Lista ficheiros
- `<!-- PHILOSOPHY -->` / `<!-- /PHILOSOPHY -->` — Bloco intocável

### Passo 4: Quick Board update

Adicionar ao `quick-board-enforcement.md`:
```
│ 📚 Handbook: <X> semantic fields pending │
│ 📝 Handbook reminder: <status> │
```

### Passo 5: Integração `nexus handbook fill`

Extender `src/commands/handbook.ts` com subcommand `fill`:
- Lê template
- Valida blocos SEMANTIC preenchidos
- Escreve handbook final

### Passo 6: Testes

| Teste | Valida |
|-------|--------|
| Skill handbook-fill existe | Ficheiro lido com sucesso |
| RULE-HB-001 é válida | Schema da regra correcto |
| Template tem marcadores | Parsed corretamente |
| nexus handbook fill funciona | Escreve handbook final |

---

## 4. Checklists de implementação

### Passo 1 — Skill handbook-fill

| # | Step | Estado | Evidência |
|---|------|--------|-----------|
| 1.1 | Criar `nexus-system/docs/skills/handbook-fill.md` | ⬜ | |
| 1.2 | Definir protocolo de preenchimento | ⬜ | |
| 1.3 | Documentar marcadores SEMANTIC | ⬜ | |
| 1.4 | Adicionar exemplo de template preenchido | ⬜ | |

### Passo 2 — RULE-HB-001

| # | Step | Estado | Evidência |
|---|------|--------|-----------|
| 2.1 | Criar `nexus-system/governance/rules/RULE-HB-001.json` | ⬜ | |
| 2.2 | Validar schema contra rule-engine | ⬜ | |
| 2.3 | Testar trigger no session_start | ⬜ | |

### Passo 3 — Template base

| # | Step | Estado | Evidência |
|---|------|--------|-----------|
| 3.1 | Criar `docs/handbook/handbook.template.md` | ⬜ | |
| 3.2 | Definir blocos SEMANTIC para cada secção | ⬜ | |
| 3.3 | Marcar blocos PHILOSOPHY | ⬜ | |
| 3.4 | Validar que template é parseável | ⬜ | |

### Passo 4 — Quick Board

| # | Step | Estado | Evidência |
|---|------|--------|-----------|
| 4.1 | Actualizar `quick-board-enforcement.md` | ⬜ | |
| 4.2 | Adicionar secção handbook ao formato | ⬜ | |

### Passo 5 — nexus handbook fill

| # | Step | Estado | Evidência |
|---|------|--------|-----------|
| 5.1 | Extender `handbook.ts` com subcommand `fill` | ⬜ | |
| 5.2 | Implementar leitura de template | ⬜ | |
| 5.3 | Implementar escrita de handbook final | ⬜ | |
| 5.4 | Adicionar flag `--dry-run` | ⬜ | |

### Passo 6 — Testes

| # | Step | Estado | Evidência |
|---|------|--------|-----------|
| 6.1 | Teste: skill handbook-fill existe | ⬜ | |
| 6.2 | Teste: RULE-HB-001 schema válido | ⬜ | |
| 6.3 | Teste: template parseável | ⬜ | |
| 6.4 | Teste: nexus handbook fill --dry-run | ⬜ | |
| 6.5 | Correr pnpm test + pnpm run lint | ⬜ | |

---

## 5. Decisões de design

| Decisão | Escolha | Razão |
|---------|---------|-------|
| `--fix` no sync-docs | Explícito | Documentado em sync-docs.ts header |
| Template format | Markdown com HTML comments | Compatível com MD, não quebra render |
| Marcadores SEMANTIC | `<!-- SEMANTIC:tipo args -->` | Simples, extensível, parseável |
| Philosophy blocks | `<!-- PHILOSOPHY -->` | Claro, auditável |
| Reminder | Via `nexus reminders` | Já existe infra |
| Quick Board | Adicionar secção | Mantém padrão existente |

---

*Documento criado: 2026-07-11, para implementação imediata*
