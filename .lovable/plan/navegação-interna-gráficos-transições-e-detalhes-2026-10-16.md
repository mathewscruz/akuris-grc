# Navegação interna, gráficos, transições e detalhes

Escolhas: Navegação A (sub-barra fixa), todos os gráficos, todas as transições (cada uma no seu lugar), Detalhes A (painel lateral editorial).

## 1. Navegação — sub-barra fixa
- Abaixo do cabeçalho, em cada módulo: ícone + nome do módulo, caminho (ex.: Riscos › Matriz), abas com contadores e busca rápida à direita.
- Fica fixa ao rolar a página; no celular as abas rolam para o lado e a busca vira um ícone.
- Contadores mostram números reais de cada aba.

## 2. Gráficos — quatro padrões, cada um no seu uso
- **Área com degradê:** evolução no tempo (riscos, incidentes, conformidade), com balão ao passar o mouse e linha tracejada de meta quando houver.
- **Barras arredondadas:** volumes por mês (controles testados, planos concluídos), mês atual em roxo e os outros em tom neutro.
- **Donut segmentado:** distribuição por status ou gravidade, número total no centro e legenda com quantidade e %.
- **Barras de progresso com selo:** conformidade por framework, com o selo novo e o % à direita.
- Todos com o mesmo cartão: rótulo pequeno em maiúsculas, número grande e variação.

## 3. Transições — onde cada uma entra
- **Página desliza:** ao trocar de módulo ou de aba (subida curta e aparecimento suave).
- **Cartões em cascata:** na entrada do dashboard, nos números do topo e nas listas de cartões (só os primeiros, para não atrasar).
- **Painel com profundidade:** ao abrir o painel lateral de detalhes e filtros (fundo escurece e recua levemente).
- **Números e gráficos animados:** números contam até o valor e gráficos se desenham ao aparecer.
- Tudo desliga automaticamente para quem prefere menos movimento.

## 4. Detalhes — painel lateral editorial
- Cabeçalho com ícone, código, título e status; linha de 3 mini cartões (gravidade, progresso, prazo).
- Abas Detalhes / Ligações / Atividade; seções com título; itens relacionados clicáveis; atividade recente em linha do tempo com "Ver toda a atividade".
- Aplicado no painel único que todos os módulos já usam, então vale para todos de uma vez.

## Ordem
1. Peças base: sub-barra, quatro gráficos, transições.
2. Painel lateral editorial.
3. Aplicação nos módulos de maior uso (Riscos, Controles, Planos, Incidentes, Documentos, Ativos, Fornecedores, Contratos) e depois nos demais.
4. Verificação em desktop, tablet e celular, claro e escuro.

## Detalhes técnicos
- `ModuleSubbar` (sticky `top-[header]`, usa `Breadcrumb`, `Tabs` com `count`, busca local) integrado ao `PageHeader`/layout de módulo.
- `src/components/charts/`: `AkurisArea`, `AkurisBars`, `AkurisDonut`, `ProgressoFramework` sobre recharts + `chart-tokens.ts`; `ChartCard` comum.
- Transições: `PageTransition` existente (slide-up 8px), utilitário `.akuris-stagger` com `--i` (limite de 8 itens), Sheet com escala 0.98 + overlay no fundo, `AnimatedMetricValue` e `isAnimationActive` dos gráficos; tudo condicionado a `useMotionAllowed`.
- Detalhes: evoluir `RecordDetailDrawer` (KPIs, abas, linha do tempo de atividade) mantendo a API e os hooks de ligações por empresa.
- Sem mudança de dados ou permissões; textos novos em PT/EN.
