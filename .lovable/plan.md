# Toasts vazios ao empilhar — correção

## Diagnóstico

No screenshot, o toast da frente ("Status atualizado para Parcial") aparece normal, mas os 2 toasts atrás dele aparecem como faixas vazias (só fundo listrado, sem título/descrição/chip).

Causa: em `src/components/ui/sonner.tsx` o Toaster está configurado com `expand={false}`. Esse é o modo "stack" do Sonner — ele só renderiza o toast da frente completo e usa os de trás como "cards fantasmas" colapsados. Como nosso pill tem `overflow-hidden`, fundo listrado próprio e padding generoso, os cards de trás ficam visíveis mas sem conteúdo legível — exatamente o efeito da print.

## Correção

Editar **apenas** `src/components/ui/sonner.tsx`:

1. Trocar `expand={false}` por `expand={true}` para que toasts empilhados sejam renderizados lado a lado verticalmente, cada um com título, descrição, chip e ação completos.
2. Adicionar `visibleToasts={4}` (hoje fica no default 3) para acomodar rajadas curtas sem cortar.
3. Manter `gap={12}` (já existe) — com expand ativo o gap passa a valer entre cards expandidos, mantendo respiro entre eles.

Nenhuma outra mudança: tipografia, listras por tom, chip 24px, botões de ação e animações `animate-toast-enter/exit` continuam iguais. `akurisToast` (custom) já é independente e não é afetado.

## Validação

- Disparar 3+ toasts em sequência (ex.: alterar status de vários requisitos) e confirmar que todos mostram texto, chip e botão de ação.
- Verificar que um toast solitário continua com o mesmo visual atual (pill listrado, chip colorido).
- Conferir no modo claro e escuro.
