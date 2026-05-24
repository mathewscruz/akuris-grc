# Toast Akuris — redesign "Editorial precision"

## Direção escolhida
- Surface sólida `bg-card` com borda fina `border-border`, raio `rounded-lg`, sombra profunda.
- Acento vertical de 3px à esquerda na cor semântica do tom (success / warning / destructive / info / primary).
- Chip circular 32px **sólido** na cor semântica com glyph branco (no warning/success o glyph fica em navy para contraste).
- Conteúdo: título 14px semibold, descrição 13px `text-muted-foreground` leading-relaxed.
- Botão Action como link inline em `text-primary` (sem pill branco).
- Close 16px no canto superior direito.
- **Sem listras diagonais.**

## Mudanças

1. **`src/components/ui/sonner.tsx`** — reescrever classNames:
   - Remover todas as `akuris-stripes-*` e o override `[&_[data-icon]]:!bg-…` que pintava só o chip.
   - Toast: `bg-card border border-border rounded-lg shadow-[…] pl-4 p-4 gap-3 items-start`, com pseudo `before:` de 3px à esquerda colorido pelo tom via classes `data-[type=success]:before:bg-success` etc.
   - Icon chip: 32px circular sólido (`bg-success`/`bg-warning`/`bg-destructive`/`bg-info`/`bg-primary`) com glyph branco.
   - Title `text-[14px] font-semibold`, description `text-[13px] text-muted-foreground leading-relaxed mt-1`.
   - ActionButton: link inline `bg-transparent text-primary hover:text-primary/80 font-medium text-[12px] px-0 py-0 border-0 shadow-none mt-3`.
   - Manter `expand={true}` e `visibleToasts={4}` da correção anterior.

2. **`src/lib/akuris-toast.tsx`** — atualizar o custom toast para o mesmo padrão (acento vertical 3px + chip 32px sólido + sem listras), preservando o slot de ícone proprietário do módulo. Remover dependência de `akuris-stripes-*` e do `akuris-pill-action`; trocar action pelo mesmo link inline `text-primary`.

3. **`src/index.css`** — manter as classes `akuris-stripes-*` por compatibilidade (outros componentes podem usar), apenas não usadas pelo toast. Sem remoção destrutiva.

4. **Memória** — atualizar `mem://design/foundations/notifications-pill-redesign` para refletir o novo padrão "Editorial precision" (acento vertical + chip sólido, sem listras).

## Validação
- Disparar success/warning/error/info isolados e empilhados (3+).
- Conferir em dark e light theme.
- Confirmar ação inline (ex.: toast com botão "Ver detalhes") e descrição com `<span>` em destaque.
- Confirmar que `akurisToast({module, tone})` continua renderizando ícone do módulo.
