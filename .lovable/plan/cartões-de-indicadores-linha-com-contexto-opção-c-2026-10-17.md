# Cartões de indicadores: linha com contexto (opção C)

O mini gráfico dos cartões de resumo, no topo dos módulos, hoje é uma linha reta que só sobe no fim, sem números nem período. Ele passa a explicar o que mostra.

## O que muda
- A linha ganha um ponto por semana. O último ponto fica destacado.
- O valor de início aparece na esquerda e o valor atual na direita (ex.: 7 → 12).
- Uma linha tracejada fraca marca a base, e a legenda "últimas 8 semanas" (EN: "last 8 weeks") vai embaixo.
- Passar o mouse sobre um ponto mostra a semana e o valor.
- O gráfico continua aparecendo só quando há variação real. Sem histórico, nada é mostrado.
- Vale para todos os módulos que usam esses cartões.

## Detalhes técnicos
- `src/components/ui/stat-strip.tsx`: reescrever `MiniArea` para SVG com pontos (`circle`), rótulos de início e fim (`text-micro tabular-nums`), linha tracejada `stroke-border` e legenda via `t()` (nova chave PT/EN). A altura passa de h-7 para ~h-14, e a cor continua vinda do tom do cartão.
- Adicionar `title` por ponto para o tooltip nativo.
- Rodar os testes existentes e conferir as chaves de tradução.
