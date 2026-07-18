# PLAN-2026-07-17 — Consolidação Arquitetural para Produtização Multi-Projeto (Complementar: Higiene de Git para Instâncias Solo Assíncronas)

**Status:** pending
**Date:** 2026-07-17
**Updated_at:** 2026-07-17T00:00:00.000Z
**Priority:** P0
**Owner:** AI Agent
**Estimated Time:** 1-2 dias
**Depende de:** PLAN-2026-07-17-consolidacao-produtizacao-multi-projeto.md (substitui a antiga "Fase 4 — validação multi-projeto" na parte referente a compartilhamento de repositório)

---


## Checklist

- [ ] Passo 1 — Ignorar checkpoints de sessão
- [ ] Passo 2 — Converter `relations.json` e `artifacts.json` para arquivo-por-entrada
- [ ] Passo 3 — Aplicar o mesmo tratamento a `audit-suppressions.json`
- [ ] Passo 4 — Documentar o modelo de uso

## Contexto

Correção de modelo mental em relação ao plano anterior: o uso-alvo **não é colaboração simultânea em equipe** (múltiplos agentes escrevendo no mesmo estado ao mesmo tempo, exigindo lock ou coordenação). É **instalação solo por usuário**, onde cada dev roda sua própria instância local do Shiten — mas o mesmo repositório Git pode ser clonado por vários integrantes de um time, cada um trabalhando de forma isolada, e o histórico do Git é o único ponto de encontro entre essas instâncias (via commit/push/pull/merge, de forma assíncrona).

Isso é um problema mais barato de resolver do que concorrência real: não precisa de servidor de coordenação, lock distribuído ou sincronização em tempo real. Precisa apenas que os arquivos versionados sejam **seguros para merge assíncrono do Git** — ou não sejam versionados de jeito nenhum, se forem estado puramente local.

**Diagnóstico confirmado no código:**

O projeto já segue essa disciplina para a maior parte do estado mutável — `.gitignore` já exclui `engineering-state.json`, `fingerprint.json`, `capability-engine.json`, `maturity-profile.json`, `answers.json` e todo o diretório `daemon/`, com comentários explícitos: *"derived/computable state, not human-editable"* e *"process-specific, never version"*. Isso é o padrão correto e já está bem aplicado na maior parte do sistema.

Duas exceções encontradas, que quebram essa disciplina:

1. **`shitenno-go/governance/context/checkpoints/*.yaml` não está no `.gitignore`.** Em uma sessão de trabalho local de ~5 horas, o sistema gerou **48 arquivos de checkpoint**. Se commitados, cada dev do time gera dezenas de arquivos de snapshot de sessão por dia — isso não é estado de projeto compartilhável, é estado de sessão individual, e polui o histórico de commits de todo o time a cada `git pull`.

2. **`shitenno-go/governance/knowledge-graph/relations.json` (mutável, cresce por append) e `artifacts.json` (715 linhas) são arquivos JSON únicos, versionados.** Ao contrário de `governance/rules/RULE-018.json` (um arquivo por regra — Git resolve isso de graça, arquivo novo não gera conflito), estes dois são um blob único por conceito. Dois devs trabalhando isolados, cada um adicionando entradas localmente, geram conflito de merge real em JSON no primeiro `git pull` depois de ambos commitarem — e resolver conflito de merge em array JSON manualmente é o tipo de fricção que os usuários vão reportar como "o Shiten quebra quando uso em time", mesmo não sendo um problema de concorrência de verdade.

3. **`shitenno-go/audit-suppressions.json`** segue o mesmo padrão estrutural (JSON único mutável, versionado) — hoje vazio (`[]`), então sem incidente ainda, mas com o mesmo risco latente assim que passar a ser usado.

## Objetivo

Garantir que todo arquivo dentro de `governance/` versionado no Git seja **seguro para merge assíncrono entre instâncias solo independentes** — ou explicitamente movido para fora do controle de versão, se for estado de sessão local.

**Critérios de aceitação:**
1. `governance/context/checkpoints/` não é mais versionado.
2. `relations.json`, `artifacts.json` e `audit-suppressions.json` deixam de ser um único blob mutável — viram um arquivo por entrada (padrão já usado em `governance/rules/`) ou adotam um formato de log append-only naturalmente mesclável pelo Git (ex.: JSON Lines, uma entrada por linha).
3. Documentação (`docs/AGENTS.md` ou `governance/WORKFLOW.md`) passa a ter uma seção curta explicando o modelo: "instâncias solo, repositório compartilhado de forma assíncrona via Git — não há coordenação em tempo real entre devs".

---

## FASE ÚNICA — Higiene de Git

### Passo 1: Ignorar checkpoints de sessão
**Ficheiro:** `.gitignore`

**Ação:**
```diff
 # Shitenno-go — daemon runtime state (process-specific, never version)
 shitenno-go/daemon/

+# Shitenno-go — checkpoints de sessão (estado local, não deve ser compartilhado entre devs)
+shitenno-go/governance/context/checkpoints/
+shitenno-go/governance/context/context_buffer.yaml
```
**Verificação:** `git status` depois de rodar uma sessão local não mostra novos arquivos em `checkpoints/`. Se o time já tem checkpoints commitados de antes desta mudança, rodar `git rm -r --cached shitenno-go/governance/context/checkpoints/` uma vez para limpar o histórico daqui pra frente (não reescreve histórico antigo, só para de rastrear).

