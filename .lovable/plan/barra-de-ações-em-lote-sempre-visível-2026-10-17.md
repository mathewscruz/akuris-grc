# Barra de ações em lote sempre visível

## Problema
A barra que aparece ao selecionar vários itens ("3 selecionados", Conforme, Parcial, Responsável, Prazo, Limpar) fica presa ao fim da lista. Em listas longas ela some ou só aparece no final da página.

## O que muda
- A barra passa a ficar fixa na parte de baixo da tela, centralizada, e acompanha o scroll.
- Ela aparece com uma animação suave ao selecionar itens e some ao limpar a seleção.
- O fim da lista ganha um espaço extra para a barra não cobrir os últimos itens.
- No celular, ela ocupa a largura da tela e fica acima da barra de navegação inferior.
- Vale para o Gap Analysis e para todos os módulos que usam a mesma barra.

## Detalhes técnicos
- `BulkActionBar.tsx` (gap-analysis/v2) e `ModuleBulkActionBar.tsx` (common): trocar `sticky bottom-4` por `position: fixed` renderizado via portal em `document.body` (escapa dos containers com overflow que quebram o sticky), `left-1/2 -translate-x-1/2`, `bottom-[calc(1rem+env(safe-area-inset-bottom))]`, `max-w-4xl w-[calc(100%-2rem)]`, `z-50`, ajuste extra para mobile acima de `MobileBottomNav`.
- Espaçador (`h-24`) renderizado no lugar original enquanto houver seleção.
- Validar com Playwright: selecionar itens, rolar até o topo e até o fim, conferir a barra visível em desktop, tablet e celular.
