# Plano de Implementação — Monetização Shiten CLI

**Status:** Planeado
**Updated_at:** 2026-07-14T04:51:44.937Z
**Date:** 2026-07-14
**Data:** 2026-07-13
**Referência:** `PLANO-MONETIZACAO-SHITEN.md`

---

## Visão Geral

Adicionar um sistema de licenciamento ao Shiten CLI que suporte dois tiers: **Free** (motor de tração) e **Pro** (features avançadas). O sistema usa JWT assinado com Ed25519, validado localmente pelo CLI, sem necessidade de conexão à rede para verificar a licença.

## Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│                     CLI (shiten)                         │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ license.ts  │  │ cli-middleware│  │ commands/*    │  │
│  │ (validação) │  │ (refresh)    │  │ (gates)       │  │
│  └──────┬──────┘  └──────┬───────┘  └───────┬───────┘  │
│         │                │                  │           │
│         ▼                ▼                  ▼           │
│  ┌─────────────────────────────────────────────────┐   │
│  │           ~/.shiten/license.token                │   │
│  │           ~/.shiten/license.key                  │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              Cloudflare Worker (shiten-license)          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ /activate    │  │ /refresh     │  │ Stripe API   │  │
│  │ (POST)       │  │ (GET)        │  │ (subscriptions│ │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## Fases de Implementação

### Fase 1: Módulo de Licença (Core)

**Ficheiro novo: `src/license.ts`**

- Implementar `getLicense()` — lê e valida JWT de `~/.shiten/license.token`
- Implementar `hasFeature(feature)` — verifica se feature está desbloqueada
- Implementar `maybeRefresh()` — renova token se perto de expirar (< 5 dias)
- Implementar `saveToken(token)` e `saveLicenseKey(key)` — persiste localmente
- Chave pública Ed25519 embutida no código (público, seguro)
- `maybeRefresh()` nunca lança erro nem bloqueia (fail silent)

**Dependência nova: `jose`** (para JWT/Ed25519)

- Adicionar `jose` ao `package.json` em `dependencies`
- `jose` roda tanto no Node quanto no Cloudflare Workers

- [ ] Criar `src/license.ts`
- [ ] Adicionar `jose` ao `package.json`
- [ ] Criar `src/__tests__/license.test.ts`

---

### Fase 2: Integração com Middleware

**Ficheiro modificar: `src/cli-middleware.ts`**

- Adicionar `import { maybeRefresh } from "./license.js"`
- No hook `preAction`, adicionar chamada `maybeRefresh().catch(() => {})`
- Renovação em background, sem bloquear o comando actual

- [ ] Modificar `src/cli-middleware.ts`

---

### Fase 3: Comando `shiten license`

**Ficheiro novo: `src/commands/license.ts`**

- Subcomando `activate <key>` — activa licença
- Subcomando `status` — mostra estado actual da licença
- Subcomando `deactivate` — remove licença local
- Formato: `shiten license activate <licenseKey>`

**Ficheiro modificar: `bin/shiten.ts`**

- Importar e registar `licenseCommand`
- Adicionar `licenseCommand` ao programa Commander

- [ ] Criar `src/commands/license.ts`
- [ ] Modificar `bin/shiten.ts`

---

### Fase 4: Gates nos Comandos Pagos

**Padrão a replicar em cada comando pago:**

```typescript
import { hasFeature } from "../license.js";
import { outputWarning, output } from "../output.js";

// No início da action, após guardNotInitialized:
const unlocked = await hasFeature("feature-name");
if (!unlocked) {
  outputWarning("Este recurso é exclusivo do plano Pro.");
  output("Ative em: https://SEU-SITE.com/pricing");
  return;
}
```

**Comandos que precisam de gate:**

| Comando | Feature | Ficheiro | Estado |
|---------|---------|----------|--------|
| `handbook` | `handbook` | `src/commands/handbook.ts` | [ ] Pendente |
| `dashboard` | `dashboard` | `src/commands/dashboard.tsx` | [ ] Pendente |
| `profile` | `profile` | `src/commands/profile.ts` | [ ] Pendente |
| `goal` | `plan-engine` | `src/commands/goal.ts` | [ ] Pendente |
| `decide` | `plan-engine` | `src/commands/decide.ts` | [ ] Pendente |
| `policy` | `plan-engine` | `src/commands/policy.ts` | [ ] Pendente |
| `act` | `plan-engine` | `src/commands/act.ts` | [ ] Pendente |
| `plan` | `plan-engine` | `src/commands/plan.ts` | [ ] Pendente |
| `report` | `report` | `src/commands/report.ts` | [ ] Pendente |
| `digest` | `report` | `src/commands/digest.ts` | [ ] Pendente |
| `briefing` | `briefing` | `src/commands/briefing.ts` | [ ] Pendente |

**Detectores avançados (gate granular):**

| Comando | Detector | Feature | Ficheiro | Estado |
|---------|----------|---------|----------|--------|
| `detect` | pattern-detector | `advanced-detectors` | `src/commands/detect.ts` | [ ] Pendente |
| `context` | trend-engine | `advanced-detectors` | `src/commands/context.ts` | [ ] Pendente |
| `run` | pattern-detector | `advanced-detectors` | `src/commands/run.ts` | [ ] Pendente |

---

### Fase 5: Testes

**Ficheiro novo: `src/__tests__/license.test.ts`**

- Testar `getLicense()` sem token (retorna free)
- Testar `getLicense()` com token válido
- Testar `getLicense()` com token expirado (retorna free)
- Testar `hasFeature()` com tier free (sempre false)
- Testar `hasFeature()` com tier pro e feature presente
- Testar `hasFeature()` com tier pro e feature ausente
- Testar `saveToken()` e `saveLicenseKey()`

**Ficheiro novo: `src/__tests__/license-gate.test.ts`**

- Testar que cada comando pago retorna mensagem de bloqueio quando free
- Testar que cada comando pago executa quando pro

- [ ] Criar `src/__tests__/license.test.ts`
- [ ] Criar `src/__tests__/license-gate.test.ts`

---

### Fase 6: Documentação

**Ficheiros a actualizar:**
- `README.md` — adicionar secção sobre licenciamento
- `docs/handbook/02-commands/` — adicionar `license.md`
- `docs/reference/cli.md` — adicionar comando `license`

- [ ] Actualizar `README.md`
- [ ] Criar `docs/handbook/02-commands/license.md`
- [ ] Actualizar `docs/reference/cli.md`

---

## Ordem de Execução

1. `src/license.ts` + `package.json` (jose)
2. `src/cli-middleware.ts` (refresh)
3. `src/commands/license.ts` + `bin/shiten.ts` (comando)
4. Gates nos comandos pagos (um por um)
5. Testes
6. Documentação
7. Build + lint + typecheck

---

## Decisões em Aberto

- **Preço do Pro**: $9/mês (sugestão do plano)
- **Domínio do Worker**: `shiten-license.SEU-SUBDOMINIO.workers.dev`
- **Payment Link**: Stripe gera pronto, sem código
- **Página de ativação**: HTML estática (Cloudflare Pages ou GitHub Pages)

---

## Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Token expirado sem internet | `maybeRefresh()` falha silenciosamente, CLI continua com token antigo |
| Chave privada no repositório | Chave pública no código, privada só no Worker via `wrangler secret` |
| Worker fora do ar | CLI nunca bloqueia por falha de rede |
| Usuário sem Stripe | Worker consulta Stripe ao vivo, sem webhook necessário |

---

## Checklists de Conclusão

Nenhum item pode ser marcado como [x] sem:
1. Actualização da documentação
2. Actualização do backlog
3. Validação dos critérios
4. Registo da decisão