### Passo 2: Converter `relations.json` e `artifacts.json` para arquivo-por-entrada
**Ficheiros:** `src/knowledge-graph.ts` (ou onde estiver a lógica de escrita — confirmar antes de editar), `shitenno-go/governance/knowledge-graph/`

**Ação:** trocar o padrão de "um array JSON, reescrito inteiro a cada nova relação/artefato" por um diretório com um arquivo por entrada, no mesmo espírito de `governance/rules/RULE-018.json`:
```
governance/knowledge-graph/
  relations/
    skill-architectural_integrity__contract-executor-v1.json
    skill-architectural_integrity__contract-orchestrator-v1.json
    ...
  artifacts/
    <id>.json
```
Cada arquivo novo = um commit sem conflito possível, porque dois devs criando relações diferentes nunca tocam no mesmo arquivo. Um índice (`relations/_index.json` ou geração em runtime via `readdirSync`) substitui a necessidade de um array central.

**Alternativa mais barata, se o volume não justificar o refactor completo:** manter um único arquivo, mas em formato **JSON Lines** (`relations.jsonl`, uma entrada JSON por linha, sempre com `\n` no fim). Git resolve merges de arquivos append-only linha-a-linha de forma automática na maioria dos casos (mesmo mecanismo que funciona bem para `CHANGELOG.md` ou logs). Menos trabalho que a estrutura por-arquivo, resolve boa parte do problema.

**Verificação:** simular dois clones locais do mesmo repo, cada um adicionando uma relação diferente, commitando em branches separadas, e dar merge — confirmar que não há conflito (ou, no caso do JSONL, que o conflito é trivial de resolver por não sobrescrever a mesma linha).

### Passo 3: Aplicar o mesmo tratamento a `audit-suppressions.json`
**Ficheiro:** `shitenno-go/audit-suppressions.json`

**Ação:** mesma decisão do Passo 2 — hoje está vazio, então é o momento mais barato para decidir o formato antes de haver dado real para migrar. Recomendo JSON Lines por ser mais simples e o volume esperado (supressões de audit) provavelmente não justifica arquivo-por-entrada.
**Verificação:** schema documentado antes do primeiro uso real, para não repetir o problema depois que já tiver conteúdo.

### Passo 4: Documentar o modelo de uso
**Ficheiro:** `shitenno-go/docs/AGENTS.md` ou `governance/WORKFLOW.md` (confirmar qual já é o ponto de referência para esse tipo de nota operacional)

**Ação:** adicionar uma seção curta:
> **Modelo de uso:** o Shiten roda como instância local, uma por desenvolvedor. Não há coordenação em tempo real entre instâncias — o repositório Git é o único ponto de sincronização, de forma assíncrona (commit/push/pull). Arquivos em `governance/` versionados devem ser seguros para merge assíncrono; estado de sessão individual (checkpoints, cache, daemon) nunca é versionado.

**Verificação:** revisão humana confirmando que a frase reflete a decisão de arquitetura e evita reintrodução do mesmo tipo de erro (ex.: alguém commitar um novo tipo de estado mutável centralizado sem passar por essa checklist).

---

## Decisões de Design

| # | Decisão | Alternativa rejeitada | Racional |
|---|---------|----------------------|----------|
| 1 | Tratar como problema de "higiene de merge assíncrono", não de "concorrência de equipe" | Desenhar locking/coordenação (o que a Fase 4 do plano anterior sugeria implicitamente) | O modelo real é solo-por-instância; qualquer solução de coordenação em tempo real seria overengineering para um problema que não existe |
| 2 | JSON Lines como alternativa mais barata ao arquivo-por-entrada | Sempre migrar para arquivo-por-entrada | Nem todo JSON mutável do projeto tem volume que justifique o refactor maior — usar o critério de custo/benefício por arquivo, não uma regra única para todos |
| 3 | Checkpoints nunca versionados, sem exceção | Versionar só os "checkpoints importantes" | Qualquer critério de "importância" exigiria julgamento manual toda sessão; mais simples e mais seguro excluir a pasta inteira, seguindo o padrão já adotado para `daemon/` e demais estado derivado |

## Riscos

| # | Risco | Impacto | Mitigação |
|---|-------|---------|-----------|
| 1 | Times que já têm checkpoints commitados em histórico real perdem esses dados ao rodar `git rm --cached` | Baixo | Checkpoints são estado derivado/reconstituível, não dado de negócio — perda é aceitável; comunicar antes de rodar em repositório real de terceiros |
| 2 | Migração de `relations.json`/`artifacts.json` para arquivo-por-entrada quebra código que hoje lê o array inteiro de uma vez | Médio | Mapear todos os pontos de leitura (`grep -rl "relations.json\|artifacts.json" src/`) antes de migrar; criar função de leitura agregada (`readAllRelations()`) que reconstrói o array a partir dos arquivos individuais, mantendo a mesma interface para os consumidores |
| 3 | JSON Lines não resolve 100% dos casos de conflito (duas entradas na mesma linha por coincidência de ordem de escrita) | Baixo | Aceitável — reduz drasticamente a frequência de conflito, não precisa ser perfeito; arquivo-por-entrada continua disponível para os casos de maior volume (Passo 2) |
