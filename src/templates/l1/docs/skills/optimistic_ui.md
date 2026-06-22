---
name: optimistic-ui
description: >
  Proporcionar percepção de velocidade instantânea ao utilizador, tratando a sincronização com o servidor como processo de background.
---

# ⚡ SKILL: OPTIMISTIC UI & SYNC INDICATORS

## 🎯 Objetivo
Proporcionar uma percepção de velocidade instantânea ao utilizador, tratando a sincronização com o servidor como um processo de background transparente.

## 🚦 Estados de Sincronização
A interface deve refletir o estado de persistência de cada ação (ex: salvar progresso, postar comentário):

| Status | Significado | Feedback Visual |
| :--- | :--- | :--- |
| `synced` | Salvo no servidor | Sem ícone (limpo). |
| `pending` | Salvo apenas localmente (Offline) | Ícone de nuvem ou círculo discreto. |
| `error` | Falha após retentativas | Ícone de aviso (permite re-tentativa manual). |

## 🔄 Regras de Implementação
1. **Resposta Instantânea:** Atualize o estado local/cache IMEDIATAMENTE após o clique do usuário.
2. **Confirmação Silenciosa:** Quando o dado for confirmado no servidor, o indicador de "pending" deve sumir suavemente sem reposicionar elementos na tela.
3. **Persistência de Erro:** Se a sincronização falhar definitivamente, o dado não deve sumir. O usuário deve ser notificado e ter a opção de tentar novamente.

## ⚠️ Regras de Ouro
- **Nunca bloqueie a UI:** Evite spinners que impeçam a navegação, exceto em fluxos críticos de Auth ou Pagamento.
- **Offline First:** O app deve ser funcional mesmo sem sincronização ativa.

## 📂 Onde Aplicar
- `[app-aluno]/` (Progresso de aulas).
- `[app-admin]/` (Edição do CMS).
