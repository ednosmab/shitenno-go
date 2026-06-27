# 🧹 SKILL: CODEBASE HYGIENE & GIT WORKFLOW

## 🎯 Objetivo
Manter a sanidade, segurança e manutenibilidade do código-fonte através de regras estritas de organização de arquivos e controle de versão.

## 🛡️ Higiene de Código e Segurança
1. **Segredos e Credenciais:** NUNCA versione chaves API, certificados `.pem` ou o arquivo `.env`. Certifique-se de que o `.gitignore` os bloqueia.
2. **Organização de Assets:** Centralize imagens e logotipos em diretórios únicos. Não duplique ícones.
3. **Código Morto:** Substituiu um componente local por um do Design System? Apague o antigo IMEDIATAMENTE.
4. **Documentação:** Mantenha os históricos limpos e nomes de diretórios semânticos (ex: `docs/skills/` em vez de `docs/misc/`).

## 🌿 Estrutura de Branches e Nomenclatura

| Branch | Ambiente | Propósito |
|--------|----------|-----------|
| `main` | Produção | Código estável e validado. NUNCA faça commit direto aqui. |
| `develop` | Staging | Branch de integração e testes automatizados de CI/CD. Espelho da main. |
| `feature/*`, `fix/*` | Local | Todo e qualquer desenvolvimento ocorre aqui. |

### Dicas Práticas para Nomes de Branches
Para manter o repositório organizado e alinhado aos padrões de mercado:
1. **Use hífen para separar palavras:** Prefira `feature/login-usuario` em vez de camelCase ou espaços (`feature/loginUsuario`).
2. **Seja curto e descritivo:** O nome deve resumir a funcionalidade ou erro (ex: `feature/checkout-cartao` ou `fix/botao-invisivel`).
3. **Use o ID da Tarefa (se houver):** Se estiver usando ferramentas como Jira, Trello ou GitHub Issues, inclua o número do card na branch para facilitar o rastreamento depois (ex: `feature/jira-104-login`).

## 🔄 Workflow Diário do Desenvolvedor (Ciclo Completo)

Para evitar conflitos, este é o ciclo prático que todo desenvolvedor (ou agente IA) vai seguir a cada nova funcionalidade:

**1. Atualize seu código local com a branch de integração (`develop`):**
```bash
git checkout develop
git pull origin develop
```

**2. Crie a sua branch de feature (com nomenclatura padronizada):**
```bash
git checkout -b feature/login-usuario
```

**3. Trabalhe no código, salve e faça o commit:**
```bash
git add .
git commit -m "feat(auth): implement student login screen"
```

**4. Envie para o servidor e acione o Pipeline:**
```bash
git push origin feature/login-usuario
```

## 📝 Padrão de Commits (Conventional Commits)
Sempre em INGLÊS e no formato: `type(scope): description`
- `feat`: Nova funcionalidade (`feat(auth): add google provider`)
- `fix`: Correção de bug (`fix(ui): fix button alignment`)
- `refactor`: Mudança que não adiciona feature nem corrige bug.
- `chore`: Atualização de pacotes, build, lint.
- `docs`: Apenas documentação.

## ✅ Checklist de Pull Request (ou Push)
- [ ] O código passa no linter (`eslint` ou comando equivalente do projeto).
- [ ] TypeScript compila sem erros.
- [ ] Não há `console.log` esquecidos (use logger adequado).
- [ ] Variáveis de ambiente novas foram adicionadas ao `.env.example`.
- [ ] A mensagem de commit segue o padrão exigido.
