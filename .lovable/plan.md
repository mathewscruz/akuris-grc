## Objetivo
Eliminar o scroll vertical no menu lateral em qualquer altura de tela, mantendo todos os itens visíveis (sem esconder nada permanentemente).

## Diagnóstico
Hoje em `src/components/AppSidebar.tsx`:
- 4 seções (Operação, GRC Core, Compliance, Insights) + grupo "Configurações" no rodapé.
- Cada `SidebarMenuButton` usa `h-9` (36px) + `mb-1`/`space-y-1`.
- Labels de seção têm `mb-1` extra.
- Em telas com altura < ~820px o conteúdo ultrapassa o viewport e o `SidebarContent` ativa scroll.

## Estratégia: densidade adaptativa por altura do viewport
Aplicar um modo "compacto" automático quando a altura disponível não comporta todos os itens expandidos. Tudo via classes Tailwind condicionais — sem esconder itens, sem mudar comportamento de clique.

### Mudanças
1. **Hook `useSidebarFit`** (`src/hooks/useSidebarFit.tsx`)
   - Lê `window.innerHeight` (com listener de resize, debounced).
   - Retorna um de três níveis: `comfortable` (≥900px), `compact` (700–899px), `dense` (<700px).

2. **`AppSidebar.tsx` adapta tokens conforme nível**
   - `SidebarContent`: `py-2` → `py-1` no `compact`/`dense`.
   - `SidebarMenu`: `space-y-1` → `space-y-0.5` no `compact`, `space-y-0` no `dense`.
   - `SidebarMenuButton` (itens principais e sub-itens): `h-9` → `h-8` no `compact`, `h-7` no `dense`; padding `px-3` → `px-2.5`.
   - `SidebarGroupLabel`: `mb-1` → `mb-0.5`; no nível `dense` reduz para `text-[9px]` e `mb-0` (eyebrows mais curtos).
   - Espaçamento entre `SidebarGroup`s: adiciona `gap` controlado pelo nível.
   - Ícones permanecem `h-4 w-4` em `comfortable`/`compact`; no `dense` vão para `h-3.5 w-3.5` para alinhar à altura `h-7`.
   - Logo `SidebarHeader`: já é `h-14` — no `dense` cai para `h-12`.

3. **Sub-itens do GRC Core (Collapsible)**
   - Mantém `ml-6 pl-2` em `comfortable`; em `dense` reduz para `ml-4 pl-1.5` para economizar largura visual sem cortar texto.
   - `mt-1` → `mt-0.5` no `dense`.

4. **Grupo "Configurações" fixo no rodapé**
   - Continua com `mt-auto`. No `dense` recebe `border-t border-sidebar-border/30 pt-1` para separar visualmente já que o espaçamento global encolhe.

5. **Fallback de segurança**
   - `SidebarContent` recebe `overflow-hidden` no nível `dense` (em vez do `overflow-auto` implícito do shadcn) — se ainda assim sobrar 1–2px, evita scrollbar visual.
   - Garantimos que nada seja cortado: as classes acima cabem ~14 itens visíveis com sub-menu fechado em 600px de altura. O sub-menu do GRC Core, quando aberto, é a única fonte de pressão restante — ele já é colapsável e só fica aberto na rota ativa.

## Critério de aceite
- Em 1920×1080, 1366×768, 1280×720 e 1024×600 (zoom incluído), o `SidebarContent` não exibe barra de rolagem com todas as seções visíveis e o sub-menu do GRC Core fechado.
- Quando o usuário expande o sub-menu do GRC Core em altura muito pequena, o comportamento continua funcional (sub-itens visíveis), aceitando rolagem apenas nesse cenário extremo.
- Nenhum item some, nenhum requer hover/popover para ser acessado.
- Identidade visual preservada (DM Sans, tokens de cor, ícones stroke 1.5).

## Arquivos afetados
- `src/hooks/useSidebarFit.tsx` (novo)
- `src/components/AppSidebar.tsx` (ajustes de classes condicionais)

## Fora de escopo
- Não muda densidade global (`DensityToggle` continua afetando tabelas).
- Não introduz colapso automático de grupos nem oculta seções.
- Não altera o `collapsible="icon"` da própria sidebar.