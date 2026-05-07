# Drawer de Risco — footer com quebra e mais respiro à direita das abas

Em `src/components/riscos/RiscoDetailDrawer.tsx`:

## 1. Footer (anexo 1) — "Última revisão · Inicial · 27/0…" cortando

Hoje (linha 345-352) o `<div>` está com `hidden sm:block min-w-0 truncate`, o que força elipse. Permitir quebra de linha:

- Container do footer: `flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3` (em telas estreitas o texto vai pra cima dos botões; no desktop fica à esquerda).
- Texto: remover `hidden sm:block` e `truncate`; deixar `leading-snug` para quebrar naturalmente.
- Cluster de botões: trocar `ml-auto` por `sm:ml-auto`.

## 2. Abas (anexo 2) — "Controles" ainda colado na borda

A `TabsList` tem `mx-8` mas o problema é que "Controles" é o trigger mais largo da grid de 4 colunas e o conteúdo do trigger fica colado no canto direito da célula (não da tela). Solução: aumentar a margem direita da lista para criar respiro extra somente daquele lado.

- `mx-6 mt-4 mr-10 grid grid-cols-4 h-9 gap-1.5` (margem direita maior que a esquerda).

Sem outras alterações.
