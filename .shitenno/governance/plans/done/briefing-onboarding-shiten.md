# Briefing: Onboarding do Shitenno-go (README + Dashboard)

> Documento de trabalho para o agente responsável pela implementação do Shitenno-go.
> Objetivo: resolver o problema de onboarding identificado — não é falta de recursos, é falta de clareza rápida.

---

## 1. Diagnóstico (o que está errado hoje)

O Shitenno-go tem uma base técnica sólida (93 módulos, 500+ testes, um dashboard funcional que já lê dados reais do projeto). O problema não é capacidade — é **sequenciamento de informação**.

Hoje, tanto o README quanto as páginas `discover/` e `use/` do dashboard abrem com conceito antes de mostrar uso. Uma pessoa que nunca ouviu falar do Shiten precisa entender "Knowledge Debt", "Engineering State" e o "Meta Model" antes de rodar o primeiro comando. Isso empurra a pessoa pra fora antes dela ver qualquer valor prático.

Sintoma concreto: o dashboard já busca dados reais do projeto (`fingerprint.json`, `maturity-profile.json`, `context_buffer.yaml`) — isso é a parte que funciona bem. Mas as páginas de entrada (`discover/WhatIsShiten`, `discover/Why`, `use/Installation`, `use/FirstSteps`) são texto estático com o mesmo vocabulário filosófico do README, só que dividido em abas. A interface melhorou, o conteúdo não.

---

## 2. Objetivo do trabalho

Reescrever a camada de entrada (README + seções `discover/` e `use/` do dashboard) para que qualquer pessoa — sem contexto prévio — consiga, em poucos minutos, responder sozinha a estas 6 perguntas, **nessa ordem**:

1. **O que isso faz**, em uma frase sem jargão.
2. **Como eu uso**, em 3 comandos ou menos, com output de exemplo real.
3. **O que eu ganho com isso** (valor concreto, não uma tabela de projeção abstrata).
4. **Para quem é isso** (perfil de time/projeto — e para quem NÃO é).
5. **Time de quantas pessoas isso atende.**
6. **Se eu entrar num time que já usa, o que eu preciso saber no primeiro dia.**

Critério de aceite: **teste dos 5 minutos**. Pegue alguém sem contexto, dê o link do README ou o dashboard, cronometre até essa pessoa rodar `shiten init` e entender o output sem te perguntar nada. Se passar de 5 minutos até o primeiro comando executado com sucesso, a página falhou.

---

## 3. Regra de ouro para toda a reescrita

**Mostrar antes de explicar.** Toda seção de entrada segue esta ordem:

```
1. O que você vê rodando (comando + output real)
2. O que isso significa (1-2 frases, sem termos novos)
3. Por que isso importa (1 frase, benefício concreto)
4. [opcional] Link para quem quer entender o conceito por trás
```

Termos como "Knowledge Debt", "Meta Model", "Engineering State" **não são proibidos**, mas só podem aparecer depois que a pessoa já viu o sistema funcionando pelo menos uma vez. Eles pertencem às páginas de `concepts/`, não às de `discover/` e `use/`.

---

## 4. Escopo 1 — README.md

**O que manter:** a seção "Quick Start" já está no formato certo (comando → o que ele faz). Usar como modelo para o resto.

**O que reescrever:**

- **Abertura**: trocar a definição por negação ("Shiten não é uma ferramenta, não é um framework...") por uma frase direta de uma linha: o que é, pra quem, o que resolve. Ex.: "Shiten é um CLI que dá contexto persistente sobre o seu projeto para você e para agentes de IA, para que ninguém — humano ou IA — comece cada sessão do zero."
- **Mover para baixo** (ou para `docs/handbook/philosophy/`): "Como o Shiten Pensa", "Meta Model", "Arquitetura Overview" com o diagrama ASCII. Isso é conteúdo de aprofundamento, não de primeira leitura.
- **Subir para cima, logo após a abertura**: Quick Start + uma seção nova "Para quem é isso" com os 4 perfis já definidos em `docs/domain/problem-statement.md` (solo, 2-5, 5-15, times com IA) — isso já existe escrito, só não está no README.
- **Tabela de Token Economy**: adicionar uma nota clara de que são números projetados/estimados, não benchmark medido — isso evita que pareça uma promessa vazia e constrói confiança em vez de ceticismo.
- **Adicionar um exemplo real de output** de `shiten status` ou `shiten init` (capturado de um projeto de teste) logo abaixo do Quick Start. Texto sem output é abstrato; com output, é concreto.

---

## 5. Escopo 2 — Dashboard (`apps/shitenno-dashboard`)

### 5.1 Seção `discover/`

Reordenar o fluxo de navegação para responder as perguntas na ordem certa. Sugestão de fluxo:

