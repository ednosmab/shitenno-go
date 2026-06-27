# 🚀 SKILL: POSTGRESQL PERFORMANCE & OPTIMIZATION

## 🎯 Objetivo
Garantir que o banco de dados responda rapidamente mesmo com grandes volumes de dados e acessos simultâneos.

## 🛠️ Dicas de Performance
1. **Explain Analyze:** Sempre que uma query estiver lenta, use o comando `EXPLAIN ANALYZE` para identificar gargalos (scans sequenciais, joins pesados).
2. **Índices Inteligentes:** Crie índices B-Tree para colunas usadas em filtros (`WHERE`) e joins. Use índices Parciais para filtrar subconjuntos de dados.
3. **Prevenção de N+1:** Evite múltiplas chamadas ao banco em loops. Use filtros `in` ou RPCs/stored procedures para buscar dados relacionados de uma só vez.
4. **Connection Pooling:** Entenda a diferença entre conexão direta e conexão via pooler (ex: PgBouncer). Use o pooler em ambientes serverless/edge, onde conexões diretas esgotam rápido o limite do banco.
5. **Views e Materialized Views:** Use Views para simplificar queries complexas e Materialized Views para dados pesados que não mudam com frequência.
