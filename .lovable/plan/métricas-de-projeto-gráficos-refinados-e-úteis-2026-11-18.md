# Métricas de projeto: gráficos refinados e úteis

## Problemas vistos na tela
- **Burnup:** a linha "Ritmo ideal" está na legenda mas não aparece; a marca "Hoje" fica colada na borda e cortada; boa parte do gráfico é uma linha reta sem informação.
- **Tempo médio:** mostra "-3,0 dias" (atividade com conclusão antes da criação) e "sem dados" quebra em duas linhas.
- **Concluídas por semana:** barras escuras, pequenas e sem contexto; a média 0,3 fica perdida no rodapé.
- **Por prioridade:** só conta o total; não mostra quanto de cada prioridade já foi concluído ou está atrasado.
- **Layout:** "Tempo & SLA" sozinho deixa um buraco à direita.

## O que muda

### 1. Faixa de saúde no topo (novo)
Um cartão-resumo com um selo "No prazo / Em risco / Atrasado", comparando o progresso real com o esperado para hoje ("25% feito, esperado 40%"), mais a previsão de término e quantos dias de folga ou atraso.

### 2. Burnup completo
- Três camadas: **Escopo** (área clara), **Concluídas** (linha em degraus da cor da marca) e **Ritmo ideal** (pontilhado, do início do projeto até o fim previsto), que passa a aparecer de fato.
- **Projeção:** linha tracejada estendendo o ritmo atual até cruzar o escopo, mostrando visualmente quando termina.
- Marca "Hoje" com rótulo dentro do gráfico.
- Balão rico ao passar o mouse: "Semana de 21/10 · 2 de 8 concluídas · ideal 3".
- Seletor de visão: Burnup / Burndown (restantes).

### 3. Ritmo semanal
- Barras arredondadas suaves, semana atual destacada, faixa da média com rótulo no canto.
- Pequeno indicador "+1 vs semana anterior".
- Clicar numa barra lista as atividades concluídas naquela semana.

### 4. Por prioridade, empilhado
Cada prioridade vira uma barra dividida em **Concluídas / Em aberto / Atrasadas**, com totais. Clicar abre a lista filtrada.

### 5. Tempo médio e Tempo & SLA
- Ignora durações negativas ou incoerentes; valores formatados ("7,8 d"), "—" em vez de "sem dados".
- "Tempo & SLA" vira um medidor circular de gasto vs estimado com os SLAs ao lado e passa a ficar lado a lado com outro cartão, sem buracos.

### 6. Acabamento visual comum
Todos os cartões com o mesmo cabeçalho (título, subtítulo explicativo, ação), estados vazios ilustrados quando não há dados, animação de entrada suave (respeitando "reduzir movimento") e cores só da paleta do Akuris.

## Detalhes técnicos
- `AkurisCharts.tsx`: novo `AkurisComposed` (área de escopo + degraus + ideal + projeção, tooltip customizado), `AkurisStackedBars` horizontal com `onSelect`, `AkurisGauge`; tooltip padrão `ChartTooltip` reutilizável.
- `projeto-acompanhamento.ts`: `saudeProjeto` (esperado vs real, folga em dias), `projecaoBurnup`, `burndown`, `prioridadeEmpilhada`; `tempoMedioPorPrioridade` descarta durações < 0. Testes para cada regra.
- Burnup ideal: início = data de início do projeto (fallback criação da primeira atividade), corrigindo o caso atual onde a linha não renderiza.
- `MetricasPanel.tsx`: nova grade (saúde → burnup largo + previsão → ritmo + prioridade → tempo/SLA + carga), drawer com lista filtrada reutilizando o popup de atividade.
- Textos PT/EN.
