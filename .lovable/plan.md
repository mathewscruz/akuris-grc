# Menu lateral sem rolagem e sem nomes cortados

## O que muda
- **Nomes curtos e completos no menu**, sempre em no máximo 2 linhas e sem quebrar palavras ao meio (o nome completo continua aparecendo ao passar o mouse e no painel lateral):
  - Gerenciamento de Riscos → **Riscos**
  - Gerenciamento de Ativos → **Ativos**
  - Gerenciamento de Acessos → **Acessos**
  - Planos de Ação → **Planos de Ação** (2 linhas)
  - Continuidade de Negócios → **Continuidade**
  - Terceiros e ética → **Terceiros**
  - Em inglês: Risks, Assets, Access, Action Plans, Continuity, Third Parties etc.
- **Menu largura um pouco maior** (de 96px para 104px) para palavras como "Continuidade" e "Documentos" caberem inteiras em uma linha.
- **Sem rolagem em nenhuma altura de tela**: o menu mede o espaço disponível e se ajusta sozinho em 3 níveis:
  1. Confortável: espaço atual.
  2. Compacto: menos espaço entre itens e ícones um pouco menores.
  3. Denso (telas baixas, ex. notebooks): itens bem justos, divisórias finas entre grupos.
  O texto nunca é cortado nem abreviado em nenhum nível.
- Logo e botão "Sair" também ficam menores nos níveis compacto e denso.

## Detalhes técnicos
- Novas chaves `sidebar.short.*` (PT/EN) e campo opcional `shortTitle` em `getMenuSections` (`src/lib/navigation.ts`); `AppSidebar` exibe `shortTitle ?? title`, com `title` no tooltip.
- Rótulo: trocar `line-clamp-2 break-words` por `hyphens-none break-normal` com `whitespace-normal`; sem `line-clamp`.
- Reativar `useAutoFit(contentRef)` com classes por nível: padding vertical `py-2.5 / py-1.5 / py-1`, ícone `22 / 20 / 18px`, rótulo `11 / 11 / 10.5px`, gap entre grupos reduzido; `SidebarContent` com `overflow-hidden` (sem barra).
- `--sidebar-width` de `6rem` para `6.5rem` em `Layout.tsx`.
- Validar com Playwright em alturas 1215, 900, 768 e 650px que `scrollHeight <= clientHeight` e nenhum rótulo tem overflow horizontal.
