# SESSION TEMPLATE — Ritual de Fim de Sessão

> Executar este checklist antes de declarar sessão "concluída".

---

## 1. Validação de Integridade

```bash
# Verificar working tree
git status

# Executar validação de sessão
npx tsx scripts/validate-session.ts

# Verificar testes
pnpm run test

# Verificar typecheck
tsc --noEmit

# Verificar build
pnpm run build
```

- [ ] Working tree limpo (sem alterações não commitadas)
- [ ] Todos os testes a passar
- [ ] Typecheck sem erros
- [ ] Build funcional

## 2. Actualização de Estado

- [ ] `context_buffer.yaml` actualizado com estado final
- [ ] `BACKLOG.md` actualizado (itens concluídos marcados com [x])
- [ ] Quick Board actualizado

## 3. Documentação

- [ ] ADR/SDR criado quando aplicável
- [ ] Plano actualizado com checkboxes preenchidos
- [ ] Notas técnicas registadas

## 4. Registo Histórico

- [ ] Ficheiro em `docs/history/YYYY-MM-DD-sessao-NN.md` criado
- [ ] Conteúdo denso: objectivos, decisões, estado do repositório

## 5. Feedback

- [ ] Feedback gerado em `docs/feedback/YYYY-MM-DD.md` (se aplicável)

## 6. Buffer Podado

- [ ] `context_buffer.yaml` com ≤ 50 linhas activas
- [ ] Secções obsoletas removidas

## 7. Estado Final

| Campo | Valor |
|---|---|
| Branch | |
| Último commit | |
| Testes | ✅/❌ |
| Typecheck | ✅/❌ |
| Build | ✅/❌ |
