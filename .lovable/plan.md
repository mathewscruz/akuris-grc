## Diagnóstico

No anexo, o pill do toast tem altura compacta (1 linha sem descrição) e o chip de 24px fica encostado no topo/base porque o padding vertical interno hoje é de apenas 12px (`pt-3 pb-3`) — o que dá pouco respiro quando não há descrição. Falta também uma altura mínima para garantir uniformidade entre toasts curtos e longos.

## Refinamentos

Aplicar três ajustes coordenados nos três pontos onde o pill é renderizado:

1. **Padding vertical 16px** (em vez de 12px) — gera respiro consistente ao redor do chip e do texto.
2. **`min-height: 64px`** no container do pill — garante a mesma altura visual independente de ter ou não descrição/eyebrow.
3. **Alinhamento vertical centralizado** explícito (`items-center`) já está correto — manter.

## Arquivos

### `src/components/ui/sonner.tsx`
- `toast` classNames: trocar `[&>*]:pt-3 [&>*]:pb-3` por `[&>*]:py-4` e adicionar `min-h-[64px]`.

### `src/lib/akuris-toast.tsx`
- Container do `sonnerToast.custom`: trocar `py-3` por `py-4` e adicionar `min-h-[64px]`.

### `src/components/NotificationCenter.tsx`
- `renderItem`: trocar `py-3` por `py-4` e adicionar `min-h-[64px]` no wrapper interno do botão.

### `src/index.css`
Sem mudanças — as classes `akuris-stripes-*` continuam servindo todos os pills.

## Fora do escopo

- Não mudar tamanho do chip (24px continua sendo o padrão visual do anexo).
- Não alterar largura (380px) nem cor das listras.
- Sem mudanças em lógica de notificação, RLS ou edge functions.
