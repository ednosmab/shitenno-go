# BACKLOG — Fila de Tarefas

> **Última actualização:** YYYY-MM-DD
> **Responsável:** Tech Lead Humano + Agente IA

---

## Estados Formais

| Estado | Significado | Transição |
|---|---|---|
| `planeado` | Item definido, ainda não iniciado | → em investigação / em implementação |
| `em investigação` | Hipótese a ser validada | → em implementação / encerrado |
| `em implementação` | Código a ser escrito | → em validação |
| `em validação` | Testes e revisão | → concluído / em implementação |
| `concluído` | Implementação completa e validada | Terminal |
| `encerrado` | Hipótese invalidada ou acção obsoleta | Terminal |
| `pausado` | Bloqueio externo | → em investigação / em implementação |
| `adiado` | Decisão de não avançar agora | Requer [REVISIT: YYYY-MM-DD] |

---

## Regras de Gestão

1. **Prioridade P0** — Deve ser atacado primeiro em qualquer sessão
2. **Prioridade P1** — Só após concluir P0 ou registar adiamento
3. **Prioridade P2** — Só após concluir P0 e P1
4. **Checklist de conclusão** — Todos os 4 requisitos obrigatórios:
   - Actualização da documentação
   - Actualização do backlog
   - Validação dos critérios
   - Registo da decisão (ADR/SDR quando aplicável)

---

## Itens

### P0 (Crítico)

- [ ] **BACKLOG-001** — [descrição]
  - Estado: `planeado`
  - Critérios: [critérios verificáveis]

### P1 (Importante)

- [ ] **BACKLOG-002** — [descrição]
  - Estado: `planeado`
  - Critérios: [critérios verificáveis]

### P2 (Normal)

- [ ] **BACKLOG-003** — [descrição]
  - Estado: `planeado`
  - Critérios: [critérios verificáveis]

---

## Itens Concluídos

(Nenhum item concluído ainda)

---

## Histórico

| Data | Item | Acção | Responsável |
|---|---|---|---|
| YYYY-MM-DD | BACKLOG-001 | Criado | [autor] |
