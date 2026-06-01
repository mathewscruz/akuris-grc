## Problema
A 974px de altura o hook caiu em `comfortable` (limiar ≥900px), mas o conteúdo total (header 56px + 4 grupos × padding interno + ~15 itens × 36px + labels + grupo Configurações + footer "Sair") passa do viewport e o `SidebarContent` ainda mostra scroll. Os limiares fixos por `innerHeight` não levam em conta o padding interno do shadcn Sidebar nem variações de zoom/DPR.

## Causa raiz
- Limiares baseados só na altura da janela ignoram o "chrome" real (header, footer, `p-2` dos `SidebarGroup`, gap entre grupos).
- A passos discretos (3 níveis) ainda sobra altura insuficiente em viewports intermediários como 950–1050px.

## Solução: medir o overflow real e escalar densidade
Trocar `useSidebarFit` por uma versão que **mede** o conteúdo da sidebar e escalona até deixar de ter overflow.

### Mudanças

1. **`src/hooks/useSidebarFit.tsx`**
   - Exportar dois símbolos: `useSidebarFit()` (mantém compat) e o novo `useAutoFit(contentRef, sentinelRef)`.
   - Novo fluxo:
     - Recebe um `ref` para o `SidebarContent` e mede `scrollHeight > clientHeight + 1`.
     - Estado interno percorre `['comfortable', 'compact', 'dense']`; se ainda overflow após render no nível `dense`, mantém `dense` (último recurso).
     - Reavalia em:
       - `ResizeObserver` no contentRef
       - `window resize`
       - mutação interna (abrir/fechar Collapsible) via `MutationObserver` no contentRef
     - Debounce 80ms.
   - Mantém os mesmos níveis para reaproveitar as classes já aplicadas em `AppSidebar.tsx`.

2. **`src/components/AppSidebar.tsx`**
   - Adicionar `const contentRef = useRef<HTMLDivElement>(null)` e passar para `SidebarContent` via `ref`.
   - Substituir `const fit = useSidebarFit()` por `const fit = useAutoFit(contentRef)`.
   - Reduzir o "chrome" residual no nível `dense`:
     - `SidebarGroup` recebe `py-0` (shadcn usa `p-2` por padrão) quando `isDense`.
     - Gap entre grupos: classe explícita `gap-0` no `SidebarContent` em `compact`/`dense` (sobrescreve `gap-2` default do shadcn).
   - Garantir `overflow-hidden` no `SidebarContent` em `compact` E `dense` (não só dense), porque é justamente nos casos intermediários (≈950px) que o auto-fit precisa "esconder" 1–2px de folga enquanto re-mede.

3. **Sub-itens GRC Core**
   - Quando `fit === 'dense'` e o sub-grupo está aberto, considerar como pressão extra. O auto-fit já reage a isso via `MutationObserver` e re-escala se necessário.

## Critério de aceite
- Em 1920×1080, 1440×900, **1366×768, 1337×974, 1280×720, 1024×640** — `SidebarContent` não exibe barra de rolagem visível com sub-grupo GRC Core fechado.
- Quando o usuário expande o sub-grupo GRC Core, o hook recomprime automaticamente para `compact`/`dense` e mantém todos itens visíveis até o limite físico do viewport.
- Sem flicker perceptível (debounce + transição já existente de 300ms).

## Arquivos afetados
- `src/hooks/useSidebarFit.tsx` (refatorar)
- `src/components/AppSidebar.tsx` (passar ref, ajustes finos de chrome)

## Fora de escopo
- Não esconder itens nem mover para popover.
- Não mexer no comportamento de `collapsible="icon"`.