---
name: error-handling-observability
description: >
  Evitar bugs silenciosos na produção usando logs estruturados, Error Boundaries e ferramentas analíticas.
---

# 🔭 SKILL: ERROR HANDLING & OBSERVABILITY

## 🎯 Objetivo
Evitar que bugs "silenciosos" atinjam a produção sem deixar rastros. Criar uma rede de captura para falhas usando logs estruturados, Error Boundaries e ferramentas analíticas.

## 🪵 Logger Estruturado (Obrigatório)
Nunca utilize `console.log` ou `console.error` cru no código de produção.
- Use a abstração de logger do projeto (ex: `import { logger } from '@/core/logger'`).
- **Logs de Informação:** Use para demarcar início e fim de fluxos críticos (ex: *Iniciando sync*, *Upload de vídeo concluído*).
- **Prefixos de Domínio:** Inclua a origem do log para facilitar o debug:
  ```typescript
  logger.info('[VideoUploadService] Chunk 1 enviado com sucesso');
  logger.error('[AuthBoundary] Falha ao renovar token JWT', error);
  ```

## 🛡️ Error Boundaries (Frontend)
- Englobe áreas funcionais e páginas com `<ErrorBoundary>`.
- **Não engula erros:** Evite blocos `try { ... } catch {}` vazios. Se você pegou um erro, logue ele com `logger.error` e decida: tratar localmente ou relançar para o ErrorBoundary mais próximo exibir a tela de "Ops, algo deu errado".

## 📡 Integração Sentry / Telemetria
- O ErrorBoundary deve estar integrado a uma ferramenta de report de crashes (como Sentry).
- Configure o Sentry para capturar:
  - Exceções não tratadas.
  - Rejeições de Promises (`Unhandled Promise Rejection`).
  - Lógicas de retentativa falhas (ex: timeout de BD).

## 📂 Onde Aplicar
- Em toda a camada Core (`[package-core]`).
- No frontend via `ErrorBoundaries` em `apps/`.
