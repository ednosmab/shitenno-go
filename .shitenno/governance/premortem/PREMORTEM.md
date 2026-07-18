# 🧠 PREMORTEM — Checklist de Prevenção

> **Executar antes de iniciar qualquer FEATURE ou REFACTOR.**
> Responde 6 perguntas para identificar riscos antes de codificar.

---

## Checklist

### 1. O que pode quebrar?
_Identifique componentes, serviços ou fluxos que podem ser afectados._

### 2. Existe ADR relacionada?
_Consulte `docs/adrs/` para decisões arquitecturais já tomadas._

### 3. Existe contexto insuficiente?
_O plano actual cobre todos os cenários? Há ambiguidades?_

### 4. Existe risco de regressão?
_Algum teste existente pode falhar? Que fluxos existentes são tocados?_

### 5. Existe dependência externa?
_API, migration, configuração, deploy, ou permissões necessárias?_

### 6. Existe impacto arquitectural?
_Se sim, um novo ADR é necessário? A SYSTEM_MAP precisa de actualização?_

---

## Output Esperado

Após responder, o agente deve:
1. Registrar riscos identificados no `context_buffer.yaml` (secção `blockers`)
2. Se impacto arquitectural → criar ADR
3. Seguir para planeamento ou implementação conforme `WORKFLOW.md`
