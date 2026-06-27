# reports/

Saída histórica do motor de complexidade. Cada execução do scoring grava um arquivo aqui.

## Convenção de nome

```
complexity-<nome-do-projeto>-<YYYY-MM-DD>-session<N>.json
```

O número de sessão é opcional (depende do projeto registrar isso) mas recomendado — comparar "sessão 3 vs sessão 3" entre dois projetos diferentes é uma comparação mais justa do que comparar por data corrida.

## O que cada relatório contém

Lista completa de `ComplexityScore` (ver `core/complexity/types.ts`), uma entrada por área do `ProjectProfile` usado naquela execução — nunca um número único agregado do projeto inteiro. Cada `ComplexityScore.signals` preserva o detalhe de cada sinal que compôs o número (transparência obrigatória).

## Por que isso é versionado

Estes relatórios são o dado de entrada de qualquer fase futura do Nexus que dependa de observar evolução no tempo (ex: "esta área está ficando mais ou menos complexa ao longo das sessões"). Apagar ou não versionar isso destrói a única coisa que torna o sistema capaz de aprender com sua própria história.
