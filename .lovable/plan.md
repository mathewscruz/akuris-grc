# Tabelas idênticas ao mockup A (Compacta)

Comparei o mockup escolhido com o estilo aplicado hoje. As diferenças que fazem a tabela parecer outra:

| Item | Hoje | Mockup A |
|---|---|---|
| Altura da linha | 36px, apertada | ~46px, com respiro |
| Cabeçalho | 10px, pequeno | 13px, cor suave, sem caixa alta |
| Texto do título | 13px | 14px, cor clara |
| Prioridade/severidade | medidor (barrinhas) | só a palavra colorida (Alta vermelho, Média âmbar, Baixa verde) |
| Status | ponto 6px + texto 12px | ponto 8px + texto 13px cinza (Atrasado com ponto vermelho, texto cinza) |
| Avatar | 24px | 28px redondo + nome 14px |
| Prazo | texto pequeno | 14px, números alinhados |
| Ações "⋯" | aparecem só ao passar o mouse | sempre visíveis, discretas |
| Linha aberta | traço roxo 2px | traço roxo 3px + fundo levemente mais claro |
| Divisórias | finas | finas, também abaixo da última linha |
| Rodapé | — | "10 itens" à esquerda, páginas à direita com a atual em caixa suave |

## O que muda
Vale para todas as tabelas do sistema (mesma camada compartilhada). Fora das tabelas (fichas, painéis) nada muda. Anéis de progresso medido continuam como estão.

## Detalhes técnicos
- `src/index.css`, bloco `.akuris-table`: th 13px/normal-case/`muted-foreground`/h-10; td h-[46px] py-2.5 14px; dot 8px; chip de estado 13px muted (blocked mantém ponto vermelho, texto muted); família severidade/prioridade: esconder indicador/medidor e colorir o texto pelo tom (`--severity-high/medium/low`); avatar 28px; ações da última coluna sempre visíveis com opacidade 0.6 (remover regra de ocultar no hover); linha aberta 3px + `bg-muted/30`; `tabular-nums` nas células.
- `data-table.tsx`: texto primário 14px; rodapé de paginação no formato do mockup (contagem à esquerda, página atual com fundo suave).
- Conferir com Playwright em claro/escuro, 1280 e 390px, comparando lado a lado com o mockup; atualizar asserts de dimensão e a memória `design/tables-compact`.
