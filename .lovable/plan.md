# Ajustar abas do drawer de Risco

Em `src/components/riscos/RiscoDetailDrawer.tsx` (linhas 152-157), as 4 abas (Visão / Tratam. / Histórico / Controles) cortam "Controles" no final porque cada `TabsTrigger` usa `text-xs` com padding padrão e ícone `mr-1`, somando largura > 25% da grid.

Mudanças:
- Trocar abreviação `Tratam.` por `Tratamento`.
- Reduzir tipografia para `text-[11px]`, padding `px-1.5`, `gap-1` (substituindo `mr-1` no ícone).
- Adicionar `min-w-0` no trigger e `truncate` no `<span>` do label, e `shrink-0` no ícone, garantindo que tudo caiba mesmo nas labels mais longas.
- Adicionar `gap-1` no `TabsList` para separação clara.

Sem mudanças em hooks, queries, footer ou demais abas.
