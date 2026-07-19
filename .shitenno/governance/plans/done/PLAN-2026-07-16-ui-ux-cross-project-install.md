# Plano de Ação — UI/UX para Instalação Cross-Project (Correção Arquitetural)

**Status:** done

**Data:** 2026-07-16
**Substitui:** PLAN-2026-07-16-ui-ux-competitive-strategy.md — mesma estratégia geral (adotar motor real em vez de reinventar), mas corrige uma premissa errada: eu tinha desenhado a integração assumindo que o Shitenno só audita a si mesmo. Ele é instalado em projetos de terceiros — a arquitetura muda.

## O que estava errado no plano anterior

1. **`eslint` é `devDependency` do shitenno-go, não `dependency`.** Quando alguém instala o pacote no próprio projeto, `npm install` não traz devDependencies do pacote — só `dependencies`. `detectLintIssues` hoje só funciona por acidente, quando o projeto-alvo já tem ESLint configurado sozinho (o guard `if (!eslintConfigs.some(...)) return issues` mostra que isso já era uma limitação conhecida, silenciosamente aceita).
2. **Meu Fase 1 anterior editava `eslint.config.js` do próprio shitenno-go** — isso só afeta a auto-auditoria. Um projeto-alvo tem o `eslint.config.js` **dele**, que o Shitenno não controla e não deve tentar sobrescrever.
3. **`detectComponentStatePatternGap` e parte de `detectDesignTokenDrift` codificam convenções específicas do dashboard do próprio Shitenno** (Tailwind `@theme`, padrão de loading/error/empty do produto Shitenno) — isso é ruído, não sinal, num projeto-alvo que usa outro design system ou outra convenção de produto.

---

## Princípio de Design Corrigido

**O Shitenno precisa carregar seu próprio motor de verificação, independente do que o projeto-alvo tem instalado ou configurado — e os detectores próprios precisam se declarar host-safe ou Shitenno-only explicitamente, não ficar implícito.**

```
1. eslint + eslint-plugin-jsx-a11y viram DEPENDENCIES reais do shitenno-go
   (não devDependencies) — para estarem disponíveis em qualquer projeto que instale o pacote

2. O motor roda via API programática do ESLint (new ESLint({...}) com config
   embutida no Shitenno), NÃO via "npx eslint" shellado esperando que o host
   tenha isso configurado

3. Detectores próprios ganham uma flag explícita: HOST_SAFE (roda em qualquer
   projeto) vs SHITENNO_SELF_ONLY (só roda quando o shitenDir é o próprio
   repositório do Shitenno) — e o segundo grupo NUNCA roda por padrão fora dali
```

---

## FASE 1: Tornar `eslint` + `eslint-plugin-jsx-a11y` Dependencies Reais (0.5 dia)

**Ficheiro:** `package.json`
```json
{
  "dependencies": {
    "eslint": "^10.6.0",
    "eslint-plugin-jsx-a11y": "^6.10.0"
  }
}
```
Remover de `devDependencies` se estiver duplicado lá. **Isso aumenta o peso do pacote instalado** — trade-off real, não escondido: quem instala shitenno-go passa a carregar o ESLint e o jsx-a11y juntos, mesmo que não use nada de UI. Vale considerar isso como uma dependência opcional (`optionalDependencies`) se o peso for uma preocupação real, carregada via `import()` dinâmico só quando o detector de a11y for de fato acionado (ver Fase 2) — recomendo essa abordagem para não penalizar projetos sem JSX.

```json
{
  "optionalDependencies": {
    "eslint": "^10.6.0",
    "eslint-plugin-jsx-a11y": "^6.10.0"
  }
}
```

**Critério de aceite:** simular instalação como dependência (`npm pack` do shitenno-go + `npm install <tarball>` num projeto de teste vazio) e confirmar que `eslint`/`eslint-plugin-jsx-a11y` aparecem em `node_modules` do projeto-alvo.

---

