# Score do Gap Analysis no mesmo estilo do dashboard

## O que muda
Os gráficos de score dentro do Gap Analysis passam a usar o mesmo visual do card "Índice operacional" do dashboard: anel grosso com degradê teal→verde, ponta arredondada, número grande ao centro e animação de preenchimento; e gráfico de evolução em área com linha em degradê e preenchimento suave.

Locais afetados:
1. Cabeçalho do framework (anel de conformidade).
2. Resultado da análise de documento (anel de % de conformidade no topo).
3. Aba de histórico do framework (gráfico de evolução do score).

Sem dados avaliados, o anel continua mostrando "—" com trilho vazio (nada inventado).

## Detalhes técnicos
- Extrair `GradientRing` e o gráfico de área de `dashboard/bento/tiles.tsx` para um componente compartilhado (`components/charts/ScoreGradient.tsx`: `GradientScoreRing` com `size`, `value|null`, `suffix`, `label`; `GradientScoreArea` com série `{label,value}`), com IDs de gradiente únicos via `useId` para não colidirem quando há vários na página.
- Dashboard passa a importar o componente compartilhado (visual idêntico).
- Substituir `ScoreRing` em `v2/FrameworkHeader.tsx` e em `adherence/AdherenceResultView.tsx` (mantendo o veredito em texto/badge ao lado, já que a cor do anel deixa de indicar o tom).
- Substituir `TrendAreaChart` em `ScoreEvolutionChart.tsx` pelo `GradientScoreArea`, mantendo eixo 0–100 e tooltip existente.
- Rodar os testes do Gap Analysis (`ExecutiveFramework`, `paridade-entre-frameworks`, `prontidao-num-sitio-so`) e ajustar asserções que dependam do anel antigo.
