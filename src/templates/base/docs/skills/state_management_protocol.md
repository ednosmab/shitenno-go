# 🧠 SKILL: STATE MANAGEMENT PROTOCOL

## 🎯 Objetivo
Evitar a "sopa de estado global". Definir fronteiras claras entre o que é estado do servidor (cache de banco de dados) e o que é estado do cliente (UI efêmera).

## ⚖️ A Regra de Ouro: Server State vs Client State

### 1. Server State (ex: TanStack Query / React Query)
**O que é:** Dados que residem no servidor (via API/backend) e você precisa exibir na tela.
**Ferramenta (exemplo):** `useQuery` e `useMutation` (TanStack Query) — qualquer lib de data-fetching com cache e invalidação serve ao mesmo propósito.
**Regras:**
- NUNCA copie dados da lib de server state para um store de client state ou para `useState` (isso cria uma fonte de verdade duplicada e bugs de sincronização).
- Acesse os dados diretamente pelo hook em qualquer componente que precisar. Libs de server state fazem deduplication automático.
- Use o princípio de *Optimistic UI* nas mutations para resposta imediata.

### 2. Client State Global (ex: Zustand)
**O que é:** Estado de interface que afeta múltiplas áreas do app, mas não é persistido no servidor (ex: Tema Dark/Light, Sidebar aberta/fechada, rascunho não salvo de um editor).
**Ferramenta (exemplo):** Zustand — qualquer store global leve (Jotai, Redux, Context+useReducer) serve ao mesmo propósito.
**Regras:**
- Crie stores pequenos e focados (ex: `useSidebarStore`, `useThemeStore`) em vez de um gigante `useAppStore`.
- Evite aninhamentos profundos no store global.

### 3. Client State Local (React useState)
**O que é:** Estado efêmero que só importa para um componente específico (ex: Modal aberto, texto digitado em um input antes do submit).
**Ferramenta:** `useState`, `useReducer`.
**Regras:**
- Mantenha o estado o mais próximo possível de onde ele é usado. Se apenas o componente e seu filho usam, passe via props, não jogue no store global.