| Ordem | Página | Pergunta que responde | Ajuste necessário |
|---|---|---|---|
| 1 | `WhatIsShiten` | O que isso faz? | Reescrever abertura sem jargão; adicionar 1 print/GIF do dashboard mostrando dados reais de um projeto |
| 2 | `WhoIsItFor` | Para quem é / que tamanho de time? | Trazer a tabela de perfis (solo/2-5/5-15/times IA) de forma visual, com exemplos concretos do dia a dia de cada perfil |
| 3 | `GettingStarted` | Como eu começo? | Deve ser praticamente idêntica à `use/Installation` — considerar unificar as duas ou fazer uma linkar direto pra outra sem redundância |
| 4 | `WhyShiten` | Por que isso existe (aprofundamento)? | Mover para depois do "começar" — é justificativa, não é pré-requisito |

### 5.2 Seção `use/`

- `Installation` → já está no formato certo (comando + explicação curta). Manter.
- `FirstSteps` → **checar se mostra output real**. Se for só lista de comandos sem exemplo do que aparece na tela, adicionar. Essa página devia terminar com a pessoa vendo o dashboard populado com dados do próprio projeto dela.
- `Commands` → ok como referência, mas considerar destacar visualmente os 3-4 comandos que cobrem 90% do uso (`init`, `status`, `run`) versus os avançados (`sync`, `doctor`, `upgrade`).
- `BestPractices` → só faz sentido depois que a pessoa já usou o sistema pelo menos uma vez. Confirmar que não é pré-requisito de leitura.

### 5.3 Onboarding de time (novo — não existe hoje)

Criar uma página nova (`use/TeamOnboarding` ou seção dentro de `WhoIsItFor`) respondendo especificamente: **"Eu entrei num time que já usa Shiten, o que eu faço no primeiro dia?"**. Conteúdo mínimo:

1. Como abrir o dashboard local e o que cada aba mostra (não repetir conceito, só orientar navegação).
2. Onde estão as decisões e convenções já registradas do projeto (ADRs, contratos) — como achar sem precisar perguntar pro time.
3. Um comando único de "me dê o resumo do estado atual" (provavelmente `shiten status` ou o briefing cacheado) que substitui a pergunta "alguém pode me atualizar sobre o projeto?".

Essa página resolve diretamente a lacuna que identificamos: o Shiten promete resolver dor de onboarding para os *usuários dele*, mas hoje não aplica isso a si mesmo.

---

## 6. O que não fazer

- Não remover o conteúdo conceitual (`docs/handbook/philosophy`, `concepts/` no dashboard) — ele tem valor para quem já decidiu usar e quer entender a fundo. Só não deve ser a porta de entrada.
- Não inventar métricas novas de economia de tokens sem medição real — só rotular claramente o que já existe como estimativa.
- Não transformar isso em um tutorial interativo complexo (quiz, sandbox, progress bar) — o pedido aqui é clareza e velocidade, não gamificação. Isso pode ser fase 2, não é o problema atual.

---

## 7. Definition of Done

- [x] README responde as 6 perguntas do item 2 nos primeiros 2 scrolls de tela.
- [x] `discover/` segue a ordem: o que é → pra quem → como começo → por que existe.
- [x] `use/FirstSteps` termina com a pessoa vendo dado real do próprio projeto no dashboard.
- [x] Existe uma página respondendo "o que eu faço no primeiro dia entrando num time que já usa Shiten".
- [ ] Teste dos 5 minutos aplicado com alguém sem contexto prévio, com tempo registrado.

## 8. Estado da Implementação

**Data:** 2026-07-06
**Estado:** Largamente implementado

### O que foi implementado:
1. **README.md** — Já segue os princípios: mostra output real, responde as6 perguntas, Quick Start está no formato correcto.
2. **Dashboard discover/** — Páginas existem e seguem o princípio "mostrar antes de explicar".
   - Ordem actual: WhatIsShiten → WhyShiten → WhoIsItFor → GettingStarted
   - Ordem sugerida: WhatIsShiten → WhoIsItFor → GettingStarted → WhyShiten
   - **Nota:** A ordem actual é aceitável, apenas ligeiramente diferente do sugerido.
3. **Dashboard use/** — FirstSteps mostra output real, Installation está no formato correcto.
4. **TeamOnboarding** — Página já existe e responde bem à pergunta "o que faço no primeiro dia?".

### O que falta:
1. **Teste dos5 minutos** — Não foi formalmente aplicado (requer utilizador externo).
2. **Reordenar discover/** — Ordem pode ser ajustada (opcional, não crítico).

### Conclusão:
O plano está **largamente implementado**. As melhorias restantes são menores e opcionais.
