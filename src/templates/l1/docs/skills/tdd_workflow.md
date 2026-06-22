---
name: tdd-workflow
description: >
  Garantir a correção do código desde o primeiro minuto usando o ciclo Red-Green-Refactor.
---

# 🧪 SKILL: TEST-DRIVEN DEVELOPMENT (TDD) WORKFLOW

## 🎯 Objetivo
Garantir a correção do código desde o primeiro minuto, reduzir o tempo de debug e criar uma rede de segurança contra regressões.

## 🔄 O Ciclo Red-Green-Refactor
1. **🔴 RED:** Escreva um teste pequeno que falha para uma funcionalidade que ainda não existe. O teste deve ser a especificação do comportamento esperado.
2. **🟢 GREEN:** Escreva a quantidade mínima de código necessária para fazer o teste passar o mais rápido possível (mesmo que o código não seja ideal).
3. **🔵 REFACTOR:** Limpe o código, remova duplicidades e melhore a arquitetura, garantindo que todos os testes continuem passando.

## 📜 Regras de Ouro dos Testes
1. **Independência:** Cada teste deve ser isolado. O resultado de um teste não deve depender da execução de outro.
2. **Nomenclatura Clara:** Use o padrão `should [expected behavior] when [condition]` (ex: `should throw error when email is invalid`).
3. **Foco no Comportamento, não na Implementação:** Teste o que o código faz, não como ele faz internamente. Isso facilita refatorações futuras.
4. **Fast Feedback:** Testes unitários devem ser extremamente rápidos. Use mocks/stubs para dependências externas (bancos de dados, APIs).

## 🛠️ Pirâmide de Testes no Projeto
- **Unitários (Vitest):** Lógica de negócio, calculadores e VOs.
- **Integração:** Validação de fluxos entre múltiplos serviços ou Use Cases.
- **E2E:** Fluxos críticos do utilizador (ex: login, fluxo principal).

## 📂 Onde Aplicar
- Em todo o processo de desenvolvimento de novas features e correções de bugs.
