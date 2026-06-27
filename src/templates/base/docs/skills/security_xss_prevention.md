# 🛡️ SKILL: SECURITY & XSS PREVENTION

## 🎯 Objetivo
Proteger a aplicação contra injeção de código malicioso (XSS) e garantir a privacidade dos dados — especialmente crítico em qualquer sistema que aceite conteúdo de texto formatado vindo do utilizador (HTML/Markdown/Rich Text).

## 🦠 Prevenção de XSS (Cross-Site Scripting)
Qualquer campo que aceite texto formatado do utilizador é um vetor de ataque potencial.
1. **Sanitização no Backend:** Nunca confie na entrada do cliente. Toda string que represente HTML DEVE ser higienizada no servidor usando bibliotecas robustas como `DOMPurify` ou equivalente, antes de ser persistida.
2. **Renderização Segura no Frontend:**
   - No React (Web): Se for absolutamente necessário renderizar HTML cru, use `dangerouslySetInnerHTML`, mas NUNCA faça isso sem passar o conteúdo pelo `DOMPurify` localmente também.
   - No React Native (Mobile): O componente que renderiza Markdown/HTML deve ser configurado para remover ou desativar tags `<script>`, `<iframe>` e `on*` events.

## 🔐 Privacidade de Dados Sensíveis
- **Sem PII Injetável:** Nenhuma Informação Pessoalmente Identificável (PII), como e-mail ou CPF, deve ser passada via query string na URL.
- **Log Masking:** Garanta que a configuração do logger estruturado mascare chaves, tokens e dados sensíveis antes de enviar para qualquer destino de log.