## FASE 2: Motor de A11y Bundled, Independente da Config do Host (1.5 dias)

**Ficheiro:** `src/audit/a11y-engine.ts` (novo)

```typescript
import type { HealthIssue, SourceFileInfo } from "./types.js";

let eslintModule: typeof import("eslint") | null = null;
let jsxA11yModule: unknown = null;

async function loadA11yEngine(): Promise<boolean> {
  try {
    eslintModule = await import("eslint");
    const mod = await import("eslint-plugin-jsx-a11y");
    jsxA11yModule = mod.default ?? mod;
    return true;
  } catch {
    // optionalDependency não instalada (ex.: usuário rodou com --no-optional,
    // ou ambiente restrito) — degradar graciosamente, não quebrar o audit inteiro
    return false;
  }
}

export async function detectAccessibilityGaps(_projectRoot: string, files: SourceFileInfo[]): Promise<HealthIssue[]> {
  const jsxFiles = files.filter((f) => /\.(tsx|jsx)$/.test(f.relPath));
  if (jsxFiles.length === 0) return []; // projeto-alvo não usa JSX — nada a fazer, sem ruído

  const loaded = await loadA11yEngine();
  if (!loaded || !eslintModule) {
    return [{
      type: "accessibility_gap",
      severity: 1,
      description: "Verificação de acessibilidade JSX pulada — dependência opcional eslint-plugin-jsx-a11y não disponível",
      location: "package.json",
      recommendation: "Rodar 'npm install' novamente ou verificar se optionalDependencies foram instaladas",
      confidence: 1.0,
    }];
  }

  const { ESLint } = eslintModule;
  const eslint = new ESLint({
    // CRÍTICO: ignora qualquer eslint.config.js do projeto-alvo — usamos
    // sempre a config embutida do Shitenno, para não depender do que o
    // host tem (ou não tem) configurado
    overrideConfigFile: true,
    baseConfig: {
      plugins: { "jsx-a11y": jsxA11yModule },
      rules: (jsxA11yModule as { configs: { recommended: { rules: Record<string, unknown> } } }).configs.recommended.rules,
      languageOptions: { parserOptions: { ecmaFeatures: { jsx: true }, ecmaVersion: 2022, sourceType: "module" } },
    },
  } as never);

  const issues: HealthIssue[] = [];
  for (const file of jsxFiles) {
    try {
      const results = await eslint.lintText(file.content, { filePath: file.absPath });
      for (const result of results) {
        for (const msg of result.messages) {
          if (msg.ruleId?.startsWith("jsx-a11y/")) {
            issues.push({
              type: "accessibility_gap",
              severity: msg.severity === 2 ? 2 : 1,
              description: `[${msg.ruleId}] ${msg.message}`,
              location: `${file.relPath}:${msg.line}`,
              recommendation: `https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/${msg.ruleId.replace("jsx-a11y/", "")}.md`,
              confidence: 0.95,
            });
          }
        }
      }
    } catch {
      // um arquivo JSX malformado não deve derrubar a checagem dos outros —
      // segue o princípio de isolamento de falha já estabelecido no plano
      // de endurecimento do audit tool
      continue;
    }
  }
  return issues;
}
```

**Diferenças-chave em relação ao plano anterior:**
- `overrideConfigFile: true` + `baseConfig` embutido — **não lê `eslint.config.js` do projeto-alvo**, nunca depende do host ter configurado nada
- `import()` dinâmico + retorno gracioso se a dependência opcional não estiver presente — nunca quebra o audit inteiro por falta dela
- `lintText` direto no conteúdo já coletado por `SourceFileInfo`, sem `execSync`/`npx` — elimina a dependência de resolução de binário via PATH, que é frágil entre ambientes

**Critério de aceite:** rodar o audit num projeto de teste separado (não o shitenno-go), com componentes React contendo violações conhecidas de `jsx-a11y` (ex.: `<img>` sem alt, `<div onClick>` sem role) — os achados aparecem corretamente, **sem que esse projeto de teste tenha ESLint configurado**.

