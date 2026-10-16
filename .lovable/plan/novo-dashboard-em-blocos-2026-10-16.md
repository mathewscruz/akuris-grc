# Novo Dashboard em blocos

Referência visual: a imagem "Painel em blocos" escolhida, adaptada à identidade do Akuris (fundo navy, roxo só em ação/navegação, gráficos em tons neutros, cores de estado só onde indicam algo).

## Estrutura
```text
| Índice operacional (anel + tendência) | Riscos (mapa 5x5) | Planos de ação (rosca) |
|                                       |                   | Incidentes abertos     |
| Conformidade (frameworks)  | Contratos a vencer (linha do tempo) | Atividade recente |
```
- **Topo:** saudação curta, frase de contexto e seletor de período (7/30/90 dias).
- **Índice operacional:** anel com a cor da faixa (Excelente/Bom/Atenção/Crítico), variação vs. período anterior e mini-gráfico da evolução.
- **Riscos:** mapa probabilidade x impacto com contagem por célula; clicar numa célula abre os riscos dela.
- **Planos de ação:** rosca no prazo / em atraso / concluídos com números e %.
- **Incidentes abertos:** total grande + chips por severidade.
- **Conformidade:** 3 a 5 frameworks com maior uso e barra de aderência.
- **Contratos a vencer:** próximos 90 dias em linha do tempo, com "em X dias" destacado quando perto.
- **Atividade recente:** últimas movimentações com ícone do módulo.
- Cada bloco tem título, frase curta, link "Ver todos" e abre o detalhe ao clicar (reaproveita a gaveta de detalhes já existente).

## Comportamento
- Só aparecem blocos dos módulos que o usuário pode acessar; a grade se reorganiza sem buracos.
- Bloco sem dados mostra um convite simples ("Cadastre o primeiro risco") em vez de zeros.
- Tablet: 2 colunas; celular: 1 coluna, na mesma ordem de prioridade.
- Animações suaves de entrada e dos números (respeitam "reduzir movimento"); carregamento com o loader Akuris.
- Números vêm das mesmas fontes de hoje, para não contradizer outras telas.

## Detalhes técnicos
- Novo `DashboardBento` com componente `BentoTile` (cabeçalho, ação, corpo) em `src/components/dashboard/bento/`; substitui o miolo de `Dashboard.tsx` mantendo `DashboardHeader`, drill-down e permissões.
- Dados de `useDashboardStats` / `src/lib/metrics/` existentes; novas consultas só para contratos a vencer e incidentes por severidade, sempre com `empresa_id`.
- Cores via `chart-tokens.ts` e `operationalScoreColor`; textos PT/EN via `t()`.
- Testes: blocos ocultos sem permissão; faixa de contratos (≤30 dias destacado).
