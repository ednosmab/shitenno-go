# 🚀 SKILL: NEXT.JS PERFORMANCE & SEO

## 🎯 Objetivo
Garantir que a aplicação web carregue de forma instantânea, tenha excelente pontuação no Lighthouse e seja perfeitamente indexável pelos motores de busca.

## 🏗️ Rendering Strategies (App Router)
1. **React Server Components (RSC):** O padrão. Use para tudo que não precisa de interatividade (hooks como `useState` ou eventos de clique). RSCs não enviam JavaScript para o cliente, melhorando drasticamente o tempo de carregamento.
2. **Client Components (`"use client"`):** Use estritamente na "folha" da árvore de componentes, apenas quando interatividade, hooks de ciclo de vida ou acesso a APIs do navegador forem necessários.

## 🖼️ Otimização de Mídia
- **`next/image`:** OBRIGATÓRIO para todas as imagens. Garante lazy loading, formatos modernos (WebP/AVIF) e prevenção de Cumulative Layout Shift (CLS).
- **`next/font`:** Use para carregar as fontes do projeto. Isso evita saltos de layout (FOUT) e pré-carrega as fontes direto do servidor.

## 🔍 SEO Best Practices
- **Metadata API:** Use a API estática (`export const metadata`) ou dinâmica (`export async function generateMetadata`) em cada `page.tsx` e `layout.tsx` para definir `title`, `description` e Open Graph tags dinâmicas.
- **Estrutura Semântica:** Conteúdo renderizado dinamicamente deve gerar HTML limpo e semântico (`<article>`, `<section>`, `<h1>`, `<h2>`), não apenas uma div infinita de componentes não-semânticos.
