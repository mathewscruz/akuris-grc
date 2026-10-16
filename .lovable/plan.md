# Validar e ajustar o novo menu em tablets e celulares

## Situação atual
- **Celulares (até 767px):** o menu não aparece fixo; abre como gaveta (pelo botão "Mais" da barra inferior). A gaveta tem 288px de largura, mas o conteúdo foi desenhado para uma coluna de 104px, então os itens ficam pequenos e centralizados num espaço grande e vazio. Os subitens abrem num painel "ao lado", que no celular sai da tela.
- **Tablets (768px ou mais, todos os iPads):** usam a coluna estreita do computador. Em iPad deitado (altura de cerca de 768–834px) o menu precisa do modo compacto/denso para caber sem rolagem.

## O que vou ajustar
1. **Celular: gaveta em formato de lista.** Cada item em uma linha com ícone + nome completo (sem abreviar), área de toque de no mínimo 44px, logo no topo e "Sair" no rodapé respeitando a área segura do iPhone (entalhe e barra inferior). Aqui a gaveta pode rolar, pois é uma tela inteira de toque.
2. **Celular: subitens abrem embaixo do item** (expandir/recolher), em vez do painel lateral.
3. **Celular: fechar a gaveta** automaticamente ao tocar em um módulo.
4. **Tablet: toque no lugar de mouse.** Painel de subitens abre por toque e fecha ao tocar fora; nomes completos aparecem no painel, já que não existe "passar o mouse".
5. **Tablet: sem rolagem em todos os iPads**, incluindo deitado e em tela dividida. Se a altura for muito baixa (abaixo de cerca de 640px), o menu passa a rolar discretamente em vez de esconder itens, para nenhum módulo ficar inacessível.

## Como vou validar
Testes automáticos de tela, com captura de imagem, nestes tamanhos:
- Celulares: 320x568 (iPhone SE 1ª), 375x667 (SE), 390x844 (iPhone 14), 430x932 (Pro Max), 360x800 (Android).
- Tablets em pé e deitados: iPad mini 768x1024, iPad 820x1180, iPad Air 834x1194, iPad Pro 12,9" 1024x1366.
Para cada tamanho: o menu não ultrapassa a tela, nenhum nome está cortado, todos os módulos estão acessíveis e a gaveta abre e fecha.

Como o login usa a sua conta Supabase, vou testar o menu numa página temporária só de desenvolvimento, com permissões simuladas, e removê-la depois.

## Detalhes técnicos
- `AppSidebar`: ramo `isMobile` (de `useSidebar`) renderizando lista (`flex-row`, `min-h-11`, `Collapsible` para subItems, `setOpenMobile(false)` no clique) com `pb-[env(safe-area-inset-bottom)]`; ramo desktop/tablet mantém o trilho.
- Popover dos subitens: só no trilho; `onOpenChange` já cobre toque.
- `useAutoFit`: após "dense", se ainda houver overflow, liberar `overflow-y-auto` com scrollbar fina como último recurso.
- Harness temporário `/__sidebar-preview` (somente `import.meta.env.DEV`) com providers simulados; script Playwright em `/tmp/browser/sidebar` mede `scrollHeight`, `scrollWidth` dos rótulos e tira capturas. Remover a rota no final.
