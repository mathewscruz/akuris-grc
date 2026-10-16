# Cores do índice que dizem o que o status significa

## Por que o "Bom" sai mostarda
O anel do índice não usa uma cor por faixa: ele **mistura** laranja com verde conforme a nota. Em 67 a mistura dá um verde-oliva/mostarda, que não parece nem "bom" nem "atenção". Por isso a troca anterior do laranja não resolveu.

## O que vai mudar
Cada faixa ganha uma cor própria e fixa, igual ao rótulo exibido ao lado do anel:

| Faixa | Nota | Cor |
|---|---|---|
| Excelente | 80 a 100 | Verde |
| Bom | 60 a 79 | Verde-azulado (teal), claramente positivo |
| Atenção | 40 a 59 | Laranja-mel |
| Crítico | 0 a 39 | Vermelho |
| Sem dados | — | Cinza |

- Fim das misturas: nenhum tom intermediário "sujo".
- Funciona nos temas claro e escuro.
- Aplicar a mesma regra nos outros lugares que mostram essa escala de saúde (anel do painel e barras por módulo do Dashboard), para "Bom" ter a mesma cor em todo lugar.

## Detalhes técnicos
- Novo token `--good` (teal, ~172 60% 34% claro / 170 50% 52% escuro) em `index.css`.
- `operationalScoreColor` passa a retornar o token da faixa (limites 80/60/40, alinhados à regra de maturidade já usada), sem `color-mix`.
- Revisar `GrcHealthBreakdown` e barras de maturidade para usar a mesma função.
- Atualizar o teste de `executive-summary` com as faixas: 85 verde, 67 teal, 45 laranja, 20 vermelho, sem dados cinza.
