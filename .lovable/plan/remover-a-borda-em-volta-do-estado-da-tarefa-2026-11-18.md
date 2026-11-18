# Remover a borda em volta do estado da tarefa

## O que muda
- No popup da tarefa, o botão de estado no topo (ex.: "A Fazer") deixa de mostrar a moldura com cantos roxos quando é clicado ou o menu está aberto. Fica só a pílula.
- Quem navega pelo teclado ainda vê onde está: o contorno roxo leve aparece na própria pílula, não numa caixa em volta.

## Detalhes técnicos
- `TarefaDialog.tsx`, `SelectTrigger` do estado: adicionar `border-0 outline-none ring-0 ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none data-[state=open]:ring-0 group` e remover o efeito do anel global de foco nesse elemento.
- `StatusPill` do botão: `group-focus-visible:ring-2 group-focus-visible:ring-primary/30` para manter o foco acessível.
