# Menu lateral em formato "trilho" com ícone + nome

## O que muda para o usuário
- O menu lateral passa a ser uma coluna estreita (cerca de 96px) e fixa, como no exemplo: cada item mostra o **ícone em cima e o nome curto embaixo**, centralizados.
- O item ativo ganha um cartão levemente destacado com uma **barrinha vertical roxa à esquerda** (roxo da marca, no lugar do verde do exemplo).
- No topo fica o **novo logotipo Akuris (a seta "A" roxa)**, centralizado, com uma linha divisória fina abaixo.
- Itens que hoje abrem uma lista de subitens (ex.: grupos de módulos) passam a abrir um **pequeno painel ao lado** ao clicar/passar o mouse, listando os subitens. Assim nenhum módulo some do menu.
- Os títulos de seção (rótulos dos grupos) deixam de aparecer; os grupos ficam separados por um espaço/linha sutil.
- O botão "Sair" continua no rodapé, no mesmo formato ícone + nome.
- Ao passar o mouse, aparece o nome completo do módulo quando o nome curto estiver abreviado (ex.: "Config.").
- No celular, o menu continua abrindo como gaveta, no novo visual.
- Permissões por perfil, planos e módulos visíveis continuam exatamente iguais.

## Logotipo
- O logotipo enviado vira o logo fixo do topo do menu.
- O logo personalizado da empresa (quando cadastrado) deixa de aparecer no menu lateral — avise se preferir manter o da empresa com prioridade.

## Detalhes técnicos
- Upload do logo via lovable-assets (`src/assets/akuris-mark.png.asset.json`), fundo removido para combinar com o tema escuro/claro.
- Reescrever a renderização de `src/components/AppSidebar.tsx`: largura fixa via tokens (`--sidebar-width`), sem modo colapsado/expandido (remove `SidebarTrigger` do header se ficar sem função).
- Itens: `NavLink` em coluna (`flex-col items-center gap-1`), ícone 22px stroke 1.5, rótulo `text-[11px]`; nomes curtos via novas chaves i18n `sidebar.short.*` PT/EN.
- Ativo: `bg-sidebar-accent` + pseudo-elemento 3px `bg-primary` à esquerda; somente tokens semânticos.
- Subitens: `Popover`/`HoverCard` à direita reutilizando a lista `subItems` filtrada por `hasAccess`.
- Manter `ErrorBoundary`, prefetch, logout com confirmação e overlay.
