## Diagnóstico

Dois problemas no pill atual:

1. **"Esticado"**: o `min-h-[64px]` força altura grande mesmo em toast de 1 linha (como "Login realizado com sucesso!"). O respiro deve vir só do padding, não de altura mínima.
2. **Chip colado à esquerda**: o `ml-4` (16px) é aplicado pela classe `icon` do Sonner, mas o slot do Sonner já tem `margin: 0` injetado via CSS interno e o `[data-icon]` recebe estilos próprios — o `!m-0 !mr-0` antes do `ml-4` cria conflito de especificidade. Resultado: o chip encosta na borda esquerda.

A causa raiz é a estratégia de "padding por filho" (`[&>*]:py-4`). Ela não controla bem o padding lateral porque o Sonner não envolve cada filho em wrapper consistente.

## Correção

Trocar a estratégia para **padding no container do toast** + usar `pl-4` no slot do icon e `pr-3` no content/action — explícito e previsível.

### `src/components/ui/sonner.tsx`
- Remover `min-h-[64px]` e `[&>*]:py-4`.
- Trocar `!p-0` por `!p-3.5 !pl-4 !pr-3` no `toast` (padding fixo no container).
- Limpar a classe `icon`: manter só `!m-0 shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-muted text-white` (sem `ml-4`).
- Ajustar `content` para `min-w-0 flex-1 pl-3 pr-2`.
- Ajustar `actionButton` para `!ml-2 !mr-0` (sem `mr-3` que já está coberto pelo container).

### `src/lib/akuris-toast.tsx`
- Remover `min-h-[64px]`.
- Trocar `pl-4 pr-3 py-4` por `p-3.5 pl-4` (padding lateral consistente, vertical reduzido).

### `src/components/NotificationCenter.tsx`
- Remover `min-h-[64px]` no wrapper do `renderItem`.
- Trocar `pl-3 pr-3 py-4` por `p-3.5 pl-4`.

## Resultado

- Pill com altura natural (~56px em 1 linha, expande conforme conteúdo).
- Chip com 16px de respiro à esquerda em todos os tons/superfícies.
- Padding interno uniforme de 14px vertical e 16px à esquerda.

## Fora do escopo

- Não muda tamanho do chip, listras ou tons.
- Não toca em lógica de notificação.
