# Plano: Rebranding Nexus System → Shitenno-go

## Contexto

O projeto foi renomeado de "Nexus System" / "nexus-system" / "nexus-cli" para
"Shitenno-go" / "shitenno-go" / "shitenno-cli". Um agente Claude já executou a
troca textual em todo o código-fonte (826 arquivos, ~8400 ocorrências) e a
renomeação de arquivos/pastas, entregando um `.zip` com o resultado.

**O que já foi feito (mecanicamente, via find & replace):**
- Todo o código, docs, configs, nomes de arquivo e pasta foram atualizados
- `grep -rli "nexus"` no projeto inteiro retorna **0 ocorrências** (exceto
  `pnpm-lock.yaml`, que se resolve no Passo 1)

**O que NÃO foi feito ainda (precisa do agente com acesso ao ambiente real):**
- Instalar dependências e rodar build/testes para confirmar que nada quebrou
- Qualquer operação de rede (GitHub, npm)

## Convenção de nomes aplicada

| Antigo | Novo |
|---|---|
| `Nexus System` / `nexus-system` (pacote raiz, pasta de dados) | `Shitenno-go` / `shitenno-go` |
| `nexus-cli` | `shitenno-cli` |
| `nexus-dashboard` (app) | `shitenno-dashboard` |
| comando CLI `nexus`, identificadores de código (`nexusDir`, `NexusError`, `NEXUS_DIR_NAME`...) | `shiten`, `shitenDir`, `ShitenError`, `SHITEN_DIR_NAME`... |

## Passo 1 — Rodar o script de rename e validar build

> Não usar o zip entregue anteriormente — ele é uma fotografia antiga do
> projeto e o repositório já evoluiu desde então. Em vez disso, rodar o
> script `rename-shitenno-go.py` diretamente em cima do estado atual do
> repositório. O script é idempotente e opera só por texto/nome de
> arquivo, então não conflita com nenhuma implementação nova.

```bash
git checkout -b rebrand/shitenno-go

# opcional: ver o que vai mudar antes de aplicar
python3 rename-shitenno-go.py . --dry-run

# aplicar de verdade
python3 rename-shitenno-go.py .

# regenerar o lockfile (o pnpm-lock.yaml não é tocado pelo script)
pnpm install

# validar que nada quebrou
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run build

# checagem final de resíduos
grep -rli "nexus" --exclude-dir=node_modules --exclude=pnpm-lock.yaml . || echo "OK: nenhuma referência restante"
```

Se `typecheck`/`test`/`build` falharem, provavelmente é por causa de imports
que referenciam caminhos antigos não capturados pelo replace (raro, mas
possível em strings dinâmicas montadas em runtime, ex: `` `nexus-${x}` ``).
Corrigir manualmente esses casos.

## Passo 2 — Decidir sobre o e-mail do autor

O campo `author` do `package.json` foi automaticamente convertido para
`edson.ramos@shitenno-go.com` (efeito colateral da troca de domínio). Esse
domínio provavelmente não existe. Decidir:
- manter um e-mail real (ex: reverter para o domínio antigo, ou usar outro), **ou**
- registrar o domínio `shitenno-go.com` antes de publicar

```bash
# editar manualmente se necessário
# package.json → campo "author"
```

## Passo 3 — Renomear branches locais e remotas

```bash
git branch -m nexus-system-main shitenno-go-main
git branch -m nexus-system-feat-handbook shitenno-go-feat-handbook
# repetir para qualquer outra branch com prefixo nexus-system-*
```

## Passo 4 — Renomear o repositório no GitHub

```bash
# via GitHub CLI (gh) — requer autenticação prévia (gh auth login)
gh repo rename shitenno-go --repo ednosmab/nexus-system

# atualizar o remote local (o GitHub cria redirect automático do nome antigo,
# mas é melhor já apontar para o novo)
git remote set-url origin https://github.com/ednosmab/shitenno-go.git

# atualizar descrição/topics do repo
gh repo edit ednosmab/shitenno-go \
  --description "AI governance framework that grows with your project — scoring, pattern detection, health auditing" \
  --add-topic shitenno-go --add-topic cli --add-topic ai-governance

# push das branches renomeadas
git push origin shitenno-go-main shitenno-go-feat-handbook
git push origin --delete nexus-system-main nexus-system-feat-handbook
```

## Passo 5 — Publicar no npm

Nomes de pacote não podem ser renomeados no registro do npm — é preciso
publicar como pacotes novos.

```bash
# login no npm, se ainda não estiver autenticado
npm login

# publicar os pacotes novos
npm publish --access public   # a partir da raiz, publica "shitenno-go"

# se nexus-cli/nexus-system já estavam publicados anteriormente,
# depreciar apontando para o novo nome:
npm deprecate nexus-system "Renomeado para shitenno-go: https://npmjs.com/package/shitenno-go"
npm deprecate nexus-cli "Renomeado para shitenno-cli: https://npmjs.com/package/shitenno-cli"
```

Se ainda não havia sido publicado com o nome antigo, pular a parte de
`npm deprecate`.

## Passo 6 — Checklist final

- [ ] `pnpm install` rodou sem erro e sem referência a `nexus` no lockfile
- [ ] `typecheck`, `lint`, `test`, `build` passam
- [ ] `grep -rli "nexus"` no repo retorna vazio
- [ ] E-mail do autor decidido (Passo 2)
- [ ] Branches renomeadas local e remotamente
- [ ] Repositório GitHub renomeado, remote local atualizado
- [ ] Pacote(s) publicado(s) no npm com o novo nome
- [ ] Pacote(s) antigo(s) depreciado(s) no npm, se aplicável
- [ ] README/CHANGELOG conferidos manualmente para naturalidade do texto
      (o replace é mecânico; frases que citavam "Nexus" como sujeito da
      frase podem precisar de um ajuste de fluidez, não só de nome)