---

## FASE 3: Reclassificar os Detectores Próprios — Host-Safe vs Shitenno-Only (1 dia)

**Ficheiro:** `src/audit/frontend-detector-scope.ts` (novo)
```typescript
export type FrontendDetectorScope = "host-safe" | "shitenno-self-only";

export const FRONTEND_DETECTOR_SCOPE: Record<string, FrontendDetectorScope> = {
  detectHardcodedDesignValues: "host-safe", // hex fora de tema, valores arbitrários — genérico o suficiente pra qualquer projeto com CSS/Tailwind
  detectDesignTokenDrift: "host-safe",       // token CSS custom property não usado — é um padrão de `--var:` genérico, não específico de framework
  detectComponentStatePatternGap: "shitenno-self-only", // convenção de PRODUTO do Shitenno, não uma prática universal
};
```

**Ficheiro:** `src/health-auditor.ts` — checagem antes de rodar detectores frontend
```typescript
import { FRONTEND_DETECTOR_SCOPE } from "./audit/frontend-detector-scope.js";

const isAuditingShitennoItself = projectRoot.includes("shitenno-go"); // heurística simples — refinar se necessário, ex. checar package.json name === "shitenno-go"

for (const [name, fn] of Object.entries(detectorMap)) {
  if (!activeDetectors.has(name)) continue;
  const scope = FRONTEND_DETECTOR_SCOPE[name];
  if (scope === "shitenno-self-only" && !isAuditingShitennoItself) continue; // pula silenciosamente, sem ruído no relatório do host
  // ...try/catch de execução, já existente...
}
```

**Nota para o agente:** a heurística `projectRoot.includes("shitenno-go")` é frágil (funciona hoje, mas quebra se o repositório for renomeado ou clonado com outro nome de pasta). Uma alternativa mais robusta é checar `package.json.name === "shitenno-go"` do projeto sendo auditado — usar isso em vez do path, se o tempo permitir.

**Critério de aceite:** rodar `shiten audit` num projeto de teste que não é o shitenno-go — `detectComponentStatePatternGap` nunca aparece nos achados, mesmo que o projeto tenha componentes com fetch assíncrono sem tratamento de loading/error. Rodar dentro do próprio shitenno-go — ele aparece normalmente.

---

## Resultado: O que Muda na Prática

| Detector | Antes desta correção | Depois |
|---|---|---|
| Acessibilidade (`jsx-a11y`) | Só funcionava se o host já tivesse ESLint+jsx-a11y configurados sozinho | Funciona em qualquer projeto React/JSX, sem pré-requisito — motor embutido no Shitenno |
| `detectHardcodedDesignValues` | Já era genérico o suficiente, mantido | Mantido, confirmado host-safe |
| `detectDesignTokenDrift` | Já era genérico o suficiente, mantido | Mantido, confirmado host-safe |
| `detectComponentStatePatternGap` | Rodaria como ruído em qualquer projeto instalado | Restrito a auto-auditoria do próprio shitenno-go |

## Limitação Honesta, Não Escondida

Isso cobre **projetos React/JSX**. Vue, Svelte, Angular, ou HTML puro não ganham nada da Fase 2 — `jsx-a11y` é específico de JSX. Se "outros projetos" no seu plano incluir stacks fora de React, isso precisa de um motor equivalente por framework (`eslint-plugin-vuejs-accessibility` pra Vue, por exemplo) — não incluí isso agora porque não sei se há demanda real para além de React; adicionar antecipadamente sem um caso concreto seria o mesmo erro de escopo que já evitamos no plano original ("colocar tudo").

---

## Sequenciamento

```
DIA 1 (manhã):  Fase 1 (dependencies reais, optionalDependencies)
DIA 1-2.5:      Fase 2 (motor de a11y bundled e independente do host)
DIA 3:          Fase 3 (host-safe vs shitenno-self-only)
```

**Total: ~3 dias.**
